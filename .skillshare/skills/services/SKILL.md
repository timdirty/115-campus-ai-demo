---
name: services
description: "Skill for the Services area of 115-campus-ai-demo. 148 symbols across 37 files."
---

# Services

148 symbols | 37 files | Cohesion: 81%

## When to Use

- Working with code in `google ai studio/`
- Understanding how App, getPage, normalizeNotes work
- Modifying services-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `google ai studio/app_3（國中）/AI校園心靈守護者/src/App.tsx` | AppContent, showToast, sendHardwareCue, dispatchRobotToZone, createProactiveAlert (+17) |
| `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/classroomApi.ts` | localReadyStatus, loadBridgeHealth, loadReadyStatus, backupAppData, importAppData (+11) |
| `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/notesStore.ts` | normalizeNotes, loadNotes, saveNotes, addNote, updateNote (+8) |
| `google ai studio/app_2（國小）/校園服務機器人 app/src/services/localAi.ts` | generateClassSummary, detectSituation, detectSubject, generateTeacherReply, detectZone (+7) |
| `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/geminiService.ts` | chatWithAI, localSummary, localQuiz, summarizeContent, generateQuizFromContent (+2) |
| `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/Chat.tsx` | Chat, autoResize, copyToClipboard, submitMessage, uid (+2) |
| `google ai studio/app_2（國小）/校園服務機器人 app/src/services/localVision.ts` | hashInput, inferScene, analyzeCampusFrame, clampScore, classifyByPixels (+2) |
| `ev3/ev3_server.py` | stop_all, _run_motion, dispatch, _reply, handle |
| `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/boardVision.ts` | clamp, summarizeMetrics, lumaAt, analyzeWhiteboardPixels, analyzeWhiteboardImage |
| `google ai studio/app_3（國中）/AI校園心靈守護者/src/services/localGuardianAi.ts` | pickTemplate, selectLocalFallback, generateSupportReply, recommendationForAlert |

## Entry Points

Start here when exploring this area:

- **`App`** (Function) — `google ai studio/app_1（國小）/AI自動板擦機器人/src/App.tsx:38`
- **`getPage`** (Function) — `google ai studio/app_1（國小）/AI自動板擦機器人/src/App.tsx:84`
- **`normalizeNotes`** (Function) — `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/notesStore.ts:155`
- **`loadNotes`** (Function) — `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/notesStore.ts:161`
- **`saveNotes`** (Function) — `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/notesStore.ts:181`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ApiClientError` | Class | `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/apiClient.ts` | 0 |
| `App` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/App.tsx` | 38 |
| `getPage` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/App.tsx` | 84 |
| `normalizeNotes` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/notesStore.ts` | 155 |
| `loadNotes` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/notesStore.ts` | 161 |
| `saveNotes` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/notesStore.ts` | 181 |
| `addNote` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/notesStore.ts` | 190 |
| `updateNote` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/notesStore.ts` | 220 |
| `deleteNote` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/notesStore.ts` | 258 |
| `loadNotesAsync` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/notesStore.ts` | 262 |
| `addNoteAsync` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/notesStore.ts` | 273 |
| `updateNoteAsync` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/notesStore.ts` | 287 |
| `deleteNoteAsync` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/notesStore.ts` | 301 |
| `chatWithAI` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/geminiService.ts` | 94 |
| `loadBridgeHealth` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/classroomApi.ts` | 441 |
| `loadReadyStatus` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/classroomApi.ts` | 449 |
| `backupAppData` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/classroomApi.ts` | 467 |
| `importAppData` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/classroomApi.ts` | 488 |
| `Review` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/Review.tsx` | 10 |
| `saveSelectedNote` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/Library.tsx` | 100 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `RobotControl → ReadJson` | cross_community | 6 |
| `TeacherDashboard → ReadJson` | cross_community | 6 |
| `Library → SaveNotes` | cross_community | 6 |
| `Library → NormalizeNotes` | cross_community | 6 |
| `TeachView → GetEnv` | cross_community | 6 |
| `CaptureAndAnalyze → ReadJson` | cross_community | 6 |
| `CaptureAndAnalyze → LumaAt` | cross_community | 6 |
| `CaptureAndAnalyze → Clamp` | cross_community | 6 |
| `HandleImageUpload → ReadJson` | cross_community | 6 |
| `HandleImageUpload → LumaAt` | cross_community | 6 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Pages | 5 calls |
| Tour | 1 calls |
| Components | 1 calls |
| State | 1 calls |

## How to Explore

1. `gitnexus_context({name: "App"})` — see callers and callees
2. `gitnexus_query({query: "services"})` — find related execution flows
3. Read key files listed above for implementation details
