"""Book details endpoints - generate, update, public view."""

import time
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from services.auth import verify_token
from services.firestore_client import get_db
from services.book_details import generate_book_details

router = APIRouter()


# ── Generate book details ──


@router.post("/api/stories/{story_id}/book-details/generate")
async def generate_details(
    story_id: str,
    authorization: str = Header(...),
) -> dict[str, Any]:
    """Generate AI book details (synopsis, genre, themes, etc.) for a story."""
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
        raise HTTPException(status_code=403, detail="Not your story")

    # Guard: don't regenerate if already done (unless previous attempt failed)
    existing_details = data.get("book_details", {})
    if data.get("book_details_generated") and not existing_details.get("_failed"):
        return {"book_details": existing_details, "already_generated": True}

    # Mark as in-progress to prevent concurrent duplicate calls
    await story_ref.update({"book_details_generated": True})

    # Load scenes
    scene_texts = []
    async for scene_doc in story_ref.collection("scenes").order_by("scene_number").stream():
        text = scene_doc.to_dict().get("text", "")
        if text:
            scene_texts.append(text)

    if not scene_texts:
        await story_ref.update({"book_details_generated": False})
        raise HTTPException(status_code=400, detail="No scenes found")

    # Collect director data from generations
    director_data_list = []
    async for gen_doc in story_ref.collection("generations").stream():
        dd = gen_doc.to_dict().get("director_data")
        if dd:
            director_data_list.append(dd)

    language = data.get("language", "English")
    details = await generate_book_details(scene_texts, director_data_list, language)
    details["generated_at"] = time.time()

    # If generation failed (fallback), don't lock out regeneration
    is_failed = details.pop("_failed", False)
    await story_ref.update({
        "book_details": details,
        "book_details_generated": not is_failed,
    })

    return {"book_details": details, "already_generated": False}


# ── Update book details (author edits) ──


class BookDetailsUpdate(BaseModel):
    synopsis: str | None = None
    genre_tags: list[str] | None = None
    themes: list[str] | None = None
    mood: str | None = None
    target_audience: str | None = None
    character_list: list[dict[str, str]] | None = None
    content_warnings: list[str] | None = None
    hook_quote: str | None = None


@router.put("/api/stories/{story_id}/book-details")
async def update_details(
    story_id: str,
    body: BookDetailsUpdate,
    authorization: str = Header(...),
) -> dict[str, Any]:
    """Save author edits to book details."""
    token = authorization.removeprefix("Bearer ").strip()
    uid = await verify_token(token)
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid auth token")

    db = get_db()
    story_ref = db.collection("stories").document(story_id)
    snap = await story_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Story not found")
    if snap.to_dict().get("uid") != uid:
        raise HTTPException(status_code=403, detail="Not your story")

    existing = snap.to_dict().get("book_details", {})
    updates = body.model_dump(exclude_none=True)
    merged = {**existing, **updates}

    await story_ref.update({"book_details": merged})
    return {"book_details": merged}


# ── Public book details view ──


@router.get("/api/public/stories/{story_id}/details")
async def get_public_details(story_id: str) -> dict[str, Any]:
    """Return lightweight public metadata for a published story (no scenes)."""
    db = get_db()
    story_ref = db.collection("stories").document(story_id)
    snap = await story_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Story not found")

    data = snap.to_dict()
    if not data.get("is_public"):
        raise HTTPException(status_code=404, detail="Story not found")

    book_details = data.get("book_details", {})
    liked_by = data.get("liked_by", [])

    rating_sum = data.get("rating_sum", 0) or 0
    rating_count = data.get("rating_count", 0) or 0
    rating_avg = round(rating_sum / rating_count, 1) if rating_count > 0 else 0

    comment_count = data.get("comment_count", 0) or 0

    return {
        "storyId": story_id,
        "title": data.get("title", "Untitled"),
        "cover_image_url": data.get("cover_image_url"),
        "author_name": data.get("author_name", "Anonymous"),
        "author_photo_url": data.get("author_photo_url"),
        "art_style": data.get("art_style", "cinematic"),
        "language": data.get("language", "English"),
        "total_scene_count": data.get("total_scene_count", 0),
        "is_public": True,
        "published_at": data.get("published_at"),
        "like_count": len(liked_by),
        "rating_avg": rating_avg,
        "rating_count": rating_count,
        "comment_count": comment_count,
        "book_details": book_details,
    }
