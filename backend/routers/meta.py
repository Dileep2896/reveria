"""Book meta generation endpoint."""

import asyncio
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from services.auth import verify_token
from services.firestore_client import get_db
from services.book_meta import gen_title, gen_cover

router = APIRouter()


class BookMetaRequest(BaseModel):
    scene_texts: list[str]
    art_style: str
    story_id: str


@router.post("/api/generate-book-meta")
async def generate_book_meta(
    body: BookMetaRequest,
    authorization: str = Header(...),
) -> dict[str, Any]:
    # Auth
    token = authorization.removeprefix("Bearer ").strip()
    uid = await verify_token(token)
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid auth token")

    # Verify story ownership before generating (cover uploads to GCS under story_id)
    story_ref = get_db().collection("stories").document(body.story_id)
    snap = await story_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Story not found")
    story_data = snap.to_dict()
    if story_data.get("uid") != uid:
        raise HTTPException(status_code=403, detail="Not your story")

    # Load character sheet + visual DNA from persisted illustrator state for visual consistency
    illust_state = story_data.get("illustrator_state") or {}
    character_sheet = illust_state.get("character_sheet", "")
    visual_dna = illust_state.get("visual_dna") or {}

    language = story_data.get("language", "English")
    full_text = "\n\n".join(body.scene_texts)
    title, cover_url = await asyncio.gather(
        gen_title(full_text, language=language),
        gen_cover(full_text, body.art_style, body.story_id, character_sheet=character_sheet, visual_dna=visual_dna),
    )

    return {"title": title, "cover_image_url": cover_url}


@router.post("/api/stories/{story_id}/regenerate-meta")
async def regenerate_meta(
    story_id: str,
    authorization: str = Header(...),
) -> dict[str, Any]:
    """Regenerate title + cover for a story and persist to Firestore."""
    token = authorization.removeprefix("Bearer ").strip()
    uid = await verify_token(token)
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid auth token")

    db = get_db()
    story_ref = db.collection("stories").document(story_id)
    snap = await story_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Story not found")
    story_data = snap.to_dict()
    if story_data.get("uid") != uid:
        raise HTTPException(status_code=403, detail="Not your story")

    # Load scenes
    scene_docs = []
    async for s in story_ref.collection("scenes").order_by("scene_number").stream():
        scene_docs.append(s)
    scene_texts = [s.to_dict().get("text", "") for s in scene_docs if s.to_dict().get("text")]
    if not scene_texts:
        raise HTTPException(status_code=400, detail="No scene text to generate from")

    art_style = story_data.get("art_style", "cinematic")
    language = story_data.get("language", "English")
    illust_state = story_data.get("illustrator_state") or {}
    character_sheet = illust_state.get("character_sheet", "")
    visual_dna = illust_state.get("visual_dna") or {}

    full_text = "\n\n".join(scene_texts)
    title, cover_url = await asyncio.gather(
        gen_title(full_text, language=language),
        gen_cover(full_text, art_style, story_id, character_sheet=character_sheet, visual_dna=visual_dna),
    )

    # Fall back to first scene image
    if not cover_url:
        for s in scene_docs:
            url = s.to_dict().get("image_url")
            if url and not url.startswith("data:"):
                cover_url = url
                break

    update: dict[str, Any] = {"title": title, "title_generated": True}
    if cover_url:
        update["cover_image_url"] = cover_url
        update["cover_generated"] = True  # proper AI-generated cover
    await story_ref.update(update)

    return {"title": title, "cover_image_url": cover_url}
