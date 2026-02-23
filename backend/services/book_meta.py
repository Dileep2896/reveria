"""Book meta generation - title + cover image."""

import asyncio
import logging
from typing import Any

from fastapi import WebSocket
from google.genai import types

from services.gemini_client import get_client as get_gemini_client, get_model as get_gemini_model
from services.imagen_client import generate_image, get_quota_cooldown_remaining
from services.storage_client import upload_cover
from services.firestore_client import get_db

logger = logging.getLogger("storyforge")


async def gen_title(full_text: str, language: str = "English") -> str:
    """Generate a short book title (max 4 words) from story text."""
    try:
        client = get_gemini_client()
        model = get_gemini_model()

        lang_instruction = ""
        if language and language.lower() != "english":
            lang_instruction = f" The title MUST be in {language}."

        response = await client.aio.models.generate_content(
            model=model,
            contents=types.Content(
                role="user",
                parts=[types.Part(text=(
                    f"Here is a story:\n\n{full_text}\n\n"
                    f"Generate a book title for this story. Maximum 4 words.{lang_instruction} "
                    f"Do not use quotes. Output only the title, nothing else."
                ))],
            ),
            config=types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=30,
            ),
        )
        if response.text:
            title = response.text.strip().strip('"\'')
            words = title.split()
            if len(words) > 6:
                title = " ".join(words[:6])
            return title
    except Exception as e:
        logger.error("Title generation failed: %s", e)
    return "Untitled"


async def gen_cover(
    full_text: str, art_style: str, story_id: str,
    character_sheet: str = "",
) -> str | None:
    """Generate a portrait book cover using the hybrid prompt architecture.

    Uses the same character-consistent approach as scene images:
    character descriptions prepended verbatim + scene composition from Gemini.
    """
    from agents.illustrator import ART_STYLES as ILLUSTRATOR_ART_STYLES
    art_style_suffix = ILLUSTRATOR_ART_STYLES.get(art_style, ILLUSTRATOR_ART_STYLES["cinematic"])

    try:
        # Wait for quota cooldown if scene images exhausted it
        cooldown = get_quota_cooldown_remaining()
        if cooldown > 0:
            logger.info("Cover gen waiting %ds for quota cooldown...", cooldown)
            await asyncio.sleep(cooldown + 2)

        client = get_gemini_client()
        model = get_gemini_model()

        # Gemini writes ONLY the cover composition — no character appearance
        response = await client.aio.models.generate_content(
            model=model,
            contents=types.Content(
                role="user",
                parts=[types.Part(text=(
                    f"Here is a story:\n\n{full_text}\n\n"
                    f"Generate a single image prompt for a book cover illustration.\n"
                    f"Describe ONLY: setting, environment, character poses/actions, "
                    f"lighting, mood, atmosphere, camera angle, and composition.\n"
                    f"Do NOT describe any character's appearance (hair, clothes, skin, "
                    f"age, build, etc.) — character details are handled separately.\n"
                    f"Reference characters by name only (e.g., 'Elara stands in the doorway').\n"
                    f"Keep it under 100 words.\n"
                    f"End with: {art_style_suffix}\n"
                    f"Do NOT include any text, titles, words, or lettering in the image.\n"
                    f"Output only the image prompt, nothing else."
                ))],
            ),
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=200,
            ),
        )
        scene_composition = response.text.strip() if response.text else None
        if not scene_composition:
            return None

        # Build hybrid prompt: character DNA + anti-drift + scene composition
        if character_sheet:
            anti_drift = (
                "IMPORTANT: Render each character EXACTLY as described above - "
                "same colors, same outfit, same signature items. "
                "Do not alter, omit, or reinterpret any character detail."
            )
            cover_prompt = f"{character_sheet}\n\n{anti_drift}\n\n{scene_composition}"
        else:
            cover_prompt = scene_composition

        logger.info("Cover prompt: %s...", cover_prompt[:200])

        cover_data = None
        for attempt in range(3):
            cover_data, err = await generate_image(cover_prompt, aspect_ratio="3:4")
            if cover_data:
                break
            if err == "safety_filter":
                return None  # terminal - re-prompting won't help
            # Wait for quota cooldown on exhaustion, short delay otherwise
            if err == "quota_exhausted":
                wait = get_quota_cooldown_remaining() + 2
                logger.info("Cover gen retry %d: waiting %ds for quota...", attempt + 1, wait)
                await asyncio.sleep(wait)
            elif attempt < 2:
                await asyncio.sleep(3)
        if not cover_data:
            return None

        cover_url = await upload_cover(story_id, cover_data)
        return cover_url
    except Exception as e:
        logger.error("Cover generation failed: %s", e)
        return None


async def auto_generate_meta(
    story_id: str,
    scenes: list[dict[str, Any]],
    art_style: str,
    websocket: WebSocket | None = None,
    safe_send=None,
    language: str = "English",
    character_sheet: str = "",
) -> None:
    """Background task: generate title + cover after pipeline run, notify frontend via WS."""
    try:
        scene_texts = [s.get("text", "") for s in scenes if s.get("text")]
        if not scene_texts:
            return

        full_text = "\n\n".join(scene_texts)
        title, cover_url = await asyncio.gather(
            gen_title(full_text, language=language),
            gen_cover(full_text, art_style, story_id, character_sheet=character_sheet),
        )

        # Fall back to first scene image if cover generation failed
        # Filter out base64 data URLs (can happen if GCS upload failed)
        if not cover_url:
            cover_url = next(
                (s.get("image_url") for s in scenes
                 if s.get("image_url") and not s["image_url"].startswith("data:")),
                None,
            )

        db = get_db()
        doc_ref = db.collection("stories").document(story_id)
        snap = await doc_ref.get()
        if snap.exists and snap.to_dict().get("title_generated"):
            return  # Already done (race guard)

        update: dict[str, Any] = {
            "title": title,
            "title_generated": True,
        }
        if cover_url:
            update["cover_image_url"] = cover_url
        await doc_ref.update(update)
        logger.info("Auto-generated meta for %s: title=%r, cover=%s", story_id, title, bool(cover_url))
        if websocket and safe_send:
            await safe_send(websocket, {
                "type": "book_meta",
                "title": title,
                "cover_image_url": update.get("cover_image_url"),
            })
    except Exception as e:
        logger.error("Auto meta generation failed for %s: %s", story_id, e)
        # Still mark as done with fallbacks so Library never gets stuck
        try:
            db = get_db()
            doc_ref = db.collection("stories").document(story_id)
            fallback_cover = next(
                (s.get("image_url") for s in scenes
                 if s.get("image_url") and not s["image_url"].startswith("data:")),
                None,
            )
            update: dict[str, Any] = {"title": "Untitled Story", "title_generated": True}
            if fallback_cover:
                update["cover_image_url"] = fallback_cover
            await doc_ref.update(update)
            logger.info("Set fallback meta for %s after failure", story_id)
            if websocket and safe_send:
                await safe_send(websocket, {
                    "type": "book_meta",
                    "title": update["title"],
                    "cover_image_url": update.get("cover_image_url"),
                })
        except Exception as e2:
            logger.error("Fallback meta update also failed for %s: %s", story_id, e2)
