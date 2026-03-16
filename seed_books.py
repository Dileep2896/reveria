#!/usr/bin/env python3
"""
Seed Reveria with 9 published books (one per template) from demo accounts.
Uses Firebase Auth REST API + backend WebSocket + publish endpoint.

Usage:
    python seed_books.py                  # run all 9
    python seed_books.py --index 0        # run just the first one
    python seed_books.py --index 3 5      # run indices 3, 4, 5
"""

import argparse
import asyncio
import json
import logging
import os
import sys
import time

import ssl
import certifi
import aiohttp

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("seed")

# ── Config ──────────────────────────────────────────────────────────────────

FIREBASE_API_KEY = os.environ.get("FIREBASE_API_KEY", "")
BACKEND_URL = "https://storyforge-backend-3eapv5svzq-uc.a.run.app"
WS_URL = BACKEND_URL.replace("https://", "wss://") + "/ws"
PUBLISH_URL = BACKEND_URL + "/api/stories"

# 6 demo accounts - load credentials from demo_accounts.env or environment
# Format: DEMO_USER_N_EMAIL, DEMO_USER_N_PASSWORD, DEMO_USER_N_NAME
def _load_accounts():
    """Load demo accounts from environment or demo_accounts.env file."""
    from dotenv import load_dotenv
    env_path = os.path.join(os.path.dirname(__file__), "demo_accounts.env")
    if os.path.exists(env_path):
        load_dotenv(env_path)
    accounts = []
    for i in range(1, 7):
        email = os.environ.get(f"DEMO_USER_{i}_EMAIL", "")
        password = os.environ.get(f"DEMO_USER_{i}_PASSWORD", "")
        name = os.environ.get(f"DEMO_USER_{i}_NAME", f"Demo User {i}")
        if email and password:
            accounts.append({"email": email, "password": password, "name": name})
    return accounts

ACCOUNTS = _load_accounts()

# 9 books — one per template, round-robin across 6 accounts
BOOKS = [
    {
        "account_idx": 0,
        "template": "storybook",
        "art_style": "cinematic",
        "prompt": "A mysterious lighthouse keeper discovers that the light she tends each night doesn't guide ships — it keeps ancient sea creatures sleeping in the deep. Tonight, the bulb is flickering.",
    },
    {
        "account_idx": 1,
        "template": "comic",
        "art_style": "classic_comic",
        "prompt": "A retired superhero running a laundromat gets pulled back into action when villains start using everyday appliances as weapons of mass destruction.",
    },
    {
        "account_idx": 2,
        "template": "webtoon",
        "art_style": "romantic_webtoon",
        "prompt": "A clumsy florist and a stoic tattoo artist share a wall in their tiny shops. Flowers keep appearing on the wrong side, and neither will admit who's leaving them.",
    },
    {
        "account_idx": 3,
        "template": "hero",
        "art_style": "epic_fantasy",
        "prompt": "You are the last cartographer in a world where maps rewrite themselves overnight. Armed with enchanted ink and a compass that points to danger, you must chart the Shifting Realm before it erases itself — and you — forever.",
    },
    {
        "account_idx": 4,
        "template": "manga",
        "art_style": "shonen_manga",
        "prompt": "A transfer student discovers the school's cooking club is actually a front for a secret tournament where chefs battle with dishes that manifest as living creatures.",
    },
    {
        "account_idx": 5,
        "template": "novel",
        "art_style": "oil",
        "prompt": "An antique restorer finds a letter hidden inside a 200-year-old desk. It's addressed to her, by name, warning her about the person she's about to marry.",
    },
    {
        "account_idx": 0,  # Aria gets a second book
        "template": "diary",
        "art_style": "journal_sketch",
        "prompt": "Day one of house-sitting my eccentric grandmother's cottage. She left a note: 'Don't open the blue door. Don't feed the cat after midnight. And whatever you do, don't read the diary under the floorboards.' I've already broken one rule.",
    },
    {
        "account_idx": 1,  # Kai gets a second book
        "template": "poetry",
        "art_style": "impressionist",
        "prompt": "The last train of the evening, an empty platform, the echo of footsteps that aren't yours, and the feeling that someone just whispered your name in the rain.",
    },
    {
        "account_idx": 2,  # Luna gets a second book
        "template": "photojournal",
        "art_style": "photorealistic",
        "prompt": "A documentary following a street musician through the seasons of a single city block — spring buskers, summer crowds, autumn silence, and the first snow when only one listener remains.",
    },
]


async def firebase_sign_in(session: aiohttp.ClientSession, email: str, password: str) -> str:
    """Sign in via Firebase Auth REST API, return ID token."""
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
    payload = {"email": email, "password": password, "returnSecureToken": True}
    async with session.post(url, json=payload) as resp:
        data = await resp.json()
        if "idToken" not in data:
            raise RuntimeError(f"Firebase sign-in failed for {email}: {data.get('error', {}).get('message', data)}")
        logger.info("Signed in as %s", email)
        return data["idToken"]


async def generate_story(session: aiohttp.ClientSession, token: str, book: dict) -> str | None:
    """Connect to WS, send auth + generate, wait for story_id and completion."""
    story_id = None
    done = False
    error_msg = None

    logger.info("Connecting to WS for template=%s ...", book["template"])
    try:
        async with session.ws_connect(WS_URL, timeout=300) as ws:
            # Auth
            await ws.send_json({"type": "auth", "token": token})

            # Small delay for auth processing
            await asyncio.sleep(1)

            # Send generate
            await ws.send_json({
                "content": book["prompt"],
                "art_style": book["art_style"],
                "scene_count": 1,
                "language": "English",
                "template": book["template"],
            })
            logger.info("  Generate sent: %s... (template=%s)", book["prompt"][:50], book["template"])

            # Listen for messages until done
            start = time.time()
            timeout = 300  # 5 min max
            async for msg in ws:
                if time.time() - start > timeout:
                    logger.error("  Timeout waiting for generation")
                    break
                if msg.type == aiohttp.WSMsgType.TEXT:
                    data = json.loads(msg.data)
                    msg_type = data.get("type", "")

                    if msg_type == "story_id":
                        story_id = data.get("content") or data.get("story_id")
                        logger.info("  Got story_id: %s", story_id)
                    elif msg_type == "book_meta":
                        title = data.get("title", "")
                        logger.info("  Book meta: %s", title)
                    elif msg_type == "text":
                        # Scene text streaming — just log first bit
                        text = data.get("content", "")[:60]
                        scene = data.get("scene_number", "?")
                        logger.info("  Scene %s text: %s...", scene, text)
                    elif msg_type == "image":
                        scene = data.get("scene_number", "?")
                        logger.info("  Scene %s image received", scene)
                    elif msg_type == "image_error":
                        scene = data.get("scene_number", "?")
                        reason = data.get("reason", "unknown")
                        logger.warning("  Scene %s image error: %s", scene, reason)
                    elif msg_type == "audio":
                        scene = data.get("scene_number", "?")
                        logger.info("  Scene %s audio received", scene)
                    elif msg_type == "status" and data.get("content") == "done":
                        logger.info("  Generation complete!")
                        done = True
                        break
                    elif msg_type == "error":
                        error_msg = data.get("content", "unknown error")
                        logger.error("  Error: %s", error_msg)
                        break
                elif msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                    logger.error("  WS closed/error")
                    break
    except Exception as e:
        logger.error("  WS error: %s", e)
        return None

    if not done or not story_id:
        logger.error("  Generation failed (done=%s, story_id=%s, error=%s)", done, story_id, error_msg)
        return None

    return story_id


async def publish_story(session: aiohttp.ClientSession, token: str, story_id: str, author_name: str) -> bool:
    """Publish a story via REST endpoint."""
    url = f"{PUBLISH_URL}/{story_id}/publish"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    body = {"author_name": author_name}
    async with session.post(url, headers=headers, json=body) as resp:
        if resp.status == 200:
            data = await resp.json()
            logger.info("  Published! (already_public=%s)", data.get("already_public", False))
            return True
        else:
            text = await resp.text()
            logger.error("  Publish failed (%d): %s", resp.status, text)
            return False


async def process_book(session: aiohttp.ClientSession, idx: int, book: dict) -> bool:
    """Sign in, generate, and publish one book."""
    account = ACCOUNTS[book["account_idx"]]
    logger.info("=" * 60)
    logger.info("Book %d/9: template=%s, account=%s", idx + 1, book["template"], account["name"])
    logger.info("=" * 60)

    # Sign in
    token = await firebase_sign_in(session, account["email"], account["password"])

    # Generate
    story_id = await generate_story(session, token, book)
    if not story_id:
        return False

    # Wait a moment for persistence
    await asyncio.sleep(3)

    # Refresh token (might have expired during long generation)
    token = await firebase_sign_in(session, account["email"], account["password"])

    # Publish
    return await publish_story(session, token, story_id, account["name"])


async def main(indices: list[int] | None = None):
    """Run all or selected books sequentially."""
    if indices is None:
        indices = list(range(len(BOOKS)))

    logger.info("Seeding %d books: indices %s", len(indices), indices)

    results = []
    ssl_ctx = ssl.create_default_context(cafile=certifi.where())
    connector = aiohttp.TCPConnector(ssl=ssl_ctx)
    async with aiohttp.ClientSession(connector=connector) as session:
        for idx in indices:
            if idx < 0 or idx >= len(BOOKS):
                logger.warning("Skipping invalid index %d", idx)
                continue
            success = await process_book(session, idx, BOOKS[idx])
            results.append((idx, BOOKS[idx]["template"], success))
            if idx != indices[-1]:
                logger.info("Waiting 5s before next book...")
                await asyncio.sleep(5)

    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("RESULTS:")
    for idx, template, success in results:
        status = "OK" if success else "FAILED"
        logger.info("  [%s] Book %d - %s", status, idx + 1, template)
    logger.info("=" * 60)

    failed = sum(1 for _, _, s in results if not s)
    if failed:
        logger.warning("%d/%d books failed", failed, len(results))
    else:
        logger.info("All %d books seeded and published!", len(results))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed Reveria with published demo books")
    parser.add_argument("--index", type=int, nargs="+", help="Specific book indices to run (0-8)")
    args = parser.parse_args()

    indices = None
    if args.index is not None:
        indices = args.index

    asyncio.run(main(indices))
