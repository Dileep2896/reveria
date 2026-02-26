"""Director Chat audio collection helpers."""

import asyncio
import logging

from utils.audio_helpers import audio_data_url

logger = logging.getLogger("storyforge.director_chat")


async def collect_audio(session) -> str | None:
    """Collect audio response from a Live session until turn_complete.

    Used only by generate_voice_preview() — does NOT parse transcriptions/tool calls.
    """
    audio_chunks: list[bytes] = []
    async for response in session.receive():
        server = response.server_content
        if server and server.model_turn:
            for part in server.model_turn.parts:
                if part.inline_data and isinstance(part.inline_data.data, bytes):
                    audio_chunks.append(part.inline_data.data)
        if server and server.turn_complete:
            break
    return audio_data_url(audio_chunks)


async def collect_response(session, timeout: float = 30.0) -> dict:
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
            # --- Server content (audio, transcriptions, turn_complete) ---
            server = response.server_content
            if server:
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

            # --- Tool call ---
            if response.tool_call:
                for fc in response.tool_call.function_calls:
                    tool_calls.append({
                        "name": fc.name,
                        "args": dict(fc.args) if fc.args else {},
                        "id": fc.id,
                    })
                # Tool call ends the turn
                break

    try:
        await asyncio.wait_for(_receive(), timeout=timeout)
    except asyncio.TimeoutError:
        logger.warning("collect_response timed out after %.0fs", timeout)

    return {
        "audio_url": audio_data_url(audio_chunks),
        "input_transcript": " ".join(input_transcript_parts).strip(),
        "output_transcript": " ".join(output_transcript_parts).strip(),
        "tool_calls": tool_calls,
    }
