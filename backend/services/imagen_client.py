import asyncio
import base64
import logging
import os
import time
from google import genai
from google.genai import types

logger = logging.getLogger("storyforge.imagen")

_client: genai.Client | None = None

_MAX_RETRIES = 3
_RETRY_BASE_DELAY = 10  # seconds — Imagen 429 cooldowns are typically 10-60s
_QUOTA_COOLDOWN = 60    # 1 minute — skip calls after confirmed quota exhaustion

# Circuit breaker: timestamp of last confirmed quota exhaustion
_quota_exhausted_at: float = 0.0


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


def is_quota_available() -> bool:
    """Check if Imagen quota is likely available (circuit breaker not tripped)."""
    if _quota_exhausted_at == 0.0:
        return True
    elapsed = time.monotonic() - _quota_exhausted_at
    return elapsed >= _QUOTA_COOLDOWN


def get_quota_cooldown_remaining() -> int:
    """Return seconds remaining on quota cooldown, or 0 if available."""
    if _quota_exhausted_at == 0.0:
        return 0
    remaining = _QUOTA_COOLDOWN - (time.monotonic() - _quota_exhausted_at)
    return max(0, int(remaining))


async def generate_image(prompt: str, timeout: float = 90.0, aspect_ratio: str = "16:9") -> tuple[str | None, str | None]:
    """Generate a scene illustration with Imagen 3.

    Returns (data_url, error_reason). data_url is a base64-encoded data URL
    string on success, or None on failure with error_reason describing why.
    Retries with exponential backoff on rate-limit (429) errors.
    Callers should serialize image calls to avoid bursting past rate limits.
    """
    global _quota_exhausted_at

    # Circuit breaker: skip immediately if quota was recently exhausted
    if not is_quota_available():
        remaining = int(_QUOTA_COOLDOWN - (time.monotonic() - _quota_exhausted_at))
        logger.warning("Imagen quota cooldown active (%ds remaining), skipping", remaining)
        return None, "quota_exhausted"

    client = get_client()

    for attempt in range(_MAX_RETRIES):
        try:
            response = await asyncio.wait_for(
                client.aio.models.generate_images(
                    model="imagen-3.0-generate-002",
                    prompt=prompt,
                    config=types.GenerateImagesConfig(
                        number_of_images=1,
                        aspect_ratio=aspect_ratio,
                        safety_filter_level="BLOCK_MEDIUM_AND_ABOVE",
                    ),
                ),
                timeout=timeout,
            )

            if response.generated_images:
                img_bytes = response.generated_images[0].image.image_bytes
                b64 = base64.b64encode(img_bytes).decode("utf-8")
                logger.info("Generated image (%dKB)", len(b64) // 1024)
                # Success resets the circuit breaker
                _quota_exhausted_at = 0.0
                return f"data:image/png;base64,{b64}", None
            else:
                logger.warning("No images returned (possibly blocked by safety filter)")
                return None, "safety_filter"

        except asyncio.TimeoutError:
            logger.warning("Imagen timed out after %ss", timeout)
            return None, "timeout"
        except Exception as e:
            err_str = str(e).lower()
            if "resource_exhausted" in err_str or "429" in err_str:
                if attempt < _MAX_RETRIES - 1:
                    delay = _RETRY_BASE_DELAY * (2 ** attempt)
                    logger.warning(
                        "Imagen rate limited (attempt %d/%d), retrying in %ds...",
                        attempt + 1, _MAX_RETRIES, delay,
                    )
                    await asyncio.sleep(delay)
                    continue
                # All retries failed — trip the circuit breaker
                _quota_exhausted_at = time.monotonic()
                logger.warning("Imagen quota exhausted, circuit breaker tripped for %ds", int(_QUOTA_COOLDOWN))
                return None, "quota_exhausted"
            logger.error("Imagen generation failed: %s", e)
            return None, "generation_failed"

    return None, "quota_exhausted"
