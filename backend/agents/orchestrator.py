"""ADK-based story pipeline orchestrator.

Wraps existing Narrator, Illustrator, Director, and TTS services into ADK
BaseAgent subclasses and composes them into a SequentialAgent -> ParallelAgent
pipeline.

Pipeline structure:
    StoryOrchestrator (SequentialAgent)
      +-- NarratorADKAgent
      +-- PostNarrationAgent (ParallelAgent)
           +-- IllustratorADKAgent
           +-- DirectorADKAgent
           +-- TTSADKAgent

State is shared between agents via a shared dict reference held on each agent
instance (not via ADK session state, which returns copies).
"""

import asyncio
import logging
from typing import Any, Callable, Awaitable

from google.adk.agents import BaseAgent, SequentialAgent, ParallelAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event

from agents.narrator import Narrator
from agents.illustrator import Illustrator
from agents.director import Director
from services.tts_client import synthesize_speech

logger = logging.getLogger("storyforge.orchestrator")

# Type alias for the WebSocket send callback
WsCallback = Callable[[dict[str, Any]], Awaitable[None]]


class SharedPipelineState:
    """Mutable state shared across all ADK agents in a single pipeline run."""

    def __init__(self) -> None:
        self.user_input: str = ""
        self.art_style: str = "cinematic"
        self.scene_count: int = 2
        self.total_scene_count: int = 0
        self.scenes: list[dict[str, Any]] = []
        self.full_story: str = ""
        self.ws_callback: WsCallback | None = None


class NarratorADKAgent(BaseAgent):
    """Streams story text from Narrator, splits on [SCENE] markers."""

    narrator: Narrator
    shared: SharedPipelineState
    model_config = {"arbitrary_types_allowed": True}

    async def _run_async_impl(self, ctx: InvocationContext) -> Any:
        s = self.shared
        buffer = ""
        scenes: list[dict[str, Any]] = []

        async for chunk in self.narrator.generate(s.user_input, scene_count=s.scene_count):
            buffer += chunk

            while "[SCENE]" in buffer:
                before, _, buffer = buffer.partition("[SCENE]")
                text = before.strip()
                if text:
                    s.total_scene_count += 1
                    if s.ws_callback:
                        await s.ws_callback({
                            "type": "text",
                            "content": text,
                            "scene_number": s.total_scene_count,
                        })
                    scenes.append({
                        "scene_number": s.total_scene_count,
                        "text": text,
                    })

        # Handle remaining text
        remaining = buffer.strip()
        if remaining:
            s.total_scene_count += 1
            if s.ws_callback:
                await s.ws_callback({
                    "type": "text",
                    "content": remaining,
                    "scene_number": s.total_scene_count,
                })
            scenes.append({
                "scene_number": s.total_scene_count,
                "text": remaining,
            })

        # Write back for downstream agents
        s.scenes = scenes
        s.full_story = "\n\n".join(sc["text"] for sc in scenes)

        yield Event(author=self.name)


class IllustratorADKAgent(BaseAgent):
    """Generates images for all scenes concurrently."""

    illustrator: Illustrator
    shared: SharedPipelineState
    model_config = {"arbitrary_types_allowed": True}

    async def _run_async_impl(self, ctx: InvocationContext) -> Any:
        s = self.shared

        if not s.scenes:
            yield Event(author=self.name)
            return

        await self.illustrator.extract_characters(s.full_story)

        async def generate_for_scene(scene_num: int, text: str) -> None:
            try:
                image_url = await self.illustrator.generate_for_scene(text)
                if s.ws_callback:
                    if image_url:
                        await s.ws_callback({
                            "type": "image",
                            "content": image_url,
                            "scene_number": scene_num,
                        })
                    else:
                        await s.ws_callback({
                            "type": "image_error",
                            "scene_number": scene_num,
                        })
            except Exception as e:
                logger.error("Image generation error for scene %d: %s", scene_num, e)
                if s.ws_callback:
                    await s.ws_callback({
                        "type": "image_error",
                        "scene_number": scene_num,
                    })

        await asyncio.gather(
            *(generate_for_scene(sc["scene_number"], sc["text"]) for sc in s.scenes),
            return_exceptions=True,
        )

        yield Event(author=self.name)


class DirectorADKAgent(BaseAgent):
    """Runs creative analysis on the story."""

    director: Director
    shared: SharedPipelineState
    model_config = {"arbitrary_types_allowed": True}

    async def _run_async_impl(self, ctx: InvocationContext) -> Any:
        s = self.shared

        if not s.full_story:
            yield Event(author=self.name)
            return

        try:
            result = await self.director.analyze(
                s.full_story, s.user_input, s.art_style, len(s.scenes)
            )
            if result and s.ws_callback:
                await s.ws_callback({
                    "type": "director",
                    "content": result,
                })
        except Exception as e:
            logger.error("Director error: %s", e)

        yield Event(author=self.name)


class TTSADKAgent(BaseAgent):
    """Generates audio narration for all scenes concurrently."""

    shared: SharedPipelineState
    model_config = {"arbitrary_types_allowed": True}

    async def _run_async_impl(self, ctx: InvocationContext) -> Any:
        s = self.shared

        if not s.scenes:
            yield Event(author=self.name)
            return

        async def generate_audio(scene_num: int, text: str) -> None:
            try:
                audio_url = await synthesize_speech(text)
                if audio_url and s.ws_callback:
                    await s.ws_callback({
                        "type": "audio",
                        "content": audio_url,
                        "scene_number": scene_num,
                    })
            except Exception as e:
                logger.error("TTS error for scene %d: %s", scene_num, e)

        await asyncio.gather(
            *(generate_audio(sc["scene_number"], sc["text"]) for sc in s.scenes),
            return_exceptions=True,
        )

        yield Event(author=self.name)


def create_story_orchestrator(
    narrator: Narrator,
    illustrator: Illustrator,
    director: Director,
) -> tuple[SequentialAgent, SharedPipelineState]:
    """Create the ADK pipeline orchestrator.

    Returns (orchestrator, shared_state). The caller sets fields on
    shared_state before each run.
    """
    shared = SharedPipelineState()

    narrator_agent = NarratorADKAgent(
        name="narrator_agent",
        narrator=narrator,
        shared=shared,
    )

    illustrator_agent = IllustratorADKAgent(
        name="illustrator_agent",
        illustrator=illustrator,
        shared=shared,
    )

    director_agent = DirectorADKAgent(
        name="director_agent",
        director=director,
        shared=shared,
    )

    tts_agent = TTSADKAgent(
        name="tts_agent",
        shared=shared,
    )

    post_narration = ParallelAgent(
        name="post_narration",
        sub_agents=[illustrator_agent, director_agent, tts_agent],
    )

    orchestrator = SequentialAgent(
        name="story_orchestrator",
        sub_agents=[narrator_agent, post_narration],
    )

    return orchestrator, shared
