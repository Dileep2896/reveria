"""Social endpoints - ratings and comments for published stories."""

import time
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Header, HTTPException
from google.cloud.firestore_v1 import async_transactional
from google.cloud.firestore_v1.transforms import Increment
from pydantic import BaseModel, Field

from services.auth import verify_token
from services.firestore_client import get_db

router = APIRouter()


async def _optional_uid(authorization: Optional[str]) -> Optional[str]:
    """Extract UID from Bearer token if present, else None."""
    if not authorization:
        return None
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        return None
    return await verify_token(token)


# ── Rate a story ──


class RateBody(BaseModel):
    rating: int = Field(..., ge=1, le=5)


@async_transactional
async def _rate_in_transaction(transaction, story_ref, ratings_ref, uid, rating):
    old_snap = await ratings_ref.document(uid).get(transaction=transaction)
    old_rating = old_snap.to_dict()["rating"] if old_snap.exists else None

    transaction.set(ratings_ref.document(uid), {
        "rating": rating,
        "updated_at": datetime.now(timezone.utc),
    })

    if old_rating is None:
        transaction.update(story_ref, {
            "rating_sum": Increment(rating),
            "rating_count": Increment(1),
        })
    else:
        diff = rating - old_rating
        if diff != 0:
            transaction.update(story_ref, {"rating_sum": Increment(diff)})

    return old_rating


@router.post("/api/stories/{story_id}/rate")
async def rate_story(
    story_id: str,
    body: RateBody,
    authorization: str = Header(...),
) -> dict[str, Any]:
    """Upsert a 1-5 star rating for a story."""
    token = authorization.removeprefix("Bearer ").strip()
    uid = await verify_token(token)
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid auth token")

    db = get_db()
    story_ref = db.collection("stories").document(story_id)
    snap = await story_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Story not found")

    ratings_ref = story_ref.collection("ratings")
    old_rating = await _rate_in_transaction(db.transaction(), story_ref, ratings_ref, uid, body.rating)

    return {"rating": body.rating, "old_rating": old_rating}


# ── Get social stats ──


@router.get("/api/public/stories/{story_id}/social")
async def get_social_stats(
    story_id: str,
    authorization: Optional[str] = Header(None),
) -> dict[str, Any]:
    """Return rating avg/count and user's own rating (if auth'd)."""
    uid = await _optional_uid(authorization)

    db = get_db()
    story_ref = db.collection("stories").document(story_id)
    snap = await story_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Story not found")

    data = snap.to_dict()
    rating_sum = data.get("rating_sum", 0) or 0
    rating_count = data.get("rating_count", 0) or 0
    rating_avg = round(rating_sum / rating_count, 1) if rating_count > 0 else 0

    comment_count = data.get("comment_count", 0) or 0

    result: dict[str, Any] = {
        "rating_avg": rating_avg,
        "rating_count": rating_count,
        "comment_count": comment_count,
        "user_rating": None,
    }

    if uid:
        user_rating_snap = await story_ref.collection("ratings").document(uid).get()
        if user_rating_snap.exists:
            result["user_rating"] = user_rating_snap.to_dict()["rating"]

    return result


# ── Post a comment ──


class CommentBody(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)


@router.post("/api/stories/{story_id}/comments")
async def post_comment(
    story_id: str,
    body: CommentBody,
    authorization: str = Header(...),
) -> dict[str, Any]:
    """Create a comment on a story."""
    token = authorization.removeprefix("Bearer ").strip()
    decoded = await verify_token(token, full=True)
    if not decoded:
        raise HTTPException(status_code=401, detail="Invalid auth token")
    uid = decoded["uid"]

    db = get_db()
    story_ref = db.collection("stories").document(story_id)
    snap = await story_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Story not found")

    author_name = decoded.get("name") or "Anonymous"
    author_photo_url = decoded.get("picture")

    comments_ref = story_ref.collection("comments")

    recent = comments_ref.where("uid", "==", uid).order_by("created_at", direction="DESCENDING").limit(1)
    async for doc in recent.stream():
        last_time = doc.to_dict().get("created_at")
        if last_time:
            if isinstance(last_time, (int, float)):
                elapsed = time.time() - last_time
            else:
                elapsed = (datetime.now(timezone.utc) - last_time).total_seconds()
            if elapsed < 5:
                raise HTTPException(status_code=429, detail="Please wait before posting another comment")

    comment_data = {
        "uid": uid,
        "author_name": author_name,
        "author_photo_url": author_photo_url,
        "text": body.text.strip(),
        "created_at": time.time(),
    }

    new_doc = comments_ref.document()
    await new_doc.set(comment_data)
    await story_ref.update({"comment_count": Increment(1)})

    return {
        "id": new_doc.id,
        **comment_data,
    }


# ── List comments ──


@router.get("/api/public/stories/{story_id}/comments")
async def list_comments(story_id: str) -> dict[str, Any]:
    """Return comments for a story, newest first."""
    db = get_db()
    story_ref = db.collection("stories").document(story_id)

    # Verify story exists and is public
    story_snap = await story_ref.get()
    if not story_snap.exists:
        raise HTTPException(status_code=404, detail="Story not found")
    story_data = story_snap.to_dict() or {}
    if not story_data.get("is_public"):
        raise HTTPException(status_code=404, detail="Story not found")

    comments_ref = story_ref.collection("comments")
    q = comments_ref.order_by("created_at", direction="DESCENDING").limit(50)

    comments = []
    async for doc_snap in q.stream():
        c = doc_snap.to_dict()
        c["id"] = doc_snap.id
        comments.append(c)

    return {"comments": comments}


# ── Delete a comment ──


@router.delete("/api/stories/{story_id}/comments/{comment_id}")
async def delete_comment(
    story_id: str,
    comment_id: str,
    authorization: str = Header(...),
) -> dict[str, str]:
    """Delete a comment (own comment or story author can delete any)."""
    token = authorization.removeprefix("Bearer ").strip()
    uid = await verify_token(token)
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid auth token")

    db = get_db()
    story_ref = db.collection("stories").document(story_id)
    story_snap = await story_ref.get()
    if not story_snap.exists:
        raise HTTPException(status_code=404, detail="Story not found")

    story_data = story_snap.to_dict()
    is_story_author = story_data.get("uid") == uid

    comment_ref = story_ref.collection("comments").document(comment_id)
    comment_snap = await comment_ref.get()
    if not comment_snap.exists:
        raise HTTPException(status_code=404, detail="Comment not found")

    comment_data = comment_snap.to_dict()
    if comment_data.get("uid") != uid and not is_story_author:
        raise HTTPException(status_code=403, detail="Not your comment")

    await comment_ref.delete()
    # Use Increment(-1) unconditionally — Firestore handles atomicity.
    # Guard against going below zero with a follow-up clamp if needed.
    try:
        await story_ref.update({"comment_count": Increment(-1)})
        # Clamp to zero if it went negative (race between concurrent deletes)
        refreshed = await story_ref.get()
        if refreshed.exists and (refreshed.to_dict() or {}).get("comment_count", 0) < 0:
            await story_ref.update({"comment_count": 0})
    except Exception:
        pass  # Non-critical: count will self-correct on next comment add
    return {"status": "deleted"}
