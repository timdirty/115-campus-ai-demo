# 三 App 全面最佳化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全面提升三個競賽 App（板擦機器人/服務機器人/心靈守護者）的穩定性與完整性，補齊 Demo 保命 gate、WebSocket 即時硬體狀態、App 2/3 server 升級、韌體改善與 UI polish。

**Architecture:** Stability-first。P0 先補 demo gate scripts + WebSocket 雙軌（WS + polling fallback），再升 server、改韌體、最後 UI。三個 App 各自獨立 bridge（:3201/:3202/:3203）、統一 WsEvent 格式、統一 HardwareStatusBanner。

**Tech Stack:** TypeScript / React 19 / Vite / Express / Node.js / ws@8 / serialport@13 / tsx / PlatformIO / Arduino UNO R4 (Minima & WiFi)

**Path aliases (used throughout this plan):**
- `A1/` = `google ai studio/app_1（國小）/AI自動板擦機器人/`
- `A2/` = `google ai studio/app_2（國小）/校園服務機器人 app/`
- `A3/` = `google ai studio/app_3（國中）/AI校園心靈守護者/`
- `ROOT/` = repo root (`/Volumes/Tim aaddtional/Download/115資通訊/tedt/`)
- `FW/` = `src/` (PlatformIO firmware source)

---

## File Map

### New files to create

| File | Purpose |
|------|---------|
| `ROOT/scripts/start-all-bridges.sh` | 一鍵啟動三橋 |
| `ROOT/scripts/reset-all-demos.sh` | 一鍵 reset demo 資料 |
| `ROOT/scripts/rehearsal-check.mjs` | 30秒彩排健康檢查 |
| `A2/server/storage.ts` | JSON 持久化（delivery/task log） |
| `A2/server/aiService.ts` | Gemini proxy + 本機 AI fallback |
| `A3/server/storage.ts` | JSON 持久化（alert/intervention log + 節點指派） |
| `A3/server/aiService.ts` | Guardian AI proxy + 本機 fallback |
| `A1/src/hooks/useHardwareSocket.ts` | WebSocket + polling fallback hook |
| `A2/src/hooks/useHardwareSocket.ts` | 同上 |
| `A3/src/hooks/useHardwareSocket.ts` | 同上 |
| `A1/src/components/HardwareStatusBanner.tsx` | 頂部色帶硬體狀態 |
| `A2/src/components/HardwareStatusBanner.tsx` | 同上 |
| `A3/src/components/HardwareStatusBanner.tsx` | 同上 |
| `A1/src/components/CommandFeedbackToast.tsx` | 指令回饋 toast |
| `A2/src/components/CommandFeedbackToast.tsx` | 同上 |
| `A3/src/components/CommandFeedbackToast.tsx` | 同上 |

### Files to modify

| File | Change |
|------|--------|
| `A2/package.json` | 加 `ws`, `@types/ws`, `start` script |
| `A3/package.json` | 加 `ws`, `@types/ws`, `start` script |
| `ROOT/package.json` | 加 `start:all`, `reset:all`, `rehearsal` scripts |
| `A2/server/serialPort.ts` | 加 `onConnectionChange` callback export |
| `A3/server/serialPort.ts` | 加 `onConnectionChange` callback export |
| `A2/server/serialBridge.ts` | 升級為 http.createServer + wss + 新路由 |
| `A3/server/serialBridge.ts` | 升級為 http.createServer + wss + 新路由 + persistence |
| `A1/server/serialBridge.ts` | 升級為 http.createServer + wss |
| `FW/app1_whiteboard_drive/main.cpp` | 加 HEARTBEAT→PONG + STATUS |
| `FW/app2_sweeper_drive/main.cpp` | 加 HEARTBEAT→PONG + SWEEP_STATUS |
| `FW/app3_guardian_drive/main.cpp` | 加 SENSOR_SNAPSHOT + NODE_STATUS |
| `A1/src/App.tsx` | 加入 HardwareStatusBanner |
| `A2/src/App.tsx` | 加入 HardwareStatusBanner |
| `A3/src/App.tsx` | 加入 HardwareStatusBanner |

---

## BATCH A — Demo Gate + WebSocket (P0 + P1)

---

### Task 1: Project Setup — ws 依賴 + start scripts

**Files:**
- Modify: `A2/package.json`
- Modify: `A3/package.json`
- Modify: `ROOT/package.json`

- [ ] **Step 1: 在 A2 加入 ws 依賴與 start script**

```bash
cd "google ai studio/app_2（國小）/校園服務機器人 app"
npm install ws@^8.18.0
npm install --save-dev @types/ws@^8.5.14
```

Then add to `A2/package.json` scripts:
```json
"start": "NODE_ENV=production tsx server/serialBridge.ts"
```

- [ ] **Step 2: 在 A3 加入 ws 依賴與 start script**

```bash
cd "google ai studio/app_3（國中）/AI校園心靈守護者"
npm install ws@^8.18.0
npm install --save-dev @types/ws@^8.5.14
```

Then add to `A3/package.json` scripts:
```json
"start": "NODE_ENV=production tsx server/serialBridge.ts"
```

- [ ] **Step 3: Root package.json 加跨 App 腳本**

Edit `ROOT/package.json` (or create if absent). Add to scripts:
```json
{
  "scripts": {
    "start:all": "bash scripts/start-all-bridges.sh",
    "reset:all": "bash scripts/reset-all-demos.sh",
    "rehearsal": "node scripts/rehearsal-check.mjs"
  }
}
```

If root `package.json` does not exist, create it:
```json
{
  "name": "tedt-competition-root",
  "private": true,
  "scripts": {
    "start:all": "bash scripts/start-all-bridges.sh",
    "reset:all": "bash scripts/reset-all-demos.sh",
    "rehearsal": "node scripts/rehearsal-check.mjs"
  }
}
```

- [ ] **Step 4: 驗證 ws 安裝**

```bash
cd "google ai studio/app_2（國小）/校園服務機器人 app" && node -e "import('ws').then(m => console.log('ws ok:', typeof m.WebSocketServer))"
cd "google ai studio/app_3（國中）/AI校園心靈守護者" && node -e "import('ws').then(m => console.log('ws ok:', typeof m.WebSocketServer))"
```
Expected: `ws ok: function` for both.

- [ ] **Step 5: Commit**

```bash
git add "google ai studio/app_2（國小）/校園服務機器人 app/package.json" \
        "google ai studio/app_2（國小）/校園服務機器人 app/package-lock.json" \
        "google ai studio/app_3（國中）/AI校園心靈守護者/package.json" \
        "google ai studio/app_3（國中）/AI校園心靈守護者/package-lock.json"
git commit -m "feat: add ws dependency and start script to App 2 and App 3"
```

---

### Task 2: Demo Gate Scripts

**Files:**
- Create: `ROOT/scripts/start-all-bridges.sh`
- Create: `ROOT/scripts/reset-all-demos.sh`
- Create: `ROOT/scripts/rehearsal-check.mjs`

- [ ] **Step 1: 建立 scripts/ 目錄（若不存在）**

```bash
ls scripts/ || mkdir scripts
```

- [ ] **Step 2: 寫 start-all-bridges.sh**

Create `ROOT/scripts/start-all-bridges.sh`:
```bash
#!/usr/bin/env bash
# Start all three Arduino bridges. Ctrl+C stops all.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
A1="$ROOT/google ai studio/app_1（國小）/AI自動板擦機器人"
A2="$ROOT/google ai studio/app_2（國小）/校園服務機器人 app"
A3="$ROOT/google ai studio/app_3（國中）/AI校園心靈守護者"

PIDS=()
cleanup() {
  echo ""
  echo "Stopping all bridges..."
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
  exit 0
}
trap cleanup INT TERM

echo "🚀 Starting App 1 bridge on :3201..."
(cd "$A1" && BRIDGE_PORT=3201 NODE_ENV=production npx tsx server/serialBridge.ts 2>&1 | sed 's/^/[A1] /') &
PIDS+=($!)

echo "🚀 Starting App 2 bridge on :3202..."
(cd "$A2" && BRIDGE_PORT=3202 npx tsx server/serialBridge.ts 2>&1 | sed 's/^/[A2] /') &
PIDS+=($!)

echo "🚀 Starting App 3 bridge on :3203..."
(cd "$A3" && BRIDGE_PORT=3203 npx tsx server/serialBridge.ts 2>&1 | sed 's/^/[A3] /') &
PIDS+=($!)

echo "Waiting for bridges to start..."
sleep 3

echo ""
for port in 3201 3202 3203; do
  if curl -sf "http://localhost:$port/api/health" &>/dev/null; then
    echo "✅ Bridge :$port ready"
  else
    echo "❌ Bridge :$port not responding"
  fi
done

echo ""
echo "Press Ctrl+C to stop all bridges"
wait
```

```bash
chmod +x scripts/start-all-bridges.sh
```

- [ ] **Step 3: 寫 reset-all-demos.sh**

Create `ROOT/scripts/reset-all-demos.sh`:
```bash
#!/usr/bin/env bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
A1="$ROOT/google ai studio/app_1（國小）/AI自動板擦機器人"
A2="$ROOT/google ai studio/app_2（國小）/校園服務機器人 app"
A3="$ROOT/google ai studio/app_3（國中）/AI校園心靈守護者"

reset_via_api() {
  local port=$1 name=$2
  if curl -sf -X POST "http://localhost:$port/api/ops/reset" &>/dev/null; then
    echo "✅ $name reset via API"
    return 0
  fi
  return 1
}

reset_via_files() {
  local dir=$1 name=$2
  rm -f "$dir/data/"*.json 2>/dev/null || true
  echo "✅ $name data files cleared"
}

echo "🔄 Resetting all demo data..."
reset_via_api 3201 "App1" || reset_via_files "$A1" "App1"
reset_via_api 3202 "App2" || reset_via_files "$A2" "App2"
reset_via_api 3203 "App3" || reset_via_files "$A3" "App3"
echo "✅ All demo data reset"
```

```bash
chmod +x scripts/reset-all-demos.sh
```

- [ ] **Step 4: 寫 rehearsal-check.mjs**

Create `ROOT/scripts/rehearsal-check.mjs`:
```js
#!/usr/bin/env node
const BRIDGES = [
  { name: 'App1 板擦機器人', port: 3201 },
  { name: 'App2 服務機器人', port: 3202 },
  { name: 'App3 心靈守護者', port: 3203 },
];

let allOk = true;

for (const bridge of BRIDGES) {
  const url = `http://localhost:${bridge.port}/api/health`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const arduino = data.arduinoConnected ?? false;
    const ai = data.geminiConfigured ?? data.ai ?? false;
    const sim = data.hardwareSimulation ?? false;
    console.log(`✅ ${bridge.name} (:${bridge.port})`);
    console.log(`   Arduino: ${arduino ? '🟢 connected' : sim ? '🟡 simulated' : '🔴 disconnected'}`);
    console.log(`   AI:      ${ai ? '🟢 Gemini' : '🟡 local fallback'}`);
  } catch (e) {
    console.log(`❌ ${bridge.name} (:${bridge.port}): ${e.message}`);
    console.log(`   → Run: npm run start:all`);
    allOk = false;
  }
}

console.log('');
if (allOk) {
  console.log('🟢 DEMO READY');
} else {
  console.log('🔴 DEMO NOT READY — fix above errors before demo');
  process.exit(1);
}
```

- [ ] **Step 5: 測試彩排腳本（bridge 未啟動時應印 NOT READY）**

```bash
node scripts/rehearsal-check.mjs
```
Expected: 三個 `❌` 錯誤 + `🔴 DEMO NOT READY`（因為 bridge 還沒啟動）

- [ ] **Step 6: Commit**

```bash
git add scripts/
git commit -m "feat: add demo gate scripts (start-all, reset-all, rehearsal-check)"
```

---

### Task 3: App 2 WebSocket — serialPort + bridge 升級

**Files:**
- Modify: `A2/server/serialPort.ts`
- Modify: `A2/server/serialBridge.ts`

- [ ] **Step 1: 在 serialPort.ts 加 onConnectionChange callback**

在 `A2/server/serialPort.ts` 的 telemetry 定義之後（約行 40）加入：

```ts
type ConnectionChangeHandler = (connected: boolean, path: string | null) => void;
const connectionHandlers: ConnectionChangeHandler[] = [];

export function onConnectionChange(handler: ConnectionChangeHandler): void {
  connectionHandlers.push(handler);
}

function notifyConnectionChange(connected: boolean, path: string | null) {
  for (const h of connectionHandlers) {
    try { h(connected, path); } catch { /* ignore */ }
  }
}
```

Then in the existing open/close events (look for where `telemetry.connected = true` is set), add `notifyConnectionChange(true, activePath)` after it. Add `notifyConnectionChange(false, null)` where `telemetry.connected = false`.

Find existing code pattern like:
```ts
telemetry.connected = true;
```
After that line, add:
```ts
notifyConnectionChange(true, activePath);
```

Find existing code pattern like:
```ts
telemetry.connected = false;
```
After that line, add:
```ts
notifyConnectionChange(false, null);
```

- [ ] **Step 2: 升級 A2/server/serialBridge.ts 加入 WebSocket**

At the top of `A2/server/serialBridge.ts`, add these imports (after existing imports):
```ts
import {createServer} from 'node:http';
import {WebSocketServer, WebSocket} from 'ws';
import {onConnectionChange} from './serialPort';
```

After `const app = express();`, add:
```ts
type WsEvent =
  | {type: 'arduino_status'; connected: boolean; port: string; simulated: boolean}
  | {type: 'command_ack'; command: string; ok: boolean; response?: string};

const httpServer = createServer(app);
const wss = new WebSocketServer({server: httpServer});

function broadcast(event: WsEvent) {
  const data = JSON.stringify(event);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data, (err) => { if (err) { /* ignore */ } });
    }
  }
}

onConnectionChange((connected, path) => {
  broadcast({type: 'arduino_status', connected, port: path ?? '', simulated: false});
});
```

In the existing `POST /api/robot/command` handler, after `res.status(...).json(...)`, add:
```ts
broadcast({type: 'command_ack', command: normalized, ok: result.ok, response: result.ok ? `Sent ${normalized}` : result.message});
```

Replace the final `server.listen(bridgePort, ...)` call with:
```ts
httpServer.listen(bridgePort, () => {
  console.log(`[bridge] App 2 service-robot serial bridge listening on http://localhost:${bridgePort}`);
  console.log(`[bridge] Baud rate: 115200`);
  void tryAutoOpen();
});

httpServer.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[bridge] port ${bridgePort} already in use, exiting.`);
    process.exit(1);
  }
  console.error(`[bridge] server error: ${error.message}`);
});
```

Also update the signal handlers to use `httpServer.close()` instead of `server.close()`.

- [ ] **Step 3: 確認 TypeScript 編譯無錯誤**

```bash
cd "google ai studio/app_2（國小）/校園服務機器人 app" && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: 手動測試 WebSocket 端點**

Start bridge: `cd "google ai studio/app_2（國小）/校園服務機器人 app" && BRIDGE_PORT=3202 npx tsx server/serialBridge.ts &`

Test WS endpoint:
```bash
node -e "
import {WebSocket} from 'ws';
const ws = new WebSocket('ws://localhost:3202/ws');
ws.on('open', () => { console.log('WS connected'); ws.close(); process.exit(0); });
ws.on('error', (e) => { console.error('WS error:', e.message); process.exit(1); });
setTimeout(() => { console.error('timeout'); process.exit(1); }, 3000);
"
```
Expected: `WS connected`

Kill the bridge: `kill %1`

- [ ] **Step 5: Commit**

```bash
git add "google ai studio/app_2（國小）/校園服務機器人 app/server/"
git commit -m "feat(app2): add WebSocket endpoint to serial bridge"
```

---

### Task 4: App 3 WebSocket — serialPort + bridge 升級

**Files:**
- Modify: `A3/server/serialPort.ts`
- Modify: `A3/server/serialBridge.ts`

Same pattern as Task 3 but for App 3.

- [ ] **Step 1: 在 A3/server/serialPort.ts 加 onConnectionChange**

Identical changes as Task 3 Step 1 but in `A3/server/serialPort.ts`.

Look at the existing code for where connected status is set (after `tryAutoOpen` resolves or in the open handler). Add after `telemetry.connected = true`:
```ts
notifyConnectionChange(true, activePath);
```
Add after `telemetry.connected = false`:
```ts
notifyConnectionChange(false, null);
```

Export `onConnectionChange` as in Task 3.

- [ ] **Step 2: 升級 A3/server/serialBridge.ts 加入 WebSocket**

Same pattern as Task 3 Step 2 but in `A3/server/serialBridge.ts`. Note: App 3's bridge also has `/api/robot/drive` endpoint — also broadcast after that command:

```ts
broadcast({type: 'command_ack', command: normalized, ok: result.ok});
```

Also: App 3 bridge uses `httpServer = app.listen(...)` already (it returns server). Replace with `createServer(app)` pattern same as Task 3.

Also App 3 already has `void startSensorPolling()` call — keep it. In the sensor polling loop (the while loop in `startSensorPolling`), after `requestSensorRead()` succeeds, broadcast the sensor snapshot:

Add import: `import {getLastSensorSnapshot} from './serialPort';` (already imported)

After `await requestSensorRead(1500).catch(() => null)`, add:
```ts
const snap = getLastSensorSnapshot();
if (snap) {
  broadcast({type: 'sensor_snapshot', temp: snap.temp ?? null, hum: snap.hum ?? null, light: snap.light ?? null});
}
```

Update the WsEvent type to include:
```ts
| {type: 'sensor_snapshot'; temp: number|null; hum: number|null; light: number|null}
```

- [ ] **Step 3: TypeScript 編譯檢查**

```bash
cd "google ai studio/app_3（國中）/AI校園心靈守護者" && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "google ai studio/app_3（國中）/AI校園心靈守護者/server/"
git commit -m "feat(app3): add WebSocket endpoint with sensor snapshot broadcast"
```

---

### Task 5: App 1 WebSocket — bridge 升級

**Files:**
- Modify: `A1/server/serialBridge.ts`

App 1 already has `ws` in dependencies. It uses `app.listen()` at the bottom.

- [ ] **Step 1: 升級 A1/server/serialBridge.ts**

Add imports at the top (after existing imports):
```ts
import {createServer} from 'node:http';
import {WebSocketServer, WebSocket} from 'ws';
```

App 1 doesn't have a serialPort.ts — it uses `robotService.ts`. The connection events need to hook into `robotService.ts`. However, App 1's architecture is different — it exposes connection state through `getActivePath()`. We'll use a simpler approach: broadcast on each command call.

After `const app = express();`, add:
```ts
type WsEvent =
  | {type: 'arduino_status'; connected: boolean; port: string; simulated: boolean}
  | {type: 'command_ack'; command: string; ok: boolean; response?: string}
  | {type: 'sensor_snapshot'; temp: number|null; hum: number|null; light: number|null};

const httpServer = createServer(app);
const wss = new WebSocketServer({server: httpServer});

export function broadcast(event: WsEvent) {
  const data = JSON.stringify(event);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data, (err) => { if (err) { /* ignore */ } });
    }
  }
}
```

Replace the final `app.listen(bridgePort, () => { ... })` with:
```ts
httpServer.listen(bridgePort, () => {
  console.log(`Arduino serial bridge listening on http://localhost:${bridgePort}`);
  console.log(`Baud rate: ${baudRate}`);
  console.log(`Mode: ${nodeEnv}`);
  if (nodeEnv !== 'test') {
    startSensorPolling().catch(console.error);
    startEV3Manager();
  }
});
```

- [ ] **Step 2: 在 routes.ts 裡廣播指令 ACK**

In `A1/server/routes.ts`, import the broadcast function:
```ts
// Add near top of routes.ts, after existing imports:
// Note: we use a lazy import to avoid circular deps
```

Actually, to avoid circular dependency, pass broadcast as a parameter. Better approach: create a separate `wsBroadcast.ts` module.

Create `A1/server/wsBroadcast.ts`:
```ts
type WsEvent =
  | {type: 'arduino_status'; connected: boolean; port: string; simulated: boolean}
  | {type: 'command_ack'; command: string; ok: boolean; response?: string}
  | {type: 'sensor_snapshot'; temp: number|null; hum: number|null; light: number|null};

type BroadcastFn = (event: WsEvent) => void;
let broadcastFn: BroadcastFn = () => {};

export function registerBroadcast(fn: BroadcastFn) {
  broadcastFn = fn;
}

export function broadcast(event: WsEvent) {
  broadcastFn(event);
}
```

In `A1/server/serialBridge.ts`, after creating the `broadcast` function:
```ts
import {registerBroadcast} from './wsBroadcast';
registerBroadcast(broadcast);
```

In `A1/server/routes.ts`, for robot command endpoints, add after the response:
```ts
import {broadcast} from './wsBroadcast';
// After res.json({...}):
broadcast({type: 'command_ack', command: normalized, ok: true});
```

- [ ] **Step 3: TypeScript 編譯檢查**

```bash
cd "google ai studio/app_1（國小）/AI自動板擦機器人" && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "google ai studio/app_1（國小）/AI自動板擦機器人/server/"
git commit -m "feat(app1): add WebSocket endpoint to serial bridge"
```

---

### Task 6: Frontend useHardwareSocket Hook + HardwareStatusBanner（三個 App）

**Files:**
- Create: `A1/src/hooks/useHardwareSocket.ts`
- Create: `A2/src/hooks/useHardwareSocket.ts`
- Create: `A3/src/hooks/useHardwareSocket.ts`
- Create: `A1/src/components/HardwareStatusBanner.tsx`
- Create: `A2/src/components/HardwareStatusBanner.tsx`
- Create: `A3/src/components/HardwareStatusBanner.tsx`
- Modify: `A1/src/App.tsx`
- Modify: `A2/src/App.tsx`
- Modify: `A3/src/App.tsx`

- [ ] **Step 1: 建立 useHardwareSocket hook（三個 App 內容相同）**

Create `A1/src/hooks/useHardwareSocket.ts`, `A2/src/hooks/useHardwareSocket.ts`, `A3/src/hooks/useHardwareSocket.ts` — all with identical content:

```ts
import {useCallback, useEffect, useRef, useState} from 'react';

export interface HardwareStatus {
  connected: boolean;
  port: string;
  simulated: boolean;
}

export interface CommandAck {
  command: string;
  ok: boolean;
  response?: string;
}

export type TransportMode = 'ws' | 'polling' | 'connecting';

const WS_CONNECT_TIMEOUT_MS = 5000;
const WS_RECONNECT_INITIAL_MS = 1000;
const WS_RECONNECT_MAX_MS = 30_000;
const POLL_INTERVAL_MS = 3000;

function wsUrl(bridgeUrl: string) {
  return bridgeUrl.replace(/^http/, 'ws') + '/ws';
}

function healthUrl(bridgeUrl: string) {
  return bridgeUrl + '/api/health';
}

export function useHardwareSocket(bridgeUrl: string) {
  const [status, setStatus] = useState<HardwareStatus>({connected: false, port: '', simulated: false});
  const [lastCommand, setLastCommand] = useState<CommandAck | null>(null);
  const [mode, setMode] = useState<TransportMode>('connecting');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(WS_RECONNECT_INITIAL_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const usingPollingRef = useRef(false);
  const unmountedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    usingPollingRef.current = false;
  }, []);

  const startPolling = useCallback(() => {
    if (pollTimerRef.current || unmountedRef.current) return;
    usingPollingRef.current = true;
    setMode('polling');

    const poll = async () => {
      if (unmountedRef.current) return;
      try {
        const r = await fetch(healthUrl(bridgeUrl), {signal: AbortSignal.timeout(2000)});
        if (!r.ok) throw new Error('not ok');
        const data = await r.json() as Record<string, unknown>;
        setStatus({
          connected: Boolean(data.arduinoConnected),
          port: String(data.activePath ?? ''),
          simulated: Boolean(data.hardwareSimulation),
        });
      } catch {
        setStatus({connected: false, port: '', simulated: false});
      }
    };

    void poll();
    pollTimerRef.current = setInterval(() => void poll(), POLL_INTERVAL_MS);
  }, [bridgeUrl]);

  const connectWs = useCallback(() => {
    if (unmountedRef.current) return;

    const ws = new WebSocket(wsUrl(bridgeUrl));
    wsRef.current = ws;

    const connectTimeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.close();
        startPolling();
      }
    }, WS_CONNECT_TIMEOUT_MS);

    ws.onopen = () => {
      clearTimeout(connectTimeout);
      stopPolling();
      setMode('ws');
      reconnectDelayRef.current = WS_RECONNECT_INITIAL_MS;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as Record<string, unknown>;
        if (msg.type === 'arduino_status') {
          setStatus({
            connected: Boolean(msg.connected),
            port: String(msg.port ?? ''),
            simulated: Boolean(msg.simulated),
          });
        } else if (msg.type === 'command_ack') {
          setLastCommand({
            command: String(msg.command ?? ''),
            ok: Boolean(msg.ok),
            response: msg.response != null ? String(msg.response) : undefined,
          });
        }
      } catch { /* ignore malformed */ }
    };

    ws.onclose = () => {
      clearTimeout(connectTimeout);
      wsRef.current = null;
      if (!unmountedRef.current && !usingPollingRef.current) {
        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(delay * 2, WS_RECONNECT_MAX_MS);
        setMode('connecting');
        reconnectTimerRef.current = setTimeout(() => { connectWs(); }, delay);
      }
    };

    ws.onerror = () => { ws.close(); };
  }, [bridgeUrl, startPolling, stopPolling]);

  useEffect(() => {
    unmountedRef.current = false;
    connectWs();
    return () => {
      unmountedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      stopPolling();
      wsRef.current?.close();
    };
  }, [connectWs, stopPolling]);

  return {status, lastCommand, mode};
}
```

- [ ] **Step 2: 建立 HardwareStatusBanner（App 1）**

Create `A1/src/components/HardwareStatusBanner.tsx`:
```tsx
import {useHardwareSocket} from '../hooks/useHardwareSocket';

const BRIDGE_URL = (import.meta.env?.VITE_ARDUINO_BRIDGE_URL as string | undefined) ?? 'http://localhost:3201';

export function HardwareStatusBanner() {
  const {status, mode} = useHardwareSocket(BRIDGE_URL);

  const colorClass = status.connected
    ? 'bg-green-500'
    : status.simulated
    ? 'bg-yellow-400'
    : 'bg-red-500';

  const label = status.connected
    ? `Arduino 已連線${status.port ? ` (${status.port})` : ''}`
    : status.simulated
    ? '硬體模擬模式'
    : 'Arduino 未連線';

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 h-1 transition-colors duration-700 ${colorClass}`}
      title={`${label} • ${mode}`}
      aria-label={label}
    />
  );
}
```

- [ ] **Step 3: 建立 HardwareStatusBanner（App 2）**

Create `A2/src/components/HardwareStatusBanner.tsx` — same content but change BRIDGE_URL to `'http://localhost:3202'`.

- [ ] **Step 4: 建立 HardwareStatusBanner（App 3）**

Create `A3/src/components/HardwareStatusBanner.tsx` — same content but change BRIDGE_URL to `'http://localhost:3203'`.

- [ ] **Step 5: 在 App 1 App.tsx 加入 Banner**

Open `A1/src/App.tsx`. Add import:
```tsx
import {HardwareStatusBanner} from './components/HardwareStatusBanner';
```

Add `<HardwareStatusBanner />` as the first child inside the outermost div/fragment returned by App. Also add `pt-1` or equivalent top padding to the main container so content isn't hidden by the 1px bar.

- [ ] **Step 6: 在 App 2 App.tsx 加入 Banner**

Same as Step 5 but for `A2/src/App.tsx`.

- [ ] **Step 7: 在 App 3 App.tsx 加入 Banner**

Same as Step 5 but for `A3/src/App.tsx`.

- [ ] **Step 8: TypeScript 編譯三個 App**

```bash
cd "google ai studio/app_1（國小）/AI自動板擦機器人" && npx tsc --noEmit
cd "google ai studio/app_2（國小）/校園服務機器人 app" && npx tsc --noEmit
cd "google ai studio/app_3（國中）/AI校園心靈守護者" && npx tsc --noEmit
```
Expected: no errors in any App.

- [ ] **Step 9: Commit**

```bash
git add \
  "google ai studio/app_1（國小）/AI自動板擦機器人/src/hooks/useHardwareSocket.ts" \
  "google ai studio/app_1（國小）/AI自動板擦機器人/src/components/HardwareStatusBanner.tsx" \
  "google ai studio/app_1（國小）/AI自動板擦機器人/src/App.tsx" \
  "google ai studio/app_2（國小）/校園服務機器人 app/src/hooks/useHardwareSocket.ts" \
  "google ai studio/app_2（國小）/校園服務機器人 app/src/components/HardwareStatusBanner.tsx" \
  "google ai studio/app_2（國小）/校園服務機器人 app/src/App.tsx" \
  "google ai studio/app_3（國中）/AI校園心靈守護者/src/hooks/useHardwareSocket.ts" \
  "google ai studio/app_3（國中）/AI校園心靈守護者/src/components/HardwareStatusBanner.tsx" \
  "google ai studio/app_3（國中）/AI校園心靈守護者/src/App.tsx"
git commit -m "feat: add useHardwareSocket hook and HardwareStatusBanner to all 3 apps"
```

---

## BATCH B — Server Upgrade + Firmware (P2 + P3)

---

### Task 7: App 2 Server Storage + AI Service

**Files:**
- Create: `A2/server/storage.ts`
- Create: `A2/server/aiService.ts`

- [ ] **Step 1: 建立 A2/server/storage.ts**

```ts
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const dataDir = join(process.cwd(), 'data');

export async function ensureDataDir() {
  await mkdir(dataDir, {recursive: true});
}

export async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  await ensureDataDir();
  try {
    const raw = await readFile(file, 'utf8');
    const parsed = JSON.parse(raw) as T;
    return parsed;
  } catch {
    await writeJsonFile(file, fallback);
    return fallback;
  }
}

export async function writeJsonFile<T>(file: string, value: T): Promise<void> {
  await ensureDataDir();
  await writeFile(file, JSON.stringify(value, null, 2), 'utf8');
}

export interface DeliveryLogItem {
  id: number;
  createdAt: string;
  command: string;
  source: string;
  ok: boolean;
  message?: string;
}

export interface TaskLogItem {
  id: number;
  createdAt: string;
  command: string;
  source: string;
  ok: boolean;
  message?: string;
}

const deliveryLogFile = join(dataDir, 'delivery-log.json');
const taskLogFile = join(dataDir, 'task-log.json');

export async function appendDeliveryLog(item: Omit<DeliveryLogItem, 'id' | 'createdAt'>): Promise<DeliveryLogItem[]> {
  const current = await readJsonFile<DeliveryLogItem[]>(deliveryLogFile, []);
  const entry: DeliveryLogItem = {id: Date.now(), createdAt: new Date().toISOString(), ...item};
  const next = [entry, ...current].slice(0, 100);
  await writeJsonFile(deliveryLogFile, next);
  return next;
}

export async function appendTaskLog(item: Omit<TaskLogItem, 'id' | 'createdAt'>): Promise<TaskLogItem[]> {
  const current = await readJsonFile<TaskLogItem[]>(taskLogFile, []);
  const entry: TaskLogItem = {id: Date.now(), createdAt: new Date().toISOString(), ...item};
  const next = [entry, ...current].slice(0, 100);
  await writeJsonFile(taskLogFile, next);
  return next;
}

export async function getRecentLogs(): Promise<{delivery: DeliveryLogItem[]; tasks: TaskLogItem[]}> {
  const [delivery, tasks] = await Promise.all([
    readJsonFile<DeliveryLogItem[]>(deliveryLogFile, []),
    readJsonFile<TaskLogItem[]>(taskLogFile, []),
  ]);
  return {delivery: delivery.slice(0, 20), tasks: tasks.slice(0, 20)};
}

export async function resetDemoData(): Promise<void> {
  await writeJsonFile(deliveryLogFile, []);
  await writeJsonFile(taskLogFile, []);
}
```

- [ ] **Step 2: 建立 A2/server/aiService.ts**

```ts
import {GoogleGenAI} from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const geminiApiKey = process.env.GEMINI_API_KEY ?? process.env.VITE_GEMINI_API_KEY ?? '';
const ai = geminiApiKey ? new GoogleGenAI({apiKey: geminiApiKey}) : null;

export function isGeminiConfigured(): boolean {
  return Boolean(ai);
}

export async function analyzeCampusTask(
  taskType: string,
  context: string,
  forceLocal = false,
): Promise<{result: string; fromLocal: boolean}> {
  if (ai && !forceLocal) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `你是一個校園服務機器人的 AI 助手，協助分析任務並給出建議。任務類型：${taskType}。背景：${context}。請用繁體中文回覆，50字內。`,
      });
      const text = response.text?.trim() ?? '';
      if (text) return {result: text, fromLocal: false};
    } catch { /* fall through to local */ }
  }
  return {result: localCampusReply(taskType), fromLocal: true};
}

function localCampusReply(taskType: string): string {
  const replies: Record<string, string> = {
    delivery: '配送任務已接收，請確認收件位置並保持走道通暢，機器人將儘快完成配送。',
    patrol: '巡邏任務啟動，機器人將掃描指定區域並回報狀態。',
    clean: '清潔排程已設定，滾筒系統將在指定時間啟動。',
    teach: '教學輔助模式已啟動，請準備好教學材料。',
    broadcast: '廣播任務接收，正在準備播送指定訊息。',
    safety: '安全封鎖指令已確認，校園緊急模式啟動。',
  };
  return replies[taskType.toLowerCase()] ?? '任務已接收，系統正在處理中。';
}
```

- [ ] **Step 3: TypeScript 編譯檢查**

```bash
cd "google ai studio/app_2（國小）/校園服務機器人 app" && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "google ai studio/app_2（國小）/校園服務機器人 app/server/storage.ts" \
        "google ai studio/app_2（國小）/校園服務機器人 app/server/aiService.ts"
git commit -m "feat(app2): add server storage and AI service"
```

---

### Task 8: App 2 serialBridge.ts 路由擴充

**Files:**
- Modify: `A2/server/serialBridge.ts`

- [ ] **Step 1: 加入 storage 和 aiService imports**

At the top of `A2/server/serialBridge.ts`, add after existing imports:
```ts
import {appendTaskLog, getRecentLogs, resetDemoData, isGeminiConfigured} from './storage';
// Note: isGeminiConfigured needs to be re-exported or imported directly:
import {isGeminiConfigured as checkAi, analyzeCampusTask} from './aiService';
```

- [ ] **Step 2: 加入 /api/ready 端點**

Add before `app.use('/api', ...)`:
```ts
app.get('/api/ready', (_req, res) => {
  res.json({
    ok: true,
    bridge: true,
    bridge_port: bridgePort,
    arduino: isConnected(),
    ai: checkAi(),
    uptime_seconds: Math.round(process.uptime()),
  });
});
```

- [ ] **Step 3: 升級 /api/robot/command 加入 task log**

In the existing `POST /api/robot/command` handler, after `const result = await sendCommand(normalized)`, add:
```ts
void appendTaskLog({command: normalized, source: typeof source === 'string' ? source : 'api', ok: result.ok, message: result.ok ? undefined : result.message});
```

- [ ] **Step 4: 加入 /api/robot/task 端點**

Add after the existing `/api/robot/command`:
```ts
app.post('/api/robot/task', async (req, res) => {
  const {command, source, taskType} = req.body ?? {};
  if (typeof command !== 'string' || !command.trim()) {
    return res.status(400).json({error: 'command required'});
  }
  const normalized = command.trim().toUpperCase();
  const result = await sendCommand(normalized);
  void appendTaskLog({
    command: normalized,
    source: typeof source === 'string' ? source : 'task-api',
    ok: result.ok,
    message: result.ok ? undefined : result.message,
  });
  broadcast({type: 'command_ack', command: normalized, ok: result.ok});
  res.status(result.ok ? 200 : 503).json({
    ok: result.ok,
    response: result.ok ? `Task ${normalized} sent` : undefined,
    error: result.ok ? undefined : result.message,
  });
});
```

- [ ] **Step 5: 加入 /api/ai/campus 端點**

```ts
app.post('/api/ai/campus', async (req, res) => {
  const {taskType, context, forceLocal} = req.body ?? {};
  if (typeof taskType !== 'string') {
    return res.status(400).json({error: 'taskType required'});
  }
  const result = await analyzeCampusTask(
    taskType,
    typeof context === 'string' ? context : '',
    Boolean(forceLocal),
  );
  res.json(result);
});
```

- [ ] **Step 6: 加入 /api/logs 和 /api/ops/reset 端點**

```ts
app.get('/api/logs', async (_req, res) => {
  const logs = await getRecentLogs();
  res.json(logs);
});

app.post('/api/ops/reset', async (_req, res) => {
  await resetDemoData();
  res.json({ok: true, message: 'Demo data reset'});
});
```

- [ ] **Step 7: TypeScript 編譯 + 測試**

```bash
cd "google ai studio/app_2（國小）/校園服務機器人 app" && npx tsc --noEmit
```

Start bridge and test:
```bash
BRIDGE_PORT=3202 npx tsx server/serialBridge.ts &
sleep 2
curl -s http://localhost:3202/api/ready | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const p=JSON.parse(d); console.log('ready ok:', p.ok === true)"
kill %1
```
Expected: `ready ok: true`

- [ ] **Step 8: Commit**

```bash
git add "google ai studio/app_2（國小）/校園服務機器人 app/server/serialBridge.ts"
git commit -m "feat(app2): add /api/ready, /api/robot/task, /api/ai/campus, /api/logs, /api/ops/reset"
```

---

### Task 9: App 3 Server Storage + AI Service + Persistence Fix

**Files:**
- Create: `A3/server/storage.ts`
- Create: `A3/server/aiService.ts`
- Modify: `A3/server/serialBridge.ts`

- [ ] **Step 1: 建立 A3/server/storage.ts**

```ts
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const dataDir = join(process.cwd(), 'data');

export async function ensureDataDir() {
  await mkdir(dataDir, {recursive: true});
}

export async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  await ensureDataDir();
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    await writeJsonFile(file, fallback);
    return fallback;
  }
}

export async function writeJsonFile<T>(file: string, value: T): Promise<void> {
  await ensureDataDir();
  await writeFile(file, JSON.stringify(value, null, 2), 'utf8');
}

export interface AlertLogItem {
  id: number;
  createdAt: string;
  alertType: string;
  zoneId?: string;
  command: string;
  ok: boolean;
  message?: string;
}

export interface InterventionLogItem {
  id: number;
  createdAt: string;
  action: string;
  zoneId?: string;
  ok: boolean;
}

const alertLogFile = join(dataDir, 'alert-log.json');
const interventionLogFile = join(dataDir, 'intervention-log.json');
export const sensorAssignmentsFile = join(dataDir, 'sensor-assignments.json');

export async function appendAlertLog(item: Omit<AlertLogItem, 'id' | 'createdAt'>): Promise<void> {
  const current = await readJsonFile<AlertLogItem[]>(alertLogFile, []);
  const entry: AlertLogItem = {id: Date.now(), createdAt: new Date().toISOString(), ...item};
  await writeJsonFile(alertLogFile, [entry, ...current].slice(0, 100));
}

export async function appendInterventionLog(item: Omit<InterventionLogItem, 'id' | 'createdAt'>): Promise<void> {
  const current = await readJsonFile<InterventionLogItem[]>(interventionLogFile, []);
  const entry: InterventionLogItem = {id: Date.now(), createdAt: new Date().toISOString(), ...item};
  await writeJsonFile(interventionLogFile, [entry, ...current].slice(0, 100));
}

export async function loadSensorAssignments(): Promise<Record<string, string>> {
  return readJsonFile<Record<string, string>>(sensorAssignmentsFile, {});
}

export async function saveSensorAssignments(assignments: Record<string, string>): Promise<void> {
  await writeJsonFile(sensorAssignmentsFile, assignments);
}

export async function getRecentLogs(): Promise<{alerts: AlertLogItem[]; interventions: InterventionLogItem[]}> {
  const [alerts, interventions] = await Promise.all([
    readJsonFile<AlertLogItem[]>(alertLogFile, []),
    readJsonFile<InterventionLogItem[]>(interventionLogFile, []),
  ]);
  return {alerts: alerts.slice(0, 20), interventions: interventions.slice(0, 20)};
}

export async function resetDemoData(): Promise<void> {
  await writeJsonFile(alertLogFile, []);
  await writeJsonFile(interventionLogFile, []);
}
```

- [ ] **Step 2: 建立 A3/server/aiService.ts**

```ts
import {GoogleGenAI} from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const geminiApiKey = process.env.GEMINI_API_KEY ?? process.env.VITE_GEMINI_API_KEY ?? '';
const ai = geminiApiKey ? new GoogleGenAI({apiKey: geminiApiKey}) : null;

export function isGeminiConfigured(): boolean {
  return Boolean(ai);
}

export async function analyzeGuardianAlert(
  alertType: string,
  context: string,
  forceLocal = false,
): Promise<{result: string; fromLocal: boolean}> {
  if (ai && !forceLocal) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `你是學校心理健康關懷 AI 助手，提供關懷建議而非診斷。提醒類型：${alertType}。背景：${context}。請用繁體中文回覆，50字內，以關懷語氣，避免診斷性用詞。`,
      });
      const text = response.text?.trim() ?? '';
      if (text) return {result: text, fromLocal: false};
    } catch { /* fall through */ }
  }
  return {result: localGuardianReply(alertType), fromLocal: true};
}

function localGuardianReply(alertType: string): string {
  const replies: Record<string, string> = {
    high_risk: '這位同學最近可能需要多一點關注，建議導師在適當時機主動關心，了解他的狀況。',
    mood_low: '注意到同學情緒偏低，可以先從輕鬆的話題開始，讓他感受到有人在意。',
    noise_alert: '感知到環境聲量異常，建議到場確認是否有需要協助的狀況。',
    node_offline: '感測節點離線，建議確認裝置電源與連線狀況。',
    care_request: '同學主動尋求支持，這是信任的表現，請保持開放和不評判的態度傾聽。',
  };
  const key = Object.keys(replies).find((k) => alertType.toLowerCase().includes(k));
  return key ? replies[key] : '感謝您的關注，建議多觀察並在適當時機提供支持。';
}
```

- [ ] **Step 3: 修改 A3/server/serialBridge.ts — 加入 persistence + 新路由**

At the top of `A3/server/serialBridge.ts`, add after existing imports:
```ts
import {
  appendAlertLog, appendInterventionLog, getRecentLogs, loadSensorAssignments,
  resetDemoData, saveSensorAssignments,
} from './storage';
import {isGeminiConfigured as checkAi, analyzeGuardianAlert} from './aiService';
```

**Fix portZoneMap persistence**: Replace `const portZoneMap = new Map<string, string>();` with:
```ts
const portZoneMap = new Map<string, string>();

// Load persisted assignments at startup
loadSensorAssignments().then((saved) => {
  for (const [path, zone] of Object.entries(saved)) {
    portZoneMap.set(path, zone);
  }
  console.log('[bridge] Loaded', portZoneMap.size, 'sensor assignments from disk');
}).catch(console.error);
```

In the existing `POST /api/sensors/assign` handler, after `portZoneMap.set(portPath, zoneId)`, add:
```ts
void saveSensorAssignments(Object.fromEntries(portZoneMap));
```

Also in the `unassign` branch, after `portZoneMap.delete(portPath)`, add:
```ts
void saveSensorAssignments(Object.fromEntries(portZoneMap));
```

**Add /api/ready**:
```ts
app.get('/api/ready', (_req, res) => {
  res.json({
    ok: true,
    bridge: true,
    bridge_port: bridgePort,
    arduino: isConnected(),
    ai: checkAi(),
    uptime_seconds: Math.round(process.uptime()),
  });
});
```

**Upgrade /api/robot/command to log alerts**:
In the existing `POST /api/robot/command` handler, after `const result = await sendCommand(normalized)`, add:
```ts
const alertCommands = ['ALERT_SIGNAL', 'CARE_DEPLOYED', 'NODE_RESTART'];
if (alertCommands.includes(normalized)) {
  void appendAlertLog({alertType: normalized, command: normalized, ok: result.ok, message: result.ok ? undefined : result.message});
}
```

**Add /api/ai/guardian**:
```ts
app.post('/api/ai/guardian', async (req, res) => {
  const {alertType, context, forceLocal} = req.body ?? {};
  if (typeof alertType !== 'string') {
    return res.status(400).json({error: 'alertType required'});
  }
  const result = await analyzeGuardianAlert(
    alertType,
    typeof context === 'string' ? context : '',
    Boolean(forceLocal),
  );
  res.json(result);
});
```

**Add /api/logs**:
```ts
app.get('/api/logs', async (_req, res) => {
  const logs = await getRecentLogs();
  res.json(logs);
});
```

**Add /api/ops/reset**:
```ts
app.post('/api/ops/reset', async (_req, res) => {
  await resetDemoData();
  res.json({ok: true, message: 'Demo data reset'});
});
```

- [ ] **Step 4: TypeScript 編譯**

```bash
cd "google ai studio/app_3（國中）/AI校園心靈守護者" && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "google ai studio/app_3（國中）/AI校園心靈守護者/server/"
git commit -m "feat(app3): add server storage, AI service, persistence, and new API routes"
```

---

### Task 10: Firmware — HEARTBEAT + STATUS（四個 target）

**Files:**
- Modify: `FW/app1_whiteboard_drive/main.cpp`
- Modify: `FW/app2_sweeper_drive/main.cpp`
- Modify: `FW/app3_guardian_drive/main.cpp`

Goal: Add `HEARTBEAT → PONG` to all targets. Add `STATUS` queries.

**ACK format rule**: After existing command handling, add `Serial.println("OK:<COMMAND>");`. This is backward-compatible — frontend only parses `OK:` lines when needed, existing behavior unchanged.

- [ ] **Step 1: App 1 韌體 — 加 HEARTBEAT + STATUS**

In `FW/app1_whiteboard_drive/main.cpp`, in the command dispatch section (where `command == "FORWARD"` etc. is handled), add:

```cpp
} else if (command == "HEARTBEAT") {
  Serial.println("PONG");
  return;
} else if (command == "STATUS") {
  Serial.print("STATUS:SPEED:");
  Serial.print(motorSpeed);
  Serial.print(",WDT:");
  Serial.println(watchdogArmed ? "armed" : "off");
  return;
}
```

After each successful known command execution, add `Serial.println("OK:" + command);` at the end of the else-if block (before the closing brace).

Example — after the existing `STOP` case:
```cpp
} else if (command == "STOP") {
  stopAll();
  disarmWatchdog();
  Serial.println("OK:STOP");
}
```

Do the same for FORWARD, BACKWARD, LEFT, RIGHT, SPEED_SET, MOTOR_TEST, ERASE_* etc.

- [ ] **Step 2: App 2 韌體 — 加 HEARTBEAT + SWEEP_STATUS**

In `FW/app2_sweeper_drive/main.cpp`, find the command dispatch section and add:

```cpp
} else if (command == "HEARTBEAT") {
  Serial.println("PONG");
  return;
} else if (command == "SWEEP_STATUS") {
  Serial.print("STATUS:SWEEP:");
  Serial.print(sweepRunning ? (sweepReversed ? "reversed" : "on") : "off");
  Serial.print(",SPEED:");
  Serial.println(sweepSpeed);
  return;
}
```

Add `Serial.println("OK:" + command);` at the end of each known command case.

- [ ] **Step 3: App 3 韌體 — 加 SENSOR_SNAPSHOT + NODE_STATUS**

In `FW/app3_guardian_drive/main.cpp`, in the command dispatch section add:

```cpp
} else if (command == "SENSOR_SNAPSHOT") {
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();
  int light = analogRead(lightPin);
  if (isnan(temp)) temp = -1;
  if (isnan(hum)) hum = -1;
  Serial.print("SENSORS:TEMP:");
  Serial.print(temp, 1);
  Serial.print(",HUM:");
  Serial.print((int)hum);
  Serial.print(",LIGHT:");
  Serial.println(light);
  return;
} else if (command == "NODE_STATUS") {
  Serial.print("STATUS:NODES:connected,WDT:");
  Serial.println(watchdogArmed ? "armed" : "off");
  return;
} else if (command == "HEARTBEAT") {
  Serial.println("PONG");
  return;
}
```

- [ ] **Step 4: 韌體編譯驗證（三個 target）**

```bash
cd /Volumes/Tim\ aaddtional/Download/115資通訊/tedt
pio run -e uno_r4_minima_app1_whiteboard_drive
pio run -e uno_r4_minima_app2_sweeper
pio run -e uno_r4_minima_app3_guardian_drive
```
Expected: all three compile without errors.

- [ ] **Step 5: Commit**

```bash
git add src/app1_whiteboard_drive/main.cpp src/app2_sweeper_drive/main.cpp src/app3_guardian_drive/main.cpp
git commit -m "feat(firmware): add HEARTBEAT/PONG and STATUS queries to all app targets"
```

---

## BATCH C — Persistence + UI Polish (P4 + P5)

---

### Task 11: App 1 Whiteboard Calibration Persistence

**Files:**
- Modify: `A1/server/storage.ts`
- Modify: `A1/server/routes.ts` (or wherever PUT /api/calibration is handled)

- [ ] **Step 1: storage.ts 加 calibration functions**

Open `A1/server/storage.ts`. Add at end of file:

```ts
import {join} from 'node:path';
// (dataDir is already defined in this file)
const calibrationFile = join(dataDir, 'calibration.json');

export interface CalibrationData {
  version: number;
  savedAt: string;
  [key: string]: unknown;
}

export async function readCalibration(): Promise<CalibrationData | null> {
  try {
    const raw = await readFile(calibrationFile, 'utf8');
    const parsed = JSON.parse(raw) as CalibrationData;
    if (typeof parsed.version !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveCalibration(data: Record<string, unknown>): Promise<void> {
  const calibration: CalibrationData = {
    ...data,
    version: 1,
    savedAt: new Date().toISOString(),
  };
  await writeJsonFile(calibrationFile, calibration);
}
```

- [ ] **Step 2: routes.ts 加入 calibration 讀寫路由**

In `A1/server/routes.ts`, find the existing calibration-related route (search for `calibration` in routes.ts). If there's a PUT `/api/calibration` route, add a `saveCalibration()` call. If it doesn't exist, add:

```ts
import {readCalibration, saveCalibration} from './storage';

// GET /api/calibration — load persisted calibration
app.get('/api/calibration', async (_req, res) => {
  const data = await readCalibration();
  res.json({ok: true, calibration: data});
});

// PUT /api/calibration — save calibration (non-blocking write)
app.put('/api/calibration', async (req, res) => {
  const {calibration} = req.body ?? {};
  if (!calibration || typeof calibration !== 'object') {
    return res.status(400).json({error: 'calibration data required'});
  }
  void saveCalibration(calibration as Record<string, unknown>);
  res.json({ok: true});
});
```

- [ ] **Step 3: 在 server 啟動時讀取並 log 校準狀態**

In `A1/server/serialBridge.ts`, in the startup callback add:
```ts
const {readCalibration} = await import('./storage');
const cal = await readCalibration();
if (cal) {
  console.log(`[calibration] Loaded calibration from ${cal.savedAt}`);
}
```

- [ ] **Step 4: TypeScript 編譯**

```bash
cd "google ai studio/app_1（國小）/AI自動板擦機器人" && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "google ai studio/app_1（國小）/AI自動板擦機器人/server/"
git commit -m "feat(app1): persist whiteboard calibration to data/calibration.json"
```

---

### Task 12: CommandFeedbackToast（三個 App）

**Files:**
- Create: `A1/src/components/CommandFeedbackToast.tsx`
- Create: `A2/src/components/CommandFeedbackToast.tsx`
- Create: `A3/src/components/CommandFeedbackToast.tsx`
- Modify: each App.tsx or relevant layout component

- [ ] **Step 1: 建立 CommandFeedbackToast（三個 App 內容相同）**

Create `A1/src/components/CommandFeedbackToast.tsx`, `A2/src/components/CommandFeedbackToast.tsx`, `A3/src/components/CommandFeedbackToast.tsx` all with:

```tsx
import {useEffect, useState} from 'react';
import type {CommandAck} from '../hooks/useHardwareSocket';

interface Props {
  lastCommand: CommandAck | null;
}

export function CommandFeedbackToast({lastCommand}: Props) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<CommandAck | null>(null);

  useEffect(() => {
    if (!lastCommand) return;
    setCurrent(lastCommand);
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 2000);
    return () => clearTimeout(timer);
  }, [lastCommand]);

  if (!visible || !current) return null;

  const isOk = current.ok;
  const bgClass = isOk ? 'bg-green-600' : 'bg-red-600';
  const icon = isOk ? '✅' : '❌';
  const label = isOk
    ? `${icon} ${current.command} 已送出`
    : `${icon} ${current.command} 失敗${current.response ? `：${current.response}` : ''}`;

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-white text-sm font-medium shadow-lg transition-opacity duration-300 ${bgClass} ${visible ? 'opacity-100' : 'opacity-0'}`}
      role="status"
      aria-live="polite"
    >
      {label}
    </div>
  );
}
```

- [ ] **Step 2: 在三個 App 的 App.tsx 整合**

For each App.tsx, the `useHardwareSocket` hook is already called by `HardwareStatusBanner`. To avoid double-connecting, lift the hook up to `App.tsx`:

In each `App.tsx`:
1. Add import: `import {useHardwareSocket} from './hooks/useHardwareSocket';`
2. Add import: `import {CommandFeedbackToast} from './components/CommandFeedbackToast';`
3. In the App component body, add: `const {status, lastCommand, mode} = useHardwareSocket(BRIDGE_URL);`
4. Pass `status` and `mode` as props to `HardwareStatusBanner` (update its interface), or use a context
5. Add `<CommandFeedbackToast lastCommand={lastCommand} />` near `<HardwareStatusBanner />`

Update `HardwareStatusBanner` to accept props instead of calling the hook itself:
```tsx
interface Props {
  connected: boolean;
  port: string;
  simulated: boolean;
  mode: string;
}
export function HardwareStatusBanner({connected, port, simulated, mode}: Props) {
  const colorClass = connected ? 'bg-green-500' : simulated ? 'bg-yellow-400' : 'bg-red-500';
  const label = connected ? `Arduino 已連線${port ? ` (${port})` : ''}` : simulated ? '硬體模擬模式' : 'Arduino 未連線';
  return (
    <div className={`fixed top-0 left-0 right-0 z-50 h-1 transition-colors duration-700 ${colorClass}`}
         title={`${label} • ${mode}`} />
  );
}
```

- [ ] **Step 3: TypeScript 編譯三個 App**

```bash
cd "google ai studio/app_1（國小）/AI自動板擦機器人" && npx tsc --noEmit
cd "google ai studio/app_2（國小）/校園服務機器人 app" && npx tsc --noEmit
cd "google ai studio/app_3（國中）/AI校園心靈守護者" && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add \
  "google ai studio/app_1（國小）/AI自動板擦機器人/src/" \
  "google ai studio/app_2（國小）/校園服務機器人 app/src/" \
  "google ai studio/app_3（國中）/AI校園心靈守護者/src/"
git commit -m "feat: add CommandFeedbackToast and lift useHardwareSocket to App in all 3 apps"
```

---

### Task 13: App 2 UI Polish

**Files:**
- Modify: `A2/src/views/DeliveryView.tsx` (queue ordering)
- Modify: `A2/src/views/DispatchMapView.tsx` (dispatch highlight)
- Modify: `A2/src/views/StudentReportView.tsx` (task history from server)

- [ ] **Step 1: 配送隊列優先序 — 上移/下移按鈕**

In `A2/src/views/DeliveryView.tsx`, find the delivery queue rendering (list of delivery items). Add move-up/move-down buttons:

```tsx
// In the delivery item render function, add:
<div className="flex gap-1">
  <button
    onClick={() => dispatch({type: 'MOVE_DELIVERY_UP', id: item.id})}
    disabled={index === 0}
    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
    title="上移優先序"
  >
    ↑
  </button>
  <button
    onClick={() => dispatch({type: 'MOVE_DELIVERY_DOWN', id: item.id})}
    disabled={index === items.length - 1}
    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
    title="下移優先序"
  >
    ↓
  </button>
</div>
```

In the state reducer (wherever `DISPATCH_TASK` etc. is handled), add:
```ts
case 'MOVE_DELIVERY_UP': {
  const idx = state.deliveries.findIndex(d => d.id === action.id);
  if (idx <= 0) return state;
  const next = [...state.deliveries];
  [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
  return {...state, deliveries: next};
}
case 'MOVE_DELIVERY_DOWN': {
  const idx = state.deliveries.findIndex(d => d.id === action.id);
  if (idx < 0 || idx >= state.deliveries.length - 1) return state;
  const next = [...state.deliveries];
  [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
  return {...state, deliveries: next};
}
```

- [ ] **Step 2: 派遣地圖 — 靜態路徑 highlight**

In `A2/src/views/DispatchMapView.tsx` or wherever the campus SVG map is rendered, find the selected zone indicator. When a zone has an active dispatch task, add a highlight stroke:

```tsx
// In the SVG zone element, add conditional stroke:
<rect
  {...zoneProps}
  stroke={activeTaskZones.has(zone.id) ? '#3B82F6' : 'transparent'}
  strokeWidth={activeTaskZones.has(zone.id) ? 3 : 0}
  strokeDasharray={activeTaskZones.has(zone.id) ? '6 3' : undefined}
/>
```

Where `activeTaskZones` is derived from the current dispatch tasks state.

- [ ] **Step 3: 任務歷史面板 — 讀 server 日誌**

In `A2/src/views/StudentReportView.tsx` or create a `TaskHistoryPanel`, add a fetch for server logs:

```tsx
const [serverLogs, setServerLogs] = useState<{command: string; ok: boolean; createdAt: string}[]>([]);

useEffect(() => {
  fetch(`${BRIDGE_URL}/api/logs`)
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (data?.tasks) setServerLogs(data.tasks.slice(0, 10));
    })
    .catch(() => {});
}, []);
```

Render the logs as a simple list:
```tsx
{serverLogs.length > 0 && (
  <div className="mt-4">
    <h4 className="text-sm font-medium text-gray-600 mb-2">硬體指令紀錄</h4>
    {serverLogs.map((log) => (
      <div key={log.createdAt} className="flex items-center gap-2 text-xs text-gray-500 py-1 border-b">
        <span>{log.ok ? '✅' : '❌'}</span>
        <span className="font-mono">{log.command}</span>
        <span className="ml-auto">{new Date(log.createdAt).toLocaleTimeString('zh-TW')}</span>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 4: TypeScript 編譯**

```bash
cd "google ai studio/app_2（國小）/校園服務機器人 app" && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add "google ai studio/app_2（國小）/校園服務機器人 app/src/"
git commit -m "feat(app2): delivery queue ordering, dispatch highlight, task history panel"
```

---

### Task 14: App 3 UI Polish

**Files:**
- Modify: `A3/src/components/GuardianControlPanel.tsx` (severity colors)
- Modify: `A3/src/App.tsx` or relevant guardian views (emotion heatmap)
- Modify: `A3/src/services/localGuardianAi.ts` (AI label)

- [ ] **Step 1: 提醒嚴重度統一色碼**

In `A3/src/components/GuardianControlPanel.tsx` or wherever alerts are rendered, replace ad-hoc color logic with:

```tsx
function severityColor(severity: string): string {
  if (severity === 'high' || severity === 'critical') return 'text-red-600 bg-red-50 border-red-200';
  if (severity === 'medium') return 'text-orange-600 bg-orange-50 border-orange-200';
  return 'text-yellow-600 bg-yellow-50 border-yellow-200';
}
```

Apply `severityColor(alert.severity)` to each alert card's className.

- [ ] **Step 2: 情緒熱圖元件**

Create `A3/src/components/EmotionHeatmap.tsx`:

```tsx
interface MoodEntry {
  spaceId: string;
  timeSlot: string; // e.g. '08:00', '09:00', ...
  score: number; // 1-5
}

interface Props {
  entries: MoodEntry[];
  spaces: string[];
  timeSlots: string[];
}

export function EmotionHeatmap({entries, spaces, timeSlots}: Props) {
  const scoreMap = new Map<string, number>();
  for (const e of entries) {
    scoreMap.set(`${e.spaceId}|${e.timeSlot}`, e.score);
  }

  function scoreToColor(score: number | undefined): string {
    if (score === undefined) return 'bg-gray-100';
    if (score >= 4) return 'bg-green-300';
    if (score >= 3) return 'bg-yellow-200';
    if (score >= 2) return 'bg-orange-300';
    return 'bg-red-300';
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="p-1 text-left text-gray-500 font-normal w-20">空間 \ 時段</th>
            {timeSlots.map((t) => (
              <th key={t} className="p-1 text-center text-gray-500 font-normal w-12">{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spaces.map((space) => (
            <tr key={space}>
              <td className="p-1 text-gray-600 font-medium truncate max-w-20">{space}</td>
              {timeSlots.map((slot) => {
                const score = scoreMap.get(`${space}|${slot}`);
                return (
                  <td key={slot} className={`p-1 w-12 h-8 ${scoreToColor(score)} border border-white rounded`}
                      title={score ? `${space} ${slot}: ${score}/5` : '無資料'} />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-3 mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-300 inline-block rounded" />穩定</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-200 inline-block rounded" />留意</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-300 inline-block rounded" />關注</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-300 inline-block rounded" />需介入</span>
      </div>
    </div>
  );
}
```

Add `<EmotionHeatmap>` to the relevant guardian view (the campus space dashboard), passing mood log data from state.

- [ ] **Step 3: Guardian AI 信心度標示**

In the components that display AI replies (chat, care messages, etc.), add a label near each AI reply:

```tsx
// After rendering AI response text:
<span className={`text-xs px-1.5 py-0.5 rounded ${fromLocal ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-600'}`}>
  {fromLocal ? '本機建議' : 'AI 分析'}
</span>
```

The `fromLocal` flag should come from the AI service response (`analyzeGuardianAlert` returns `{result, fromLocal}`). Pass this flag through to the display component.

- [ ] **Step 4: TypeScript 編譯**

```bash
cd "google ai studio/app_3（國中）/AI校園心靈守護者" && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add "google ai studio/app_3（國中）/AI校園心靈守護者/src/"
git commit -m "feat(app3): severity colors, emotion heatmap, AI confidence labels"
```

---

## Final Verification

### Task 15: Full Check All Three Apps

- [ ] **Step 1: App 1 full check**

```bash
cd "google ai studio/app_1（國小）/AI自動板擦機器人" && npm run check
```
Expected: all tests pass, TypeScript clean, build succeeds.

- [ ] **Step 2: App 2 full check**

```bash
cd "google ai studio/app_2（國小）/校園服務機器人 app" && npm run check
```
Expected: all tests pass, TypeScript clean, build succeeds.

- [ ] **Step 3: App 3 full check**

```bash
cd "google ai studio/app_3（國中）/AI校園心靈守護者" && npm run check
```
Expected: all tests pass, TypeScript clean, build succeeds.

- [ ] **Step 4: 韌體三個 target 全部編譯**

```bash
pio run -e uno_r4_minima_app1_whiteboard_drive
pio run -e uno_r4_minima_app2_sweeper
pio run -e uno_r4_minima_app3_guardian_drive
```
Expected: all three compile without errors.

- [ ] **Step 5: 彩排腳本測試**

Start all bridges:
```bash
npm run start:all &
sleep 4
node scripts/rehearsal-check.mjs
```
Expected: `🟢 DEMO READY`

- [ ] **Step 6: Reset 測試**

```bash
npm run reset:all
```
Expected: all three Apps confirm reset.

- [ ] **Step 7: 最終 commit**

```bash
git add scripts/ docs/
git commit -m "docs: update PLAN_TODO and spec after full optimization"
```
