# App 3 Competition-Ready Upgrade Design
Date: 2026-05-10

## Problem Statement

App 3 has three panels (`SensingPanel`, `NodesPanel`, `LogsPanel`) defined but completely unreachable from the UI. `ActivePanel` type only includes `'alerts' | 'care' | 'robot'`, leaving sensing/nodes/logs as dead code. The `STUDENT_DEMO_GUIDE.md` explicitly references these panels, making the student demo incomplete. Additionally, several bugs exist that could cause visible failures during competition.

## Scope

Fix all critical bugs + expand navigation to expose the missing panels. No scope creep beyond making App 3 competition-ready.

## Architecture Decision: 4-Tab Navigation

Expand from 3 tabs → 4 tabs:

| Tab | id | Content |
|-----|----|---------|
| 預警 | `alerts` | AlertsPanel (existing) |
| 感知 | `sensing` | SensingPanel (existing, currently dead) |
| 照護 | `care` | CarePanel (existing) |
| 機器人 | `robot` | GuardianControlPanel + NodesPanel + LogsPanel |

Rationale: Sensing deserves its own tab (microphone, acoustic, proactive alert). Nodes and logs fold into robot tab naturally (hardware-adjacent). 4 tabs fit cleanly in mobile bottom nav and desktop PanelDock grid.

## Changes Required

### 1. Type Expansion
- `ActivePanel`: add `'sensing'`
- `panelTitle()`: add sensing case → `'感知中心'`

### 2. Navigation Wiring
- `panelNav` array: add `{id: 'sensing', label: '感知', icon: Radar}`
- Mobile bottom nav: change `grid-cols-3` → `grid-cols-4`
- `PanelDock`: change inner grid `grid-cols-3` → `grid-cols-4`

### 3. DetailDrawer Routing
- Add `{panel === 'sensing' && <SensingPanel {...props} />}`
- For `robot` panel: render `GuardianControlPanel` + below it `NodesPanel` + `LogsPanel` as stacked sections

### 4. Bug Fixes

#### Sparkline NaN (SoundSparkline ~L1275-1280)
```
// Before: toY uses (max - min) which = 0 when all values equal
const max = Math.max(...vals) || 1;
const toY = (v) => H - ((v - min) / (max - min)) * (H - 4) - 2;

// After: guard against flat line
const range = max - min || 1;
const toY = (v) => H - ((v - min) / range) * (H - 4) - 2;
```

#### Acoustic Interval Reset (SensingPanel ~L1333-1343)
The `setInterval` for trend sampling has `currentAcoustic.volumeIndex` in its dependency array via a callback closure, causing the interval to reset every frame when mic is active.
Fix: use a `ref` to hold the latest acoustic reading, so the interval callback reads `acousticRef.current` without being in the dep array.

#### Robot Timer Race (dispatchRobotToZone ~L254-262)
`robotTimersRef.current.push()` accumulates timers. If user dispatches multiple zones quickly, old timers fire on wrong missions.
Fix: clear all existing timers before pushing new ones for a dispatch.

#### Acoustic RAF Re-render (startAcousticMonitor ~L379-384)
`setCurrentAcoustic` inside RAF loop re-renders the entire AppContent on every frame.
Fix: wrap the acoustic display section in a separate `AcousticMonitor` component that owns its own `currentAcoustic` state and exposes a stable callback ref for signal recording.

### 5. Minor Tweaks
- `panelTitle()`: add `'sensing'` → `'感知中心'`
- `SensingPanel`: remove duplicate "已記錄本機環境聲量訊號" toast (currently fires even when not in sensing panel)
- Robot tab: add section dividers between `GuardianControlPanel` / `NodesPanel` / `LogsPanel`

## What We Are NOT Changing
- App logic, state shape, or reducers
- Server/bridge code  
- Visual design language (colors, typography)
- Test files

## Success Criteria
1. `npm run check` passes (all tests + TypeScript + build)
2. Clicking 感知 tab opens SensingPanel with microphone controls
3. Clicking 機器人 tab shows robot dispatch + nodes + hardware logs
4. SoundSparkline renders without NaN when all values equal
5. Acoustic trend samples accumulate correctly when mic is active
6. Fast double-dispatch does not trigger duplicate robot status updates
