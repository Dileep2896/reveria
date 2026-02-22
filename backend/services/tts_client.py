import base64
import logging
import os
import re

from google.cloud import texttospeech_v1beta1 as tts

logger = logging.getLogger("storyforge.tts")

# Wavenet voices — support SSML <mark> tags for word-level timepoints.
# (Studio voices sound slightly better but do NOT support <mark> tags.)
LANGUAGE_VOICES = {
    "english": "en-US-Wavenet-D",
    "spanish": "es-US-Wavenet-B",
    "french": "fr-FR-Wavenet-D",
    "german": "de-DE-Wavenet-C",
    "japanese": "ja-JP-Wavenet-B",
    "hindi": "hi-IN-Wavenet-D",
    "portuguese": "pt-BR-Wavenet-B",
    "chinese": "cmn-CN-Wavenet-C",
}

_client: tts.TextToSpeechAsyncClient | None = None


def _get_client() -> tts.TextToSpeechAsyncClient:
    global _client
    if _client is None:
        _client = tts.TextToSpeechAsyncClient()
    return _client


def _text_to_marked_ssml(text: str) -> tuple[str, list[str]]:
    """Wrap plain text in SSML with <mark> before each word.

    Returns (ssml_string, word_list).
    """
    words = text.split()
    parts: list[str] = []
    for i, word in enumerate(words):
        # Escape XML special characters in the word
        safe = (word
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace('"', "&quot;"))
        parts.append(f'<mark name="w{i}"/>{safe}')
    ssml = f"<speak>{' '.join(parts)}</speak>"
    return ssml, words


async def synthesize_speech(
    text: str,
    voice_name: str | None = None,
    language: str | None = None,
) -> tuple[str | None, list[dict] | None]:
    """Synthesize speech from text using Google Cloud TTS v1beta1.

    Returns (data_url, word_timestamps) where:
      - data_url is "data:audio/mp3;base64,..." or None on failure
      - word_timestamps is [{"word": "Hello", "time": 0.0}, ...] or None
    """
    if not text or not text.strip():
        return None, None

    if language and not voice_name:
        voice_name = LANGUAGE_VOICES.get(language.lower(), None)
    voice_name = voice_name or os.getenv("TTS_VOICE_NAME", "en-US-Wavenet-D")

    try:
        client = _get_client()

        ssml, words = _text_to_marked_ssml(text)

        response = await client.synthesize_speech(
            request=tts.SynthesizeSpeechRequest(
                input=tts.SynthesisInput(ssml=ssml),
                voice=tts.VoiceSelectionParams(
                    language_code=voice_name[:5],
                    name=voice_name,
                ),
                audio_config=tts.AudioConfig(
                    audio_encoding=tts.AudioEncoding.MP3,
                    speaking_rate=0.95,
                ),
                enable_time_pointing=[
                    tts.SynthesizeSpeechRequest.TimepointType.SSML_MARK,
                ],
            )
        )

        if not response.audio_content:
            return None, None

        b64 = base64.b64encode(response.audio_content).decode("utf-8")
        data_url = f"data:audio/mp3;base64,{b64}"
        logger.info("TTS audio generated (%dKB)", len(b64) // 1024)

        # Extract word-level timestamps from response
        word_timestamps = None
        if response.timepoints:
            word_timestamps = []
            for tp in response.timepoints:
                # mark names are "w0", "w1", etc.
                idx = int(tp.mark_name[1:])
                if idx < len(words):
                    word_timestamps.append({
                        "word": words[idx],
                        "time": round(tp.time_seconds, 3),
                    })
            logger.info("TTS timepoints: %d/%d words", len(word_timestamps), len(words))

        return data_url, word_timestamps

    except Exception as e:
        logger.error("TTS synthesis failed: %s", e)

    return None, None
