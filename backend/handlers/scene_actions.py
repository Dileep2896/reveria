import asyncio
import logging
import time
from typing import Any

from fastapi import WebSocket
from google.genai import types

from agents.illustrator import Illustrator
from agents.narrator import Narrator
from handlers.utils import safe_send as _safe_send
from services.multi_voice_tts import synthesize_multi_voice
from services.imagen_client import generate_image
from services.storage_client import upload_media
from services.firestore_client import get_db, delete_story
from services.storage_client import delete_story_media
from services.scene_rewrite import rewrite_scene_text as _rewrite_scene_text
from services.usage import check_limit, increment_usage, build_usage_message
from templates.registry import get_template

logger = logging.getLogger("storyforge")


async def handle_regen_image(
    websocket: WebSocket,
    message: dict[str, Any],
    active_story_id: str | None,
    illustrator: Illustrator,
    *,
    uid: str | None = None,
    is_generating: bool = False,
) -> None:
    if is_generating:
        await _safe_send(websocket, {"type": "error", "content": "Cannot regenerate while story is generating"})
        return
    scene_num = int(message.get("scene_number", 0))
    scene_text = message.get("scene_text", "")
    logger.info("regen_image request: scene=%d, text_len=%d, story=%s", scene_num, len(scene_text), active_story_id)

    # Check regen limit
    if uid:
        allowed, reason, _ = await check_limit(uid, "regen")
        if not allowed:
            await _safe_send(websocket, {"type": "error", "content": "Scene regeneration is a Standard/Pro feature - upgrade to unlock"})
            return

    if scene_num and scene_text and active_story_id:
        is_visual_narrative = get_template(illustrator.template).visual_narrative
        try:
            await _safe_send(websocket, {"type": "regen_start", "scene_number": scene_num})

            if is_visual_narrative:
                # Per-panel regeneration for visual narrative templates
                panels = await illustrator.generate_panels(scene_text, uid=uid or "__global__")
                if panels:
                    panel_images = []
                    cache_bust = int(time.time())
                    for i, panel in enumerate(panels):
                        img_data = panel.get("image_data")
                        composition = panel.get("composition", "")
                        if img_data:
                            try:
                                gcs_url = await upload_media(active_story_id, scene_num, "image", img_data, suffix=f"_panel_{i}")
                                url = f"{gcs_url}?v={cache_bust}"
                            except Exception as upload_err:
                                logger.error("regen panel upload failed scene %d panel %d: %s", scene_num, i, upload_err)
                                url = None
                            panel_images.append({"url": url, "composition": composition})
                            if url:
                                await _safe_send(websocket, {
                                    "type": "panel_image", "scene_number": scene_num,
                                    "panel_index": i, "content": url, "composition": composition,
                                })
                        else:
                            panel_images.append({"url": None, "composition": composition})

                    # Update Firestore
                    db = get_db()
                    scene_docs = db.collection("stories").document(active_story_id).collection("scenes")
                    first_url = next((p["url"] for p in panel_images if p["url"]), None)
                    update_data = {"panel_images": panel_images}
                    if first_url:
                        update_data["image_url"] = first_url
                    async for doc_snap in scene_docs.where("scene_number", "==", scene_num).stream():
                        await doc_snap.reference.update(update_data)

                    # Backward-compat image message with first panel
                    if first_url:
                        await _safe_send(websocket, {"type": "image", "content": first_url, "scene_number": scene_num, "tier": 1})
                else:
                    await _safe_send(websocket, {"type": "image_error", "scene_number": scene_num, "reason": "generation_failed"})
            else:
                # Standard single-image regeneration
                image_data, error_reason, tier, _ = await illustrator.generate_for_scene(scene_text)
                if image_data:
                    try:
                        gcs_url = await upload_media(active_story_id, scene_num, "image", image_data)
                        cache_bust_url = f"{gcs_url}?v={int(time.time())}"
                        db = get_db()
                        scene_docs = db.collection("stories").document(active_story_id).collection("scenes")
                        async for doc_snap in scene_docs.where("scene_number", "==", scene_num).stream():
                            await doc_snap.reference.update({"image_url": cache_bust_url})
                        await _safe_send(websocket, {"type": "image", "content": cache_bust_url, "scene_number": scene_num, "tier": tier})
                    except Exception as upload_err:
                        logger.error("regen_image upload failed for scene %d: %s", scene_num, upload_err)
                        await _safe_send(websocket, {"type": "image_error", "scene_number": scene_num, "reason": "upload_failed"})
                else:
                    await _safe_send(websocket, {"type": "image_error", "scene_number": scene_num, "reason": error_reason or "generation_failed"})

            await _safe_send(websocket, {"type": "regen_done", "scene_number": scene_num})
            # Increment regen usage
            if uid:
                try:
                    updated = await increment_usage(uid, "regen")
                    await _safe_send(websocket, build_usage_message(updated))
                except Exception:
                    pass
        except Exception as e:
            logger.error("regen_image error for scene %d: %s", scene_num, e)
            await _safe_send(websocket, {"type": "regen_error", "scene_number": scene_num, "error": str(e)})
    else:
        logger.warning("regen_image skipped - guard failed: scene_num=%s, text=%s, story=%s", scene_num, bool(scene_text), active_story_id)
        await _safe_send(websocket, {"type": "regen_error", "scene_number": scene_num, "error": "Session not ready - please retry"})


async def handle_regen_scene(
    websocket: WebSocket,
    message: dict[str, Any],
    active_story_id: str | None,
    illustrator: Illustrator,
    narrator: Narrator,
    *,
    uid: str | None = None,
    is_generating: bool = False,
) -> None:
    if is_generating:
        await _safe_send(websocket, {"type": "error", "content": "Cannot regenerate while story is generating"})
        return
    scene_num = int(message.get("scene_number", 0))
    scene_text = message.get("scene_text", "")
    all_scenes_data: list[dict[str, Any]] = message.get("all_scenes", [])
    language = message.get("language", "English")
    logger.info("regen_scene request: scene=%d, story=%s, lang=%s", scene_num, active_story_id, language)

    # Check regen limit
    if uid:
        allowed, reason, _ = await check_limit(uid, "regen")
        if not allowed:
            await _safe_send(websocket, {"type": "error", "content": "Scene regeneration is a Standard/Pro feature - upgrade to unlock"})
            return

    if scene_num and scene_text and active_story_id:
        try:
            await _safe_send(websocket, {"type": "regen_start", "scene_number": scene_num})
            new_text = await _rewrite_scene_text(scene_text, scene_num, all_scenes_data, language=language)
            if not new_text:
                await _safe_send(websocket, {"type": "regen_error", "scene_number": scene_num, "error": "Rewrite failed"})
                return

            await _safe_send(websocket, {"type": "text", "content": new_text, "scene_number": scene_num, "is_regen": True})

            img_task = asyncio.create_task(illustrator.generate_for_scene(new_text))
            audio_task = asyncio.create_task(synthesize_multi_voice(
                new_text,
                character_sheet=illustrator._character_sheet,
                language=language,
            ))
            image_result, audio_data = await asyncio.gather(img_task, audio_task, return_exceptions=True)

            db = get_db()
            scene_update: dict[str, Any] = {"text": new_text}

            if not isinstance(image_result, Exception):
                img_data, img_err, img_tier, _ = image_result
                if img_data:
                    try:
                        gcs_url = await upload_media(active_story_id, scene_num, "image", img_data)
                        cache_bust_url = f"{gcs_url}?v={int(time.time())}"
                        scene_update["image_url"] = cache_bust_url
                        await _safe_send(websocket, {"type": "image", "content": cache_bust_url, "scene_number": scene_num, "tier": img_tier})
                    except Exception as upload_err:
                        logger.error("regen_scene image upload failed for scene %d: %s", scene_num, upload_err)
                        await _safe_send(websocket, {"type": "image_error", "scene_number": scene_num, "reason": "upload_failed"})
                else:
                    await _safe_send(websocket, {"type": "image_error", "scene_number": scene_num, "reason": img_err or "generation_failed"})

            if not isinstance(audio_data, Exception) and audio_data:
                audio_data_url, word_ts = audio_data
                if audio_data_url:
                    try:
                        audio_url = await upload_media(active_story_id, scene_num, "audio", audio_data_url)
                        scene_update["audio_url"] = audio_url
                        if word_ts:
                            scene_update["word_timestamps"] = word_ts
                        await _safe_send(websocket, {"type": "audio", "content": audio_url, "scene_number": scene_num})
                    except Exception as upload_err:
                        logger.error("regen_scene audio upload failed for scene %d: %s", scene_num, upload_err)

            scene_docs = db.collection("stories").document(active_story_id).collection("scenes")
            async for doc in scene_docs.where("scene_number", "==", scene_num).stream():
                await doc.reference.update(scene_update)

            narrator.history.append(types.Content(
                role="user",
                parts=[types.Part(text=f"[Scene {scene_num} was rewritten]")],
            ))
            narrator.history.append(types.Content(
                role="model",
                parts=[types.Part(text=new_text)],
            ))

            # Increment regen usage
            if uid:
                try:
                    updated = await increment_usage(uid, "regen")
                    await _safe_send(websocket, build_usage_message(updated))
                except Exception:
                    pass
            await _safe_send(websocket, {"type": "regen_done", "scene_number": scene_num})
        except Exception as e:
            logger.error("regen_scene error for scene %d: %s", scene_num, e)
            await _safe_send(websocket, {"type": "regen_error", "scene_number": scene_num, "error": str(e)})


async def handle_delete_scene(
    websocket: WebSocket,
    message: dict[str, Any],
    active_story_id: str | None,
    uid: str,
    narrator: Narrator,
    illustrator: Illustrator,
    *,
    is_generating: bool = False,
) -> tuple[str | None, int]:
    """Returns (active_story_id, total_scene_count) after deletion."""
    if is_generating:
        await _safe_send(websocket, {"type": "error", "content": "Cannot delete scenes while story is generating"})
        return active_story_id, 0
    scene_num = int(message.get("scene_number", 0))
    logger.info("delete_scene request: scene=%d, story=%s", scene_num, active_story_id)
    ret_story_id = active_story_id
    ret_total = 0
    if scene_num and active_story_id:
        try:
            db = get_db()
            scene_docs = db.collection("stories").document(active_story_id).collection("scenes")
            async for doc in scene_docs.where("scene_number", "==", scene_num).stream():
                await doc.reference.delete()

            await _safe_send(websocket, {"type": "scene_deleted", "scene_number": scene_num})

            remaining = []
            async for _ in scene_docs.limit(1).stream():
                remaining.append(True)

            if not remaining:
                logger.info("All scenes deleted, removing story %s", active_story_id)
                deleted_sid = active_story_id
                await delete_story(active_story_id, uid)
                asyncio.create_task(delete_story_media(active_story_id))
                await _safe_send(websocket, {"type": "story_deleted", "story_id": deleted_sid})
                ret_story_id = None
                narrator.history.clear()
                illustrator.restore_state({})
            else:
                # Update total_scene_count on story doc so Library stays accurate
                remaining_count = 0
                async for _ in scene_docs.select([]).stream():
                    remaining_count += 1
                ret_total = remaining_count
                story_ref = db.collection("stories").document(active_story_id)
                await story_ref.update({"total_scene_count": remaining_count})
                narrator.history.append(types.Content(
                    role="user",
                    parts=[types.Part(text=f"[Scene {scene_num} was removed from the story by the reader]")],
                ))
                narrator.history.append(types.Content(
                    role="model",
                    parts=[types.Part(text=f"Understood. Scene {scene_num} has been removed. I will not reference it in future scenes and will continue the story from the remaining scenes.")],
                ))
                ret_story_id = active_story_id
        except Exception as e:
            logger.error("delete_scene error for scene %d: %s", scene_num, e)
            await _safe_send(websocket, {"type": "error", "content": "Failed to delete scene. Please try again."})
            ret_story_id = active_story_id
            # Preserve whatever scene count we had — don't reset to 0
            ret_total = -1  # signal caller to keep existing count
    return ret_story_id, ret_total
