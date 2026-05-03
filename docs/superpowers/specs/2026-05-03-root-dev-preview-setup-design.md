# Root Dev + Preview Setup — Design Spec

**Date:** 2026-05-03
**Status:** Approved

## Goal

Let the developer start all three apps together from the repo root and test both:
- **Dev mode** — hot reload, instant code feedback
- **Preview mode** — unified GitHub Pages experience locally

## Port Scheme

All ports use the `115xx` prefix to avoid conflicts with common dev services.

| App / Mode | Port |
|---|---|
| App 1 (Vite frontend) | 11501 |
| App 2 | 11502 |
| App 3 | 11503 |
| `preview` serve (pages-dist) | 11500 |

App 1's serialBridge runs internally as part of `npm run dev` inside app1's own concurrently setup — no separate external port needed.

## Root `package.json` Scripts

```json
{
  "scripts": {
    "dev":     "concurrently with color-coded prefix for App1/App2/App3",
    "preview": "node scripts/build-github-pages.mjs && serve pages-dist -p 11500",
    "build":   "node scripts/build-github-pages.mjs",
    "check":   "sequential npm run check across all three apps"
  },
  "devDependencies": {
    "concurrently": "^9.x",
    "serve": "^14.x"
  }
}
```

### `dev` detail

Uses `concurrently` with:
- `--names "App1,App2,App3"`
- `--prefix-colors "green,blue,teal"`
- `--kill-others-on-fail` — if one app crashes, stop all

Port overrides are passed via CLI flags (`--port 11501` etc.) so app-level `package.json` files are not modified.

### `check` detail

Runs sequentially (not parallel) so failures are clearly attributed to one app:

```
npm run check --prefix <app1_dir>
npm run check --prefix <app2_dir>
npm run check --prefix <app3_dir>
```

Stops on first failure. Exit code propagates for CI use.

### `preview` detail

1. Runs `build-github-pages.mjs` (already handles npm build for all three apps + copies to pages-dist)
2. Serves `pages-dist/` at port 11500
3. Unified entry at `http://localhost:11500` — identical to GitHub Pages layout

## Files Changed

| File | Action |
|---|---|
| `/package.json` | Create new (root level) |
| No app-level files changed | Port overrides via CLI args only |

## What Is NOT Changed

- App 1's `package.json` / `vite.config.ts` — not touched
- App 2's `package.json` / `vite.config.ts` — not touched
- App 3's `package.json` / `vite.config.ts` — not touched
- `scripts/build-github-pages.mjs` — not touched
- CI workflow — `check` script is compatible with existing CI gate

## Success Criteria

1. `npm run dev` from repo root starts all three apps, each clearly labeled in terminal
2. Hot reload works in each app independently
3. `npm run preview` produces the same layout as `https://timdirty.github.io/115-campus-ai-demo/`
4. `npm run check` runs all three CI gates and stops on first failure
5. No app-level `package.json` is modified
