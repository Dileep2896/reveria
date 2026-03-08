"""GCS media upload - decode base64 data URLs and upload to Cloud Storage."""

import asyncio
import base64
import datetime as _dt
import logging
import os
import re

from google.api_core import retry as gcs_retry
from google.cloud import storage

logger = logging.getLogger("storyforge.storage")

_bucket_name: str | None = None
_client: storage.Client | None = None

_UPLOAD_RETRY = gcs_retry.Retry(deadline=60.0)

# Allowed MIME types for uploads (prevents unexpected content)
_ALLOWED_MIMES = {
    "image/png", "image/jpeg", "image/webp",
    "audio/mp3", "audio/mpeg", "audio/wav",
}

# Max raw decoded size: 20MB (generous limit for images + audio)
_MAX_DECODED_BYTES = 20 * 1024 * 1024


def _get_bucket_name() -> str:
    global _bucket_name
    if _bucket_name is None:
        _bucket_name = os.getenv("GCS_BUCKET", "storyforge-hackathon-media")
    return _bucket_name


def _get_client() -> storage.Client:
    global _client
    if _client is None:
        _client = storage.Client()
    return _client


def _make_public_or_sign(blob) -> str:
    """Make blob public; fall back to a 7-day signed URL on permission errors."""
    try:
        blob.make_public()
        return blob.public_url
    except Exception as e:
        logger.warning("make_public failed, falling back to signed URL: %s", e)
        return blob.generate_signed_url(
            version="v4",
            expiration=_dt.timedelta(days=7),
            method="GET",
        )


async def upload_media(
    story_id: str,
    scene_number: int,
    media_type: str,
    data_url: str,
    *,
    suffix: str = "",
) -> str:
    """Upload a base64 data URL to GCS and return a public URL.

    Args:
        story_id: Story identifier for path namespacing.
        scene_number: Scene number.
        media_type: "image" or "audio".
        data_url: Full data URL (e.g. "data:image/png;base64,iVBOR...").
        suffix: Optional suffix appended to filename (e.g. "_panel_0").

    Returns:
        Public HTTPS URL for the uploaded object.
    """
    # Parse data URL: data:<mime>;base64,<data>
    match = re.match(r"data:([^;]+);base64,(.+)", data_url, re.DOTALL)
    if not match:
        raise ValueError("Invalid data URL format")

    mime_type = match.group(1)
    if mime_type not in _ALLOWED_MIMES:
        raise ValueError(f"Unsupported MIME type: {mime_type}")

    b64_data = match.group(2)
    if len(b64_data) > _MAX_DECODED_BYTES * 4 // 3 + 4:  # base64 overhead ~33%
        raise ValueError("Data URL payload too large")

    raw_data = base64.b64decode(b64_data)

    # Determine file extension from mime
    ext_map = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
        "audio/mp3": "mp3",
        "audio/mpeg": "mp3",
        "audio/wav": "wav",
    }
    ext = ext_map.get(mime_type, mime_type.split("/")[-1])

    bucket_name = _get_bucket_name()
    blob_path = f"stories/{story_id}/scenes/{scene_number}/{media_type}{suffix}.{ext}"

    def _upload() -> str:
        client = _get_client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_path)
        blob.upload_from_string(raw_data, content_type=mime_type, retry=_UPLOAD_RETRY)
        return _make_public_or_sign(blob)

    url = await asyncio.to_thread(_upload)
    logger.info("Uploaded %s → %s", media_type, blob_path)
    return url


async def upload_cover(story_id: str, data_url: str) -> str:
    """Upload a book cover image to GCS and return a public URL.

    Args:
        story_id: Story identifier for path namespacing.
        data_url: Full data URL (e.g. "data:image/png;base64,iVBOR...").

    Returns:
        Public HTTPS URL for the uploaded cover.
    """
    match = re.match(r"data:([^;]+);base64,(.+)", data_url, re.DOTALL)
    if not match:
        raise ValueError("Invalid data URL format")

    mime_type = match.group(1)
    raw_data = base64.b64decode(match.group(2))

    bucket_name = _get_bucket_name()
    blob_path = f"stories/{story_id}/cover.png"

    def _upload() -> str:
        client = _get_client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_path)
        blob.upload_from_string(raw_data, content_type=mime_type, retry=_UPLOAD_RETRY)
        return _make_public_or_sign(blob)

    url = await asyncio.to_thread(_upload)
    logger.info("Uploaded cover → %s", blob_path)
    return url


async def delete_story_media(story_id: str) -> int:
    """Delete all GCS objects under stories/{story_id}/. Returns count deleted."""
    bucket_name = _get_bucket_name()

    def _delete() -> int:
        client = _get_client()
        bucket = client.bucket(bucket_name)
        prefix = f"stories/{story_id}/"
        blobs = list(bucket.list_blobs(prefix=prefix))
        if not blobs:
            return 0
        # Delete individually with retry instead of batch (more resilient)
        deleted = 0
        for blob in blobs:
            try:
                blob.delete(retry=_UPLOAD_RETRY)
                deleted += 1
            except Exception as e:
                logger.warning("Failed to delete blob %s: %s", blob.name, e)
        return deleted

    count = await asyncio.to_thread(_delete)
    logger.info("Deleted %d GCS objects for story %s", count, story_id)
    return count
