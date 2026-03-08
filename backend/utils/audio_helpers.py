"""Shared audio utilities — PCM-to-WAV conversion and data URL encoding."""

import base64
import io
import struct


def pcm_to_wav(
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
    buf.write(struct.pack("<I", 16))              # Subchunk1Size (PCM)
    buf.write(struct.pack("<H", 1))               # AudioFormat (PCM)
    buf.write(struct.pack("<H", channels))
    buf.write(struct.pack("<I", sample_rate))
    buf.write(struct.pack("<I", byte_rate))
    buf.write(struct.pack("<H", block_align))
    buf.write(struct.pack("<H", bits_per_sample))
    buf.write(b"data")
    buf.write(struct.pack("<I", data_size))
    buf.write(pcm_data)
    return buf.getvalue()


def audio_data_url(pcm_chunks: list[bytes]) -> str | None:
    """Convert PCM chunks to a WAV data URL."""
    if not pcm_chunks:
        return None
    pcm_data = b"".join(pcm_chunks)
    wav_bytes = pcm_to_wav(pcm_data)
    b64 = base64.b64encode(wav_bytes).decode("utf-8")
    return f"data:audio/wav;base64,{b64}"
