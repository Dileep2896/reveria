"""Shared pipeline state and type aliases for the ADK orchestrator."""

import asyncio
from typing import Any, Callable, Awaitable

# Type alias for the WebSocket send callback
WsCallback = Callable[[dict[str, Any]], Awaitable[None]]


class SharedPipelineState:
    """Mutable state shared across all ADK agents in a single pipeline run."""

    def __init__(self) -> None:
        self.user_input: str = ""
        self.art_style: str = "cinematic"
        self.template: str = "storybook"
        self.scene_count: int = 1
        self.total_scene_count: int = 0
        self.scenes: list[dict[str, Any]] = []
        self.full_story: str = ""
        self.ws_callback: WsCallback | None = None
        self.story_id: str = ""
        self.uid: str = ""
        self.hero_description: str = ""
        self.hero_name: str = ""
        self.trend_style: str | None = None
        self.director_result: dict[str, Any] | None = None
        self.language: str = "English"
        self.steering_queue: asyncio.Queue[str] = asyncio.Queue()
        self.director_suggestion: str = ""
        self.director_live_notes: list[dict[str, Any]] = []
        self._live_notes_lock: asyncio.Lock = asyncio.Lock()
        self.director_chat_session = None  # DirectorChatSession | None
        self.director_enabled: bool = False  # only True for Director-triggered generation
