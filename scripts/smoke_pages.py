#!/usr/bin/env python3
"""
Smoke test: open + refresh every public and login-required page, fail on blank screens.

Usage:
    python3 scripts/smoke_pages.py                      # against http://localhost:8080
    BASE_URL=https://example.com python3 scripts/smoke_pages.py

Env:
    BASE_URL      default http://localhost:8080
    ADMIN_EMAIL   default removalwork59@gmail.com
    ADMIN_PASSWORD  required for private pages (dev only)

Exit code 0 = all pages OK, 1 = at least one blank page or page error.
Requires: playwright (python) with chromium installed.
"""
import asyncio
import os
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:8080").rstrip("/")
EMAIL = os.environ.get("ADMIN_EMAIL", "removalwork59@gmail.com")
PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
ARTIFACTS = Path(os.environ.get("ARTIFACTS_DIR", "smoke-artifacts"))

PUBLIC = ["/", "/auth", "/privacy", "/terms", "/responsible-use", "/contact"]
PRIVATE = ["/dashboard", "/scan", "/history", "/reports", "/settings", "/profile"]

MIN_TEXT_LEN = 20  # a rendered page always has more text than this


def slug(route):
    return route.strip("/").replace("/", "-") or "home"


async def check_page(page, route, failures, console_msgs):
    await page.goto(f"{BASE}{route}", wait_until="domcontentloaded")
    await page.wait_for_timeout(3000)
    await page.reload(wait_until="domcontentloaded")
    await page.wait_for_timeout(3000)
    text_len = await page.evaluate("document.body.innerText.trim().length")
    ok = text_len >= MIN_TEXT_LEN
    print(f"{'PASS' if ok else 'FAIL'} {route} (text length after refresh: {text_len})")
    if not ok:
        failures.append(route)
        ARTIFACTS.mkdir(parents=True, exist_ok=True)
        try:
            await page.screenshot(path=str(ARTIFACTS / f"{slug(route)}.png"))
        except Exception:
            pass
        (ARTIFACTS / f"{slug(route)}-console.log").write_text(
            "\n".join(console_msgs) or "(no console output)"
        )


async def main():
    failures = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        page_errors = []
        page.on("pageerror", lambda e: page_errors.append(str(e)[:200]))

        if PASSWORD:
            for attempt in range(3):
                await page.goto(f"{BASE}/auth", wait_until="domcontentloaded")
                await page.wait_for_timeout(3000)
                await page.get_by_label("Username / Email").fill(EMAIL, timeout=15000)
                await page.get_by_label("Password").fill(PASSWORD)
                await page.get_by_role("button", name="Sign in").click()
                await page.wait_for_timeout(6000)
                if "/auth" not in page.url:
                    break
                print(f"login retry {attempt + 1}")
            if "/auth" in page.url:
                print("FAIL could not sign in — skipping private pages")
                failures.extend(PRIVATE)
        else:
            print("ADMIN_PASSWORD not set — skipping private pages")

        for route in PUBLIC + (PRIVATE if PASSWORD else []):
            try:
                await check_page(page, route, failures)
            except Exception as e:
                print(f"FAIL {route} (exception: {str(e)[:150]})")
                failures.append(route)

        if page_errors:
            print("page errors seen:", page_errors[:5])
            failures.append("__pageerrors__")

        await browser.close()

    if failures:
        print(f"\nSMOKE TEST FAILED: {len(failures)} problem(s): {failures}")
        sys.exit(1)
    print("\nSMOKE TEST PASSED: all pages render after refresh")


asyncio.run(main())
