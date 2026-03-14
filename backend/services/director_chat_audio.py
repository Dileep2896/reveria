"""Director Chat audio collection helpers."""

import asyncio
import logging
from typing import Callable, Awaitable, Any

from utils.audio_helpers import audio_data_url

logger = logging.getLogger("storyforge.director_chat")


def _handle_session_meta(response, session_holder: Any = None) -> None:
    """Handle non-content messages: session resumption tokens and GoAway.

    ``session_holder`` is any object with a ``_resumption_handle`` attribute
    (typically the DirectorChatSession instance).
    """
    # Session resumption token — save for reconnection
    if hasattr(response, "session_resumption_update") and response.session_resumption_update:
        update = response.session_resumption_update
        if hasattr(update, "new_handle") and update.new_handle and session_holder:
            session_holder._resumption_handle = update.new_handle
            logger.debug("Session resumption handle updated")

    # GoAway — server is about to terminate connection
    if hasattr(response, "go_away") and response.go_away:
        time_left = getattr(response.go_away, "time_left", "unknown")
        logger.warning("Gemini Live GoAway received (time_left=%s) — connection will close soon", time_left)
        if session_holder:
            session_holder._go_away_received = True


async def collect_audio(session, session_holder: Any = None) -> str | None:
    """Collect audio response from a Live session until turn_complete.

    Used only by generate_voice_preview() — does NOT parse transcriptions/tool calls.
    """
    audio_chunks: list[bytes] = []
    async for response in session.receive():
        _handle_session_meta(response, session_holder)
        server = response.server_content
        if server and server.model_turn:
            for part in server.model_turn.parts:
                if part.inline_data and isinstance(part.inline_data.data, bytes):
                    audio_chunks.append(part.inline_data.data)
        if server and server.turn_complete:
            break
    return audio_data_url(audio_chunks)


async def collect_response(session, timeout: float = 30.0, session_holder: Any = None) -> dict:
    """Collect full response: audio + native transcriptions + tool calls.

    Returns dict with keys:
        audio_url: str | None
        input_transcript: str  (user's speech, from native transcription)
        output_transcript: str (model's speech, from native transcription)
        tool_calls: list[dict] (each has 'name' and 'args')
    """
    audio_chunks: list[bytes] = []
    input_transcript_parts: list[str] = []
    output_transcript_parts: list[str] = []
    tool_calls: list[dict] = []

    async def _receive():
        async for response in session.receive():
            _handle_session_meta(response, session_holder)

            # --- Server content (audio, transcriptions, turn_complete) ---
            server = response.server_content
            if server:
                # Handle server-side interruption (model was cut off by user speech)
                if getattr(server, "interrupted", False):
                    logger.debug("Server reported model output interrupted")
                    break

                if server.model_turn:
                    for part in server.model_turn.parts:
                        if part.inline_data and isinstance(part.inline_data.data, bytes):
                            audio_chunks.append(part.inline_data.data)
                if server.input_transcription and server.input_transcription.text:
                    input_transcript_parts.append(server.input_transcription.text)
                if server.output_transcription and server.output_transcription.text:
                    output_transcript_parts.append(server.output_transcription.text)
                if server.turn_complete:
                    break

            # --- Tool call (collect ALL function calls, then break) ---
            if response.tool_call:
                for fc in response.tool_call.function_calls:
                    tc_entry = {
                        "name": fc.name,
                        "args": dict(fc.args) if fc.args else {},
                    }
                    if fc.id:
                        tc_entry["id"] = fc.id
                    else:
                        logger.warning("Tool call missing ID for %s", fc.name)
                    tool_calls.append(tc_entry)
                # Tool call ends the turn
                break

    try:
        await asyncio.wait_for(_receive(), timeout=timeout)
    except asyncio.TimeoutError:
        logger.warning("collect_response timed out after %.0fs", timeout)

    return {
        "audio_url": audio_data_url(audio_chunks) if audio_chunks else None,
        "input_transcript": " ".join(input_transcript_parts).strip(),
        "output_transcript": " ".join(output_transcript_parts).strip(),
        "tool_calls": tool_calls,
    }


async def collect_response_streaming(
    session,
    on_audio_chunk: Callable[[bytes], Awaitable[None]],
    timeout: float = 30.0,
    session_holder: Any = None,
) -> dict:
    """Like collect_response but streams audio chunks via callback as they arrive.

    Calls on_audio_chunk(pcm_bytes) for each audio chunk from Gemini,
    allowing the frontend to start playback immediately.

    Returns dict with keys:
        input_transcript: str
        output_transcript: str
        tool_calls: list[dict]
        chunk_count: int
    """
    input_transcript_parts: list[str] = []
    output_transcript_parts: list[str] = []
    tool_calls: list[dict] = []
    chunk_count = 0

    chunk_fail_count = 0
    MAX_CHUNK_FAILURES = 3

    async def _receive():
        nonlocal chunk_count, chunk_fail_count
        async for response in session.receive():
            _handle_session_meta(response, session_holder)

            server = response.server_content
            if server:
                # Handle server-side interruption
                if getattr(server, "interrupted", False):
                    logger.debug("Server reported model output interrupted (streaming)")
                    break
                if server.model_turn:
                    for part in server.model_turn.parts:
                        if part.inline_data and isinstance(part.inline_data.data, bytes):
                            chunk_count += 1
                            try:
                                await on_audio_chunk(part.inline_data.data)
                            except Exception as e:
                                chunk_fail_count += 1
                                logger.warning("on_audio_chunk failed (%d/%d): %s", chunk_fail_count, MAX_CHUNK_FAILURES, e)
                                if chunk_fail_count >= MAX_CHUNK_FAILURES:
                                    logger.error("Too many chunk send failures, aborting collection")
                                    return
                if server.input_transcription and server.input_transcription.text:
                    input_transcript_parts.append(server.input_transcription.text)
                if server.output_transcription and server.output_transcription.text:
                    output_transcript_parts.append(server.output_transcription.text)
                if server.turn_complete:
                    break

            # --- Tool call (collect ALL function calls, then break) ---
            if response.tool_call:
                for fc in response.tool_call.function_calls:
                    tc_entry = {
                        "name": fc.name,
                        "args": dict(fc.args) if fc.args else {},
                    }
                    if fc.id:
                        tc_entry["id"] = fc.id
                    else:
                        logger.warning("Tool call missing ID for %s", fc.name)
                    tool_calls.append(tc_entry)
                break

    try:
        await asyncio.wait_for(_receive(), timeout=timeout)
    except asyncio.TimeoutError:
        logger.warning("collect_response_streaming timed out after %.0fs", timeout)

    return {
        "input_transcript": " ".join(input_transcript_parts).strip(),
        "output_transcript": " ".join(output_transcript_parts).strip(),
        "tool_calls": tool_calls,
        "chunk_count": chunk_count,
    }
