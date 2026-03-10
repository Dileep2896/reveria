"""WebSocket handlers for Director Chat messages."""

import base64
import logging
from typing import Any

from fastapi import WebSocket

from handlers.utils import safe_send as _safe_send
from services.director_chat import DirectorChatSession
from services.director_chat_security import screen_input as _screen_input

logger = logging.getLogger("storyforge")


# ---------------------------------------------------------------------------
# Shared tool-call handler (used by both audio and text paths)
# ---------------------------------------------------------------------------

async def _handle_tool_call(
    websocket: WebSocket,
    state: Any,
    tc: dict[str, Any],
) -> None:
    """Process a single tool call from the Director Live session."""
    tool_name = tc.get("name", "")
    args = tc.get("args", {})

    # --- navigate_app: always allowed, no screening needed ---
    if tool_name == "navigate_app":
        destination = args.get("destination", "").strip()
        if destination:
            # Acknowledge so model can say "Taking you there!"
            followup = await state.director_chat.respond_to_tool_call(tc, success=True)
            if followup.get("audio_url"):
                await _safe_send(websocket, {
                    "type": "director_chat_response",
                    "audio_url": followup["audio_url"],
                })
            await _safe_send(websocket, {
                "type": "director_chat_navigate",
                "destination": destination,
            })
            logger.info("Director navigate_app -> %s", destination)
        else:
            rejection = await state.director_chat.respond_to_tool_call(tc, success=False)
            if rejection.get("audio_url"):
                await _safe_send(websocket, {"type": "director_chat_response", "audio_url": rejection["audio_url"]})
        return

    # --- generate_story: existing logic ---
    if tool_name == "generate_story":
        prompt = args.get("prompt", "").strip()

        if state.is_generating:
            logger.info("Rejecting Director generate_story — generation already in progress")
            try:
                rejection = await state.director_chat.respond_to_tool_call(tc, success=False)
                if rejection.get("audio_url"):
                    await _safe_send(websocket, {"type": "director_chat_response", "audio_url": rejection["audio_url"]})
            except Exception:
                pass
            return

        if not prompt:
            return

        safe, category = _screen_input(prompt)
        if not safe:
            logger.warning("Director tool call prompt flagged [%s], rejecting", category)
            rejection = await state.director_chat.respond_to_tool_call(tc, success=False)
            if rejection.get("audio_url"):
                await _safe_send(websocket, {"type": "director_chat_response", "audio_url": rejection["audio_url"]})
            return

        if not state.director_chat.brainstorming_sufficient:
            logger.info("Rejected premature generate_story (msg_count: %d)",
                        state.director_chat._msg_count)
            rejection = await state.director_chat.respond_to_tool_call(tc, success=False)
            if rejection.get("audio_url"):
                await _safe_send(websocket, {"type": "director_chat_response", "audio_url": rejection["audio_url"]})
            return

        followup = await state.director_chat.respond_to_tool_call(tc, success=True)
        if followup.get("audio_url"):
            await _safe_send(websocket, {"type": "director_chat_response", "audio_url": followup["audio_url"]})
        await _safe_send(websocket, {
            "type": "director_chat_generate",
            "prompt": prompt,
            "art_style": state.art_style_current,
            "scene_count": state.scene_count_current,
            "language": state.language_current,
            "template": state.template_current,
        })
        return

    # --- Unknown tool: reject to keep session consistent ---
    logger.warning("Unknown Director tool call: %s", tool_name)
    try:
        await state.director_chat.respond_to_tool_call(tc, success=False)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Streaming audio chunk sender
# ---------------------------------------------------------------------------

def _make_chunk_sender(websocket: WebSocket):
    """Create an async callback that sends PCM audio chunks over WS as base64."""
    async def on_audio_chunk(pcm_bytes: bytes) -> None:
        b64 = base64.b64encode(pcm_bytes).decode("ascii")
        await _safe_send(websocket, {
            "type": "director_chat_audio_chunk",
            "data": b64,
        })
    return on_audio_chunk


# ---------------------------------------------------------------------------
# WS message handlers
# ---------------------------------------------------------------------------

async def handle_director_chat_start(
    websocket: WebSocket,
    message: dict[str, Any],
    state: Any,  # WsConnectionState
) -> None:
    """Handle director_chat_start message."""
    try:
        # Close any orphaned session before starting a new one
        if state.director_chat:
            try:
                await state.director_chat.close()
            except Exception:
                pass
            state.director_chat = None

        story_ctx = message.get("story_context", "")
        if not story_ctx and state.shared_state and state.shared_state.scenes:
            story_ctx = "\n\n".join(
                s.get("text", "") for s in state.shared_state.scenes if s.get("text")
            )
        if not story_ctx:
            story_ctx = "No story yet \u2014 starting fresh."
        chat_language = message.get("language", state.language_current)
        chat_voice = message.get("voice_name", "Charon")
        chat_template = message.get("template", state.template_current)
        state.director_chat = DirectorChatSession()

        # Pass hero info to greeting if available
        hero_info = ""
        if state.hero_description:
            hero_name = state.hero_name or "the user"
            hero_info = (
                f"\n\n[HERO MODE ACTIVE: {hero_name} has uploaded their photo and wants to BE the protagonist. "
                f"Physical appearance: {state.hero_description}. "
                f"When brainstorming, naturally make {hero_name} the main character of the story. "
                f"You can reference their appearance when discussing scenes.]"
            )

        result = await state.director_chat.start(
            story_ctx + hero_info,
            language=chat_language,
            voice_name=chat_voice,
            template=chat_template,
        )
        await _safe_send(websocket, {
            "type": "director_chat_started",
            "audio_url": result["audio_url"],
        })
    except Exception as e:
        logger.error("Director chat start failed: %s", e)
        await _safe_send(websocket, {"type": "director_chat_error", "content": "Failed to start Director chat"})


async def handle_director_chat_audio(
    websocket: WebSocket,
    message: dict[str, Any],
    state: Any,  # WsConnectionState
) -> None:
    """Handle director_chat_audio message — streams audio chunks to frontend."""
    if not state.director_chat:
        logger.debug("Ignoring director_chat_audio \u2014 no active session")
        return
    try:
        audio_data = message.get("audio_data", "")
        mime_type = message.get("mime_type", "audio/webm")
        audio_bytes = base64.b64decode(audio_data) if audio_data else b""

        on_chunk = _make_chunk_sender(websocket)
        result = await state.director_chat.send_audio_streaming(
            audio_bytes, mime_type, on_chunk
        )

        if result.get("session_dead"):
            await _safe_send(websocket, {"type": "director_chat_error", "content": "Director session expired. Please restart.", "fatal": True})
            state.director_chat = None
            return

        # Send input transcript
        if result.get("input_transcript"):
            await _safe_send(websocket, {"type": "director_chat_user_transcript", "content": result["input_transcript"]})

        # Signal audio stream complete
        await _safe_send(websocket, {
            "type": "director_chat_audio_done",
            "output_transcript": result.get("output_transcript", ""),
            "flagged": result.get("flagged", False),
        })

        # Handle tool calls
        for tc in result.get("tool_calls", []):
            await _handle_tool_call(websocket, state, tc)

    except Exception as e:
        logger.error("Director chat audio failed: %s", e)
        await _safe_send(websocket, {"type": "director_chat_error", "content": "Director couldn't process audio"})


async def handle_director_chat_text(
    websocket: WebSocket,
    message: dict[str, Any],
    state: Any,  # WsConnectionState
) -> None:
    """Handle director_chat_text message — streams audio chunks to frontend."""
    if not state.director_chat:
        logger.debug("Ignoring director_chat_text \u2014 no active session")
        return
    try:
        text_content = message.get("content", "").strip()
        if text_content:
            on_chunk = _make_chunk_sender(websocket)
            result = await state.director_chat.send_text_streaming(
                text_content, on_chunk
            )

            if result.get("session_dead"):
                await _safe_send(websocket, {"type": "director_chat_error", "content": "Director session expired. Please restart.", "fatal": True})
                state.director_chat = None
                return

            # Signal audio stream complete
            await _safe_send(websocket, {
                "type": "director_chat_audio_done",
                "output_transcript": result.get("output_transcript", ""),
                "flagged": result.get("flagged", False),
            })

            # Handle tool calls
            for tc in result.get("tool_calls", []):
                await _handle_tool_call(websocket, state, tc)

    except Exception as e:
        logger.error("Director chat text failed: %s", e)
        await _safe_send(websocket, {"type": "director_chat_error", "content": "Director couldn't respond"})


async def handle_director_chat_suggest(
    websocket: WebSocket,
    message: dict[str, Any],
    state: Any,  # WsConnectionState
) -> None:
    """Handle director_chat_suggest message."""
    if not state.director_chat:
        logger.debug("Ignoring director_chat_suggest \u2014 no active session")
        return
    try:
        story_ctx = message.get("story_context", "")
        prompt_text = await state.director_chat.request_suggestion(story_ctx)
        await _safe_send(websocket, {
            "type": "director_chat_suggestion",
            "content": prompt_text or "Couldn't generate a suggestion. Try chatting more first!",
        })
    except Exception as e:
        logger.error("Director chat suggest failed: %s", e)
        await _safe_send(websocket, {"type": "director_chat_error", "content": "Couldn't generate suggestion"})


async def handle_director_chat_end(
    websocket: WebSocket,
    state: Any,  # WsConnectionState
) -> None:
    """Handle director_chat_end message."""
    if state.director_chat:
        await state.director_chat.close()
        state.director_chat = None
    await _safe_send(websocket, {"type": "director_chat_ended"})
