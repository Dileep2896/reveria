"""Book details generation — synopsis, genre, themes, characters, etc."""

import json
import logging
from typing import Any

from google.genai import types

from services.gemini_client import get_client as get_gemini_client, get_model as get_gemini_model

logger = logging.getLogger("storyforge")

GENRE_OPTIONS = [
    "Fantasy", "Adventure", "Mystery", "Science Fiction", "Romance",
    "Horror", "Comedy", "Drama", "Fairy Tale", "Fable", "Historical",
    "Superhero", "Animal Story", "Coming of Age", "Dystopian",
]

MOOD_OPTIONS = [
    "Whimsical", "Dark", "Heartwarming", "Epic", "Mysterious",
    "Playful", "Suspenseful", "Dreamy", "Lighthearted", "Bittersweet",
    "Adventurous", "Cozy", "Eerie", "Inspiring", "Humorous",
]


async def generate_book_details(
    scene_texts: list[str],
    director_data_list: list[dict[str, Any]] | None = None,
    language: str = "English",
) -> dict[str, Any]:
    """Generate structured book details from story scenes using Gemini JSON output."""

    full_text = "\n\n".join(scene_texts)
    word_count = len(full_text.split())
    reading_time = max(1, round(word_count / 200))

    # Build director context if available
    director_context = ""
    if director_data_list:
        for dd in director_data_list:
            if not dd:
                continue
            chars = dd.get("characters") or dd.get("character_list")
            if chars:
                director_context += f"\nCharacter data from director: {json.dumps(chars)}"

    prompt = f"""You are a book editor creating metadata for a published storybook.

Here is the full story text:

{full_text}

{f"Additional character context:{director_context}" if director_context else ""}

The story is written in {language}.

Generate book details as JSON with these exact fields:
- "synopsis": A compelling 2-4 sentence book jacket blurb. No spoilers. Write in {language}.
- "genre_tags": Array of 2-4 genres from this list: {json.dumps(GENRE_OPTIONS)}
- "themes": Array of 2-3 deeper themes (e.g. "Power of Friendship", "Overcoming Fear"). Write in {language}.
- "mood": A single word from this list: {json.dumps(MOOD_OPTIONS)}
- "target_audience": An age range string (e.g. "Ages 6-8", "Young Adults", "All Ages")
- "character_list": Array of objects with "name", "role" (e.g. "Protagonist", "Antagonist", "Sidekick"), and "description" (1 sentence). Write descriptions in {language}.
- "content_warnings": Array of 0-3 content warnings, ONLY if genuinely applicable (e.g. "Mild peril", "Loss of a loved one"). Empty array if none.
- "hook_quote": The single most evocative or memorable sentence from the story text (exact quote).

Output ONLY valid JSON, no markdown fences, no explanation."""

    try:
        client = get_gemini_client()
        model = get_gemini_model()
        response = await client.aio.models.generate_content(
            model=model,
            contents=types.Content(
                role="user",
                parts=[types.Part(text=prompt)],
            ),
            config=types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=1500,
                response_mime_type="application/json",
            ),
        )

        if not response.text:
            logger.warning("Book details generation returned empty response")
            return _fallback_details(scene_texts, reading_time)

        raw = response.text.strip()
        # Strip markdown fences if present despite instruction
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        details = json.loads(raw)
        details["reading_time_minutes"] = reading_time
        return _validate_details(details)

    except json.JSONDecodeError as e:
        logger.error("Book details JSON parse failed: %s", e)
        return _fallback_details(scene_texts, reading_time)
    except Exception as e:
        logger.error("Book details generation failed: %s", e)
        return _fallback_details(scene_texts, reading_time)


def _validate_details(details: dict[str, Any]) -> dict[str, Any]:
    """Ensure all required fields exist and are properly typed."""
    validated: dict[str, Any] = {}

    validated["synopsis"] = str(details.get("synopsis", ""))[:500]

    genre_tags = details.get("genre_tags", [])
    if isinstance(genre_tags, list):
        validated["genre_tags"] = [str(g) for g in genre_tags[:4]]
    else:
        validated["genre_tags"] = []

    themes = details.get("themes", [])
    if isinstance(themes, list):
        validated["themes"] = [str(t) for t in themes[:3]]
    else:
        validated["themes"] = []

    validated["mood"] = str(details.get("mood", ""))[:30]
    validated["target_audience"] = str(details.get("target_audience", "All Ages"))[:30]

    char_list = details.get("character_list", [])
    if isinstance(char_list, list):
        validated["character_list"] = [
            {
                "name": str(c.get("name", ""))[:50],
                "role": str(c.get("role", ""))[:30],
                "description": str(c.get("description", ""))[:200],
            }
            for c in char_list[:8]
            if isinstance(c, dict) and c.get("name")
        ]
    else:
        validated["character_list"] = []

    warnings = details.get("content_warnings", [])
    if isinstance(warnings, list):
        validated["content_warnings"] = [str(w) for w in warnings[:3]]
    else:
        validated["content_warnings"] = []

    validated["hook_quote"] = str(details.get("hook_quote", ""))[:300]
    validated["reading_time_minutes"] = details.get("reading_time_minutes", 1)

    return validated


def _fallback_details(scene_texts: list[str], reading_time: int) -> dict[str, Any]:
    """Minimal fallback when AI generation fails. Marked as failed so regeneration is allowed."""
    return {
        "synopsis": "",
        "genre_tags": [],
        "themes": [],
        "mood": "",
        "target_audience": "All Ages",
        "character_list": [],
        "content_warnings": [],
        "hook_quote": "",
        "reading_time_minutes": reading_time,
        "_failed": True,
    }
