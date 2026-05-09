---
name: state
description: "Skill for the State area of 115-campus-ai-demo. 49 symbols across 10 files."
---

# State

49 symbols | 10 files | Cohesion: 66%

## When to Use

- Working with code in `google ai studio/`
- Understanding how createDeliveryOrder, saveSchedule, resolveTeachingSignal work
- Modifying state-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `google ai studio/app_3（國中）/AI校園心靈守護者/src/state/guardianState.ts` | createInitialGuardianState, loadGuardianState, normalizeGuardianState, normalizeList, nowIso (+16) |
| `google ai studio/app_2（國小）/校園服務機器人 app/src/state/appState.ts` | createDeliveryOrder, saveSchedule, resolveTeachingSignal, resetDemoState, persistState (+15) |
| `google ai studio/app_2（國小）/校園服務機器人 app/src/views/TeachView.tsx` | handleAlertAction |
| `google ai studio/app_2（國小）/校園服務機器人 app/src/views/LifeView.tsx` | handleSaveSchedule |
| `google ai studio/app_2（國小）/校園服務機器人 app/src/views/DeliveryView.tsx` | handleOrder |
| `google ai studio/app_2（國小）/校園服務機器人 app/src/state/appState.test.ts` | run |
| `google ai studio/app_2（國小）/校園服務機器人 app/src/services/hardwareBridge.ts` | sendHardwareCommand |
| `google ai studio/app_2（國小）/校園服務機器人 app/src/state/AppStateProvider.tsx` | AppStateProvider |
| `google ai studio/app_3（國中）/AI校園心靈守護者/src/state/guardianState.test.ts` | run |
| `google ai studio/app_3（國中）/AI校園心靈守護者/src/services/localGuardianAi.ts` | summarizeGuardianState |

## Entry Points

Start here when exploring this area:

- **`createDeliveryOrder`** (Function) — `google ai studio/app_2（國小）/校園服務機器人 app/src/state/appState.ts:473`
- **`saveSchedule`** (Function) — `google ai studio/app_2（國小）/校園服務機器人 app/src/state/appState.ts:481`
- **`resolveTeachingSignal`** (Function) — `google ai studio/app_2（國小）/校園服務機器人 app/src/state/appState.ts:485`
- **`resetDemoState`** (Function) — `google ai studio/app_2（國小）/校園服務機器人 app/src/state/appState.ts:489`
- **`persistState`** (Function) — `google ai studio/app_2（國小）/校園服務機器人 app/src/state/appState.ts:1040`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `createDeliveryOrder` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/state/appState.ts` | 473 |
| `saveSchedule` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/state/appState.ts` | 481 |
| `resolveTeachingSignal` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/state/appState.ts` | 485 |
| `resetDemoState` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/state/appState.ts` | 489 |
| `persistState` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/state/appState.ts` | 1040 |
| `handleAlertAction` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/views/TeachView.tsx` | 58 |
| `handleSaveSchedule` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/views/LifeView.tsx` | 43 |
| `handleOrder` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/views/DeliveryView.tsx` | 45 |
| `sendHardwareCommand` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/services/hardwareBridge.ts` | 10 |
| `AppStateProvider` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/state/AppStateProvider.tsx` | 43 |
| `createInitialAppState` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/state/appState.ts` | 246 |
| `loadPersistedState` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/state/appState.ts` | 1025 |
| `normalizePersistedState` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/state/appState.ts` | 1056 |
| `isRecord` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/state/appState.ts` | 1061 |
| `text` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/state/appState.ts` | 1063 |
| `number` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/state/appState.ts` | 1065 |
| `bool` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/state/appState.ts` | 1067 |
| `normalizeList` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/state/appState.ts` | 1069 |
| `nowIso` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/state/appState.ts` | 204 |
| `stampTime` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/state/appState.ts` | 205 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `AppReducer → NowIso` | intra_community | 5 |
| `AppReducer → Uid` | intra_community | 4 |
| `AppStateProvider → Stop_all` | cross_community | 3 |
| `AppStateProvider → _run_motion` | cross_community | 3 |
| `GuardianReducer → NowIso` | intra_community | 3 |
| `LoadGuardianState → CreateInitialGuardianState` | intra_community | 3 |
| `LoadGuardianState → Number` | cross_community | 3 |
| `LoadGuardianState → NormalizeList` | intra_community | 3 |
| `LoadPersistedState → CreateInitialAppState` | intra_community | 3 |
| `LoadPersistedState → NormalizeList` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Services | 10 calls |
| Views | 2 calls |

## How to Explore

1. `gitnexus_context({name: "createDeliveryOrder"})` — see callers and callees
2. `gitnexus_query({query: "state"})` — find related execution flows
3. Read key files listed above for implementation details
