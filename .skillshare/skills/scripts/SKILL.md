---
name: scripts
description: "Skill for the Scripts area of 115-campus-ai-demo. 19 symbols across 4 files."
---

# Scripts

19 symbols | 4 files | Cohesion: 88%

## When to Use

- Working with code in `scripts/`
- Understanding how appDir, guidePath, appUrl work
- Modifying scripts-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `scripts/polish-500-check.mjs` | readJson, assert, assertContains, assertFileContains, checkApp (+1) |
| `scripts/app-catalog.mjs` | appDir, guidePath, appUrl, guideUrl, allPublishedRoutes |
| `scripts/build-github-pages.mjs` | escapeHtml, renderInline, renderGuideMarkdown, closeLists, writeGuidePage |
| `scripts/generate-demo-docs.mjs` | buildReadyGuide, commandLine, pitchFor |

## Entry Points

Start here when exploring this area:

- **`appDir`** (Function) — `scripts/app-catalog.mjs:70`
- **`guidePath`** (Function) — `scripts/app-catalog.mjs:74`
- **`appUrl`** (Function) — `scripts/app-catalog.mjs:78`
- **`guideUrl`** (Function) — `scripts/app-catalog.mjs:82`
- **`allPublishedRoutes`** (Function) — `scripts/app-catalog.mjs:86`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `appDir` | Function | `scripts/app-catalog.mjs` | 70 |
| `guidePath` | Function | `scripts/app-catalog.mjs` | 74 |
| `appUrl` | Function | `scripts/app-catalog.mjs` | 78 |
| `guideUrl` | Function | `scripts/app-catalog.mjs` | 82 |
| `allPublishedRoutes` | Function | `scripts/app-catalog.mjs` | 86 |
| `readJson` | Function | `scripts/polish-500-check.mjs` | 63 |
| `assert` | Function | `scripts/polish-500-check.mjs` | 67 |
| `assertContains` | Function | `scripts/polish-500-check.mjs` | 71 |
| `assertFileContains` | Function | `scripts/polish-500-check.mjs` | 75 |
| `checkApp` | Function | `scripts/polish-500-check.mjs` | 82 |
| `run` | Function | `scripts/polish-500-check.mjs` | 130 |
| `escapeHtml` | Function | `scripts/build-github-pages.mjs` | 20 |
| `renderInline` | Function | `scripts/build-github-pages.mjs` | 28 |
| `renderGuideMarkdown` | Function | `scripts/build-github-pages.mjs` | 32 |
| `closeLists` | Function | `scripts/build-github-pages.mjs` | 38 |
| `writeGuidePage` | Function | `scripts/build-github-pages.mjs` | 91 |
| `buildReadyGuide` | Function | `scripts/generate-demo-docs.mjs` | 87 |
| `commandLine` | Function | `scripts/generate-demo-docs.mjs` | 17 |
| `pitchFor` | Function | `scripts/generate-demo-docs.mjs` | 21 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Run → Assert` | intra_community | 4 |
| `WriteGuidePage → EscapeHtml` | intra_community | 4 |
| `Run → AppDir` | intra_community | 3 |
| `Run → GuidePath` | cross_community | 3 |
| `Run → ReadJson` | intra_community | 3 |
| `WriteGuidePage → CloseLists` | intra_community | 3 |

## How to Explore

1. `gitnexus_context({name: "appDir"})` — see callers and callees
2. `gitnexus_query({query: "scripts"})` — find related execution flows
3. Read key files listed above for implementation details
