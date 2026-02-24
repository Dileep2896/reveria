"""Director Chat — persistent Gemini Live API session for brainstorming."""

import asyncio
import base64
import logging

from google.genai import types
from services.gemini_client import get_client

logger = logging.getLogger("storyforge.director_chat")

DIRECTOR_LIVE_MODEL = "gemini-live-2.5-flash-native-audio"

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
    "or 'Shall I write this scene?'. Do NOT rush to write — explore the idea first."
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


def _build_suggest_prompt_system(language: str = "English") -> str:
    """Build language-aware system prompt for prompt suggestion."""
    base = (
        "You are the Director of StoryForge. Based on the conversation and story context below, "
        "write a 2-3 sentence story prompt that the user can use to generate their next scene. "
        "The prompt should be vivid, specific, and build on the ideas discussed. "
        "Output ONLY the prompt text, nothing else."
    )
    if language and language.lower() != "english":
        base += f" The story prompt MUST be written in {language}."
    return base


SUGGEST_PROMPT_SYSTEM = (
    "You are the Director of StoryForge. Based on the conversation and story context below, "
    "write a 2-3 sentence story prompt that the user can use to generate their next scene. "
    "The prompt should be vivid, specific, and build on the ideas discussed. "
    "Output ONLY the prompt text, nothing else."
)


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


async def _collect_audio(session) -> str | None:
    """Collect audio response from a Live session until turn_complete."""
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


class DirectorChatSession:
    """Manages a persistent Gemini Live API session for Director chat."""

    def __init__(self):
        self._session = None
        self._cm = None
        self.conversation_log: list[dict] = []
        self.language: str = "English"

    async def start(
        self,
        story_context: str,
        language: str = "English",
        voice_name: str = "Charon",
    ) -> str | None:
        """Open a Live session and get the Director's greeting.

        Returns a WAV data URL or None.
        """
        self.language = language
        client = get_client()
        system_prompt = _build_system_prompt(language)
        config = {
            "response_modalities": ["AUDIO"],
            "speech_config": {
                "voice_config": {
                    "prebuilt_voice_config": {"voice_name": voice_name}
                }
            },
            "system_instruction": system_prompt,
        }

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

            audio_url = await asyncio.wait_for(_collect_audio(self._session), timeout=30.0)
            self.conversation_log.append({
                "role": "system",
                "text": f"[Story context provided]\n{story_context}",
            })
            logger.info("Director chat session started")
            return audio_url

        except Exception as e:
            logger.error("Failed to start Director chat session: %s", e)
            await self.close()
            return None

    async def send_audio(self, audio_bytes: bytes, mime_type: str) -> str | None:
        """Send user audio to the Live session, return Director's audio response."""
        if not self._session:
            return None

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
            audio_url = await asyncio.wait_for(_collect_audio(self._session), timeout=30.0)
            return audio_url

        except Exception as e:
            logger.error("Director chat send_audio failed: %s", e)
            return None

    async def send_text(self, text: str) -> str | None:
        """Send user text to the Live session, return Director's audio response."""
        if not self._session:
            return None

        try:
            content = types.Content(
                role="user",
                parts=[types.Part(text=text)],
            )
            await self._session.send_client_content(
                turns=content, turn_complete=True
            )
            self.conversation_log.append({"role": "user", "text": text})
            audio_url = await asyncio.wait_for(_collect_audio(self._session), timeout=30.0)
            return audio_url

        except Exception as e:
            logger.error("Director chat send_text failed: %s", e)
            return None

    async def detect_intent(self, user_text: str, director_text: str | None = None) -> dict:
        """Analyze the full exchange to decide if it's time to generate.

        Only triggers when BOTH conditions are met:
        1. The Director has finished exploring (not asking new questions)
        2. The user has confirmed/agreed to proceed
        """
        client = get_client()

        recent = self.conversation_log[-8:]
        conv_text = "\n".join(
            f"{m['role'].upper()}: {m['text']}" for m in recent
        )

        prompt = (
            "You are analyzing a brainstorming conversation between a user and a story director.\n"
            "Determine if BOTH parties are ready to generate/write a scene.\n\n"
            "GENERATE only when ALL of these are true:\n"
            "- The Director has proposed a clear story direction with enough detail\n"
            "- The Director is NOT asking follow-up questions (about characters, setting, mood, etc.)\n"
            "- The user has explicitly confirmed they want to proceed\n"
            "- The conversation has naturally concluded the brainstorming phase\n\n"
            "CONTINUE if ANY of these are true:\n"
            "- The Director is still asking the user questions\n"
            "- The Director just proposed an idea and is waiting for feedback\n"
            "- The user said something vague like 'yes' or 'sounds good' but the Director "
            "hasn't finished fleshing out the details\n"
            "- The user is still brainstorming or asking 'what if' questions\n"
            "- The Director is summarizing/confirming but hasn't gotten a final go-ahead\n\n"
            f"FULL CONVERSATION:\n{conv_text}\n\n"
            f"USER'S LATEST MESSAGE: {user_text}\n"
        )
        if director_text:
            prompt += f"DIRECTOR'S LATEST RESPONSE: {director_text}\n"
        prompt += '\nReturn JSON: {"intent": "generate" or "continue", "confidence": 0.0 to 1.0}'

        try:
            response = await client.aio.models.generate_content(
                model="gemini-2.0-flash",
                contents=types.Content(
                    role="user",
                    parts=[types.Part(text=prompt)],
                ),
                config=types.GenerateContentConfig(
                    temperature=0,
                    max_output_tokens=50,
                    response_mime_type="application/json",
                ),
            )
            import json
            result = json.loads(response.text)
            logger.info("Intent detection: %s", result)
            return result
        except Exception as e:
            logger.warning("detect_intent failed: %s", e)
            return {"intent": "continue", "confidence": 0.0}

    async def suggest_prompt(self, story_context: str) -> str | None:
        """Generate a story prompt from conversation context (separate text call)."""
        client = get_client()

        # Build conversation summary for the prompt generation
        conv_text = "\n".join(
            f"{m['role'].upper()}: {m['text']}" for m in self.conversation_log
        )
        user_input = (
            f"STORY CONTEXT:\n{story_context}\n\n"
            f"CONVERSATION:\n{conv_text}\n\n"
            "Based on this conversation, write a vivid 2-3 sentence story prompt."
        )

        try:
            response = await client.aio.models.generate_content(
                model="gemini-2.0-flash",
                contents=types.Content(
                    role="user",
                    parts=[types.Part(text=user_input)],
                ),
                config=types.GenerateContentConfig(
                    system_instruction=_build_suggest_prompt_system(self.language),
                    temperature=0.7,
                    max_output_tokens=200,
                ),
            )
            if response.text:
                prompt = response.text.strip()
                logger.info("Director suggested prompt: %s", prompt[:80])
                return prompt
        except Exception as e:
            logger.error("Director suggest_prompt failed: %s", e)

        return None

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
