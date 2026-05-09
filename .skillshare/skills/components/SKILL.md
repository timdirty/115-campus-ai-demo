---
name: components
description: "Skill for the Components area of 115-campus-ai-demo. 60 symbols across 10 files."
---

# Components

60 symbols | 10 files | Cohesion: 93%

## When to Use

- Working with code in `google ai studio/`
- Understanding how sendGuardianHardwareCommand, GuardianControlPanel, flash work
- Modifying components-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/ZoneSensorPanel.tsx` | tempColor, tempBg, humLabel, lightLabel, lightColor (+4) |
| `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/IssueReporter.tsx` | saveIssues, clearImage, update, handleSubmit, toggleStatus (+3) |
| `google ai studio/app_1（國小）/AI自動板擦機器人/src/components/IssueReporter.tsx` | saveIssues, clearImage, update, handleSubmit, toggleStatus (+3) |
| `google ai studio/app_2（國小）/校園服務機器人 app/src/components/IssueReporter.tsx` | saveIssues, clearImage, update, handleSubmit, toggleStatus (+3) |
| `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/CampusMapSvg.tsx` | getZoneData, CampusMapSvg, handleClick, handleKeyDown, formatTemperature (+2) |
| `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/SensorSetupModal.tsx` | deviceLabel, SensorSetupModal, triggerFlash, handleAssign, handleUnassign (+1) |
| `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/GuardianControlPanel.tsx` | GuardianControlPanel, flash, send, dispatchToZone, trigger |
| `google ai studio/app_1（國小）/AI自動板擦機器人/src/components/SystemSettingsPanel.tsx` | SystemSettingsPanel, refreshReady, runBackup, runImport |
| `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/SensorAssignmentWidget.tsx` | SensorAssignmentWidget, handleAssign, handleUnassign |
| `google ai studio/app_3（國中）/AI校園心靈守護者/src/services/hardwareBridge.ts` | sendGuardianHardwareCommand, assignSensorPort |

## Entry Points

Start here when exploring this area:

- **`sendGuardianHardwareCommand`** (Function) — `google ai studio/app_3（國中）/AI校園心靈守護者/src/services/hardwareBridge.ts:57`
- **`GuardianControlPanel`** (Function) — `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/GuardianControlPanel.tsx:126`
- **`flash`** (Function) — `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/GuardianControlPanel.tsx:144`
- **`send`** (Function) — `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/GuardianControlPanel.tsx:149`
- **`dispatchToZone`** (Function) — `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/GuardianControlPanel.tsx:172`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `sendGuardianHardwareCommand` | Function | `google ai studio/app_3（國中）/AI校園心靈守護者/src/services/hardwareBridge.ts` | 57 |
| `GuardianControlPanel` | Function | `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/GuardianControlPanel.tsx` | 126 |
| `flash` | Function | `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/GuardianControlPanel.tsx` | 144 |
| `send` | Function | `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/GuardianControlPanel.tsx` | 149 |
| `dispatchToZone` | Function | `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/GuardianControlPanel.tsx` | 172 |
| `trigger` | Function | `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/GuardianControlPanel.tsx` | 402 |
| `ZoneSensorPanel` | Function | `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/ZoneSensorPanel.tsx` | 105 |
| `SensorSetupModal` | Function | `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/SensorSetupModal.tsx` | 59 |
| `triggerFlash` | Function | `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/SensorSetupModal.tsx` | 68 |
| `handleAssign` | Function | `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/SensorSetupModal.tsx` | 73 |
| `handleUnassign` | Function | `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/SensorSetupModal.tsx` | 89 |
| `sensorFor` | Function | `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/SensorSetupModal.tsx` | 97 |
| `clearImage` | Function | `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/IssueReporter.tsx` | 80 |
| `update` | Function | `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/IssueReporter.tsx` | 82 |
| `handleSubmit` | Function | `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/IssueReporter.tsx` | 84 |
| `toggleStatus` | Function | `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/IssueReporter.tsx` | 94 |
| `handleDelete` | Function | `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/IssueReporter.tsx` | 97 |
| `clearImage` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/components/IssueReporter.tsx` | 80 |
| `update` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/components/IssueReporter.tsx` | 82 |
| `handleSubmit` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/src/components/IssueReporter.tsx` | 84 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `SystemSettingsPanel → ApiClientError` | cross_community | 6 |
| `GuardianControlPanel → WithTimeout` | cross_community | 5 |
| `SystemSettingsPanel → LocalReadyStatus` | cross_community | 5 |
| `RunBackup → ApiClientError` | cross_community | 5 |
| `SensorSetupModal → WithTimeout` | cross_community | 4 |
| `SensorAssignmentWidget → WithTimeout` | cross_community | 4 |
| `GuardianControlPanel → Flash` | intra_community | 4 |
| `SystemSettingsPanel → NormalizeNotes` | cross_community | 4 |
| `SystemSettingsPanel → SaveNotes` | cross_community | 4 |
| `SystemSettingsPanel → WriteJson` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Services | 5 calls |

## How to Explore

1. `gitnexus_context({name: "sendGuardianHardwareCommand"})` — see callers and callees
2. `gitnexus_query({query: "components"})` — find related execution flows
3. Read key files listed above for implementation details
