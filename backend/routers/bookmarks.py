"""Reading bookmark endpoints."""

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from services.auth import verify_token
from services.firestore_client import get_db

router = APIRouter()


class BookmarkBody(BaseModel):
    scene_index: int = Field(default=0, ge=0)


@router.get("/api/stories/{story_id}/bookmark")
async def get_bookmark(story_id: str, authorization: str = Header(...)):
    """Get the user's reading bookmark for a story."""
    token = authorization.removeprefix("Bearer ").strip()
    uid = await verify_token(token)
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid auth token")
    db = get_db()
    snap = await db.collection("bookmarks").document(f"{uid}_{story_id}").get()
    if not snap.exists:
        return {"scene_index": None}
    return {"scene_index": snap.to_dict().get("scene_index", 0)}


@router.put("/api/stories/{story_id}/bookmark")
async def save_bookmark(story_id: str, body: BookmarkBody, authorization: str = Header(...)):
    """Save the user's reading bookmark for a story."""
    token = authorization.removeprefix("Bearer ").strip()
    uid = await verify_token(token)
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid auth token")
    db = get_db()
    await db.collection("bookmarks").document(f"{uid}_{story_id}").set({
        "uid": uid,
        "story_id": story_id,
        "scene_index": body.scene_index,
    })
    return {"ok": True}


@router.delete("/api/stories/{story_id}/bookmark")
async def delete_bookmark(story_id: str, authorization: str = Header(...)):
    """Remove the user's reading bookmark for a story."""
    token = authorization.removeprefix("Bearer ").strip()
    uid = await verify_token(token)
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid auth token")
    db = get_db()
    await db.collection("bookmarks").document(f"{uid}_{story_id}").delete()
    return {"ok": True}
