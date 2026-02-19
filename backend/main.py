import asyncio
import json
import logging
from typing import Any
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from agents.narrator import Narrator
from agents.illustrator import Illustrator

load_dotenv()

logger = logging.getLogger("storyforge")

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
        try:
            self.active_connections.remove(websocket)
        except ValueError:
            pass


manager = ConnectionManager()


@app.get("/health")
async def health():
    return {"status": "ok"}


async def _safe_send(websocket: WebSocket, data: dict[str, Any]) -> bool:
    """Send JSON to websocket, return False if connection is dead."""
    try:
        await websocket.send_json(data)
        return True
    except Exception:
        return False


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    narrator = Narrator()
    illustrator = Illustrator()

    # Track cumulative scene count across continuation requests
    total_scene_count = 0
    image_tasks: list[asyncio.Task] = []

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            # Handle reset
            if message.get("type") == "reset":
                narrator.reset()
                illustrator = Illustrator()
                total_scene_count = 0
                for task in image_tasks:
                    if not task.done():
                        task.cancel()
                image_tasks = []
                continue

            user_input = message.get("content", "")

            if not user_input:
                continue

            # Parse user options
            art_style = message.get("art_style", "cinematic")
            scene_count = message.get("scene_count", 2)
            try:
                scene_count = int(scene_count)
                if scene_count not in (2, 4):
                    scene_count = 2
            except (ValueError, TypeError):
                scene_count = 2

            illustrator.art_style = art_style

            # Signal that generation is starting
            if not await _safe_send(websocket, {
                "type": "status",
                "content": "generating",
            }):
                continue  # Connection dead, skip generation

            image_tasks = []
            connection_alive = True

            try:
                # Stream story text from Narrator, collect scenes
                buffer = ""
                scenes: list[dict[str, Any]] = []

                async for chunk in narrator.generate(user_input, scene_count=scene_count):
                    buffer += chunk

                    # Split on [SCENE] markers and send complete scenes
                    while "[SCENE]" in buffer:
                        before, _, buffer = buffer.partition("[SCENE]")
                        text = before.strip()
                        if text:
                            total_scene_count += 1
                            if not await _safe_send(websocket, {
                                "type": "text",
                                "content": text,
                                "scene_number": total_scene_count,
                            }):
                                connection_alive = False
                                break
                            scenes.append({
                                "scene_number": total_scene_count,
                                "text": text,
                            })
                    if not connection_alive:
                        break

                if not connection_alive:
                    continue

                # Send any remaining text
                remaining = buffer.strip()
                if remaining:
                    total_scene_count += 1
                    if not await _safe_send(websocket, {
                        "type": "text",
                        "content": remaining,
                        "scene_number": total_scene_count,
                    }):
                        continue  # Connection dead
                    scenes.append({
                        "scene_number": total_scene_count,
                        "text": remaining,
                    })

                if not scenes:
                    await _safe_send(websocket, {
                        "type": "error",
                        "content": "No scenes were generated. Try a different prompt.",
                    })
                    await _safe_send(websocket, {
                        "type": "status", "content": "done",
                    })
                    continue

                # Extract character sheet from full story BEFORE generating images
                full_story = "\n\n".join(s["text"] for s in scenes)
                await illustrator.extract_characters(full_story)

                # Generate images — send each as it completes
                async def generate_scene_image(scene_num: int, text: str):
                    try:
                        image_url = await illustrator.generate_for_scene(text)
                        if image_url:
                            await _safe_send(websocket, {
                                "type": "image",
                                "content": image_url,
                                "scene_number": scene_num,
                            })
                        else:
                            await _safe_send(websocket, {
                                "type": "image_error",
                                "scene_number": scene_num,
                            })
                    except Exception as e:
                        logger.error("Image generation error for scene %d: %s", scene_num, e)
                        await _safe_send(websocket, {
                            "type": "image_error",
                            "scene_number": scene_num,
                        })

                # Run image generation for all scenes concurrently
                image_tasks = [
                    asyncio.create_task(
                        generate_scene_image(s["scene_number"], s["text"])
                    )
                    for s in scenes
                ]
                await asyncio.gather(*image_tasks, return_exceptions=True)

            except Exception as e:
                logger.error("Pipeline error: %s", e)
                await _safe_send(websocket, {
                    "type": "error",
                    "content": f"Something went wrong: {type(e).__name__}",
                })

            # Signal generation complete (always, even after errors)
            await _safe_send(websocket, {
                "type": "status",
                "content": "done",
            })

    except WebSocketDisconnect:
        logger.debug("Client disconnected")
    except Exception as e:
        logger.error("WebSocket handler error: %s", e)
    finally:
        # Cancel any in-flight image tasks
        for task in image_tasks:
            if not task.done():
                task.cancel()
        manager.disconnect(websocket)
