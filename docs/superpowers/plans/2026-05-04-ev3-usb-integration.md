# EV3 USB Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate LEGO EV3 (pen arm on top of Arduino base) via USB wired connection so students only need to plug in USB — zero config, auto-connects, works immediately.

**Architecture:** ev3Manager.ts in Node bridge auto-discovers EV3 at `192.168.0.1` or `ev3dev.local` over USB Tethering, maintains a persistent WebSocket to `ev3_server.py` running on the EV3 brick (managed by systemd). Commands prefixed `EV3_` route to EV3; `STOP` dual-sends to both Arduino and EV3.

**Tech Stack:** Node.js `ws` package (WebSocket client/server), Python `websockets` + `ev3dev2` (on EV3), React + Tailwind (frontend), systemd (EV3 autostart), bash (setup scripts)

---

## File Map

### New Files
| File | Responsibility |
|---|---|
| `APP1/server/ev3Manager.ts` | WebSocket client: auto-detect IP, backoff reconnect, UUID request-id, flush pending on disconnect |
| `APP1/server/ev3Manager.test.ts` | Integration test using real local WS server |
| `APP1/src/components/EV3ControlPanel.tsx` | React component: connection status + 11 control buttons + busy lock |
| `ROOT/ev3/ev3_server.py` | Python WS server on EV3: dispatches JSON commands to ev3dev2 motors |
| `ROOT/ev3/ev3-bridge.service` | systemd unit: Restart=always, runs as `robot` |
| `ROOT/ev3/vendor/` | Offline Python wheels (websockets) for no-internet install |
| `ROOT/ev3/README.md` | Teacher deployment guide |
| `ROOT/scripts/ev3-setup.sh` | One-shot teacher setup: detect EV3 → SSH → deploy → enable service → health check |
| `ROOT/scripts/ev3-diagnose.sh` | Diagnostic tool: USB interface / ping / SSH / service / Python / WebSocket |

### Modified Files
| File | Change |
|---|---|
| `APP1/server/defaults.ts` | Add 11 EV3 commands to `commandCatalog` |
| `APP1/server/routes.ts` | Route `EV3_*` to ev3Manager; `STOP` dual-sends; add `GET /api/ev3/status` |
| `APP1/server/serialBridge.ts` | Call `startEV3Manager()` on startup (1 line) |
| `APP1/src/services/classroomApi.ts` | Add `loadEV3Status()` and `sendRobotCommand()` reuse for EV3 |
| `APP1/package.json` | Add `ws` + `@types/ws` dependencies |

`APP1` = `google ai studio/app_1（國小）/AI自動板擦機器人`  
`ROOT` = repo root (`/Volumes/Tim aaddtional/Download/115資通訊/tedt`)

---

## Task 1: Install `ws` npm package

**Files:**
- Modify: `APP1/package.json`

- [ ] **Step 1: Install dependencies**

```bash
cd "google ai studio/app_1（國小）/AI自動板擦機器人"
npm install ws
npm install --save-dev @types/ws
```

Expected: `ws` appears in `dependencies`, `@types/ws` in `devDependencies`.

- [ ] **Step 2: Verify TypeScript can find ws types**

```bash
cd "google ai studio/app_1（國小）/AI自動板擦機器人"
echo "import WebSocket from 'ws'; console.log(typeof WebSocket);" | npx tsx --input-type=module
```

Expected output: `function`

- [ ] **Step 3: Commit**

```bash
git add "google ai studio/app_1（國小）/AI自動板擦機器人/package.json" \
        "google ai studio/app_1（國小）/AI自動板擦機器人/package-lock.json"
git commit -m "feat(ev3): add ws npm package for EV3 WebSocket client"
```

---

## Task 2: Create `ev3Manager.ts`

**Files:**
- Create: `APP1/server/ev3Manager.ts`

- [ ] **Step 1: Create the file**

Create `google ai studio/app_1（國小）/AI自動板擦機器人/server/ev3Manager.ts`:

```typescript
import WebSocket from 'ws';
import {randomUUID} from 'node:crypto';

const BACKOFF_MS = [0, 1000, 3000, 5000];
const EV3_TIMEOUT_MS = 3000;

type Ev3Response = {ok: boolean; response: string};
type Pending = {resolve: (r: Ev3Response) => void; timer: ReturnType<typeof setTimeout>};

let ws: WebSocket | null = null;
let connected = false;
let lastCommand = '';
let lastResponse = '';
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let currentHostIndex = 0;
const pending = new Map<string, Pending>();

function getHosts(): string[] {
  return [
    process.env.EV3_HOST,
    'ws://192.168.0.1:8765',
    'ws://ev3dev.local:8765',
  ].filter(Boolean) as string[];
}

function flushPending(reason: string) {
  for (const [id, p] of pending) {
    clearTimeout(p.timer);
    p.resolve({ok: false, response: reason});
    pending.delete(id);
  }
}

function scheduleReconnect() {
  if (reconnectTimer !== null) return;
  const delay = BACKOFF_MS[Math.min(reconnectAttempt, BACKOFF_MS.length - 1)];
  reconnectAttempt++;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function connect() {
  const hosts = getHosts();
  const url = hosts[currentHostIndex % hosts.length];
  const socket = new WebSocket(url);

  socket.on('open', () => {
    ws = socket;
    connected = true;
    reconnectAttempt = 0;
    console.log(`[ev3] connected to ${url}`);
  });

  socket.on('message', (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString()) as {id: string; ok: boolean; response: string};
      const p = pending.get(msg.id);
      if (!p) return;
      clearTimeout(p.timer);
      pending.delete(msg.id);
      lastResponse = msg.response ?? '';
      p.resolve({ok: msg.ok, response: lastResponse});
    } catch { /* ignore malformed messages */ }
  });

  socket.on('close', () => {
    if (ws === socket) {
      ws = null;
      connected = false;
    }
    flushPending('EV3 disconnected');
    currentHostIndex++;
    scheduleReconnect();
  });

  socket.on('error', () => {
    // error always precedes close — handled there
  });
}

export function startEV3Manager() {
  connect();
}

export function getEV3Status() {
  return {connected, lastCommand, lastResponse};
}

export async function sendEV3Command(command: string): Promise<Ev3Response> {
  if (!ws || !connected) return {ok: false, response: 'EV3 not connected'};

  const id = randomUUID();
  lastCommand = command;

  return new Promise<Ev3Response>((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve({ok: false, response: 'timeout'});
    }, EV3_TIMEOUT_MS);

    pending.set(id, {resolve, timer});
    ws!.send(JSON.stringify({id, type: command}));
  });
}
```

- [ ] **Step 2: Type-check**

```bash
cd "google ai studio/app_1（國小）/AI自動板擦機器人"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "google ai studio/app_1（國小）/AI自動板擦機器人/server/ev3Manager.ts"
git commit -m "feat(ev3): add ev3Manager WebSocket client with auto-detect and backoff reconnect"
```

---

## Task 3: Write and pass `ev3Manager` tests

**Files:**
- Create: `APP1/server/ev3Manager.test.ts`

- [ ] **Step 1: Create the test (it will fail — ev3Manager not started yet)**

Create `google ai studio/app_1（國小）/AI自動板擦機器人/server/ev3Manager.test.ts`:

```typescript
import {createServer} from 'node:http';
import {WebSocketServer} from 'ws';
import {strict as assert} from 'node:assert';

// Must set EV3_HOST before importing ev3Manager (module-level side effects)
process.env.EV3_HOST = 'ws://127.0.0.1:19876';

const httpServer = createServer();
const wss = new WebSocketServer({server: httpServer});

await new Promise<void>((resolve) => httpServer.listen(19876, '127.0.0.1', resolve));

// Echo server: responds {id, ok:true, response: "ack:<type>"}
wss.on('connection', (client) => {
  client.on('message', (data) => {
    const msg = JSON.parse(data.toString()) as {id: string; type: string};
    client.send(JSON.stringify({id: msg.id, ok: true, response: `ack:${msg.type}`}));
  });
});

const {startEV3Manager, sendEV3Command, getEV3Status} = await import('./ev3Manager.js');

startEV3Manager();
await new Promise((r) => setTimeout(r, 150)); // wait for connection

// Test 1: connects
assert.equal(getEV3Status().connected, true, 'should connect to local test server');

// Test 2: command round-trip with request-id
const r1 = await sendEV3Command('EV3_STATUS');
assert.equal(r1.ok, true, 'command should succeed');
assert.equal(r1.response, 'ack:EV3_STATUS', 'response should match command');

// Test 3: two concurrent commands receive correct responses
const [r2, r3] = await Promise.all([
  sendEV3Command('EV3_PEN_DOWN'),
  sendEV3Command('EV3_PEN_UP'),
]);
assert.equal(r2.response, 'ack:EV3_PEN_DOWN');
assert.equal(r3.response, 'ack:EV3_PEN_UP');

// Test 4: disconnect → fail fast
wss.clients.forEach((c) => c.terminate());
await new Promise((r) => setTimeout(r, 50));
assert.equal(getEV3Status().connected, false, 'should detect disconnect');

const r4 = await sendEV3Command('EV3_STATUS');
assert.equal(r4.ok, false, 'should fail when disconnected');

httpServer.close();
console.log('[test] ev3Manager: all 4 assertions passed ✓');
```

- [ ] **Step 2: Run test — expect it to pass**

```bash
cd "google ai studio/app_1（國小）/AI自動板擦機器人"
npx tsx server/ev3Manager.test.ts
```

Expected: `[test] ev3Manager: all 4 assertions passed ✓`

- [ ] **Step 3: Commit**

```bash
git add "google ai studio/app_1（國小）/AI自動板擦機器人/server/ev3Manager.test.ts"
git commit -m "test(ev3): ev3Manager connection, command round-trip, and disconnect tests"
```

---

## Task 4: Add EV3 commands to `defaults.ts`

**Files:**
- Modify: `APP1/server/defaults.ts`

- [ ] **Step 1: Append EV3 commands to `commandCatalog`**

In `google ai studio/app_1（國小）/AI自動板擦機器人/server/defaults.ts`, find the closing `];` of `commandCatalog` and add before it:

```typescript
  // EV3 pen-arm commands
  {command: 'EV3_PEN_DOWN', label: '筆落下', group: 'ev3'},
  {command: 'EV3_PEN_UP', label: '筆抬起', group: 'ev3'},
  {command: 'EV3_ARM_EXTEND', label: '筆臂延伸', group: 'ev3'},
  {command: 'EV3_ARM_RETRACT', label: '筆臂收回', group: 'ev3'},
  {command: 'EV3_STOP', label: 'EV3 停止', group: 'ev3'},
  {command: 'EV3_HOME', label: 'EV3 歸位', group: 'ev3'},
  {command: 'EV3_CALIBRATE', label: 'EV3 校準', group: 'ev3'},
  {command: 'EV3_SAFE_POSE', label: '安全姿態', group: 'ev3'},
  {command: 'EV3_CANCEL', label: '取消序列', group: 'ev3'},
  {command: 'EV3_DRAW_LINE', label: '畫一條線', group: 'ev3'},
  {command: 'EV3_TEST', label: 'EV3 自我測試', group: 'ev3'},
```

Also update the `RobotCommandInfo` type in `types.ts` if `group` is typed. Check:

```bash
grep -n "group" "google ai studio/app_1（國小）/AI自動板擦機器人/server/types.ts"
```

If `group` has a union type (e.g. `'display' | 'hardware' | ...`), add `| 'ev3'` to it.

- [ ] **Step 2: Type-check**

```bash
cd "google ai studio/app_1（國小）/AI自動板擦機器人"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "google ai studio/app_1（國小）/AI自動板擦機器人/server/defaults.ts" \
        "google ai studio/app_1（國小）/AI自動板擦機器人/server/types.ts"
git commit -m "feat(ev3): add 11 EV3 commands to commandCatalog"
```

---

## Task 5: Update `routes.ts` — EV3 routing + STOP dual-send + status endpoint

**Files:**
- Modify: `APP1/server/routes.ts`

- [ ] **Step 1: Add ev3Manager import at top of routes.ts**

Add to the existing import block:

```typescript
import {getEV3Status, sendEV3Command} from './ev3Manager';
```

- [ ] **Step 2: Add `GET /api/ev3/status` endpoint**

Inside `registerRoutes`, after the `GET /api/robot/status` handler, add:

```typescript
  app.get('/api/ev3/status', (_req, res) => {
    res.json(getEV3Status());
  });
```

- [ ] **Step 3: Update `POST /api/robot/command` to route EV3_ commands**

Find the `app.post('/api/robot/command', ...)` handler. Inside the try block, replace the current `sendSerialCommand(command, requestedPath)` call with this routing logic:

```typescript
    try {
      // Route EV3_ commands to EV3 manager
      if (command.startsWith('EV3_')) {
        const result = await sendEV3Command(command);
        if (!result.ok) {
          res.status(503).json({ok: false, command, error: result.response});
          return;
        }
        res.json({ok: true, command, response: result.response});
        return;
      }

      // STOP: dual-send to both Arduino and EV3 for safety
      if (command === 'STOP') {
        const [arduinoResult] = await Promise.allSettled([
          sendSerialCommand(command, requestedPath),
          sendEV3Command('EV3_STOP'),
        ]);
        const port = arduinoResult.status === 'fulfilled' ? arduinoResult.value.port : getActivePath();
        const message = arduinoResult.status === 'fulfilled'
          ? (arduinoResult.value.response || `Sent STOP to ${port}`)
          : (arduinoResult.reason as Error)?.message ?? 'Arduino error';
        const ok = arduinoResult.status === 'fulfilled';
        const status = await updateRobotStatus({connected: ok, activePort: port, lastCommand: command, lastResponse: message});
        const taskLog = await appendTaskLog({command, source, ok, message});
        res.json({ok, command, port, response: message, status, taskLog});
        return;
      }

      // All other commands: existing Arduino path (unchanged)
      const result = await sendSerialCommand(command, requestedPath);
      const message = result.response || `Sent ${command} to ${result.port}`;
      const status = await updateRobotStatus({
        connected: true,
        activePort: result.port,
        lastCommand: command,
        lastResponse: message,
      });
      const taskLog = await appendTaskLog({command, source, ok: true, message});
      res.json({ok: true, command, port: result.port, response: result.response, status, taskLog});
    } catch (error) {
      const message = getErrorMessage(error);
      const status = await updateRobotStatus({
        connected: false,
        activePort: getActivePath(),
        lastCommand: command,
        lastResponse: message,
      });
      const taskLog = await appendTaskLog({command, source, ok: false, message});
      res.status(503).json({error: message, status, taskLog});
    }
```

- [ ] **Step 4: Type-check**

```bash
cd "google ai studio/app_1（國小）/AI自動板擦機器人"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "google ai studio/app_1（國小）/AI自動板擦機器人/server/routes.ts"
git commit -m "feat(ev3): route EV3_ commands to ev3Manager, STOP dual-sends to both devices"
```

---

## Task 6: Wire `startEV3Manager()` into `serialBridge.ts`

**Files:**
- Modify: `APP1/server/serialBridge.ts`

- [ ] **Step 1: Add import and startup call**

In `serialBridge.ts`, add this import at the top with the other imports:

```typescript
import {startEV3Manager} from './ev3Manager';
```

Then find the `app.listen(bridgePort, () => {` callback block and add `startEV3Manager()` after `startSensorPolling()`:

```typescript
app.listen(bridgePort, () => {
  console.log(`Arduino serial bridge listening on http://localhost:${bridgePort}`);
  console.log(`Baud rate: ${baudRate}`);
  console.log(`Mode: ${nodeEnv}`);
  if (nodeEnv !== 'test') {
    startSensorPolling().catch(console.error);
    startEV3Manager();  // ← add this line
  }
});
```

- [ ] **Step 2: Type-check**

```bash
cd "google ai studio/app_1（國小）/AI自動板擦機器人"
npx tsc --noEmit
```

- [ ] **Step 3: Smoke test — bridge starts without error**

```bash
cd "google ai studio/app_1（國小）/AI自動板擦機器人"
timeout 5 npx tsx server/serialBridge.ts 2>&1 | head -20 || true
```

Expected: see `Arduino serial bridge listening on http://localhost:3200` and `[ev3]` connection attempt log. No crash.

- [ ] **Step 4: Commit**

```bash
git add "google ai studio/app_1（國小）/AI自動板擦機器人/server/serialBridge.ts"
git commit -m "feat(ev3): wire startEV3Manager into bridge startup"
```

---

## Task 7: Create `ev3/ev3_server.py`

**Files:**
- Create: `ROOT/ev3/ev3_server.py`

- [ ] **Step 1: Create the Python server**

Create `/Volumes/Tim aaddtional/Download/115資通訊/tedt/ev3/ev3_server.py`:

```python
#!/usr/bin/env python3
"""EV3 WebSocket command server — runs on the EV3 brick via ev3dev."""
import asyncio
import json
import time
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'vendor'))

import websockets
from ev3dev2.motor import LargeMotor, MediumMotor, OUTPUT_A, OUTPUT_B, OUTPUT_C
from ev3dev2.motor import SpeedPercent, MoveTank

PORT = 8765
PEN_DOWN_POS = 90   # medium motor degrees: pen pressed to board
PEN_UP_POS   = 0    # medium motor degrees: pen lifted

_start_time = time.time()
_busy = False

def make_motors():
    try:
        med = MediumMotor(OUTPUT_C)
        large_a = LargeMotor(OUTPUT_A)
        large_b = LargeMotor(OUTPUT_B)
        return med, large_a, large_b
    except Exception as e:
        print(f"[ev3] motor init error: {e}", flush=True)
        return None, None, None

med_motor, large_a, large_b = make_motors()

def stop_all():
    try:
        if med_motor: med_motor.stop()
        if large_a:   large_a.stop()
        if large_b:   large_b.stop()
    except Exception:
        pass

async def dispatch(cmd: str) -> dict:
    global _busy

    if cmd == 'EV3_STATUS':
        return {
            'ok': True,
            'response': json.dumps({
                'connected': True,
                'busy': _busy,
                'uptime': round(time.time() - _start_time),
                'penPos': med_motor.position if med_motor else None,
            })
        }

    if cmd == 'EV3_TEST':
        try:
            if med_motor:
                med_motor.run_to_abs_pos(position_sp=PEN_DOWN_POS, speed_sp=300, stop_action='hold')
                med_motor.wait_while('running', timeout=2000)
                await asyncio.sleep(0.3)
                med_motor.run_to_abs_pos(position_sp=PEN_UP_POS, speed_sp=300, stop_action='hold')
                med_motor.wait_while('running', timeout=2000)
            return {'ok': True, 'response': 'self-test passed'}
        except Exception as e:
            return {'ok': False, 'response': f'self-test failed: {e}'}

    if cmd == 'EV3_CALIBRATE':
        try:
            if med_motor: med_motor.reset()
            if large_a:   large_a.reset()
            if large_b:   large_b.reset()
            return {'ok': True, 'response': 'encoders reset'}
        except Exception as e:
            return {'ok': False, 'response': str(e)}

    if cmd == 'EV3_PEN_DOWN':
        try:
            if med_motor:
                med_motor.run_to_abs_pos(position_sp=PEN_DOWN_POS, speed_sp=300, stop_action='hold')
                med_motor.wait_while('running', timeout=2000)
            return {'ok': True, 'response': 'pen down'}
        except Exception as e:
            return {'ok': False, 'response': str(e)}

    if cmd == 'EV3_PEN_UP':
        try:
            if med_motor:
                med_motor.run_to_abs_pos(position_sp=PEN_UP_POS, speed_sp=300, stop_action='hold')
                med_motor.wait_while('running', timeout=2000)
            return {'ok': True, 'response': 'pen up'}
        except Exception as e:
            return {'ok': False, 'response': str(e)}

    if cmd == 'EV3_ARM_EXTEND':
        try:
            if large_a and large_b:
                large_a.on_for_seconds(SpeedPercent(50), 0.5)
                large_b.on_for_seconds(SpeedPercent(50), 0.5)
            return {'ok': True, 'response': 'arm extended'}
        except Exception as e:
            return {'ok': False, 'response': str(e)}

    if cmd == 'EV3_ARM_RETRACT':
        try:
            if large_a and large_b:
                large_a.on_for_seconds(SpeedPercent(-50), 0.5)
                large_b.on_for_seconds(SpeedPercent(-50), 0.5)
            return {'ok': True, 'response': 'arm retracted'}
        except Exception as e:
            return {'ok': False, 'response': str(e)}

    if cmd in ('EV3_STOP', 'EV3_CANCEL'):
        _busy = False
        stop_all()
        return {'ok': True, 'response': 'stopped'}

    if cmd in ('EV3_HOME', 'EV3_SAFE_POSE'):
        result = await dispatch('EV3_PEN_UP')
        if result['ok']:
            result = await dispatch('EV3_ARM_RETRACT')
        return {'ok': result['ok'], 'response': 'home' if result['ok'] else result['response']}

    if cmd == 'EV3_DRAW_LINE':
        if _busy:
            return {'ok': False, 'response': 'busy'}
        _busy = True
        try:
            for step in ('EV3_PEN_DOWN', 'EV3_ARM_EXTEND', 'EV3_PEN_UP'):
                r = await dispatch(step)
                if not r['ok']:
                    _busy = False
                    return {'ok': False, 'response': f'draw_line failed at {step}: {r["response"]}'}
            _busy = False
            return {'ok': True, 'response': 'line drawn'}
        except Exception as e:
            _busy = False
            return {'ok': False, 'response': str(e)}

    return {'ok': False, 'response': f'unknown command: {cmd}'}


async def handle(websocket):
    print(f"[ev3] client connected: {websocket.remote_address}", flush=True)
    try:
        async for raw in websocket:
            try:
                req = json.loads(raw)
                req_id = req.get('id', '')
                cmd = req.get('type', '')
                result = await dispatch(cmd)
                await websocket.send(json.dumps({'id': req_id, **result}))
            except Exception as e:
                await websocket.send(json.dumps({'id': '', 'ok': False, 'response': str(e)}))
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        stop_all()
        print("[ev3] client disconnected — motors stopped", flush=True)


async def main():
    print(f"[ev3] server starting on port {PORT}", flush=True)
    async with websockets.serve(handle, '0.0.0.0', PORT):
        print(f"[ev3] listening on 0.0.0.0:{PORT}", flush=True)
        await asyncio.Future()  # run forever

if __name__ == '__main__':
    asyncio.run(main())
```

- [ ] **Step 2: Commit**

```bash
git add ev3/ev3_server.py
git commit -m "feat(ev3): add ev3_server.py Python WebSocket server for EV3 brick"
```

---

## Task 8: Create `ev3-bridge.service` (systemd)

**Files:**
- Create: `ROOT/ev3/ev3-bridge.service`
- Create: `ROOT/ev3/README.md`

- [ ] **Step 1: Create systemd unit**

Create `/Volumes/Tim aaddtional/Download/115資通訊/tedt/ev3/ev3-bridge.service`:

```ini
[Unit]
Description=EV3 WebSocket Bridge Server
After=network.target

[Service]
Type=simple
User=robot
WorkingDirectory=/home/robot/ev3-bridge
ExecStart=/usr/bin/python3 /home/robot/ev3-bridge/ev3_server.py
Restart=always
RestartSec=2
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: Create vendor directory placeholder**

```bash
mkdir -p /Volumes/Tim\ aaddtional/Download/115資通訊/tedt/ev3/vendor
cat > /Volumes/Tim\ aaddtional/Download/115資通訊/tedt/ev3/vendor/README.md << 'EOF'
# Offline Python Wheels

Place `websockets` wheel files here for offline installation on EV3.

## How to download (run on a machine with internet):

```bash
pip download websockets==11.0.3 --dest . --python-version 3.9 --platform linux_armv7l --only-binary :all:
# If no binary available, download source and install via pip:
pip download websockets==11.0.3 --dest . --no-binary :all:
```

Then `ev3-setup.sh` will `scp` this directory to the EV3 and install offline.
EOF
```

- [ ] **Step 3: Create ev3/README.md**

Create `/Volumes/Tim aaddtional/Download/115資通訊/tedt/ev3/README.md`:

```markdown
# EV3 Bridge — Teacher Setup Guide

## One-Time Setup

1. Download ev3dev image: https://www.ev3dev.org/downloads/
2. Flash to microSD with Balena Etcher
3. Insert microSD into EV3, power on
4. Connect USB cable from EV3 to Mac (USB Tethering mode — NOT Internet Sharing)
5. Run:
   ```bash
   bash scripts/ev3-setup.sh
   ```
6. Done. EV3 will auto-run the bridge server on every boot.

## Troubleshooting

```bash
bash scripts/ev3-diagnose.sh
```

## Daily Use

1. Power on EV3
2. Plug USB cable into Mac
3. `npm run dev` (App 1)
4. App shows "EV3 已連線 ✓"
```

- [ ] **Step 4: Commit**

```bash
git add ev3/
git commit -m "feat(ev3): add systemd service unit, vendor dir, and README"
```

---

## Task 9: Create `scripts/ev3-setup.sh`

**Files:**
- Create: `ROOT/scripts/ev3-setup.sh`

- [ ] **Step 1: Create setup script**

Create `/Volumes/Tim aaddtional/Download/115資通訊/tedt/scripts/ev3-setup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EV3_USER="robot"
EV3_HOSTS=("192.168.0.1" "ev3dev.local")
REMOTE_DIR="/home/robot/ev3-bridge"
SSH_OPTS="-o ConnectTimeout=5 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

log()  { echo "  [ev3-setup] $*"; }
ok()   { echo "  ✓ $*"; }
fail() { echo "  ✗ $*"; exit 1; }

echo ""
echo "=== EV3 One-Time Setup ==="
echo ""

# Step 1: Find EV3
log "Looking for EV3..."
EV3_HOST=""
for host in "${EV3_HOSTS[@]}"; do
  if ping -c1 -W2 "$host" &>/dev/null 2>&1; then
    EV3_HOST="$host"
    ok "Found EV3 at $host"
    break
  fi
done

if [[ -z "$EV3_HOST" ]]; then
  fail "EV3 not found at 192.168.0.1 or ev3dev.local. Is USB plugged in? Is EV3 powered on?"
fi

# Step 2: Clear stale known_hosts entry (handles reflashed SD cards)
ssh-keygen -R "$EV3_HOST" 2>/dev/null || true
ssh-keygen -R "ev3dev.local" 2>/dev/null || true

# Step 3: Test SSH
log "Testing SSH connection..."
if ! ssh $SSH_OPTS "${EV3_USER}@${EV3_HOST}" "echo ok" &>/dev/null; then
  fail "SSH failed. Make sure EV3 is running ev3dev and USB tethering is active."
fi
ok "SSH connection OK"

# Step 4: Deploy files
log "Deploying ev3-bridge files..."
ssh $SSH_OPTS "${EV3_USER}@${EV3_HOST}" "mkdir -p ${REMOTE_DIR}/vendor"
scp $SSH_OPTS "${REPO_ROOT}/ev3/ev3_server.py" "${EV3_USER}@${EV3_HOST}:${REMOTE_DIR}/"
if ls "${REPO_ROOT}/ev3/vendor/"*.whl &>/dev/null 2>&1; then
  scp $SSH_OPTS "${REPO_ROOT}/ev3/vendor/"*.whl "${EV3_USER}@${EV3_HOST}:${REMOTE_DIR}/vendor/"
fi
ok "Files deployed"

# Step 5: Install Python dependencies offline
log "Installing Python dependencies..."
ssh $SSH_OPTS "${EV3_USER}@${EV3_HOST}" "
  set -e
  if ! python3 -c 'import websockets' 2>/dev/null; then
    if ls ${REMOTE_DIR}/vendor/*.whl 2>/dev/null; then
      pip3 install --no-index --find-links=${REMOTE_DIR}/vendor websockets
    else
      pip3 install websockets
    fi
  fi
" && ok "Python dependencies OK" || fail "Failed to install websockets"

# Step 6: Install and enable systemd service
log "Installing systemd service..."
scp $SSH_OPTS "${REPO_ROOT}/ev3/ev3-bridge.service" "${EV3_USER}@${EV3_HOST}:/tmp/"
ssh $SSH_OPTS "${EV3_USER}@${EV3_HOST}" "
  sudo cp /tmp/ev3-bridge.service /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable ev3-bridge.service
  sudo systemctl restart ev3-bridge.service
"
ok "systemd service enabled and started"

# Step 7: Health check — wait for port 8765
log "Waiting for server to start..."
sleep 3
if ssh $SSH_OPTS "${EV3_USER}@${EV3_HOST}" "python3 -c \"
import socket, sys
s = socket.socket()
s.settimeout(3)
try:
  s.connect(('127.0.0.1', 8765))
  sys.exit(0)
except:
  sys.exit(1)
\""; then
  ok "Server is listening on port 8765"
else
  fail "Server not responding on port 8765. Check: ssh ${EV3_USER}@${EV3_HOST} 'journalctl -u ev3-bridge -n 20'"
fi

echo ""
echo "=== Setup complete! ==="
echo ""
echo "  EV3 will now auto-start the bridge on every boot."
echo "  Daily use: power on EV3 → plug USB → npm run dev"
echo ""
```

- [ ] **Step 2: Make executable**

```bash
chmod +x /Volumes/Tim\ aaddtional/Download/115資通訊/tedt/scripts/ev3-setup.sh
```

- [ ] **Step 3: Commit**

```bash
git add scripts/ev3-setup.sh
git commit -m "feat(ev3): add ev3-setup.sh one-time teacher setup script"
```

---

## Task 10: Create `scripts/ev3-diagnose.sh`

**Files:**
- Create: `ROOT/scripts/ev3-diagnose.sh`

- [ ] **Step 1: Create diagnostic script**

Create `/Volumes/Tim aaddtional/Download/115資通訊/tedt/scripts/ev3-diagnose.sh`:

```bash
#!/usr/bin/env bash
EV3_USER="robot"
SSH_OPTS="-o ConnectTimeout=5 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

pass() { echo "  ✓ $*"; }
fail() { echo "  ✗ $*"; }
info() { echo "  → $*"; }

echo ""
echo "=== EV3 Diagnostic Report ==="
echo ""

# 1. USB network interface
echo "[1] USB network interface"
if ifconfig 2>/dev/null | grep -q '192.168.0' || ip addr 2>/dev/null | grep -q '192.168.0'; then
  pass "USB network interface found (192.168.0.x)"
else
  fail "No 192.168.0.x interface — is USB cable plugged in?"
fi

# 2. Ping
echo ""
echo "[2] EV3 ping"
EV3_HOST=""
for host in 192.168.0.1 ev3dev.local; do
  if ping -c1 -W2 "$host" &>/dev/null; then
    pass "Ping $host OK"
    EV3_HOST="$host"
    break
  else
    fail "Ping $host failed"
  fi
done

if [[ -z "$EV3_HOST" ]]; then
  echo ""
  echo "Cannot continue — EV3 not reachable."
  exit 1
fi

# 3. SSH
echo ""
echo "[3] SSH connection to $EV3_HOST"
if ssh $SSH_OPTS "${EV3_USER}@${EV3_HOST}" "echo ok" &>/dev/null; then
  pass "SSH OK"
else
  fail "SSH failed"
  exit 1
fi

# 4. systemd service status
echo ""
echo "[4] ev3-bridge.service status"
STATUS=$(ssh $SSH_OPTS "${EV3_USER}@${EV3_HOST}" "systemctl is-active ev3-bridge.service 2>/dev/null || echo inactive")
if [[ "$STATUS" == "active" ]]; then
  pass "Service is active"
else
  fail "Service is $STATUS"
  info "Run: ssh ${EV3_USER}@${EV3_HOST} 'journalctl -u ev3-bridge -n 30'"
fi

# 5. Python websockets import
echo ""
echo "[5] Python websockets"
if ssh $SSH_OPTS "${EV3_USER}@${EV3_HOST}" "python3 -c 'import websockets; print(websockets.__version__)'" 2>/dev/null; then
  pass "websockets importable"
else
  fail "websockets not installed — run scripts/ev3-setup.sh"
fi

# 6. WebSocket port
echo ""
echo "[6] Port 8765 listening"
if ssh $SSH_OPTS "${EV3_USER}@${EV3_HOST}" \
   "ss -tlnp 2>/dev/null | grep -q ':8765' || netstat -tlnp 2>/dev/null | grep -q ':8765'"; then
  pass "Port 8765 is listening"
else
  fail "Port 8765 not listening"
fi

echo ""
echo "=== Done ==="
echo ""
```

- [ ] **Step 2: Make executable and commit**

```bash
chmod +x /Volumes/Tim\ aaddtional/Download/115資通訊/tedt/scripts/ev3-diagnose.sh
git add scripts/ev3-diagnose.sh
git commit -m "feat(ev3): add ev3-diagnose.sh troubleshooting script"
```

---

## Task 11: Create `EV3ControlPanel.tsx`

**Files:**
- Create: `APP1/src/components/EV3ControlPanel.tsx`

- [ ] **Step 1: Create the component**

Create `google ai studio/app_1（國小）/AI自動板擦機器人/src/components/EV3ControlPanel.tsx`:

```tsx
import {useCallback, useEffect, useState} from 'react';
import {Loader2, Wifi, WifiOff, Zap} from 'lucide-react';
import {sendRobotCommand} from '../services/classroomApi';

type Ev3Status = {
  connected: boolean;
  lastCommand: string;
  lastResponse: string;
};

const EV3_BUTTONS: {label: string; command: string; className?: string}[] = [
  {label: '筆落下', command: 'EV3_PEN_DOWN'},
  {label: '筆抬起', command: 'EV3_PEN_UP'},
  {label: '臂延伸', command: 'EV3_ARM_EXTEND'},
  {label: '臂收回', command: 'EV3_ARM_RETRACT'},
  {label: '畫一條線', command: 'EV3_DRAW_LINE'},
  {label: '歸位', command: 'EV3_HOME'},
  {label: '校準', command: 'EV3_CALIBRATE'},
  {label: '安全姿態', command: 'EV3_SAFE_POSE'},
  {label: '取消序列', command: 'EV3_CANCEL'},
  {label: '自我測試', command: 'EV3_TEST'},
  {label: 'EV3 停止', command: 'EV3_STOP', className: 'bg-red-500 hover:bg-red-600 text-white'},
];

export default function EV3ControlPanel() {
  const [status, setStatus] = useState<Ev3Status>({connected: false, lastCommand: '', lastResponse: ''});
  const [busy, setBusy] = useState(false);
  const [activeCmd, setActiveCmd] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/ev3/status');
      if (res.ok) setStatus(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void refreshStatus();
    const timer = setInterval(refreshStatus, 2000);
    return () => clearInterval(timer);
  }, [refreshStatus]);

  const sendCmd = async (command: string) => {
    if (busy) return;
    setBusy(true);
    setActiveCmd(command);
    try {
      await sendRobotCommand(command);
      await refreshStatus();
    } catch { /* ignore */ } finally {
      setBusy(false);
      setActiveCmd(null);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">EV3 筆臂控制</h3>
        <div className="flex items-center gap-1.5 text-xs">
          {status.connected
            ? <><Wifi className="h-3.5 w-3.5 text-green-500" /><span className="text-green-600">已連線</span></>
            : <><WifiOff className="h-3.5 w-3.5 text-gray-400" /><span className="text-gray-400">尋找中...</span></>
          }
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {EV3_BUTTONS.map(({label, command, className}) => (
          <button
            key={command}
            onClick={() => void sendCmd(command)}
            disabled={busy || !status.connected}
            className={className ?? 'rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40'}
          >
            {activeCmd === command
              ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" />
              : label
            }
          </button>
        ))}
      </div>

      {status.lastCommand && (
        <div className="mt-3 flex items-start gap-1.5 text-xs text-gray-400">
          <Zap className="mt-0.5 h-3 w-3 flex-shrink-0" />
          <span>{status.lastCommand}: {status.lastResponse}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add `sendRobotCommand` to `classroomApi.ts` if not already there**

Check if `sendRobotCommand` exists:
```bash
grep -n "sendRobotCommand" "google ai studio/app_1（國小）/AI自動板擦機器人/src/services/classroomApi.ts"
```

If not found, add to `classroomApi.ts`:

```typescript
export async function sendRobotCommand(command: string): Promise<{ok: boolean; response?: string}> {
  return apiRequest<{ok: boolean; response?: string}>('/api/robot/command', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({command, source: 'ev3-panel'}),
  });
}
```

- [ ] **Step 3: Type-check**

```bash
cd "google ai studio/app_1（國小）/AI自動板擦機器人"
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add "google ai studio/app_1（國小）/AI自動板擦機器人/src/components/EV3ControlPanel.tsx" \
        "google ai studio/app_1（國小）/AI自動板擦機器人/src/services/classroomApi.ts"
git commit -m "feat(ev3): add EV3ControlPanel component with connection status and 11 control buttons"
```

---

## Task 12: Wire `EV3ControlPanel` into App 1 UI

**Files:**
- Modify: Find the robot/hardware control page in App 1 and add EV3ControlPanel

- [ ] **Step 1: Find the robot control page**

```bash
grep -rn "RobotControl\|robot.*control\|commandCatalog\|串口\|serialBridge" \
  "google ai studio/app_1（國小）/AI自動板擦機器人/src/" --include="*.tsx" -l
```

- [ ] **Step 2: Add EV3ControlPanel import and render**

In the file found above, add:

```typescript
import EV3ControlPanel from '../components/EV3ControlPanel';
```

And in the JSX, below the existing robot control section:

```tsx
<EV3ControlPanel />
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
cd "google ai studio/app_1（國小）/AI自動板擦機器人"
npx tsc --noEmit
```

- [ ] **Step 4: Run CI gate**

```bash
cd "google ai studio/app_1（國小）/AI自動板擦機器人"
npm run check
```

Expected: lint passes, build passes.

- [ ] **Step 5: Commit**

```bash
git add "google ai studio/app_1（國小）/AI自動板擦機器人/src/"
git commit -m "feat(ev3): wire EV3ControlPanel into App 1 robot control UI"
```

---

## Self-Review

Spec coverage check:

| Spec requirement | Covered by task |
|---|---|
| Auto-detect IP: EV3_HOST → 192.168.0.1 → ev3dev.local | Task 2 (ev3Manager `getHosts()`) |
| Backoff reconnect (0→1→3→5s) | Task 2 (BACKOFF_MS) |
| UUID request-id correlation | Task 2 (randomUUID) |
| Flush pending on disconnect | Task 2 (flushPending) |
| 11 EV3 commands in catalog | Task 4 |
| EV3_ routing in /api/robot/command | Task 5 |
| STOP dual-send | Task 5 |
| GET /api/ev3/status | Task 5 |
| startEV3Manager on bridge start | Task 6 |
| ev3_server.py with absolute encoder positions | Task 7 |
| Failsafe: stop motors on client disconnect | Task 7 (handle finally) |
| EV3_DRAW_LINE busy guard | Task 7 (_busy flag) |
| systemd service Restart=always | Task 8 |
| Offline vendor wheel support | Task 8 |
| ev3-setup.sh with preflight + health check | Task 9 |
| ev3-diagnose.sh | Task 10 |
| EV3ControlPanel with busy lock + 2s status poll | Task 11 |

All spec requirements covered. No placeholders found.
