---
name: motor-test
description: "Skill for the Motor_test area of 115-campus-ai-demo. 5 symbols across 1 files."
---

# Motor_test

5 symbols | 1 files | Cohesion: 100%

## When to Use

- Working with code in `src/`
- Understanding how setup, loop work
- Modifying motor_test-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/motor_test/main.cpp` | setRgb, applyMoodLed, doRead, setup, loop |

## Entry Points

Start here when exploring this area:

- **`setup`** (Function) — `src/motor_test/main.cpp:103`
- **`loop`** (Function) — `src/motor_test/main.cpp:129`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `setup` | Function | `src/motor_test/main.cpp` | 103 |
| `loop` | Function | `src/motor_test/main.cpp` | 129 |
| `setRgb` | Function | `src/motor_test/main.cpp` | 49 |
| `applyMoodLed` | Function | `src/motor_test/main.cpp` | 57 |
| `doRead` | Function | `src/motor_test/main.cpp` | 73 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Setup → SetRgb` | intra_community | 4 |
| `Loop → SetRgb` | intra_community | 4 |

## How to Explore

1. `gitnexus_context({name: "setup"})` — see callers and callees
2. `gitnexus_query({query: "motor_test"})` — find related execution flows
3. Read key files listed above for implementation details
