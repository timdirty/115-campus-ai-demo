---
name: guide-update
description: "End-to-end update of the GitHub Pages competition guide for this 115 project. Use when the user says 更新 guide、重拍截圖、更新 app2 的 guide、全面更新、批量更新. Accepts a target app (app1, app2, app3) or all. Workflow steps: audit app-catalog.mjs → fix content → retake screenshots → commit & push."
---

# Guide Update Skill

End-to-end: audit → fix catalog → retake screenshots → commit & push.  
Target: `app1` | `app2` | `app3` | `all` (ask user if not specified).

## Step 1 — Audit

Read `scripts/app-catalog.mjs` for the target app(s).  
See `references/catalog-schema.md` for field meanings and audit rules.  
See `references/command-sources.md` for real hardware command names.

Check each route entry:
- `hardware: []` — match against real firmware / appState commands
- `screenshots: []` — every filename must exist in `assets/screenshots/`
- `demoScript` / `summary` — purge any EV3, LEGO, SPIKE references
- `startUrl` — verify hash route exists in the app router

List all discrepancies before touching anything.

## Step 2 — Fix catalog

Edit `scripts/app-catalog.mjs` to fix the discrepancies found in Step 1.  
Keep edits minimal and precise — one issue at a time.

## Step 3 — Retake screenshots

```bash
cd "/Volumes/Tim aaddtional/Download/115資通訊/tedt"
python3 .skillshare/skills/guide-update/scripts/retake_screenshots.py --app <target>
# target = app1 | app2 | app3 | all | app1,app2
```

**Prerequisites**: `playwright` Python package installed (`pip install playwright && playwright install chromium`).  
The script starts `npm run dev:web` (Vite only, no bridge) on port 3000, captures each route, then stops.

**Dynamic-state screenshots** (e.g., `app2-attend.png`, `app2-teach-done.png`, `app2-life-vision.png`) are captured at a scrolled position of the relevant route — the script approximates these. If the scroll guess is wrong, adjust the `scroll` value in the script's `APP_CONFIG` for that entry and re-run.

After running, verify outputs:
```bash
ls -lh assets/screenshots/ | grep app2
```

## Step 4 — TypeScript check

```bash
cd apps/app2-campus-service && npm run check  # or app1 / app3 as needed
```

Skip if only catalog / screenshot changes (no TS source touched).

## Step 5 — Commit & push

```bash
cd "/Volumes/Tim aaddtional/Download/115資通訊/tedt"
git add scripts/app-catalog.mjs assets/screenshots/
git commit -m "guide(<app>): <one-line summary of what changed>"
git push origin main
```

GitHub Actions rebuilds `pages-dist/` and deploys. Verify at:  
`https://timdirty.github.io/115-campus-ai-demo/<app>-guide.html`

## Reference files

- `references/catalog-schema.md` — app-catalog.mjs field reference + audit rules
- `references/command-sources.md` — real firmware command names per app
