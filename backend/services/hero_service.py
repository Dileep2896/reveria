"""Hero Service — uses Gemini 2.0 Flash (Vision) to extract 'Visual DNA' from a user photo."""

import logging
from google.genai import types
from services.gemini_client import get_client, get_model

logger = logging.getLogger("storyforge.hero")

HERO_ANALYSIS_PROMPT = """Analyze this person's photo for a character reference sheet.
Extract ONLY their permanent physical traits into a concise 1-sentence description.

INCLUDE (permanent features):
- Gender and approximate age
- Face shape and key features (eyes, nose, jawline, lips, cheekbones)
- Hair style, color, length, and texture
- Skin tone and ethnicity
- Facial hair (beard, mustache) if present
- Permanent accessories (glasses, piercings)
- Build/body type if visible

DO NOT INCLUDE (these change and will be set by the story):
- Clothing, outfit, or what they are wearing
- Temporary accessories (hats, scarves, bags)
- Background or setting
- Pose or expression

Format the output as a single, highly detailed character description line starting with 'PROTAGONIST:'.
Example: PROTAGONIST: A young man with warm brown skin, an oval face, short jet-black wavy hair, large dark brown almond-shaped eyes, a broad nose, and a slim build, wearing round silver-rimmed glasses.
Do NOT include any other text or commentary."""

async def analyze_hero_photo(image_base64: str, mime_type: str = "image/jpeg") -> str | None:
    """Send user photo to Gemini 2.0 Flash to get a stable character description."""
    client = get_client()
    model = get_model()

    try:
        import base64
        image_bytes = base64.b64decode(image_base64)

        response = await client.aio.models.generate_content(
            model=model,
            contents=types.Content(
                role="user",
                parts=[
                    types.Part(inline_data=types.Blob(mime_type=mime_type, data=image_bytes)),
                    types.Part(text=HERO_ANALYSIS_PROMPT),
                ],
            ),
            config=types.GenerateContentConfig(
                temperature=0.4,
                max_output_tokens=150,
            ),
        )

        if response.text:
            text = response.text.strip()
            if "PROTAGONIST:" in text:
                return text.split("PROTAGONIST:", 1)[1].strip()
            return text
            
    except Exception as e:
        logger.error("Hero photo analysis failed: %s", e)
    
    return None
