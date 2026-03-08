import asyncio
import base64
import logging
import os

from google import genai
from google.genai import types

from utils.retry import is_transient, with_retries

logger = logging.getLogger("storyforge.gemini")


class ContentBlockedError(Exception):
    """Raised when Gemini blocks content due to safety filters."""
    pass

_client: genai.Client | None = None


def get_client() -> genai.Client:
    """Create or return a cached Gemini client using API key or Vertex AI (ADC)."""
    global _client
    if _client is not None:
        return _client

    api_key = os.getenv("GEMINI_API_KEY", "")

    if api_key and api_key != "your-api-key":
        _client = genai.Client(api_key=api_key)
    else:
        # Fall back to Vertex AI with application default credentials
        project = os.getenv("GOOGLE_CLOUD_PROJECT", "storyforge-hackathon")
        location = os.getenv("VERTEX_AI_LOCATION", "us-central1")
        _client = genai.Client(
            vertexai=True,
            project=project,
            location=location,
        )

    return _client


def get_model() -> str:
    return os.getenv("GEMINI_MODEL", "gemini-2.0-flash")


async def generate_stream(
    system_prompt: str,
    user_prompt: str,
    history: list[types.Content] | None = None,
):
    """Stream text from Gemini, yielding chunks as they arrive.

    Raises ContentBlockedError if the response is blocked by safety filters.
    """
    client = get_client()
    model = get_model()

    contents: list[types.Content] = []
    if history:
        contents.extend(history)
    contents.append(types.Content(role="user", parts=[types.Part(text=user_prompt)]))

    yielded_any = False
    last_transient: Exception | None = None

    for _attempt in range(3):
        try:
            stream = await client.aio.models.generate_content_stream(
                model=model,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.9,
                    max_output_tokens=2048,
                ),
            )
            async for chunk in stream:
                if chunk.candidates:
                    candidate = chunk.candidates[0]
                    fr = getattr(candidate, "finish_reason", None)
                    if fr and str(fr).upper() in ("SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST"):
                        raise ContentBlockedError("Content blocked by safety filters.")
                if chunk.text:
                    yielded_any = True
                    yield chunk.text
            break  # success — exit retry loop
        except ContentBlockedError:
            raise
        except Exception as e:
            err_msg = str(e).lower()
            if "safety" in err_msg or "blocked" in err_msg or "prohibited" in err_msg:
                raise ContentBlockedError("Content blocked by safety filters.") from e
            if is_transient(e) and _attempt < 2 and not yielded_any:
                last_transient = e
                delay = 1.0 * (2 ** _attempt)
                logger.warning("generate_stream transient error (attempt %d/3), retrying in %.1fs: %s", _attempt + 1, delay, e)
                await asyncio.sleep(delay)
                continue
            raise

    if not yielded_any:
        if last_transient:
            raise last_transient
        logger.warning("generate_stream produced no text - possible silent safety block")
        raise ContentBlockedError("Content blocked by safety filters.")


async def transcribe_audio(audio_base64: str, mime_type: str) -> str | None:
    """Transcribe audio using Gemini 2.0 Flash multimodal input.

    Returns transcribed text or None on failure.
    """
    client = get_client()
    model = get_model()
    audio_bytes = base64.b64decode(audio_base64)

    try:
        response = await with_retries(
            lambda: client.aio.models.generate_content(
                model=model,
                contents=types.Content(
                    role="user",
                    parts=[
                        types.Part(inline_data=types.Blob(mime_type=mime_type, data=audio_bytes)),
                        types.Part(text="Transcribe this audio exactly. Output only the transcription, nothing else."),
                    ],
                ),
                config=types.GenerateContentConfig(
                    temperature=0.0,
                    max_output_tokens=500,
                ),
            ),
            attempts=3,
            base_delay=1.0,
            label="transcribe_audio",
        )

        if response.text:
            return response.text.strip()

    except Exception as e:
        logger.error("Audio transcription failed: %s", e)

    return None
