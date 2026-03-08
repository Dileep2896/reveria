"""Per-user usage tracking and free-tier limit enforcement."""

import logging
from datetime import datetime, timezone
from typing import Any

from google.cloud import firestore as _firestore
from services.firestore_client import get_db

logger = logging.getLogger("storyforge.usage")

FREE_LIMITS: dict[str, int] = {
    "active_stories": 5,
    "generations_today": 5,
    "scene_regens_today": 0,
    "pdf_exports_today": 2,
    "published_stories": 2,
}

STANDARD_LIMITS: dict[str, int] = {
    "active_stories": 8,
    "generations_today": 10,
    "scene_regens_today": 6,
    "pdf_exports_today": 4,
    "published_stories": 4,
}

PRO_LIMITS: dict[str, int] = {
    "active_stories": 999,
    "generations_today": 999,
    "scene_regens_today": 999,
    "pdf_exports_today": 999,
    "published_stories": 999,
}

TIER_LIMITS: dict[str, dict[str, int]] = {
    "free": FREE_LIMITS,
    "standard": STANDARD_LIMITS,
    "pro": PRO_LIMITS,
}


def get_limits_for_tier(tier: str) -> dict[str, int]:
    """Return the limits dict for a given tier."""
    return TIER_LIMITS.get(tier, FREE_LIMITS)

# Map action names to counter field names
_ACTION_FIELD: dict[str, str] = {
    "generate": "generations_today",
    "regen": "scene_regens_today",
    "pdf_export": "pdf_exports_today",
    "create_story": "active_stories",
    "publish": "published_stories",
}

_DAILY_FIELDS = {"generations_today", "scene_regens_today", "pdf_exports_today"}


def _today_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _normalize_usage(data: dict[str, Any]) -> dict[str, Any]:
    """Return a clean usage dict, zeroing daily counters if date has rolled."""
    today = _today_utc()
    stored_date = data.get("usage_date", "")
    new_day = stored_date != today

    return {
        "active_stories": data.get("active_stories", 0),
        "published_stories": data.get("published_stories", 0),
        "generations_today": 0 if new_day else data.get("generations_today", 0),
        "scene_regens_today": 0 if new_day else data.get("scene_regens_today", 0),
        "pdf_exports_today": 0 if new_day else data.get("pdf_exports_today", 0),
        "usage_date": today,
        "tier": data.get("tier", "free"),
    }


async def get_usage(uid: str) -> dict[str, Any]:
    """Read and normalize usage for a user."""
    db = get_db()
    doc = await db.collection("users").document(uid).get()
    data = doc.to_dict() if doc.exists else {}
    return _normalize_usage(data)


async def check_limit(uid: str, action: str) -> tuple[bool, str | None, dict[str, Any]]:
    """Check if user can perform *action*.

    Returns (allowed, reason_if_blocked, current_usage).
    """
    usage = await get_usage(uid)
    field = _ACTION_FIELD.get(action)
    if not field:
        return True, None, usage

    current = usage.get(field, 0)
    tier = usage.get("tier", "free")
    limits = get_limits_for_tier(tier)
    limit = limits.get(field, 999)
    if current >= limit:
        reason = f"{action} limit reached ({current}/{limit})"
        return False, reason, usage

    return True, None, usage


async def increment_usage(uid: str, action: str) -> dict[str, Any]:
    """Atomically increment the counter for *action* using a Firestore transaction.

    Resets daily fields if a new day has started. The transaction ensures
    concurrent increments don't race (e.g. two generation requests arriving
    close together).
    """
    db = get_db()
    ref = db.collection("users").document(uid)
    field = _ACTION_FIELD.get(action)
    if not field:
        return await get_usage(uid)

    transaction = db.transaction()

    @_firestore.async_transactional
    async def _txn_increment(txn):
        doc = await ref.get(transaction=txn)
        data = doc.to_dict() if doc.exists else {}
        today = _today_utc()
        stored_date = data.get("usage_date", "")

        update: dict[str, Any] = {"updated_at": datetime.now(timezone.utc)}

        if stored_date != today:
            # New day: reset daily counters
            for f in _DAILY_FIELDS:
                update[f] = 0
            update["usage_date"] = today
            if field in _DAILY_FIELDS:
                update[field] = 1  # first usage today
            else:
                update[field] = data.get(field, 0) + 1
        else:
            update[field] = data.get(field, 0) + 1

        txn.set(ref, update, merge=True)

    await _txn_increment(transaction)
    return await get_usage(uid)


async def decrement_usage(uid: str, action: str) -> dict[str, Any]:
    """Atomically decrement a lifetime counter (e.g. on story delete or unpublish)."""
    db = get_db()
    ref = db.collection("users").document(uid)
    field = _ACTION_FIELD.get(action)
    if not field or field in _DAILY_FIELDS:
        return await get_usage(uid)

    transaction = db.transaction()

    @_firestore.async_transactional
    async def _txn_decrement(txn):
        doc = await ref.get(transaction=txn)
        data = doc.to_dict() if doc.exists else {}
        current = data.get(field, 0)
        if current <= 0:
            return  # nothing to decrement
        txn.set(ref, {field: current - 1, "updated_at": datetime.now(timezone.utc)}, merge=True)

    await _txn_decrement(transaction)
    return await get_usage(uid)


def build_usage_message(usage: dict[str, Any]) -> dict[str, Any]:
    """Build a WS message dict for the frontend."""
    tier = usage.get("tier", "free")
    return {
        "type": "usage_update",
        "usage": usage,
        "limits": get_limits_for_tier(tier),
    }
