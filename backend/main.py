import json
from typing import Any
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from agents.narrator import Narrator

load_dotenv()

app = FastAPI(title="StoryForge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_json(self, websocket: WebSocket, data: dict[str, Any]):
        await websocket.send_json(data)


manager = ConnectionManager()

# One narrator per session (will move to per-session dict later)
sessions: dict[str, Narrator] = {}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    narrator = Narrator()

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            user_input = message.get("content", "")

            if not user_input:
                continue

            # Signal that generation is starting
            await manager.send_json(websocket, {
                "type": "status",
                "content": "generating",
            })

            # Stream story text from Narrator
            buffer = ""
            scene_count = 0

            async for chunk in narrator.generate(user_input):
                buffer += chunk

                # Split on [SCENE] markers and send complete scenes
                while "[SCENE]" in buffer:
                    before, _, buffer = buffer.partition("[SCENE]")
                    text = before.strip()
                    if text:
                        scene_count += 1
                        await manager.send_json(websocket, {
                            "type": "text",
                            "content": text,
                            "scene_number": scene_count,
                        })

            # Send any remaining text after the last [SCENE]
            remaining = buffer.strip()
            if remaining:
                scene_count += 1
                await manager.send_json(websocket, {
                    "type": "text",
                    "content": remaining,
                    "scene_number": scene_count,
                })

            # Signal generation complete
            await manager.send_json(websocket, {
                "type": "status",
                "content": "done",
            })

    except WebSocketDisconnect:
        manager.disconnect(websocket)
