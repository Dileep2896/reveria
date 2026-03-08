import base64
import json
import logging
from typing import Any

from google.genai import types
from services.gemini_client import get_client, get_model
from utils.audio_helpers import pcm_to_wav

from agents.director_prompts import (
    DIRECTOR_SYSTEM_PROMPT,
    VALID_BEATS,
    VALID_EMOTIONS,
    VALID_ARC_SHAPES,
    VALID_NOTE_TYPES,
    HEALTH_DIMENSIONS,
    fix_scene_array as _fix_scene_array,
    DIRECTOR_LIVE_PROMPT,
    DIRECTOR_VOICE,
    DIRECTOR_LIVE_MODEL,
    DIRECTOR_VOICE_SYSTEM,
)

logger = logging.getLogger("storyforge.director")


class Director:
    async def live_commentary(
        self,
        scene_text: str,
        scene_number: int,
        context: str = "",
    ) -> str | None:
        """Stream Director voice commentary via Gemini Live API.

        Opens a real-time Live API session, sends the scene text, and
        collects streamed audio chunks into a WAV data URL.

        Returns a base64 data URL (audio/wav) or None on failure.
        """
        if not scene_text or not scene_text.strip():
            return None

        client = get_client()
        config = {
            "response_modalities": ["AUDIO"],
            "speech_config": {
                "voice_config": {
                    "prebuilt_voice_config": {"voice_name": DIRECTOR_VOICE}
                }
            },
            "system_instruction": DIRECTOR_VOICE_SYSTEM,
        }

        prompt = f"Scene {scene_number}:\n{scene_text}"
        if context:
            prompt = f"Story context:\n{context}\n\n{prompt}"
        prompt += "\n\nGive your Director's reaction."

        try:
            async with client.aio.live.connect(
                model=DIRECTOR_LIVE_MODEL, config=config
            ) as session:
                content = types.Content(
                    role="user",
                    parts=[types.Part(text=prompt)],
                )
                await session.send_client_content(
                    turns=content, turn_complete=True
                )

                audio_chunks: list[bytes] = []
                async for response in session.receive():
                    server = response.server_content
                    if server and server.model_turn:
                        for part in server.model_turn.parts:
                            if part.inline_data and isinstance(
                                part.inline_data.data, bytes
                            ):
                                audio_chunks.append(part.inline_data.data)
                    if server and server.turn_complete:
                        break

            if audio_chunks:
                pcm_data = b"".join(audio_chunks)
                wav_bytes = pcm_to_wav(pcm_data)
                b64 = base64.b64encode(wav_bytes).decode("utf-8")
                logger.info(
                    "Director Live voice generated (%dKB) for scene %d",
                    len(b64) // 1024,
                    scene_number,
                )
                return f"data:audio/wav;base64,{b64}"

        except Exception as e:
            logger.error("Director Live commentary failed for scene %d: %s", scene_number, e)

        return None

    async def analyze_scene(
        self,
        scene_text: str,
        scene_number: int,
        user_prompt: str,
        art_style: str,
        context: str,
    ) -> dict[str, Any] | None:
        """Lightweight per-scene analysis for live commentary."""
        client = get_client()

        user_input = (
            f"USER PROMPT: {user_prompt}\n"
            f"ART STYLE: {art_style}\n"
            f"SCENE NUMBER: {scene_number}\n\n"
            f"STORY SO FAR:\n{context}\n\n"
            f"CURRENT SCENE:\n{scene_text}"
        )

        try:
            response = await client.aio.models.generate_content(
                model="gemini-2.0-flash",
                contents=types.Content(
                    role="user",
                    parts=[types.Part(text=user_input)],
                ),
                config=types.GenerateContentConfig(
                    system_instruction=DIRECTOR_LIVE_PROMPT,
                    response_mime_type="application/json",
                    temperature=0.3,
                    max_output_tokens=300,
                ),
            )

            if response.text:
                result = json.loads(response.text)
                result["scene_number"] = scene_number  # ensure correct
                logger.info("Director live note for scene %d: %s", scene_number, result.get("emoji", ""))
                return result
        except json.JSONDecodeError as e:
            logger.error("Director live returned invalid JSON: %s", e)
        except Exception as e:
            logger.error("Director live analysis failed for scene %d: %s", scene_number, e)

        return None

    async def analyze(
        self,
        full_story_text: str,
        user_prompt: str,
        art_style: str = "cinematic",
        scene_count: int = 1,
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
