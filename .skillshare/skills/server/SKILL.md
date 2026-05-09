---
name: server
description: "Skill for the Server area of 115-campus-ai-demo. 89 symbols across 14 files."
---

# Server

89 symbols | 14 files | Cohesion: 80%

## When to Use

- Working with code in `google ai studio/`
- Understanding how ensureDataDir, readJsonFile, writeJsonFile work
- Modifying server-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `google ai studio/app_1（國小）/AI自動板擦機器人/server/aiService.ts` | isGeminiConfigured, localChatReply, notesByIds, chatWithAI, normalizePercent (+11) |
| `google ai studio/app_1（國小）/AI自動板擦機器人/server/robotService.ts` | getActivePath, resolveTaskCommand, recordUnsupportedTask, parseSensorLine, readRobotSensors (+10) |
| `google ai studio/app_1（國小）/AI自動板擦機器人/server/sensorManager.ts` | saveAssignments, getAllDetectedPorts, getLiveZoneReadings, assignPortToZone, unassignPort (+9) |
| `google ai studio/app_1（國小）/AI自動板擦機器人/server/opsService.ts` | checkStorageWritable, checkStaticBuild, getReadyStatus, buildAppExport, writeBackupFile (+9) |
| `google ai studio/app_1（國小）/AI自動板擦機器人/server/ev3Manager.ts` | isSimulated, startEV3Manager, getEV3Status, sendEV3Command, getHosts (+3) |
| `google ai studio/app_1（國小）/AI自動板擦機器人/server/storage.ts` | ensureDataDir, readJsonFile, writeJsonFile, updateRobotStatus, appendTaskLog |
| `google ai studio/app_1（國小）/AI自動板擦機器人/server/api-contract.test.mjs` | sleep, waitForBridge, startTestServer, stopTestServer |
| `google ai studio/app_1（國小）/AI自動板擦機器人/server/http.ts` | getErrorMessage, sendError, ApiError |
| `google ai studio/app_1（國小）/AI自動板擦機器人/server/proxyRoutes.ts` | checkAuth, callGemini, registerProxyRoutes |
| `google ai studio/app_1（國小）/AI自動板擦機器人/server/routes.ts` | forceLocalAi, registerRoutes |

## Entry Points

Start here when exploring this area:

- **`ensureDataDir`** (Function) — `google ai studio/app_1（國小）/AI自動板擦機器人/server/storage.ts:5`
- **`readJsonFile`** (Function) — `google ai studio/app_1（國小）/AI自動板擦機器人/server/storage.ts:9`
- **`writeJsonFile`** (Function) — `google ai studio/app_1（國小）/AI自動板擦機器人/server/storage.ts:20`
- **`updateRobotStatus`** (Function) — `google ai studio/app_1（國小）/AI自動板擦機器人/server/storage.ts:25`
- **`appendTaskLog`** (Function) — `google ai studio/app_1（國小）/AI自動板擦機器人/server/storage.ts:36`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ApiError` | Class | `google ai studio/app_1（國小）/AI自動板擦機器人/server/http.ts` | 2 |
| `ensureDataDir` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/server/storage.ts` | 5 |
| `readJsonFile` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/server/storage.ts` | 9 |
| `writeJsonFile` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/server/storage.ts` | 20 |
| `updateRobotStatus` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/server/storage.ts` | 25 |
| `appendTaskLog` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/server/storage.ts` | 36 |
| `getAllDetectedPorts` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/server/sensorManager.ts` | 195 |
| `getLiveZoneReadings` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/server/sensorManager.ts` | 218 |
| `assignPortToZone` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/server/sensorManager.ts` | 222 |
| `unassignPort` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/server/sensorManager.ts` | 239 |
| `registerRoutes` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/server/routes.ts` | 17 |
| `getActivePath` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/server/robotService.ts` | 14 |
| `resolveTaskCommand` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/server/robotService.ts` | 18 |
| `recordUnsupportedTask` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/server/robotService.ts` | 192 |
| `getReadyStatus` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/server/opsService.ts` | 216 |
| `buildAppExport` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/server/opsService.ts` | 242 |
| `writeBackupFile` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/server/opsService.ts` | 266 |
| `getErrorMessage` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/server/http.ts` | 14 |
| `sendError` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/server/http.ts` | 18 |
| `isGeminiConfigured` | Function | `google ai studio/app_1（國小）/AI自動板擦機器人/server/aiService.ts` | 9 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `StartSensorPolling → IsSimulated` | cross_community | 9 |
| `StartSensorPolling → WaitForSerialResponse` | cross_community | 6 |
| `StartSensorPolling → EnsureDataDir` | cross_community | 5 |
| `StartSensorPolling → ParseSensorLine` | intra_community | 5 |
| `SendSerialCommandDrive → IsSimulated` | intra_community | 5 |
| `RecordUnsupportedTask → EnsureDataDir` | intra_community | 5 |
| `ChatWithAI → EnsureDataDir` | intra_community | 5 |
| `StartSensorPolling → OpenPort` | intra_community | 4 |
| `BuildAppExport → EnsureDataDir` | intra_community | 4 |
| `RegisterRoutes → IsSimulated` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Components | 1 calls |

## How to Explore

1. `gitnexus_context({name: "ensureDataDir"})` — see callers and callees
2. `gitnexus_query({query: "server"})` — find related execution flows
3. Read key files listed above for implementation details
