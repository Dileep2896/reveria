import json
import logging
from typing import Any

from google.genai import types
from services.gemini_client import get_client, get_model

logger = logging.getLogger("storyforge.director")

DIRECTOR_SYSTEM_PROMPT = """You are the Director of StoryForge - an expert narrative analyst.
Analyze the story and return a JSON object with exactly these 9 keys.
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

5. "emotional_arc": {
     "summary": "short phrase (5-8 words) about the emotional journey",
     "values": [float, float, ...] MUST have exactly SCENE COUNT entries, one float (-1.0 to 1.0) per scene (-1=very negative, 0=neutral, 1=very positive),
     "dominant_emotion": one of "hope", "joy", "sadness", "fear", "anger", "surprise", "disgust", "trust",
     "arc_shape": one of "rags_to_riches", "riches_to_rags", "man_in_hole", "icarus", "cinderella", "oedipus",
     "detail": "2-3 sentences about the emotional progression"
   }

6. "directors_notes": {
     "summary": "short phrase (5-8 words) about craft observations",
     "notes": [{"scene": 1, "note": "observation about this scene", "type": one of "pacing", "character", "world_building", "dialogue", "tension", "sensory"}, ...] one note per scene, MUST have exactly SCENE COUNT entries,
     "detail": "1-2 sentences summarizing the key craft takeaway"
   }

7. "story_health": {
     "summary": "short phrase (5-8 words) about overall story quality",
     "scores": {"pacing": int 0-10, "character_depth": int 0-10, "world_building": int 0-10, "dialogue": int 0-10, "coherence": int 0-10},
     "detail": "2-3 sentences about strengths and areas for improvement"
   }

8. "themes": {
     "summary": "short phrase (5-8 words) about thematic content",
     "themes": [{"name": "theme name", "confidence": float 0.0-1.0, "evidence": "brief supporting quote or reference"}, ...] 2-3 themes,
     "detail": "1-2 sentences about how themes interconnect"
   }

9. "beats": {
     "summary": "short phrase (5-8 words) about story structure",
     "current_beat": one of "opening_image", "setup", "catalyst", "debate", "break_into_two", "midpoint", "bad_guys_close_in", "all_is_lost", "break_into_three", "finale",
     "beats_hit": [list of beat names already achieved from the same set above],
     "next_expected": one of the same beat names (the next beat the story should hit),
     "detail": "1-2 sentences about structural progression"
   }

IMPORTANT: Arrays for "levels", "values", and "notes" MUST each have exactly SCENE COUNT entries.
Output ONLY valid JSON, no markdown fences, no extra text."""

# --- Validation constants ---
VALID_BEATS = {
    "opening_image", "setup", "catalyst", "debate", "break_into_two",
    "midpoint", "bad_guys_close_in", "all_is_lost", "break_into_three", "finale",
}
VALID_EMOTIONS = {"hope", "joy", "sadness", "fear", "anger", "surprise", "disgust", "trust"}
VALID_ARC_SHAPES = {"rags_to_riches", "riches_to_rags", "man_in_hole", "icarus", "cinderella", "oedipus"}
VALID_NOTE_TYPES = {"pacing", "character", "world_building", "dialogue", "tension", "sensory"}
HEALTH_DIMENSIONS = ["pacing", "character_depth", "world_building", "dialogue", "coherence"]


def _fix_scene_array(arr, scene_count, default):
    """Pad or truncate a per-scene array to exactly scene_count entries."""
    if not isinstance(arr, list):
        return [default] * scene_count
    if len(arr) < scene_count:
        last = arr[-1] if arr else default
        arr.extend([last] * (scene_count - len(arr)))
    elif len(arr) > scene_count:
        arr = arr[:scene_count]
    return arr


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
                    max_output_tokens=2000,
                ),
            )

            if response.text:
                result = json.loads(response.text)
                self._post_process(result, scene_count)
                logger.info("Director analysis complete")
                return result

        except json.JSONDecodeError as e:
            logger.error("Director returned invalid JSON: %s", e)
        except Exception as e:
            logger.error("Director analysis failed: %s", e)

        return None

    def _post_process(self, result: dict, scene_count: int) -> None:
        """Validate and fix all analysis fields in-place."""
        # --- tension.levels ---
        tension = result.get("tension")
        if tension and isinstance(tension.get("levels"), list):
            tension["levels"] = _fix_scene_array(tension["levels"], scene_count, 5)

        # --- emotional_arc ---
        ea = result.get("emotional_arc")
        if ea:
            ea["values"] = _fix_scene_array(ea.get("values"), scene_count, 0.0)
            ea["values"] = [max(-1.0, min(1.0, float(v))) for v in ea["values"]]
            if ea.get("dominant_emotion") not in VALID_EMOTIONS:
                ea["dominant_emotion"] = "trust"
            if ea.get("arc_shape") not in VALID_ARC_SHAPES:
                ea["arc_shape"] = "man_in_hole"

        # --- directors_notes ---
        dn = result.get("directors_notes")
        if dn:
            notes = dn.get("notes")
            if not isinstance(notes, list):
                notes = []
            notes = _fix_scene_array(
                notes, scene_count,
                {"scene": 1, "note": "", "type": "pacing"},
            )
            for i, note in enumerate(notes):
                if not isinstance(note, dict):
                    notes[i] = {"scene": i + 1, "note": "", "type": "pacing"}
                    continue
                note["scene"] = i + 1  # normalize to 1..N
                if note.get("type") not in VALID_NOTE_TYPES:
                    note["type"] = "pacing"
            dn["notes"] = notes

        # --- story_health ---
        sh = result.get("story_health")
        if sh:
            scores = sh.get("scores")
            if not isinstance(scores, dict):
                scores = {}
            for dim in HEALTH_DIMENSIONS:
                val = scores.get(dim)
                if not isinstance(val, (int, float)):
                    scores[dim] = 5
                else:
                    scores[dim] = max(0, min(10, int(val)))
            sh["scores"] = scores

        # --- themes ---
        th = result.get("themes")
        if th and isinstance(th.get("themes"), list):
            for theme in th["themes"]:
                if isinstance(theme, dict) and "confidence" in theme:
                    theme["confidence"] = max(0.0, min(1.0, float(theme["confidence"])))

        # --- beats ---
        beats = result.get("beats")
        if beats:
            if beats.get("current_beat") not in VALID_BEATS:
                beats["current_beat"] = "setup"
            if beats.get("next_expected") not in VALID_BEATS:
                beats["next_expected"] = "catalyst"
            hits = beats.get("beats_hit")
            if not isinstance(hits, list):
                beats["beats_hit"] = []
            else:
                beats["beats_hit"] = [b for b in hits if b in VALID_BEATS]
