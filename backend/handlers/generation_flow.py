"""Generation flow handler — pre-filter, usage check, pipeline invocation, persistence."""

import asyncio
import logging
import uuid
from typing import Any

from fastapi import WebSocket
from google.genai import types

from agents.illustrator import Illustrator
from agents.narrator import Narrator
from handlers.utils import safe_send as _safe_send
from services.content_filter import is_refusal as _is_refusal, validate_prompt as _validate_prompt
from services.gemini_client import ContentBlockedError
from services.imagen_client import is_quota_available, get_quota_cooldown_remaining
from services.firestore_client import persist_story
from services.book_meta import auto_generate_meta as _auto_generate_meta
from services.portrait_service import generate_portraits as _generate_portraits
from services.usage import check_limit, increment_usage, decrement_usage, build_usage_message
from services.hero_service import analyze_hero_photo

from google.adk.sessions import InMemorySessionService  # type: ignore[import-untyped]
from google.adk.runners import Runner  # type: ignore[import-untyped]

logger = logging.getLogger("storyforge")


def _serialize_narrator_history(narrator: Narrator) -> list[dict[str, str]]:
    """Serialize Narrator history to dicts for Firestore."""
    result: list[dict[str, str]] = []
    for content in narrator.history:
        text: str = ""
        if content.parts:
            text = content.parts[0].text or ""
        role: str = content.role or "user"
        result.append({"role": role, "text": text})
    return result


async def _run_adk_pipeline(
    websocket: WebSocket,
    orchestrator: Any,
    shared_state: Any,
    session_service: Any,
    user_input: str,
    art_style: str,
    scene_count: int,
    total_scene_count: int,
    illustrator: Illustrator,
    story_id: str,
    **kwargs,
) -> tuple[int, list[asyncio.Task[None]], list[dict[str, Any]], dict[str, Any] | None]:
    """Run the story pipeline via ADK orchestrator."""

    illustrator.art_style = art_style
    illustrator.trend_style = kwargs.get("trend_style")

    shared_state.user_input = user_input
    shared_state.art_style = art_style
    shared_state.scene_count = scene_count
    shared_state.total_scene_count = total_scene_count
    shared_state.scenes = []
    shared_state.full_story = ""
    shared_state.director_live_notes = []
    shared_state.story_id = story_id
    shared_state.uid = kwargs.get("uid", "")
    shared_state.hero_description = kwargs.get("hero_description", "")
    shared_state.hero_name = kwargs.get("hero_name", "")
    shared_state.trend_style = kwargs.get("trend_style")
    shared_state.language = kwargs.get("language", "English")
    director_enabled = kwargs.get("director_enabled", False)
    shared_state.director_enabled = director_enabled
    shared_state.director_chat_session = kwargs.get("director_chat") if director_enabled else None

    refusal_detected = False

    async def ws_callback(data: dict[str, Any]) -> None:
        nonlocal refusal_detected
        if refusal_detected:
            return
        if data.get("type") == "text":
            refusal_kind = _is_refusal(data.get("content", ""))
            if refusal_kind == "offtopic":
                refusal_detected = True
                msg = "StoryForge is a storytelling app - try describing a story you'd like me to create!"
                logger.warning("ADK narrator produced offtopic refusal, aborting batch")
                await _safe_send(websocket, {"type": "error", "content": msg})
                await _safe_send(websocket, {"type": "status", "content": "done"})
                return
            # For "safety" refusals: let the narrator's in-character redirect play out
            if refusal_kind == "safety":
                logger.info("ADK narrator produced safety-adjacent text, letting redirect play out")
        await _safe_send(websocket, data)
    shared_state.ws_callback = ws_callback

    session = await session_service.create_session(
        app_name="storyforge",
        user_id="user",
    )

    runner = Runner(
        agent=orchestrator,
        app_name="storyforge",
        session_service=session_service,
    )

    async for _ in runner.run_async(
        user_id="user",
        session_id=session.id,
        new_message=types.Content(
            role="user",
            parts=[types.Part(text=user_input)],
        ),
    ):
        pass

    if refusal_detected:
        return total_scene_count, [], [], None

    adk_scenes: list[dict[str, Any]] = shared_state.scenes
    scenes_with_urls: list[dict[str, Any]] = []
    for scene_dict in adk_scenes:
        scenes_with_urls.append({
            "scene_number": scene_dict["scene_number"],
            "text": scene_dict["text"],
            "scene_title": scene_dict.get("scene_title"),
            "image_url": scene_dict.get("image_url"),
            "audio_url": scene_dict.get("audio_url"),
            "prompt": user_input,
        })

    return shared_state.total_scene_count, [], scenes_with_urls, shared_state.director_result


async def handle_hero_photo(
    websocket: WebSocket,
    message: dict[str, Any],
    state: Any,  # WsConnectionState
) -> None:
    """Analyze user photo to extract 'Visual DNA' and enable Hero Mode."""
    photo_data = message.get("photo_data", "")
    mime_type = message.get("mime_type", "image/jpeg")
    hero_name = message.get("hero_name", "").strip()

    if not photo_data:
        # Reset hero mode
        state.hero_description = ""
        state.hero_name = ""
        state.trend_style = None
        state.hero_version = getattr(state, 'hero_version', 0) + 1
        state.illustrator.hero_description = ""
        state.illustrator.hero_name = ""
        state.illustrator.trend_style = None
        if state.shared_state:
            state.shared_state.hero_description = ""
            state.shared_state.hero_name = ""
        logger.info("Hero Mode disabled for user %s", state.uid)
        await _safe_send(websocket, {"type": "hero_status", "enabled": False})
        return

    # Validate photo size (max ~10MB base64 ≈ ~7.5MB image)
    if len(photo_data) > 10_000_000:
        await _safe_send(websocket, {"type": "hero_status", "enabled": False})
        await _safe_send(websocket, {"type": "error", "content": "Photo too large (max 5 MB). Please use a smaller image."})
        await _safe_send(websocket, {"type": "status", "content": "done"})
        return

    try:
        # data:image/jpeg;base64,... -> extract only the base64 part
        if "," in photo_data:
            photo_data = photo_data.split(",")[1]

        # Track version so stale photo analysis results are discarded
        state.hero_version = getattr(state, 'hero_version', 0) + 1
        my_version = state.hero_version

        await _safe_send(websocket, {"type": "status", "content": "analyzing_photo"})
        description = await analyze_hero_photo(photo_data, mime_type)

        # If user removed hero mode while we were analyzing, discard result
        if getattr(state, 'hero_version', 0) != my_version:
            logger.info("Hero photo analysis discarded (version mismatch: %d vs %d)", my_version, state.hero_version)
            await _safe_send(websocket, {"type": "hero_status", "enabled": False})
            return

        if description:
            state.hero_description = description
            state.hero_name = hero_name
            state.illustrator.hero_description = description
            state.illustrator.hero_name = hero_name
            if state.shared_state:
                state.shared_state.hero_description = description
                state.shared_state.hero_name = hero_name

            logger.info("Hero Mode enabled for %s (name=%s): %s", state.uid, hero_name, description)
            await _safe_send(websocket, {
                "type": "hero_status",
                "enabled": True,
                "description": description,
                "hero_name": hero_name,
            })
            
            # If Director Chat is active, let him know!
            if state.director_chat:
                try:
                    result = await state.director_chat.send_text(
                        f"[SYSTEM: The user just uploaded their photo. They look like this: {description}. "
                        "Acknowledge this briefly and enthusiastically — they want to be the hero of the story!]"
                    )
                    if result.get("audio_url"):
                        await _safe_send(websocket, {
                            "type": "director_chat_response",
                            "audio_url": result["audio_url"],
                        })
                except Exception:
                    pass
        else:
            await _safe_send(websocket, {"type": "hero_status", "enabled": False})
            await _safe_send(websocket, {"type": "error", "content": "Could not analyze photo. Please try another one."})

    except Exception as e:
        logger.error("handle_hero_photo error: %s", e)
        await _safe_send(websocket, {"type": "hero_status", "enabled": False})
        await _safe_send(websocket, {"type": "error", "content": "Photo analysis failed."})
    finally:
        await _safe_send(websocket, {"type": "status", "content": "done"})


async def handle_generate(
    websocket: WebSocket,
    message: dict[str, Any],
    state: Any,  # WsConnectionState
) -> None:
    """Handle a generate message — full pipeline invocation."""
    user_input = message.get("content", "")
    if not user_input:
        return

    art_style = message.get("art_style", "cinematic")
    try:
        scene_count = max(1, min(2, int(message.get("scene_count", 1))))
    except (ValueError, TypeError):
        scene_count = 1
    language = message.get("language", "English")
    from_director = message.get("from_director", False)

    # Pre-filter: reject non-story prompts before creating story doc
    if not await _validate_prompt(user_input):
        await _safe_send(websocket, {
            "type": "error",
            "content": "StoryForge is a storytelling app - try describing a story you'd like me to create!",
        })
        await _safe_send(websocket, {"type": "status", "content": "done"})
        return

    if not state.active_story_id:
        allowed, reason, _ = await check_limit(state.uid, "create_story")
        if not allowed:
            await _safe_send(websocket, {"type": "error", "content": "Story limit reached - upgrade to Pro for unlimited stories"})
            await _safe_send(websocket, {"type": "status", "content": "done"})
            return
        state.active_story_id = f"{state.uid}_{uuid.uuid4().hex[:12]}"
        await _safe_send(websocket, {"type": "story_id", "content": state.active_story_id})

    if state.is_generating:
        await _safe_send(websocket, {"type": "error", "content": "Generation already in progress"})
        return

    # If hero mode is on, use trend styles for art style mapping
    is_hero_mode = bool(state.hero_description)
    if is_hero_mode:
        # Check if art_style is one of our special trend styles
        if art_style in ("ghibli", "marvel"):
            state.trend_style = art_style
        else:
            state.trend_style = None
    else:
        state.trend_style = None

    state.is_generating = True
    try:
        if not await _safe_send(websocket, {"type": "status", "content": "generating"}):
            return

        if not is_quota_available():
            remaining = get_quota_cooldown_remaining()
            await _safe_send(websocket, {"type": "quota_exhausted", "retry_after": remaining})
            await _safe_send(websocket, {"type": "status", "content": "done"})
            return

        # Usage limit: generations per day
        gen_allowed, gen_reason, _ = await check_limit(state.uid, "generate")
        if not gen_allowed:
            await _safe_send(websocket, {"type": "error", "content": "Daily generation limit reached - upgrade to Pro for unlimited generations"})
            await _safe_send(websocket, {"type": "status", "content": "done"})
            return

        # Pre-increment usage before pipeline to prevent parallel abuse
        usage_incremented = False
        story_incremented = False
        try:
            if state.batch_index == 0:
                await increment_usage(state.uid, "create_story")
                story_incremented = True
            updated_usage = await increment_usage(state.uid, "generate")
            usage_incremented = True
            await _safe_send(websocket, build_usage_message(updated_usage))
        except Exception as ue:
            logger.warning("Usage pre-increment failed: %s", ue)

        state.pipeline_tasks = []
        current_batch_scenes: list[dict[str, Any]] = []

        try:
            state.total_scene_count, state.pipeline_tasks, current_batch_scenes, state.director_result = await _run_adk_pipeline(
                websocket, state.orchestrator, state.shared_state,
                state.session_service, user_input, art_style,
                scene_count, state.total_scene_count, state.illustrator,
                state.active_story_id, language=language,
                uid=state.uid,
                hero_description=state.hero_description,
                hero_name=state.hero_name,
                trend_style=state.trend_style,
                director_chat=state.director_chat,
                director_enabled=from_director,
            )

            current_batch_scenes = [s for s in current_batch_scenes if not s.get("_image_failed")]

            try:
                # Snapshot live notes under lock to avoid concurrent mutation
                async with state.shared_state._live_notes_lock:
                    live_notes_snapshot = list(state.shared_state.director_live_notes)

                await persist_story(
                    story_id=state.active_story_id,
                    uid=state.uid,
                    narrator_history=_serialize_narrator_history(state.narrator),
                    illustrator_state=state.illustrator.serialize_state(),
                    total_scene_count=state.total_scene_count,
                    art_style=art_style,
                    scenes=current_batch_scenes,
                    batch_index=state.batch_index,
                    user_input=user_input,
                    director_data=state.director_result,
                    director_live_notes=live_notes_snapshot,
                    language=language,
                    author_name=state.author_name,
                    author_photo_url=state.author_photo_url,
                )
            except Exception as e:
                logger.error("Firestore persist error: %s", e)

            # Meta + portraits run independently of persist success
            try:
                meta_task = asyncio.create_task(
                    _auto_generate_meta(state.active_story_id, current_batch_scenes, art_style, websocket, safe_send=_safe_send, language=language, character_sheet=state.illustrator._character_sheet)
                )
                state.pipeline_tasks.append(meta_task)
            except Exception as e:
                logger.error("Meta task creation error: %s", e)

            try:
                from services.firestore_client import get_db
                _db = get_db()
                _doc = await _db.collection("stories").document(state.active_story_id).get()
                _existing_portraits = (_doc.to_dict() or {}).get("portraits", []) if _doc.exists else []
                _existing_names = [p["name"] for p in _existing_portraits if p.get("name")]
            except Exception:
                _existing_names = []
            try:
                portrait_task = asyncio.create_task(_generate_portraits(
                    websocket, state.illustrator, state.active_story_id,
                    safe_send=_safe_send, existing_names=_existing_names,
                ))
                state.pipeline_tasks.append(portrait_task)
            except Exception as e:
                logger.error("Portrait task creation error: %s", e)

            state.batch_index += 1

            # Director Chat wrap-up — invite continuation (only for Director-triggered generation)
            if from_director and state.director_chat and current_batch_scenes:
                try:
                    wrapup = await state.director_chat.generation_wrapup(len(current_batch_scenes))
                    if wrapup.get("audio_url"):
                        await _safe_send(websocket, {
                            "type": "director_chat_response",
                            "audio_url": wrapup["audio_url"],
                        })
                except Exception:
                    pass  # non-critical

        except ContentBlockedError:
            logger.warning("Content blocked by safety filters for user prompt")
            await _safe_send(websocket, {"type": "error", "content": "Your prompt was blocked by our safety filters. Please try a different story idea."})
            if usage_incremented:
                try:
                    await decrement_usage(state.uid, "generate")
                except Exception:
                    pass
            if story_incremented:
                try:
                    await decrement_usage(state.uid, "create_story")
                except Exception:
                    pass
        except Exception as e:
            logger.error("Pipeline error: %s", e)
            await _safe_send(websocket, {"type": "error", "content": "Something went wrong. Please try again."})
            if usage_incremented:
                try:
                    await decrement_usage(state.uid, "generate")
                except Exception:
                    pass
            if story_incremented:
                try:
                    await decrement_usage(state.uid, "create_story")
                except Exception:
                    pass

        state.art_style_current = art_style
        state.scene_count_current = scene_count
        state.language_current = language
        await _safe_send(websocket, {"type": "status", "content": "done"})
    except asyncio.CancelledError:
        logger.info("Generation cancelled (disconnect or reset)")
        if usage_incremented:
            try:
                await decrement_usage(state.uid, "generate")
            except Exception:
                pass
        if story_incremented:
            try:
                await decrement_usage(state.uid, "create_story")
            except Exception:
                pass
    finally:
        state.is_generating = False
