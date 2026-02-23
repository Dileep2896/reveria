"""Social endpoints - ratings and comments for published stories."""

import asyncio
import time
from typing import Any, Optional

from fastapi import APIRouter, Header, HTTPException
from firebase_admin import auth as fb_auth
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
    old_snap = await ratings_ref.document(uid).get()
    old_rating = old_snap.to_dict()["rating"] if old_snap.exists else None

    # Write rating to subcollection
    await ratings_ref.document(uid).set({
        "rating": body.rating,
        "created_at": time.time(),
    })

    # Update denormalized fields atomically
    from google.cloud.firestore_v1.transforms import Increment

    if old_rating is None:
        await story_ref.update({
            "rating_sum": Increment(body.rating),
            "rating_count": Increment(1),
        })
    else:
        diff = body.rating - old_rating
        if diff != 0:
            await story_ref.update({
                "rating_sum": Increment(diff),
            })

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

    # Count comments
    comments_ref = story_ref.collection("comments")
    comment_docs = []
    async for d in comments_ref.stream():
        comment_docs.append(d)
    comment_count = len(comment_docs)

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
    uid = await verify_token(token)
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid auth token")

    db = get_db()
    story_ref = db.collection("stories").document(story_id)
    snap = await story_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Story not found")

    # Decode token to get commenter's display name and photo
    try:
        decoded = await asyncio.to_thread(fb_auth.verify_id_token, token)
        author_name = decoded.get("name", "Anonymous")
        author_photo_url = decoded.get("picture")
    except Exception:
        author_name = "Anonymous"
        author_photo_url = None

    comments_ref = story_ref.collection("comments")
    comment_data = {
        "uid": uid,
        "author_name": author_name,
        "author_photo_url": author_photo_url,
        "text": body.text.strip(),
        "created_at": time.time(),
    }

    from google.cloud.firestore_v1.transforms import Increment

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

    from google.cloud.firestore_v1.transforms import Increment

    await comment_ref.delete()
    await story_ref.update({"comment_count": Increment(-1)})
    return {"status": "deleted"}
