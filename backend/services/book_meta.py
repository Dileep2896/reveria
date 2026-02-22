"""Book meta generation — title + cover image."""

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


async def gen_title(full_text: str) -> str:
    """Generate a short book title (max 4 words) from story text."""
    try:
        client = get_gemini_client()
        model = get_gemini_model()
        response = await client.aio.models.generate_content(
            model=model,
            contents=types.Content(
                role="user",
                parts=[types.Part(text=f"Here is a children's story:\n\n{full_text}\n\nGenerate a book title for this story. Maximum 4 words. Do not use quotes. Output only the title, nothing else.")],
            ),
            config=types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=20,
            ),
        )
        if response.text:
            title = response.text.strip().strip('"\'')
            words = title.split()
            if len(words) > 4:
                title = " ".join(words[:4])
            return title
    except Exception as e:
        logger.error("Title generation failed: %s", e)
    return "Untitled"


async def gen_cover(full_text: str, art_style: str, story_id: str) -> str | None:
    """Generate a portrait book cover and upload to GCS."""
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
        response = await client.aio.models.generate_content(
            model=model,
            contents=types.Content(
                role="user",
                parts=[types.Part(text=(
                    f"Here is a story:\n\n{full_text}\n\n"
                    f"Generate a single detailed image prompt for a book cover illustration.\n"
                    f"The cover should capture the essence and key characters of the story.\n"
                    f"The image MUST match this art style: {art_style_suffix}.\n"
                    f"End the prompt with: {art_style_suffix}\n"
                    f"Do NOT include any text, titles, words, or lettering in the image.\n"
                    f"Output only the image prompt, nothing else."
                ))],
            ),
            config=types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=200,
            ),
        )
        cover_prompt = response.text.strip() if response.text else None
        if not cover_prompt:
            return None

        cover_data = None
        for attempt in range(3):
            cover_data, err = await generate_image(cover_prompt, aspect_ratio="3:4")
            if cover_data:
                break
            if err == "safety_filter":
                return None  # terminal — re-prompting won't help
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
) -> None:
    """Background task: generate title + cover after pipeline run, notify frontend via WS."""
    try:
        scene_texts = [s.get("text", "") for s in scenes if s.get("text")]
        if not scene_texts:
            return

        full_text = "\n\n".join(scene_texts)
        title, cover_url = await asyncio.gather(
            gen_title(full_text),
            gen_cover(full_text, art_style, story_id),
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
