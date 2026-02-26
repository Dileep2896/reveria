"""WebSocket handlers for Director Chat messages."""

import base64
import logging
from typing import Any

from fastapi import WebSocket

from handlers.utils import safe_send as _safe_send
from services.director_chat import DirectorChatSession
from services.director_chat_security import screen_input as _screen_input

logger = logging.getLogger("storyforge")


async def handle_director_chat_start(
    websocket: WebSocket,
    message: dict[str, Any],
    state: Any,  # WsConnectionState
) -> None:
    """Handle director_chat_start message."""
    try:
        # Close any orphaned session before starting a new one
        if state.director_chat:
            try:
                await state.director_chat.close()
            except Exception:
                pass
            state.director_chat = None

        story_ctx = message.get("story_context", "")
        if not story_ctx and state.shared_state and state.shared_state.scenes:
            story_ctx = "\n\n".join(
                s.get("text", "") for s in state.shared_state.scenes if s.get("text")
            )
        if not story_ctx:
            story_ctx = "No story yet \u2014 starting fresh."
        chat_language = message.get("language", state.language_current)
        chat_voice = message.get("voice_name", "Charon")
        state.director_chat = DirectorChatSession()
        
        # Pass hero info to greeting if available
        hero_info = ""
        if state.hero_description:
            hero_name = state.hero_name or "the user"
            hero_info = (
                f"\n\n[HERO MODE ACTIVE: {hero_name} has uploaded their photo and wants to BE the protagonist. "
                f"Physical appearance: {state.hero_description}. "
                f"When brainstorming, naturally make {hero_name} the main character of the story. "
                f"You can reference their appearance when discussing scenes.]"
            )
            
        result = await state.director_chat.start(
            story_ctx + hero_info, 
            language=chat_language, 
            voice_name=chat_voice
        )
        await _safe_send(websocket, {
            "type": "director_chat_started",
            "audio_url": result["audio_url"],
        })
    except Exception as e:
        logger.error("Director chat start failed: %s", e)
        await _safe_send(websocket, {"type": "director_chat_error", "content": "Failed to start Director chat"})


async def handle_director_chat_audio(
    websocket: WebSocket,
    message: dict[str, Any],
    state: Any,  # WsConnectionState
) -> None:
    """Handle director_chat_audio message."""
    if not state.director_chat:
        logger.debug("Ignoring director_chat_audio \u2014 no active session")
        return
    try:
        audio_data = message.get("audio_data", "")
        mime_type = message.get("mime_type", "audio/webm")
        audio_bytes = base64.b64decode(audio_data) if audio_data else b""
        result = await state.director_chat.send_audio(audio_bytes, mime_type)
        # Send native transcripts to frontend
        if result["input_transcript"]:
            await _safe_send(websocket, {"type": "director_chat_user_transcript", "content": result["input_transcript"]})
        await _safe_send(websocket, {
            "type": "director_chat_response",
            "audio_url": result["audio_url"],
        })
        # Handle tool calls (model decided brainstorming is done)
        if result["tool_calls"] and not state.is_generating:
            tc = result["tool_calls"][0]
            prompt = tc.get("args", {}).get("prompt", "").strip()
            if prompt and tc["name"] == "generate_story":
                # Screen the generated prompt before executing
                safe, category = _screen_input(prompt)
                if not safe:
                    logger.warning("Director tool call prompt flagged [%s], rejecting", category)
                    rejection = await state.director_chat.respond_to_tool_call(tc, success=False)
                    if rejection.get("audio_url"):
                        await _safe_send(websocket, {
                            "type": "director_chat_response",
                            "audio_url": rejection["audio_url"],
                        })
                # Guard: reject premature tool calls if not enough brainstorming
                elif not state.director_chat.brainstorming_sufficient:
                    logger.info("Rejected premature generate_story \u2014 not enough brainstorming (msg_count: %d, need: %d)",
                                state.director_chat._msg_count, state.director_chat._MIN_USER_TURNS_BEFORE_GENERATE)
                    rejection = await state.director_chat.respond_to_tool_call(tc, success=False)
                    if rejection.get("audio_url"):
                        await _safe_send(websocket, {
                            "type": "director_chat_response",
                            "audio_url": rejection["audio_url"],
                        })
                else:
                    # Acknowledge the tool call so model can say "Generating!"
                    followup = await state.director_chat.respond_to_tool_call(tc, success=True)
                    if followup["audio_url"]:
                        await _safe_send(websocket, {
                            "type": "director_chat_response",
                            "audio_url": followup["audio_url"],
                        })
                    await _safe_send(websocket, {
                        "type": "director_chat_generate",
                        "prompt": prompt,
                        "art_style": state.art_style_current,
                        "scene_count": state.scene_count_current,
                        "language": state.language_current,
                    })
    except Exception as e:
        logger.error("Director chat audio failed: %s", e)
        await _safe_send(websocket, {"type": "director_chat_error", "content": "Director couldn't process audio"})


async def handle_director_chat_text(
    websocket: WebSocket,
    message: dict[str, Any],
    state: Any,  # WsConnectionState
) -> None:
    """Handle director_chat_text message."""
    if not state.director_chat:
        logger.debug("Ignoring director_chat_text \u2014 no active session")
        return
    try:
        text_content = message.get("content", "").strip()
        if text_content:
            result = await state.director_chat.send_text(text_content)
            await _safe_send(websocket, {
                "type": "director_chat_response",
                "audio_url": result["audio_url"],
            })
            # Handle tool calls (model decided brainstorming is done)
            if result["tool_calls"] and not state.is_generating:
                tc = result["tool_calls"][0]
                prompt = tc.get("args", {}).get("prompt", "").strip()
                if prompt and tc["name"] == "generate_story":
                    # Screen the generated prompt before executing
                    safe, category = _screen_input(prompt)
                    if not safe:
                        logger.warning("Director tool call prompt flagged [%s] (text), rejecting", category)
                        rejection = await state.director_chat.respond_to_tool_call(tc, success=False)
                        if rejection.get("audio_url"):
                            await _safe_send(websocket, {
                                "type": "director_chat_response",
                                "audio_url": rejection["audio_url"],
                            })
                    # Guard: reject premature tool calls if not enough brainstorming
                    elif not state.director_chat.brainstorming_sufficient:
                        logger.info("Rejected premature generate_story (text) \u2014 not enough brainstorming")
                        rejection = await state.director_chat.respond_to_tool_call(tc, success=False)
                        if rejection.get("audio_url"):
                            await _safe_send(websocket, {
                                "type": "director_chat_response",
                                "audio_url": rejection["audio_url"],
                            })
                    else:
                        followup = await state.director_chat.respond_to_tool_call(tc, success=True)
                        if followup["audio_url"]:
                            await _safe_send(websocket, {
                                "type": "director_chat_response",
                                "audio_url": followup["audio_url"],
                            })
                        await _safe_send(websocket, {
                            "type": "director_chat_generate",
                            "prompt": prompt,
                            "art_style": state.art_style_current,
                            "scene_count": state.scene_count_current,
                            "language": state.language_current,
                        })
    except Exception as e:
        logger.error("Director chat text failed: %s", e)
        await _safe_send(websocket, {"type": "director_chat_error", "content": "Director couldn't respond"})


async def handle_director_chat_suggest(
    websocket: WebSocket,
    message: dict[str, Any],
    state: Any,  # WsConnectionState
) -> None:
    """Handle director_chat_suggest message."""
    if not state.director_chat:
        logger.debug("Ignoring director_chat_suggest \u2014 no active session")
        return
    try:
        story_ctx = message.get("story_context", "")
        prompt_text = await state.director_chat.request_suggestion(story_ctx)
        await _safe_send(websocket, {
            "type": "director_chat_suggestion",
            "content": prompt_text or "Couldn't generate a suggestion. Try chatting more first!",
        })
    except Exception as e:
        logger.error("Director chat suggest failed: %s", e)
        await _safe_send(websocket, {"type": "director_chat_error", "content": "Couldn't generate suggestion"})


async def handle_director_chat_end(
    websocket: WebSocket,
    state: Any,  # WsConnectionState
) -> None:
    """Handle director_chat_end message."""
    if state.director_chat:
        await state.director_chat.close()
        state.director_chat = None
    await _safe_send(websocket, {"type": "director_chat_ended"})
