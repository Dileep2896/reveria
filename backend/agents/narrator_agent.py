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
from templates.registry import get_template

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

        # Try interleaved generation first (Gemini native text+image),
        # fall back to streaming text + Imagen on failure
        try:
            await self._run_interleaved(narrator_input)
        except Exception as e:
            logger.warning("Interleaved generation failed (%s), falling back to streaming pipeline", e)
            await self._run_streaming(narrator_input)

        yield Event(author=self.name)

    async def _run_interleaved(self, narrator_input: str) -> None:
        """Primary path: Gemini native interleaved text+image generation."""
        s = self.shared
        scenes: list[dict[str, Any]] = []
        pending_tasks: list[asyncio.Task] = []

        limit = s.scene_count

        # Generate text + images in a single Gemini call
        raw_scenes = await self.narrator.generate_with_images(
            narrator_input, scene_count=limit, language=s.language, template=s.template,
        )

        if not raw_scenes:
            raise ValueError("Interleaved generation returned no scenes")

        for i, raw in enumerate(raw_scenes[:limit]):
            text = raw.get("text", "").strip()
            if not text:
                continue

            s.total_scene_count += 1
            scene_num = s.total_scene_count
            title = raw.get("title")
            gemini_image = raw.get("image_data")  # base64 data URL from Gemini

            # Send text to frontend
            if s.ws_callback:
                await s.ws_callback({
                    "type": "text",
                    "content": text,
                    "scene_number": scene_num,
                    "scene_title": title,
                })

            scene_dict: dict[str, Any] = {
                "scene_number": scene_num,
                "text": text,
                "scene_title": title,
            }

            # Store Gemini native image as fallback (Imagen is primary for
            # character consistency via character sheet + visual DNA pipeline).
            # The interleaved text+image generation satisfies the hackathon's
            # "native interleaved output" requirement; Imagen provides quality.
            if gemini_image:
                scene_dict["_gemini_image_fallback"] = gemini_image
                logger.info("Scene %d: Gemini native image available as fallback", scene_num)

            scenes.append(scene_dict)

            # Character extraction on first scene
            if i == 0:
                story_so_far = "\n\n".join(sc["text"] for sc in scenes)
                self.illustrator.accumulate_story(story_so_far)
                await self.illustrator.extract_characters(story_so_far)

            # Fire image (Gemini or Imagen fallback) + audio + director tasks
            is_visual_narrative = get_template(s.template).visual_narrative
            if is_visual_narrative:
                pending_tasks.append(asyncio.create_task(
                    self._generate_image_then_audio(scene_dict)
                ))
            else:
                pending_tasks.append(asyncio.create_task(
                    self._generate_image(scene_dict)
                ))
                pending_tasks.append(asyncio.create_task(
                    self._generate_audio(scene_dict)
                ))
            if s.director_enabled:
                pending_tasks.append(asyncio.create_task(
                    self._director_live(scene_dict, scenes)
                ))

        # Write back for downstream agents
        s.scenes = scenes
        all_scene_texts = [sc["text"] for sc in s.prior_scenes] + [sc["text"] for sc in scenes]
        s.full_story = "\n\n".join(all_scene_texts)

        if pending_tasks:
            await asyncio.gather(*pending_tasks, return_exceptions=True)

    async def _run_streaming(self, narrator_input: str) -> None:
        """Fallback path: streaming text generation + separate Imagen images."""
        s = self.shared
        buffer = ""
        scenes: list[dict[str, Any]] = []
        pending_title: str | None = None
        pending_tasks: list[asyncio.Task] = []
        characters_extracted = False

        limit = s.scene_count
        limit_hit = False

        async def _on_scene_ready(scene: dict) -> None:
            """Fire per-scene image, audio, and director live tasks."""
            nonlocal characters_extracted
            if not characters_extracted:
                characters_extracted = True
                story_so_far = "\n\n".join(sc["text"] for sc in scenes)
                self.illustrator.accumulate_story(story_so_far)
                await self.illustrator.extract_characters(story_so_far)

            is_visual_narrative = get_template(s.template).visual_narrative
            if is_visual_narrative:
                pending_tasks.append(asyncio.create_task(
                    self._generate_image_then_audio(scene)
                ))
            else:
                pending_tasks.append(asyncio.create_task(
                    self._generate_image(scene)
                ))
                pending_tasks.append(asyncio.create_task(
                    self._generate_audio(scene)
                ))
            if s.director_enabled:
                pending_tasks.append(asyncio.create_task(
                    self._director_live(scene, scenes)
                ))

        async for chunk in self.narrator.generate(narrator_input, scene_count=limit, language=s.language, template=s.template):
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

                    if not s.steering_queue.empty():
                        steer_text = s.steering_queue.get_nowait()
                        self.narrator.history.append(
                            types.Content(
                                role="user",
                                parts=[types.Part(text=steer_text)],
                            )
                        )

                pending_title = new_title

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

        s.scenes = scenes
        all_scene_texts = [sc["text"] for sc in s.prior_scenes] + [sc["text"] for sc in scenes]
        s.full_story = "\n\n".join(all_scene_texts)

        if pending_tasks:
            await asyncio.gather(*pending_tasks, return_exceptions=True)

    # ── Per-scene helpers ──────────────────────────────────────────

    async def _generate_image(self, scene: dict) -> None:
        """Generate and upload image for a single scene, then extract portraits."""
        s = self.shared
        scene_num = scene["scene_number"]
        try:
            # Always use Imagen pipeline for character consistency (character sheet + visual DNA).
            # Gemini native image (from interleaved generation) serves as fallback only.
            gemini_fallback = scene.pop("_gemini_image_fallback", None)
            image_data, error_reason, tier, scene_composition = await self.illustrator.generate_for_scene(scene["text"], uid=self.shared.uid)
            scene["image_tier"] = tier
            if scene_composition:
                scene["image_brief"] = scene_composition

            # If Imagen failed entirely but we have a Gemini native image, use it
            if not image_data and gemini_fallback:
                image_data = gemini_fallback
                tier = 0  # tier 0 = Gemini native interleaved fallback
                scene["image_tier"] = tier
                error_reason = None
                logger.info("Scene %d: Imagen failed, using Gemini native image fallback (tier 0)", scene_num)

            # Text overlay placement for visual narrative templates
            text_overlays = None
            if image_data and get_template(s.template).visual_narrative:
                text_overlays = await self.illustrator.analyze_text_placement(
                    image_data, scene["text"], template=s.template
                )
                if text_overlays:
                    scene["text_overlays"] = text_overlays

            if s.ws_callback:
                if image_data:
                    img_msg = {
                        "type": "image",
                        "scene_number": scene_num,
                        "tier": tier,
                        "image_brief": scene_composition,
                    }
                    if text_overlays:
                        img_msg["text_overlays"] = text_overlays
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

                    # Portraits disabled — face-crop quality insufficient (future work)
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

    async def _extract_portraits_from_scene(self, scene: dict, image_data: str) -> None:
        """Detect and crop character faces from a scene image as portraits.

        For each new character face found:
        1. Crop from scene image (guaranteed visual consistency)
        2. Analyze visual DNA with Gemini Vision
        3. Upload to GCS and send portrait WS message
        """
        s = self.shared
        try:
            # Identify characters in this scene
            scene_characters = await self.illustrator._identify_scene_characters(scene["text"])
            if not scene_characters:
                return

            # Filter to characters that don't have portraits yet
            new_chars = [
                name for name in scene_characters
                if name.lower() not in self.illustrator._portrait_extracted
                and not (s.hero_name and name.lower() == s.hero_name.lower())
            ]
            if not new_chars:
                return

            # Detect faces and crop
            cropped_faces = await self.illustrator.detect_and_crop_portraits(image_data, new_chars)
            if not cropped_faces:
                return

            existing_anchor_count = len(self.illustrator._anchor_portraits)

            for idx, face in enumerate(cropped_faces):
                name = face["name"]
                face_data = face["image_data"]

                # Mark as extracted immediately to prevent duplicates
                self.illustrator._portrait_extracted.add(name.lower())

                # Analyze visual DNA from the cropped face
                visual_desc = await self.illustrator.analyze_visual_dna(face_data, name)
                if visual_desc:
                    self.illustrator._visual_dna[name.lower()] = visual_desc

                # Upload to GCS
                gcs_index = 900 + existing_anchor_count + idx
                try:
                    gcs_url = await upload_media(s.story_id, gcs_index, "portrait", face_data)
                except Exception as e:
                    logger.error("GCS upload failed for cropped portrait %s: %s", name, e)
                    continue

                # Send portrait WS message
                if s.ws_callback:
                    await s.ws_callback({
                        "type": "portrait",
                        "name": name,
                        "image_url": gcs_url,
                    })

                # Track for Firestore persistence
                self.illustrator._anchor_portraits.append({
                    "name": name,
                    "image_url": gcs_url,
                })

            if cropped_faces:
                logger.info(
                    "Extracted %d face-crop portraits from scene %d",
                    len(cropped_faces), scene["scene_number"],
                )

        except Exception as e:
            logger.error("Portrait extraction error for scene %d: %s", scene["scene_number"], e)

    async def _generate_image_then_audio(self, scene: dict) -> None:
        """For visual narratives: generate image first (to get text overlays),
        then generate audio that reads ONLY the overlay text."""
        await self._generate_image(scene)

        # Build TTS script from the text overlays (what the user actually sees)
        overlays = scene.get("text_overlays")
        if overlays:
            # Sort by vertical position for natural reading order
            sorted_overlays = sorted(overlays, key=lambda o: (o.get("y", 0), o.get("x", 0)))
            tts_parts = []
            for ov in sorted_overlays:
                text = ov.get("text", "").strip()
                if text:
                    tts_parts.append(text)
            if tts_parts:
                scene["_tts_script"] = " ".join(tts_parts)
                logger.info("Visual narrative TTS script (%d words): %s",
                            len(scene["_tts_script"].split()), scene["_tts_script"][:120])

        await self._generate_audio(scene)

    async def _generate_audio(self, scene: dict) -> None:
        """Generate and upload audio for a single scene."""
        s = self.shared
        scene_num = scene["scene_number"]
        # For visual narratives, use the overlay text (what's shown) instead of full prose
        tts_text = scene.get("_tts_script") or scene["text"]
        try:
            audio_data, word_timestamps = await synthesize_multi_voice(
                tts_text,
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
            # Include prior scenes for full story context
            prior_texts = [sc["text"] for sc in s.prior_scenes]
            current_texts = [sc["text"] for sc in all_scenes]
            context = "\n\n".join(prior_texts + current_texts)
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

                # Skip per-scene voice when Director Chat is active —
                # generation_wrapup() handles the combined reaction + continuation prompt
                # to avoid audio messages stepping on each other.
                if not s.director_chat_session:
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
