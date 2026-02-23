"""Shared test fixtures — mocks Firebase Admin, Firestore, and auth."""

import os

# Set env vars before any app imports trigger lazy init
os.environ.setdefault("FIREBASE_PROJECT_ID", "test-project")

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _empty_async_iter():
    """Async generator that yields nothing (mocks Firestore .stream())."""
    return
    yield  # noqa: unreachable — makes this an async generator


def _make_snapshot(*, exists=False, data=None):
    snap = MagicMock()
    snap.exists = exists
    snap.to_dict.return_value = data or {}
    snap.id = "mock-doc-id"
    return snap


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def mock_firestore():
    """Replace the Firestore singleton with a chainable mock.

    Default behaviour: every document lookup returns exists=False.
    """
    import services.firestore_client as fc

    mock_db = MagicMock()

    not_found = _make_snapshot(exists=False)

    # doc_ref: db.collection(x).document(y)
    mock_doc_ref = MagicMock()
    mock_doc_ref.get = AsyncMock(return_value=not_found)
    mock_doc_ref.set = AsyncMock()
    mock_doc_ref.update = AsyncMock()
    mock_doc_ref.delete = AsyncMock()

    # sub-collection off a document
    sub_col = MagicMock()
    sub_col.document.return_value = mock_doc_ref
    sub_col.order_by.return_value = sub_col
    sub_col.limit.return_value = sub_col
    sub_col.where.return_value = sub_col
    sub_col.stream = _empty_async_iter

    mock_doc_ref.collection.return_value = sub_col

    # top-level collection
    mock_col = MagicMock()
    mock_col.document.return_value = mock_doc_ref
    mock_col.where.return_value = mock_col
    mock_col.order_by.return_value = mock_col
    mock_col.limit.return_value = mock_col
    mock_col.stream = _empty_async_iter

    mock_db.collection.return_value = mock_col

    original = fc._db
    fc._db = mock_db
    yield mock_db
    fc._db = original


@pytest.fixture()
def auth_headers():
    """Patch Firebase token verification and return valid Bearer headers.

    Routes call ``services.auth.verify_token`` which internally calls
    ``firebase_admin.auth.verify_id_token``.  We mock the underlying
    Firebase call so every router that imported ``verify_token`` sees
    the mock without needing per-module patches.
    """
    import services.auth

    # Prevent _ensure_init from calling firebase_admin.initialize_app
    services.auth._initialized = True

    fake_claims = {
        "uid": "test-uid",
        "name": "Test User",
        "email": "test@test.com",
        "picture": None,
    }

    with patch("firebase_admin.auth.verify_id_token", return_value=fake_claims):
        yield {"authorization": "Bearer test-token"}


@pytest.fixture()
async def client():
    """Async httpx client wired to the FastAPI app."""
    from main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
