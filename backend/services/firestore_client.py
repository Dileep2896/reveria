"""Firestore persistence for story sessions."""

import logging
import os
from datetime import datetime, timezone
from typing import Any

from google.cloud.firestore import AsyncClient

logger = logging.getLogger("storyforge.firestore")

_db: AsyncClient | None = None


def get_db() -> AsyncClient:
    """Lazy singleton Firestore async client."""
    global _db
    if _db is None:
        project = os.getenv("FIREBASE_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT")
        _db = AsyncClient(project=project)
    return _db


async def persist_story(
    story_id: str,
    uid: str,
    narrator_history: list[dict[str, str]],
    illustrator_state: dict[str, str],
    total_scene_count: int,
    art_style: str,
    scenes: list[dict[str, Any]],
    batch_index: int,
    user_input: str,
    director_data: dict[str, Any] | None = None,
) -> None:
    """Upsert story document and write scene/generation subcollections."""
    db = get_db()
    story_ref = db.collection("stories").document(story_id)

    # Only set status + created_at on brand-new documents
    existing = await story_ref.get()
    if not existing.exists:
        await story_ref.set({
            "uid": uid,
            "status": "draft",
            "created_at": datetime.now(timezone.utc),
        })

    # Merge mutable fields — never touches status, title, cover_image_url, is_public
    await story_ref.set(
        {
            "uid": uid,
            "updated_at": datetime.now(timezone.utc),
            "art_style": art_style,
            "total_scene_count": total_scene_count,
            "narrator_history": narrator_history,
            "illustrator_state": illustrator_state,
        },
        merge=True,
    )

    # Write scenes to subcollection
    for scene in scenes:
        scene_ref = story_ref.collection("scenes").document(
            str(scene["scene_number"])
        )
        await scene_ref.set(
            {
                "scene_number": scene["scene_number"],
                "text": scene.get("text", ""),
                "scene_title": scene.get("scene_title"),
                "image_url": scene.get("image_url"),
                "audio_url": scene.get("audio_url"),
                "prompt": scene.get("prompt", ""),
                "batch_index": batch_index,
            }
        )

    # Write generation batch
    gen_ref = story_ref.collection("generations").document(str(batch_index))
    await gen_ref.set(
        {
            "prompt": user_input,
            "director_data": director_data,
            "scene_numbers": [s["scene_number"] for s in scenes],
        }
    )

    logger.info("Persisted story %s (batch %d, %d scenes)", story_id, batch_index, len(scenes))


async def delete_story(story_id: str, uid: str) -> bool:
    """Delete a story document and all subcollections. Returns True if deleted."""
    db = get_db()
    story_ref = db.collection("stories").document(story_id)
    doc = await story_ref.get()

    if not doc.exists:
        return False

    data = doc.to_dict()
    if data.get("uid") != uid:
        logger.warning("UID mismatch on delete for story %s", story_id)
        return False

    # Delete subcollections: scenes, generations
    for sub in ("scenes", "generations"):
        sub_ref = story_ref.collection(sub)
        async for sub_doc in sub_ref.stream():
            await sub_doc.reference.delete()

    # Delete the story document itself
    await story_ref.delete()
    logger.info("Deleted story %s and subcollections", story_id)
    return True


async def load_story(story_id: str, uid: str) -> dict[str, Any] | None:
    """Load a story and verify ownership. Returns combined dict or None."""
    db = get_db()
    story_ref = db.collection("stories").document(story_id)
    doc = await story_ref.get()

    if not doc.exists:
        return None

    data = doc.to_dict()
    if data.get("uid") != uid:
        logger.warning("UID mismatch for story %s", story_id)
        return None

    # Load scenes subcollection
    scenes_query = story_ref.collection("scenes").order_by("scene_number")
    scenes = []
    async for scene_doc in scenes_query.stream():
        scenes.append(scene_doc.to_dict())

    # Load generations subcollection
    gens_query = story_ref.collection("generations")
    generations = []
    async for gen_doc in gens_query.stream():
        gen_data = gen_doc.to_dict()
        gen_data["_id"] = gen_doc.id
        generations.append(gen_data)
    # Sort by document ID (numeric string)
    generations.sort(key=lambda g: int(g.pop("_id", "0")))

    data["scenes"] = scenes
    data["generations"] = generations
    return data


