"""Template registry — defines story format configurations."""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class TemplateConfig:
    key: str
    label: str
    description: str
    icon: str
    aspect_ratio: str
    scene_word_range: tuple[int, int]
    art_styles: list[str] = field(default_factory=list)
    default_art_style: str = "cinematic"
    style_suffix_override: str | None = None
    visual_narrative: bool = False
    reading_direction: str = "left-to-right"
    available: bool = True


TEMPLATES: dict[str, TemplateConfig] = {
    "storybook": TemplateConfig(
        key="storybook",
        label="Storybook",
        description="Illustrated flipbook with rich scene images",
        icon="book",
        aspect_ratio="16:9",
        scene_word_range=(80, 100),
        art_styles=["cinematic", "watercolor", "comic", "anime", "oil", "pencil"],
        default_art_style="cinematic",
    ),
    "comic": TemplateConfig(
        key="comic",
        label="Comic Book",
        description="Bold panels with dynamic action compositions",
        icon="zap",
        aspect_ratio="3:4",
        scene_word_range=(30, 50),
        art_styles=["classic_comic", "noir_comic", "superhero", "indie_comic"],
        default_art_style="classic_comic",
        style_suffix_override=(
            "bold ink outlines, flat vibrant colors, cel shading, "
            "dynamic composition, strong black shadows, high contrast illustration"
        ),
        visual_narrative=True,
    ),
    "webtoon": TemplateConfig(
        key="webtoon",
        label="Webtoon",
        description="Vertical scroll format with clean digital art",
        icon="smartphone",
        aspect_ratio="3:4",
        scene_word_range=(40, 60),
        art_styles=["romantic_webtoon", "action_webtoon", "slice_of_life", "fantasy_webtoon"],
        default_art_style="romantic_webtoon",
        style_suffix_override=(
            "webtoon art style, clean digital lineart, soft cel shading, "
            "expressive eyes, pastel color palette, manhwa style"
        ),
        visual_narrative=True,
    ),
    "hero": TemplateConfig(
        key="hero",
        label="Hero Quest",
        description="Epic adventure with your photo as the hero",
        icon="shield",
        aspect_ratio="16:9",
        scene_word_range=(80, 100),
        art_styles=["epic_fantasy", "anime", "ghibli"],
        default_art_style="epic_fantasy",
        style_suffix_override=(
            "epic adventure illustration, heroic composition, dramatic camera angles, "
            "grand scale environments, cinematic lighting"
        ),
    ),
    "manga": TemplateConfig(
        key="manga",
        label="Manga",
        description="Japanese manga with dramatic paneling",
        icon="layers",
        aspect_ratio="3:4",
        scene_word_range=(30, 50),
        art_styles=["shonen_manga", "shojo_manga", "seinen_manga", "chibi"],
        default_art_style="shonen_manga",
        style_suffix_override=(
            "Japanese manga illustration, black and white with screentone shading, "
            "expressive eyes, dramatic angles, speed lines"
        ),
        visual_narrative=True,
        reading_direction="right-to-left",
    ),
    "novel": TemplateConfig(
        key="novel",
        label="Novel",
        description="Long-form prose with chapter structure",
        icon="file-text",
        aspect_ratio="16:9",
        scene_word_range=(200, 300),
        art_styles=["cinematic", "watercolor", "oil", "pencil"],
        default_art_style="cinematic",
    ),
    "diary": TemplateConfig(
        key="diary",
        label="Diary",
        description="First-person journal entries with sketches",
        icon="edit-3",
        aspect_ratio="3:4",
        scene_word_range=(80, 120),
        art_styles=["pencil", "journal_sketch", "ink_wash", "watercolor"],
        default_art_style="journal_sketch",
        style_suffix_override=(
            "hand-drawn journal illustration, rough sketch quality, personal and intimate, "
            "visible paper texture, casual inkwork"
        ),
    ),
    "poetry": TemplateConfig(
        key="poetry",
        label="Poetry",
        description="Illustrated verse with atmospheric imagery",
        icon="feather",
        aspect_ratio="1:1",
        scene_word_range=(20, 40),
        art_styles=["watercolor", "impressionist", "ethereal", "minimalist"],
        default_art_style="impressionist",
        style_suffix_override=(
            "poetic atmospheric illustration, dreamlike quality, soft focus, "
            "evocative mood, abstract elements blending into reality"
        ),
    ),
    "photojournal": TemplateConfig(
        key="photojournal",
        label="Photo Journal",
        description="Documentary style with photorealistic scenes",
        icon="camera",
        aspect_ratio="16:9",
        scene_word_range=(60, 80),
        art_styles=["cinematic", "photorealistic", "documentary", "retro_film"],
        default_art_style="photorealistic",
        style_suffix_override=(
            "photorealistic documentary photography, natural lighting, "
            "candid composition, photojournalism style"
        ),
    ),
}


def get_template(key: str) -> TemplateConfig:
    """Return template config by key, defaulting to storybook."""
    return TEMPLATES.get(key, TEMPLATES["storybook"])


def validate_art_style(template_key: str, art_style: str) -> str:
    """Return art_style if valid for template, otherwise template's default."""
    tmpl = get_template(template_key)
    if art_style in tmpl.art_styles:
        return art_style
    return tmpl.default_art_style
