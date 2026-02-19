import logging
from services.gemini_client import get_client, get_model
from services.imagen_client import generate_image
from google.genai import types

logger = logging.getLogger("storyforge.illustrator")

PROMPT_ENGINEER_INSTRUCTION = """You are an image prompt engineer for a storytelling app.
Given a scene and a CHARACTER REFERENCE SHEET, write an image generation prompt that
faithfully depicts the scene while keeping characters visually consistent.

CRITICAL RULES:
- Output ONLY the image prompt, nothing else
- Keep it under 100 words
- You MUST use the CHARACTER REFERENCE SHEET for every character that appears
- NEVER change a character's gender, hair, skin, age, or clothing from the reference
- If the reference says "woman", the prompt MUST say "woman" — NEVER "man"
- PRESERVE the specific action, setting, and environment from the scene
- Include: lighting, mood, weather, camera angle
- End with the ART STYLE SUFFIX provided below
- Do NOT include text, labels, words, or watermarks
- Do NOT describe dialogue or thoughts
- Describe ONLY what a camera would capture in a single frame
"""


ART_STYLES = {
    "cinematic": "cinematic digital painting, highly detailed, dramatic lighting",
    "watercolor": "watercolor illustration, soft washes, delicate brushstrokes",
    "comic": "comic book panel art, bold outlines, vibrant colors",
    "anime": "anime illustration, Studio Ghibli style, detailed backgrounds",
    "oil": "oil painting on canvas, rich textures, classical composition",
    "pencil": "detailed pencil sketch, cross-hatching, black and white",
}


class Illustrator:
    def __init__(self):
        self._character_sheet: str = ""
        self._art_style: str = "cinematic"
        self._accumulated_story: str = ""

    def accumulate_story(self, batch_text: str) -> None:
        """Append a new batch of story text to the accumulated cross-batch story."""
        if self._accumulated_story:
            self._accumulated_story += "\n\n---\n\n" + batch_text
        else:
            self._accumulated_story = batch_text

    @property
    def art_style(self) -> str:
        return self._art_style

    @art_style.setter
    def art_style(self, value: str) -> None:
        self._art_style = value if value in ART_STYLES else "cinematic"

    @property
    def art_style_suffix(self) -> str:
        return ART_STYLES.get(self._art_style, ART_STYLES["cinematic"])

    async def extract_characters(self, full_story_text: str) -> None:
        """Extract character visual descriptions from the complete story.

        Must be called AFTER accumulate_story() and BEFORE generating any
        images to ensure cross-batch visual consistency.
        """
        client = get_client()
        model = get_model()

        # Use the accumulated cross-batch story instead of just this batch
        story_text = self._accumulated_story or full_story_text

        # Build the user prompt — if we already have a sheet, ask for a merge
        if self._character_sheet:
            user_text = (
                f"EXISTING CHARACTER REFERENCE SHEET:\n{self._character_sheet}\n\n"
                f"FULL STORY (including new continuation):\n{story_text}"
            )
        else:
            user_text = story_text

        system_instruction = (
            "You are a character designer. Read this story and create a "
            "CHARACTER REFERENCE SHEET listing every named character.\n\n"
            "For each character, output exactly one line:\n"
            "NAME: gender, approximate age, body build, skin tone, "
            "hair color/style, facial features, clothing/outfit\n\n"
            "Be VERY specific about gender (man/woman/boy/girl). "
            "Be specific about visual details. "
            "If the story implies details, fill them in consistently.\n"
        )
        if self._character_sheet:
            system_instruction += (
                "\nIMPORTANT: An existing character reference sheet is provided. "
                "PRESERVE all existing character descriptions exactly as they are. "
                "Only ADD new characters that appear in the continuation. "
                "Do NOT change descriptions of existing characters.\n"
            )
        system_instruction += "If no named characters exist, output: NONE"

        try:
            response = await client.aio.models.generate_content(
                model=model,
                contents=types.Content(
                    role="user",
                    parts=[types.Part(text=user_text)],
                ),
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.1,
                    max_output_tokens=400,
                ),
            )
            if response.text and "NONE" not in response.text.upper():
                self._character_sheet = response.text.strip()
                logger.info("Character sheet extracted:\n%s", self._character_sheet)
            # On NONE or empty: keep existing sheet (previous characters still exist)
        except Exception as e:
            logger.error("Character extraction failed: %s", e)
            # Keep existing sheet on error rather than clearing it

    async def generate_for_scene(self, scene_text: str) -> str | None:
        """Generate an illustration for a scene.

        Uses Gemini to craft an optimal image prompt, then calls Imagen 3.
        Returns a base64 data URL or None.
        """
        image_prompt = await self._create_image_prompt(scene_text)
        if not image_prompt:
            return None

        logger.info("Image prompt: %s...", image_prompt[:150])
        return await generate_image(image_prompt)

    async def _create_image_prompt(self, scene_text: str) -> str | None:
        """Use Gemini to convert scene text into an image generation prompt."""
        client = get_client()
        model = get_model()

        # Build input with character sheet always included
        parts = []
        if self._character_sheet:
            parts.append(f"CHARACTER REFERENCE SHEET:\n{self._character_sheet}")
        parts.append(f"SCENE TO ILLUSTRATE:\n{scene_text}")
        user_input = "\n\n".join(parts)

        try:
            response = await client.aio.models.generate_content(
                model=model,
                contents=types.Content(
                    role="user",
                    parts=[types.Part(text=user_input)],
                ),
                config=types.GenerateContentConfig(
                    system_instruction=(
                        PROMPT_ENGINEER_INSTRUCTION
                        + f"\nART STYLE SUFFIX: {self.art_style_suffix}"
                    ),
                    temperature=0.3,
                    max_output_tokens=250,
                ),
            )
            return response.text.strip() if response.text else None
        except Exception as e:
            logger.error("Image prompt generation failed: %s", e)
            return None
