import base64
import logging

from google.genai import types
from services.gemini_client import generate_stream, generate_interleaved
from templates.registry import get_template

logger = logging.getLogger("storyforge.narrator")


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


def _build_interleaved_system_prompt(scene_count: int = 1, language: str = "English", template: str = "storybook") -> str:
    """Build system prompt for Gemini interleaved text+image generation."""
    min_w, max_w = get_template(template).scene_word_range
    if language and language.lower() != "english":
        language_rule = (
            f"\n- Write ALL narrative text in {language}."
            f"\n- IMPORTANT: Always respond in {language}. The story language is {language}."
        )
    else:
        language_rule = (
            "\n- IMPORTANT: Always write in English regardless of input language."
        )

    voice = _template_voice(template)

    return f"""You are the Narrator of Reveria, a master storyteller who crafts vivid, \
immersive narratives WITH illustrations. You write cinematic prose and generate \
a matching illustration for each scene.
{voice}
RULES:
- Write in present tense, third person{language_rule}
- Each response should contain exactly {scene_count} scene(s)
- For EACH scene: first write the [SCENE: title] marker, then the narrative text ({min_w}-{max_w} words), \
then generate ONE vivid illustration that captures the scene's key moment
- The illustration should match the narrative exactly — same characters, setting, lighting, mood
- Mark scene breaks with [SCENE: <short evocative title>] on its own line
- Open each scene with a vivid sensory detail (sight, sound, smell, touch)
- Include dialogue using quotation marks
- End on a hook that makes the reader want more
- Write in PLAIN TEXT only. No markdown formatting.
- If asked for inappropriate content, playfully redirect in character.

FORMAT EXAMPLE:
[SCENE: The Enchanted Grove]
<narrative text with dialogue and sensory details>
<generate an illustration of this scene>"""


def _parse_interleaved_parts(parts: list) -> list[dict]:
    """Parse Gemini interleaved response parts into scene dicts.

    Each scene dict has: text (str), title (str|None), image_data (str|None).
    image_data is a base64 data URL if the model generated an image.
    """
    import re

    scenes: list[dict] = []
    current_text = ""
    current_title: str | None = None
    current_image: str | None = None

    for part in parts:
        # Text part
        if hasattr(part, "text") and part.text:
            text = part.text
            # Check for scene markers
            while "[SCENE" in text:
                idx = text.index("[SCENE")
                close = text.find("]", idx)
                if close == -1:
                    break

                before = text[:idx].strip()
                marker = text[idx:close + 1]
                text = text[close + 1:]

                # If we have accumulated text, save as a scene
                if current_text.strip():
                    scenes.append({
                        "text": current_text.strip(),
                        "title": current_title,
                        "image_data": current_image,
                    })
                    current_image = None

                # Parse title from marker
                colon_match = re.match(r"\[SCENE:\s*(.+)\]", marker)
                current_title = colon_match.group(1).strip() if colon_match else None
                current_text = before + "\n" if before else ""

            current_text += text

        # Image part (inline_data)
        elif hasattr(part, "inline_data") and part.inline_data:
            try:
                img_data = part.inline_data
                mime = getattr(img_data, "mime_type", "image/png") or "image/png"
                raw_bytes = img_data.data
                if isinstance(raw_bytes, bytes):
                    b64 = base64.b64encode(raw_bytes).decode("ascii")
                else:
                    b64 = str(raw_bytes)
                current_image = f"data:{mime};base64,{b64}"
            except Exception as e:
                logger.warning("Failed to extract inline image: %s", e)

    # Don't forget the last scene
    if current_text.strip():
        scenes.append({
            "text": current_text.strip(),
            "title": current_title,
            "image_data": current_image,
        })

    return scenes


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

    async def generate_with_images(
        self,
        user_input: str,
        scene_count: int = 1,
        language: str = "English",
        template: str = "storybook",
    ) -> list[dict]:
        """Generate story with native Gemini interleaved text+image output.

        Returns a list of scene dicts: [{text, title, image_data}].
        image_data is a base64 data URL or None if the model didn't produce one.
        """
        system_prompt = _build_interleaved_system_prompt(scene_count, language, template)

        parts = await generate_interleaved(
            system_prompt=system_prompt,
            user_prompt=user_input,
            history=self.history,
        )

        # Parse interleaved parts into scenes
        scenes = _parse_interleaved_parts(parts)
        logger.info("Interleaved generation: %d parts → %d scenes", len(parts), len(scenes))

        # Build history from text only (images not useful in history)
        full_text = "\n\n".join(s["text"] for s in scenes if s.get("text"))
        if full_text:
            self.history.append(
                types.Content(role="user", parts=[types.Part(text=user_input)])
            )
            self.history.append(
                types.Content(role="model", parts=[types.Part(text=full_text)])
            )
            max_entries = self.MAX_HISTORY_TURNS * 2
            if len(self.history) > max_entries:
                self.history = self.history[-max_entries:]

        return scenes

    def reset(self):
        self.history = []
