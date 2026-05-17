#!/usr/bin/env python3
"""
Retake guide screenshots for one or all apps.

Usage:
  python retake_screenshots.py --app app2
  python retake_screenshots.py --app all
  python retake_screenshots.py --app app1,app3

Each app's Vite dev server starts on port 3000 (frontend only, no bridge).
Apps run sequentially (all share port 3000).
"""
import argparse
import subprocess
import sys
import time
from pathlib import Path

# --- paths ---
SCRIPT_DIR = Path(__file__).parent
SKILL_DIR = SCRIPT_DIR.parent
PROJECT_ROOT = SKILL_DIR.parent.parent.parent  # .skillshare/skills/guide-update → project root
SCREENSHOTS_DIR = PROJECT_ROOT / "assets" / "screenshots"
PORT = 3000

APP_CONFIG = {
    "app1": {
        "dir": PROJECT_ROOT / "apps" / "app1-whiteboard",
        "shots": [
            {"file": "app1-step1.png", "hash": "",            "label": "首頁"},
            {"file": "app1-step2.png", "hash": "#whiteboard", "label": "白板辨識"},
            {"file": "app1-step3.png", "hash": "#robot",      "label": "機器人面板"},
            {"file": "app1-step4.png", "hash": "#chat",       "label": "AI 問答"},
        ],
    },
    "app2": {
        "dir": PROJECT_ROOT / "apps" / "app2-campus-service",
        "shots": [
            {"file": "app2-step1.png",       "hash": "",          "label": "首頁"},
            {"file": "app2-step2.png",       "hash": "#teach",    "label": "教學首頁"},
            {"file": "app2-step3.png",       "hash": "#delivery", "label": "配送首頁"},
            {"file": "app2-step4.png",       "hash": "#teach",    "label": "教學詳頁"},
            {"file": "app2-step5.png",       "hash": "#delivery", "label": "配送詳頁"},
            {"file": "app2-step6.png",       "hash": "#student",  "label": "生活服務"},
            {"file": "app2-attend.png",      "hash": "#teach",    "label": "點名面板",   "scroll": 400},
            {"file": "app2-teach-done.png",  "hash": "#teach",    "label": "教學完成",   "scroll": 800},
            {"file": "app2-life-vision.png", "hash": "#student",  "label": "影像辨識",   "scroll": 400},
        ],
    },
    "app3": {
        "dir": PROJECT_ROOT / "apps" / "app3-guardian",
        "shots": [
            {"file": "app3-step1.png", "hash": "",        "label": "首頁"},
            {"file": "app3-step2.png", "hash": "#care",   "label": "情緒關懷"},
            {"file": "app3-step3.png", "hash": "#sensing","label": "感測區"},
            {"file": "app3-step4.png", "hash": "#alerts", "label": "警報"},
        ],
    },
}


def wait_for_server(port: int, timeout: int = 20) -> bool:
    import socket
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(("localhost", port), timeout=1):
                return True
        except OSError:
            time.sleep(0.5)
    return False


def take_shots(app_id: str, config: dict) -> list[str]:
    from playwright.sync_api import sync_playwright

    app_dir = config["dir"]
    shots = config["shots"]

    print(f"\n[{app_id}] Starting Vite dev server…")
    proc = subprocess.Popen(
        ["npm", "run", "dev:web"],
        cwd=app_dir,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    try:
        if not wait_for_server(PORT):
            print(f"[{app_id}] ERROR: server did not start on :{PORT}", file=sys.stderr)
            return []

        SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
        taken = []

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 800})

            for shot in shots:
                url = f"http://localhost:{PORT}/{shot['hash']}"
                print(f"  [{app_id}] {shot['label']} → {shot['hash'] or '/'}")
                page.goto(url)
                page.wait_for_load_state("networkidle", timeout=8000)
                time.sleep(0.8)

                if shot.get("scroll"):
                    page.evaluate(f"window.scrollTo(0, {shot['scroll']})")
                    time.sleep(0.4)

                out = SCREENSHOTS_DIR / shot["file"]
                page.screenshot(path=str(out), full_page=False)
                taken.append(shot["file"])
                print(f"  [{app_id}] ✓ {shot['file']}")

            browser.close()

        return taken

    finally:
        proc.terminate()
        proc.wait()
        print(f"[{app_id}] Server stopped.")


def main():
    parser = argparse.ArgumentParser(description="Retake guide screenshots")
    parser.add_argument(
        "--app",
        default="all",
        help="app1 | app2 | app3 | all | comma-separated e.g. app1,app3",
    )
    args = parser.parse_args()

    targets = (
        list(APP_CONFIG.keys())
        if args.app == "all"
        else [a.strip() for a in args.app.split(",")]
    )

    invalid = [a for a in targets if a not in APP_CONFIG]
    if invalid:
        print(f"Unknown app(s): {invalid}. Valid: {list(APP_CONFIG.keys())}", file=sys.stderr)
        sys.exit(1)

    all_taken = []
    for app_id in targets:
        taken = take_shots(app_id, APP_CONFIG[app_id])
        all_taken.extend(taken)

    print(f"\nDone. {len(all_taken)} screenshot(s) saved to assets/screenshots/")
    for f in all_taken:
        print(f"  {f}")


if __name__ == "__main__":
    main()
