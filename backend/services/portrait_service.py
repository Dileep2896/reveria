"""Portrait generation service - character face portraits from illustrator's character sheet."""

import logging
from typing import Any

from fastapi import WebSocket

from agents.illustrator import Illustrator
from services.imagen_client import generate_image
from services.storage_client import upload_media
from services.firestore_client import get_db

logger = logging.getLogger("storyforge")


async def generate_portraits(
    websocket: WebSocket,
    illustrator: Illustrator,
    story_id: str,
    safe_send=None,
    existing_names: list[str] | None = None,
) -> None:
    """Generate character portrait images from the illustrator's character sheet.

    If *existing_names* is provided, only characters whose names are NOT
    already in that list (case-insensitive) will get new portraits.
    """
    if safe_send is None:
        async def safe_send(ws, data):
            try:
                await ws.send_json(data)
            except Exception:
                pass

    try:
        sheet = illustrator._character_sheet

        # If character sheet is empty, try extracting characters from story text first
        if not sheet and illustrator._accumulated_story:
            logger.info("Character sheet empty, extracting from accumulated story...")
            await illustrator.extract_characters(illustrator._accumulated_story)
            sheet = illustrator._character_sheet

        if not sheet:
            await safe_send(websocket, {"type": "portraits_done"})
            return

        # Parse character names and descriptions from sheet
        # Sheet format: "CHARACTER_NAME: description..."
        characters = []
        for line in sheet.strip().split("\n"):
            line = line.strip()
            if ":" in line and len(line) > 5:
                name, desc = line.split(":", 1)
                name = name.strip().strip("-•* ")
                desc = desc.strip()
                if name and desc and len(name) < 50:
                    characters.append({"name": name, "description": desc})

        if not characters:
            await safe_send(websocket, {"type": "portraits_done"})
            return

        # Filter out characters that already have portraits
        if existing_names:
            existing_lower = {n.lower() for n in existing_names}
            characters = [c for c in characters if c["name"].lower() not in existing_lower]

        if not characters:
            logger.info("All characters already have portraits, skipping")
            await safe_send(websocket, {"type": "portraits_done"})
            return

        # Notify frontend that portrait generation is starting
        await safe_send(websocket, {"type": "portraits_loading"})

        art_suffix = illustrator.art_style_suffix
        strip_hex = illustrator._strip_hex_codes
        portrait_results = []
        # Offset GCS index to avoid overwriting existing portrait files
        index_offset = len(existing_names or [])

        for idx, char in enumerate(characters):
            clean_desc = strip_hex(char['description'])
            prompt = (
                f"{clean_desc}. "
                f"Close-up face portrait of {char['name']}, head and shoulders, "
                f"looking at the viewer, detailed facial features, expressive eyes, "
                f"{art_suffix}"
            )
            try:
                image_data, error_reason = await generate_image(prompt, aspect_ratio="1:1")
                if image_data:
                    gcs_url = await upload_media(story_id, 900 + index_offset + idx, "portrait", image_data)
                    portrait_results.append({"name": char["name"], "image_url": gcs_url})
                    await safe_send(websocket, {
                        "type": "portrait",
                        "name": char["name"],
                        "image_url": gcs_url,
                    })
                else:
                    portrait_results.append({"name": char["name"], "image_url": None})
                    await safe_send(websocket, {
                        "type": "portrait",
                        "name": char["name"],
                        "image_url": None,
                        "error": error_reason or "generation_failed",
                    })
            except Exception as e:
                logger.error("Portrait generation error for %s: %s", char["name"], e)

        if portrait_results and story_id:
            try:
                from google.cloud.firestore_v1.transforms import ArrayUnion
                db = get_db()
                try:
                    await db.collection("stories").document(story_id).update({
                        "portraits": ArrayUnion(portrait_results)
                    })
                except Exception:
                    await db.collection("stories").document(story_id).set(
                        {"portraits": portrait_results}, merge=True
                    )
                logger.info("Persisted %d new portraits for story %s", len(portrait_results), story_id)
            except Exception as e:
                logger.error("Failed to persist portraits: %s", e)

        await safe_send(websocket, {"type": "portraits_done"})

    except Exception as e:
        logger.error("Portrait generation failed: %s", e)
        await safe_send(websocket, {"type": "error", "content": "Portrait generation failed."})
        await safe_send(websocket, {"type": "portraits_done"})
