"""Firebase Auth token verification."""

import logging
import os

import firebase_admin
from firebase_admin import auth

logger = logging.getLogger("storyforge.auth")

_initialized = False


def _ensure_init() -> None:
    """Lazy init — called after load_dotenv() has run in main.py."""
    global _initialized
    if _initialized:
        return
    _initialized = True

    firebase_project = os.getenv("FIREBASE_PROJECT_ID")
    if firebase_project:
        logger.info("Initializing Firebase Admin for project: %s", firebase_project)
        firebase_admin.initialize_app(options={"projectId": firebase_project})
    else:
        firebase_admin.initialize_app()


async def verify_token(id_token: str) -> str | None:
    """Verify a Firebase ID token and return the UID, or None if invalid."""
    _ensure_init()
    try:
        decoded = auth.verify_id_token(id_token)
        return decoded["uid"]
    except Exception as e:
        logger.warning("Token verification failed: %s", e)
        return None
