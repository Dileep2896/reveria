from typing import Any

from fastapi import WebSocket


async def safe_send(websocket: WebSocket, data: dict[str, Any]) -> bool:
    try:
        await websocket.send_json(data)
        return True
    except Exception:
        return False
