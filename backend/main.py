import asyncio
import json
import logging
import time
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
from services.usage import get_usage, check_limit, increment_usage, build_usage_message

from routers import stories, bookmarks, meta, book_details, social, usage, admin

from agents.orchestrator import create_story_orchestrator
from google.adk.sessions import InMemorySessionService  # type: ignore[import-untyped]
from google.adk.runners import Runner  # type: ignore[import-untyped]

from handlers.scene_actions import handle_regen_image, handle_regen_scene, handle_delete_scene
from handlers.live_session import handle_live_start, handle_live_audio_chunk, handle_live_text, handle_live_stop
from handlers.ws_resume import handle_resume, handle_auto_recover, handle_reset

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s:%(name)s: %(message)s",
)
logger = logging.getLogger("storyforge")
logger.info("ADK orchestration enabled")

app = FastAPI(title="StoryForge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        try:
            self.active_connections.remove(websocket)
        except ValueError:
            pass


manager = ConnectionManager()


@app.get("/health")
async def health() -> dict[str, Any]:
    return {"status": "ok", "adk": True}


async def _safe_send(websocket: WebSocket, data: dict[str, Any]) -> bool:
    """Send JSON to websocket, return False if connection is dead."""
    try:
        await websocket.send_json(data)
        return True
    except Exception:
        return False


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

    refusal_detected = False

    async def ws_callback(data: dict[str, Any]) -> None:
        nonlocal refusal_detected
        if refusal_detected:
            return
        if data.get("type") == "text":
            refusal_kind = _is_refusal(data.get("content", ""))
            if refusal_kind:
                refusal_detected = True
                if refusal_kind == "offtopic":
                    msg = "StoryForge is a storytelling app - try describing a story you'd like me to create!"
                else:
                    msg = "Your prompt was blocked by our safety filters. Please try a different story idea."
                logger.warning("ADK narrator produced %s refusal, aborting batch", refusal_kind)
                await _safe_send(websocket, {"type": "error", "content": msg})
                await _safe_send(websocket, {"type": "status", "content": "done"})
                return
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

    uid = await verify_token(token)
    if not uid:
        await websocket.accept()
        await websocket.close(code=4003, reason="Invalid auth token")
        return

    logger.info("Authenticated user: %s", uid)

    await manager.connect(websocket)

    # Send initial usage data
    try:
        initial_usage = await get_usage(uid)
        await _safe_send(websocket, build_usage_message(initial_usage))
    except Exception as e:
        logger.warning("Failed to send initial usage: %s", e)

    narrator = Narrator()
    illustrator = Illustrator()
    director = Director()

    orchestrator, shared_state = create_story_orchestrator(narrator, illustrator, director)
    session_service = InMemorySessionService()

    total_scene_count = 0
    pipeline_tasks: list[asyncio.Task[None]] = []
    active_story_id: str | None = None
    batch_index = 0
    director_result: dict[str, Any] | None = None

    live_session = None
    live_response_task: asyncio.Task | None = None

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

            # ── Gemini Live conversation mode ──
            if msg_type == "live_start":
                live_session, live_response_task = await handle_live_start(websocket, live_session, live_response_task, uid=uid)
                continue

            if msg_type == "live_audio_chunk":
                await handle_live_audio_chunk(live_session, message)
                continue

            if msg_type == "live_text":
                await handle_live_text(live_session, message)
                continue

            if msg_type == "live_stop":
                live_session, live_response_task = await handle_live_stop(websocket, live_session, live_response_task)
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
                    asyncio.create_task(_generate_portraits(
                        websocket, illustrator, active_story_id,
                        safe_send=_safe_send,
                    ))
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
                ret_sid, _, _, _ = await handle_delete_scene(websocket, message, active_story_id, uid, narrator, illustrator)
                active_story_id = ret_sid
                if ret_sid is None:
                    total_scene_count = 0
                    batch_index = 0
                continue

            user_input = message.get("content", "")
            if not user_input:
                continue

            art_style = message.get("art_style", "cinematic")
            scene_count = max(1, min(2, int(message.get("scene_count", 2))))
            language = message.get("language", "English")

            if not active_story_id:
                allowed, reason, _ = await check_limit(uid, "create_story")
                if not allowed:
                    await _safe_send(websocket, {"type": "error", "content": f"Story limit reached - upgrade to Pro for unlimited stories"})
                    await _safe_send(websocket, {"type": "status", "content": "done"})
                    continue
                active_story_id = f"{uid}_{int(time.time())}"
                await _safe_send(websocket, {"type": "story_id", "content": active_story_id})

            if not await _safe_send(websocket, {"type": "status", "content": "generating"}):
                continue

            if not is_quota_available():
                remaining = get_quota_cooldown_remaining()
                await _safe_send(websocket, {"type": "quota_exhausted", "retry_after": remaining})
                await _safe_send(websocket, {"type": "status", "content": "done"})
                continue

            # Pre-filter: reject non-story prompts before expensive pipeline
            if not await _validate_prompt(user_input):
                await _safe_send(websocket, {
                    "type": "error",
                    "content": "StoryForge is a storytelling app - try describing a story you'd like me to create!",
                })
                await _safe_send(websocket, {"type": "status", "content": "done"})
                continue

            # Usage limit: generations per day
            gen_allowed, gen_reason, _ = await check_limit(uid, "generate")
            if not gen_allowed:
                await _safe_send(websocket, {"type": "error", "content": "Daily generation limit reached - upgrade to Pro for unlimited generations"})
                await _safe_send(websocket, {"type": "status", "content": "done"})
                continue

            pipeline_tasks = []
            current_batch_scenes: list[dict[str, Any]] = []

            try:
                total_scene_count, pipeline_tasks, current_batch_scenes, director_result = await _run_adk_pipeline(
                    websocket, orchestrator, shared_state,
                    session_service, user_input, art_style,
                    scene_count, total_scene_count, illustrator,
                    active_story_id, language=language,
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
                        language=language,
                    )
                    # Track usage: increment generation counter (and create_story on first batch)
                    try:
                        if batch_index == 0:
                            await increment_usage(uid, "create_story")
                        updated_usage = await increment_usage(uid, "generate")
                        await _safe_send(websocket, build_usage_message(updated_usage))
                    except Exception as ue:
                        logger.warning("Usage increment failed: %s", ue)

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

            except ContentBlockedError:
                logger.warning("Content blocked by safety filters for user prompt")
                await _safe_send(websocket, {"type": "error", "content": "Your prompt was blocked by our safety filters. Please try a different story idea."})
            except Exception as e:
                logger.error("Pipeline error: %s", e)
                await _safe_send(websocket, {"type": "error", "content": f"Something went wrong: {type(e).__name__}"})

            await _safe_send(websocket, {"type": "status", "content": "done"})

    except WebSocketDisconnect:
        logger.debug("Client disconnected")
    except Exception as e:
        logger.error("WebSocket handler error: %s", e)
    finally:
        for task in pipeline_tasks:
            if not task.done():
                task.cancel()
        if live_session:
            await live_session.close()
        if live_response_task and not live_response_task.done():
            live_response_task.cancel()
        manager.disconnect(websocket)
