---
name: views
description: "Skill for the Views area of 115-campus-ai-demo. 18 symbols across 12 files."
---

# Views

18 symbols | 12 files | Cohesion: 74%

## When to Use

- Working with code in `google ai studio/`
- Understanding how completeOrder, TeachView, openStudent work
- Modifying views-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `google ai studio/app_2（國小）/校園服務機器人 app/src/views/DashboardView.tsx` | DashboardView, handleVisionFile, analyzeLiveVisionFrame |
| `google ai studio/app_2（國小）/校園服務機器人 app/src/views/TeachView.tsx` | TeachView, openStudent |
| `google ai studio/app_2（國小）/校園服務機器人 app/src/views/TaskScheduleView.tsx` | TaskScheduleView, toggleDay |
| `google ai studio/app_2（國小）/校園服務機器人 app/src/state/AppStateProvider.tsx` | useAppState, useAppActions |
| `google ai studio/app_2（國小）/校園服務機器人 app/src/services/demoFlow.ts` | getDemoSteps, getDemoHealth |
| `google ai studio/app_2（國小）/校園服務機器人 app/src/state/appState.ts` | completeOrder |
| `google ai studio/app_2（國小）/校園服務機器人 app/src/views/StudentReportView.tsx` | StudentReportView |
| `google ai studio/app_2（國小）/校園服務機器人 app/src/views/LifeView.tsx` | LifeView |
| `google ai studio/app_2（國小）/校園服務機器人 app/src/views/DispatchMapView.tsx` | DispatchMapView |
| `google ai studio/app_2（國小）/校園服務機器人 app/src/views/DeliveryView.tsx` | DeliveryView |

## Entry Points

Start here when exploring this area:

- **`completeOrder`** (Function) — `google ai studio/app_2（國小）/校園服務機器人 app/src/state/appState.ts:477`
- **`TeachView`** (Function) — `google ai studio/app_2（國小）/校園服務機器人 app/src/views/TeachView.tsx:9`
- **`openStudent`** (Function) — `google ai studio/app_2（國小）/校園服務機器人 app/src/views/TeachView.tsx:32`
- **`TaskScheduleView`** (Function) — `google ai studio/app_2（國小）/校園服務機器人 app/src/views/TaskScheduleView.tsx:5`
- **`toggleDay`** (Function) — `google ai studio/app_2（國小）/校園服務機器人 app/src/views/TaskScheduleView.tsx:13`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `completeOrder` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/state/appState.ts` | 477 |
| `TeachView` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/views/TeachView.tsx` | 9 |
| `openStudent` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/views/TeachView.tsx` | 32 |
| `TaskScheduleView` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/views/TaskScheduleView.tsx` | 5 |
| `toggleDay` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/views/TaskScheduleView.tsx` | 13 |
| `StudentReportView` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/views/StudentReportView.tsx` | 7 |
| `LifeView` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/views/LifeView.tsx` | 6 |
| `DispatchMapView` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/views/DispatchMapView.tsx` | 7 |
| `DeliveryView` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/views/DeliveryView.tsx` | 13 |
| `DeliveryTrackingView` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/views/DeliveryTrackingView.tsx` | 5 |
| `useAppState` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/state/AppStateProvider.tsx` | 110 |
| `useAppActions` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/state/AppStateProvider.tsx` | 116 |
| `DashboardView` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/views/DashboardView.tsx` | 8 |
| `handleVisionFile` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/views/DashboardView.tsx` | 58 |
| `analyzeLiveVisionFrame` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/views/DashboardView.tsx` | 110 |
| `analyzeCampusImage` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/services/localVision.ts` | 198 |
| `getDemoSteps` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/services/demoFlow.ts` | 15 |
| `getDemoHealth` | Function | `google ai studio/app_2（國小）/校園服務機器人 app/src/services/demoFlow.ts` | 31 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `TeachView → GetEnv` | cross_community | 6 |
| `TeachView → DetectSubject` | cross_community | 4 |
| `TeachView → DetectSituation` | cross_community | 4 |
| `TeachView → PickTemplate` | cross_community | 4 |
| `HandleVisionFile → PixelAt` | cross_community | 4 |
| `HandleVisionFile → ClampScore` | cross_community | 4 |
| `HandleVisionFile → ClassifyByPixels` | cross_community | 4 |
| `AnalyzeLiveVisionFrame → PixelAt` | cross_community | 4 |
| `AnalyzeLiveVisionFrame → ClampScore` | cross_community | 4 |
| `AnalyzeLiveVisionFrame → ClassifyByPixels` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Services | 5 calls |
| State | 2 calls |

## How to Explore

1. `gitnexus_context({name: "completeOrder"})` — see callers and callees
2. `gitnexus_query({query: "views"})` — find related execution flows
3. Read key files listed above for implementation details
