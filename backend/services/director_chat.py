"""Director Chat — persistent Gemini Live API session for brainstorming."""

import asyncio
import logging

from google.genai import types
from services.gemini_client import get_client

from services.director_chat_prompts import (
    DIRECTOR_LIVE_MODEL,
    ALL_TOOLS,
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
    collect_response_streaming as _collect_response_streaming,
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
    """Manages a persistent Gemini Live API session for Director chat.

    Supports automatic reconnection via Gemini Live session resumption tokens.
    When the server resets the connection (GoAway or disconnect), the session
    auto-reconnects using the saved resumption handle, preserving context.
    """

    def __init__(self):
        self._session = None
        self._cm = None
        self.conversation_log: list[dict] = []
        self.language: str = "English"
        self._msg_count: int = 0  # tracks user messages for re-anchoring
        self._session_lock = asyncio.Lock()  # serializes Live session access
        self._closing = False  # prevents double-close race
        self._flag_count: int = 0  # consecutive flagged inputs (rate limiting)
        self._MAX_FLAGS = 5  # close session after this many consecutive flags

        # Session resumption state
        self._resumption_handle: str | None = None  # latest token from server
        self._go_away_received: bool = False  # server warned of impending disconnect
        self._connect_config: types.LiveConnectConfig | None = None  # saved for reconnect
        self._reconnect_attempts: int = 0
        self._MAX_RECONNECT_ATTEMPTS = 3

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
        # Truncate very long story contexts to prevent exceeding API limits
        if len(story_context) > 10_000:
            story_context = story_context[:10_000] + "\n[...truncated]"
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
            tools=[types.Tool(function_declarations=ALL_TOOLS)],
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
            context_window_compression=types.ContextWindowCompressionConfig(
                sliding_window=types.SlidingWindow(),
            ),
            # Server-side VAD: HIGH sensitivity to catch short utterances ("yes", "no")
            # and avoid missing quiet speech. Our client-side VAD pre-filters noise,
            # so server-side can be permissive.
            realtime_input_config=types.RealtimeInputConfig(
                automatic_activity_detection=types.AutomaticActivityDetection(
                    start_of_speech_sensitivity="START_SENSITIVITY_HIGH",
                    end_of_speech_sensitivity="END_SENSITIVITY_LOW",
                    prefix_padding_ms=40,
                    silence_duration_ms=300,
                ),
            ),
            # Enable session resumption — server sends periodic tokens we can use
            # to reconnect seamlessly when the connection resets (~10 min lifetime)
            session_resumption=types.SessionResumptionConfig(),
        )
        # Save config for auto-reconnect
        self._connect_config = config

        try:
            async def _connect_and_greet():
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
                return await _collect_response(self._session, timeout=30.0, session_holder=self)

            # Overall timeout covers connection + greeting (Gemini Live can be slow)
            result = await asyncio.wait_for(_connect_and_greet(), timeout=45.0)

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

        except asyncio.TimeoutError:
            logger.error("Director chat session start timed out (45s)")
            await self.close()
            return {"audio_url": None, "input_transcript": "", "output_transcript": "", "tool_calls": []}
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

    # ── Auto-reconnect ─────────────────────────────────────────────────────

    async def _reconnect(self) -> bool:
        """Try to reconnect using the saved resumption handle.

        Must be called while holding ``_session_lock``.
        Returns True if reconnection succeeded.
        """
        if not self._connect_config or not self._resumption_handle:
            logger.warning("Cannot reconnect — no config or resumption handle")
            return False

        if self._reconnect_attempts >= self._MAX_RECONNECT_ATTEMPTS:
            logger.error("Max reconnect attempts (%d) reached", self._MAX_RECONNECT_ATTEMPTS)
            return False

        self._reconnect_attempts += 1
        logger.info(
            "Attempting session reconnect (attempt %d/%d, handle=%s...)",
            self._reconnect_attempts, self._MAX_RECONNECT_ATTEMPTS,
            self._resumption_handle[:20] if self._resumption_handle else "?",
        )

        # Backoff between reconnect attempts
        if self._reconnect_attempts > 1:
            await asyncio.sleep(1.0 * (self._reconnect_attempts - 1))

        # Close old connection manager if it exists
        if self._cm:
            try:
                await self._cm.__aexit__(None, None, None)
            except Exception:
                pass
            self._cm = None
            self._session = None

        try:
            # Create new config with the resumption handle
            reconnect_config = types.LiveConnectConfig(
                response_modalities=self._connect_config.response_modalities,
                speech_config=self._connect_config.speech_config,
                system_instruction=self._connect_config.system_instruction,
                tools=self._connect_config.tools,
                input_audio_transcription=self._connect_config.input_audio_transcription,
                output_audio_transcription=self._connect_config.output_audio_transcription,
                context_window_compression=self._connect_config.context_window_compression,
                session_resumption=types.SessionResumptionConfig(
                    handle=self._resumption_handle,
                ),
            )

            client = get_client()
            self._cm = client.aio.live.connect(
                model=DIRECTOR_LIVE_MODEL, config=reconnect_config
            )
            self._session = await asyncio.wait_for(
                self._cm.__aenter__(), timeout=15.0
            )
            self._go_away_received = False
            self._reconnect_attempts = 0  # Reset on success
            logger.info("Session reconnected successfully")
            return True

        except Exception as e:
            logger.error("Session reconnect failed: %s", e)
            self._session = None
            self._cm = None
            return False

    # ── Send user input ───────────────────────────────────────────────────

    async def send_audio(self, audio_bytes: bytes, mime_type: str) -> dict:
        """Send user audio to the Live session, return full response dict.

        Audio cannot be pre-screened (no transcript yet), so we post-screen
        both the input transcript and output transcript after the model responds.
        """
        if not self._session:
            return {**_EMPTY_RESPONSE, "session_dead": True}

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
                result = await _collect_response(self._session, timeout=30.0, session_holder=self)

                # Post-screen: check input transcript for injection
                safe_in, category = _screen_input(result.get("input_transcript", ""))
                if not safe_in:
                    logger.warning("Director audio input flagged [%s]", category)
                    self._flag_count += 1
                    # Suppress any tool calls triggered by flagged input
                    if result.get("tool_calls"):
                        for tc in result["tool_calls"]:
                            try:
                                await self._reject_tool_call(tc)
                            except Exception as rte:
                                logger.error("Tool rejection failed after screening: %s", rte)
                                self._session = None
                    if self._flag_count >= self._MAX_FLAGS:
                        logger.warning("Too many flagged inputs (%d), closing session", self._flag_count)
                        self._session = None
                    return {
                        **_EMPTY_RESPONSE,
                        "input_transcript": result.get("input_transcript", ""),
                        "output_transcript": _REDIRECT_TRANSCRIPT,
                        "tool_calls": [],
                        "session_dead": self._session is None,
                    }

                # Post-screen: check output transcript for character break
                if not _check_output(result.get("output_transcript", "")):
                    if result.get("tool_calls"):
                        for tc in result["tool_calls"]:
                            try:
                                await self._reject_tool_call(tc)
                            except Exception as rte:
                                logger.error("Tool rejection failed after screening: %s", rte)
                                self._session = None
                    return {
                        **_EMPTY_RESPONSE,
                        "input_transcript": result.get("input_transcript", ""),
                        "output_transcript": _REDIRECT_TRANSCRIPT,
                        "tool_calls": [],
                    }
                # Input was clean — reset flag counter
                self._flag_count = 0

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
            return {**_EMPTY_RESPONSE, "session_dead": True}

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
                result = await _collect_response(self._session, timeout=30.0, session_holder=self)

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

    # ── Streaming send (audio chunks streamed to frontend as they arrive) ─

    async def send_audio_streaming(self, audio_bytes: bytes, mime_type: str, on_audio_chunk) -> dict:
        """Like send_audio but streams audio chunks via on_audio_chunk callback.

        Returns dict with input_transcript, output_transcript, tool_calls, chunk_count.
        Post-screening still runs after the full response arrives.
        On connection failure, attempts auto-reconnect using saved resumption handle.
        """
        if not self._session:
            return {**_EMPTY_RESPONSE, "session_dead": True, "chunk_count": 0}

        async with self._session_lock:
            try:
                return await self._send_audio_streaming_inner(
                    audio_bytes, mime_type, on_audio_chunk,
                )
            except Exception as e:
                err_str = str(e)
                logger.error("Director chat send_audio_streaming failed: %s", err_str)

                is_decode_error = "decode audio" in err_str.lower() or "1007" in err_str

                if self._resumption_handle:
                    logger.info("Attempting auto-reconnect after streaming failure...")
                    if await self._reconnect():
                        if is_decode_error:
                            # Audio decode errors mean the session choked on our audio.
                            # Retrying the SAME audio will just crash again.
                            # Return soft failure — frontend will auto-resume with fresh recording.
                            logger.info("Reconnected after decode error — skipping retry (stale audio)")
                            return {
                                **_EMPTY_RESPONSE,
                                "chunk_count": 0,
                                "noise_rejected": True,
                            }
                        try:
                            return await self._send_audio_streaming_inner(
                                audio_bytes, mime_type, on_audio_chunk,
                            )
                        except Exception as retry_err:
                            logger.error("Retry after reconnect also failed: %s", retry_err)

                self._session = None
                return {**_EMPTY_RESPONSE, "session_dead": True, "chunk_count": 0}

    async def _send_audio_streaming_inner(
        self, audio_bytes: bytes, mime_type: str, on_audio_chunk,
    ) -> dict:
        """Inner implementation of send_audio_streaming (no lock, no reconnect)."""
        await self._maybe_reanchor()

        logger.info(
            "Sending audio: %d bytes, mime=%s, msg_count=%d",
            len(audio_bytes), mime_type, self._msg_count,
        )

        content = types.Content(
            role="user",
            parts=[types.Part(
                inline_data=types.Blob(mime_type=mime_type, data=audio_bytes),
            )],
        )
        await self._session.send_client_content(
            turns=content, turn_complete=True
        )

        result = await _collect_response_streaming(
            self._session, on_audio_chunk, timeout=30.0, session_holder=self
        )

        # ── Noise detection ──
        # Gemini's input_audio_transcription is unreliable — it often returns
        # empty even when the model understood the audio and responded.
        # So we check: did the model actually RESPOND (audio chunks or output)?
        # If yes, it heard something real — let it through.
        # Only reject as noise if model produced NOTHING.
        input_text = (result.get("input_transcript") or "").strip()
        output_text = (result.get("output_transcript") or "").strip()
        has_audio = result.get("chunk_count", 0) > 0
        has_tools = len(result.get("tool_calls", [])) > 0

        logger.info(
            "Audio result: input=%r, output=%r, chunks=%s, tools=%d",
            input_text[:100] if input_text else "(empty)",
            output_text[:100] if output_text else "(empty)",
            result.get("chunk_count", "?"),
            len(result.get("tool_calls", [])),
        )

        if not has_audio and not output_text and not has_tools:
            # Model produced nothing — likely noise
            logger.info("No model response — treating as noise")
            return {
                "input_transcript": "",
                "output_transcript": "",
                "tool_calls": [],
                "chunk_count": 0,
                "noise_rejected": True,
            }

        # Post-screen input transcript
        safe_in, category = _screen_input(result.get("input_transcript", ""))
        if not safe_in:
            logger.warning("Director streaming audio input flagged [%s]", category)
            self._flag_count += 1
            if result.get("tool_calls"):
                for tc in result["tool_calls"]:
                    try:
                        await self._reject_tool_call(tc)
                    except Exception as rte:
                        logger.error("Tool rejection failed after screening: %s", rte)
                        self._session = None
            if self._flag_count >= self._MAX_FLAGS:
                logger.warning("Too many flagged inputs (%d), closing session", self._flag_count)
                self._session = None
            return {
                "input_transcript": result.get("input_transcript", ""),
                "output_transcript": _REDIRECT_TRANSCRIPT,
                "tool_calls": [],
                "chunk_count": result.get("chunk_count", 0),
                "flagged": True,
                "session_dead": self._session is None,
            }

        # Post-screen output transcript
        if not _check_output(result.get("output_transcript", "")):
            if result.get("tool_calls"):
                for tc in result["tool_calls"]:
                    try:
                        await self._reject_tool_call(tc)
                    except Exception as rte:
                        logger.error("Tool rejection failed after screening: %s", rte)
                        self._session = None
            return {
                "input_transcript": result.get("input_transcript", ""),
                "output_transcript": _REDIRECT_TRANSCRIPT,
                "tool_calls": [],
                "chunk_count": result.get("chunk_count", 0),
                "flagged": True,
            }
        # Input was clean — reset flag counter
        self._flag_count = 0

        # Log transcripts
        if result.get("input_transcript"):
            self.conversation_log.append({"role": "user", "text": result["input_transcript"]})
        if result.get("output_transcript"):
            self.conversation_log.append({"role": "director", "text": result["output_transcript"]})
        self._trim_log()
        return result

    async def send_text_streaming(self, text: str, on_audio_chunk) -> dict:
        """Like send_text but streams audio chunks via on_audio_chunk callback."""
        if not self._session:
            return {**_EMPTY_RESPONSE, "session_dead": True, "chunk_count": 0}

        # Pre-screen
        safe, category = _screen_input(text)
        if not safe:
            return {
                "input_transcript": text,
                "output_transcript": _REDIRECT_TRANSCRIPT,
                "tool_calls": [],
                "chunk_count": 0,
            }

        async with self._session_lock:
            try:
                return await self._send_text_streaming_inner(text, on_audio_chunk)
            except Exception as e:
                logger.error("Director chat send_text_streaming failed: %s", e)
                # Try auto-reconnect
                if self._resumption_handle:
                    logger.info("Attempting auto-reconnect after text streaming failure...")
                    if await self._reconnect():
                        try:
                            return await self._send_text_streaming_inner(text, on_audio_chunk)
                        except Exception as retry_err:
                            logger.error("Retry after reconnect also failed: %s", retry_err)
                self._session = None
                return {**_EMPTY_RESPONSE, "session_dead": True, "chunk_count": 0}

    async def _send_text_streaming_inner(self, text: str, on_audio_chunk) -> dict:
        """Inner implementation of send_text_streaming (no lock, no reconnect)."""
        await self._maybe_reanchor()

        content = types.Content(
            role="user",
            parts=[types.Part(text=text)],
        )
        await self._session.send_client_content(
            turns=content, turn_complete=True
        )
        self.conversation_log.append({"role": "user", "text": text})
        result = await _collect_response_streaming(
            self._session, on_audio_chunk, timeout=30.0, session_holder=self
        )

        # Post-screen output
        if not _check_output(result.get("output_transcript", "")):
            return {
                "input_transcript": text,
                "output_transcript": _REDIRECT_TRANSCRIPT,
                "tool_calls": [],
                "chunk_count": result.get("chunk_count", 0),
                "flagged": True,
            }

        if result.get("output_transcript"):
            self.conversation_log.append({"role": "director", "text": result["output_transcript"]})
        self._trim_log()
        return result

    # ── Realtime audio streaming (server-side VAD) ──────────────────────

    async def handle_realtime_stream(
        self,
        chunk_queue: "asyncio.Queue[bytes | None]",
        on_audio_chunk,
    ) -> dict:
        """Process a realtime audio stream with concurrent send/receive.

        Audio chunks are read from ``chunk_queue`` and forwarded to Gemini
        via ``send_realtime_input``.  Gemini's server-side VAD detects speech
        boundaries and triggers a response, which is collected and streamed
        back via ``on_audio_chunk``.

        A ``None`` sentinel in the queue signals the end of the audio stream.
        """
        if not self._session:
            return {**_EMPTY_RESPONSE, "session_dead": True, "chunk_count": 0}

        async with self._session_lock:
            try:
                return await self._handle_realtime_stream_inner(
                    chunk_queue, on_audio_chunk,
                )
            except Exception as e:
                err_str = str(e)
                logger.error("handle_realtime_stream failed: %s", err_str)

                if self._resumption_handle:
                    logger.info("Attempting auto-reconnect after stream failure...")
                    if await self._reconnect():
                        logger.info("Reconnected — returning soft failure (stale stream)")
                        return {
                            **_EMPTY_RESPONSE,
                            "chunk_count": 0,
                            "noise_rejected": True,
                        }

                self._session = None
                return {**_EMPTY_RESPONSE, "session_dead": True, "chunk_count": 0}

    async def _handle_realtime_stream_inner(
        self,
        chunk_queue: "asyncio.Queue[bytes | None]",
        on_audio_chunk,
    ) -> dict:
        """Inner implementation (no lock, no reconnect)."""
        await self._maybe_reanchor()

        chunks_sent = 0

        async def _sender():
            nonlocal chunks_sent
            while True:
                try:
                    chunk = await asyncio.wait_for(chunk_queue.get(), timeout=65.0)
                except asyncio.TimeoutError:
                    logger.warning("Audio chunk queue timed out (65s)")
                    break
                if chunk is None:  # sentinel — stream ended
                    break
                try:
                    await self._session.send_realtime_input(
                        audio=types.Blob(mime_type="audio/pcm", data=chunk),
                    )
                    chunks_sent += 1
                except Exception as e:
                    logger.error("send_realtime_input failed: %s", e)
                    break

        # Run sender and response collector concurrently.
        # Gemini's server VAD will trigger a response when it detects
        # end of speech — _collect_response_streaming will pick it up.
        sender_task = asyncio.create_task(_sender())
        response_task = asyncio.create_task(
            _collect_response_streaming(
                self._session, on_audio_chunk, timeout=45.0, session_holder=self
            )
        )

        # Wait for EITHER to complete first.
        # Typical flow: sender finishes (user stops talking) → Gemini VAD
        # detects silence → response comes → response_task completes.
        # Edge case: Gemini responds mid-stream (VAD detected pause) →
        # response_task completes first → we cancel the sender.
        done, pending = await asyncio.wait(
            [sender_task, response_task],
            return_when=asyncio.FIRST_COMPLETED,
        )

        if response_task in done:
            # Response arrived (possibly mid-stream). Cancel sender.
            sender_task.cancel()
            try:
                await sender_task
            except (asyncio.CancelledError, Exception):
                pass
            result = response_task.result()
        else:
            # Sender finished first. Wait for Gemini's response.
            try:
                result = await asyncio.wait_for(response_task, timeout=30.0)
            except asyncio.TimeoutError:
                logger.warning("No Gemini response after stream ended (30s)")
                response_task.cancel()
                try:
                    await response_task
                except (asyncio.CancelledError, Exception):
                    pass
                result = {
                    "input_transcript": "",
                    "output_transcript": "",
                    "tool_calls": [],
                    "chunk_count": 0,
                    "noise_rejected": True,
                }

        logger.info(
            "Realtime stream: sent=%d chunks, response chunks=%s, tools=%d",
            chunks_sent, result.get("chunk_count", "?"),
            len(result.get("tool_calls", [])),
        )

        # ── Noise detection ──
        input_text = (result.get("input_transcript") or "").strip()
        output_text = (result.get("output_transcript") or "").strip()
        has_audio = result.get("chunk_count", 0) > 0
        has_tools = len(result.get("tool_calls", [])) > 0

        if not has_audio and not output_text and not has_tools:
            logger.info("Realtime stream: no model response — treating as noise")
            return {
                "input_transcript": "",
                "output_transcript": "",
                "tool_calls": [],
                "chunk_count": 0,
                "noise_rejected": True,
            }

        # Post-screen input transcript
        safe_in, category = _screen_input(result.get("input_transcript", ""))
        if not safe_in:
            logger.warning("Realtime stream input flagged [%s]", category)
            self._flag_count += 1
            if result.get("tool_calls"):
                for tc in result["tool_calls"]:
                    try:
                        await self._reject_tool_call(tc)
                    except Exception as rte:
                        logger.error("Tool rejection failed: %s", rte)
                        self._session = None
            if self._flag_count >= self._MAX_FLAGS:
                self._session = None
            return {
                "input_transcript": result.get("input_transcript", ""),
                "output_transcript": _REDIRECT_TRANSCRIPT,
                "tool_calls": [],
                "chunk_count": result.get("chunk_count", 0),
                "flagged": True,
                "session_dead": self._session is None,
            }

        # Post-screen output
        if not _check_output(result.get("output_transcript", "")):
            if result.get("tool_calls"):
                for tc in result["tool_calls"]:
                    try:
                        await self._reject_tool_call(tc)
                    except Exception as rte:
                        logger.error("Tool rejection failed: %s", rte)
                        self._session = None
            return {
                "input_transcript": result.get("input_transcript", ""),
                "output_transcript": _REDIRECT_TRANSCRIPT,
                "tool_calls": [],
                "chunk_count": result.get("chunk_count", 0),
                "flagged": True,
            }

        self._flag_count = 0
        if result.get("input_transcript"):
            self.conversation_log.append({"role": "user", "text": result["input_transcript"]})
        if result.get("output_transcript"):
            self.conversation_log.append({"role": "director", "text": result["output_transcript"]})
        self._trim_log()
        return result

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
        await _collect_response(self._session, timeout=10.0, session_holder=self)

    async def respond_to_tool_call(
        self, tool_call: dict, success: bool = True, on_audio_chunk=None,
    ) -> dict:
        """Send FunctionResponse back so the model can acknowledge the generation.

        When ``on_audio_chunk`` is provided, the follow-up audio is streamed
        incrementally (same as conversational responses).

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
                if on_audio_chunk:
                    result = await _collect_response_streaming(
                        self._session, on_audio_chunk, timeout=25.0, session_holder=self
                    )
                else:
                    result = await _collect_response(self._session, timeout=25.0, session_holder=self)
                if result["output_transcript"]:
                    self.conversation_log.append({"role": "director", "text": result["output_transcript"]})
                return result
            except asyncio.TimeoutError:
                logger.error("respond_to_tool_call timed out — marking session dead")
                self._session = None
                return {"audio_url": None, "input_transcript": "", "output_transcript": "", "tool_calls": [], "session_dead": True}
            except Exception as e:
                logger.error("respond_to_tool_call failed: %s", e)
                self._session = None
                return {"audio_url": None, "input_transcript": "", "output_transcript": "", "tool_calls": [], "session_dead": True}

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
                    "[SYSTEM: The user clicked the 'Suggest Prompt' button. "
                    "Summarize the brainstorming into a vivid 2-3 sentence story prompt. "
                    "Output ONLY the story prompt \u2014 no greetings, no commentary, no conversation. "
                    "Start directly with the story scenario. Example format: "
                    "'A young dragon discovers a hidden library beneath a volcano...' "
                    "If there's not enough brainstorming context yet, just say: NO_SUGGESTION "
                    "Do NOT call generate_story.]"
                )
                content = types.Content(
                    role="user",
                    parts=[types.Part(text=prompt)],
                )
                await self._session.send_client_content(
                    turns=content, turn_complete=True
                )
                result = await _collect_response(self._session, timeout=15.0, session_holder=self)
                # The suggestion is in the output transcript (audio mode)
                suggestion = (result["output_transcript"] or "").strip()
                if not suggestion or "NO_SUGGESTION" in suggestion.upper():
                    return None
                # Filter out conversational responses (model sometimes chats instead of giving a prompt)
                _lower = suggestion.lower()
                if any(_lower.startswith(p) for p in ("ha,", "ha!", "hey", "hi!", "hi,", "well,", "sure,", "oh,", "hmm", "i appreciate", "i'm your", "but i")):
                    logger.warning("Suggestion looks conversational, filtering: %s", suggestion[:80])
                    return None
                self.conversation_log.append({"role": "director", "text": f"[Suggested prompt] {suggestion}"})
                self._trim_log()
                return suggestion
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
                result = await _collect_response(self._session, timeout=15.0, session_holder=self)

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

    async def generation_wrapup(
        self,
        scene_count: int,
        scene_texts: list[str] | None = None,
        on_audio_chunk=None,
    ) -> dict:
        """Post-generation wrap-up — Director reacts to scene and invites continuation.

        When ``on_audio_chunk`` is provided, audio is streamed incrementally
        (same as conversational responses).  Otherwise falls back to bulk
        collection.
        """
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

                if on_audio_chunk:
                    result = await _collect_response_streaming(
                        self._session, on_audio_chunk, timeout=15.0, session_holder=self
                    )
                else:
                    result = await _collect_response(self._session, timeout=15.0, session_holder=self)

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
        """Keep last N messages + capped system entries to prevent unbounded growth."""
        system_entries = [m for m in self.conversation_log if m["role"] == "system"]
        non_system = [m for m in self.conversation_log if m["role"] != "system"]
        if len(non_system) > _MAX_LOG_ENTRIES:
            non_system = non_system[-_MAX_LOG_ENTRIES:]
        # Cap system messages: keep first (story context) + last 2 re-anchors
        if len(system_entries) > 3:
            system_entries = system_entries[:1] + system_entries[-2:]
        self.conversation_log = system_entries + non_system

    async def close(self):
        """Close the Live session (race-safe)."""
        if self._closing:
            return  # Already closing from another task
        self._closing = True

        try:
            # Acquire lock so we don't tear down mid-operation
            async with self._session_lock:
                if self._cm:
                    try:
                        await self._cm.__aexit__(None, None, None)
                    except Exception as e:
                        logger.debug("Director chat close error (expected): %s", e)
                    self._cm = None
                self._session = None
                self.conversation_log = []
        finally:
            self._closing = False

        logger.info("Director chat session closed")
