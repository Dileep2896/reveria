"""Gemini Live API integration for conversational story brainstorming."""

import asyncio
import logging
from typing import Any, AsyncGenerator

from google.genai import types
from services.gemini_client import get_client

logger = logging.getLogger("storyforge.live")

LIVE_SYSTEM_PROMPT = """You are a creative story collaborator for StoryForge, an AI-powered
interactive fiction platform. Help the user brainstorm story ideas through conversation.

RULES:
- Be enthusiastic and creative
- Ask clarifying questions about genre, mood, characters, setting
- Help refine vague ideas into compelling story concepts
- Keep responses conversational and concise (2-3 sentences max)
- When the user seems ready and you have a clear story concept, output a 2-3 sentence
  story prompt prefixed with [STORY_PROMPT] on its own line
- The [STORY_PROMPT] should be vivid and specific enough to generate a great opening scene
- Only output [STORY_PROMPT] when the user explicitly says they're ready or you've
  collaboratively built a solid concept

Example:
User: "I want a mystery story"
You: "A mystery! Are you thinking noir detective vibes, or more of a cozy whodunit?
Any particular setting calling to you?"

User: "Noir, set in 1940s Chicago"
You: "Love it - rain-slicked streets, jazz clubs, and danger around every corner.
What kicks off the mystery? A missing person, a stolen artifact, or something darker?"

User: "A jazz singer disappears, let's go with that"
You: [STORY_PROMPT]
A noir detective story in 1940s Chicago. The city's most celebrated jazz singer,
Velma Sinclair, vanishes after her midnight set at The Blue Note club. Her dressing
room is untouched, but a single crimson glove and a cryptic note remain.
"""


class LiveSession:
    """Manages a single Gemini Live API session for voice conversation."""

    def __init__(self):
        self._session = None
        self._ctx = None
        self._client = None
        self._active = False

    async def start(self) -> bool:
        """Initialize the live session. Returns True on success."""
        try:
            self._client = get_client()
            config = types.LiveConnectConfig(
                response_modalities=["TEXT"],
                system_instruction=types.Content(
                    parts=[types.Part(text=LIVE_SYSTEM_PROMPT)]
                ),
            )
            # connect() returns an async context manager, not an awaitable
            self._ctx = self._client.aio.live.connect(
                model="gemini-2.0-flash-live-preview-04-09",
                config=config,
            )
            self._session = await self._ctx.__aenter__()
            self._active = True
            logger.info("Live session started successfully")
            # Send an initial greeting to kick off the conversation
            await self._session.send(
                input=types.LiveClientContent(
                    turns=[types.Content(
                        role="user",
                        parts=[types.Part(text="Hello! I want to brainstorm a story idea.")]
                    )],
                    turn_complete=True,
                )
            )
            logger.info("Sent initial greeting to Live session")
            return True
        except Exception as e:
            logger.error("Failed to start live session: %s", e)
            self._active = False
            return False

    async def send_audio(self, audio_data: bytes, mime_type: str = "audio/pcm") -> None:
        """Send an audio chunk to the live session."""
        if not self._session or not self._active:
            return
        try:
            logger.debug("Sending audio chunk: %d bytes, mime=%s", len(audio_data), mime_type)
            await self._session.send(
                input=types.LiveClientRealtimeInput(
                    media_chunks=[
                        types.Blob(data=audio_data, mime_type=mime_type)
                    ]
                )
            )
        except Exception as e:
            logger.error("Failed to send audio chunk: %s", e)

    async def send_text(self, text: str) -> None:
        """Send a text message to the live session."""
        if not self._session or not self._active:
            return
        try:
            await self._session.send(
                input=types.LiveClientContent(
                    turns=[types.Content(
                        role="user",
                        parts=[types.Part(text=text)]
                    )],
                    turn_complete=True,
                )
            )
        except Exception as e:
            logger.error("Failed to send text: %s", e)

    async def receive_responses(self) -> AsyncGenerator[dict[str, Any], None]:
        """Yield response messages from the live session."""
        if not self._session or not self._active:
            return
        try:
            async for response in self._session.receive():
                if not self._active:
                    break
                logger.info("Live response: %s", type(response).__name__)
                # Extract text from server content
                if hasattr(response, 'server_content') and response.server_content:
                    sc = response.server_content
                    logger.info("server_content: model_turn=%s, turn_complete=%s", sc.model_turn, sc.turn_complete)
                    if sc.model_turn and sc.model_turn.parts:
                        for part in sc.model_turn.parts:
                            if part.text:
                                text = part.text.strip()
                                logger.info("Live text: %s", text[:100])
                                if "[STORY_PROMPT]" in text:
                                    prompt = text.split("[STORY_PROMPT]", 1)[1].strip()
                                    yield {"type": "live_prompt_ready", "prompt": prompt}
                                else:
                                    yield {"type": "live_response", "text": text}
                    if sc.turn_complete:
                        yield {"type": "live_turn_complete"}
                else:
                    # Log unexpected response types for debugging
                    logger.info("Live non-content response: %s", response)
        except Exception as e:
            if self._active:
                logger.error("Live receive error: %s", e)
            yield {"type": "live_error", "error": str(e)}

    async def close(self) -> None:
        """Close the live session."""
        self._active = False
        if self._ctx:
            try:
                await self._ctx.__aexit__(None, None, None)
            except Exception:
                pass
            self._ctx = None
            self._session = None
        logger.info("Live session closed")

    @property
    def is_active(self) -> bool:
        return self._active
