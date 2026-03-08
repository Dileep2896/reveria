"""REST route smoke tests — auth enforcement and 404 handling."""

import pytest


# ---------------------------------------------------------------------------
# Public routes — no auth required
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_public_story_not_found(client, mock_firestore):
    """GET /api/public/stories/<id> returns 404 when story doesn't exist."""
    resp = await client.get("/api/public/stories/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_social_stats_not_found(client, mock_firestore):
    """GET /api/public/stories/<id>/social returns 404 for missing story."""
    resp = await client.get("/api/public/stories/xxx/social")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_comments_nonexistent_story(client, mock_firestore):
    """GET /api/public/stories/<id>/comments returns 404 for nonexistent story."""
    resp = await client.get("/api/public/stories/xxx/comments")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Auth enforcement — missing header → 422
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delete_story_no_auth(client):
    """DELETE /api/stories/<id> without auth header → 422."""
    resp = await client.delete("/api/stories/xxx")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_get_usage_no_auth(client):
    """GET /api/usage without auth header → 422."""
    resp = await client.get("/api/usage")
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Authenticated routes — valid token, resource doesn't exist
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_bookmark_returns_null_for_missing(client, mock_firestore, auth_headers):
    """GET /api/stories/<id>/bookmark with auth returns scene_index: null."""
    resp = await client.get("/api/stories/xxx/bookmark", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["scene_index"] is None


@pytest.mark.asyncio
async def test_delete_story_not_found(client, mock_firestore, auth_headers):
    """DELETE /api/stories/<id> with valid auth but missing story → 404."""
    resp = await client.delete("/api/stories/xxx", headers=auth_headers)
    assert resp.status_code == 404
