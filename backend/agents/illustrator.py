import json
import logging
import re
from services.gemini_client import get_client, get_model
from services.imagen_client import generate_image
from google.genai import types
from templates.registry import get_template

from agents.illustrator_prompts import (
    SCENE_COMPOSER_INSTRUCTION,
    SCENE_COMPOSER_WITH_CHARACTERS_INSTRUCTION,
    VISUAL_NARRATIVE_COMPOSER_INSTRUCTION,
    VISUAL_NARRATIVE_WITH_CHARACTERS_COMPOSER_INSTRUCTION,
    CHARACTER_IDENTIFIER_INSTRUCTION,
    VISUAL_DNA_ANALYSIS_INSTRUCTION,
    ART_STYLES,
)

logger = logging.getLogger("storyforge.illustrator")


class Illustrator:
    def __init__(self):
        self._character_sheet: str = ""
        self._art_style: str = "cinematic"
        self._template: str = "storybook"
        self._accumulated_story: str = ""
        self._last_scene_composition: str | None = None
        self.hero_description: str = ""
        self.hero_name: str = ""
        self.trend_style: str | None = None
        self._visual_dna: dict[str, str] = {}      # name_lower → vision description
        self._anchor_portraits: list[dict] = []     # [{name, image_url}] for Firestore

    def serialize_state(self) -> dict:
        """Return illustrator state as a plain dict for persistence."""
        return {
            "character_sheet": self._character_sheet,
            "accumulated_story": self._accumulated_story,
            "art_style": self._art_style,
            "template": self._template,
            "hero_description": self.hero_description,
            "hero_name": self.hero_name,
            "trend_style": self.trend_style,
            "visual_dna": self._visual_dna,
            "anchor_portraits": self._anchor_portraits,
        }

    def restore_state(self, state: dict) -> None:
        """Restore illustrator state from a persisted dict."""
        self._character_sheet = state.get("character_sheet", "")
        self._accumulated_story = state.get("accumulated_story", "")
        self.art_style = state.get("art_style", "cinematic")
        self._template = state.get("template", "storybook")
        self.hero_description = state.get("hero_description", "")
        self.hero_name = state.get("hero_name", "")
        self.trend_style = state.get("trend_style")
        self._visual_dna = state.get("visual_dna", {})
        self._anchor_portraits = []  # transient per-batch artifact, not restored

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
    def template(self) -> str:
        return self._template

    @template.setter
    def template(self, value: str) -> None:
        self._template = value

    @property
    def art_style_suffix(self) -> str:
        tmpl = get_template(self._template)
        if tmpl.style_suffix_override:
            per_style = ART_STYLES.get(self._art_style, "")
            return f"{tmpl.style_suffix_override}, {per_style}" if per_style else tmpl.style_suffix_override
        if self.trend_style:
            return ART_STYLES.get(self.trend_style, self.trend_style)
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
            "[skin: vivid natural color e.g. warm brown, pale ivory, deep mahogany], "
            "[hair: natural color + style e.g. jet black straight shoulder-length, deep auburn wavy], "
            "[face: shape + key features e.g. round face, button nose, large almond-shaped dark brown eyes, thick eyebrows], "
            "[outfit: detailed clothing with colors e.g. navy blue hoodie, faded jeans, crimson sneakers], "
            "[signature items: unique accessories/props that identify this character e.g. silver moon pendant, round glasses, wooden walking staff]\n\n"
            "CRITICAL RULES:\n"
            "- Use vivid natural-language color descriptions (e.g. 'deep auburn', 'warm mahogany', 'olive') — NEVER hex codes like #8B4513\n"
            "- Be VERY specific about gender (man/woman/boy/girl)\n"
            "- Always include at least one signature item or distinguishing feature per character\n"
            "- These descriptions will be passed VERBATIM to an image generator - be precise and visual\n"
            "- If the story implies details, fill them in consistently and inventively\n"
            "- Use concrete visual descriptors, not abstract ones (e.g. 'freckled cheeks' not 'friendly face')\n"
        )

        # Inject Hero description if it exists
        hero_desc = self.hero_description
        hero_name = self.hero_name
        if hero_desc:
            name_clause = f" The protagonist's name is '{hero_name}'." if hero_name else ""
            system_instruction += (
                f"\nIMPORTANT: The protagonist of this story is based on the user's photo.{name_clause} "
                f"Their FACE and BODY must always match these physical traits: {hero_desc}. "
                f"Copy these facial/physical features exactly into the protagonist's description. "
                f"However, their CLOTHING and ACCESSORIES should come from the story context, "
                f"NOT from the photo description above — invent an outfit that fits the story's setting and tone."
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


    async def analyze_visual_dna(self, image_data_url: str, character_name: str) -> str | None:
        """Analyze a portrait image with Gemini Vision to extract precise visual description.

        Returns a natural-language description of the character's appearance,
        or None on failure. Best-effort — never crashes the pipeline.
        """
        import base64
        client = get_client()
        model = get_model()
        try:
            # Parse data URL: "data:image/png;base64,..." → bytes + mime
            if "," in image_data_url:
                header, b64_data = image_data_url.split(",", 1)
                mime_type = header.split(":")[1].split(";")[0] if ":" in header else "image/png"
            else:
                b64_data = image_data_url
                mime_type = "image/png"
            image_bytes = base64.b64decode(b64_data)

            response = await client.aio.models.generate_content(
                model=model,
                contents=types.Content(
                    role="user",
                    parts=[
                        types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                        types.Part(text=f"Describe the exact physical appearance of {character_name} as shown in this portrait."),
                    ],
                ),
                config=types.GenerateContentConfig(
                    system_instruction=VISUAL_DNA_ANALYSIS_INSTRUCTION,
                    temperature=0.1,
                    max_output_tokens=100,
                ),
            )
            result = response.text.strip() if response.text else None
            if result:
                logger.info("Visual DNA for %s: %s", character_name, result[:120])
            return result
        except Exception as e:
            logger.warning("Visual DNA analysis failed for %s: %s", character_name, e)
            return None

    async def generate_for_scene(self, scene_text: str, uid: str = "__global__") -> tuple[str | None, str | None, int, str | None]:
        """Generate an illustration for a scene.

        Uses Gemini to craft an optimal image prompt, then calls Imagen 3.
        Falls back to progressively simpler prompts if safety filter blocks.
        Returns (data_url, error_reason, tier, scene_composition).
        Tier 1 = full prompt with characters, 2 = scene-only, 3 = generic atmospheric.
        scene_composition is the creative brief text (tier 1 only).
        """
        aspect = get_template(self._template).aspect_ratio

        # Attempt 1: full detailed prompt with character sheet
        image_prompt = await self._create_image_prompt(scene_text)
        if image_prompt:
            logger.info("Image prompt (full): %s", image_prompt)
            data, err = await generate_image(image_prompt, uid=uid, aspect_ratio=aspect)
            if data:
                return data, None, 1, self._last_scene_composition
            if err and err != "safety_filter":
                return None, err, 1, self._last_scene_composition

        # Attempt 2: simplified scene-only prompt (no characters, just setting + mood)
        safe_prompt = await self._create_safe_prompt(scene_text)
        if safe_prompt:
            logger.info("Fallback safe prompt: %s...", safe_prompt[:150])
            data, err = await generate_image(safe_prompt, uid=uid, aspect_ratio=aspect)
            if data:
                return data, None, 2, None
            if err and err != "safety_filter":
                return None, err, 2, None

        # Attempt 3: ultra-generic atmospheric prompt (almost never blocked)
        generic = f"A beautiful atmospheric {self.art_style_suffix} landscape illustration, soft lighting, no text, no people. [NO watermarks, NO distortions]"
        logger.info("Fallback generic prompt: %s", generic)
        data, err = await generate_image(generic, uid=uid, aspect_ratio=aspect)
        return data, err, 3, None

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
            # Always append art style suffix + negative constraints programmatically
            return f"{composition}\n\n{self.art_style_suffix}\n\n[NO text, NO watermarks, NO extra limbs, NO distorted faces]"
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
        """Extract full descriptions for the given character names from the sheet.

        Prefers vision-anchored descriptions (visual DNA) when available,
        falling back to the original structured character sheet line.
        """
        if not self._character_sheet or not names:
            return ""

        names_lower = {n.lower() for n in names}
        descriptions = []
        for line in self._character_sheet.strip().splitlines():
            if ":" in line:
                name = line.split(":", 1)[0].strip()
                if name.lower() in names_lower:
                    # Prefer vision-anchored description if available
                    if name.lower() in self._visual_dna:
                        descriptions.append(f"{name}: {self._visual_dna[name.lower()]}")
                    else:
                        descriptions.append(line.strip())

        return "\n".join(descriptions)

    @staticmethod
    def _strip_hex_codes(text: str) -> str:
        """Remove color codes (hex, rgb, hsl) from text — Imagen can't interpret them."""
        # 6-digit hex (#8B4513), 3-digit hex (#abc)
        text = re.sub(r'\s*#[0-9A-Fa-f]{3,6}\b', '', text)
        # rgb()/rgba()/hsl()/hsla() functional notation
        text = re.sub(r'\s*(?:rgba?|hsla?)\([^)]*\)', '', text)
        return text

    @staticmethod
    def _extract_dialog(scene_text: str, max_bubbles: int = 3) -> list[str]:
        """Extract quoted dialog from scene text for speech bubbles."""
        pattern = r'["\u201c]([^"\u201d]{1,80})["\u201d]'
        matches = re.findall(pattern, scene_text)
        return [m.strip() for m in matches[:max_bubbles] if m.strip()]

    async def _decompose_into_panels(self, scene_text: str) -> list[str]:
        """Decompose a scene into individual panel descriptions using Gemini.

        Returns a list of composition strings (one per panel), or a single-element
        list with a fallback composition on failure.
        """
        client = get_client()
        model = get_model()

        # Identify characters and build description block
        scene_characters = await self._identify_scene_characters(scene_text)
        char_block = self._filter_character_descriptions(scene_characters)

        if char_block:
            clean_chars = self._strip_hex_codes(char_block)
            user_input = (
                f"CHARACTER DESCRIPTIONS:\n{clean_chars}\n\n"
                f"SCENE TO ILLUSTRATE:\n{scene_text}"
            )
            instruction = VISUAL_NARRATIVE_WITH_CHARACTERS_COMPOSER_INSTRUCTION
        else:
            user_input = f"SCENE TO ILLUSTRATE:\n{scene_text}"
            instruction = VISUAL_NARRATIVE_COMPOSER_INSTRUCTION

        try:
            response = await client.aio.models.generate_content(
                model=model,
                contents=types.Content(
                    role="user",
                    parts=[types.Part(text=user_input)],
                ),
                config=types.GenerateContentConfig(
                    system_instruction=instruction,
                    temperature=0.3,
                    max_output_tokens=500,
                    response_mime_type="application/json",
                ),
            )
            raw = response.text.strip() if response.text else ""
            panels = json.loads(raw) if raw else []
            if isinstance(panels, list) and panels:
                # Strip hex codes from each panel
                panels = [self._strip_hex_codes(str(p)) for p in panels]
                logger.info("Decomposed scene into %d panels", len(panels))
                return panels[:3]  # cap at 3
        except (json.JSONDecodeError, Exception) as e:
            logger.warning("Panel decomposition failed (will fallback): %s", e)

        # Fallback: generate a single composition via existing path
        prompt = await self._create_image_prompt(scene_text)
        if prompt:
            return [prompt]
        return []

    async def generate_panels(self, scene_text: str, uid: str = "__global__") -> list[dict]:
        """Generate per-panel images for a visual narrative scene.

        Returns list of {image_data, image_url (None), composition, tier, error_reason} dicts.
        Each panel gets its own Imagen call with full character descriptions.
        """
        panel_compositions = await self._decompose_into_panels(scene_text)
        if not panel_compositions:
            return []

        aspect = "16:9"  # landscape panels stacked vertically
        negative = "[NO text, NO watermarks, NO extra limbs, NO distorted faces, NO blurred features]"

        # Build character block once for all panels
        scene_characters = await self._identify_scene_characters(scene_text)
        char_block = self._filter_character_descriptions(scene_characters)

        results = []
        for composition in panel_compositions:
            # Build final prompt: character anchor + composition + art style + negative
            parts = []
            if char_block:
                clean_chars = self._strip_hex_codes(char_block)
                parts.append(
                    f"CHARACTERS (render EXACTLY as described):\n{clean_chars}"
                )
            parts.append(composition)
            parts.append(self.art_style_suffix)
            parts.append(negative)
            final_prompt = "\n\n".join(parts)

            logger.info("Panel prompt: %s", final_prompt[:200])
            data, err = await generate_image(final_prompt, uid=uid, aspect_ratio=aspect)
            results.append({
                "image_data": data,
                "image_url": None,
                "composition": composition,
                "tier": 1 if data else 0,
                "error_reason": err,
            })

        return results

    async def _create_image_prompt(self, scene_text: str) -> str | None:
        """Build an image prompt with character appearances woven into the scene composition."""
        client = get_client()
        model = get_model()

        is_visual_narrative = get_template(self._template).visual_narrative

        # Step 1: Identify which characters appear in this scene
        scene_characters = await self._identify_scene_characters(scene_text)
        char_block = self._filter_character_descriptions(scene_characters)

        # Step 2: Generate scene composition (use visual narrative instructions when applicable)
        if char_block:
            # Strip hex codes — Imagen uses natural language colors, not hex
            clean_chars = self._strip_hex_codes(char_block)
            user_input = (
                f"CHARACTER DESCRIPTIONS:\n{clean_chars}\n\n"
                f"SCENE TO ILLUSTRATE:\n{scene_text}"
            )
            instruction = (
                VISUAL_NARRATIVE_WITH_CHARACTERS_COMPOSER_INSTRUCTION
                if is_visual_narrative
                else SCENE_COMPOSER_WITH_CHARACTERS_INSTRUCTION
            )
        else:
            user_input = f"SCENE TO ILLUSTRATE:\n{scene_text}"
            instruction = (
                VISUAL_NARRATIVE_COMPOSER_INSTRUCTION
                if is_visual_narrative
                else SCENE_COMPOSER_INSTRUCTION
            )

        try:
            response = await client.aio.models.generate_content(
                model=model,
                contents=types.Content(
                    role="user",
                    parts=[types.Part(text=user_input)],
                ),
                config=types.GenerateContentConfig(
                    system_instruction=instruction,
                    temperature=0.3,
                    max_output_tokens=300 if is_visual_narrative else 200,
                ),
            )
            scene_composition = response.text.strip() if response.text else None
        except Exception as e:
            logger.error("Scene composition generation failed: %s", e)
            scene_composition = None

        self._last_scene_composition = scene_composition

        if not scene_composition:
            return None

        # Strip any hex codes that Gemini may have included in the output
        scene_composition = self._strip_hex_codes(scene_composition)

        # Negative constraints to reduce common AI artifacts
        negative = "[NO text, NO watermarks, NO extra limbs, NO distorted faces, NO blurred features]"

        # Step 3: For visual narratives, prepend character anchor + append page layout framing
        if is_visual_narrative:
            parts = []
            # Prepend character descriptions directly so Imagen sees them
            if char_block:
                clean_chars = self._strip_hex_codes(char_block)
                parts.append(
                    f"CHARACTERS (render EXACTLY as described in every panel):\n{clean_chars}"
                )
            parts.append(scene_composition)
            parts.append(
                "Full comic book page with panel borders and gutters. "
                "Bold expressive comic lettering in speech bubbles. "
                "Every panel must show the SAME characters with IDENTICAL appearance."
            )
            parts.append(self.art_style_suffix)
            parts.append(negative)
            return "\n\n".join(parts)

        # Step 4: Append art style (always programmatic)
        return f"{scene_composition}\n\n{self.art_style_suffix}\n\n{negative}"
