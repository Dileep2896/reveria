"""Lightweight retry helpers for transient GCP / AI service errors."""

import asyncio
import logging
import random

logger = logging.getLogger("storyforge.retry")


def is_transient(exc: Exception) -> bool:
    """Return True if *exc* looks like a transient server / rate-limit error."""
    msg = str(exc).lower()
    for keyword in ("429", "500", "503", "unavailable", "resource_exhausted", "deadline exceeded"):
        if keyword in msg:
            return True
    return False


async def with_retries(
    coro_factory,
    *,
    attempts: int = 3,
    base_delay: float = 1.0,
    jitter: float = 0.3,
    label: str = "operation",
    skip_exc_types: tuple = (),
):
    """Call *coro_factory()* up to *attempts* times on transient failures.

    *coro_factory* is a zero-arg callable returning an awaitable (so the
    coroutine is freshly created on each retry).

    Exceptions matching *skip_exc_types* are never retried.
    """
    last_exc: Exception | None = None
    for attempt in range(attempts):
        try:
            return await coro_factory()
        except skip_exc_types:
            raise
        except Exception as exc:
            last_exc = exc
            if not is_transient(exc) or attempt >= attempts - 1:
                raise
            delay = base_delay * (2 ** attempt) + random.uniform(0, base_delay * jitter)
            logger.warning(
                "%s transient error (attempt %d/%d), retrying in %.1fs: %s",
                label, attempt + 1, attempts, delay, exc,
            )
            await asyncio.sleep(delay)
    raise last_exc  # type: ignore[misc]
