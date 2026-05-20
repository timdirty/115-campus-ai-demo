---
name: pages
description: "Skill for the Pages area of 115-campus-ai-demo. 34 symbols across 8 files."
---

# Pages

34 symbols | 8 files | Cohesion: 78%

## When to Use

- Working with code in `google ai studio/`
- Understanding how loadClassroomSession, saveClassroomSession, TeacherDashboard work
- Modifying pages-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/RobotControl.tsx` | iconForCommand, commandDisplayName, dirLabel, RobotControl, sendDriveCommand (+5) |
| `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/classroomApi.ts` | buildBoardRegions, writeJson, saveLocalSession, localBoardAnalysis, loadClassroomSession (+3) |
| `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/Home.tsx` | applyRegions, runRegionTask, keepAllRegions, captureAndAnalyze, handleImageUpload |
| `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/TeacherDashboard.tsx` | TeacherDashboard, loadSession, updateRegionStatus, runTask |
| `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/Library.tsx` | Library, refresh, deleteNote |
| `google ai studio/app_1（國小）/AI自動板擦機器人/src/components/EV3ControlPanel.tsx` | EV3ControlPanel, sendCmd |
| `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/notesStore.ts` | downloadTextFile |
| `google ai studio/app_1（國小）/AI自動板擦機器人/src/hooks/useMediaCapture.ts` | captureFrame |

## Entry Points

Start here when exploring this area:

- **`loadClassroomSession`** (Function) — `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/classroomApi.ts:511`
- **`saveClassroomSession`** (Function) — `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/classroomApi.ts:521`
- **`TeacherDashboard`** (Function) — `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/TeacherDashboard.tsx:22`
- **`loadSession`** (Function) — `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/TeacherDashboard.tsx:39`
- **`updateRegionStatus`** (Function) — `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/TeacherDashboard.tsx:69`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `loadClassroomSession` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/classroomApi.ts` | 511 |
| `saveClassroomSession` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/classroomApi.ts` | 521 |
| `TeacherDashboard` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/TeacherDashboard.tsx` | 22 |
| `loadSession` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/TeacherDashboard.tsx` | 39 |
| `updateRegionStatus` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/TeacherDashboard.tsx` | 69 |
| `runTask` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/TeacherDashboard.tsx` | 78 |
| `applyRegions` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/Home.tsx` | 176 |
| `runRegionTask` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/Home.tsx` | 182 |
| `keepAllRegions` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/Home.tsx` | 202 |
| `sendRobotCommand` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/classroomApi.ts` | 553 |
| `RobotControl` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/RobotControl.tsx` | 76 |
| `sendDriveCommand` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/RobotControl.tsx` | 124 |
| `handleDriveStart` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/RobotControl.tsx` | 132 |
| `handleDriveStop` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/RobotControl.tsx` | 137 |
| `handleSpeedChange` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/RobotControl.tsx` | 143 |
| `sendCommand` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/RobotControl.tsx` | 157 |
| `sendTask` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/RobotControl.tsx` | 186 |
| `EV3ControlPanel` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/components/EV3ControlPanel.tsx` | 24 |
| `sendCmd` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/components/EV3ControlPanel.tsx` | 42 |
| `downloadTextFile` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/services/notesStore.ts` | 313 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `RobotControl → ReadJson` | cross_community | 6 |
| `TeacherDashboard → ReadJson` | cross_community | 6 |
| `Library → SaveNotes` | cross_community | 6 |
| `Library → NormalizeNotes` | cross_community | 6 |
| `CaptureAndAnalyze → ReadJson` | cross_community | 6 |
| `CaptureAndAnalyze → LumaAt` | cross_community | 6 |
| `CaptureAndAnalyze → Clamp` | cross_community | 6 |
| `HandleImageUpload → ReadJson` | cross_community | 6 |
| `HandleImageUpload → LumaAt` | cross_community | 6 |
| `HandleImageUpload → Clamp` | cross_community | 6 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Services | 13 calls |

## How to Explore

1. `gitnexus_context({name: "loadClassroomSession"})` — see callers and callees
2. `gitnexus_query({query: "pages"})` — find related execution flows
3. Read key files listed above for implementation details
