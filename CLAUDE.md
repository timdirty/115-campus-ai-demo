<!-- AUTO-GENERATED: edit docs/SHARED_AGENT_CORE.md and the appendix docs, then run python3 scripts/sync-agent-guides.py -->

# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

Use this file as the compact entrypoint. Keep shared project guidance in `docs/SHARED_AGENT_CORE.md` and tool-specific guidance in the appendix docs.

# Shared Agent Core

This is the canonical project guidance shared by Claude Code and Codex for this repository.

## Project Shape

- Three competition apps share one Arduino UNO R4 WiFi firmware target.
- App 1 is the hardware gateway through `server/serialBridge.ts`.
- App 2 and App 3 are frontend-first apps that still depend on the shared command model.

## Canonical Paths

- Firmware: `platformio.ini`, `src/`, `include/`, `lib/`, `test/`
- Shared skills source: `.skillshare/skills/`
- Project interop notes: `docs/AGENT_INTEROP.md`
- Task handoff scratchpad: `.orchestra/handoff.md`

## Shared Rules

- Prefer small, reversible edits.
- Do not delete project files unless the user explicitly asks.
- Treat `.orchestra/handoff.md` as transient workflow state, not the source of truth.
- Treat `docs/AGENT_INTEROP.md` and this file as the source of truth for Claude/Codex project alignment.
- Keep secrets out of git, including `.env`, Firebase credentials, Arduino secrets, and App 1 live session data.

## Firmware Rules

- PlatformIO is managed through Homebrew, not `pip`.
- Keep per-project physical firmware separated by PlatformIO env; do not overwrite one team's firmware file with another team's sketch.
- Shared command demo firmware: env `uno_r4_wifi`, files `src/main.cpp`, `src/commands.cpp`, `src/matrix_show.cpp`.
- App 1 whiteboard dual-motor firmware: env `uno_r4_minima_app1_whiteboard_drive`, file `src/app1_whiteboard_drive/main.cpp`, L293D M3/M4.
- App 2 sweeper robot firmware: envs `uno_r4_wifi_app2_sweeper` (R4 WiFi) and `uno_r4_minima_app2_sweeper` (R4 Minima, DFU upload), file `src/app2_sweeper_drive/main.cpp`, L293D M1+M2 wheels and M3+M4 sweeper rollers.
- App 3 guardian sensor firmware: envs `uno_r4_wifi_sensor` (R4 WiFi) and `uno_r4_minima` (R4 Minima, DFU upload), file `src/app3_guardian_sensor/main.cpp`, HY-M302 / DHT11 / photoresistor / RGB LED.
- App 3 guardian four-wheel firmware: envs `uno_r4_wifi_app3_guardian_drive` (R4 WiFi) and `uno_r4_minima_app3_guardian_drive` (R4 Minima, DFU upload), file `src/app3_guardian_drive/main.cpp`, L293D M1+M4 left side and M2+M3 right side.
- Full firmware reference lives in `docs/FIRMWARE_ENV_MAP.md`.
- All serial commands stay in `UPPER_SNAKE_CASE`.
- For shared command-demo changes, `src/main.cpp` is the serial entry point and `src/commands.cpp` is the single command dispatch surface.
- If you add a shared command, update `src/commands.cpp`, the ready message list, and the App 1 bridge catalog.

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

## Claude-Specific Notes

- This file is consumed by Claude Code as `CLAUDE.md`.
- Project-local Claude permission overrides currently live in `.claude/settings.local.json`.
- Claude-oriented workflow state may also appear in `.orchestra/handoff.md`, but that file is not the source of truth for shared project rules.
