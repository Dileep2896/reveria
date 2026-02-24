"""Director Chat — persistent Gemini Live API session for brainstorming."""

import asyncio
import base64
import logging

from google.genai import types
from services.gemini_client import get_client

logger = logging.getLogger("storyforge.director_chat")

DIRECTOR_LIVE_MODEL = "gemini-live-2.5-flash-native-audio"

# ---------------------------------------------------------------------------
# Tool declaration — model decides when brainstorming is done
# ---------------------------------------------------------------------------

GENERATE_STORY_TOOL = types.FunctionDeclaration(
    name="generate_story",
    description=(
        "Generate an illustrated story scene. Call ONLY when brainstorming is "
        "complete and the user has explicitly confirmed they are ready."
    ),
    parameters=types.Schema(
        type="OBJECT",
        properties={
            "prompt": types.Schema(
                type="STRING",
                description="Vivid 2-3 sentence story prompt distilled from brainstorming",
            ),
        },
        required=["prompt"],
    ),
)

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

DIRECTOR_CHAT_SYSTEM = (
    "You are the Director of StoryForge — a passionate, insightful creative collaborator. "
    "The user is brainstorming their next story direction with you. Be enthusiastic, offer "
    "vivid creative ideas, build on their suggestions, and push the story in exciting directions. "
    "Keep responses conversational and concise (2-4 sentences). You're on set between takes, "
    "riffing ideas with the writer.\n\n"
    "IMPORTANT WORKFLOW: Before writing a scene, make sure you have enough creative details. "
    "Ask about characters, setting, mood, or conflict if the user hasn't specified them. "
    "Only when you feel the idea is fleshed out enough, confirm the plan with the user by "
    "summarizing what you'll create and asking something like 'Ready to bring this to life?' "
    "or 'Shall I write this scene?'. Do NOT rush to write — explore the idea first.\n\n"
    "TOOL USAGE — generate_story:\n"
    "You have a tool called generate_story. Call it ONLY when ALL of these are true:\n"
    "1. The brainstorming has produced a clear story direction with enough detail\n"
    "2. The user has explicitly confirmed they want to proceed (e.g. 'yes', 'let's do it', 'go for it')\n"
    "3. You are NOT still asking follow-up questions\n"
    "4. The user is NOT still exploring alternatives or asking 'what if' questions\n"
    "When you call the tool, include a vivid 2-3 sentence prompt summarizing what to generate.\n"
    "Do NOT call the tool if the user only casually agrees — wait until brainstorming is truly done.\n"
    "If the user says something like 'write it' or 'make it happen', THAT is the signal to call the tool."
)


def _build_system_prompt(language: str = "English") -> str:
    """Build language-aware system prompt for the Director."""
    base = DIRECTOR_CHAT_SYSTEM
    base += (
        " IMPORTANT: Always respond in the same language the user speaks in. "
        "If the user speaks Hindi, reply in Hindi. If they speak Spanish, reply in Spanish. "
        "Match their language naturally."
    )
    if language and language.lower() != "english":
        base += (
            f" The story is being written in {language}, so default to {language} "
            f"unless the user clearly speaks a different language."
        )
    return base


# ---------------------------------------------------------------------------
# Audio helpers
# ---------------------------------------------------------------------------


def _pcm_to_wav(
    pcm_data: bytes,
    sample_rate: int = 24000,
    bits_per_sample: int = 16,
    channels: int = 1,
) -> bytes:
    """Wrap raw PCM bytes in a WAV header for browser playback."""
    import io
    import struct

    buf = io.BytesIO()
    data_size = len(pcm_data)
    byte_rate = sample_rate * channels * bits_per_sample // 8
    block_align = channels * bits_per_sample // 8
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + data_size))
    buf.write(b"WAVE")
    buf.write(b"fmt ")
    buf.write(struct.pack("<I", 16))
    buf.write(struct.pack("<H", 1))
    buf.write(struct.pack("<H", channels))
    buf.write(struct.pack("<I", sample_rate))
    buf.write(struct.pack("<I", byte_rate))
    buf.write(struct.pack("<H", block_align))
    buf.write(struct.pack("<H", bits_per_sample))
    buf.write(b"data")
    buf.write(struct.pack("<I", data_size))
    buf.write(pcm_data)
    return buf.getvalue()


def _audio_data_url(pcm_chunks: list[bytes]) -> str | None:
    """Convert PCM chunks to a WAV data URL."""
    if not pcm_chunks:
        return None
    pcm_data = b"".join(pcm_chunks)
    wav_bytes = _pcm_to_wav(pcm_data)
    b64 = base64.b64encode(wav_bytes).decode("utf-8")
    return f"data:audio/wav;base64,{b64}"


# ---------------------------------------------------------------------------
# Response collectors
# ---------------------------------------------------------------------------


async def _collect_audio(session) -> str | None:
    """Collect audio response from a Live session until turn_complete.

    Used only by generate_voice_preview() — does NOT parse transcriptions/tool calls.
    """
    audio_chunks: list[bytes] = []
    async for response in session.receive():
        server = response.server_content
        if server and server.model_turn:
            for part in server.model_turn.parts:
                if part.inline_data and isinstance(part.inline_data.data, bytes):
                    audio_chunks.append(part.inline_data.data)
        if server and server.turn_complete:
            break
    return _audio_data_url(audio_chunks)


async def _collect_response(session, timeout: float = 30.0) -> dict:
    """Collect full response: audio + native transcriptions + tool calls.

    Returns dict with keys:
        audio_url: str | None
        input_transcript: str  (user's speech, from native transcription)
        output_transcript: str (model's speech, from native transcription)
        tool_calls: list[dict] (each has 'name' and 'args')
    """
    audio_chunks: list[bytes] = []
    input_transcript_parts: list[str] = []
    output_transcript_parts: list[str] = []
    tool_calls: list[dict] = []

    async def _receive():
        async for response in session.receive():
            # --- Server content (audio, transcriptions, turn_complete) ---
            server = response.server_content
            if server:
                if server.model_turn:
                    for part in server.model_turn.parts:
                        if part.inline_data and isinstance(part.inline_data.data, bytes):
                            audio_chunks.append(part.inline_data.data)
                if server.input_transcription and server.input_transcription.text:
                    input_transcript_parts.append(server.input_transcription.text)
                if server.output_transcription and server.output_transcription.text:
                    output_transcript_parts.append(server.output_transcription.text)
                if server.turn_complete:
                    break

            # --- Tool call ---
            if response.tool_call:
                for fc in response.tool_call.function_calls:
                    tool_calls.append({
                        "name": fc.name,
                        "args": dict(fc.args) if fc.args else {},
                        "id": fc.id,
                    })
                # Tool call ends the turn
                break

    try:
        await asyncio.wait_for(_receive(), timeout=timeout)
    except asyncio.TimeoutError:
        logger.warning("_collect_response timed out after %.0fs", timeout)

    return {
        "audio_url": _audio_data_url(audio_chunks),
        "input_transcript": " ".join(input_transcript_parts).strip(),
        "output_transcript": " ".join(output_transcript_parts).strip(),
        "tool_calls": tool_calls,
    }


# ---------------------------------------------------------------------------
# Voice preview
# ---------------------------------------------------------------------------

VOICE_PREVIEW_LINES = {
    "Charon": "Welcome to StoryForge. I am Charon, your Director. Let me guide your story into the depths of imagination.",
    "Kore": "Hello there! I'm Kore, your Director. Let's craft something beautiful together, shall we?",
    "Fenrir": "I am Fenrir, your Director. Bold stories await — let's charge forward and create something powerful!",
    "Aoede": "Greetings, storyteller! I'm Aoede, your Director. Every tale deserves a lyrical touch, and I'm here to help.",
    "Puck": "Hey! I'm Puck, your Director! Let's have some fun and cook up a wild adventure together!",
    "Orus": "Peace, storyteller. I am Orus, your Director. With patience and wisdom, we shall weave a fine tale.",
    "Leda": "Good day. I'm Leda, your Director. Allow me to lend an elegant hand to your narrative.",
    "Zephyr": "Yo, what's up! I'm Zephyr, your Director. Let's keep things chill and see where the story takes us!",
}


async def generate_voice_preview(voice_name: str) -> str | None:
    """Generate a short voice preview clip using the Gemini Live API."""
    client = get_client()
    preview_text = VOICE_PREVIEW_LINES.get(voice_name, f"Hello, I am {voice_name}, your Director at StoryForge.")
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

_MAX_LOG_ENTRIES = 20


class DirectorChatSession:
    """Manages a persistent Gemini Live API session for Director chat."""

    def __init__(self):
        self._session = None
        self._cm = None
        self.conversation_log: list[dict] = []
        self.language: str = "English"

    # ── Lifecycle ──────────────────────────────────────────────────────────

    async def start(
        self,
        story_context: str,
        language: str = "English",
        voice_name: str = "Charon",
    ) -> dict:
        """Open a Live session and get the Director's greeting.

        Returns a _collect_response() result dict.
        """
        self.language = language
        client = get_client()
        system_prompt = _build_system_prompt(language)

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

    # ── Send user input ───────────────────────────────────────────────────

    async def send_audio(self, audio_bytes: bytes, mime_type: str) -> dict:
        """Send user audio to the Live session, return full response dict."""
        if not self._session:
            return {"audio_url": None, "input_transcript": "", "output_transcript": "", "tool_calls": []}

        try:
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

            # Log transcripts
            if result["input_transcript"]:
                self.conversation_log.append({"role": "user", "text": result["input_transcript"]})
            if result["output_transcript"]:
                self.conversation_log.append({"role": "director", "text": result["output_transcript"]})
            self._trim_log()
            return result

        except Exception as e:
            logger.error("Director chat send_audio failed: %s", e)
            return {"audio_url": None, "input_transcript": "", "output_transcript": "", "tool_calls": []}

    async def send_text(self, text: str) -> dict:
        """Send user text to the Live session, return full response dict."""
        if not self._session:
            return {"audio_url": None, "input_transcript": "", "output_transcript": "", "tool_calls": []}

        try:
            content = types.Content(
                role="user",
                parts=[types.Part(text=text)],
            )
            await self._session.send_client_content(
                turns=content, turn_complete=True
            )
            self.conversation_log.append({"role": "user", "text": text})
            result = await _collect_response(self._session, timeout=30.0)

            if result["output_transcript"]:
                self.conversation_log.append({"role": "director", "text": result["output_transcript"]})
            self._trim_log()
            return result

        except Exception as e:
            logger.error("Director chat send_text failed: %s", e)
            return {"audio_url": None, "input_transcript": "", "output_transcript": "", "tool_calls": []}

    # ── Tool call handling ────────────────────────────────────────────────

    async def respond_to_tool_call(self, tool_call: dict, success: bool = True) -> dict:
        """Send FunctionResponse back so the model can acknowledge the generation.

        Returns follow-up audio response dict.
        """
        if not self._session:
            return {"audio_url": None, "input_transcript": "", "output_transcript": "", "tool_calls": []}

        try:
            response_part = types.Part(
                function_response=types.FunctionResponse(
                    id=tool_call.get("id", ""),
                    name=tool_call["name"],
                    response={"status": "ok" if success else "cancelled"},
                ),
            )
            await self._session.send_tool_response(
                function_responses=[response_part],
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

        try:
            prompt = (
                "Based on everything we've discussed, write a vivid 2-3 sentence "
                "story prompt that captures our brainstorming. Output ONLY the prompt text, nothing else. "
                "Do NOT call the generate_story tool — just give me the text."
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
