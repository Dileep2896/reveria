"""WebSocket connection state — consolidates per-connection variables."""

import asyncio
from dataclasses import dataclass, field
from typing import Any

from agents.narrator import Narrator
from agents.illustrator import Illustrator
from agents.director import Director
from agents.orchestrator import create_story_orchestrator
from services.director_chat import DirectorChatSession

from google.adk.sessions import InMemorySessionService  # type: ignore[import-untyped]


@dataclass
class WsConnectionState:
    """Per-WebSocket connection state."""

    uid: str
    author_name: str
    author_photo_url: str | None

    narrator: Narrator = field(default_factory=Narrator)
    illustrator: Illustrator = field(default_factory=Illustrator)
    director: Director = field(default_factory=Director)
    director_chat: DirectorChatSession | None = None

    total_scene_count: int = 0
    accumulated_scenes: list[dict[str, Any]] = field(default_factory=list)
    pipeline_tasks: list[asyncio.Task[None]] = field(default_factory=list)
    active_story_id: str | None = None
    batch_index: int = 0
    director_result: dict[str, Any] | None = None
    is_generating: bool = False
    art_style_current: str = "cinematic"
    hero_description: str = ""
    hero_name: str = ""
    trend_style: str | None = None
    scene_count_current: int = 1
    language_current: str = "English"
    template_current: str = "storybook"

    # Initialized in __post_init__
    orchestrator: Any = field(default=None, init=False)
    shared_state: Any = field(default=None, init=False)
    session_service: Any = field(default=None, init=False)

    def __post_init__(self):
        self.orchestrator, self.shared_state = create_story_orchestrator(
            self.narrator, self.illustrator, self.director
        )
        self.session_service = InMemorySessionService()
