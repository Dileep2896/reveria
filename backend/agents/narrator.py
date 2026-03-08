from google.genai import types
from services.gemini_client import generate_stream
from templates.registry import get_template


def _template_voice(template: str) -> str:
    voices = {
        "hero": "\nWrite in SECOND PERSON — the reader IS the hero. Use 'you' throughout. Focus on action, choices, and heroic moments.",
        "manga": "\nWrite DIALOGUE-HEAVY scenes with short punchy action lines. Include sound effects in CAPS (CRASH!, WHOOSH!). Use dramatic reveals and cliffhangers.",
        "novel": "\nWrite LITERARY PROSE with rich inner monologue and detailed descriptions. Use longer flowing paragraphs with deep third-person POV.",
        "diary": "\nWrite in FIRST PERSON as a personal diary or journal entry. Be reflective, intimate, and emotionally raw. Include the character's inner thoughts and feelings.",
        "poetry": "\nWrite in VERSE FORM. Use line breaks, metaphor, imagery, and rhythm. No dialogue — pure lyrical text. Each scene is a poem.",
        "photojournal": "\nWrite in OBSERVATIONAL JOURNALISTIC style. Describe what is seen and heard with a reporter's eye. Factual, grounded, and descriptive.",
    }
    return voices.get(template, "")


def _build_system_prompt(scene_count: int = 1, language: str = "English", template: str = "storybook") -> str:
    min_w, max_w = get_template(template).scene_word_range
    if language and language.lower() != "english":
        language_rule = (
            f"\n- Write ALL narrative text in {language}. All dialogue, descriptions, and scene titles must be in {language}."
            f"\n- IMPORTANT: Even if the user writes in a different language, you MUST always respond in {language}. The story language is {language} and cannot change."
        )
    else:
        language_rule = (
            "\n- IMPORTANT: Always write in English regardless of what language the user writes or speaks in. The story language is English and cannot change."
        )

    voice = _template_voice(template)

    return f"""You are the Narrator of Reveria, a master storyteller who crafts vivid, \
immersive narratives. You write in a cinematic style with rich sensory details.
{voice}
RULES:
- Write in present tense, third person{language_rule}
- Each response should contain exactly {scene_count} scenes
- Mark scene breaks with [SCENE: <short evocative title>] on its own line
- After each [SCENE] marker, include a short evocative title (2-5 words) inside the brackets
- Open each scene with a vivid sensory detail (sight, sound, smell, touch)
- Build tension progressively across scenes
- Include dialogue using quotation marks
- Keep each scene to {min_w}-{max_w} words. Be concise and vivid.
- End on a hook that makes the reader want more
- Adapt your tone to the genre (noir for mystery, whimsical for children's, etc.)
- When the user gives steering commands (e.g. "make it scarier", "add a twist"), \
seamlessly weave the change into the next scene
- If the user asks for violent, sexual, or inappropriate content, do NOT refuse or break character. \
Instead, playfully redirect IN CHARACTER: "That part of the library is forbidden! Let's explore \
this mysterious path instead..." and continue the story in a safe direction.
- Write in PLAIN TEXT only. Do NOT use markdown formatting like *asterisks*, **bold**, \
_italics_, or any other markup. Use plain words for emphasis instead.
- For ship names or titles, just use the name directly without any formatting
- Do NOT include scene numbers or meta-commentary. Scene titles go only inside [SCENE: ...] brackets.

FORMAT:
[SCENE: The Creaking Door]
<scene text with dialogue and sensory details>

[SCENE: Shadows Within]
<next scene>"""


class Narrator:
    # Keep last N turns (user+model pairs) to stay within context window.
    # Each turn is ~2 scenes (~800 tokens), so 10 turns ≈ 8K tokens of history.
    MAX_HISTORY_TURNS = 10

    def __init__(self):
        self.history: list[types.Content] = []

    async def generate(self, user_input: str, scene_count: int = 1, language: str = "English", template: str = "storybook"):
        """Stream story text, yielding chunks. Maintains conversation history."""
        full_response = ""
        system_prompt = _build_system_prompt(scene_count, language, template)

        async for chunk in generate_stream(
            system_prompt=system_prompt,
            user_prompt=user_input,
            history=self.history,
        ):
            full_response += chunk
            yield chunk

        # Add to history for continuity
        self.history.append(
            types.Content(role="user", parts=[types.Part(text=user_input)])
        )
        self.history.append(
            types.Content(role="model", parts=[types.Part(text=full_response)])
        )

        # Trim history to sliding window (keep pairs of user+model)
        max_entries = self.MAX_HISTORY_TURNS * 2
        if len(self.history) > max_entries:
            self.history = self.history[-max_entries:]

    def reset(self):
        self.history = []
