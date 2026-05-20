# Root Dev + Preview Setup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a root `package.json` so all three apps can be started together with `npm run dev`, tested as a unified bundle with `npm run preview`, and CI-checked with `npm run check`.

**Architecture:** Root `package.json` delegates to three app-level npm projects via `--prefix`. A dedicated `scripts/dev-all.mjs` uses concurrently's JS API to handle paths with spaces and Chinese characters cleanly — avoids shell quoting hell. Preview reuses the existing `build-github-pages.mjs` + `serve`.

**Tech Stack:** Node.js 25, concurrently@9, serve@14, Vite (per-app, already installed)

---

## Port Map

| App / Service | Port |
|---|---|
| App 1 Vite frontend | 11501 |
| App 1 serialBridge | 3200 (unchanged, controlled by BRIDGE_PORT env) |
| App 2 Vite | 11502 |
| App 3 Vite | 11503 |
| `preview` serve | 11500 |

## Files

| File | Action |
|---|---|
| `/package.json` | **Create** — root scripts entry point |
| `scripts/dev-all.mjs` | **Create** — concurrently JS API wrapper for dev mode |

No app-level files are changed. Port overrides are passed via CLI args.

---

### Task 1: Create `scripts/dev-all.mjs`

**Files:**
- Create: `scripts/dev-all.mjs`

This script uses concurrently's JS API instead of the CLI to avoid shell quoting issues with space/CJK characters in directory names.

- [ ] **Step 1: Create the file**

```js
#!/usr/bin/env node
import concurrently from 'concurrently';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const APP1 = path.join(root, 'google ai studio/app_1（國小）/AI自動板擦機器人');
const APP2 = path.join(root, 'google ai studio/app_2（國小）/校園服務機器人 app');
const APP3 = path.join(root, 'google ai studio/app_3（國中）/AI校園心靈守護者');

const {result} = concurrently(
  [
    {command: 'npm run dev:web -- --port 11501', cwd: APP1, name: 'App1-Web', prefixColor: 'green'},
    {command: 'npm run dev:bridge', cwd: APP1, name: 'App1-Bridge', prefixColor: 'cyan'},
    {command: 'npm run dev -- --port 11502', cwd: APP2, name: 'App2', prefixColor: 'blue'},
    {command: 'npm run dev -- --port 11503', cwd: APP3, name: 'App3', prefixColor: 'magenta'},
  ],
  {
    killOthers: ['failure'],
    prefix: 'name',
    timestampFormat: 'HH:mm:ss',
  },
);

result.then(() => process.exit(0)).catch(() => process.exit(1));
```

- [ ] **Step 2: Verify file exists**

```bash
ls scripts/dev-all.mjs
```

Expected: file listed, no error.

- [ ] **Step 3: Commit**

```bash
git add scripts/dev-all.mjs
git commit -m "feat: add dev-all.mjs for concurrent app launch"
```

---

### Task 2: Create root `package.json`

**Files:**
- Create: `/package.json`

- [ ] **Step 1: Create the file**

```json
{
  "name": "115-campus-ai-demo",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "node scripts/dev-all.mjs",
    "preview": "node scripts/build-github-pages.mjs && npx serve pages-dist -p 11500",
    "build": "node scripts/build-github-pages.mjs",
    "check": "npm run check --prefix \"google ai studio/app_1（國小）/AI自動板擦機器人\" && npm run check --prefix \"google ai studio/app_2（國小）/校園服務機器人 app\" && npm run check --prefix \"google ai studio/app_3（國中）/AI校園心靈守護者\""
  },
  "devDependencies": {
    "concurrently": "^9.2.1",
    "serve": "^14.2.6"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run from repo root:

```bash
npm install
```

Expected: `node_modules/` created at root with `concurrently` and `serve`. No errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add root package.json with dev/preview/check/build scripts"
```

---

### Task 3: Add `node_modules` to `.gitignore`

**Files:**
- Modify: `.gitignore`

Root-level `node_modules` must not be committed.

- [ ] **Step 1: Check current .gitignore**

```bash
grep "node_modules" .gitignore
```

Expected output: `node_modules` or `/node_modules` already present (the existing app-level node_modules are already excluded). If the line already covers root-level, skip Step 2.

- [ ] **Step 2: Confirm coverage**

The entry `node_modules` (without leading `/`) in `.gitignore` already excludes ALL `node_modules` directories recursively, including the new root one. No change needed if this pattern exists.

If the line reads `/node_modules` (leading slash, anchored to root), that still covers the root `node_modules`. Confirm with:

```bash
git status --short | grep node_modules
```

Expected: no `node_modules` files appear as untracked. If they do, add a line:

```
/node_modules
```

to `.gitignore`, then:

```bash
git add .gitignore
git commit -m "chore: exclude root node_modules"
```

---

### Task 4: Smoke-test `npm run dev`

- [ ] **Step 1: Start dev servers**

From repo root, in a terminal:

```bash
npm run dev
```

Expected: concurrently starts four processes. Terminal shows color-coded output:

```
[App1-Web]   VITE v6.x  ready in ... ms  →  Local: http://localhost:11501/
[App1-Bridge] Arduino serial bridge listening on http://localhost:3200
[App2]   VITE v6.x  ready in ... ms  →  Local: http://localhost:11502/
[App3]   VITE v6.x  ready in ... ms  →  Local: http://localhost:11503/
```

- [ ] **Step 2: Verify each app loads**

Open each URL in a browser and confirm the app renders:

- `http://localhost:11501` → AI 自動板擦機器人
- `http://localhost:11502` → 校園服務機器人
- `http://localhost:11503` → AI 校園心靈守護者

- [ ] **Step 3: Stop servers**

Press `Ctrl+C` in the terminal. All four processes should exit cleanly.

---

### Task 5: Smoke-test `npm run preview`

- [ ] **Step 1: Run preview**

From repo root:

```bash
npm run preview
```

Expected:
1. `build-github-pages.mjs` runs — all three apps build, output copied to `pages-dist/`
2. `serve` starts: `Serving! → Local: http://localhost:11500`

- [ ] **Step 2: Verify unified entry**

Open `http://localhost:11500` in a browser.

Expected: the entry page with three app cards (same layout as `https://timdirty.github.io/115-campus-ai-demo/`). Each card's "開啟操作" button opens the respective app.

- [ ] **Step 3: Stop server**

Press `Ctrl+C`.

---

### Task 6: Smoke-test `npm run check`

- [ ] **Step 1: Run check**

From repo root:

```bash
npm run check
```

Expected: all three apps' check scripts run in sequence (TypeScript lint + tests + build for each). Final output shows no errors. Exit code 0.

- [ ] **Step 2: Confirm sequential behaviour**

If any app's check fails, the chain stops at that app and prints the error. This is correct — verify by checking that only one app's output appears after a failure (no need to simulate failure, just confirm the `&&` chaining in package.json).

---

### Task 7: Update CLAUDE.md with new root commands

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add root commands section**

In `CLAUDE.md`, find the existing "App Commands" table and add a new section above it:

```markdown
## Root Commands (run from repo root)

| Command | Effect |
|---|---|
| `npm run dev` | Start all three apps concurrently (ports 11501 / 11502 / 11503) |
| `npm run preview` | Rebuild pages-dist + serve at http://localhost:11500 |
| `npm run build` | Rebuild pages-dist only (no server) |
| `npm run check` | Run all three apps' CI gates in sequence |
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document root npm scripts in CLAUDE.md"
```

---

## Self-Review

**Spec coverage:**
- ✅ `dev` — hot reload, all three apps, 115xx ports
- ✅ `preview` — unified entry matching GitHub Pages
- ✅ `build` — alias for existing script
- ✅ `check` — sequential CI gate
- ✅ Port scheme (11500–11503) — no common conflicts
- ✅ App-level package.json files not modified

**Placeholder scan:** None found.

**Type consistency:** No shared types — this is a scripts-only change.
