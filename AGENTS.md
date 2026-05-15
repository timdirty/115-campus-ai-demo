<!-- AUTO-GENERATED: edit docs/SHARED_AGENT_CORE.md and the appendix docs, then run python3 scripts/sync-agent-guides.py -->

# AGENTS.md

This file provides guidance to Codex when working with this repository.

Use this file as the compact entrypoint. Keep shared project guidance in `docs/SHARED_AGENT_CORE.md` and tool-specific guidance in the appendix docs.

# Shared Agent Core

This is the canonical project guidance shared by Claude Code and Codex for this repository.

## Project Shape

- Three competition apps are intentionally independent app workspaces under `apps/`.
- App 1 owns `apps/app1-whiteboard/` and is the hardware gateway through `apps/app1-whiteboard/server/serialBridge.ts`.
- App 2 owns `apps/app2-campus-service/` and its local sweeper / service demo stack.
- App 3 owns `apps/app3-guardian/`, including its `robot-app/` companion display.
- Physical firmware is also separated by project under `firmware/`; do not merge one team's sketch into another team's folder.
- The shared command demo remains available only as a compatibility/demo firmware target, not as the place for app-specific robot behavior.

## Canonical Paths

- App 1 workspace: `apps/app1-whiteboard/`
- App 2 workspace: `apps/app2-campus-service/`
- App 3 workspace: `apps/app3-guardian/`
- Firmware: `platformio.ini`, `firmware/`, `include/`, `lib/`, `test/`
- Shared command demo firmware: `firmware/shared-command-demo/`
- Shared skills source: `.skillshare/skills/`
- Project interop notes: `docs/AGENT_INTEROP.md`
- Task handoff scratchpad: `.orchestra/handoff.md`

## Shared Rules

- Prefer small, reversible edits.
- Keep App 1, App 2, and App 3 changes inside their own app folders unless a shared script, shared doc, or `platformio.ini` update is genuinely required.
- Keep runtime data, `.env`, demo caches, and generated local state app-local and out of git.
- Do not delete project files unless the user explicitly asks.
- Treat `.orchestra/handoff.md` as transient workflow state, not the source of truth.
- Treat `docs/AGENT_INTEROP.md` and this file as the source of truth for Claude/Codex project alignment.
- Keep secrets out of git, including `.env`, Firebase credentials, Arduino secrets, and App 1 live session data.

## Firmware Rules

- PlatformIO is managed through Homebrew, not `pip`.
- Keep per-project physical firmware separated by PlatformIO env; do not overwrite one team's firmware file with another team's sketch.
- Shared command demo firmware: env `uno_r4_wifi`, files `firmware/shared-command-demo/main.cpp`, `firmware/shared-command-demo/commands.cpp`, `firmware/shared-command-demo/matrix_show.cpp`.
- App 1 whiteboard dual-motor firmware: env `uno_r4_minima_app1_whiteboard_drive`, file `firmware/app1-whiteboard-drive/main.cpp`, L293D M3/M4.
- App 2 sweeper robot firmware: envs `uno_r4_wifi_app2_sweeper` (R4 WiFi) and `uno_r4_minima_app2_sweeper` (R4 Minima, DFU upload), file `firmware/app2-sweeper-drive/main.cpp`, L293D M1+M2 wheels and M3+M4 sweeper rollers.
- App 3 guardian sensor firmware: envs `uno_r4_wifi_sensor` (R4 WiFi) and `uno_r4_minima` (R4 Minima, DFU upload), file `firmware/app3-guardian-sensor/main.cpp`, HY-M302 / DHT11 / photoresistor / RGB LED.
- App 3 guardian four-wheel firmware: envs `uno_r4_wifi_app3_guardian_drive` (R4 WiFi) and `uno_r4_minima_app3_guardian_drive` (R4 Minima, DFU upload), file `firmware/app3-guardian-drive/main.cpp`, L293D M1+M4 left side and M2+M3 right side.
- Full firmware reference lives in `docs/FIRMWARE_ENV_MAP.md`.
- All serial commands stay in `UPPER_SNAKE_CASE`.
- For shared command-demo changes, `firmware/shared-command-demo/main.cpp` is the serial entry point and `firmware/shared-command-demo/commands.cpp` is the single command dispatch surface.
- If you add a shared command, update `firmware/shared-command-demo/commands.cpp`, the ready message list, and the App 1 bridge catalog.

## High-Signal Commands

```bash
npm run dev
npm run build
npm run check
pio run
pio run -e uno_r4_minima_app1_whiteboard_drive
pio run -e uno_r4_wifi_app2_sweeper
pio run -e uno_r4_minima_app2_sweeper
pio run -e uno_r4_wifi_sensor
pio run -e uno_r4_wifi_app3_guardian_drive
pio run -e uno_r4_minima_app3_guardian_drive
node scripts/competition-readiness-check.mjs
npm run skills:sync
npm run skills:validate
npm run agent-guides:sync
```

## Shared Guide Model

- `CLAUDE.md` and `AGENTS.md` are generated adapters.
- Shared project guidance should be edited here first.
- Tool-specific differences belong in `docs/CLAUDE_APPENDIX.md` and `docs/AGENTS_APPENDIX.md`.

## Codex-Specific Notes

- This file is consumed by Codex as `AGENTS.md`.
- Repo-local automation hooks live in `.githooks/`.
- Current Claude/Codex sync boundaries and runtime differences are documented in `docs/AGENT_INTEROP.md`.
