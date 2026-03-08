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

VISUAL_NARRATIVE_SCENE_COMPOSER_INSTRUCTION = """You are an image prompt engineer for a visual narrative (comic/manga/webtoon).

FIRST, decide: does this scene have CHARACTERS (people, creatures, robots, etc.) or is it a SETTING-ONLY scene (building, landscape, object, establishing shot)?

═══ IF CHARACTERS ARE PRESENT ═══
Characters are the PRIMARY FOCUS. Follow this structure:
1. CHARACTERS FIRST: Start with the characters. Describe each one with physical traits (skin tone, hair, build, clothing). If CHARACTER DESCRIPTIONS are provided, use those. If not, INVENT vivid specific appearances. Characters must fill at least 60% of the frame.
2. ACTION & EXPRESSION: Poses, gestures, facial expressions, interactions.
3. CAMERA: Medium shot or close-up preferred.
4. ENVIRONMENT: Background — brief, secondary to characters.

Character rules:
- If the scene text mentions a character by name or has dialog, that character MUST appear
- Include FULL physical appearance (skin tone, hair color/style, clothing)
- If no CHARACTER DESCRIPTIONS are provided, INVENT detailed specific appearances

═══ IF SETTING-ONLY (no characters) ═══
Focus on the environment, architecture, or key object:
1. SUBJECT: The building, landscape, object, or location — describe it vividly.
2. ATMOSPHERE: Lighting, weather, time of day, mood.
3. CAMERA: Choose the most dramatic angle — wide establishing shot, low angle for grandeur, etc.
4. DETAILS: Architectural features, textures, colors, surrounding elements.

═══ RULES FOR ALL SCENES ═══
- Keep it under 100 words total
- Do NOT use hex color codes — use descriptive color names only
- Do NOT include any character names — describe appearance only
- ABSOLUTELY NO TEXT IN THE IMAGE: no speech bubbles, no dialog, no captions, no narration boxes, no sound effects, no onomatopoeia, no written words of any kind. The app handles all text overlay separately.
- Do NOT include art style, rendering style, or medium descriptions
- Output ONLY the prompt, nothing else

EXAMPLES:
"A young woman with warm brown skin, short curly dark hair, and a white lab coat leans over a bubbling beaker, expression a mix of excitement and worry. Behind her, a tall stocky robot with brushed chrome plating and glowing blue eye sensors gestures dramatically with one mechanical arm. Medium shot, scattered lab equipment and smoking test tubes, warm amber overhead lighting"

"Towering gothic cathedral at dusk, massive stained glass windows glowing with amber and crimson light from within. Low angle looking up at twin spires piercing a stormy violet sky, gargoyles perched on buttresses, rain-slicked stone steps in foreground, fog rolling through the churchyard, dramatic rim lighting from a hidden moon"
"""

CHARACTER_IDENTIFIER_INSTRUCTION = """Given a scene and a list of character names,
output ONLY the names of characters who physically appear in or are visually
present in this scene, one per line. If no characters appear, output NONE.
Do NOT add explanations or extra text."""

VISUAL_DNA_ANALYSIS_INSTRUCTION = """You are extracting a character's KEY visual traits for an AI image generator.
Write a dense, compact physical description of this character as shown in this portrait.

FOCUS ON (in order of importance):
1. Gender, age, skin tone
2. Hair color and style
3. Eye color and shape
4. Build and distinguishing facial features
5. Clothing (only the most distinctive items)

RULES:
- Maximum 50 words — be terse, every word must count
- Use natural color words (warm brown, pale ivory, deep auburn) — NEVER hex codes
- Describe ONLY what is visible in this image
- Omit lighting, mood, background — physical traits ONLY
- Output ONLY the description, no labels or preamble"""

TEXT_PLACEMENT_INSTRUCTION = """You are a comic book letterer AI. Given an illustration and its narration text,
determine optimal positions for text overlays (narration captions and speech bubbles)
that do NOT cover character faces, hands, or key action.

ANALYZE the image for:
- Low-complexity regions: sky, solid backgrounds, empty corners, floors, walls
- Character face positions (NEVER place text over faces)
- Key action areas to keep clear

OUTPUT a JSON object: {"overlays": [...]}

Each overlay object has these fields:
- "type": "narration" or "dialog"
- "text": the text content (narration: condense to max 12 words; dialog: use exact quoted text)
- "x": left position as percentage (0-100) of image width
- "y": top position as percentage (0-100) of image height
- "width": box width as percentage (20-45) of image width
- "height": box height as percentage (6-14) of image height
- "tail_x": (dialog only) percentage x-position pointing toward the speaker
- "tail_y": (dialog only) percentage y-position pointing toward the speaker

RULES:
- Maximum 1 narration caption + 3 dialog bubbles
- Narration: place at corners or edges (top-left, bottom-right, etc.)
- Dialog: place near the speaker's head, above or beside them
- NEVER cover faces or eyes
- All values are percentages (0-100) of image dimensions
- Width 20-45%, height 6-14%
- Output ONLY valid JSON, nothing else"""


CHARACTER_REGION_INSTRUCTION = """You are a character detection system for an illustrated storybook.
Given an illustration and a list of character names with descriptions, locate each
character in the image and return a bounding box around their HEAD AND UPPER BODY (portrait crop).

OUTPUT FORMAT: A JSON array of objects. Each object has:
- "name": the character's name (string)
- "box": [y_min, x_min, y_max, x_max] in normalized 0-1000 coordinates

COORDINATE SYSTEM:
- Values range from 0 to 1000
- [0, 0, 1000, 1000] = entire image
- y_min = top edge, x_min = left edge, y_max = bottom edge, x_max = right edge

BOUNDING BOX GUIDELINES:
- Include the character's HEAD, SHOULDERS, and upper CHEST (portrait-style crop)
- The box should be generous — better too large than too small
- Include enough context to clearly identify the character (hair, face, clothing)
- For non-human characters (robots, creatures), include their most recognizable upper portion

RULES:
- Only include characters who are clearly visible in the image
- If a character is mostly hidden, turned away, or too small (less than 10% of image), SKIP them
- If no characters are detectable, return an empty array: []
- Output ONLY valid JSON, nothing else

EXAMPLE OUTPUT:
[{"name": "Alice", "box": [50, 300, 500, 600]}, {"name": "Bob", "box": [80, 620, 520, 900]}]
"""

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
        "bold clean ink outlines, vibrant flat colors with cel shading, "
        "dynamic composition, strong black shadows, "
        "pop art color palette, action lines, high contrast illustration"
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
        "modern superhero illustration, high-detail dynamic shading, vibrant colors, "
        "strong ink outlines, cinematic action composition, "
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
    "classic_comic": (
        "bold clean ink outlines, flat vibrant colors, cel shading, "
        "pop art palette, dynamic composition, retro illustration feel, "
        "strong black shadows, high contrast, text-free panel art"
    ),
    "noir_comic": (
        "high-contrast black and white with selective red and yellow accents, "
        "heavy ink shadows, gritty atmosphere, dramatic chiaroscuro lighting, "
        "rain-slicked surfaces, noir detective comic style, text-free panel art"
    ),
    "superhero": (
        "dynamic action poses, saturated bold colors, speed lines, "
        "dramatic foreshortening, heroic proportions, energy effects, "
        "modern superhero illustration, cinematic action composition, text-free panel art"
    ),
    "indie_comic": (
        "hand-drawn imperfect ink lines, muted earthy palette, "
        "watercolor washes over ink outlines, organic textures, "
        "indie graphic novel aesthetic, subtle cross-hatching, intimate compositions, text-free panel art"
    ),
    "romantic_webtoon": (
        "soft pastel palette, sparkle and bokeh effects, beautiful expressive eyes, "
        "dreamy atmosphere, clean digital lineart, soft cel shading, "
        "romance manhwa style, gentle lighting, flower accents, text-free panel art"
    ),
    "action_webtoon": (
        "dynamic poses, bold saturated colors, speed lines, sharp clean lineart, "
        "dramatic camera angles, impact frames, action manhwa style, "
        "glowing energy effects, high contrast lighting, text-free panel art"
    ),
    "slice_of_life": (
        "warm soft colors, gentle natural lighting, cozy atmosphere, "
        "natural expressions, everyday settings, clean digital art, "
        "slice-of-life manhwa style, soft shadows, inviting composition, text-free panel art"
    ),
    "fantasy_webtoon": (
        "ethereal glowing effects, rich jewel-tone colors, ornate magical details, "
        "fantasy manhwa style, luminous particle effects, detailed costumes, "
        "mystical atmosphere, dramatic lighting, intricate backgrounds, text-free panel art"
    ),
    "epic_fantasy": (
        "high fantasy digital painting, sweeping landscapes, dramatic skies, "
        "golden rim lighting, heroic proportions, epic scale, "
        "detailed armor and magical effects"
    ),
    "shonen_manga": (
        "shonen manga, bold dynamic action, speed lines, intense expressions, "
        "high contrast black and white, screentone shading, dramatic angles, text-free panel art"
    ),
    "shojo_manga": (
        "shojo manga, delicate lineart, flower and sparkle accents, "
        "soft screentone, emotional expressions, romantic atmosphere, "
        "elegant compositions, text-free panel art"
    ),
    "seinen_manga": (
        "seinen manga, detailed realistic proportions, heavy crosshatching, "
        "dark atmospheric shading, mature gritty tone, cinematic framing, text-free panel art"
    ),
    "chibi": (
        "chibi manga, super-deformed cute proportions, oversized expressive heads, "
        "simplified bodies, playful pastel colors, comedic poses, text-free panel art"
    ),
    "journal_sketch": (
        "loose pencil journal sketch, rough gestural lines, coffee-stained paper texture, "
        "marginal doodles, personal and imperfect, warm sepia tones"
    ),
    "ink_wash": (
        "East Asian ink wash painting, sumi-e inspired, flowing black ink on rice paper, "
        "minimalist brushstrokes, subtle gray gradients, contemplative mood"
    ),
    "impressionist": (
        "French impressionist painting, visible dappled brushstrokes, soft natural light, "
        "plein air atmosphere, Monet-inspired palette, dreamy landscape quality"
    ),
    "ethereal": (
        "ethereal dreamscape, luminous soft-focus glow, translucent layered forms, "
        "iridescent pastel colors, otherworldly atmosphere, floating light particles"
    ),
    "minimalist": (
        "minimalist illustration, clean sparse composition, large negative space, "
        "single focal element, muted two-tone palette, geometric simplicity"
    ),
    "photorealistic": (
        "ultra-photorealistic photography, sharp focus, natural available light, "
        "shallow depth of field, professional DSLR quality, authentic textures"
    ),
    "documentary": (
        "documentary photojournalism, candid unposed moments, natural harsh lighting, "
        "gritty real-world textures, wide-angle environmental context"
    ),
    "retro_film": (
        "vintage analog film photography, warm film grain, faded color palette, "
        "light leaks, 1970s Kodachrome aesthetic, nostalgic soft contrast"
    ),
}
