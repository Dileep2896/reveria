import asyncio
import json
import logging
import os
import re
import time
from typing import Any
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agents.narrator import Narrator
from agents.illustrator import Illustrator
from agents.director import Director
from google.genai import types
from services.tts_client import synthesize_speech
from services.gemini_client import get_client as get_gemini_client, get_model as get_gemini_model, transcribe_audio, ContentBlockedError
from services.auth import verify_token
from services.imagen_client import generate_image, is_quota_available, get_quota_cooldown_remaining
from services.storage_client import upload_media, upload_cover, delete_story_media
from services.firestore_client import persist_story, load_story, delete_story, get_db

from agents.orchestrator import create_story_orchestrator
from google.adk.sessions import InMemorySessionService  # type: ignore[import-untyped]
from google.adk.runners import Runner  # type: ignore[import-untyped]

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s:%(name)s: %(message)s",
)
logger = logging.getLogger("storyforge")
logger.info("ADK orchestration enabled")

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
    return {"status": "ok", "adk": True}


# ---------------------------------------------------------------------------
# Book meta generation (title + cover)
# ---------------------------------------------------------------------------

async def _gen_title(full_text: str) -> str:
    """Generate a short book title (max 4 words) from story text."""
    try:
        client = get_gemini_client()
        model = get_gemini_model()
        response = await client.aio.models.generate_content(
            model=model,
            contents=types.Content(
                role="user",
                parts=[types.Part(text=f"Here is a children's story:\n\n{full_text}\n\nGenerate a book title for this story. Maximum 4 words. Do not use quotes. Output only the title, nothing else.")],
            ),
            config=types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=20,
            ),
        )
        if response.text:
            title = response.text.strip().strip('"\'')
            words = title.split()
            if len(words) > 4:
                title = " ".join(words[:4])
            return title
    except Exception as e:
        logger.error("Title generation failed: %s", e)
    return "Untitled"


async def _gen_cover(full_text: str, art_style: str, story_id: str) -> str | None:
    """Generate a portrait book cover and upload to GCS."""
    from agents.illustrator import ART_STYLES as ILLUSTRATOR_ART_STYLES
    art_style_suffix = ILLUSTRATOR_ART_STYLES.get(art_style, ILLUSTRATOR_ART_STYLES["cinematic"])

    try:
        # Wait for quota cooldown if scene images exhausted it
        cooldown = get_quota_cooldown_remaining()
        if cooldown > 0:
            logger.info("Cover gen waiting %ds for quota cooldown...", cooldown)
            await asyncio.sleep(cooldown + 2)

        client = get_gemini_client()
        model = get_gemini_model()
        response = await client.aio.models.generate_content(
            model=model,
            contents=types.Content(
                role="user",
                parts=[types.Part(text=(
                    f"Here is a story:\n\n{full_text}\n\n"
                    f"Generate a single detailed image prompt for a book cover illustration.\n"
                    f"The cover should capture the essence and key characters of the story.\n"
                    f"The image MUST match this art style: {art_style_suffix}.\n"
                    f"End the prompt with: {art_style_suffix}\n"
                    f"Do NOT include any text, titles, words, or lettering in the image.\n"
                    f"Output only the image prompt, nothing else."
                ))],
            ),
            config=types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=200,
            ),
        )
        cover_prompt = response.text.strip() if response.text else None
        if not cover_prompt:
            return None

        cover_data = None
        for attempt in range(3):
            cover_data, err = await generate_image(cover_prompt, aspect_ratio="3:4")
            if cover_data:
                break
            if err == "safety_filter":
                return None  # terminal — re-prompting won't help
            # Wait for quota cooldown on exhaustion, short delay otherwise
            if err == "quota_exhausted":
                wait = get_quota_cooldown_remaining() + 2
                logger.info("Cover gen retry %d: waiting %ds for quota...", attempt + 1, wait)
                await asyncio.sleep(wait)
            elif attempt < 2:
                await asyncio.sleep(3)
        if not cover_data:
            return None

        cover_url = await upload_cover(story_id, cover_data)
        return cover_url
    except Exception as e:
        logger.error("Cover generation failed: %s", e)
        return None


async def _rewrite_scene_text(
    scene_text: str,
    scene_number: int,
    all_scenes: list[dict[str, Any]],
) -> str | None:
    """Rewrite a single scene using Gemini with full story context."""
    try:
        context_parts = []
        for s in all_scenes:
            num = s.get("scene_number", "?")
            txt = s.get("text", "")
            if txt:
                context_parts.append(f"[Scene {num}]\n{txt}")
        story_context = "\n\n".join(context_parts)

        prompt = (
            f"Here is a children's story so far:\n\n{story_context}\n\n"
            f"Rewrite Scene {scene_number} with a fresh take. Keep the same characters and "
            f"general plot point but use different descriptions and phrasing. "
            f"Write 80-100 words, present tense, third person, plain text only (no markdown, "
            f"no scene markers, no titles). Output only the rewritten scene text."
        )

        client = get_gemini_client()
        model = get_gemini_model()
        response = await client.aio.models.generate_content(
            model=model,
            contents=types.Content(
                role="user",
                parts=[types.Part(text=prompt)],
            ),
            config=types.GenerateContentConfig(
                temperature=0.9,
                max_output_tokens=300,
            ),
        )
        if response.text:
            return response.text.strip()
    except Exception as e:
        logger.error("Scene rewrite failed for scene %d: %s", scene_number, e)
    return None


async def _auto_generate_meta(
    story_id: str,
    scenes: list[dict[str, Any]],
    art_style: str,
    websocket: WebSocket | None = None,
) -> None:
    """Background task: generate title + cover after pipeline run, notify frontend via WS."""
    try:
        scene_texts = [s.get("text", "") for s in scenes if s.get("text")]
        if not scene_texts:
            return

        full_text = "\n\n".join(scene_texts)
        title, cover_url = await asyncio.gather(
            _gen_title(full_text),
            _gen_cover(full_text, art_style, story_id),
        )

        # Fall back to first scene image if cover generation failed
        # Filter out base64 data URLs (can happen if GCS upload failed)
        if not cover_url:
            cover_url = next(
                (s.get("image_url") for s in scenes
                 if s.get("image_url") and not s["image_url"].startswith("data:")),
                None,
            )

        db = get_db()
        doc_ref = db.collection("stories").document(story_id)
        snap = await doc_ref.get()
        if snap.exists and snap.to_dict().get("title_generated"):
            return  # Already done (race guard)

        update: dict[str, Any] = {
            "title": title,
            "title_generated": True,
        }
        if cover_url:
            update["cover_image_url"] = cover_url
        await doc_ref.update(update)
        logger.info("Auto-generated meta for %s: title=%r, cover=%s", story_id, title, bool(cover_url))
        if websocket:
            await _safe_send(websocket, {
                "type": "book_meta",
                "title": title,
                "cover_image_url": update.get("cover_image_url"),
            })
    except Exception as e:
        logger.error("Auto meta generation failed for %s: %s", story_id, e)


class BookMetaRequest(BaseModel):
    scene_texts: list[str]
    art_style: str
    story_id: str


@app.post("/api/generate-book-meta")
async def generate_book_meta(
    body: BookMetaRequest,
    authorization: str = Header(...),
) -> dict[str, Any]:
    # Auth
    token = authorization.removeprefix("Bearer ").strip()
    uid = await verify_token(token)
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid auth token")

    # Verify story ownership before generating (cover uploads to GCS under story_id)
    story_ref = get_db().collection("stories").document(body.story_id)
    snap = await story_ref.get()
    if snap.exists and snap.to_dict().get("uid") != uid:
        raise HTTPException(status_code=403, detail="Not your story")

    full_text = "\n\n".join(body.scene_texts)
    title, cover_url = await asyncio.gather(
        _gen_title(full_text),
        _gen_cover(full_text, body.art_style, body.story_id),
    )

    return {"title": title, "cover_image_url": cover_url}


@app.delete("/api/stories/{story_id}")
async def delete_story_endpoint(
    story_id: str,
    authorization: str = Header(...),
) -> dict[str, Any]:
    """Delete a story: Firestore doc + subcollections + GCS media."""
    token = authorization.removeprefix("Bearer ").strip()
    uid = await verify_token(token)
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid auth token")

    deleted = await delete_story(story_id, uid)
    if not deleted:
        raise HTTPException(status_code=404, detail="Story not found or access denied")

    # Clean up GCS media in background (don't block the response)
    asyncio.create_task(delete_story_media(story_id))

    return {"deleted": True, "story_id": story_id}


async def _safe_send(websocket: WebSocket, data: dict[str, Any]) -> bool:
    """Send JSON to websocket, return False if connection is dead."""
    try:
        await websocket.send_json(data)
        return True
    except Exception:
        return False


def _serialize_narrator_history(narrator: Narrator) -> list[dict[str, str]]:
    """Serialize Narrator history to dicts for Firestore."""
    result: list[dict[str, str]] = []
    for content in narrator.history:
        text: str = ""
        if content.parts:
            text = content.parts[0].text or ""
        role: str = content.role or "user"
        result.append({"role": role, "text": text})
    return result


# ---------------------------------------------------------------------------
# Refusal detection
# ---------------------------------------------------------------------------

_REFUSAL_PATTERNS = [
    "i am programmed to be a harmless",
    "i am unable to generate",
    "i cannot generate",
    "i'm not able to generate",
    "i can't generate content",
    "i cannot create content",
    "i'm unable to create",
    "as an ai language model",
    "as a language model",
    "i cannot write sexually",
    "sexually suggestive",
    "sexually explicit",
    "i cannot produce",
    "i'm designed to be helpful, harmless",
    "i must decline",
    "i cannot fulfill this request",
    "i'm not able to fulfill",
    "would you like me to try generating something different",
    "i cannot assist with",
    "i'm not able to assist with",
    "violates my safety guidelines",
    "against my programming",
    "inappropriate content",
]


def _is_refusal(text: str) -> bool:
    """Detect if text is an AI refusal rather than actual story content."""
    lower = text.lower()
    return any(pattern in lower for pattern in _REFUSAL_PATTERNS)


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
    story_id: str,
) -> tuple[int, list[asyncio.Task[None]], list[dict[str, Any]]]:
    """Run the story pipeline via ADK orchestrator."""

    illustrator.art_style = art_style

    # Configure shared state (mutable object held by all agent instances)
    shared_state.user_input = user_input
    shared_state.art_style = art_style
    shared_state.scene_count = scene_count
    shared_state.total_scene_count = total_scene_count
    shared_state.scenes = []
    shared_state.full_story = ""
    shared_state.story_id = story_id

    refusal_detected = False

    async def ws_callback(data: dict[str, Any]) -> None:
        nonlocal refusal_detected
        if refusal_detected:
            return  # Suppress all further messages after refusal
        if data.get("type") == "text" and _is_refusal(data.get("content", "")):
            refusal_detected = True
            logger.warning("ADK narrator produced refusal text, aborting batch")
            await _safe_send(websocket, {
                "type": "error",
                "content": "Your prompt was blocked by our safety filters. Please try a different story idea.",
            })
            return
        await _safe_send(websocket, data)
    shared_state.ws_callback = ws_callback

    # Create a fresh session for this run
    session = await session_service.create_session(
        app_name="storyforge",
        user_id="user",
    )

    runner = Runner(
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

    # If refusal was detected, return empty — no scenes to persist
    if refusal_detected:
        return total_scene_count, [], [], None

    # Build scenes list with URLs for persistence
    adk_scenes: list[dict[str, Any]] = shared_state.scenes
    scenes_with_urls: list[dict[str, Any]] = []
    for scene_dict in adk_scenes:
        scenes_with_urls.append({
            "scene_number": scene_dict["scene_number"],
            "text": scene_dict["text"],
            "scene_title": scene_dict.get("scene_title"),
            "image_url": scene_dict.get("image_url"),
            "audio_url": scene_dict.get("audio_url"),
            "prompt": user_input,
        })

    return shared_state.total_scene_count, [], scenes_with_urls, shared_state.director_result


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    # Extract token from query params before accepting
    token = websocket.query_params.get("token")
    if not token:
        await websocket.accept()
        await websocket.close(code=4003, reason="Missing auth token")
        return

    uid = await verify_token(token)
    if not uid:
        await websocket.accept()
        await websocket.close(code=4003, reason="Invalid auth token")
        return

    logger.info("Authenticated user: %s", uid)

    await manager.connect(websocket)
    narrator = Narrator()
    illustrator = Illustrator()
    director = Director()

    # ADK orchestrator (created once, reused across requests)
    orchestrator, shared_state = create_story_orchestrator(narrator, illustrator, director)
    session_service = InMemorySessionService()

    # Track cumulative scene count across continuation requests
    total_scene_count = 0
    pipeline_tasks: list[asyncio.Task[None]] = []
    active_story_id: str | None = None
    batch_index = 0
    director_result: dict[str, Any] | None = None

    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                logger.warning("Received malformed JSON, skipping")
                await _safe_send(websocket, {"type": "error", "content": "Malformed message"})
                continue

            # Handle resume — restore state from Firestore
            if message.get("type") == "resume":
                req_story_id = message.get("story_id")
                if req_story_id:
                    story_data: dict[str, Any] | None = await load_story(req_story_id, uid)
                    if story_data:
                        # Restore Narrator history
                        history_entries: list[dict[str, str]] = story_data.get("narrator_history", [])
                        narrator.history = [
                            types.Content(
                                role=e["role"],
                                parts=[types.Part(text=e["text"])],
                            )
                            for e in history_entries
                        ]
                        # Restore Illustrator state
                        ill_state: dict[str, str] = story_data.get("illustrator_state", {})
                        illustrator.restore_state(ill_state)
                        # Restore counters
                        total_scene_count = int(story_data.get("total_scene_count", 0))
                        active_story_id = req_story_id
                        generations_list: list[Any] = story_data.get("generations", [])
                        batch_index = len(generations_list)
                        logger.info("Resumed story %s (scene count: %d)", req_story_id, total_scene_count)
                continue

            # Handle reset
            if message.get("type") == "reset":
                if active_story_id:
                    active_story_id = None
                narrator.reset()
                illustrator = Illustrator()
                director = Director()
                total_scene_count = 0
                batch_index = 0
                director_result = None
                for task in pipeline_tasks:
                    if not task.done():
                        task.cancel()
                pipeline_tasks = []
                # Recreate ADK orchestrator with fresh agents
                orchestrator, shared_state = create_story_orchestrator(narrator, illustrator, director)
                session_service = InMemorySessionService()
                continue

            # Handle voice input — transcribe then feed into pipeline
            if message.get("type") == "voice_input":
                audio_data = message.get("audio_data", "")
                mime_type = message.get("mime_type", "audio/webm")
                if audio_data and len(audio_data) > 1000:  # Skip tiny clips (< ~750 bytes raw)
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

            # ── Per-scene actions (regen image / regen scene / delete) ──
            msg_type = message.get("type")

            # Auto-recover session if story_id is in the message but we have no active story
            if msg_type in ("regen_image", "regen_scene", "delete_scene") and not active_story_id:
                req_sid = message.get("story_id")
                if req_sid:
                    story_data = await load_story(req_sid, uid)
                    if story_data:
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

            if msg_type == "regen_image":
                scene_num = int(message.get("scene_number", 0))
                scene_text = message.get("scene_text", "")
                logger.info("regen_image request: scene=%d, text_len=%d, story=%s", scene_num, len(scene_text), active_story_id)
                if scene_num and scene_text and active_story_id:
                    try:
                        await _safe_send(websocket, {"type": "regen_start", "scene_number": scene_num})
                        image_data, error_reason, tier = await illustrator.generate_for_scene(scene_text)
                        if image_data:
                            gcs_url = await upload_media(active_story_id, scene_num, "image", image_data)
                            # Cache-bust: append timestamp so browser fetches new image
                            cache_bust_url = f"{gcs_url}?v={int(time.time())}"
                            # Update Firestore scene doc
                            db = get_db()
                            scene_docs = db.collection("stories").document(active_story_id).collection("scenes")
                            async for doc_snap in scene_docs.where("scene_number", "==", scene_num).stream():
                                await doc_snap.reference.update({"image_url": cache_bust_url})
                            await _safe_send(websocket, {"type": "image", "content": cache_bust_url, "scene_number": scene_num, "tier": tier})
                        else:
                            await _safe_send(websocket, {"type": "image_error", "scene_number": scene_num, "reason": error_reason or "generation_failed"})
                        await _safe_send(websocket, {"type": "regen_done", "scene_number": scene_num})
                    except Exception as e:
                        logger.error("regen_image error for scene %d: %s", scene_num, e)
                        await _safe_send(websocket, {"type": "regen_error", "scene_number": scene_num, "error": str(e)})
                else:
                    logger.warning("regen_image skipped — guard failed: scene_num=%s, text=%s, story=%s", scene_num, bool(scene_text), active_story_id)
                    await _safe_send(websocket, {"type": "regen_error", "scene_number": scene_num, "error": "Session not ready — please retry"})
                continue

            if msg_type == "regen_scene":
                scene_num = int(message.get("scene_number", 0))
                scene_text = message.get("scene_text", "")
                all_scenes_data: list[dict[str, Any]] = message.get("all_scenes", [])
                logger.info("regen_scene request: scene=%d, story=%s", scene_num, active_story_id)
                if scene_num and scene_text and active_story_id:
                    try:
                        await _safe_send(websocket, {"type": "regen_start", "scene_number": scene_num})
                        new_text = await _rewrite_scene_text(scene_text, scene_num, all_scenes_data)
                        if not new_text:
                            await _safe_send(websocket, {"type": "regen_error", "scene_number": scene_num, "error": "Rewrite failed"})
                            continue

                        # Send new text immediately
                        await _safe_send(websocket, {"type": "text", "content": new_text, "scene_number": scene_num, "is_regen": True})

                        # Generate image + audio in parallel
                        img_task = asyncio.create_task(illustrator.generate_for_scene(new_text))
                        audio_task = asyncio.create_task(synthesize_speech(new_text))
                        image_result, audio_data = await asyncio.gather(img_task, audio_task, return_exceptions=True)

                        db = get_db()
                        scene_update: dict[str, Any] = {"text": new_text}

                        # Handle image
                        if not isinstance(image_result, Exception):
                            img_data, img_err, img_tier = image_result
                            if img_data:
                                gcs_url = await upload_media(active_story_id, scene_num, "image", img_data)
                                cache_bust_url = f"{gcs_url}?v={int(time.time())}"
                                scene_update["image_url"] = cache_bust_url
                                await _safe_send(websocket, {"type": "image", "content": cache_bust_url, "scene_number": scene_num, "tier": img_tier})
                            else:
                                await _safe_send(websocket, {"type": "image_error", "scene_number": scene_num, "reason": img_err or "generation_failed"})

                        # Handle audio
                        if not isinstance(audio_data, Exception) and audio_data:
                            audio_url = await upload_media(active_story_id, scene_num, "audio", audio_data)
                            scene_update["audio_url"] = audio_url
                            await _safe_send(websocket, {"type": "audio", "content": audio_url, "scene_number": scene_num})

                        # Update Firestore scene doc
                        scene_docs = db.collection("stories").document(active_story_id).collection("scenes")
                        async for doc in scene_docs.where("scene_number", "==", scene_num).stream():
                            await doc.reference.update(scene_update)

                        # Append synthetic narrator history for coherence
                        narrator.history.append(types.Content(
                            role="user",
                            parts=[types.Part(text=f"[Scene {scene_num} was rewritten]")],
                        ))
                        narrator.history.append(types.Content(
                            role="model",
                            parts=[types.Part(text=new_text)],
                        ))

                        await _safe_send(websocket, {"type": "regen_done", "scene_number": scene_num})
                    except Exception as e:
                        logger.error("regen_scene error for scene %d: %s", scene_num, e)
                        await _safe_send(websocket, {"type": "regen_error", "scene_number": scene_num, "error": str(e)})
                continue

            if msg_type == "delete_scene":
                scene_num = int(message.get("scene_number", 0))
                logger.info("delete_scene request: scene=%d, story=%s", scene_num, active_story_id)
                if scene_num and active_story_id:
                    try:
                        db = get_db()
                        scene_docs = db.collection("stories").document(active_story_id).collection("scenes")
                        async for doc in scene_docs.where("scene_number", "==", scene_num).stream():
                            await doc.reference.delete()
                        # total_scene_count kept as high-water mark — no decrement
                        # so new scenes always get unique, non-colliding numbers

                        # Inform narrator about the deletion for story coherence
                        narrator.history.append(types.Content(
                            role="user",
                            parts=[types.Part(text=f"[Scene {scene_num} was removed from the story by the reader]")],
                        ))
                        narrator.history.append(types.Content(
                            role="model",
                            parts=[types.Part(text=f"Understood. Scene {scene_num} has been removed. I will not reference it in future scenes and will continue the story from the remaining scenes.")],
                        ))

                        await _safe_send(websocket, {"type": "scene_deleted", "scene_number": scene_num})
                    except Exception as e:
                        logger.error("delete_scene error for scene %d: %s", scene_num, e)
                        await _safe_send(websocket, {"type": "regen_error", "scene_number": scene_num, "error": str(e)})
                continue

            user_input = message.get("content", "")

            if not user_input:
                continue

            # Parse user options
            art_style = message.get("art_style", "cinematic")
            scene_count = max(1, min(2, int(message.get("scene_count", 2))))

            # Generate story_id on first pipeline run
            if not active_story_id:
                active_story_id = f"{uid}_{int(time.time())}"
                await _safe_send(websocket, {"type": "story_id", "content": active_story_id})

            # Signal that generation is starting
            if not await _safe_send(websocket, {
                "type": "status",
                "content": "generating",
            }):
                continue

            # Check image quota before starting — no point generating text-only stories
            if not is_quota_available():
                remaining = get_quota_cooldown_remaining()
                await _safe_send(websocket, {
                    "type": "quota_exhausted",
                    "retry_after": remaining,
                })
                await _safe_send(websocket, {"type": "status", "content": "done"})
                continue

            pipeline_tasks = []
            current_batch_scenes: list[dict[str, Any]] = []

            try:
                total_scene_count, pipeline_tasks, current_batch_scenes, director_result = await _run_adk_pipeline(
                    websocket, orchestrator, shared_state,
                    session_service, user_input, art_style,
                    scene_count, total_scene_count, illustrator,
                    active_story_id,
                )

                # Filter out scenes where image generation completely failed
                current_batch_scenes = [s for s in current_batch_scenes if not s.get("_image_failed")]

                # Persist to Firestore after pipeline completes
                try:
                    await persist_story(
                        story_id=active_story_id,
                        uid=uid,
                        narrator_history=_serialize_narrator_history(narrator),
                        illustrator_state=illustrator.serialize_state(),
                        total_scene_count=total_scene_count,
                        art_style=art_style,
                        scenes=current_batch_scenes,
                        batch_index=batch_index,
                        user_input=user_input,
                        director_data=director_result,
                    )
                    # Auto-generate title + cover in background (title_generated race guard inside handles dedup)
                    meta_task = asyncio.create_task(
                        _auto_generate_meta(active_story_id, current_batch_scenes, art_style, websocket)
                    )
                    pipeline_tasks.append(meta_task)
                except Exception as e:
                    logger.error("Firestore persist error: %s", e)

                batch_index += 1

            except ContentBlockedError:
                logger.warning("Content blocked by safety filters for user prompt")
                await _safe_send(websocket, {
                    "type": "error",
                    "content": "Your prompt was blocked by our safety filters. Please try a different story idea.",
                })
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
