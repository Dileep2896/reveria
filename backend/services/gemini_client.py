import os
from google import genai
from google.genai import types

def get_client() -> genai.Client:
    """Create a Gemini client using API key or Vertex AI (ADC)."""
    api_key = os.getenv("GEMINI_API_KEY", "")

    if api_key and api_key != "your-api-key":
        return genai.Client(api_key=api_key)

    # Fall back to Vertex AI with application default credentials
    project = os.getenv("GOOGLE_CLOUD_PROJECT", "storyforge-hackathon")
    location = os.getenv("VERTEX_AI_LOCATION", "us-central1")
    return genai.Client(
        vertexai=True,
        project=project,
        location=location,
    )


def get_model() -> str:
    return os.getenv("GEMINI_MODEL", "gemini-2.0-flash")


async def generate_stream(
    system_prompt: str,
    user_prompt: str,
    history: list[types.Content] | None = None,
):
    """Stream text from Gemini, yielding chunks as they arrive."""
    client = get_client()
    model = get_model()

    contents: list[types.Content] = []
    if history:
        contents.extend(history)
    contents.append(types.Content(role="user", parts=[types.Part(text=user_prompt)]))

    stream = await client.aio.models.generate_content_stream(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.9,
            max_output_tokens=2048,
        ),
    )
    async for chunk in stream:
        if chunk.text:
            yield chunk.text
