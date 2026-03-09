"""ADK-based story pipeline orchestrator.

Wraps existing Narrator, Illustrator, Director, and TTS services into ADK
BaseAgent subclasses and composes them into a SequentialAgent pipeline.

Pipeline structure:
    StoryOrchestrator (SequentialAgent)
      +-- NarratorADKAgent   (streams scenes; fires image/audio/director per-scene)
      +-- PostNarrationAgent  (ParallelAgent)
           +-- DirectorADKAgent   (full post-batch analysis)

Per-scene pipeline (inside NarratorADKAgent, non-blocking):
    Scene text ready
      ├── asyncio.create_task(generate_image)   ← sequential via semaphore
      ├── asyncio.create_task(generate_audio)
      └── asyncio.create_task(director.analyze_scene)

State is shared between agents via a shared dict reference held on each agent
instance (not via ADK session state, which returns copies).
"""

import logging
from typing import Any

from google.adk.agents import BaseAgent, SequentialAgent, ParallelAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event

from agents.narrator import Narrator
from agents.illustrator import Illustrator
from agents.director import Director
from agents.shared_state import SharedPipelineState
from agents.narrator_agent import NarratorADKAgent

logger = logging.getLogger("storyforge.orchestrator")

# Re-export for backward compatibility
__all__ = ["SharedPipelineState", "NarratorADKAgent", "DirectorADKAgent", "create_story_orchestrator"]


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
            total_scenes = len(s.prior_scenes) + len(s.scenes)
            result = await self.director.analyze(
                s.full_story, s.user_input, s.art_style, total_scenes
            )
            if result:
                s.director_result = result
                if s.ws_callback:
                    await s.ws_callback({
                        "type": "director",
                        "content": result,
                    })
        except Exception as e:
            logger.error("Director error: %s", e)

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
        illustrator=illustrator,
        director=director,
        shared=shared,
    )

    director_agent = DirectorADKAgent(
        name="director_agent",
        director=director,
        shared=shared,
    )

    post_narration = ParallelAgent(
        name="post_narration",
        sub_agents=[director_agent],
    )

    orchestrator = SequentialAgent(
        name="story_orchestrator",
        sub_agents=[narrator_agent, post_narration],
    )

    return orchestrator, shared
