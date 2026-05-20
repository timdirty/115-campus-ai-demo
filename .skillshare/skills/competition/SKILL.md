---
name: competition
description: "Skill for the Competition area of 115-campus-ai-demo. 13 symbols across 1 files."
---

# Competition

13 symbols | 1 files | Cohesion: 55%

## When to Use

- Working with code in `docs/`
- Understanding how addCover, addApp1Overview, addApp1Scratch work
- Modifying competition-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `docs/competition/generate-ppt.mjs` | addCover, addApp1Overview, addApp1Scratch, addApp2Scratch, addApp3Scratch (+8) |

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `addCover` | Function | `docs/competition/generate-ppt.mjs` | 53 |
| `addApp1Overview` | Function | `docs/competition/generate-ppt.mjs` | 134 |
| `addApp1Scratch` | Function | `docs/competition/generate-ppt.mjs` | 203 |
| `addApp2Scratch` | Function | `docs/competition/generate-ppt.mjs` | 283 |
| `addApp3Scratch` | Function | `docs/competition/generate-ppt.mjs` | 359 |
| `addClosing` | Function | `docs/competition/generate-ppt.mjs` | 431 |
| `main` | Function | `docs/competition/generate-ppt.mjs` | 455 |
| `slideBase` | Function | `docs/competition/generate-ppt.mjs` | 35 |
| `addSystemArch` | Function | `docs/competition/generate-ppt.mjs` | 91 |
| `addApp1StateDiagram` | Function | `docs/competition/generate-ppt.mjs` | 167 |
| `addApp2Overview` | Function | `docs/competition/generate-ppt.mjs` | 247 |
| `addApp3Overview` | Function | `docs/competition/generate-ppt.mjs` | 327 |
| `addLearning` | Function | `docs/competition/generate-ppt.mjs` | 403 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Main → SlideBase` | cross_community | 3 |

## How to Explore

1. `gitnexus_context({name: "addCover"})` — see callers and callees
2. `gitnexus_query({query: "competition"})` — find related execution flows
3. Read key files listed above for implementation details
