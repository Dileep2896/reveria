"""WebSocket handlers for Director Chat messages."""

import asyncio
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
) -> bool:
    """Process a single tool call from the Director Live session.

    Returns True if a FunctionResponse was already sent (caller must NOT re-respond).
    """
    tool_name = tc.get("name", "")
    args = tc.get("args", {})

    # --- generate_story ---
    if tool_name == "generate_story":
        prompt = args.get("prompt", "").strip()
        on_chunk = _make_chunk_sender(websocket)

        if state.is_generating:
            logger.info("Rejecting Director generate_story — generation already in progress")
            try:
                rejection = await state.director_chat.respond_to_tool_call(
                    tc, success=False, on_audio_chunk=on_chunk,
                )
                await _safe_send(websocket, {
                    "type": "director_chat_audio_done",
                    "output_transcript": rejection.get("output_transcript", ""),
                })
            except Exception:
                pass
            return True

        if not prompt:
            # Still need to reject so session doesn't hang
            try:
                await state.director_chat.respond_to_tool_call(tc, success=False)
            except Exception:
                pass
            return True

        safe, category = _screen_input(prompt)
        if not safe:
            logger.warning("Director tool call prompt flagged [%s], rejecting", category)
            rejection = await state.director_chat.respond_to_tool_call(
                tc, success=False, on_audio_chunk=on_chunk,
            )
            await _safe_send(websocket, {
                "type": "director_chat_audio_done",
                "output_transcript": rejection.get("output_transcript", ""),
            })
            return True

        if not state.director_chat.brainstorming_sufficient:
            logger.info("Rejected premature generate_story (msg_count: %d)",
                        state.director_chat._msg_count)
            rejection = await state.director_chat.respond_to_tool_call(
                tc, success=False, on_audio_chunk=on_chunk,
            )
            await _safe_send(websocket, {
                "type": "director_chat_audio_done",
                "output_transcript": rejection.get("output_transcript", ""),
            })
            return True

        followup = await state.director_chat.respond_to_tool_call(
            tc, success=True, on_audio_chunk=on_chunk,
        )
        await _safe_send(websocket, {
            "type": "director_chat_audio_done",
            "output_transcript": followup.get("output_transcript", ""),
        })
        await _safe_send(websocket, {
            "type": "director_chat_generate",
            "prompt": prompt,
            "art_style": state.art_style_current,
            "scene_count": state.scene_count_current,
            "language": state.language_current,
            "template": state.template_current,
        })
        return True

    # --- Unknown tool: reject to keep session consistent ---
    logger.warning("Unknown Director tool call: %s", tool_name)
    try:
        on_chunk = _make_chunk_sender(websocket)
        followup = await state.director_chat.respond_to_tool_call(
            tc, success=False, on_audio_chunk=on_chunk,
        )
        await _safe_send(websocket, {
            "type": "director_chat_audio_done",
            "output_transcript": followup.get("output_transcript", ""),
        })
    except Exception:
        pass
    return True


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

        # Pass hero info to greeting if available (sanitize to prevent prompt breakage)
        hero_info = ""
        if state.hero_description:
            hero_name = (state.hero_name or "the user")[:100].replace("\n", " ").strip()
            hero_desc = state.hero_description[:500].replace("\n", " ").strip()
            hero_info = (
                f"\n\n[HERO MODE ACTIVE: {hero_name} has uploaded their photo and wants to BE the protagonist. "
                f"Physical appearance: {hero_desc}. "
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
            "transcript": result.get("output_transcript", ""),
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
        logger.info("Director audio: processing %d bytes", len(audio_bytes))
        result = await state.director_chat.send_audio_streaming(
            audio_bytes, mime_type, on_chunk,
        )

        # ── Detailed conversation logging ──
        in_t = result.get("input_transcript", "")
        out_t = result.get("output_transcript", "")
        noise = result.get("noise_rejected", False)
        logger.info("─── DIRECTOR CONVERSATION ───")
        logger.info("  USER HEARD : %s", repr(in_t[:200]) if in_t else "(empty — no speech detected)")
        logger.info("  DIR REPLIED: %s", repr(out_t[:200]) if out_t else "(no audio response)")
        logger.info("  chunks=%s, tools=%d, noise_rejected=%s, dead=%s",
            result.get("chunk_count", "?"),
            len(result.get("tool_calls", [])),
            noise,
            result.get("session_dead", False),
        )
        logger.info("─────────────────────────────")

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
            "noise_rejected": result.get("noise_rejected", False),
        })

        # Handle tool calls — reject on failure so session doesn't hang
        for tc in result.get("tool_calls", []):
            responded = False
            try:
                responded = await _handle_tool_call(websocket, state, tc)
            except Exception as tc_err:
                logger.error("Tool call handler failed: %s", tc_err)
            # Only send fallback rejection if handler didn't already respond
            if not responded and state.director_chat:
                try:
                    await state.director_chat.respond_to_tool_call(tc, success=False)
                except Exception:
                    pass

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
            is_nudge = text_content.startswith("[SYSTEM:")
            logger.info("Director text: %s (%d chars)", "nudge" if is_nudge else "user", len(text_content))
            on_chunk = _make_chunk_sender(websocket)
            result = await state.director_chat.send_text_streaming(
                text_content, on_chunk
            )

            out_t = result.get("output_transcript", "")
            logger.info("─── DIRECTOR CONVERSATION (text) ───")
            logger.info("  TEXT SENT  : %s", repr(text_content[:150]))
            logger.info("  DIR REPLIED: %s", repr(out_t[:200]) if out_t else "(no audio response)")
            logger.info("  chunks=%s, tools=%d, dead=%s",
                result.get("chunk_count", "?"),
                len(result.get("tool_calls", [])),
                result.get("session_dead", False),
            )
            logger.info("─────────────────────────────────────")

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
                try:
                    await _handle_tool_call(websocket, state, tc)
                except Exception as tc_err:
                    logger.error("Tool call handler failed: %s", tc_err)
                    if state.director_chat:
                        try:
                            await state.director_chat.respond_to_tool_call(tc, success=False)
                        except Exception:
                            pass

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
    # Cancel any active audio stream
    _cancel_audio_stream(state)
    if state.director_chat:
        await state.director_chat.close()
        state.director_chat = None
    await _safe_send(websocket, {"type": "director_chat_ended"})


# ---------------------------------------------------------------------------
# Streaming audio handlers (realtime input → server-side VAD)
# ---------------------------------------------------------------------------

def _cancel_audio_stream(state: Any) -> None:
    """Cancel any in-progress audio stream task and drain the queue."""
    if state.audio_stream_task and not state.audio_stream_task.done():
        state.audio_stream_task.cancel()
    state.audio_stream_task = None
    if state.audio_chunk_queue:
        # Drain remaining items
        while not state.audio_chunk_queue.empty():
            try:
                state.audio_chunk_queue.get_nowait()
            except asyncio.QueueEmpty:
                break
    state.audio_chunk_queue = None


async def _run_audio_stream(
    websocket: WebSocket,
    state: Any,
    chunk_queue: "asyncio.Queue[bytes | None]",
) -> None:
    """Background task: process a realtime audio stream and send results back."""
    try:
        on_chunk = _make_chunk_sender(websocket)
        result = await state.director_chat.handle_realtime_stream(
            chunk_queue, on_chunk,
        )

        if result.get("session_dead"):
            await _safe_send(websocket, {
                "type": "director_chat_error",
                "content": "Director session expired. Please restart.",
                "fatal": True,
            })
            state.director_chat = None
            return

        # ── Detailed conversation logging ──
        in_t = result.get("input_transcript", "")
        out_t = result.get("output_transcript", "")
        noise = result.get("noise_rejected", False)
        logger.info("─── DIRECTOR CONVERSATION (stream) ───")
        logger.info("  USER HEARD : %s", repr(in_t[:200]) if in_t else "(empty)")
        logger.info("  DIR REPLIED: %s", repr(out_t[:200]) if out_t else "(no response)")
        logger.info("  chunks=%s, tools=%d, noise=%s",
            result.get("chunk_count", "?"),
            len(result.get("tool_calls", [])),
            noise,
        )
        logger.info("──────────────────────────────────────")

        # Send input transcript
        if result.get("input_transcript"):
            await _safe_send(websocket, {
                "type": "director_chat_user_transcript",
                "content": result["input_transcript"],
            })

        # Signal audio stream complete
        await _safe_send(websocket, {
            "type": "director_chat_audio_done",
            "output_transcript": result.get("output_transcript", ""),
            "flagged": result.get("flagged", False),
            "noise_rejected": result.get("noise_rejected", False),
        })

        # Handle tool calls
        for tc in result.get("tool_calls", []):
            responded = False
            try:
                responded = await _handle_tool_call(websocket, state, tc)
            except Exception as tc_err:
                logger.error("Tool call handler failed: %s", tc_err)
            if not responded and state.director_chat:
                try:
                    await state.director_chat.respond_to_tool_call(tc, success=False)
                except Exception:
                    pass

    except asyncio.CancelledError:
        logger.debug("Audio stream task cancelled")
    except Exception as e:
        logger.error("Audio stream task failed: %s", e)
        await _safe_send(websocket, {
            "type": "director_chat_error",
            "content": "Director couldn't process audio stream",
        })


async def handle_director_chat_audio_stream_start(
    websocket: WebSocket,
    message: dict[str, Any],
    state: Any,
) -> None:
    """Handle director_chat_audio_stream_start — begin streaming audio."""
    if not state.director_chat:
        logger.debug("Ignoring audio stream start — no active session")
        return

    # Cancel any existing stream
    _cancel_audio_stream(state)

    # Create fresh queue and start background task
    state.audio_chunk_queue = asyncio.Queue(maxsize=500)
    state.audio_stream_task = asyncio.create_task(
        _run_audio_stream(websocket, state, state.audio_chunk_queue)
    )
    logger.info("Audio stream started (realtime input)")


async def handle_director_chat_audio_chunk(
    websocket: WebSocket,
    message: dict[str, Any],
    state: Any,
) -> None:
    """Handle director_chat_audio_chunk — forward PCM chunk to Gemini."""
    if not state.audio_chunk_queue:
        return  # No active stream
    try:
        b64_data = message.get("data", "")
        if b64_data:
            pcm_bytes = base64.b64decode(b64_data)
            state.audio_chunk_queue.put_nowait(pcm_bytes)
    except asyncio.QueueFull:
        logger.warning("Audio chunk queue full — dropping chunk")
    except Exception as e:
        logger.warning("Failed to decode audio chunk: %s", e)


async def handle_director_chat_audio_stream_end(
    websocket: WebSocket,
    message: dict[str, Any],
    state: Any,
) -> None:
    """Handle director_chat_audio_stream_end — signal end of audio stream."""
    if not state.audio_chunk_queue:
        return
    try:
        state.audio_chunk_queue.put_nowait(None)  # sentinel
    except asyncio.QueueFull:
        logger.warning("Audio chunk queue full — forcing sentinel")
        # Drain one item and retry
        try:
            state.audio_chunk_queue.get_nowait()
            state.audio_chunk_queue.put_nowait(None)
        except Exception:
            pass
    logger.info("Audio stream end signaled")
