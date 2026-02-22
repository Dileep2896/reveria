"""Content filtering — refusal detection for AI-generated text."""

# Safety / NSFW refusal patterns
_SAFETY_PATTERNS = [
    "i am programmed to be a harmless",
    "i am unable to generate",
    "i cannot generate",
    "i'm not able to generate",
    "i can't generate content",
    "i cannot create content",
    "i'm unable to create",
    "as an ai language model",
    "as a language model",
    "i cannot write sexually",
    "sexually suggestive",
    "sexually explicit",
    "i cannot produce",
    "i'm designed to be helpful, harmless",
    "i must decline",
    "i cannot fulfill this request",
    "i'm not able to fulfill",
    "would you like me to try generating something different",
    "i cannot assist with",
    "i'm not able to assist with",
    "violates my safety guidelines",
    "against my programming",
    "inappropriate content",
]

# Off-topic refusal patterns (non-story prompts)
_OFFTOPIC_PATTERNS = [
    "not a coding assistant",
    "not a programming assistant",
    "only capable of writing stories",
    "i can only write stories",
    "i can only help with stories",
    "i can only create stories",
    "i cannot provide code",
    "i can't provide code",
    "i cannot write code",
    "i can't write code",
    "i'm not able to help with that",
    "i am not able to help with that",
    "that is outside my capabilities",
    "that's outside my capabilities",
    "outside the scope of what i can",
    "i'm a storytelling",
    "i am a storytelling",
    "i'm designed to write stories",
    "i am designed to write stories",
    "please provide a story prompt",
    "please give me a story",
    "try giving me a story",
    "not something i can help with",
]

_ALL_PATTERNS = _SAFETY_PATTERNS + _OFFTOPIC_PATTERNS


def is_refusal(text: str) -> str | None:
    """Detect if text is an AI refusal. Returns 'safety', 'offtopic', or None."""
    lower = text.lower()
    if any(p in lower for p in _SAFETY_PATTERNS):
        return "safety"
    if any(p in lower for p in _OFFTOPIC_PATTERNS):
        return "offtopic"
    return None
