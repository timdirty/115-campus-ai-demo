---
name: include
description: "Skill for the Include area of 115-campus-ai-demo. 17 symbols across 6 files."
---

# Include

17 symbols | 6 files | Cohesion: 100%

## When to Use

- Working with code in `include/`
- Understanding how setup, setupMatrixShow, setupCommandHardware work
- Modifying include-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `include/matrix_show.h` | setupMatrixShow, setMatrixShowEnabled, resetMatrixShow, triggerFireworks, updateMatrixShow |
| `include/commands.h` | setupCommandHardware, printReadyMessage, handleCommand |
| `src/commands.cpp` | setStatusLed, setupCommandHardware, handleCommand |
| `src/main.cpp` | setup, loop |
| `docs/templates/thingProperties.h` | initProperties, onCommandChange |
| `docs/templates/cloud_main.cpp` | setup, loop |

## Entry Points

Start here when exploring this area:

- **`setup`** (Function) — `src/main.cpp:6`
- **`setupMatrixShow`** (Function) — `include/matrix_show.h:2`
- **`setupCommandHardware`** (Function) — `include/commands.h:4`
- **`printReadyMessage`** (Function) — `include/commands.h:5`
- **`initProperties`** (Function) — `docs/templates/thingProperties.h:15`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `setup` | Function | `src/main.cpp` | 6 |
| `setupMatrixShow` | Function | `include/matrix_show.h` | 2 |
| `setupCommandHardware` | Function | `include/commands.h` | 4 |
| `printReadyMessage` | Function | `include/commands.h` | 5 |
| `initProperties` | Function | `docs/templates/thingProperties.h` | 15 |
| `setup` | Function | `docs/templates/cloud_main.cpp` | 8 |
| `setupCommandHardware` | Function | `src/commands.cpp` | 16 |
| `handleCommand` | Function | `src/commands.cpp` | 30 |
| `setMatrixShowEnabled` | Function | `include/matrix_show.h` | 4 |
| `resetMatrixShow` | Function | `include/matrix_show.h` | 5 |
| `triggerFireworks` | Function | `include/matrix_show.h` | 6 |
| `loop` | Function | `src/main.cpp` | 18 |
| `updateMatrixShow` | Function | `include/matrix_show.h` | 3 |
| `handleCommand` | Function | `include/commands.h` | 6 |
| `onCommandChange` | Function | `docs/templates/thingProperties.h` | 11 |
| `loop` | Function | `docs/templates/cloud_main.cpp` | 21 |
| `setStatusLed` | Function | `src/commands.cpp` | 11 |

## How to Explore

1. `gitnexus_context({name: "setup"})` — see callers and callees
2. `gitnexus_query({query: "include"})` — find related execution flows
3. Read key files listed above for implementation details
