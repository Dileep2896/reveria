"""Story endpoints — public story view, PDF export, delete."""

import asyncio
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import Response

from services.auth import verify_token
from services.firestore_client import get_db, delete_story
from services.storage_client import delete_story_media

router = APIRouter()


@router.get("/api/public/stories/{story_id}")
async def get_public_story(story_id: str) -> dict[str, Any]:
    """Return a published story for unauthenticated viewing."""
    db = get_db()
    story_ref = db.collection("stories").document(story_id)
    snap = await story_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Story not found")
    data = snap.to_dict()
    if not data.get("is_public"):
        raise HTTPException(status_code=404, detail="Story not found")

    # Load scenes
    scenes = []
    async for scene_doc in story_ref.collection("scenes").order_by("scene_number").stream():
        s = scene_doc.to_dict()
        scenes.append({
            "scene_number": s.get("scene_number"),
            "text": s.get("text", ""),
            "scene_title": s.get("scene_title"),
            "image_url": s.get("image_url"),
            "audio_url": s.get("audio_url"),
            "word_timestamps": s.get("word_timestamps"),
        })

    # Load generations
    generations = []
    async for gen_doc in story_ref.collection("generations").stream():
        g = gen_doc.to_dict()
        generations.append({
            "prompt": g.get("prompt"),
            "directorData": g.get("director_data"),
            "sceneNumbers": g.get("scene_numbers", []),
            "_id": gen_doc.id,
        })
    generations.sort(key=lambda g: int(g.pop("_id", "0")))

    return {
        "storyId": story_id,
        "title": data.get("title", "Untitled"),
        "cover_image_url": data.get("cover_image_url"),
        "author_name": data.get("author_name", "Anonymous"),
        "author_photo_url": data.get("author_photo_url"),
        "art_style": data.get("art_style", "cinematic"),
        "language": data.get("language", "English"),
        "scenes": scenes,
        "generations": generations,
        "status": data.get("status", "completed"),
        "is_public": True,
        "book_details": data.get("book_details", {}),
    }


@router.get("/api/stories/{story_id}/pdf")
async def export_story_pdf(
    story_id: str,
    authorization: str = Header(...),
) -> Response:
    """Export a story as a downloadable PDF."""
    from services.pdf_export import generate_story_pdf

    token = authorization.removeprefix("Bearer ").strip()
    uid = await verify_token(token)
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid auth token")

    db = get_db()
    story_ref = db.collection("stories").document(story_id)
    snap = await story_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Story not found")
    data = snap.to_dict()

    # Allow owner or public stories
    if data.get("uid") != uid and not data.get("is_public"):
        raise HTTPException(status_code=403, detail="Access denied")

    # Load scenes
    scenes = []
    async for scene_doc in story_ref.collection("scenes").order_by("scene_number").stream():
        scenes.append(scene_doc.to_dict())

    title = data.get("title", "Untitled Story")
    author = data.get("author_name", "Anonymous")
    cover_url = data.get("cover_image_url")

    pdf_bytes = generate_story_pdf(title, author, cover_url, scenes)

    safe_title = "".join(c for c in title if c.isalnum() or c in " -_").strip() or "story"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_title}.pdf"'},
    )


@router.delete("/api/stories/{story_id}")
async def delete_story_endpoint(
    story_id: str,
    authorization: str = Header(...),
) -> dict[str, Any]:
    """Delete a story: Firestore doc + subcollections + GCS media."""
    token = authorization.removeprefix("Bearer ").strip()
    uid = await verify_token(token)
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid auth token")

    deleted = await delete_story(story_id, uid)
    if not deleted:
        raise HTTPException(status_code=404, detail="Story not found or access denied")

    # Clean up GCS media in background (don't block the response)
    asyncio.create_task(delete_story_media(story_id))

    return {"deleted": True, "story_id": story_id}
