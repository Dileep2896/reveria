"""Story endpoints - public story view, PDF export, delete, publish."""

import asyncio
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from services.auth import verify_token
from services.firestore_client import get_db, delete_story
from services.storage_client import delete_story_media
from services.usage import check_limit, increment_usage, decrement_usage

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

    # Check PDF export limit
    allowed, reason, _ = await check_limit(uid, "pdf_export")
    if not allowed:
        raise HTTPException(status_code=429, detail="Daily PDF export limit reached - upgrade to Pro for unlimited exports")

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

    pdf_bytes = await asyncio.to_thread(generate_story_pdf, title, author, cover_url, scenes)

    # Increment PDF export usage
    await increment_usage(uid, "pdf_export")

    # ASCII-safe filename for Content-Disposition (HTTP headers are Latin-1)
    ascii_title = "".join(c for c in title if c.isascii() and (c.isalnum() or c in " -_")).strip() or "story"
    # RFC 5987: filename* with UTF-8 encoding so browsers show the real title
    utf8_filename = quote(f"{title}.pdf", safe="")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{ascii_title}.pdf"; '
                f"filename*=UTF-8''{utf8_filename}"
            )
        },
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

    story_data = await delete_story(story_id, uid)
    if not story_data:
        raise HTTPException(status_code=404, detail="Story not found or access denied")

    # Clean up GCS media in background (don't block the response)
    asyncio.create_task(delete_story_media(story_id))

    # Decrement usage counters (best-effort — don't fail the delete if this errors)
    try:
        await decrement_usage(uid, "create_story")
        if story_data.get("is_public"):
            await decrement_usage(uid, "publish")
    except Exception:
        pass  # transient Firestore errors shouldn't block deletion

    return {"deleted": True, "story_id": story_id}


class PublishBody(BaseModel):
    author_name: str = "Anonymous"
    author_photo_url: str | None = None


@router.post("/api/stories/{story_id}/publish")
async def publish_story(
    story_id: str,
    body: PublishBody,
    authorization: str = Header(...),
) -> dict[str, Any]:
    """Publish a story (make it public). Enforces publish limit."""
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
    if data.get("uid") != uid:
        raise HTTPException(status_code=403, detail="Access denied")

    # Already published - no-op
    if data.get("is_public"):
        return {"ok": True, "already_public": True}

    # Check publish limit
    allowed, reason, _ = await check_limit(uid, "publish")
    if not allowed:
        raise HTTPException(status_code=429, detail="Publish limit reached - upgrade to Pro for unlimited publishing")

    await story_ref.update({
        "is_public": True,
        "published_at": datetime.now(timezone.utc),
        "author_name": body.author_name,
        "author_photo_url": body.author_photo_url,
    })

    await increment_usage(uid, "publish")
    return {"ok": True}
