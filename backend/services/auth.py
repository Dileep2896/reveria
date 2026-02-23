"""Firebase Auth token verification."""

import asyncio
import logging
import os

import firebase_admin
from firebase_admin import auth

logger = logging.getLogger("storyforge.auth")

_initialized = False


def _ensure_init() -> None:
    """Lazy init - called after load_dotenv() has run in main.py."""
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


async def verify_token(id_token: str, full: bool = False) -> str | dict | None:
    """Verify a Firebase ID token and return the UID (or full claims dict if full=True)."""
    _ensure_init()
    try:
        decoded = await asyncio.to_thread(auth.verify_id_token, id_token)
        return decoded if full else decoded["uid"]
    except Exception as e:
        logger.warning("Token verification failed: %s", e)
        return None


async def verify_admin(id_token: str) -> str | None:
    """Verify token AND check is_admin field. Returns uid or None."""
    uid = await verify_token(id_token)
    if not uid:
        return None
    from services.firestore_client import get_db

    db = get_db()
    user_doc = await db.collection("users").document(uid).get()
    if not user_doc.exists or not user_doc.to_dict().get("is_admin"):
        return None
    return uid
