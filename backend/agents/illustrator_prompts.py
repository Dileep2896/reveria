"""Illustrator prompts and art style constants."""

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

SCENE_COMPOSER_WITH_CHARACTERS_INSTRUCTION = """You are an image prompt engineer. Write a character-focused image prompt.

THE CHARACTER IS THE SUBJECT. The scene is just background context.

STRUCTURE (follow this order exactly):
1. FRAMING: Start with "Medium shot portrait of" or "Close-up portrait of" (ALWAYS include "portrait")
2. CHARACTER: Immediately describe the character's full physical appearance — gender, age, skin tone, hair color+style, eye color, facial features, clothing, accessories. Copy these details EXACTLY from the provided character descriptions. Use natural color words (e.g., "warm brown skin", "jet-black hair"), NOT hex codes.
3. ACTION: What the character is doing (pose, expression, gesture)
4. SETTING: Brief background context (2-3 details max — keep it blurry/secondary)
5. LIGHTING: One lighting detail (e.g., "warm golden sunlight", "dramatic side lighting")

CRITICAL RULES:
- Keep it under 80 words total
- The character description must take up at least HALF the prompt
- Do NOT use hex color codes like #8B4513 — use descriptive color names only
- Do NOT include any character names — describe appearance only
- Do NOT include text, labels, watermarks, art style, or rendering instructions
- For multiple characters: describe each one's appearance, but keep the main character first
- Output ONLY the prompt, nothing else

EXAMPLE:
"Medium shot portrait of a young man with warm brown skin, short jet-black wavy hair, dark brown almond-shaped eyes, wearing a navy blue hoodie and red sneakers with a silver moon pendant around his neck, laughing joyfully while dancing in a sunlit marketplace, colorful market stalls softly blurred behind him, warm golden afternoon light"
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
    "pixar": (
        "3D animated movie style, Pixar-inspired character design, soft subsurface scattering, "
        "vibrant color palette, large expressive eyes, clean high-end CG render, "
        "whimsical atmosphere, detailed micro-textures, cinematic lighting"
    ),
    "ghibli": (
        "traditional hand-painted anime, Studio Ghibli background art, lush nature, "
        "nostalgic atmosphere, soft watercolor-like colors, charming simplicity, "
        "dreamy lighting, hand-drawn character lines, serene mood"
    ),
    "marvel": (
        "modern Marvel comic book art, high-detail dynamic shading, vibrant colors, "
        "strong ink outlines, cinematic action composition, digital comic style, "
        "dramatic lighting, pop-art influences"
    ),
    "cyberpunk": (
        "cyberpunk aesthetic, synthwave neon lighting, rainy night cityscapes, "
        "glowing blue and pink accents, tech-wear fashion, hyper-detailed futuristic "
        "elements, high contrast, misty atmosphere, sleek chrome textures"
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
