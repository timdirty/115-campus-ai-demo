---
name: hooks
description: "Skill for the Hooks area of 115-campus-ai-demo. 13 symbols across 5 files."
---

# Hooks

13 symbols | 5 files | Cohesion: 90%

## When to Use

- Working with code in `google ai studio/`
- Understanding how App, showToast, exportDemoState work
- Modifying hooks-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `google ai studio/app_1（國小）/AI自動板擦機器人/src/hooks/useMediaCapture.ts` | blobToDataUrl, startRecording, stopRecording, stopCamera, enableCamera |
| `google ai studio/app_2（國小）/校園服務機器人 app/src/App.tsx` | App, showToast, exportDemoState, importDemoState |
| `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/Home.tsx` | handleToggleRecording, handleToggleCamera |
| `google ai studio/app_2（國小）/校園服務機器人 app/src/hooks/useProxyHealth.ts` | useProxyHealth |
| `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/classroomApi.ts` | transcribeAudio |

## Entry Points

Start here when exploring this area:

- **`App`** (Function) — `google ai studio/app_2（國小）/校園服務機器人 app/src/App.tsx:53`
- **`showToast`** (Function) — `google ai studio/app_2（國小）/校園服務機器人 app/src/App.tsx:64`
- **`exportDemoState`** (Function) — `google ai studio/app_2（國小）/校園服務機器人 app/src/App.tsx:72`
- **`importDemoState`** (Function) — `google ai studio/app_2（國小）/校園服務機器人 app/src/App.tsx:85`
- **`useProxyHealth`** (Function) — `google ai studio/app_2（國小）/校園服務機器人 app/src/hooks/useProxyHealth.ts:4`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `App` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/App.tsx` | 53 |
| `showToast` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/App.tsx` | 64 |
| `exportDemoState` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/App.tsx` | 72 |
| `importDemoState` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/App.tsx` | 85 |
| `useProxyHealth` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/hooks/useProxyHealth.ts` | 4 |
| `transcribeAudio` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/classroomApi.ts` | 595 |
| `handleToggleRecording` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/Home.tsx` | 64 |
| `startRecording` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/hooks/useMediaCapture.ts` | 81 |
| `stopRecording` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/hooks/useMediaCapture.ts` | 116 |
| `handleToggleCamera` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/Home.tsx` | 45 |
| `stopCamera` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/hooks/useMediaCapture.ts` | 27 |
| `enableCamera` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/hooks/useMediaCapture.ts` | 36 |
| `blobToDataUrl` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/hooks/useMediaCapture.ts` | 7 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `HandleToggleRecording → ApiClientError` | cross_community | 4 |
| `HandleToggleRecording → BlobToDataUrl` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Views | 2 calls |
| Services | 1 calls |

## How to Explore

1. `gitnexus_context({name: "App"})` — see callers and callees
2. `gitnexus_query({query: "hooks"})` — find related execution flows
3. Read key files listed above for implementation details
