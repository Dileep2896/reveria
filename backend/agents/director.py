import json
import logging
from typing import Any

from google.genai import types
from services.gemini_client import get_client, get_model

logger = logging.getLogger("storyforge.director")

DIRECTOR_SYSTEM_PROMPT = """You are the Director of StoryForge — an expert narrative analyst.
Analyze the story and return a JSON object with exactly these 4 keys.
Each key maps to a structured object as described below.

The input will specify SCENE COUNT: N. This is the exact number of scenes in this batch.

1. "narrative_arc": {
     "summary": "short phrase (5-8 words) capturing the arc",
     "stage": one of "exposition", "rising_action", "climax", "falling_action", "resolution",
     "pacing": one of "slow", "moderate", "fast",
     "detail": "2-3 sentences on structure, pacing, and narrative technique"
   }

2. "characters": {
     "summary": "short phrase (5-8 words) about the cast",
     "list": [{"name": "...", "role": "1-2 words", "trait": "one adjective"}, ...],
     "detail": "2-3 sentences on who appears, motivations, and development"
   }

3. "tension": {
     "summary": "short phrase (5-8 words) about tension dynamics",
     "levels": [int, int, ...] MUST have exactly SCENE COUNT entries, one integer (1-10) per scene in order,
     "trend": one of "rising", "falling", "steady", "volatile",
     "detail": "1-2 sentences about the tension dynamics"
   }

4. "visual_style": {
     "summary": "short phrase (5-8 words) about the visual feel",
     "tags": ["keyword1", "keyword2", ...] (3-5 keywords describing the style),
     "mood": one of "peaceful", "mysterious", "tense", "chaotic", "melancholic", "joyful", "epic",
     "detail": "2-3 sentences about art style choices, visual mood, and atmosphere"
   }

IMPORTANT: The "levels" array in tension MUST have exactly as many entries as SCENE COUNT.
Output ONLY valid JSON, no markdown fences, no extra text."""


class Director:
    async def analyze(
        self,
        full_story_text: str,
        user_prompt: str,
        art_style: str = "cinematic",
        scene_count: int = 2,
    ) -> dict[str, Any] | None:
        """Analyze the story and return structured creative insights."""
        client = get_client()
        model = get_model()

        user_input = (
            f"USER PROMPT: {user_prompt}\n"
            f"ART STYLE: {art_style}\n"
            f"SCENE COUNT: {scene_count}\n\n"
            f"FULL STORY:\n{full_story_text}"
        )

        try:
            response = await client.aio.models.generate_content(
                model=model,
                contents=types.Content(
                    role="user",
                    parts=[types.Part(text=user_input)],
                ),
                config=types.GenerateContentConfig(
                    system_instruction=DIRECTOR_SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    temperature=0.4,
                    max_output_tokens=1000,
                ),
            )

            if response.text:
                result = json.loads(response.text)
                # Ensure tension levels array matches scene count
                tension = result.get("tension")
                if tension and isinstance(tension.get("levels"), list):
                    levels = tension["levels"]
                    if len(levels) < scene_count:
                        # Pad with the last level value
                        last = levels[-1] if levels else 5
                        levels.extend([last] * (scene_count - len(levels)))
                    elif len(levels) > scene_count:
                        tension["levels"] = levels[:scene_count]
                logger.info("Director analysis complete")
                return result

        except json.JSONDecodeError as e:
            logger.error("Director returned invalid JSON: %s", e)
        except Exception as e:
            logger.error("Director analysis failed: %s", e)

        return None
