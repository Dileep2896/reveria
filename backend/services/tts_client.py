import base64
import logging
import os

from google.cloud import texttospeech_v1 as tts

logger = logging.getLogger("storyforge.tts")

_client: tts.TextToSpeechAsyncClient | None = None


def _get_client() -> tts.TextToSpeechAsyncClient:
    global _client
    if _client is None:
        _client = tts.TextToSpeechAsyncClient()
    return _client


async def synthesize_speech(text: str, voice_name: str | None = None) -> str | None:
    """Synthesize speech from text using Google Cloud TTS.

    Returns a base64 data URL ("data:audio/mp3;base64,...") or None on failure.
    """
    if not text or not text.strip():
        return None

    voice_name = voice_name or os.getenv("TTS_VOICE_NAME", "en-US-Studio-O")

    try:
        client = _get_client()

        response = await client.synthesize_speech(
            request=tts.SynthesizeSpeechRequest(
                input=tts.SynthesisInput(text=text),
                voice=tts.VoiceSelectionParams(
                    language_code=voice_name[:5],  # e.g. "en-US"
                    name=voice_name,
                ),
                audio_config=tts.AudioConfig(
                    audio_encoding=tts.AudioEncoding.MP3,
                    speaking_rate=0.95,
                ),
            )
        )

        if response.audio_content:
            b64 = base64.b64encode(response.audio_content).decode("utf-8")
            logger.info("TTS audio generated (%dKB)", len(b64) // 1024)
            return f"data:audio/mp3;base64,{b64}"

    except Exception as e:
        logger.error("TTS synthesis failed: %s", e)

    return None
