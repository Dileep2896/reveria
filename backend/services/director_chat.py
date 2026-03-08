"""Director Chat — persistent Gemini Live API session for brainstorming."""

import asyncio
import logging

from google.genai import types
from services.gemini_client import get_client

from services.director_chat_prompts import (
    DIRECTOR_LIVE_MODEL,
    GENERATE_STORY_TOOL,
    build_system_prompt as _build_system_prompt,
    VOICE_PREVIEW_LINES,
    REANCHOR_INTERVAL as _REANCHOR_INTERVAL,
    REANCHOR_TEXT as _REANCHOR_TEXT,
    EMPTY_RESPONSE as _EMPTY_RESPONSE,
    REDIRECT_TRANSCRIPT as _REDIRECT_TRANSCRIPT,
    MAX_LOG_ENTRIES as _MAX_LOG_ENTRIES,
)
from services.director_chat_security import (
    screen_input as _screen_input,
    check_output as _check_output,
)
from services.director_chat_audio import (
    collect_audio as _collect_audio,
    collect_response as _collect_response,
)

logger = logging.getLogger("storyforge.director_chat")


# ---------------------------------------------------------------------------
# Voice preview
# ---------------------------------------------------------------------------


async def generate_voice_preview(voice_name: str) -> str | None:
    """Generate a short voice preview clip using the Gemini Live API."""
    client = get_client()
    preview_text = VOICE_PREVIEW_LINES.get(voice_name, f"Hello, I am {voice_name}, your Director at Reveria.")
    config = {
        "response_modalities": ["AUDIO"],
        "speech_config": {
            "voice_config": {
                "prebuilt_voice_config": {"voice_name": voice_name}
            }
        },
        "system_instruction": "You are a voice preview. Say EXACTLY the text the user sends you, with natural expression. Do not add anything else.",
    }

    try:
        async with client.aio.live.connect(model=DIRECTOR_LIVE_MODEL, config=config) as session:
            content = types.Content(
                role="user",
                parts=[types.Part(text=f"Say this exactly: {preview_text}")],
            )
            await session.send_client_content(turns=content, turn_complete=True)
            audio_url = await asyncio.wait_for(_collect_audio(session), timeout=15.0)
            logger.info("Voice preview generated for %s", voice_name)
            return audio_url
    except Exception as e:
        logger.error("Voice preview failed for %s: %s", voice_name, e)
        return None


# ---------------------------------------------------------------------------
# Director Chat Session
# ---------------------------------------------------------------------------


class DirectorChatSession:
    """Manages a persistent Gemini Live API session for Director chat."""

    def __init__(self):
        self._session = None
        self._cm = None
        self.conversation_log: list[dict] = []
        self.language: str = "English"
        self._msg_count: int = 0  # tracks user messages for re-anchoring
        self._session_lock = asyncio.Lock()  # serializes Live session access

    # ── Lifecycle ──────────────────────────────────────────────────────────

    async def start(
        self,
        story_context: str,
        language: str = "English",
        voice_name: str = "Charon",
        template: str = "storybook",
    ) -> dict:
        """Open a Live session and get the Director's greeting.

        Returns a _collect_response() result dict.
        """
        self.language = language
        client = get_client()
        system_prompt = _build_system_prompt(language, template=template)

        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice_name),
                ),
            ),
            system_instruction=types.Content(
                parts=[types.Part(text=system_prompt)],
            ),
            tools=[types.Tool(function_declarations=[GENERATE_STORY_TOOL])],
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
            context_window_compression=types.ContextWindowCompressionConfig(
                sliding_window=types.SlidingWindow(),
            ),
        )

        try:
            self._cm = client.aio.live.connect(
                model=DIRECTOR_LIVE_MODEL, config=config
            )
            self._session = await self._cm.__aenter__()

            # Send story context + greeting prompt
            lang_instruction = ""
            if language and language.lower() != "english":
                lang_instruction = f" Greet them in {language} since the story is in {language}."
            greeting_prompt = (
                f"Here's the story so far:\n{story_context}\n\n"
                "Greet the writer warmly and briefly (1-2 sentences). "
                "Mention something specific about their story to show you've read it. "
                f"If there's no story yet, welcome them to start brainstorming.{lang_instruction}"
            )
            content = types.Content(
                role="user",
                parts=[types.Part(text=greeting_prompt)],
            )
            await self._session.send_client_content(
                turns=content, turn_complete=True
            )

            result = await _collect_response(self._session, timeout=30.0)
            self.conversation_log.append({
                "role": "system",
                "text": f"[Story context provided]\n{story_context}",
            })
            if result["output_transcript"]:
                self.conversation_log.append({
                    "role": "director",
                    "text": result["output_transcript"],
                })
            logger.info("Director chat session started")
            return result

        except Exception as e:
            logger.error("Failed to start Director chat session: %s", e)
            await self.close()
            return {"audio_url": None, "input_transcript": "", "output_transcript": "", "tool_calls": []}

    # ── Brainstorming guard ──────────────────────────────────────────────

    _MIN_USER_TURNS_BEFORE_GENERATE = 2  # need at least 2 user messages

    @property
    def brainstorming_sufficient(self) -> bool:
        """Check if enough conversation has happened to allow generation.

        Uses _msg_count (incremented on every send_audio/send_text) rather
        than conversation_log which depends on transcription succeeding.
        """
        return self._msg_count >= self._MIN_USER_TURNS_BEFORE_GENERATE

    # ── Re-anchoring ─────────────────────────────────────────────────────

    async def _maybe_reanchor(self) -> None:
        """Periodically inject a safety reminder to counter context compression."""
        self._msg_count += 1
        if self._msg_count % _REANCHOR_INTERVAL == 0 and self._session:
            try:
                anchor = types.Content(
                    role="user",
                    parts=[types.Part(text=_REANCHOR_TEXT)],
                )
                await self._session.send_client_content(
                    turns=anchor, turn_complete=False,
                )
                logger.debug("Director re-anchor injected at message %d", self._msg_count)
            except Exception:
                pass  # non-critical

    # ── Send user input ───────────────────────────────────────────────────

    async def send_audio(self, audio_bytes: bytes, mime_type: str) -> dict:
        """Send user audio to the Live session, return full response dict.

        Audio cannot be pre-screened (no transcript yet), so we post-screen
        both the input transcript and output transcript after the model responds.
        """
        if not self._session:
            return dict(_EMPTY_RESPONSE)

        async with self._session_lock:
            try:
                await self._maybe_reanchor()

                content = types.Content(
                    role="user",
                    parts=[types.Part(
                        inline_data=types.Blob(mime_type=mime_type, data=audio_bytes),
                    )],
                )
                await self._session.send_client_content(
                    turns=content, turn_complete=True
                )
                result = await _collect_response(self._session, timeout=30.0)

                # Post-screen: check input transcript for injection
                safe_in, category = _screen_input(result.get("input_transcript", ""))
                if not safe_in:
                    logger.warning("Director audio input flagged [%s]", category)
                    # Suppress any tool calls triggered by flagged input
                    if result.get("tool_calls"):
                        for tc in result["tool_calls"]:
                            try:
                                await self._reject_tool_call(tc)
                            except Exception:
                                pass
                    return {
                        **_EMPTY_RESPONSE,
                        "input_transcript": result.get("input_transcript", ""),
                        "output_transcript": _REDIRECT_TRANSCRIPT,
                        "tool_calls": [],
                    }

                # Post-screen: check output transcript for character break
                if not _check_output(result.get("output_transcript", "")):
                    if result.get("tool_calls"):
                        for tc in result["tool_calls"]:
                            try:
                                await self._reject_tool_call(tc)
                            except Exception:
                                pass
                    return {
                        **_EMPTY_RESPONSE,
                        "input_transcript": result.get("input_transcript", ""),
                        "output_transcript": _REDIRECT_TRANSCRIPT,
                        "tool_calls": [],
                    }

                # Log transcripts
                if result["input_transcript"]:
                    self.conversation_log.append({"role": "user", "text": result["input_transcript"]})
                if result["output_transcript"]:
                    self.conversation_log.append({"role": "director", "text": result["output_transcript"]})
                self._trim_log()
                return result

            except Exception as e:
                logger.error("Director chat send_audio failed: %s", e)
                self._session = None  # Mark session as dead
                return {**_EMPTY_RESPONSE, "session_dead": True}

    async def send_text(self, text: str) -> dict:
        """Send user text to the Live session, return full response dict.

        Text is pre-screened before reaching the model. If flagged, returns
        an in-character redirect without forwarding to the Live session.
        """
        if not self._session:
            return dict(_EMPTY_RESPONSE)

        # Pre-screen: reject before it reaches the model
        safe, category = _screen_input(text)
        if not safe:
            return {
                **_EMPTY_RESPONSE,
                "input_transcript": text,
                "output_transcript": _REDIRECT_TRANSCRIPT,
            }

        async with self._session_lock:
            try:
                await self._maybe_reanchor()

                content = types.Content(
                    role="user",
                    parts=[types.Part(text=text)],
                )
                await self._session.send_client_content(
                    turns=content, turn_complete=True
                )
                self.conversation_log.append({"role": "user", "text": text})
                result = await _collect_response(self._session, timeout=30.0)

                # Post-screen: check output transcript for character break
                if not _check_output(result.get("output_transcript", "")):
                    return {
                        **_EMPTY_RESPONSE,
                        "input_transcript": text,
                        "output_transcript": _REDIRECT_TRANSCRIPT,
                    }

                if result["output_transcript"]:
                    self.conversation_log.append({"role": "director", "text": result["output_transcript"]})
                self._trim_log()
                return result

            except Exception as e:
                logger.error("Director chat send_text failed: %s", e)
                self._session = None  # Mark session as dead
                return {**_EMPTY_RESPONSE, "session_dead": True}

    # ── Tool call handling ────────────────────────────────────────────────

    async def _reject_tool_call(self, tool_call: dict) -> None:
        """Send a rejection FunctionResponse and consume the model's ack.

        Used internally when screening fails — must be called while already
        holding _session_lock.
        """
        if not self._session:
            return
        func_response = types.FunctionResponse(
            id=tool_call.get("id", ""),
            name=tool_call["name"],
            response={"status": "cancelled", "reason": "Input flagged by safety screening."},
        )
        await self._session.send_tool_response(function_responses=[func_response])
        # Consume the model's acknowledgement
        await _collect_response(self._session, timeout=10.0)

    async def respond_to_tool_call(self, tool_call: dict, success: bool = True) -> dict:
        """Send FunctionResponse back so the model can acknowledge the generation.

        Returns follow-up audio response dict.
        """
        if not self._session:
            return {"audio_url": None, "input_transcript": "", "output_transcript": "", "tool_calls": []}

        async with self._session_lock:
            try:
                func_response = types.FunctionResponse(
                    id=tool_call.get("id", ""),
                    name=tool_call["name"],
                    response={"status": "ok"} if success else {
                        "status": "cancelled",
                        "reason": "Not ready yet. Keep brainstorming with the user \u2014 ask about characters, setting, or conflict before generating.",
                    },
                )
                await self._session.send_tool_response(
                    function_responses=[func_response],
                )
                result = await _collect_response(self._session, timeout=15.0)
                if result["output_transcript"]:
                    self.conversation_log.append({"role": "director", "text": result["output_transcript"]})
                return result
            except Exception as e:
                logger.error("respond_to_tool_call failed: %s", e)
                return {"audio_url": None, "input_transcript": "", "output_transcript": "", "tool_calls": []}

    # ── Suggestion via Live session ───────────────────────────────────────

    async def request_suggestion(self, story_context: str = "") -> str | None:
        """Ask the Live session to summarize brainstorming into a story prompt.

        Used by the manual 'Suggest' button — no extra API call.
        """
        if not self._session:
            return None

        async with self._session_lock:
            try:
                prompt = (
                    "Based on everything we've discussed, write a vivid 2-3 sentence "
                    "story prompt that captures our brainstorming. Output ONLY the prompt text, nothing else. "
                    "Do NOT call the generate_story tool \u2014 just give me the text."
                )
                content = types.Content(
                    role="user",
                    parts=[types.Part(text=prompt)],
                )
                await self._session.send_client_content(
                    turns=content, turn_complete=True
                )
                result = await _collect_response(self._session, timeout=15.0)
                # The suggestion is in the output transcript (audio mode)
                suggestion = result["output_transcript"]
                if suggestion:
                    self.conversation_log.append({"role": "director", "text": f"[Suggested prompt] {suggestion}"})
                    self._trim_log()
                    return suggestion
                return None
            except Exception as e:
                logger.error("request_suggestion failed: %s", e)
                return None

    # ── Proactive commentary during generation ─────────────────────────

    async def proactive_comment(self, scene_text: str, scene_number: int) -> dict:
        """React to a just-completed scene during generation.

        Sends scene text to the Live session so the Director comments
        in-conversation. Does NOT trigger tool calls.
        """
        if not self._session:
            return dict(_EMPTY_RESPONSE)

        async with self._session_lock:
            try:
                prompt = (
                    f"[Scene {scene_number} just finished generating for the story "
                    f"you helped create:]\n\n{scene_text}\n\n"
                    "[React naturally as the Director \u2014 share a brief, vivid reaction "
                    "to this scene (1-2 sentences). Do NOT call generate_story.]"
                )
                content = types.Content(
                    role="user",
                    parts=[types.Part(text=prompt)],
                )
                await self._session.send_client_content(
                    turns=content, turn_complete=True
                )
                result = await _collect_response(self._session, timeout=15.0)

                # Reject any accidental tool calls so the session doesn't get stuck
                if result.get("tool_calls"):
                    for tc in result["tool_calls"]:
                        try:
                            await self._reject_tool_call(tc)
                        except Exception:
                            pass
                    result["tool_calls"] = []

                if result["output_transcript"]:
                    self.conversation_log.append({
                        "role": "director",
                        "text": f"[Scene {scene_number}] {result['output_transcript']}",
                    })
                    self._trim_log()

                return result
            except Exception as e:
                logger.error("proactive_comment failed for scene %d: %s", scene_number, e)
                return dict(_EMPTY_RESPONSE)

    async def generation_wrapup(self, scene_count: int, scene_texts: list[str] | None = None) -> dict:
        """Post-generation wrap-up — Director reacts to scene and invites continuation."""
        if not self._session:
            return dict(_EMPTY_RESPONSE)

        async with self._session_lock:
            try:
                # Include scene text so Director can react specifically
                scene_block = ""
                if scene_texts:
                    scene_block = "\n\nHere's what was just written:\n" + "\n---\n".join(scene_texts) + "\n\n"
                prompt = (
                    f"[The scene just finished generating!{scene_block}"
                    "React to the scene with a brief, vivid comment (1-2 sentences) "
                    "and ask what they'd like to do next — continue the story, change direction, etc. "
                    "Do NOT call generate_story.]"
                )
                content = types.Content(
                    role="user",
                    parts=[types.Part(text=prompt)],
                )
                await self._session.send_client_content(
                    turns=content, turn_complete=True
                )
                result = await _collect_response(self._session, timeout=15.0)

                # Reject any accidental tool calls so the session doesn't get stuck
                if result.get("tool_calls"):
                    for tc in result["tool_calls"]:
                        try:
                            await self._reject_tool_call(tc)
                        except Exception:
                            pass
                    result["tool_calls"] = []

                if result["output_transcript"]:
                    self.conversation_log.append({
                        "role": "director",
                        "text": f"[Wrap-up] {result['output_transcript']}",
                    })
                    self._trim_log()

                return result
            except Exception as e:
                logger.error("generation_wrapup failed: %s", e)
                return dict(_EMPTY_RESPONSE)

    # ── Housekeeping ──────────────────────────────────────────────────────

    def _trim_log(self):
        """Keep system entries + last N messages to prevent unbounded growth."""
        system_entries = [m for m in self.conversation_log if m["role"] == "system"]
        non_system = [m for m in self.conversation_log if m["role"] != "system"]
        if len(non_system) > _MAX_LOG_ENTRIES:
            non_system = non_system[-_MAX_LOG_ENTRIES:]
        self.conversation_log = system_entries + non_system

    async def close(self):
        """Close the Live session."""
        if self._cm:
            try:
                await self._cm.__aexit__(None, None, None)
            except Exception as e:
                logger.debug("Director chat close error (expected): %s", e)
            self._cm = None
            self._session = None
        self.conversation_log = []
        logger.info("Director chat session closed")
