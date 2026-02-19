import asyncio
import base64
import logging
import os
from google import genai
from google.genai import types

logger = logging.getLogger("storyforge.imagen")

_client: genai.Client | None = None


def get_client() -> genai.Client:
    """Create or return a cached Imagen client using API key or Vertex AI (ADC)."""
    global _client
    if _client is not None:
        return _client

    api_key = os.getenv("GEMINI_API_KEY", "")
    if api_key and api_key != "your-api-key":
        _client = genai.Client(api_key=api_key)
    else:
        project = os.getenv("GOOGLE_CLOUD_PROJECT", "storyforge-hackathon")
        location = os.getenv("VERTEX_AI_LOCATION", "us-central1")
        _client = genai.Client(vertexai=True, project=project, location=location)

    return _client


async def generate_image(prompt: str, timeout: float = 90.0) -> str | None:
    """Generate a scene illustration with Imagen 3.

    Returns a base64-encoded data URL string, or None on failure.
    """
    client = get_client()

    try:
        response = await asyncio.wait_for(
            client.aio.models.generate_images(
                model="imagen-3.0-generate-002",
                prompt=prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=1,
                    aspect_ratio="16:9",
                    safety_filter_level="BLOCK_MEDIUM_AND_ABOVE",
                ),
            ),
            timeout=timeout,
        )

        if response.generated_images:
            img_bytes = response.generated_images[0].image.image_bytes
            b64 = base64.b64encode(img_bytes).decode("utf-8")
            logger.info("Generated image (%dKB)", len(b64) // 1024)
            return f"data:image/png;base64,{b64}"
        else:
            logger.warning("No images returned (possibly blocked by safety filter)")

    except asyncio.TimeoutError:
        logger.warning("Imagen timed out after %ss", timeout)
    except Exception as e:
        logger.error("Imagen generation failed: %s", e)

    return None
