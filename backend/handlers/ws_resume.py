import logging
from typing import Any

from fastapi import WebSocket
from google.genai import types

from agents.narrator import Narrator
from agents.illustrator import Illustrator
from agents.director import Director
from services.firestore_client import load_story

from agents.orchestrator import create_story_orchestrator
from google.adk.sessions import InMemorySessionService  # type: ignore[import-untyped]

logger = logging.getLogger("storyforge")


async def _safe_send(websocket: WebSocket, data: dict[str, Any]) -> bool:
    try:
        await websocket.send_json(data)
        return True
    except Exception:
        return False


async def handle_resume(
    websocket: WebSocket,
    message: dict[str, Any],
    uid: str,
    narrator: Narrator,
    illustrator: Illustrator,
) -> tuple[str | None, int, int]:
    """Handle resume message. Returns (active_story_id, total_scene_count, batch_index)."""
    req_story_id = message.get("story_id")
    active_story_id = None
    total_scene_count = 0
    batch_index = 0

    if req_story_id:
        story_data: dict[str, Any] | None = await load_story(req_story_id, uid)
        if story_data:
            history_entries: list[dict[str, str]] = story_data.get("narrator_history", [])
            narrator.history = [
                types.Content(
                    role=e["role"],
                    parts=[types.Part(text=e["text"])],
                )
                for e in history_entries
            ]
            ill_state: dict[str, str] = story_data.get("illustrator_state", {})
            illustrator.restore_state(ill_state)
            total_scene_count = int(story_data.get("total_scene_count", 0))
            active_story_id = req_story_id
            generations_list: list[Any] = story_data.get("generations", [])
            batch_index = len(generations_list)
            # Send persisted portraits to frontend
            persisted_portraits = story_data.get("portraits", [])
            if persisted_portraits:
                for p in persisted_portraits:
                    await _safe_send(websocket, {
                        "type": "portrait",
                        "name": p.get("name", ""),
                        "image_url": p.get("image_url"),
                    })
                await _safe_send(websocket, {"type": "portraits_done"})
            logger.info("Resumed story %s (scene count: %d)", req_story_id, total_scene_count)
    return active_story_id, total_scene_count, batch_index


async def handle_auto_recover(
    message: dict[str, Any],
    uid: str,
    narrator: Narrator,
    illustrator: Illustrator,
) -> tuple[str | None, int, int]:
    """Auto-recover session for scene actions when active_story_id is None.
    Returns (active_story_id, total_scene_count, batch_index)."""
    req_sid = message.get("story_id")
    if not req_sid:
        return None, 0, 0

    story_data = await load_story(req_sid, uid)
    if not story_data:
        return None, 0, 0

    history_entries = story_data.get("narrator_history", [])
    narrator.history = [
        types.Content(role=e["role"], parts=[types.Part(text=e["text"])])
        for e in history_entries
    ]
    ill_state = story_data.get("illustrator_state", {})
    illustrator.restore_state(ill_state)
    total_scene_count = int(story_data.get("total_scene_count", 0))
    active_story_id = req_sid
    generations_list = story_data.get("generations", [])
    batch_index = len(generations_list)
    logger.info("Auto-resumed story %s for scene action", req_sid)
    return active_story_id, total_scene_count, batch_index


def handle_reset(
    narrator: Narrator,
    illustrator: Illustrator,
    director: Director,
    pipeline_tasks: list,
) -> tuple[Any, Any]:
    """Handle reset message. Returns (orchestrator, shared_state)."""
    narrator.reset()
    new_illustrator = Illustrator()
    new_director = Director()
    for task in pipeline_tasks:
        if not task.done():
            task.cancel()
    orchestrator, shared_state = create_story_orchestrator(narrator, new_illustrator, new_director)
    return orchestrator, shared_state, new_illustrator, new_director
