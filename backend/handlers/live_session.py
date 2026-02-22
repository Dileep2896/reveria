import asyncio
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger("storyforge")


async def _safe_send(websocket: WebSocket, data: dict[str, Any]) -> bool:
    try:
        await websocket.send_json(data)
        return True
    except Exception:
        return False


async def handle_live_start(
    websocket: WebSocket,
    live_session,
    live_response_task: asyncio.Task | None,
) -> tuple[Any, asyncio.Task | None]:
    """Start a Gemini Live session. Returns (live_session, live_response_task)."""
    from services.gemini_live import LiveSession

    if live_session and live_session.is_active:
        await live_session.close()
        if live_response_task and not live_response_task.done():
            live_response_task.cancel()

    live_session = LiveSession()
    success = await live_session.start()
    if success:
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
    return live_session, live_response_task


async def handle_live_audio_chunk(live_session, message: dict[str, Any]) -> None:
    """Forward audio chunk to active live session."""
    if live_session and live_session.is_active:
        import base64 as b64mod
        audio_b64 = message.get("audio_data", "")
        if audio_b64:
            audio_bytes = b64mod.b64decode(audio_b64)
            await live_session.send_audio(audio_bytes, message.get("mime_type", "audio/pcm"))


async def handle_live_text(live_session, message: dict[str, Any]) -> None:
    """Forward text to active live session."""
    if live_session and live_session.is_active:
        await live_session.send_text(message.get("text", ""))


async def handle_live_stop(
    websocket: WebSocket,
    live_session,
    live_response_task: asyncio.Task | None,
) -> tuple[None, None]:
    """Stop a Gemini Live session. Returns (None, None)."""
    if live_session:
        await live_session.close()
    if live_response_task and not live_response_task.done():
        live_response_task.cancel()
    await _safe_send(websocket, {"type": "live_stopped"})
    return None, None
