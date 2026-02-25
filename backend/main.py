import asyncio
import base64
import json
import logging
import uuid
from typing import Any
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from agents.narrator import Narrator
from agents.illustrator import Illustrator
from agents.director import Director
from google.genai import types
from services.gemini_client import transcribe_audio, ContentBlockedError
from services.imagen_client import is_quota_available, get_quota_cooldown_remaining
from services.firestore_client import persist_story
from services.auth import verify_token
from services.content_filter import is_refusal as _is_refusal, validate_prompt as _validate_prompt
from services.book_meta import auto_generate_meta as _auto_generate_meta
from services.portrait_service import generate_portraits as _generate_portraits
from services.usage import get_usage, check_limit, increment_usage, decrement_usage, build_usage_message
from services.director_chat import DirectorChatSession, generate_voice_preview

from routers import stories, bookmarks, meta, book_details, social, usage, admin

from agents.orchestrator import create_story_orchestrator
from google.adk.sessions import InMemorySessionService  # type: ignore[import-untyped]
from google.adk.runners import Runner  # type: ignore[import-untyped]

from handlers.scene_actions import handle_regen_image, handle_regen_scene, handle_delete_scene
from handlers.utils import safe_send as _safe_send
from handlers.ws_resume import handle_resume, handle_auto_recover, handle_reset

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s:%(name)s: %(message)s",
)
logger = logging.getLogger("storyforge")
logger.info("ADK orchestration enabled")

app = FastAPI(title="StoryForge API")

import os as _os

_CORS_ORIGINS = [
    o.strip()
    for o in _os.getenv("CORS_ORIGINS", "").split(",")
    if o.strip()
] or [
    "http://localhost:5173",
    "http://localhost:4173",
    "https://storyforge-hackathon-1beac.web.app",
    "https://storyforge-hackathon-1beac.firebaseapp.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stories.router)
app.include_router(bookmarks.router)
app.include_router(meta.router)
app.include_router(book_details.router)
app.include_router(social.router)
app.include_router(usage.router)
app.include_router(admin.router)



@app.get("/health")
async def health() -> dict[str, Any]:
    return {"status": "ok", "adk": True}


@app.get("/api/voice-preview/{voice_name}")
async def voice_preview(voice_name: str):
    """Generate a short audio preview for a Director voice."""
    valid_voices = {"Charon", "Kore", "Fenrir", "Aoede", "Puck", "Orus", "Leda", "Zephyr"}
    if voice_name not in valid_voices:
        return {"audio_url": None, "error": "Invalid voice name"}
    audio_url = await generate_voice_preview(voice_name)
    return {"audio_url": audio_url}


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


# ---------------------------------------------------------------------------
# ADK pipeline
# ---------------------------------------------------------------------------

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

    shared_state.user_input = user_input
    shared_state.art_style = art_style
    shared_state.scene_count = scene_count
    shared_state.total_scene_count = total_scene_count
    shared_state.scenes = []
    shared_state.full_story = ""
    shared_state.story_id = story_id
    shared_state.language = kwargs.get("language", "English")
    shared_state.director_chat_session = kwargs.get("director_chat")

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
            # (the narrator prompt instructs it to redirect playfully)
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


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    token = websocket.query_params.get("token")
    if not token:
        await websocket.accept()
        await websocket.close(code=4003, reason="Missing auth token")
        return

    decoded = await verify_token(token, full=True)
    if not decoded:
        await websocket.accept()
        await websocket.close(code=4003, reason="Invalid auth token")
        return

    uid = decoded["uid"]
    author_name = decoded.get("name") or (decoded.get("email", "").split("@")[0] if decoded.get("email") else "Anonymous")
    author_photo_url = decoded.get("picture")
    logger.info("Authenticated user: %s (%s)", uid, author_name)

    await websocket.accept()

    # Send initial usage data
    try:
        initial_usage = await get_usage(uid)
        await _safe_send(websocket, build_usage_message(initial_usage))
    except Exception as e:
        logger.warning("Failed to send initial usage: %s", e)

    narrator = Narrator()
    illustrator = Illustrator()
    director = Director()
    director_chat: DirectorChatSession | None = None

    orchestrator, shared_state = create_story_orchestrator(narrator, illustrator, director)
    session_service = InMemorySessionService()

    total_scene_count = 0
    pipeline_tasks: list[asyncio.Task[None]] = []
    active_story_id: str | None = None
    batch_index = 0
    director_result: dict[str, Any] | None = None
    is_generating = False
    art_style_current = "cinematic"
    scene_count_current = 1
    language_current = "English"

    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                logger.warning("Received malformed JSON, skipping")
                await _safe_send(websocket, {"type": "error", "content": "Malformed message"})
                continue

            msg_type = message.get("type")

            # Handle resume
            if msg_type == "resume":
                sid, sc, bi = await handle_resume(websocket, message, uid, narrator, illustrator)
                if sid:
                    active_story_id = sid
                    total_scene_count = sc
                    batch_index = bi
                continue

            # Handle reset
            if msg_type == "reset":
                if active_story_id:
                    active_story_id = None
                result = handle_reset(narrator, illustrator, director, pipeline_tasks)
                orchestrator, shared_state, illustrator, director = result
                session_service = InMemorySessionService()
                total_scene_count = 0
                batch_index = 0
                director_result = None
                pipeline_tasks = []
                continue

            # Handle voice input - transcribe and send back to populate text field
            if msg_type == "voice_input":
                audio_data = message.get("audio_data", "")
                mime_type = message.get("mime_type", "audio/webm")
                if audio_data and len(audio_data) > 1000:
                    transcription = await transcribe_audio(audio_data, mime_type)
                    if transcription:
                        await _safe_send(websocket, {"type": "transcription", "content": transcription})
                    else:
                        await _safe_send(websocket, {"type": "error", "content": "Could not transcribe audio. Please try again."})
                continue

            # ── Per-scene actions ──
            # Auto-recover session if needed
            if msg_type in ("regen_image", "regen_scene", "delete_scene") and not active_story_id:
                sid, sc, bi = await handle_auto_recover(message, uid, narrator, illustrator)
                if sid:
                    active_story_id = sid
                    total_scene_count = sc
                    batch_index = bi

            if msg_type == "generate_portraits":
                logger.info("generate_portraits request for story %s", active_story_id)
                if active_story_id:
                    portrait_task = asyncio.create_task(_generate_portraits(
                        websocket, illustrator, active_story_id,
                        safe_send=_safe_send,
                    ))
                    pipeline_tasks.append(portrait_task)
                else:
                    await _safe_send(websocket, {"type": "error", "content": "No story available yet. Generate a story first."})
                    await _safe_send(websocket, {"type": "portraits_done"})
                continue

            if msg_type == "regen_image":
                await handle_regen_image(websocket, message, active_story_id, illustrator, uid=uid)
                continue

            if msg_type == "regen_scene":
                await handle_regen_scene(websocket, message, active_story_id, illustrator, narrator, uid=uid)
                continue

            if msg_type == "delete_scene":
                ret_sid, ret_total = await handle_delete_scene(websocket, message, active_story_id, uid, narrator, illustrator)
                active_story_id = ret_sid
                if ret_sid is None:
                    total_scene_count = 0
                    batch_index = 0
                else:
                    total_scene_count = ret_total
                continue

            # Handle mid-generation steering
            if msg_type == "steer":
                steer_text = message.get("content", "").strip()
                if steer_text and shared_state:
                    shared_state.steering_queue.append(steer_text)
                    await _safe_send(websocket, {"type": "steer_ack", "content": steer_text})
                    logger.info("Steering injected: %s", steer_text[:80])
                continue

            # ── Director Chat handlers ──
            if msg_type == "director_chat_start":
                try:
                    # Close any orphaned session before starting a new one
                    if director_chat:
                        try:
                            await director_chat.close()
                        except Exception:
                            pass
                        director_chat = None

                    story_ctx = message.get("story_context", "")
                    if not story_ctx and shared_state and shared_state.scenes:
                        story_ctx = "\n\n".join(
                            s.get("text", "") for s in shared_state.scenes if s.get("text")
                        )
                    if not story_ctx:
                        story_ctx = "No story yet \u2014 starting fresh."
                    chat_language = message.get("language", language_current)
                    chat_voice = message.get("voice_name", "Charon")
                    director_chat = DirectorChatSession()
                    result = await director_chat.start(story_ctx, language=chat_language, voice_name=chat_voice)
                    await _safe_send(websocket, {
                        "type": "director_chat_started",
                        "audio_url": result["audio_url"],
                    })
                except Exception as e:
                    logger.error("Director chat start failed: %s", e)
                    await _safe_send(websocket, {"type": "director_chat_error", "content": "Failed to start Director chat"})
                continue

            if msg_type == "director_chat_audio":
                if not director_chat:
                    logger.debug("Ignoring director_chat_audio — no active session")
                    continue
                try:
                    audio_data = message.get("audio_data", "")
                    mime_type = message.get("mime_type", "audio/webm")
                    audio_bytes = base64.b64decode(audio_data) if audio_data else b""
                    result = await director_chat.send_audio(audio_bytes, mime_type)
                    # Send native transcripts to frontend
                    if result["input_transcript"]:
                        await _safe_send(websocket, {"type": "director_chat_user_transcript", "content": result["input_transcript"]})
                    await _safe_send(websocket, {
                        "type": "director_chat_response",
                        "audio_url": result["audio_url"],
                    })
                    # Handle tool calls (model decided brainstorming is done)
                    if result["tool_calls"] and not is_generating:
                        tc = result["tool_calls"][0]
                        prompt = tc.get("args", {}).get("prompt", "").strip()
                        if prompt and tc["name"] == "generate_story":
                            # Acknowledge the tool call so model can say "Generating!"
                            followup = await director_chat.respond_to_tool_call(tc, success=True)
                            if followup["audio_url"]:
                                await _safe_send(websocket, {
                                    "type": "director_chat_response",
                                    "audio_url": followup["audio_url"],
                                })
                            await _safe_send(websocket, {
                                "type": "director_chat_generate",
                                "prompt": prompt,
                                "art_style": art_style_current,
                                "scene_count": scene_count_current,
                                "language": language_current,
                            })
                except Exception as e:
                    logger.error("Director chat audio failed: %s", e)
                    await _safe_send(websocket, {"type": "director_chat_error", "content": "Director couldn't process audio"})
                continue

            if msg_type == "director_chat_text":
                if not director_chat:
                    logger.debug("Ignoring director_chat_text — no active session")
                    continue
                try:
                    text_content = message.get("content", "").strip()
                    if text_content:
                        result = await director_chat.send_text(text_content)
                        await _safe_send(websocket, {
                            "type": "director_chat_response",
                            "audio_url": result["audio_url"],
                        })
                        # Handle tool calls (model decided brainstorming is done)
                        if result["tool_calls"] and not is_generating:
                            tc = result["tool_calls"][0]
                            prompt = tc.get("args", {}).get("prompt", "").strip()
                            if prompt and tc["name"] == "generate_story":
                                followup = await director_chat.respond_to_tool_call(tc, success=True)
                                if followup["audio_url"]:
                                    await _safe_send(websocket, {
                                        "type": "director_chat_response",
                                        "audio_url": followup["audio_url"],
                                    })
                                await _safe_send(websocket, {
                                    "type": "director_chat_generate",
                                    "prompt": prompt,
                                    "art_style": art_style_current,
                                    "scene_count": scene_count_current,
                                    "language": language_current,
                                })
                except Exception as e:
                    logger.error("Director chat text failed: %s", e)
                    await _safe_send(websocket, {"type": "director_chat_error", "content": "Director couldn't respond"})
                continue

            if msg_type == "director_chat_cancel_generate":
                logger.info("Director auto-generate cancelled by user")
                continue

            if msg_type == "director_chat_suggest":
                if not director_chat:
                    logger.debug("Ignoring director_chat_suggest — no active session")
                    continue
                try:
                    story_ctx = message.get("story_context", "")
                    prompt_text = await director_chat.request_suggestion(story_ctx)
                    await _safe_send(websocket, {
                        "type": "director_chat_suggestion",
                        "content": prompt_text or "Couldn't generate a suggestion. Try chatting more first!",
                    })
                except Exception as e:
                    logger.error("Director chat suggest failed: %s", e)
                    await _safe_send(websocket, {"type": "director_chat_error", "content": "Couldn't generate suggestion"})
                continue

            if msg_type == "director_chat_end":
                if director_chat:
                    await director_chat.close()
                    director_chat = None
                await _safe_send(websocket, {"type": "director_chat_ended"})
                continue

            # Only treat as story generation if type is "generate" or absent
            if msg_type is not None and msg_type != "generate":
                logger.warning("Unknown message type: %s", msg_type)
                continue

            user_input = message.get("content", "")
            if not user_input:
                continue

            art_style = message.get("art_style", "cinematic")
            try:
                scene_count = max(1, min(2, int(message.get("scene_count", 1))))
            except (ValueError, TypeError):
                scene_count = 1
            language = message.get("language", "English")

            # Pre-filter: reject non-story prompts before creating story doc
            if not await _validate_prompt(user_input):
                await _safe_send(websocket, {
                    "type": "error",
                    "content": "StoryForge is a storytelling app - try describing a story you'd like me to create!",
                })
                await _safe_send(websocket, {"type": "status", "content": "done"})
                continue

            if not active_story_id:
                allowed, reason, _ = await check_limit(uid, "create_story")
                if not allowed:
                    await _safe_send(websocket, {"type": "error", "content": f"Story limit reached - upgrade to Pro for unlimited stories"})
                    await _safe_send(websocket, {"type": "status", "content": "done"})
                    continue
                active_story_id = f"{uid}_{uuid.uuid4().hex[:12]}"
                await _safe_send(websocket, {"type": "story_id", "content": active_story_id})

            if is_generating:
                await _safe_send(websocket, {"type": "error", "content": "Generation already in progress"})
                continue

            is_generating = True
            try:
                if not await _safe_send(websocket, {"type": "status", "content": "generating"}):
                    continue

                if not is_quota_available():
                    remaining = get_quota_cooldown_remaining()
                    await _safe_send(websocket, {"type": "quota_exhausted", "retry_after": remaining})
                    await _safe_send(websocket, {"type": "status", "content": "done"})
                    continue

                # Usage limit: generations per day
                gen_allowed, gen_reason, _ = await check_limit(uid, "generate")
                if not gen_allowed:
                    await _safe_send(websocket, {"type": "error", "content": "Daily generation limit reached - upgrade to Pro for unlimited generations"})
                    await _safe_send(websocket, {"type": "status", "content": "done"})
                    continue

                # Pre-increment usage before pipeline to prevent parallel abuse
                usage_incremented = False
                try:
                    if batch_index == 0:
                        await increment_usage(uid, "create_story")
                    updated_usage = await increment_usage(uid, "generate")
                    usage_incremented = True
                    await _safe_send(websocket, build_usage_message(updated_usage))
                except Exception as ue:
                    logger.warning("Usage pre-increment failed: %s", ue)

                pipeline_tasks = []
                current_batch_scenes: list[dict[str, Any]] = []

                try:
                    total_scene_count, pipeline_tasks, current_batch_scenes, director_result = await _run_adk_pipeline(
                        websocket, orchestrator, shared_state,
                        session_service, user_input, art_style,
                        scene_count, total_scene_count, illustrator,
                        active_story_id, language=language,
                        director_chat=director_chat,
                    )

                    current_batch_scenes = [s for s in current_batch_scenes if not s.get("_image_failed")]

                    try:
                        await persist_story(
                            story_id=active_story_id,
                            uid=uid,
                            narrator_history=_serialize_narrator_history(narrator),
                            illustrator_state=illustrator.serialize_state(),
                            total_scene_count=total_scene_count,
                            art_style=art_style,
                            scenes=current_batch_scenes,
                            batch_index=batch_index,
                            user_input=user_input,
                            director_data=director_result,
                            director_live_notes=shared_state.director_live_notes,
                            language=language,
                            author_name=author_name,
                            author_photo_url=author_photo_url,
                        )

                        meta_task = asyncio.create_task(
                            _auto_generate_meta(active_story_id, current_batch_scenes, art_style, websocket, safe_send=_safe_send, language=language, character_sheet=illustrator._character_sheet)
                        )
                        pipeline_tasks.append(meta_task)

                        # Auto-generate portraits for newly introduced characters
                        try:
                            from services.firestore_client import get_db
                            _db = get_db()
                            _doc = await _db.collection("stories").document(active_story_id).get()
                            _existing_portraits = (_doc.to_dict() or {}).get("portraits", []) if _doc.exists else []
                            _existing_names = [p["name"] for p in _existing_portraits if p.get("name")]
                        except Exception:
                            _existing_names = []
                        portrait_task = asyncio.create_task(_generate_portraits(
                            websocket, illustrator, active_story_id,
                            safe_send=_safe_send, existing_names=_existing_names,
                        ))
                        pipeline_tasks.append(portrait_task)
                    except Exception as e:
                        logger.error("Firestore persist error: %s", e)

                    batch_index += 1

                    # Director Chat wrap-up — invite continuation
                    if director_chat and current_batch_scenes:
                        try:
                            wrapup = await director_chat.generation_wrapup(len(current_batch_scenes))
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
                            await decrement_usage(uid, "generate")
                        except Exception:
                            pass
                except Exception as e:
                    logger.error("Pipeline error: %s", e)
                    await _safe_send(websocket, {"type": "error", "content": "Something went wrong. Please try again."})
                    if usage_incremented:
                        try:
                            await decrement_usage(uid, "generate")
                        except Exception:
                            pass

                art_style_current = art_style
                scene_count_current = scene_count
                language_current = language
                await _safe_send(websocket, {"type": "status", "content": "done"})
            finally:
                is_generating = False

    except WebSocketDisconnect:
        logger.debug("Client disconnected")
    except Exception as e:
        logger.error("WebSocket handler error: %s", e)
    finally:
        if director_chat:
            try:
                await director_chat.close()
            except Exception:
                pass
        for task in pipeline_tasks:
            if not task.done():
                task.cancel()
