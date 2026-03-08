"""Portrait service — portraits are now extracted per-scene via face-crop from scene images.

This module is kept for backward compatibility. The generate_portraits function
is a no-op that immediately signals completion.
"""

import logging
from typing import Any

from fastapi import WebSocket

from agents.illustrator import Illustrator

logger = logging.getLogger("storyforge")


async def generate_portraits(
    websocket: WebSocket,
    illustrator: Illustrator,
    story_id: str,
    safe_send=None,
    existing_names: list[str] | None = None,
) -> None:
    """No-op — portraits are now extracted per-scene from scene images via face-crop."""
    if safe_send is None:
        async def safe_send(ws, data):
            try:
                await ws.send_json(data)
            except Exception:
                pass

    await safe_send(websocket, {"type": "portraits_done"})
