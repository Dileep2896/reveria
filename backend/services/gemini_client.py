import base64
import logging
import os

from google import genai
from google.genai import types

logger = logging.getLogger("storyforge.gemini")

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
    """Stream text from Gemini, yielding chunks as they arrive."""
    client = get_client()
    model = get_model()

    contents: list[types.Content] = []
    if history:
        contents.extend(history)
    contents.append(types.Content(role="user", parts=[types.Part(text=user_prompt)]))

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
        if chunk.text:
            yield chunk.text


async def transcribe_audio(audio_base64: str, mime_type: str) -> str | None:
    """Transcribe audio using Gemini 2.0 Flash multimodal input.

    Returns transcribed text or None on failure.
    """
    client = get_client()
    model = get_model()

    try:
        audio_bytes = base64.b64decode(audio_base64)

        response = await client.aio.models.generate_content(
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
        )

        if response.text:
            return response.text.strip()

    except Exception as e:
        logger.error("Audio transcription failed: %s", e)

    return None
