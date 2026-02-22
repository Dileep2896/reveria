"""Scene rewriting service — regenerates a single scene with Gemini."""

import logging
from typing import Any

from google.genai import types

from services.gemini_client import get_client as get_gemini_client, get_model as get_gemini_model

logger = logging.getLogger("storyforge")


async def rewrite_scene_text(
    scene_text: str,
    scene_number: int,
    all_scenes: list[dict[str, Any]],
    language: str = "English",
) -> str | None:
    """Rewrite a single scene using Gemini with full story context."""
    try:
        context_parts = []
        for s in all_scenes:
            num = s.get("scene_number", "?")
            txt = s.get("text", "")
            if txt:
                context_parts.append(f"[Scene {num}]\n{txt}")
        story_context = "\n\n".join(context_parts)

        lang_instruction = f" Write entirely in {language}." if language and language != "English" else ""
        prompt = (
            f"Here is a story so far:\n\n{story_context}\n\n"
            f"Rewrite Scene {scene_number} with a fresh take. Keep the same characters and "
            f"general plot point but use different descriptions and phrasing. "
            f"Write 80-100 words, present tense, third person, plain text only (no markdown, "
            f"no scene markers, no titles).{lang_instruction} Output only the rewritten scene text."
        )

        client = get_gemini_client()
        model = get_gemini_model()
        response = await client.aio.models.generate_content(
            model=model,
            contents=types.Content(
                role="user",
                parts=[types.Part(text=prompt)],
            ),
            config=types.GenerateContentConfig(
                temperature=0.9,
                max_output_tokens=300,
            ),
        )
        if response.text:
            return response.text.strip()
    except Exception as e:
        logger.error("Scene rewrite failed for scene %d: %s", scene_number, e)
    return None
