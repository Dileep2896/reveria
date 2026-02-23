"""Usage & subscription endpoints."""

from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from services.auth import verify_token
from services.firestore_client import get_db
from services.usage import get_usage, get_limits_for_tier

router = APIRouter()


class WaitlistBody(BaseModel):
    email: str


@router.get("/api/usage")
async def get_user_usage(
    authorization: str = Header(...),
) -> dict[str, Any]:
    """Return current usage and limits for the authenticated user."""
    token = authorization.removeprefix("Bearer ").strip()
    uid = await verify_token(token)
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid auth token")

    usage = await get_usage(uid)
    return {"usage": usage, "limits": get_limits_for_tier(usage.get("tier", "free"))}


@router.post("/api/usage/pro-waitlist")
async def join_pro_waitlist(
    body: WaitlistBody,
    authorization: str = Header(...),
) -> dict[str, Any]:
    """Save the user's email for Pro waitlist notifications."""
    token = authorization.removeprefix("Bearer ").strip()
    uid = await verify_token(token)
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid auth token")

    db = get_db()
    await db.collection("users").document(uid).set(
        {"pro_waitlist_email": body.email},
        merge=True,
    )
    return {"ok": True}
