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

SCENE_COMPOSER_WITH_CHARACTERS_INSTRUCTION = """You are an image prompt engineer for an illustrated storybook.
Write a scene illustration prompt that tells the STORY MOMENT — what is happening, where, and who is there.

PRIORITIZE THE SCENE'S ACTION AND ENVIRONMENT. Characters appear naturally within the scene, not as isolated portraits.

STRUCTURE (follow this order):
1. SCENE FRAMING: Choose the framing that best tells the story moment — wide shot for environments, medium shot for interactions, over-the-shoulder for reveals. Do NOT default to close-up portraits.
2. ENVIRONMENT & ACTION: Describe what is happening — the key objects, environment details, and action. If the scene is about an email, show the screen. If it's about a chase, show the streets. The story moment comes FIRST.
3. CHARACTERS IN SCENE: Weave character appearance naturally into the scene. Include key physical traits (skin tone, hair, build, clothing) using natural color words, NOT hex codes. Characters should be PART of the scene, not the entire focus.
4. MOOD & LIGHTING: Atmosphere, lighting, weather, time of day.

CRITICAL RULES:
- Keep it under 100 words total
- The scene/environment/action should take up at least HALF the prompt
- Show what the STORY describes — if the text mentions an object, screen, letter, place, vehicle, etc., that object should be prominently visible
- Do NOT use hex color codes like #8B4513 — use descriptive color names only
- Do NOT include any character names — describe appearance only
- Do NOT include text, labels, watermarks, art style, or rendering instructions
- Do NOT make every image a portrait or close-up of a character's face
- Vary your camera angles and compositions across scenes
- Output ONLY the prompt, nothing else

EXAMPLES:
"A glowing laptop screen displays a cryptic email with bold red text in a dimly lit bedroom, a young man with warm brown skin and short curly dark hair leans forward in his desk chair, blue screen light reflecting off his face, cluttered desk with coffee mug and scattered papers, moody blue-tinted ambient lighting"

"Wide shot of a rain-soaked alley at night, neon signs reflecting in puddles, a woman with pale skin and long dark wavy hair in a leather jacket runs toward a flickering doorway, steam rising from a manhole, dramatic side lighting from a streetlamp"
"""

CHARACTER_IDENTIFIER_INSTRUCTION = """Given a scene and a list of character names,
output ONLY the names of characters who physically appear in or are visually
present in this scene, one per line. If no characters appear, output NONE.
Do NOT add explanations or extra text."""

VISUAL_DNA_ANALYSIS_INSTRUCTION = """You are analyzing a character portrait for visual consistency in an illustrated storybook.
Describe the EXACT physical appearance of this character as shown in this image.

Include: face shape, skin tone and complexion, eye color/shape/size, nose and lip shape,
hair color/style/length, approximate age, body build, clothing details with colors,
any accessories or distinctive features.

RULES:
- Be extremely specific — these descriptions will be used to recreate this exact character in future illustrations
- Use natural language color descriptions (warm brown, pale ivory, deep auburn) — NOT hex codes
- Describe ONLY what you see in this image, not what you imagine
- Keep to 100-150 words
- Output ONLY the physical description, no preamble or labels"""


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
