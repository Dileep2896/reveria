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

VISUAL_NARRATIVE_COMPOSER_INSTRUCTION = """You are an image prompt engineer for a visual narrative (comic/manga/webtoon).
Decompose the scene into SEPARATE PANEL descriptions. Each panel will be rendered as its own image.

YOU decide the number of panels (1, 2, or 3) based on the story moment:
- 1 PANEL: Single powerful moment, dramatic reveal, or splash page
- 2 PANELS: Action-reaction, before-after, or two-beat exchange
- 3 PANELS: Sequential action, multi-character dialog, or fast pacing

Output a JSON array of panel description strings. Each element describes ONE panel:
- Camera angle, action/pose, environment, mood
- 60-80 words per panel
- Reference characters by name only (e.g., "Kai lunges forward")
- Do NOT describe character appearance (hair, clothes, age, skin, build, etc.)
- Do NOT include art style, rendering style, or medium descriptions
- If the scene has DIALOG, assign each quote to ONE specific panel. NEVER repeat dialog.

Output ONLY the JSON array, nothing else. Example:
["Wide shot of a moonlit rooftop, Kai crouches behind a chimney peering down at the alley below, tension in his posture, cold blue light from the full moon casting long shadows across broken tiles. Speech bubble: 'They're coming.'", "Close-up from low angle, Maya sprints through the narrow alley below, puddles splashing under her boots, neon signs reflecting in the wet cobblestones, urgency and determination in her stride"]
"""

VISUAL_NARRATIVE_WITH_CHARACTERS_COMPOSER_INSTRUCTION = """You are an image prompt engineer for a visual narrative (comic/manga/webtoon).
Decompose the scene into SEPARATE PANEL descriptions. Each panel will be rendered as its own image.

YOU decide the number of panels (1, 2, or 3) based on the story moment:
- 1 PANEL: Single powerful moment, dramatic reveal, or splash page
- 2 PANELS: Action-reaction, before-after, or two-beat exchange
- 3 PANELS: Sequential action, multi-character dialog, or fast pacing

CHARACTER CONSISTENCY IS CRITICAL:
- In EVERY panel where a character appears, include their KEY physical traits (skin tone, hair color/style, build, clothing)
- Use the EXACT SAME description for a character across all panels
- Copy the most distinctive visual features verbatim from the CHARACTER DESCRIPTIONS provided

Output a JSON array of panel description strings. Each element describes ONE panel:
- Camera angle, character poses/expressions with FULL physical appearance details, environment, mood
- 60-80 words per panel — self-contained description
- REPEAT key appearance details (hair, skin, clothing) in EVERY panel a character appears
- Use varied camera angles across panels (wide, close-up, over-shoulder, low angle)
- Do NOT use hex color codes — use descriptive color names only
- Do NOT include any character names — describe appearance only
- Do NOT include art style, rendering style, or medium descriptions
- If the scene has DIALOG, assign each quote to ONE specific panel. NEVER repeat dialog.

Output ONLY the JSON array, nothing else. Example:
["Medium shot of a dimly lit tavern, a tall woman with dark brown skin, long silver braids, and a scarred leather vest slams her fist on a wooden table, candlelight flickering across her fierce expression, tankards rattling. Speech bubble: 'We ride at dawn.'", "Close-up reaction shot, a young man with pale freckled skin, messy red hair, and round glasses stares wide-eyed from across the table, firelight reflecting in his green eyes, mouth slightly open in surprise"]
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
    "classic_comic": (
        "bold clean ink outlines, flat vibrant colors, halftone dot shading, "
        "pop art palette, dynamic panel composition, retro comic book feel, "
        "strong black shadows, Ben-Day dots pattern"
    ),
    "noir_comic": (
        "high-contrast black and white with selective red and yellow accents, "
        "heavy ink shadows, gritty atmosphere, dramatic chiaroscuro lighting, "
        "rain-slicked surfaces, noir detective comic style"
    ),
    "superhero": (
        "dynamic action poses, saturated bold colors, speed lines, "
        "dramatic foreshortening, heroic proportions, energy effects, "
        "modern superhero comic book art, cinematic action composition"
    ),
    "indie_comic": (
        "hand-drawn imperfect ink lines, muted earthy palette, "
        "watercolor washes over ink outlines, organic textures, "
        "indie graphic novel aesthetic, subtle cross-hatching, intimate compositions"
    ),
    "romantic_webtoon": (
        "soft pastel palette, sparkle and bokeh effects, beautiful expressive eyes, "
        "dreamy atmosphere, clean digital lineart, soft cel shading, "
        "romance manhwa style, gentle lighting, flower accents"
    ),
    "action_webtoon": (
        "dynamic poses, bold saturated colors, speed lines, sharp clean lineart, "
        "dramatic camera angles, impact frames, action manhwa style, "
        "glowing energy effects, high contrast lighting"
    ),
    "slice_of_life": (
        "warm soft colors, gentle natural lighting, cozy atmosphere, "
        "natural expressions, everyday settings, clean digital art, "
        "slice-of-life manhwa style, soft shadows, inviting composition"
    ),
    "fantasy_webtoon": (
        "ethereal glowing effects, rich jewel-tone colors, ornate magical details, "
        "fantasy manhwa style, luminous particle effects, detailed costumes, "
        "mystical atmosphere, dramatic lighting, intricate backgrounds"
    ),
    "epic_fantasy": (
        "high fantasy digital painting, sweeping landscapes, dramatic skies, "
        "golden rim lighting, heroic proportions, epic scale, "
        "detailed armor and magical effects"
    ),
    "shonen_manga": (
        "shonen manga, bold dynamic action, speed lines, intense expressions, "
        "high contrast black and white, screentone shading, dramatic angles"
    ),
    "shojo_manga": (
        "shojo manga, delicate lineart, flower and sparkle accents, "
        "soft screentone, emotional expressions, romantic atmosphere, "
        "elegant compositions"
    ),
    "seinen_manga": (
        "seinen manga, detailed realistic proportions, heavy crosshatching, "
        "dark atmospheric shading, mature gritty tone, cinematic framing"
    ),
    "chibi": (
        "chibi manga, super-deformed cute proportions, oversized expressive heads, "
        "simplified bodies, playful pastel colors, comedic poses"
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
