#!/usr/bin/env python3
"""
Auth flow regression tests: login, logout, session expiry, protected-route guard.

Usage:
    python3 scripts/test_auth_flows.py                      # against http://localhost:8080
    BASE_URL=https://example.com python3 scripts/test_auth_flows.py

Env:
    BASE_URL        default http://localhost:8080
    ADMIN_EMAIL     default removalwork59@gmail.com
    ADMIN_PASSWORD  required
    ARTIFACTS_DIR   default auth-artifacts (screenshots + console logs on failure)

Exit code 0 = all flows OK, 1 = at least one failure.
Requires: playwright (python) with chromium installed.
"""
import asyncio
import json
import os
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:8080").rstrip("/")
EMAIL = os.environ.get("ADMIN_EMAIL", "removalwork59@gmail.com")
PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
ARTIFACTS = Path(os.environ.get("ARTIFACTS_DIR", "auth-artifacts"))

results = []  # (name, ok, detail)


def record(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'} {name}" + (f" — {detail}" if detail else ""))


async def save_artifacts(page, console_msgs, slug):
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    try:
        await page.screenshot(path=str(ARTIFACTS / f"{slug}.png"))
    except Exception:
        pass
    (ARTIFACTS / f"{slug}-console.log").write_text("\n".join(console_msgs) or "(no console output)")


async def fill_login(page, email, password):
    await page.goto(f"{BASE}/auth", wait_until="domcontentloaded")
    await page.wait_for_timeout(3000)
    await page.get_by_label("Username / Email").fill(email, timeout=15000)
    await page.get_by_label("Password").fill(password)
    await page.get_by_role("button", name="Sign in").click()
    await page.wait_for_timeout(5000)


async def main():
    if not PASSWORD:
        print("ADMIN_PASSWORD is required for auth flow tests")
        sys.exit(1)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # --- 1. Wrong password is rejected with an error message ---
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        console = []
        page.on("console", lambda m: console.append(f"[{m.type}] {m.text[:200]}"))
        page.on("pageerror", lambda e: console.append(f"[pageerror] {str(e)[:200]}"))
        try:
            await fill_login(page, EMAIL, "definitely-wrong-password-999")
            body = (await page.evaluate("document.body.innerText")).lower()
            ok = "/auth" in page.url and ("invalid" in body or "incorrect" in body or "wrong" in body)
            record("wrong password rejected", ok, f"url={page.url}")
            if not ok:
                await save_artifacts(page, console, "wrong-password")
        except Exception as e:
            record("wrong password rejected", False, str(e)[:150])
            await save_artifacts(page, console, "wrong-password")
        await ctx.close()

        # --- 2. Correct login reaches the dashboard ---
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        console = []
        page.on("console", lambda m: console.append(f"[{m.type}] {m.text[:200]}"))
        page.on("pageerror", lambda e: console.append(f"[pageerror] {str(e)[:200]}"))
        logged_in = False
        for attempt in range(3):
            await fill_login(page, EMAIL, PASSWORD)
            if "/auth" not in page.url:
                logged_in = True
                break
            print(f"login retry {attempt + 1}")
        record("correct login reaches dashboard", logged_in, f"url={page.url}")
        if not logged_in:
            await save_artifacts(page, console, "login")
            await browser.close()
            print("\nAUTH TESTS FAILED: cannot log in, remaining flows skipped")
            sys.exit(1)

        # --- 3. Authenticated user visiting /auth is bounced away (session-aware) ---
        try:
            await page.goto(f"{BASE}/auth", wait_until="domcontentloaded")
            await page.wait_for_timeout(4000)
            ok = "/auth" not in page.url
            record("signed-in user redirected away from /auth", ok, f"url={page.url}")
            if not ok:
                await save_artifacts(page, console, "auth-redirect")
        except Exception as e:
            record("signed-in user redirected away from /auth", False, str(e)[:150])
            await save_artifacts(page, console, "auth-redirect")

        # --- 4. Session expiry: wipe the stored session, protected route must redirect to /auth ---
        try:
            await page.goto(f"{BASE}/dashboard", wait_until="domcontentloaded")
            await page.wait_for_timeout(2500)
            keys = await page.evaluate(
                "Object.keys(window.localStorage).filter(k => k.includes('auth') || k.startsWith('sb-'))"
            )
            await page.evaluate(
                "Object.keys(window.localStorage).filter(k => k.includes('auth') || k.startsWith('sb-')).forEach(k => window.localStorage.removeItem(k))"
            )
            await page.reload(wait_until="domcontentloaded")
            await page.wait_for_timeout(5000)
            ok = "/auth" in page.url
            record("expired session redirects to /auth", ok, f"cleared keys={keys}, url={page.url}")
            if not ok:
                await save_artifacts(page, console, "session-expiry")
        except Exception as e:
            record("expired session redirects to /auth", False, str(e)[:150])
            await save_artifacts(page, console, "session-expiry")
        await ctx.close()

        # --- 5. Logout: fresh login, sign out, protected route must redirect to /auth ---
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        console = []
        page.on("console", lambda m: console.append(f"[{m.type}] {m.text[:200]}"))
        page.on("pageerror", lambda e: console.append(f"[pageerror] {str(e)[:200]}"))
        try:
            for attempt in range(3):
                await fill_login(page, EMAIL, PASSWORD)
                if "/auth" not in page.url:
                    break
                print(f"login retry {attempt + 1}")
            # Click the logout button in the sidebar
            logout_btn = page.get_by_role("button", name="Logout")
            if not await logout_btn.count():
                logout_btn = page.get_by_role("button", name="Log out")
            await logout_btn.first.click(timeout=10000)
            await page.wait_for_timeout(4000)
            logged_out = "/auth" in page.url
            # After logout, a protected route must not be reachable
            await page.goto(f"{BASE}/dashboard", wait_until="domcontentloaded")
            await page.wait_for_timeout(4000)
            guarded = "/auth" in page.url
            ok = logged_out and guarded
            record("logout signs out and protects routes", ok, f"after logout url ok={logged_out}, dashboard guard ok={guarded}")
            if not ok:
                await save_artifacts(page, console, "logout")
        except Exception as e:
            record("logout signs out and protects routes", False, str(e)[:150])
            await save_artifacts(page, console, "logout")
        await ctx.close()

        await browser.close()

    failed = [r for r in results if not r[1]]
    if failed:
        print(f"\nAUTH TESTS FAILED: {len(failed)}/{len(results)} flow(s) failed: {[r[0] for r in failed]}")
        sys.exit(1)
    print(f"\nAUTH TESTS PASSED: all {len(results)} flows OK")


asyncio.run(main())
