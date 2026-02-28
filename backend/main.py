import asyncio
import json
import logging
from typing import Any
from dotenv import load_dotenv
from fastapi import FastAPI, Header, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from services.gemini_client import transcribe_audio
from services.auth import verify_token
from services.usage import get_usage, build_usage_message
from services.director_chat import generate_voice_preview
from services.portrait_service import generate_portraits as _generate_portraits

from routers import stories, bookmarks, meta, book_details, social, usage, admin

from handlers.utils import safe_send as _safe_send
from handlers.ws_resume import handle_resume, handle_auto_recover, handle_reset
from handlers.scene_actions import handle_regen_image, handle_regen_scene, handle_delete_scene
from handlers.director_chat_handlers import (
    handle_director_chat_start,
    handle_director_chat_audio,
    handle_director_chat_text,
    handle_director_chat_suggest,
    handle_director_chat_end,
)
from handlers.generation_flow import handle_generate, handle_hero_photo

from models.ws_state import WsConnectionState

from google.adk.sessions import InMemorySessionService  # type: ignore[import-untyped]

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s:%(name)s: %(message)s",
)
logger = logging.getLogger("storyforge")
logger.info("ADK orchestration enabled")

app = FastAPI(title="Reveria API")

import os as _os

_CORS_ORIGINS = [
    o.strip()
    for o in _os.getenv("CORS_ORIGINS", "").split(",")
    if o.strip()
] or [
    "http://localhost:3000",
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
async def voice_preview(voice_name: str, authorization: str = Header(...)):
    """Generate a short audio preview for a Director voice."""
    token = authorization.removeprefix("Bearer ").strip()
    uid = await verify_token(token)
    if not uid:
        return {"audio_url": None, "error": "Unauthorized"}
    valid_voices = {"Charon", "Kore", "Fenrir", "Aoede", "Puck", "Orus", "Leda", "Zephyr"}
    if voice_name not in valid_voices:
        return {"audio_url": None, "error": "Invalid voice name"}
    audio_url = await generate_voice_preview(voice_name)
    return {"audio_url": audio_url}


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    # Support both query-param auth (legacy) and first-message auth (preferred)
    token = websocket.query_params.get("token")

    await websocket.accept()

    if not token:
        # Wait for first message to carry the auth token
        try:
            raw = await asyncio.wait_for(websocket.receive_text(), timeout=10)
            auth_msg = json.loads(raw)
            if auth_msg.get("type") != "auth" or not auth_msg.get("token"):
                await websocket.close(code=4003, reason="Missing auth token")
                return
            token = auth_msg["token"]
        except (asyncio.TimeoutError, json.JSONDecodeError, Exception):
            await websocket.close(code=4003, reason="Missing auth token")
            return

    decoded = await verify_token(token, full=True)
    if not decoded:
        await websocket.close(code=4003, reason="Invalid auth token")
        return

    uid = decoded["uid"]
    author_name = decoded.get("name") or (decoded.get("email", "").split("@")[0] if decoded.get("email") else "Anonymous")
    author_photo_url = decoded.get("picture")
    logger.info("Authenticated user: %s (%s)", uid, author_name)

    # Send initial usage data
    try:
        initial_usage = await get_usage(uid)
        await _safe_send(websocket, build_usage_message(initial_usage))
    except Exception as e:
        logger.warning("Failed to send initial usage: %s", e)

    st = WsConnectionState(uid=uid, author_name=author_name, author_photo_url=author_photo_url)
    generation_task: asyncio.Task | None = None

    try:
        while True:
            data = await websocket.receive_text()
            # Guard: reject oversized messages (15MB max — hero photos can be large)
            if len(data) > 15_000_000:
                logger.warning("Oversized WS message (%d bytes) from %s, skipping", len(data), uid)
                await _safe_send(websocket, {"type": "error", "content": "Message too large"})
                continue
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                logger.warning("Received malformed JSON, skipping")
                await _safe_send(websocket, {"type": "error", "content": "Malformed message"})
                continue

            msg_type = message.get("type")

            # Handle resume
            if msg_type == "resume":
                sid, sc, bi = await handle_resume(websocket, message, uid, st.narrator, st.illustrator)
                if sid:
                    st.active_story_id = sid
                    st.total_scene_count = sc
                    st.batch_index = bi
                    # Restore hero mode from illustrator state (set by restore_state)
                    if st.illustrator.hero_description:
                        st.hero_description = st.illustrator.hero_description
                        st.hero_name = st.illustrator.hero_name
                        st.trend_style = st.illustrator.trend_style
                        if st.shared_state:
                            st.shared_state.hero_description = st.hero_description
                            st.shared_state.hero_name = st.hero_name
                        await _safe_send(websocket, {
                            "type": "hero_status",
                            "enabled": True,
                            "description": st.hero_description,
                            "hero_name": st.hero_name,
                            "restored": True,
                        })
                continue

            # Handle reset
            if msg_type == "reset":
                if st.active_story_id:
                    st.active_story_id = None
                result = await handle_reset(st.narrator, st.illustrator, st.director, st.pipeline_tasks, director_chat=st.director_chat)
                st.orchestrator, st.shared_state, st.illustrator, st.director = result
                st.director_chat = None
                st.session_service = InMemorySessionService()
                st.total_scene_count = 0
                st.batch_index = 0
                st.director_result = None
                st.pipeline_tasks = []
                st.is_generating = False
                generation_task = None
                st.hero_description = ""
                st.hero_name = ""
                st.trend_style = None
                continue

            # Handle voice input
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
            if msg_type in ("regen_image", "regen_scene", "delete_scene") and not st.active_story_id:
                sid, sc, bi = await handle_auto_recover(message, uid, st.narrator, st.illustrator)
                if sid:
                    st.active_story_id = sid
                    st.total_scene_count = sc
                    st.batch_index = bi

            if msg_type == "generate_portraits":
                logger.info("generate_portraits request for story %s", st.active_story_id)
                if st.active_story_id:
                    portrait_task = asyncio.create_task(_generate_portraits(
                        websocket, st.illustrator, st.active_story_id,
                        safe_send=_safe_send,
                    ))
                    st.pipeline_tasks.append(portrait_task)
                else:
                    await _safe_send(websocket, {"type": "error", "content": "No story available yet. Generate a story first."})
                    await _safe_send(websocket, {"type": "portraits_done"})
                continue

            if msg_type == "regen_image":
                await handle_regen_image(websocket, message, st.active_story_id, st.illustrator, uid=uid, is_generating=st.is_generating)
                continue

            if msg_type == "regen_scene":
                await handle_regen_scene(websocket, message, st.active_story_id, st.illustrator, st.narrator, uid=uid, is_generating=st.is_generating)
                continue

            if msg_type == "delete_scene":
                ret_sid, ret_total = await handle_delete_scene(websocket, message, st.active_story_id, uid, st.narrator, st.illustrator, is_generating=st.is_generating)
                st.active_story_id = ret_sid
                if ret_sid is None:
                    st.total_scene_count = 0
                    st.batch_index = 0
                elif ret_total >= 0:
                    st.total_scene_count = ret_total
                continue

            # Handle mid-generation steering
            if msg_type == "steer":
                steer_text = message.get("content", "").strip()
                if steer_text and st.shared_state:
                    st.shared_state.steering_queue.put_nowait(steer_text)
                    await _safe_send(websocket, {"type": "steer_ack", "content": steer_text})
                    logger.info("Steering injected: %s", steer_text[:80])
                continue

            # ── Director Chat handlers ──
            if msg_type == "director_chat_start":
                await handle_director_chat_start(websocket, message, st)
                continue

            if msg_type == "director_chat_audio":
                await handle_director_chat_audio(websocket, message, st)
                continue

            if msg_type == "director_chat_text":
                await handle_director_chat_text(websocket, message, st)
                continue

            if msg_type == "director_chat_cancel_generate":
                logger.info("Director auto-generate cancelled by user")
                continue

            if msg_type == "director_chat_suggest":
                await handle_director_chat_suggest(websocket, message, st)
                continue

            if msg_type == "director_chat_end":
                await handle_director_chat_end(websocket, st)
                continue

            if msg_type == "hero_photo":
                asyncio.create_task(handle_hero_photo(websocket, message, st))
                continue

            if msg_type == "hero_name":
                name = message.get("name", "").strip()
                st.hero_name = name
                st.illustrator.hero_name = name
                if st.shared_state:
                    st.shared_state.hero_name = name
                logger.info("Hero name set: %s", name)
                continue

            # Only treat as story generation if type is "generate" or absent
            if msg_type is not None and msg_type != "generate":
                logger.warning("Unknown message type: %s", msg_type)
                continue

            # Non-blocking: run generation as a background task so the WS
            # loop can still process steer / director / regen messages.
            if generation_task and not generation_task.done():
                await _safe_send(websocket, {"type": "error", "content": "Generation already in progress"})
                continue
            generation_task = asyncio.create_task(handle_generate(websocket, message, st))
            st.pipeline_tasks.append(generation_task)

    except WebSocketDisconnect:
        logger.debug("Client disconnected")
    except Exception as e:
        logger.error("WebSocket handler error: %s", e)
    finally:
        if generation_task and not generation_task.done():
            generation_task.cancel()
        if st.director_chat:
            try:
                await st.director_chat.close()
            except Exception:
                pass
        for task in st.pipeline_tasks:
            if not task.done():
                task.cancel()
