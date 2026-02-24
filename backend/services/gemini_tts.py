"""Gemini Native Audio TTS — uses Gemini Live API for expressive story narration."""

import asyncio
import base64
import io
import logging
import struct

from google.genai import types
from services.gemini_client import get_client

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


def _pcm_to_wav(
    pcm_data: bytes,
    sample_rate: int = 24000,
    bits_per_sample: int = 16,
    channels: int = 1,
) -> bytes:
    """Wrap raw PCM bytes in a WAV header for browser playback."""
    buf = io.BytesIO()
    data_size = len(pcm_data)
    byte_rate = sample_rate * channels * bits_per_sample // 8
    block_align = channels * bits_per_sample // 8
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + data_size))
    buf.write(b"WAVE")
    buf.write(b"fmt ")
    buf.write(struct.pack("<I", 16))
    buf.write(struct.pack("<H", 1))
    buf.write(struct.pack("<H", channels))
    buf.write(struct.pack("<I", sample_rate))
    buf.write(struct.pack("<I", byte_rate))
    buf.write(struct.pack("<H", block_align))
    buf.write(struct.pack("<H", bits_per_sample))
    buf.write(b"data")
    buf.write(struct.pack("<I", data_size))
    buf.write(pcm_data)
    return buf.getvalue()


async def synthesize_speech(
    text: str,
    voice_name: str | None = None,
    language: str | None = None,
) -> tuple[str | None, None]:
    """Synthesize narration using Gemini native audio.

    Returns (data_url, None) — second element is None since Gemini Live
    doesn't provide word-level timestamps (ReadingMode uses heuristic fallback).
    """
    if not text or not text.strip():
        return None, None

    if not voice_name and language:
        voice_name = LANGUAGE_VOICES.get(language.lower(), "Kore")
    voice_name = voice_name or "Kore"

    client = get_client()
    config = {
        "response_modalities": ["AUDIO"],
        "speech_config": {
            "voice_config": {
                "prebuilt_voice_config": {"voice_name": voice_name}
            }
        },
        "system_instruction": NARRATION_SYSTEM,
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
                logger.warning("Gemini TTS returned no audio for text: %s...", text[:50])
                return None, None

            pcm_data = b"".join(audio_chunks)
            wav_bytes = _pcm_to_wav(pcm_data)
            b64 = base64.b64encode(wav_bytes).decode("utf-8")
            data_url = f"data:audio/wav;base64,{b64}"
            logger.info("Gemini TTS audio generated (%dKB) voice=%s", len(b64) // 1024, voice_name)
            return data_url, None

    except asyncio.TimeoutError:
        logger.error("Gemini TTS timed out for text: %s...", text[:50])
    except Exception as e:
        logger.error("Gemini TTS failed: %s", e)

    return None, None


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
