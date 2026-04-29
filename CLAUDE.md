# Project Instructions

This is a PlatformIO Arduino project for Arduino UNO R4 WiFi.

## Environment

- macOS / zsh
- PlatformIO Core installed through Homebrew
- Do not install PlatformIO with `python3 -m pip install platformio`
- Board id: `uno_r4_wifi`
- Framework: `arduino`
- Monitor speed: `115200`

## Safety Rules

- Do not delete existing project files unless explicitly asked.
- Keep `platformio.ini`, `src/`, `include/`, `lib/`, and `test/` as project paths, not shell commands.
- Prefer small, reversible edits.
- After code changes, run `pio run` and fix compile errors before reporting completion.

## Useful Commands

```zsh
pio run
pio run -t upload
pio device monitor -b 115200
pio run -t clean
pio boards uno_r4
```

## Current App Behavior

`src/main.cpp` reads serial commands. `src/commands.cpp` contains the shared command behavior for all three competition apps:

- App 1 whiteboard/eraser commands such as `SHOW_ON`, `ERASE_REGION_A`, `ERASE_ALL`, `PAUSE_TASK`
- App 2 campus service commands such as `DELIVERY_START`, `CLEAN_SCHEDULE`, `BROADCAST_START`, `SAFETY_LOCKDOWN`, `ROBOT_PAUSE`
- App 3 care/guardian commands such as `ALERT_SIGNAL`, `CARE_DEPLOYED`, `NODE_RESTART`
- Base hardware test commands such as `LED_ON`, `LED_OFF`, `SERVO_0`, `SERVO_90`, `SERVO_180`, `STOP`

Run `node scripts/verify-command-catalog.mjs` after editing bridge or firmware commands. It checks that App 1's Node bridge command catalog and UNO R4 firmware stay aligned.

## Arduino Cloud

Use `docs/ARDUINO_CLOUD.md` before adding Arduino Cloud code.

- Keep `handleCommand()` as the single command execution path.
- Let Serial Monitor and Arduino Cloud callbacks both call `handleCommand()`.
- Do not create or commit real secrets. Use `include/arduino_secrets.example.h` as the template and keep real values in ignored `include/arduino_secrets.h`.
- Do not add Cloud libraries to `platformio.ini` until the Thing variables and credentials are ready.

## Project Skill

There is a project-local skill at `.codex/skills/arduino-uno-r4-vibecoding/SKILL.md`. Use it as the compact operating guide for future AI-assisted edits in this repo.
