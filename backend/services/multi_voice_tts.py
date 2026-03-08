"""Multi-voice narration — distinct voices for narrator vs character dialogue.

Parses scene text into narration/dialogue segments, assigns gender-appropriate
Gemini voices from the character sheet, generates PCM in parallel, and
concatenates into a single WAV. Falls back to single-voice when no character
sheet or dialogue is present.
"""

import asyncio
import base64
import logging
import re

from services.gemini_tts import (
    LANGUAGE_VOICES,
    _pcm_to_wav,
    synthesize_speech,
    synthesize_speech_pcm,
)

import struct

logger = logging.getLogger("storyforge.multi_voice_tts")


def _generate_silence_pcm(duration_ms: int, sample_rate: int = 24000) -> bytes:
    """Return silent 16-bit LE PCM bytes for *duration_ms* milliseconds."""
    num_samples = int(sample_rate * duration_ms / 1000)
    return b"\x00\x00" * num_samples


# Limit concurrent Gemini Live TTS sessions to avoid API rate limits.
# Each segment opens its own session; without this, 7+ segments per scene
# would overwhelm the API and most would fail.
_TTS_SEM = asyncio.Semaphore(4)

# Voice pools by gender — used for character dialogue
VOICE_POOLS = {
    "man":   ["Charon", "Fenrir", "Orus"],
    "woman": ["Aoede", "Leda", "Zephyr"],
    "boy":   ["Puck"],
    "girl":  ["Zephyr"],
}

DIALOGUE_SYSTEM = (
    "You are a text-to-speech engine performing character dialogue. "
    "STRICT RULES:\n"
    "1. Vocalize ONLY the exact words between [SCRIPT] and [/SCRIPT] markers.\n"
    "2. Do NOT add, remove, or change ANY words.\n"
    "3. Do NOT add narration, commentary, or attribution.\n"
    "4. Perform with natural emotion and character voice, but NEVER alter the text."
)

# Matches both straight and curly double-quotes
DIALOGUE_RE = re.compile(r'["\u201c](.+?)["\u201d]', re.DOTALL)


# ── Character sheet parsing ───────────────────────────────────────


def parse_character_genders(character_sheet: str) -> dict[str, str]:
    """Extract {character_name: gender} from the character reference sheet.

    Expected format per line:
        NAME: [gender: man/woman/boy/girl], [age: ...], ...
    Uses multiple fallback strategies if the exact format isn't followed.
    """
    # Normalize common gender synonyms to our pool keys
    _GENDER_MAP = {
        "man": "man", "male": "man", "boy": "boy", "gentleman": "man",
        "woman": "woman", "female": "woman", "girl": "girl", "lady": "woman",
    }

    genders: dict[str, str] = {}
    for line in character_sheet.strip().splitlines():
        if ":" not in line:
            continue
        name = line.split(":", 1)[0].strip()
        desc = line.split(":", 1)[1].strip().lower() if name else ""
        if not name or not desc:
            continue

        gender = None

        # Strategy 1: bracketed format [gender: man/woman/boy/girl]
        m = re.search(r"\[gender:\s*(\w+)\]", line, re.IGNORECASE)
        if m:
            gender = _GENDER_MAP.get(m.group(1).lower())

        # Strategy 2: scan description for gender keywords near the start
        if not gender:
            for keyword, mapped in _GENDER_MAP.items():
                if re.search(r"\b" + keyword + r"\b", desc[:80]):
                    gender = mapped
                    break

        if name and gender:
            genders[name] = gender
    return genders


# ── Voice assignment ──────────────────────────────────────────────


def assign_voices(
    genders: dict[str, str], narrator_voice: str
) -> dict[str, str]:
    """Assign a unique Gemini voice to each character based on gender.

    Cycles through the gender pool, skipping the narrator voice to ensure
    characters always sound different from the narrator.
    """
    assignments: dict[str, str] = {}
    pool_idx: dict[str, int] = {"man": 0, "woman": 0, "boy": 0, "girl": 0}

    for name, gender in genders.items():
        pool = [v for v in VOICE_POOLS[gender] if v != narrator_voice]
        if not pool:
            pool = VOICE_POOLS[gender]  # fallback if narrator uses all options
        voice = pool[pool_idx[gender] % len(pool)]
        pool_idx[gender] += 1
        assignments[name] = voice

    return assignments


# ── Scene text segmentation ───────────────────────────────────────


def _find_speaker(context: str, names: list[str], quote_pos: int) -> str | None:
    """Heuristic: find the character name most likely to be the speaker.

    Uses word-boundary matching to avoid substring false positives
    (e.g., "Sam" inside "Samantha", "Art" inside "started").

    Prefers names appearing *before* the opening quote (the common
    attribution pattern: ``Name said, "..."``). Falls back to post-quote
    names for the ``"..." said Name`` pattern.
    """
    pre_quote = context[:quote_pos]
    post_quote = context[quote_pos:]

    # Search pre-quote region — closest name to the opening quote wins
    best_pre: str | None = None
    best_pre_dist = quote_pos + 1
    for name in names:
        pat = re.compile(r"\b" + re.escape(name) + r"\b", re.IGNORECASE)
        for m in pat.finditer(pre_quote):
            dist = quote_pos - m.start()
            if dist < best_pre_dist:
                best_pre_dist = dist
                best_pre = name

    if best_pre:
        return best_pre

    # Fallback: search post-quote region — closest name after the quote
    best_post: str | None = None
    best_post_dist = len(post_quote) + 1
    for name in names:
        pat = re.compile(r"\b" + re.escape(name) + r"\b", re.IGNORECASE)
        for m in pat.finditer(post_quote):
            if m.start() < best_post_dist:
                best_post_dist = m.start()
                best_post = name

    return best_post


def split_scene_segments(
    text: str, character_names: list[str]
) -> list[dict]:
    """Split scene text into ordered narration and dialogue segments.

    Returns list of:
        {"type": "narration"|"dialogue", "text": str, "character": str|None}
    """
    segments: list[dict] = []
    last_end = 0

    for m in DIALOGUE_RE.finditer(text):
        # Narration before this dialogue
        before = text[last_end : m.start()].strip()
        if before:
            segments.append({"type": "narration", "text": before})

        # Look in a 60-char window around the dialogue for a speaker name
        window_start = max(0, m.start() - 60)
        window_end = min(len(text), m.end() + 60)
        context = text[window_start:window_end]
        quote_pos = m.start() - window_start  # position of opening quote in context
        speaker = _find_speaker(context, character_names, quote_pos)

        segments.append({
            "type": "dialogue",
            "text": m.group(1),  # spoken text without quotes
            "character": speaker,
        })
        last_end = m.end()

    # Trailing narration
    trailing = text[last_end:].strip()
    if trailing:
        segments.append({"type": "narration", "text": trailing})

    return segments


# ── Main entry point ──────────────────────────────────────────────


async def synthesize_multi_voice(
    text: str,
    character_sheet: str = "",
    language: str = "English",
) -> tuple[str | None, None]:
    """Multi-voice narration: different voices for narrator vs character dialogue.

    Falls back to single-voice synthesize_speech() when:
    - No character sheet provided
    - No dialogue found in text
    - Character sheet has no parseable genders
    - Only a single segment (no mixing needed)
    """
    # Fast fallback: no character sheet or no dialogue quotes
    if not character_sheet or ('"' not in text and '\u201c' not in text):
        return await synthesize_speech(text, language=language)

    narrator_voice = LANGUAGE_VOICES.get(language.lower(), "Kore")
    genders = parse_character_genders(character_sheet)
    if not genders:
        return await synthesize_speech(text, language=language)

    voice_map = assign_voices(genders, narrator_voice)
    segments = split_scene_segments(text, list(genders.keys()))

    if len(segments) <= 1:
        return await synthesize_speech(text, language=language)

    logger.info(
        "Multi-voice: %d segments, %d characters (%s)",
        len(segments),
        len(voice_map),
        ", ".join(f"{n}={v}" for n, v in voice_map.items()),
    )

    async def _throttled_pcm(text: str, voice: str, system: str | None = None) -> bytes | None:
        """Generate PCM with concurrency throttle to respect API session limits."""
        async with _TTS_SEM:
            return await synthesize_speech_pcm(text, voice, system)

    # Generate PCM for all segments in parallel (throttled)
    pcm_tasks = []
    for seg in segments:
        if (
            seg["type"] == "dialogue"
            and seg.get("character")
            and seg["character"] in voice_map
        ):
            voice = voice_map[seg["character"]]
            pcm_tasks.append(
                _throttled_pcm(seg["text"], voice, DIALOGUE_SYSTEM)
            )
        else:
            # Narration or unattributed dialogue → narrator voice
            pcm_tasks.append(
                _throttled_pcm(seg["text"], narrator_voice)
            )

    results = await asyncio.gather(*pcm_tasks, return_exceptions=True)

    # Concatenate PCM in order, inserting proportional silence on failures
    pcm_parts: list[bytes] = []
    for i, r in enumerate(results):
        if isinstance(r, bytes) and r:
            pcm_parts.append(r)
        else:
            if isinstance(r, Exception):
                logger.warning("Multi-voice segment %d failed: %s", i, r)
            # Insert proportional silence based on word count of the segment
            word_count = len(segments[i]["text"].split()) if i < len(segments) else 3
            silence_ms = min(max(word_count * 100, 300), 3000)
            pcm_parts.append(_generate_silence_pcm(silence_ms))

    if not pcm_parts:
        logger.warning("All multi-voice segments failed — falling back to single-voice")
        return await synthesize_speech(text, language=language)

    combined_pcm = b"".join(pcm_parts)
    wav_bytes = _pcm_to_wav(combined_pcm)
    b64 = base64.b64encode(wav_bytes).decode("utf-8")
    data_url = f"data:audio/wav;base64,{b64}"
    logger.info(
        "Multi-voice audio generated (%dKB, %d/%d segments)",
        len(b64) // 1024,
        len(pcm_parts),
        len(segments),
    )
    return data_url, None
