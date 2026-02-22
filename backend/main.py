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
from services.tts_client import synthesize_speech
from services.gemini_client import transcribe_audio, ContentBlockedError
from services.imagen_client import generate_image, is_quota_available, get_quota_cooldown_remaining
from services.storage_client import upload_media
from services.firestore_client import persist_story, load_story, delete_story, get_db
from services.auth import verify_token
from services.content_filter import is_refusal as _is_refusal
from services.scene_rewrite import rewrite_scene_text as _rewrite_scene_text
from services.book_meta import auto_generate_meta as _auto_generate_meta
from services.portrait_service import generate_portraits as _generate_portraits
from services.storage_client import delete_story_media

from routers import stories, bookmarks, meta

from agents.orchestrator import create_story_orchestrator
from google.adk.sessions import InMemorySessionService  # type: ignore[import-untyped]
from google.adk.runners import Runner  # type: ignore[import-untyped]

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

    # Configure shared state (mutable object held by all agent instances)
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
            return  # Suppress all further messages after refusal
        if data.get("type") == "text":
            refusal_kind = _is_refusal(data.get("content", ""))
            if refusal_kind:
                refusal_detected = True
                if refusal_kind == "offtopic":
                    msg = "StoryForge is a storytelling app — try describing a story you'd like me to create!"
                else:
                    msg = "Your prompt was blocked by our safety filters. Please try a different story idea."
                logger.warning("ADK narrator produced %s refusal, aborting batch", refusal_kind)
                await _safe_send(websocket, {"type": "error", "content": msg})
                # Send done immediately so the loading spinner stops
                await _safe_send(websocket, {"type": "status", "content": "done"})
                return
        await _safe_send(websocket, data)
    shared_state.ws_callback = ws_callback

    # Create a fresh session for this run
    session = await session_service.create_session(
        app_name="storyforge",
        user_id="user",
    )

    runner = Runner(
        agent=orchestrator,
        app_name="storyforge",
        session_service=session_service,
    )

    # Run the orchestrator — ADK requires a non-None new_message to start
    async for _ in runner.run_async(
        user_id="user",
        session_id=session.id,
        new_message=types.Content(
            role="user",
            parts=[types.Part(text=user_input)],
        ),
    ):
        pass  # Events are handled via ws_callback inside each agent

    # If refusal was detected, return empty — no scenes to persist
    if refusal_detected:
        return total_scene_count, [], [], None

    # Build scenes list with URLs for persistence
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
    # Extract token from query params before accepting
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
    narrator = Narrator()
    illustrator = Illustrator()
    director = Director()

    # ADK orchestrator (created once, reused across requests)
    orchestrator, shared_state = create_story_orchestrator(narrator, illustrator, director)
    session_service = InMemorySessionService()

    # Track cumulative scene count across continuation requests
    total_scene_count = 0
    pipeline_tasks: list[asyncio.Task[None]] = []
    active_story_id: str | None = None
    batch_index = 0
    director_result: dict[str, Any] | None = None

    # Gemini Live session state
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

            # Handle resume — restore state from Firestore
            if message.get("type") == "resume":
                req_story_id = message.get("story_id")
                if req_story_id:
                    story_data: dict[str, Any] | None = await load_story(req_story_id, uid)
                    if story_data:
                        # Restore Narrator history
                        history_entries: list[dict[str, str]] = story_data.get("narrator_history", [])
                        narrator.history = [
                            types.Content(
                                role=e["role"],
                                parts=[types.Part(text=e["text"])],
                            )
                            for e in history_entries
                        ]
                        # Restore Illustrator state
                        ill_state: dict[str, str] = story_data.get("illustrator_state", {})
                        illustrator.restore_state(ill_state)
                        # Restore counters
                        total_scene_count = int(story_data.get("total_scene_count", 0))
                        active_story_id = req_story_id
                        generations_list: list[Any] = story_data.get("generations", [])
                        batch_index = len(generations_list)
                        # Send persisted portraits to frontend
                        persisted_portraits = story_data.get("portraits", [])
                        if persisted_portraits:
                            for p in persisted_portraits:
                                await _safe_send(websocket, {
                                    "type": "portrait",
                                    "name": p.get("name", ""),
                                    "image_url": p.get("image_url"),
                                })
                            await _safe_send(websocket, {"type": "portraits_done"})
                        logger.info("Resumed story %s (scene count: %d)", req_story_id, total_scene_count)
                continue

            # Handle reset
            if message.get("type") == "reset":
                if active_story_id:
                    active_story_id = None
                narrator.reset()
                illustrator = Illustrator()
                director = Director()
                total_scene_count = 0
                batch_index = 0
                director_result = None
                for task in pipeline_tasks:
                    if not task.done():
                        task.cancel()
                pipeline_tasks = []
                # Recreate ADK orchestrator with fresh agents
                orchestrator, shared_state = create_story_orchestrator(narrator, illustrator, director)
                session_service = InMemorySessionService()
                continue

            # ── Gemini Live conversation mode ──
            if message.get("type") == "live_start":
                from services.gemini_live import LiveSession
                if live_session and live_session.is_active:
                    await live_session.close()
                    if live_response_task and not live_response_task.done():
                        live_response_task.cancel()
                live_session = LiveSession()
                success = await live_session.start()
                if success:
                    # Start background task to relay responses
                    async def _live_response_loop():
                        try:
                            async for msg in live_session.receive_responses():
                                if not await _safe_send(websocket, msg):
                                    break
                        except asyncio.CancelledError:
                            pass
                        except Exception as e:
                            logger.error("Live response loop error: %s", e)
                    live_response_task = asyncio.create_task(_live_response_loop())
                    await _safe_send(websocket, {"type": "live_started"})
                else:
                    await _safe_send(websocket, {"type": "error", "content": "Failed to start live session"})
                continue

            if message.get("type") == "live_audio_chunk":
                if live_session and live_session.is_active:
                    import base64 as b64mod
                    audio_b64 = message.get("audio_data", "")
                    if audio_b64:
                        audio_bytes = b64mod.b64decode(audio_b64)
                        await live_session.send_audio(audio_bytes, message.get("mime_type", "audio/pcm"))
                continue

            if message.get("type") == "live_text":
                if live_session and live_session.is_active:
                    await live_session.send_text(message.get("text", ""))
                continue

            if message.get("type") == "live_stop":
                if live_session:
                    await live_session.close()
                    live_session = None
                if live_response_task and not live_response_task.done():
                    live_response_task.cancel()
                    live_response_task = None
                await _safe_send(websocket, {"type": "live_stopped"})
                continue

            # Handle voice input — transcribe then feed into pipeline
            if message.get("type") == "voice_input":
                audio_data = message.get("audio_data", "")
                mime_type = message.get("mime_type", "audio/webm")
                if audio_data and len(audio_data) > 1000:  # Skip tiny clips (< ~750 bytes raw)
                    transcription = await transcribe_audio(audio_data, mime_type)
                    if transcription:
                        await _safe_send(websocket, {
                            "type": "transcription",
                            "content": transcription,
                        })
                        message = {"content": transcription, "art_style": "cinematic"}
                    else:
                        await _safe_send(websocket, {
                            "type": "error",
                            "content": "Could not transcribe audio. Please try again.",
                        })
                        continue
                else:
                    continue

            # ── Per-scene actions (regen image / regen scene / delete) ──
            msg_type = message.get("type")

            # Auto-recover session if story_id is in the message but we have no active story
            if msg_type in ("regen_image", "regen_scene", "delete_scene") and not active_story_id:
                req_sid = message.get("story_id")
                if req_sid:
                    story_data = await load_story(req_sid, uid)
                    if story_data:
                        history_entries = story_data.get("narrator_history", [])
                        narrator.history = [
                            types.Content(role=e["role"], parts=[types.Part(text=e["text"])])
                            for e in history_entries
                        ]
                        ill_state = story_data.get("illustrator_state", {})
                        illustrator.restore_state(ill_state)
                        total_scene_count = int(story_data.get("total_scene_count", 0))
                        active_story_id = req_sid
                        generations_list = story_data.get("generations", [])
                        batch_index = len(generations_list)
                        logger.info("Auto-resumed story %s for scene action", req_sid)

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
                scene_num = int(message.get("scene_number", 0))
                scene_text = message.get("scene_text", "")
                logger.info("regen_image request: scene=%d, text_len=%d, story=%s", scene_num, len(scene_text), active_story_id)
                if scene_num and scene_text and active_story_id:
                    try:
                        await _safe_send(websocket, {"type": "regen_start", "scene_number": scene_num})
                        image_data, error_reason, tier = await illustrator.generate_for_scene(scene_text)
                        if image_data:
                            gcs_url = await upload_media(active_story_id, scene_num, "image", image_data)
                            # Cache-bust: append timestamp so browser fetches new image
                            cache_bust_url = f"{gcs_url}?v={int(time.time())}"
                            # Update Firestore scene doc
                            db = get_db()
                            scene_docs = db.collection("stories").document(active_story_id).collection("scenes")
                            async for doc_snap in scene_docs.where("scene_number", "==", scene_num).stream():
                                await doc_snap.reference.update({"image_url": cache_bust_url})
                            await _safe_send(websocket, {"type": "image", "content": cache_bust_url, "scene_number": scene_num, "tier": tier})
                        else:
                            await _safe_send(websocket, {"type": "image_error", "scene_number": scene_num, "reason": error_reason or "generation_failed"})
                        await _safe_send(websocket, {"type": "regen_done", "scene_number": scene_num})
                    except Exception as e:
                        logger.error("regen_image error for scene %d: %s", scene_num, e)
                        await _safe_send(websocket, {"type": "regen_error", "scene_number": scene_num, "error": str(e)})
                else:
                    logger.warning("regen_image skipped — guard failed: scene_num=%s, text=%s, story=%s", scene_num, bool(scene_text), active_story_id)
                    await _safe_send(websocket, {"type": "regen_error", "scene_number": scene_num, "error": "Session not ready — please retry"})
                continue

            if msg_type == "regen_scene":
                scene_num = int(message.get("scene_number", 0))
                scene_text = message.get("scene_text", "")
                all_scenes_data: list[dict[str, Any]] = message.get("all_scenes", [])
                logger.info("regen_scene request: scene=%d, story=%s", scene_num, active_story_id)
                if scene_num and scene_text and active_story_id:
                    try:
                        await _safe_send(websocket, {"type": "regen_start", "scene_number": scene_num})
                        new_text = await _rewrite_scene_text(scene_text, scene_num, all_scenes_data)
                        if not new_text:
                            await _safe_send(websocket, {"type": "regen_error", "scene_number": scene_num, "error": "Rewrite failed"})
                            continue

                        # Send new text immediately
                        await _safe_send(websocket, {"type": "text", "content": new_text, "scene_number": scene_num, "is_regen": True})

                        # Generate image + audio in parallel
                        img_task = asyncio.create_task(illustrator.generate_for_scene(new_text))
                        audio_task = asyncio.create_task(synthesize_speech(new_text))
                        image_result, audio_data = await asyncio.gather(img_task, audio_task, return_exceptions=True)

                        db = get_db()
                        scene_update: dict[str, Any] = {"text": new_text}

                        # Handle image
                        if not isinstance(image_result, Exception):
                            img_data, img_err, img_tier = image_result
                            if img_data:
                                gcs_url = await upload_media(active_story_id, scene_num, "image", img_data)
                                cache_bust_url = f"{gcs_url}?v={int(time.time())}"
                                scene_update["image_url"] = cache_bust_url
                                await _safe_send(websocket, {"type": "image", "content": cache_bust_url, "scene_number": scene_num, "tier": img_tier})
                            else:
                                await _safe_send(websocket, {"type": "image_error", "scene_number": scene_num, "reason": img_err or "generation_failed"})

                        # Handle audio — synthesize_speech returns (data_url, word_timestamps)
                        if not isinstance(audio_data, Exception) and audio_data:
                            audio_data_url, word_ts = audio_data
                            if audio_data_url:
                                audio_url = await upload_media(active_story_id, scene_num, "audio", audio_data_url)
                                scene_update["audio_url"] = audio_url
                                if word_ts:
                                    scene_update["word_timestamps"] = word_ts
                                await _safe_send(websocket, {"type": "audio", "content": audio_url, "scene_number": scene_num})

                        # Update Firestore scene doc
                        scene_docs = db.collection("stories").document(active_story_id).collection("scenes")
                        async for doc in scene_docs.where("scene_number", "==", scene_num).stream():
                            await doc.reference.update(scene_update)

                        # Append synthetic narrator history for coherence
                        narrator.history.append(types.Content(
                            role="user",
                            parts=[types.Part(text=f"[Scene {scene_num} was rewritten]")],
                        ))
                        narrator.history.append(types.Content(
                            role="model",
                            parts=[types.Part(text=new_text)],
                        ))

                        await _safe_send(websocket, {"type": "regen_done", "scene_number": scene_num})
                    except Exception as e:
                        logger.error("regen_scene error for scene %d: %s", scene_num, e)
                        await _safe_send(websocket, {"type": "regen_error", "scene_number": scene_num, "error": str(e)})
                continue

            if msg_type == "delete_scene":
                scene_num = int(message.get("scene_number", 0))
                logger.info("delete_scene request: scene=%d, story=%s", scene_num, active_story_id)
                if scene_num and active_story_id:
                    try:
                        db = get_db()
                        scene_docs = db.collection("stories").document(active_story_id).collection("scenes")
                        async for doc in scene_docs.where("scene_number", "==", scene_num).stream():
                            await doc.reference.delete()

                        await _safe_send(websocket, {"type": "scene_deleted", "scene_number": scene_num})

                        # Check if any scenes remain
                        remaining = []
                        async for _ in scene_docs.limit(1).stream():
                            remaining.append(True)

                        if not remaining:
                            # All scenes deleted — remove the entire story
                            logger.info("All scenes deleted, removing story %s", active_story_id)
                            deleted_sid = active_story_id
                            await delete_story(active_story_id, uid)
                            asyncio.create_task(delete_story_media(active_story_id))
                            await _safe_send(websocket, {"type": "story_deleted", "story_id": deleted_sid})
                            # Reset WS session state
                            active_story_id = None
                            narrator.history.clear()
                            illustrator.restore_state({})
                            total_scene_count = 0
                            generations_list = []
                            batch_index = 0
                        else:
                            # Inform narrator about the deletion for story coherence
                            narrator.history.append(types.Content(
                                role="user",
                                parts=[types.Part(text=f"[Scene {scene_num} was removed from the story by the reader]")],
                            ))
                            narrator.history.append(types.Content(
                                role="model",
                                parts=[types.Part(text=f"Understood. Scene {scene_num} has been removed. I will not reference it in future scenes and will continue the story from the remaining scenes.")],
                            ))
                    except Exception as e:
                        logger.error("delete_scene error for scene %d: %s", scene_num, e)
                        await _safe_send(websocket, {"type": "regen_error", "scene_number": scene_num, "error": str(e)})
                continue

            user_input = message.get("content", "")

            if not user_input:
                continue

            # Parse user options
            art_style = message.get("art_style", "cinematic")
            scene_count = max(1, min(2, int(message.get("scene_count", 2))))
            language = message.get("language", "English")

            # Generate story_id on first pipeline run
            if not active_story_id:
                active_story_id = f"{uid}_{int(time.time())}"
                await _safe_send(websocket, {"type": "story_id", "content": active_story_id})

            # Signal that generation is starting
            if not await _safe_send(websocket, {
                "type": "status",
                "content": "generating",
            }):
                continue

            # Check image quota before starting — no point generating text-only stories
            if not is_quota_available():
                remaining = get_quota_cooldown_remaining()
                await _safe_send(websocket, {
                    "type": "quota_exhausted",
                    "retry_after": remaining,
                })
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

                # Filter out scenes where image generation completely failed
                current_batch_scenes = [s for s in current_batch_scenes if not s.get("_image_failed")]

                # Persist to Firestore after pipeline completes
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
                    # Auto-generate title + cover in background (title_generated race guard inside handles dedup)
                    meta_task = asyncio.create_task(
                        _auto_generate_meta(active_story_id, current_batch_scenes, art_style, websocket, safe_send=_safe_send)
                    )
                    pipeline_tasks.append(meta_task)
                except Exception as e:
                    logger.error("Firestore persist error: %s", e)

                batch_index += 1

            except ContentBlockedError:
                logger.warning("Content blocked by safety filters for user prompt")
                await _safe_send(websocket, {
                    "type": "error",
                    "content": "Your prompt was blocked by our safety filters. Please try a different story idea.",
                })
            except Exception as e:
                logger.error("Pipeline error: %s", e)
                await _safe_send(websocket, {
                    "type": "error",
                    "content": f"Something went wrong: {type(e).__name__}",
                })

            # Signal generation complete (always, even after errors)
            await _safe_send(websocket, {
                "type": "status",
                "content": "done",
            })

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
