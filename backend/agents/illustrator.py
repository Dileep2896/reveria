import logging
from services.gemini_client import get_client, get_model
from services.imagen_client import generate_image
from google.genai import types

logger = logging.getLogger("storyforge.illustrator")

SCENE_COMPOSER_INSTRUCTION = """You are an image prompt engineer for a storytelling app.
Write a scene composition for an illustration. Character descriptions and art style
are handled separately - do NOT describe any characters' appearance and do NOT
include any art style or rendering instructions.

RULES:
- Output ONLY the scene composition, nothing else
- Keep it under 100 words
- Describe: setting, environment, action/pose, lighting, mood, weather, camera angle
- Reference characters by name only (e.g., "Alice stands near the window")
- Do NOT describe character appearance (hair, clothes, age, skin, build, etc.)
- Do NOT include text, labels, words, or watermarks
- Do NOT describe dialogue or thoughts
- Do NOT include art style, rendering style, or medium descriptions
- Describe ONLY what a camera would capture in a single frame

CONSISTENCY ANCHORS (important for visual continuity):
- Mention distinguishing accessories, props, or signature items by name (e.g., "Luna's red scarf", "Kai's wooden staff")
- Reference the same location names across scenes (e.g., "the old oak tree", "the crystal cave")
- Use consistent time-of-day and weather cues
"""

CHARACTER_IDENTIFIER_INSTRUCTION = """Given a scene and a list of character names,
output ONLY the names of characters who physically appear in or are visually
present in this scene, one per line. If no characters appear, output NONE.
Do NOT add explanations or extra text."""


ART_STYLES = {
    "cinematic": (
        "cinematic digital painting, highly detailed, dramatic volumetric lighting, "
        "depth of field, rich color grading, photorealistic textures, "
        "8k render quality, concept art style, atmospheric perspective"
    ),
    "watercolor": (
        "traditional watercolor illustration, soft translucent washes, visible paper texture, "
        "delicate wet-on-wet brushstrokes, gentle color bleeding at edges, "
        "hand-painted look, luminous highlights, muted pastel palette"
    ),
    "comic": (
        "comic book panel art, bold clean ink outlines, vibrant flat colors with cel shading, "
        "dynamic composition, halftone dot texture, strong shadows, "
        "graphic novel style, pop art color palette, action lines"
    ),
    "anime": (
        "anime illustration in Studio Ghibli style, detailed lush backgrounds, "
        "soft cel shading, expressive large eyes, warm natural lighting, "
        "hand-drawn line quality, painterly background layers, nostalgic color palette"
    ),
    "oil": (
        "oil painting on textured canvas, rich impasto brushstrokes, classical composition, "
        "warm golden-hour chiaroscuro lighting, visible palette knife texture, "
        "old master color harmony, deep shadows, luminous glazing technique"
    ),
    "pencil": (
        "detailed graphite pencil sketch on cream paper, fine cross-hatching for shading, "
        "precise line weight variation, realistic proportions, "
        "high contrast black and white, subtle smudge shading, technical illustration quality"
    ),
}


class Illustrator:
    def __init__(self):
        self._character_sheet: str = ""
        self._art_style: str = "cinematic"
        self._accumulated_story: str = ""

    def serialize_state(self) -> dict[str, str]:
        """Return illustrator state as a plain dict for persistence."""
        return {
            "character_sheet": self._character_sheet,
            "accumulated_story": self._accumulated_story,
            "art_style": self._art_style,
        }

    def restore_state(self, state: dict[str, str]) -> None:
        """Restore illustrator state from a persisted dict."""
        self._character_sheet = state.get("character_sheet", "")
        self._accumulated_story = state.get("accumulated_story", "")
        self.art_style = state.get("art_style", "cinematic")

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

        # Build the user prompt - if we already have a sheet, ask for a merge
        if self._character_sheet:
            user_text = (
                f"EXISTING CHARACTER REFERENCE SHEET:\n{self._character_sheet}\n\n"
                f"FULL STORY (including new continuation):\n{story_text}"
            )
        else:
            user_text = story_text

        system_instruction = (
            "You are a character designer for an AI image generator. Read this story and create a "
            "CHARACTER REFERENCE SHEET listing every named character.\n\n"
            "For each character, output exactly one line in this format:\n"
            "NAME: [gender: man/woman/boy/girl], [age: e.g. 8-year-old], "
            "[body: e.g. slim/stocky/tall/petite with height hint], "
            "[skin: specific tone with hex e.g. warm brown #8D5524], "
            "[hair: color with hex + style e.g. jet black #0A0A0A straight shoulder-length], "
            "[face: shape + key features e.g. round face, button nose, large almond-shaped brown #4A2810 eyes, thick eyebrows], "
            "[outfit: detailed clothing with colors e.g. navy blue #1B2A4A hoodie, faded jeans, red #C41E3A sneakers], "
            "[signature items: unique accessories/props that identify this character e.g. silver moon pendant, round glasses, wooden walking staff], "
            "[palette: 3-4 dominant hex colors e.g. #1B2A4A, #C41E3A, #0A0A0A]\n\n"
            "CRITICAL RULES:\n"
            "- Include hex color codes for ALL colors (skin, hair, eyes, clothing)\n"
            "- Be VERY specific about gender (man/woman/boy/girl)\n"
            "- Always include at least one signature item or distinguishing feature per character\n"
            "- These descriptions will be passed VERBATIM to an image generator - be precise and visual\n"
            "- If the story implies details, fill them in consistently and inventively\n"
            "- Use concrete visual descriptors, not abstract ones (e.g. 'freckled cheeks' not 'friendly face')\n"
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
                    max_output_tokens=1000,
                ),
            )
            if response.text and "NONE" not in response.text.upper():
                self._character_sheet = response.text.strip()
                logger.info("Character sheet extracted:\n%s", self._character_sheet)
            # On NONE or empty: keep existing sheet (previous characters still exist)
        except Exception as e:
            logger.error("Character extraction failed: %s", e)
            # Keep existing sheet on error rather than clearing it

    async def generate_for_scene(self, scene_text: str) -> tuple[str | None, str | None, int]:
        """Generate an illustration for a scene.

        Uses Gemini to craft an optimal image prompt, then calls Imagen 3.
        Falls back to progressively simpler prompts if safety filter blocks.
        Returns (data_url, error_reason, tier).
        Tier 1 = full prompt with characters, 2 = scene-only, 3 = generic atmospheric.
        """
        # Attempt 1: full detailed prompt with character sheet
        image_prompt = await self._create_image_prompt(scene_text)
        if image_prompt:
            logger.info("Image prompt: %s...", image_prompt[:150])
            data, err = await generate_image(image_prompt)
            if data:
                return data, None, 1
            if err and err != "safety_filter":
                return None, err, 1  # quota/timeout - retrying won't help

        # Attempt 2: simplified scene-only prompt (no characters, just setting + mood)
        safe_prompt = await self._create_safe_prompt(scene_text)
        if safe_prompt:
            logger.info("Fallback safe prompt: %s...", safe_prompt[:150])
            data, err = await generate_image(safe_prompt)
            if data:
                return data, None, 2
            if err and err != "safety_filter":
                return None, err, 2

        # Attempt 3: ultra-generic atmospheric prompt (almost never blocked)
        generic = f"A beautiful atmospheric {self.art_style_suffix} landscape illustration, soft lighting, no text, no people"
        logger.info("Fallback generic prompt: %s", generic)
        data, err = await generate_image(generic)
        return data, err, 3

    async def _create_safe_prompt(self, scene_text: str) -> str | None:
        """Generate a simplified image prompt focused on setting/mood only (no characters)."""
        client = get_client()
        model = get_model()
        try:
            response = await client.aio.models.generate_content(
                model=model,
                contents=types.Content(
                    role="user",
                    parts=[types.Part(text=f"SCENE:\n{scene_text}")],
                ),
                config=types.GenerateContentConfig(
                    system_instruction=(
                        "You are an image prompt engineer. Read this scene and write a SAFE image prompt "
                        "that captures the SETTING and MOOD only. Do NOT include any people, characters, "
                        "faces, or figures. Focus on: landscape, architecture, weather, lighting, objects, "
                        "atmosphere. Do NOT include any art style or rendering instructions. "
                        "Keep it under 60 words. Output only the prompt."
                    ),
                    temperature=0.3,
                    max_output_tokens=150,
                ),
            )
            composition = response.text.strip() if response.text else None
            if not composition:
                return None
            # Always append art style suffix programmatically
            return f"{composition}\n\n{self.art_style_suffix}"
        except Exception as e:
            logger.error("Safe prompt generation failed: %s", e)
            return None

    async def _identify_scene_characters(self, scene_text: str) -> list[str]:
        """Identify which characters from the reference sheet appear in a scene."""
        if not self._character_sheet:
            return []

        # Extract character names from the sheet (lines like "NAME: description")
        char_names = []
        for line in self._character_sheet.strip().splitlines():
            if ":" in line:
                name = line.split(":", 1)[0].strip()
                if name:
                    char_names.append(name)

        if not char_names:
            return []

        client = get_client()
        model = get_model()
        user_input = (
            f"CHARACTER NAMES:\n{chr(10).join(char_names)}\n\n"
            f"SCENE:\n{scene_text}"
        )

        try:
            response = await client.aio.models.generate_content(
                model=model,
                contents=types.Content(
                    role="user",
                    parts=[types.Part(text=user_input)],
                ),
                config=types.GenerateContentConfig(
                    system_instruction=CHARACTER_IDENTIFIER_INSTRUCTION,
                    temperature=0.0,
                    max_output_tokens=50,
                ),
            )
            if not response.text or "NONE" in response.text.upper():
                return []
            names = [n.strip() for n in response.text.strip().splitlines() if n.strip()]
            logger.info("Characters in scene: %s", names)
            return names
        except Exception as e:
            logger.error("Character identification failed: %s", e)
            # Fallback: return all characters so we don't lose descriptions
            return char_names

    def _filter_character_descriptions(self, names: list[str]) -> str:
        """Extract full descriptions for the given character names from the sheet."""
        if not self._character_sheet or not names:
            return ""

        names_lower = {n.lower() for n in names}
        descriptions = []
        for line in self._character_sheet.strip().splitlines():
            if ":" in line:
                name = line.split(":", 1)[0].strip()
                if name.lower() in names_lower:
                    descriptions.append(line.strip())

        return "\n".join(descriptions)

    async def _create_image_prompt(self, scene_text: str) -> str | None:
        """Build a hybrid image prompt: verbatim character descriptions + Gemini scene composition + art style suffix."""
        client = get_client()
        model = get_model()

        # Step 1: Identify which characters appear in this scene
        scene_characters = await self._identify_scene_characters(scene_text)
        char_block = self._filter_character_descriptions(scene_characters)

        # Step 2: Ask Gemini for scene composition only (no character descriptions, no style)
        try:
            response = await client.aio.models.generate_content(
                model=model,
                contents=types.Content(
                    role="user",
                    parts=[types.Part(text=f"SCENE TO ILLUSTRATE:\n{scene_text}")],
                ),
                config=types.GenerateContentConfig(
                    system_instruction=SCENE_COMPOSER_INSTRUCTION,
                    temperature=0.3,
                    max_output_tokens=250,
                ),
            )
            scene_composition = response.text.strip() if response.text else None
        except Exception as e:
            logger.error("Scene composition generation failed: %s", e)
            scene_composition = None

        if not scene_composition:
            return None

        # Step 3: Concatenate character descriptions + scene composition + art style
        # Art style suffix is ALWAYS appended programmatically (never rely on Gemini to include it)
        parts: list[str] = []
        if char_block:
            parts.append(char_block)
            parts.append(
                "IMPORTANT: Render each character EXACTLY as described above - "
                "same colors, same outfit, same signature items. "
                "Do not alter, omit, or reinterpret any character detail."
            )
        parts.append(scene_composition)
        parts.append(self.art_style_suffix)

        return "\n\n".join(parts)
