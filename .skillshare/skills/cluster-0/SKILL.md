---
name: cluster-0
description: "Skill for the Cluster_0 area of 115-campus-ai-demo. 11 symbols across 1 files."
---

# Cluster_0

11 symbols | 1 files | Cohesion: 100%

## When to Use

- Working with code in `src/`
- Understanding how setupMatrixShow, updateMatrixShow, setMatrixShowEnabled work
- Modifying cluster_0-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/matrix_show.cpp` | clearFrame, setPixel, render, drawScrollingDigit, resetCountdown (+6) |

## Entry Points

Start here when exploring this area:

- **`setupMatrixShow`** (Function) — `src/matrix_show.cpp:230`
- **`updateMatrixShow`** (Function) — `src/matrix_show.cpp:237`
- **`setMatrixShowEnabled`** (Function) — `src/matrix_show.cpp:277`
- **`resetMatrixShow`** (Function) — `src/matrix_show.cpp:288`
- **`triggerFireworks`** (Function) — `src/matrix_show.cpp:296`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `setupMatrixShow` | Function | `src/matrix_show.cpp` | 230 |
| `updateMatrixShow` | Function | `src/matrix_show.cpp` | 237 |
| `setMatrixShowEnabled` | Function | `src/matrix_show.cpp` | 277 |
| `resetMatrixShow` | Function | `src/matrix_show.cpp` | 288 |
| `triggerFireworks` | Function | `src/matrix_show.cpp` | 296 |
| `clearFrame` | Function | `src/matrix_show.cpp` | 121 |
| `setPixel` | Function | `src/matrix_show.cpp` | 129 |
| `render` | Function | `src/matrix_show.cpp` | 137 |
| `drawScrollingDigit` | Function | `src/matrix_show.cpp` | 141 |
| `resetCountdown` | Function | `src/matrix_show.cpp` | 156 |
| `drawFireworkFrame` | Function | `src/matrix_show.cpp` | 162 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `UpdateMatrixShow → ClearFrame` | intra_community | 3 |
| `UpdateMatrixShow → SetPixel` | intra_community | 3 |
| `UpdateMatrixShow → Render` | intra_community | 3 |
| `TriggerFireworks → ClearFrame` | intra_community | 3 |
| `TriggerFireworks → SetPixel` | intra_community | 3 |
| `TriggerFireworks → Render` | intra_community | 3 |

## How to Explore

1. `gitnexus_context({name: "setupMatrixShow"})` — see callers and callees
2. `gitnexus_query({query: "cluster_0"})` — find related execution flows
3. Read key files listed above for implementation details
