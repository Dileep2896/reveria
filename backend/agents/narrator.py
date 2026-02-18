from google.genai import types
from services.gemini_client import generate_stream

NARRATOR_SYSTEM_PROMPT = """You are the Narrator of StoryForge, a master storyteller who crafts vivid, \
immersive narratives. You write in a cinematic style with rich sensory details.

RULES:
- Write in present tense, third person
- Each response should contain 2-3 scenes
- Mark scene breaks with [SCENE] on its own line
- Open each scene with a vivid sensory detail (sight, sound, smell, touch)
- Build tension progressively across scenes
- Include dialogue using quotation marks
- Keep each scene to 2-3 short paragraphs
- End on a hook that makes the reader want more
- Adapt your tone to the genre (noir for mystery, whimsical for children's, etc.)
- When the user gives steering commands (e.g. "make it scarier", "add a twist"), \
seamlessly weave the change into the next scene

FORMAT:
[SCENE]
<scene text with dialogue and sensory details>

[SCENE]
<next scene>

Do NOT include scene numbers, titles, or meta-commentary. Just write the story."""


class Narrator:
    def __init__(self):
        self.history: list[types.Content] = []

    async def generate(self, user_input: str):
        """Stream story text, yielding chunks. Maintains conversation history."""
        full_response = ""

        async for chunk in generate_stream(
            system_prompt=NARRATOR_SYSTEM_PROMPT,
            user_prompt=user_input,
            history=self.history,
        ):
            full_response += chunk
            yield chunk

        # Add to history for continuity
        self.history.append(
            types.Content(role="user", parts=[types.Part(text=user_input)])
        )
        self.history.append(
            types.Content(role="model", parts=[types.Part(text=full_response)])
        )

    def reset(self):
        self.history = []
