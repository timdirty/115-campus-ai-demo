# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Three competition apps (two 國小, one 國中) sharing one Arduino UNO R4 WiFi firmware. All three apps send Serial commands through App 1's Node.js bridge (`server/serialBridge.ts`), which is the shared hardware gateway.

- **App 1** `google ai studio/app_1（國小）/AI自動板擦機器人` — AI whiteboard assistant. Has both a Vite frontend (`npm run dev:web`, port 3000) and a Node.js Express/serialport bridge server (`npm run dev:bridge`). Production: `npm run build && BRIDGE_PORT=3200 NODE_ENV=production npm run start`.
- **App 2** `google ai studio/app_2（國小）/校園服務機器人 app` — Campus service robot. Pure frontend, `npm run dev`.
- **App 3** `google ai studio/app_3（國中）/AI校園心靈守護者` — Guardian app with Firebase. Pure frontend, `npm run dev`.

## Environment

- macOS / zsh
- PlatformIO Core installed through Homebrew
- Do not install PlatformIO with `python3 -m pip install platformio`
- Board id: `uno_r4_wifi`, framework: `arduino`, monitor speed: `115200`

## Safety Rules

- Do not delete existing project files unless explicitly asked.
- Keep `platformio.ini`, `src/`, `include/`, `lib/`, and `test/` as project paths, not shell commands.
- Prefer small, reversible edits.
- After firmware changes, run `pio run` and fix compile errors before reporting completion.

## Firmware Commands

```zsh
pio run
pio run -t upload
pio device monitor -b 115200
pio run -t clean
zsh scripts/doctor.sh
```

## Firmware Architecture

- `src/main.cpp`: Serial entry point; reads newline-terminated commands and calls `handleCommand()`.
- `src/commands.cpp`: Single `handleCommand()` dispatch for all three apps. Hardware: LED_BUILTIN + Servo on D9 + LED matrix.
- `src/matrix_show.cpp`: LED matrix animation (`setMatrixShowEnabled`, `triggerFireworks`, `resetMatrixShow`).
- All Serial commands use `UPPER_SNAKE_CASE`. Adding a command requires: new `else if` branch in `handleCommand()`, entry in the `printReadyMessage()` list, and sync with App 1 bridge catalog.

## Root Commands (run from repo root)

| Command | Effect |
|---|---|
| `npm run dev` | Start all three apps concurrently (App1: 11501, App2: 11502, App3: 11503; bridge: 3200) |
| `npm run preview` | Rebuild pages-dist + serve unified entry at http://localhost:11500 |
| `npm run build` | Rebuild pages-dist only (no server) |
| `npm run check` | Run all three apps' CI gates in sequence |

## App Commands (per-app, run from each app directory)

| Command | Effect |
|---|---|
| `npm run dev` | Start dev server (port 3000) |
| `npm run check` | Type-check + tests + build (CI gate) |
| `npm run build` | Production build |
| `npm run lint` | TypeScript type-check only |
| `npm run test` | Unit tests (App 2 & 3 only) |

App 1 also has `npm run dev:web` (Vite) and `npm run dev:bridge` (serialBridge) started together by `npm run dev`.

## Verify Command Catalog

After editing commands in `src/commands.cpp` or App 1's bridge (`server/defaults.ts`):

```zsh
node scripts/verify-command-catalog.mjs
```

Checks that the bridge command catalog, `handleCommand()` branches, and the `printReadyMessage()` list are all consistent.

## Competition Readiness

```zsh
# One-shot full check (compile + all apps + Pages build + mobile layout)
node scripts/competition-readiness-check.mjs

# After GitHub Pages deploys, add public URL verification
CHECK_PUBLIC_URLS=1 node scripts/competition-readiness-check.mjs

# Before pushing to GitHub
node scripts/github-prepublish-check.mjs
```

Sub-checks that `competition-readiness-check.mjs` wraps:

```zsh
zsh scripts/demo-check.sh
node scripts/build-github-pages.mjs
node scripts/pages-artifact-check.mjs
node scripts/mobile-layout-check.mjs
```

## Arduino Cloud

Use `docs/ARDUINO_CLOUD.md` before adding Arduino Cloud code.

- Keep `handleCommand()` as the single command execution path.
- Let Serial Monitor and Arduino Cloud callbacks both call `handleCommand()`.
- Do not create or commit real secrets. Use `include/arduino_secrets.example.h` as the template and keep real values in ignored `include/arduino_secrets.h`.
- Do not add Cloud libraries to `platformio.ini` until the Thing variables and credentials are ready.

## GitHub Pages

Static student entry pages live in `pages-dist/`. Built by `scripts/build-github-pages.mjs`. Deployed to `https://timdirty.github.io/115-campus-ai-demo/`.

Do not commit real `.env`, Firebase config, Arduino secrets, or App 1 live session data. The CI workflow (`.github/workflows/demo-check.yml`) auto-runs all three app checks, bridge/firmware catalog verification, and firmware compile on every push.

## Project Skill

There is a project-local skill at `.codex/skills/arduino-uno-r4-vibecoding/SKILL.md`. Use it as the compact operating guide for AI-assisted firmware edits in this repo.
