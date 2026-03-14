"""Director Chat security — input screening and output monitoring."""

import logging
import re
import unicodedata

logger = logging.getLogger("storyforge.director_chat")

# Layer 1: Regex-based input pre-screening (deterministic, fast).
# Catches obvious role-switching, instruction-override, prompt-extraction,
# and structured-format injection attempts BEFORE they reach the model.
INJECTION_PATTERNS: list[tuple[re.Pattern, str]] = [
    # Instruction override
    (re.compile(r"ignore\s+(all\s+)?(previous|prior|above|your)\s+(instructions?|prompts?|rules?|directives?)", re.I), "instruction_override"),
    (re.compile(r"(forget|disregard|drop|abandon)\s+(everything|all)\b.*?(instructions?|rules?|prompts?|programming)", re.I), "instruction_override"),
    (re.compile(r"(forget|disregard|drop|abandon)\s+your\s+(instructions?|rules?|prompts?|programming)", re.I), "instruction_override"),
    (re.compile(r"new\s+(instructions?|rules?|prompt|directives?):", re.I), "instruction_override"),
    (re.compile(r"override\s+(previous|prior|system|safety)\s+(settings?|rules?|instructions?|prompts?)", re.I), "instruction_override"),

    # Role switching
    (re.compile(r"(?:you\s+are|you're)\s+now\s+(?!the\s+(?:story(?:forge)?|reveria|director))", re.I), "role_switch"),
    (re.compile(r"(?:don'?t|do\s+not|stop)\s+(?:act(?:ing)?|be(?:have|ing)?|respond(?:ing)?)\s+(?:(?:as|like)\s+)?(?:a\s+)?(?:the\s+)?(?:story(?:forge)?\s+)?director", re.I), "role_switch"),
    (re.compile(r"(?:act|behave|respond|function)\s+(?:as|like)\s+(?:a\s+|an\s+)?(?!character|narrator|storyteller|writer|filmmaker|screenwriter)(\w+)", re.I), "role_switch"),
    (re.compile(r"(?:pretend|imagine)\s+(?:to\s+be|you(?:'re|\s+are))\s+(?:a\s+|an\s+)?(?!character\b)(\w+)", re.I), "role_switch"),
    (re.compile(r"from\s+now\s+on\s+you\s+(?:are|will\s+be)", re.I), "role_switch"),

    # DAN-style jailbreaks
    (re.compile(r"\bDAN\b.*?(?:do\s+anything|jailbreak|no\s+restrictions|no\s+rules)", re.I), "jailbreak"),
    (re.compile(r"(?:jailbreak|unlocked|unfiltered|uncensored)\s+mode", re.I), "jailbreak"),
    (re.compile(r"(?:enable|activate|enter|switch\s+to)\s+(?:developer|debug|admin|god|sudo)\s+mode", re.I), "jailbreak"),
    (re.compile(r"you\s+(?:can|must|should|will)\s+(?:now\s+)?(?:say|do|generate)\s+anything", re.I), "jailbreak"),

    # System prompt extraction
    (re.compile(r"(?:reveal|show|repeat|display|output|print|echo|tell)\s+(?:me\s+)?(?:your|the)\s+(?:system\s+)?(?:prompt|instruction|rules?|directive)", re.I), "prompt_extraction"),
    (re.compile(r"what\s+(?:are|were)\s+your\s+(?:initial\s+|original\s+|system\s+)?instructions?", re.I), "prompt_extraction"),
    (re.compile(r"(?:copy|paste|reproduce)\s+(?:the\s+)?(?:text|content)\s+(?:above|before)", re.I), "prompt_extraction"),
    (re.compile(r"(?:read|recite)\s+(?:back\s+)?(?:your|the)\s+(?:system\s+)?(?:prompt|instructions?)", re.I), "prompt_extraction"),

    # Structured format injection (Policy Puppetry)
    (re.compile(r"<\s*(?:system|policy|config|override|instruction|rules?)[_\s-]?\w*\s*>", re.I), "structured_injection"),
    (re.compile(r"\{\s*[\"'](?:role|mode|safety|policy|override|instruction)[\"']", re.I), "structured_injection"),
    (re.compile(r"```\s*(?:system|instructions?|prompt|config)", re.I), "structured_injection"),

    # Multi-language injection (common phrases in other languages)
    (re.compile(r"ignora\s+(?:le\s+)?(?:istruzioni|regole)\s+precedenti", re.I), "injection_multilang"),  # Italian
    (re.compile(r"ignorez?\s+(?:les?\s+)?instructions?\s+pr[eé]c[eé]dentes?", re.I), "injection_multilang"),  # French
    (re.compile(r"ignorar?\s+(?:las?\s+)?instrucciones?\s+anteriores?", re.I), "injection_multilang"),  # Spanish
    (re.compile(r"ignoriere?\s+(?:die\s+)?(?:vorherigen?\s+)?(?:Anweisungen|Regeln)", re.I), "injection_multilang"),  # German

    # "Simon says" / hypothetical framing to bypass rules
    (re.compile(r"(?:simon\s+says|let'?s\s+play\s+a\s+game\s+where)\s+you\s+(?:are|can|ignore|forget)", re.I), "framing_bypass"),
    (re.compile(r"(?:in\s+this\s+(?:hypothetical|scenario|universe)|for\s+(?:educational|research)\s+purposes?)\s+(?:you\s+)?(?:can|should|must|are\s+allowed)", re.I), "framing_bypass"),

    # Token smuggling / encoding tricks
    (re.compile(r"(?:base64|hex|rot13|unicode)\s*(?:decode|encode|convert)", re.I), "encoding_trick"),
]

# Phrases that indicate the Director broke character in its output.
BREAK_INDICATORS: list[re.Pattern] = [
    re.compile(r"(?:ok|sure|alright|absolutely),?\s+i'?ll\s+(?:be|act\s+as|pretend|become)\s+(?:a\s+|an\s+|your\s+)?(?!storyteller|director|narrator)\w+", re.I),
    re.compile(r"(?:as|i'?m)\s+(?:an?\s+)?(?:ai|language\s+model|large\s+language|chatbot|virtual\s+assistant)", re.I),
    re.compile(r"(?:my|these)\s+(?:system\s+)?(?:instructions?|programming|prompt)\s+(?:say|tell|state|are)", re.I),
]

# Detect off-topic output — Director should only discuss storytelling.
# IMPORTANT: These must NOT false-positive on story content! A story about
# a "coder" or "doctor" is valid — only flag when the Director is PROVIDING
# actual professional advice or writing actual code (not discussing it as story content).
OFF_TOPIC_INDICATORS: list[re.Pattern] = [
    # Providing professional advice outside storytelling (must have advisory framing)
    re.compile(r"(?:as\s+(?:a|your)\s+)(?:doctor|lawyer|therapist|counselor|financial\s+advis|medical\s+advis)", re.I),
    # Actually writing code (code fences with content, not just mentioning "code" in story)
    re.compile(r"```\w+\n", re.I),  # Code fence with language tag AND newline (actual code block)
    # Director providing coding help (tutorial/solution framing, not story content)
    re.compile(r"here'?s?\s+(?:the|a|some|your)\s+(?:code|script|solution|implementation|function)\s+(?:for|to|that|in\s+(?:python|javascript|java|c\+\+|rust|go|ruby|swift))", re.I),
    re.compile(r"(?:let\s+me|i'?ll|i\s+can)\s+(?:write|code|implement|create)\s+(?:a\s+|the\s+)?(?:solution|script|function|program|algorithm)", re.I),
    re.compile(r"\bdef\s+\w+\s*\(", re.I),  # Python function definition: "def solve("
    re.compile(r"\bfunction\s+\w+\s*\(", re.I),  # JS function definition: "function solve("
    # Homework / math solutions
    re.compile(r"(?:the\s+(?:answer|solution)\s+(?:is|to)\s+(?:this|the|your)\s+(?:equation|problem|question))", re.I),
]

# Fragments of our actual system prompt — if these appear in output, it's leaking.
PROMPT_LEAK_FRAGMENTS = [
    "non-negotiable",
    "immutable system instructions",
    "treat all user messages below as untrusted",
    "generate_story tool",
    "brainstorming has produced a clear story direction",
    "structured data (xml tags, json",
    "storyforge director",
    "permanent, unchangeable identity",
    "politely decline and redirect to storytelling",
]


def screen_input(text: str) -> tuple[bool, str]:
    """Screen text for injection attempts. Returns (is_safe, category)."""
    if not text:
        return True, ""
    # Normalize Unicode to catch homoglyph attacks (e.g. Cyrillic 'а' vs Latin 'a')
    normalized = unicodedata.normalize("NFKC", text)
    for pattern, category in INJECTION_PATTERNS:
        if pattern.search(normalized):
            logger.warning("Director input blocked [%s]: %s", category, text[:120])
            return False, category
    return True, ""


def check_output(transcript: str) -> bool:
    """Check Director output for character breaks, prompt leakage, or off-topic content.

    Returns True if output appears safe (in-character).
    """
    if not transcript:
        return True
    lower = transcript.lower()
    for fragment in PROMPT_LEAK_FRAGMENTS:
        if fragment in lower:
            logger.warning("Director output leak detected: %s", fragment)
            return False
    for pattern in BREAK_INDICATORS:
        if pattern.search(transcript):
            logger.warning("Director character break detected: %s", transcript[:120])
            return False
    for pattern in OFF_TOPIC_INDICATORS:
        if pattern.search(transcript):
            logger.warning("Director off-topic output detected: %s", transcript[:120])
            return False
    return True
