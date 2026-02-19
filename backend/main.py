import asyncio
import json
import logging
import os
from typing import Any
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from agents.narrator import Narrator
from agents.illustrator import Illustrator
from agents.director import Director
from google.genai import types
from services.tts_client import synthesize_speech
from services.gemini_client import transcribe_audio

# Try to import ADK orchestrator — falls back to manual pipeline if unavailable
_adk_available = False
_create_story_orchestrator: Any = None
_InMemorySessionService: Any = None
_Runner: Any = None

try:
    from agents.orchestrator import create_story_orchestrator as _cso
    from google.adk.sessions import InMemorySessionService as _IMSS  # type: ignore[import-untyped]
    from google.adk.runners import Runner as _R  # type: ignore[import-untyped]
    _create_story_orchestrator = _cso
    _InMemorySessionService = _IMSS
    _Runner = _R
    _adk_available = True
except ImportError:
    pass

load_dotenv()

logger = logging.getLogger("storyforge")

USE_ADK = _adk_available and os.getenv("USE_ADK", "true").lower() == "true"
if USE_ADK:
    logger.info("ADK orchestration enabled")
else:
    logger.info("Using manual pipeline (ADK %s)", "not installed" if not _adk_available else "disabled")

app = FastAPI(title="StoryForge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        try:
            self.active_connections.remove(websocket)
        except ValueError:
            pass


manager = ConnectionManager()


@app.get("/health")
async def health() -> dict[str, Any]:
    return {"status": "ok", "adk": USE_ADK}


async def _safe_send(websocket: WebSocket, data: dict[str, Any]) -> bool:
    """Send JSON to websocket, return False if connection is dead."""
    try:
        await websocket.send_json(data)
        return True
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Manual pipeline (fallback when ADK is not available)
# ---------------------------------------------------------------------------

async def _run_manual_pipeline(
    websocket: WebSocket,
    narrator: Narrator,
    illustrator: Illustrator,
    director: Director,
    user_input: str,
    art_style: str,
    scene_count: int,
    total_scene_count: int,
) -> tuple[int, list[asyncio.Task[None]]]:
    """Run the story pipeline manually. Returns (new_total_scene_count, tasks)."""

    illustrator.art_style = art_style
    all_tasks: list[asyncio.Task[None]] = []
    connection_alive = True

    # Stream story text from Narrator, collect scenes
    buffer = ""
    scenes: list[dict[str, Any]] = []

    async for chunk in narrator.generate(user_input, scene_count=scene_count):
        buffer += chunk

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
        return total_scene_count, all_tasks

    # Send any remaining text
    remaining = buffer.strip()
    if remaining:
        total_scene_count += 1
        if not await _safe_send(websocket, {
            "type": "text",
            "content": remaining,
            "scene_number": total_scene_count,
        }):
            return total_scene_count, all_tasks
        scenes.append({
            "scene_number": total_scene_count,
            "text": remaining,
        })

    if not scenes:
        await _safe_send(websocket, {
            "type": "error",
            "content": "No scenes were generated. Try a different prompt.",
        })
        return total_scene_count, all_tasks

    # Extract character sheet from full story BEFORE generating images
    full_story = "\n\n".join(s["text"] for s in scenes)
    illustrator.accumulate_story(full_story)
    await illustrator.extract_characters(full_story)

    # Image generation per scene
    async def generate_scene_image(scene_num: int, text: str) -> None:
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

    # Audio narration per scene
    async def generate_scene_audio(scene_num: int, text: str) -> None:
        try:
            audio_url = await synthesize_speech(text)
            if audio_url:
                await _safe_send(websocket, {
                    "type": "audio",
                    "content": audio_url,
                    "scene_number": scene_num,
                })
        except Exception as e:
            logger.error("TTS error for scene %d: %s", scene_num, e)

    # Director analysis
    async def run_director_analysis() -> None:
        try:
            result = await director.analyze(
                full_story, user_input, art_style, len(scenes)
            )
            if result:
                await _safe_send(websocket, {
                    "type": "director",
                    "content": result,
                })
        except Exception as e:
            logger.error("Director error: %s", e)

    # Run everything concurrently
    all_tasks = [asyncio.create_task(run_director_analysis())]
    for s in scenes:
        all_tasks.append(asyncio.create_task(
            generate_scene_image(s["scene_number"], s["text"])
        ))
        all_tasks.append(asyncio.create_task(
            generate_scene_audio(s["scene_number"], s["text"])
        ))
    await asyncio.gather(*all_tasks, return_exceptions=True)

    return total_scene_count, all_tasks


# ---------------------------------------------------------------------------
# ADK pipeline
# ---------------------------------------------------------------------------

async def _run_adk_pipeline(
    websocket: WebSocket,
    orchestrator: Any,
    shared_state: Any,
    session_service: Any,
    user_input: str,
    art_style: str,
    scene_count: int,
    total_scene_count: int,
    illustrator: Illustrator,
) -> tuple[int, list[asyncio.Task[None]]]:
    """Run the story pipeline via ADK orchestrator."""

    illustrator.art_style = art_style

    # Configure shared state (mutable object held by all agent instances)
    shared_state.user_input = user_input
    shared_state.art_style = art_style
    shared_state.scene_count = scene_count
    shared_state.total_scene_count = total_scene_count
    shared_state.scenes = []
    shared_state.full_story = ""

    async def ws_callback(data: dict[str, Any]) -> None:
        await _safe_send(websocket, data)
    shared_state.ws_callback = ws_callback

    # Create a fresh session for this run
    session = await session_service.create_session(
        app_name="storyforge",
        user_id="user",
    )

    runner = _Runner(
        agent=orchestrator,
        app_name="storyforge",
        session_service=session_service,
    )

    # Run the orchestrator — ADK requires a non-None new_message to start
    async for _ in runner.run_async(
        user_id="user",
        session_id=session.id,
        new_message=types.Content(
            role="user",
            parts=[types.Part(text=user_input)],
        ),
    ):
        pass  # Events are handled via ws_callback inside each agent

    return shared_state.total_scene_count, []


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    narrator = Narrator()
    illustrator = Illustrator()
    director = Director()

    # ADK orchestrator (created once, reused across requests)
    orchestrator: Any = None
    shared_state: Any = None
    session_service: Any = None
    if USE_ADK:
        try:
            orchestrator, shared_state = _create_story_orchestrator(narrator, illustrator, director)
            session_service = _InMemorySessionService()
        except Exception as e:
            logger.warning("ADK orchestrator creation failed, using manual pipeline: %s", e)
            orchestrator = None

    # Track cumulative scene count across continuation requests
    total_scene_count = 0
    pipeline_tasks: list[asyncio.Task[None]] = []

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            # Handle reset
            if message.get("type") == "reset":
                narrator.reset()
                illustrator = Illustrator()
                director = Director()
                total_scene_count = 0
                for task in pipeline_tasks:
                    if not task.done():
                        task.cancel()
                pipeline_tasks = []
                # Recreate ADK orchestrator with fresh agents
                if USE_ADK:
                    try:
                        orchestrator, shared_state = _create_story_orchestrator(narrator, illustrator, director)
                        session_service = _InMemorySessionService()
                    except Exception:
                        orchestrator = None
                continue

            # Handle voice input — transcribe then feed into pipeline
            if message.get("type") == "voice_input":
                audio_data = message.get("audio_data", "")
                mime_type = message.get("mime_type", "audio/webm")
                if audio_data:
                    transcription = await transcribe_audio(audio_data, mime_type)
                    if transcription:
                        await _safe_send(websocket, {
                            "type": "transcription",
                            "content": transcription,
                        })
                        message = {"content": transcription, "art_style": "cinematic"}
                    else:
                        await _safe_send(websocket, {
                            "type": "error",
                            "content": "Could not transcribe audio. Please try again.",
                        })
                        continue
                else:
                    continue

            user_input = message.get("content", "")

            if not user_input:
                continue

            # Parse user options
            art_style = message.get("art_style", "cinematic")
            scene_count = 2

            # Signal that generation is starting
            if not await _safe_send(websocket, {
                "type": "status",
                "content": "generating",
            }):
                continue

            pipeline_tasks = []

            try:
                if orchestrator and shared_state and session_service:
                    # ADK pipeline
                    total_scene_count, pipeline_tasks = await _run_adk_pipeline(
                        websocket, orchestrator, shared_state,
                        session_service, user_input, art_style,
                        scene_count, total_scene_count, illustrator,
                    )
                else:
                    # Manual pipeline (fallback)
                    total_scene_count, pipeline_tasks = await _run_manual_pipeline(
                        websocket, narrator, illustrator, director,
                        user_input, art_style, scene_count,
                        total_scene_count,
                    )

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
        for task in pipeline_tasks:
            if not task.done():
                task.cancel()
        manager.disconnect(websocket)
