from pydantic import BaseModel, Field


class Character(BaseModel):
    name: str
    description: str
    visual_description: str = ""
    role: str = ""  # protagonist, antagonist, supporting


class Scene(BaseModel):
    scene_number: int
    text: str
    image_url: str | None = None
    audio_url: str | None = None
    director_notes: str = ""
    tension_level: float = Field(default=0.5, ge=0.0, le=1.0)


class StoryState(BaseModel):
    session_id: str
    genre: str = ""
    style: str = ""
    premise: str = ""
    characters: list[Character] = []
    scenes: list[Scene] = []
    current_scene: int = 0
    narrative_arc: str = "setup"  # setup, rising, climax, falling, resolution
