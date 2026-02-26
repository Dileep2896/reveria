"""Gemini Native Audio TTS — uses Gemini Live API for expressive story narration."""

import asyncio
import base64
import logging

from google.genai import types
from services.gemini_client import get_client
from utils.audio_helpers import pcm_to_wav

logger = logging.getLogger("storyforge.gemini_tts")

NARRATION_MODEL = "gemini-2.5-flash-native-audio"

# Warm, expressive narration voice (same voices available as Director Chat)
LANGUAGE_VOICES = {
    "english": "Kore",
    "spanish": "Kore",
    "french": "Leda",
    "german": "Orus",
    "japanese": "Aoede",
    "hindi": "Kore",
    "portuguese": "Kore",
    "chinese": "Aoede",
}

NARRATION_SYSTEM = (
    "You are a professional audiobook narrator. Read the text the user sends you "
    "with natural expression, appropriate pacing, and emotional depth. "
    "Vary your tone to match the mood — dramatic for tense moments, gentle for quiet scenes, "
    "energetic for action. Read EXACTLY the text provided, do not add or omit anything. "
    "Do not add any commentary, just narrate."
)


_pcm_to_wav = pcm_to_wav  # backward-compat alias


async def synthesize_speech_pcm(
    text: str,
    voice_name: str = "Kore",
    system_prompt: str | None = None,
) -> bytes | None:
    """Generate raw PCM audio bytes (24kHz 16-bit mono) for a text segment.

    This is the low-level building block used by both single-voice and
    multi-voice pipelines. Returns None on failure.
    """
    if not text or not text.strip():
        return None

    client = get_client()
    config = {
        "response_modalities": ["AUDIO"],
        "speech_config": {
            "voice_config": {
                "prebuilt_voice_config": {"voice_name": voice_name}
            }
        },
        "system_instruction": system_prompt or NARRATION_SYSTEM,
    }

    try:
        async with client.aio.live.connect(model=NARRATION_MODEL, config=config) as session:
            content = types.Content(
                role="user",
                parts=[types.Part(text=text)],
            )
            await session.send_client_content(turns=content, turn_complete=True)

            audio_chunks = await asyncio.wait_for(_collect_audio(session), timeout=60.0)

            if not audio_chunks:
                logger.warning("Gemini TTS PCM returned no audio for text: %s...", text[:50])
                return None

            pcm_data = b"".join(audio_chunks)
            logger.info("Gemini TTS PCM generated (%dKB) voice=%s", len(pcm_data) // 1024, voice_name)
            return pcm_data

    except asyncio.TimeoutError:
        logger.error("Gemini TTS PCM timed out for text: %s...", text[:50])
    except Exception as e:
        logger.error("Gemini TTS PCM failed: %s", e)

    return None


async def synthesize_speech(
    text: str,
    voice_name: str | None = None,
    language: str | None = None,
) -> tuple[str | None, None]:
    """Synthesize narration using Gemini native audio.

    Returns (data_url, None) — second element is None since Gemini Live
    doesn't provide word-level timestamps (ReadingMode uses heuristic fallback).
    """
    if not voice_name and language:
        voice_name = LANGUAGE_VOICES.get(language.lower(), "Kore")
    voice_name = voice_name or "Kore"

    pcm = await synthesize_speech_pcm(text, voice_name)
    if not pcm:
        return None, None

    wav_bytes = _pcm_to_wav(pcm)
    b64 = base64.b64encode(wav_bytes).decode("utf-8")
    data_url = f"data:audio/wav;base64,{b64}"
    logger.info("Gemini TTS audio generated (%dKB) voice=%s", len(b64) // 1024, voice_name)
    return data_url, None


async def _collect_audio(session) -> list[bytes]:
    """Collect all audio chunks from a Live session until turn_complete."""
    chunks: list[bytes] = []
    async for response in session.receive():
        server = response.server_content
        if server and server.model_turn:
            for part in server.model_turn.parts:
                if part.inline_data and isinstance(part.inline_data.data, bytes):
                    chunks.append(part.inline_data.data)
        if server and server.turn_complete:
            break
    return chunks
