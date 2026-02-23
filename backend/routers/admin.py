"""Admin endpoints - user management for admin users."""

import asyncio
import logging
from typing import Any, Optional

from fastapi import APIRouter, Header, HTTPException, Query
from firebase_admin import auth as fb_auth
from pydantic import BaseModel

from services.auth import verify_admin
from services.firestore_client import get_db
from services.storage_client import delete_story_media

logger = logging.getLogger("storyforge.admin")
router = APIRouter(prefix="/api/admin", tags=["admin"])


async def _require_admin(authorization: str = Header(...)) -> str:
    """Extract token, verify admin. Raises 403 if not admin."""
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing auth token")
    uid = await verify_admin(token)
    if not uid:
        raise HTTPException(status_code=403, detail="Admin access required")
    return uid


def _provider_from_record(record: fb_auth.UserRecord) -> str:
    """Get primary auth provider from Firebase user record."""
    for info in (record.provider_data or []):
        if info.provider_id == "google.com":
            return "google.com"
        if info.provider_id == "password":
            return "password"
    return "unknown"


async def _enrich_user(record: fb_auth.UserRecord, db: Any) -> dict[str, Any]:
    """Build user dict from Firebase Auth record + Firestore user doc."""
    uid = record.uid
    user_data: dict[str, Any] = {
        "uid": uid,
        "email": record.email or "",
        "display_name": record.display_name or "",
        "photo_url": record.photo_url or "",
        "provider": _provider_from_record(record),
        "email_verified": record.email_verified or False,
        "created_at": record.user_metadata.creation_timestamp,
        "last_sign_in": record.user_metadata.last_sign_in_timestamp,
        "tier": "free",
        "is_admin": False,
        "story_count": 0,
        "usage": {},
    }

    # Merge Firestore data
    try:
        user_doc = await db.collection("users").document(uid).get()
        if user_doc.exists:
            data = user_doc.to_dict()
            user_data["tier"] = data.get("tier", "free")
            user_data["is_admin"] = data.get("is_admin", False)
            user_data["usage"] = data.get("usage", {})
    except Exception as e:
        logger.warning("Failed to fetch Firestore user doc for %s: %s", uid, e)

    # Story count
    try:
        stories_query = db.collection("stories").where("uid", "==", uid)
        stories = [doc async for doc in stories_query.stream()]
        user_data["story_count"] = len(stories)
    except Exception as e:
        logger.warning("Failed to count stories for %s: %s", uid, e)

    return user_data


# ── List users ──


@router.get("/users")
async def list_users(
    authorization: str = Header(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
) -> dict[str, Any]:
    """Paginated user list with optional search."""
    await _require_admin(authorization)
    db = get_db()

    # Fetch all Firebase Auth users
    all_records: list[fb_auth.UserRecord] = []
    page_token = None
    while True:
        result = await asyncio.to_thread(
            fb_auth.list_users, max_results=1000, page_token=page_token
        )
        all_records.extend(result.users)
        page_token = result.next_page_token
        if not page_token:
            break

    # Filter by search
    if search:
        search_lower = search.lower()
        all_records = [
            r for r in all_records
            if (r.email and search_lower in r.email.lower())
            or (r.display_name and search_lower in r.display_name.lower())
        ]

    total = len(all_records)

    # Paginate
    start = (page - 1) * page_size
    end = start + page_size
    page_records = all_records[start:end]

    # Enrich with Firestore data
    users = await asyncio.gather(*[_enrich_user(r, db) for r in page_records])

    return {"users": users, "total": total, "page": page, "page_size": page_size}


# ── Get single user ──


@router.get("/users/{uid}")
async def get_user(
    uid: str,
    authorization: str = Header(...),
) -> dict[str, Any]:
    """Detailed user info."""
    await _require_admin(authorization)
    db = get_db()

    try:
        record = await asyncio.to_thread(fb_auth.get_user, uid)
    except fb_auth.UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")

    user_data = await _enrich_user(record, db)

    # Extra stats: comment count, likes given
    all_stories = []
    try:
        stories_ref = db.collection("stories")
        all_stories = [s async for s in stories_ref.stream()]
    except Exception:
        pass

    try:
        comment_count = 0
        for story_doc in all_stories:
            comments_ref = db.collection("stories").document(story_doc.id).collection("comments").where("uid", "==", uid)
            comments = [c async for c in comments_ref.stream()]
            comment_count += len(comments)
        user_data["comment_count"] = comment_count
    except Exception:
        user_data["comment_count"] = 0

    try:
        likes_count = 0
        for story_doc in all_stories:
            data = story_doc.to_dict()
            if uid in (data.get("liked_by") or []):
                likes_count += 1
        user_data["likes_given"] = likes_count
    except Exception:
        user_data["likes_given"] = 0

    return user_data


# ── Update user tier ──


class UpdateTierBody(BaseModel):
    tier: str


@router.patch("/users/{uid}")
async def update_user(
    uid: str,
    body: UpdateTierBody,
    authorization: str = Header(...),
) -> dict[str, Any]:
    """Update user tier."""
    await _require_admin(authorization)

    if body.tier not in ("free", "standard", "pro"):
        raise HTTPException(status_code=400, detail="Invalid tier. Must be free, standard, or pro.")

    db = get_db()
    user_ref = db.collection("users").document(uid)
    await user_ref.set({"tier": body.tier}, merge=True)

    return {"uid": uid, "tier": body.tier, "updated": True}


# ── Delete user ──


@router.delete("/users/{uid}")
async def delete_user(
    uid: str,
    authorization: str = Header(...),
    delete_stories: bool = Query(False),
) -> dict[str, Any]:
    """Delete user from Firebase Auth + Firestore. Optionally delete all stories."""
    admin_uid = await _require_admin(authorization)

    if admin_uid == uid:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    db = get_db()

    # Delete stories if requested
    deleted_stories = 0
    if delete_stories:
        try:
            stories_query = db.collection("stories").where("uid", "==", uid)
            async for story_doc in stories_query.stream():
                story_id = story_doc.id
                # Delete all subcollections
                for subcol in ("comments", "ratings", "scenes", "generations"):
                    sub_ref = db.collection("stories").document(story_id).collection(subcol)
                    async for sub_doc in sub_ref.stream():
                        await sub_doc.reference.delete()
                # Delete GCS media (images, covers, portraits)
                try:
                    await delete_story_media(story_id)
                except Exception as e:
                    logger.warning("Failed to delete GCS media for story %s: %s", story_id, e)
                # Delete the story document itself
                await story_doc.reference.delete()
                deleted_stories += 1
        except Exception as e:
            logger.error("Failed to delete stories for user %s: %s", uid, e)

    # Delete Firestore user doc
    try:
        await db.collection("users").document(uid).delete()
    except Exception as e:
        logger.warning("Failed to delete Firestore user doc for %s: %s", uid, e)

    # Delete Firebase Auth user
    try:
        await asyncio.to_thread(fb_auth.delete_user, uid)
    except fb_auth.UserNotFoundError:
        pass
    except Exception as e:
        logger.error("Failed to delete Firebase Auth user %s: %s", uid, e)
        raise HTTPException(status_code=500, detail="Failed to delete user from auth")

    return {"uid": uid, "deleted": True, "stories_deleted": deleted_stories}
