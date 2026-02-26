"""NarratorADKAgent — streams story text, splits scenes, fires per-scene tasks."""

import asyncio
import logging
import re
from typing import Any

from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from google.genai import types

from agents.narrator import Narrator
from agents.illustrator import Illustrator
from agents.director import Director
from agents.shared_state import SharedPipelineState
from services.multi_voice_tts import synthesize_multi_voice
from services.storage_client import upload_media

logger = logging.getLogger("storyforge.orchestrator")


class NarratorADKAgent(BaseAgent):
    """Streams story text from Narrator, splits on [SCENE] markers.

    Per-scene: fires image, audio, and director live tasks as each scene
    completes (non-blocking). Waits for all pending tasks at the end.
    """

    narrator: Narrator
    illustrator: Illustrator
    director: Director
    shared: SharedPipelineState
    model_config = {"arbitrary_types_allowed": True}

    async def _run_async_impl(self, ctx: InvocationContext) -> Any:
        s = self.shared
        buffer = ""
        scenes: list[dict[str, Any]] = []
        pending_title: str | None = None
        pending_tasks: list[asyncio.Task] = []
        characters_extracted = False

        limit = s.scene_count
        limit_hit = False

        # Inject Director's creative suggestion from previous batch (proactive driver)
        narrator_input = s.user_input
        if s.director_enabled and s.director_suggestion:
            narrator_input = (
                f"[Director's creative direction: {s.director_suggestion}]\n\n"
                f"{s.user_input}"
            )
            logger.info("Director suggestion injected: %s", s.director_suggestion)
            s.director_suggestion = ""  # consumed

        # Inject hero mode context so the narrator writes the user as protagonist
        if s.hero_description:
            hero_name = s.hero_name or "the protagonist"
            narrator_input = (
                f"[HERO MODE: The main character of this story is {hero_name}. "
                f"Physical appearance: {s.hero_description}. "
                f"Write {hero_name} as the central protagonist in every scene. "
                f"Their clothing and style should fit the story's setting and genre.]\n\n"
                f"{narrator_input}"
            )

        async def _on_scene_ready(scene: dict) -> None:
            """Fire per-scene image, audio, and director live tasks."""
            nonlocal characters_extracted
            # Character extraction: run once when first scene arrives
            if not characters_extracted:
                characters_extracted = True
                story_so_far = "\n\n".join(sc["text"] for sc in scenes)
                self.illustrator.accumulate_story(story_so_far)
                await self.illustrator.extract_characters(story_so_far)

            # Image (serialised via semaphore)
            pending_tasks.append(asyncio.create_task(
                self._generate_image(scene)
            ))
            # Audio
            pending_tasks.append(asyncio.create_task(
                self._generate_audio(scene)
            ))
            # Director live commentary (only when Director-triggered generation)
            if s.director_enabled:
                pending_tasks.append(asyncio.create_task(
                    self._director_live(scene, scenes)
                ))

        async for chunk in self.narrator.generate(narrator_input, scene_count=limit, language=s.language):
            if limit_hit:
                break
            buffer += chunk

            while "[SCENE" in buffer:
                idx = buffer.index("[SCENE")
                close = buffer.find("]", idx)
                if close == -1:
                    break

                before = buffer[:idx].strip()
                marker = buffer[idx:close + 1]
                buffer = buffer[close + 1:]

                colon_match = re.match(r"\[SCENE:\s*(.+)\]", marker)
                new_title = colon_match.group(1).strip() if colon_match else None

                if before:
                    title = pending_title if pending_title is not None else new_title
                    s.total_scene_count += 1
                    if s.ws_callback:
                        await s.ws_callback({
                            "type": "text",
                            "content": before,
                            "scene_number": s.total_scene_count,
                            "scene_title": title,
                        })
                    scene_dict = {
                        "scene_number": s.total_scene_count,
                        "text": before,
                        "scene_title": title,
                    }
                    scenes.append(scene_dict)
                    await _on_scene_ready(scene_dict)

                    if len(scenes) >= limit:
                        limit_hit = True
                        break

                    # Check steering queue between scenes
                    if not s.steering_queue.empty():
                        steer_text = s.steering_queue.get_nowait()
                        self.narrator.history.append(
                            types.Content(
                                role="user",
                                parts=[types.Part(text=steer_text)],
                            )
                        )

                pending_title = new_title

        # Remaining text
        if not limit_hit:
            remaining = buffer.strip()
            if remaining:
                s.total_scene_count += 1
                if s.ws_callback:
                    await s.ws_callback({
                        "type": "text",
                        "content": remaining,
                        "scene_number": s.total_scene_count,
                        "scene_title": pending_title,
                    })
                scene_dict = {
                    "scene_number": s.total_scene_count,
                    "text": remaining,
                    "scene_title": pending_title,
                }
                scenes.append(scene_dict)
                await _on_scene_ready(scene_dict)

        # Write back for downstream agents
        s.scenes = scenes
        s.full_story = "\n\n".join(sc["text"] for sc in scenes)

        # Wait for all per-scene tasks to finish
        if pending_tasks:
            await asyncio.gather(*pending_tasks, return_exceptions=True)

        yield Event(author=self.name)

    # ── Per-scene helpers ──────────────────────────────────────────

    async def _generate_image(self, scene: dict) -> None:
        """Generate and upload image for a single scene."""
        s = self.shared
        scene_num = scene["scene_number"]
        try:
            image_data, error_reason, tier, scene_composition = await self.illustrator.generate_for_scene(scene["text"], uid=self.shared.uid)
            scene["image_tier"] = tier
            if scene_composition:
                scene["image_brief"] = scene_composition
            if s.ws_callback:
                if image_data:
                    img_msg = {
                        "type": "image",
                        "scene_number": scene_num,
                        "tier": tier,
                        "image_brief": scene_composition,
                    }
                    try:
                        gcs_url = await upload_media(s.story_id, scene_num, "image", image_data)
                        scene["image_url"] = gcs_url
                        img_msg["content"] = gcs_url
                        await s.ws_callback(img_msg)
                    except Exception as e:
                        logger.error("GCS image upload error for scene %d: %s", scene_num, e)
                        scene["image_url"] = image_data
                        img_msg["content"] = image_data
                        await s.ws_callback(img_msg)
                else:
                    await s.ws_callback({
                        "type": "image_error",
                        "scene_number": scene_num,
                        "reason": error_reason or "generation_failed",
                        "tier": tier,
                    })
        except Exception as e:
            logger.error("Image generation error for scene %d: %s", scene_num, e)
            if s.ws_callback:
                await s.ws_callback({
                    "type": "image_error",
                    "scene_number": scene_num,
                    "reason": "generation_failed",
                })

    async def _generate_audio(self, scene: dict) -> None:
        """Generate and upload audio for a single scene."""
        s = self.shared
        scene_num = scene["scene_number"]
        try:
            audio_data, word_timestamps = await synthesize_multi_voice(
                scene["text"],
                character_sheet=self.illustrator._character_sheet,
                language=s.language,
            )
            if audio_data and s.ws_callback:
                msg: dict[str, Any] = {"type": "audio", "scene_number": scene_num}
                if word_timestamps:
                    scene["word_timestamps"] = word_timestamps
                    msg["word_timestamps"] = word_timestamps
                try:
                    gcs_url = await upload_media(s.story_id, scene_num, "audio", audio_data)
                    scene["audio_url"] = gcs_url
                    msg["content"] = gcs_url
                except Exception as e:
                    logger.error("GCS audio upload error for scene %d: %s", scene_num, e)
                    scene["audio_url"] = audio_data
                    msg["content"] = audio_data
                await s.ws_callback(msg)
        except Exception as e:
            logger.error("TTS error for scene %d: %s", scene_num, e)

    async def _director_live(self, scene: dict, all_scenes: list[dict]) -> None:
        """Run lightweight per-scene Director commentary."""
        s = self.shared
        # Preserve previous suggestion so a failure here doesn't lose it
        prev_suggestion = s.director_suggestion
        try:
            context = "\n\n".join(sc["text"] for sc in all_scenes)
            note = await self.director.analyze_scene(
                scene_text=scene["text"],
                scene_number=scene["scene_number"],
                user_prompt=s.user_input,
                art_style=s.art_style,
                context=context,
            )
            if note:
                # Collect for persistence (lock-guarded)
                async with s._live_notes_lock:
                    s.director_live_notes.append(note)

                # Store latest suggestion so it feeds into the NEXT batch
                suggestion = note.get("suggestion", "")
                if suggestion:
                    s.director_suggestion = suggestion

                # Route voice through Director Chat if active
                if s.director_chat_session:
                    try:
                        chat_result = await s.director_chat_session.proactive_comment(
                            scene["text"], scene["scene_number"]
                        )
                        if chat_result.get("audio_url") and s.ws_callback:
                            await s.ws_callback({
                                "type": "director_chat_response",
                                "audio_url": chat_result["audio_url"],
                            })
                    except Exception as e:
                        logger.warning("Director Chat proactive failed, falling back: %s", e)
                        # Fallback to standalone voice
                        audio_url = await self.director.live_commentary(
                            scene_text=scene["text"],
                            scene_number=scene["scene_number"],
                            context=context,
                        )
                        if audio_url:
                            note["audio_url"] = audio_url
                else:
                    # No active chat — use standalone voice generation
                    audio_url = await self.director.live_commentary(
                        scene_text=scene["text"],
                        scene_number=scene["scene_number"],
                        context=context,
                    )
                    if audio_url:
                        note["audio_url"] = audio_url

                if s.ws_callback:
                    await s.ws_callback({
                        "type": "director_live",
                        **note,
                    })
        except Exception as e:
            # Restore previous suggestion — don't lose it because this call failed
            s.director_suggestion = prev_suggestion
            logger.error("Director live error for scene %d: %s", scene["scene_number"], e)
