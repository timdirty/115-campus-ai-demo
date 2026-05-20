---
name: arduino-uno-r4-vibecoding
description: Use when working in this project on Arduino UNO R4 WiFi firmware, PlatformIO setup, Serial command testing, servo/LED behavior, or future Arduino Cloud integration.
---

# Arduino UNO R4 Vibe-Coding

This project uses PlatformIO with Arduino UNO R4 WiFi.

## Guardrails

- Board id is `uno_r4_wifi`.
- Use Homebrew-installed `pio`; do not install PlatformIO with `python3 -m pip`.
- Keep local Serial Monitor commands working while adding cloud features.
- Never commit real Wi-Fi or Arduino Cloud secrets.
- After firmware changes, run `pio run`.

## Project Shape

- `src/main.cpp`: current local Serial entry point.
- `src/commands.cpp`: hardware actions and command handling.
- `include/commands.h`: shared command API for Serial and Cloud.
- `include/arduino_secrets.example.h`: copy to `include/arduino_secrets.h` for real credentials.
- `docs/ARDUINO_CLOUD.md`: future Cloud integration plan.
- `docs/templates/`: starting templates for Cloud mode.

## Workflow

1. Inspect `platformio.ini`, `src/main.cpp`, and `src/commands.cpp`.
2. Keep changes small and compile frequently.
3. For new behavior, add or update a Serial command first.
4. Reuse `handleCommand()` from both Serial and Cloud callbacks.
5. Verify with `pio run`.

## Commands

```zsh
pio run
pio run -t upload
pio device monitor -b 115200
zsh scripts/doctor.sh
```

## Arduino Cloud Plan

When the user asks to integrate Arduino Cloud:

1. Read `docs/ARDUINO_CLOUD.md`.
2. Confirm the Arduino Cloud Thing variable names and Device ID/secret source.
3. Add `ArduinoIoTCloud` and `Arduino_ConnectionHandler` to `platformio.ini`.
4. Copy/adapt `docs/templates/thingProperties.h` into `include/thingProperties.h`.
5. Adapt `docs/templates/cloud_main.cpp` into `src/main.cpp`.
6. Keep Serial fallback available.
7. Run `pio run` and fix compile errors.
