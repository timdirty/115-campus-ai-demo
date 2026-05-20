# Sensor Zone Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-detect USB Arduino sensor boards, background-poll their HY-M302 readings, let users assign each board to a campus zone via an in-app widget, and show rich sensor gauges (temp/humidity/light) in the zone detail panel and on the campus map.

**Architecture:** A new `sensorManager.ts` service in the App 1 bridge owns all sensor-port lifecycle — it scans for Arduino-like USB ports on startup, opens each one, polls `READ_SENSORS` every 5 s, caches results in memory, and persists zone assignments. Three new REST endpoints expose this data. App 3 polls `/api/sensors/live` every 8 s and `/api/sensors/ports` to detect unassigned boards, renders a `SensorAssignmentWidget` banner when a board needs a zone, and shows full temp/humidity/light gauges inside `ZoneSensorPanel` when a zone is selected.

**Tech Stack:** Node.js / TypeScript / Express / serialport (bridge); React 18 / Tailwind CSS / lucide-react / motion (App 3); PlatformIO / DHT sensor library (firmware — already done).

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `server/sensorManager.ts` | **CREATE** | Background port scanning, polling, cache, zone assignments |
| `server/routes.ts` | **MODIFY** | Add `/api/sensors/ports`, `/api/sensors/live`, `/api/sensors/assign` |
| `server/serialBridge.ts` | **MODIFY** | Call `startSensorPolling()` on startup |
| `server/robotService.ts` | **MODIFY** | Remove manual `ZONE_PORT_ENV` block (superseded) |
| `src/types.ts` | **MODIFY** | Add `DetectedPort`, extend `ZoneSensorReading` with `portPath` |
| `src/services/hardwareBridge.ts` | **MODIFY** | Add `fetchSensorPorts()`, `assignSensorPort()`, update `fetchZoneSensors()` |
| `src/components/ZoneSensorPanel.tsx` | **CREATE** | Temp/humidity/light gauges for ZoneInspector |
| `src/components/SensorAssignmentWidget.tsx` | **CREATE** | Banner + modal to assign detected boards to zones |
| `src/components/CampusMapSvg.tsx` | **MODIFY** | Zone click handler, live-sensor animation, humidity badge |
| `src/App.tsx` | **MODIFY** | Wire widget state, unassigned-port polling, ZoneSensorPanel in ZoneInspector |

---

## Task 1: Create `server/sensorManager.ts`

**Files:**
- Create: `google ai studio/app_1（國小）/AI自動板擦機器人/server/sensorManager.ts`

- [ ] **Step 1: Write the file**

```typescript
import {SerialPort} from 'serialport';
import {baudRate} from './config';
import {isArduinoLikePort, listPorts} from './robotService';

export interface SensorReading {
  temp: number;
  hum: number;
  light: number;
}

export interface DetectedPort {
  portPath: string;
  connected: boolean;
  reading: SensorReading | null;
  assignedZone: string | null;
  updatedAt: string;
}

export interface LiveZoneReading {
  zoneId: string;
  portPath: string;
  temp: number | null;
  hum: number | null;
  light: number | null;
  connected: boolean;
  updatedAt: string;
}

interface PortEntry {
  port: SerialPort;
  reading: SensorReading | null;
  updatedAt: Date | null;
  busy: boolean;
}

const portCache = new Map<string, PortEntry>();
const zoneAssignments = new Map<string, string>(); // portPath → zoneId

function parseSensorLine(raw: string): SensorReading | null {
  const match = raw.match(/SENSORS:TEMP:([\d.]+),HUM:(\d+),LIGHT:(\d+)/);
  if (!match) return null;
  return {
    temp: parseFloat(match[1]),
    hum: parseInt(match[2], 10),
    light: parseInt(match[3], 10),
  };
}

async function waitForResponse(port: SerialPort, timeoutMs = 2000): Promise<string> {
  return new Promise((resolve) => {
    let buffer = '';
    const cleanup = () => {
      clearTimeout(timer);
      port.off('data', onData);
    };
    const onData = (data: Buffer) => {
      buffer += data.toString();
      if (buffer.includes('\n')) {
        cleanup();
        resolve(buffer.trim());
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve(buffer.trim());
    }, timeoutMs);
    port.on('data', onData);
  });
}

async function readSensorsFrom(port: SerialPort): Promise<SensorReading | null> {
  const responsePromise = waitForResponse(port, 2200);
  await new Promise<void>((resolve, reject) => {
    port.write('READ_SENSORS\n', (err) => {
      if (err) reject(err);
      else port.drain((drainErr) => (drainErr ? reject(drainErr) : resolve()));
    });
  });
  const raw = await responsePromise;
  return parseSensorLine(raw);
}

async function openSensorPort(portPath: string): Promise<void> {
  if (portCache.has(portPath)) return;
  const port = new SerialPort({path: portPath, baudRate, autoOpen: false});
  try {
    await new Promise<void>((resolve, reject) => {
      port.open((err) => (err ? reject(err) : resolve()));
    });
    portCache.set(portPath, {port, reading: null, updatedAt: null, busy: false});
    console.log(`[sensors] opened ${portPath}`);
  } catch (err) {
    console.warn(`[sensors] cannot open ${portPath}:`, err);
  }
}

async function scanAndOpenPorts(): Promise<void> {
  try {
    const ports = await listPorts();
    const arduinoPorts = ports.filter(isArduinoLikePort);
    for (const p of arduinoPorts) {
      await openSensorPort(p.path);
    }
    // Remove ports that are no longer present
    const livePaths = new Set(arduinoPorts.map((p) => p.path));
    for (const [path, entry] of portCache) {
      if (!livePaths.has(path) && entry.port.isOpen) {
        entry.port.close(() => {});
        portCache.delete(path);
        console.log(`[sensors] removed ${path}`);
      }
    }
  } catch (err) {
    console.warn('[sensors] scan error:', err);
  }
}

async function pollAll(): Promise<void> {
  await scanAndOpenPorts();
  for (const [portPath, entry] of portCache) {
    if (entry.busy || !entry.port.isOpen) continue;
    entry.busy = true;
    try {
      const reading = await readSensorsFrom(entry.port);
      portCache.set(portPath, {...entry, reading, updatedAt: new Date(), busy: false});
    } catch {
      portCache.set(portPath, {...entry, reading: null, busy: false});
    }
  }
}

export function startSensorPolling(): void {
  const tick = async () => {
    await pollAll().catch((err) => console.warn('[sensors] poll error:', err));
    setTimeout(tick, 5000);
  };
  setTimeout(tick, 500);
}

export function getAllDetectedPorts(): DetectedPort[] {
  return [...portCache.entries()].map(([portPath, entry]) => ({
    portPath,
    connected: entry.port.isOpen && entry.reading !== null,
    reading: entry.reading,
    assignedZone: zoneAssignments.get(portPath) ?? null,
    updatedAt: entry.updatedAt?.toISOString() ?? new Date(0).toISOString(),
  }));
}

export function getLiveZoneReadings(): LiveZoneReading[] {
  const results: LiveZoneReading[] = [];
  for (const [portPath, entry] of portCache) {
    const zoneId = zoneAssignments.get(portPath);
    if (!zoneId) continue;
    results.push({
      zoneId,
      portPath,
      temp: entry.reading?.temp ?? null,
      hum: entry.reading?.hum ?? null,
      light: entry.reading?.light ?? null,
      connected: entry.port.isOpen && entry.reading !== null,
      updatedAt: entry.updatedAt?.toISOString() ?? new Date(0).toISOString(),
    });
  }
  return results;
}

export function assignPortToZone(portPath: string, zoneId: string): void {
  // Remove any previous assignment for this zone
  for (const [path, zone] of zoneAssignments) {
    if (zone === zoneId && path !== portPath) zoneAssignments.delete(path);
  }
  zoneAssignments.set(portPath, zoneId);
  console.log(`[sensors] assigned ${portPath} → ${zoneId}`);
}

export function unassignPort(portPath: string): void {
  zoneAssignments.delete(portPath);
}
```

- [ ] **Step 2: Verify TypeScript compiles (no errors expected yet, just check syntax)**

```bash
cd "google ai studio/app_1（國小）/AI自動板擦機器人"
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors (or only errors from files that haven't been updated yet).

- [ ] **Step 3: Commit**

```bash
git add "google ai studio/app_1（國小）/AI自動板擦機器人/server/sensorManager.ts"
git commit -m "feat(bridge): add sensorManager with background port polling and zone assignments"
```

---

## Task 2: Remove old zone port code from `robotService.ts`

**Files:**
- Modify: `google ai studio/app_1（國小）/AI自動板擦機器人/server/robotService.ts`

- [ ] **Step 1: Remove the manual zone port block (lines 132–201)**

Delete everything from `// Zone IDs → env vars:` through the closing `}` of `readAllZoneSensors`, inclusive. This includes `ZONE_PORT_ENV`, `zonePorts`, `openZonePort`, `parseSensorLine`, `ZoneSensorReading` interface, and `readAllZoneSensors`.

After deletion, the line immediately after `sendSerialCommand` export should be `export async function recordUnsupportedTask`.

- [ ] **Step 2: Verify**

```bash
cd "google ai studio/app_1（國小）/AI自動板擦機器人"
npx tsc --noEmit 2>&1 | head -30
```

Expected: errors referencing `readAllZoneSensors` and `ZoneSensorReading` in `routes.ts` — these will be fixed in Task 3.

- [ ] **Step 3: Commit**

```bash
git add "google ai studio/app_1（國小）/AI自動板擦機器人/server/robotService.ts"
git commit -m "refactor(bridge): remove manual zone port code superseded by sensorManager"
```

---

## Task 3: Update `routes.ts` — three new sensor endpoints

**Files:**
- Modify: `google ai studio/app_1（國小）/AI自動板擦機器人/server/routes.ts`

- [ ] **Step 1: Replace the import of `readAllZoneSensors` and add sensorManager import**

Find this line:
```typescript
import {getActivePath, isArduinoLikePort, listPorts, readAllZoneSensors, recordUnsupportedTask, resolveTaskCommand, sendSerialCommand} from './robotService';
```

Replace with:
```typescript
import {getActivePath, isArduinoLikePort, listPorts, recordUnsupportedTask, resolveTaskCommand, sendSerialCommand} from './robotService';
import {assignPortToZone, getAllDetectedPorts, getLiveZoneReadings, unassignPort} from './sensorManager';
```

- [ ] **Step 2: Replace the old `/api/zones/sensors` endpoint with three new ones**

Find:
```typescript
  app.get('/api/zones/sensors', async (_req, res) => {
    try {
      res.json({zones: await readAllZoneSensors()});
    } catch (error) {
      sendError(res, error);
    }
  });
```

Replace with:
```typescript
  // List all detected sensor boards with their latest readings and zone assignments
  app.get('/api/sensors/ports', (_req, res) => {
    res.json({ports: getAllDetectedPorts()});
  });

  // Get live sensor readings for all assigned zones
  app.get('/api/sensors/live', (_req, res) => {
    res.json({zones: getLiveZoneReadings()});
  });

  // Assign a detected port to a campus zone
  app.post('/api/sensors/assign', (req, res) => {
    const portPath = String(req.body?.portPath ?? '').trim();
    const zoneId = String(req.body?.zoneId ?? '').trim();
    if (!portPath || !zoneId) {
      res.status(400).json({error: 'portPath and zoneId are required'});
      return;
    }
    if (zoneId === '__unassign__') {
      unassignPort(portPath);
      res.json({ok: true, portPath, zoneId: null});
      return;
    }
    assignPortToZone(portPath, zoneId);
    res.json({ok: true, portPath, zoneId});
  });
```

- [ ] **Step 3: Verify compiles clean**

```bash
cd "google ai studio/app_1（國小）/AI自動板擦機器人"
npx tsc --noEmit 2>&1
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add "google ai studio/app_1（國小）/AI自動板擦機器人/server/routes.ts"
git commit -m "feat(bridge): add /api/sensors/ports, /api/sensors/live, /api/sensors/assign endpoints"
```

---

## Task 4: Start sensor polling in `serialBridge.ts`

**Files:**
- Modify: `google ai studio/app_1（國小）/AI自動板擦機器人/server/serialBridge.ts`

- [ ] **Step 1: Add import and start call**

After the existing imports, add:
```typescript
import {startSensorPolling} from './sensorManager';
```

After the `app.listen(...)` call, add:
```typescript
startSensorPolling();
```

The final lines of the file should look like:
```typescript
app.listen(bridgePort, () => {
  console.log(`Arduino serial bridge listening on http://localhost:${bridgePort}`);
  console.log(`Baud rate: ${baudRate}`);
  console.log(`Mode: ${nodeEnv}`);
});

startSensorPolling();
```

- [ ] **Step 2: Verify**

```bash
cd "google ai studio/app_1（國小）/AI自動板擦機器人"
npm run check 2>&1 | tail -15
```

Expected: all tests pass, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add "google ai studio/app_1（國小）/AI自動板擦機器人/server/serialBridge.ts"
git commit -m "feat(bridge): start background sensor polling on bridge startup"
```

---

## Task 5: App 3 — extend types and hardwareBridge

**Files:**
- Modify: `google ai studio/app_3（國中）/AI校園心靈守護者/src/types.ts`
- Modify: `google ai studio/app_3（國中）/AI校園心靈守護者/src/services/hardwareBridge.ts`

- [ ] **Step 1: Add `DetectedPort` to `types.ts`**

After the existing `ZoneSensorReading` interface, add:
```typescript
export interface DetectedPort {
  portPath: string;
  connected: boolean;
  reading: {temp: number; hum: number; light: number} | null;
  assignedZone: string | null;
  updatedAt: string;
}
```

Also extend `ZoneSensorReading` to include `portPath` (optional, for display):
```typescript
export interface ZoneSensorReading {
  zoneId: string;
  portPath?: string;
  temp: number | null;
  hum: number | null;
  light: number | null;
  connected: boolean;
  updatedAt: string;
}
```

- [ ] **Step 2: Update `hardwareBridge.ts`**

Replace the entire file content with:
```typescript
import type {DetectedPort, ZoneSensorReading} from '../types';

const BRIDGE_URL =
  ((import.meta as unknown as {env?: Record<string, string>}).env?.VITE_ARDUINO_BRIDGE_URL) ||
  'http://localhost:3200';

export async function fetchZoneSensors(): Promise<ZoneSensorReading[]> {
  try {
    const response = await fetch(`${BRIDGE_URL}/api/sensors/live`);
    if (!response.ok) return [];
    const payload = await response.json().catch(() => ({}));
    return Array.isArray(payload.zones) ? payload.zones : [];
  } catch {
    return [];
  }
}

export async function fetchSensorPorts(): Promise<DetectedPort[]> {
  try {
    const response = await fetch(`${BRIDGE_URL}/api/sensors/ports`);
    if (!response.ok) return [];
    const payload = await response.json().catch(() => ({}));
    return Array.isArray(payload.ports) ? payload.ports : [];
  } catch {
    return [];
  }
}

export async function assignSensorPort(portPath: string, zoneId: string | null): Promise<boolean> {
  try {
    const response = await fetch(`${BRIDGE_URL}/api/sensors/assign`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({portPath, zoneId: zoneId ?? '__unassign__'}),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function sendGuardianHardwareCommand(command: string, source: string) {
  try {
    const response = await fetch(`${BRIDGE_URL}/api/robot/command`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({command, source}),
    });
    const payload = await response.json().catch(() => ({}));
    return {
      ok: response.ok,
      message: payload.response || payload.error || payload.status?.lastResponse || `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : '無法連接本機硬體服務',
    };
  }
}
```

- [ ] **Step 3: Verify**

```bash
cd "google ai studio/app_3（國中）/AI校園心靈守護者"
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors (or errors only in App.tsx which still uses old import — will fix in Task 8).

- [ ] **Step 4: Commit**

```bash
git add "google ai studio/app_3（國中）/AI校園心靈守護者/src/types.ts" \
        "google ai studio/app_3（國中）/AI校園心靈守護者/src/services/hardwareBridge.ts"
git commit -m "feat(app3): add DetectedPort type, fetchSensorPorts, assignSensorPort APIs"
```

---

## Task 6: Create `ZoneSensorPanel.tsx`

**Files:**
- Create: `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/ZoneSensorPanel.tsx`

- [ ] **Step 1: Write the component**

```tsx
import {Thermometer, Droplets, Sun} from 'lucide-react';
import type {ZoneSensorReading} from '../types';

function tempColor(temp: number): string {
  if (temp < 24) return 'text-sky-500';
  if (temp < 27) return 'text-teal-500';
  if (temp < 30) return 'text-amber-500';
  return 'text-rose-500';
}

function tempLabel(temp: number): string {
  if (temp < 24) return '涼爽';
  if (temp < 27) return '舒適';
  if (temp < 30) return '偏熱';
  return '悶熱';
}

function humLabel(hum: number): string {
  if (hum < 30) return '乾燥';
  if (hum < 70) return '舒適';
  return '潮濕';
}

function lightLabel(light: number): string {
  if (light < 200) return '昏暗';
  if (light < 600) return '一般';
  return '明亮';
}

function lightPercent(light: number): number {
  return Math.round(Math.min(100, (light / 1023) * 100));
}

function ArcGauge({value, max, color, size = 64}: {value: number; max: number; color: string; size?: number}) {
  const r = (size - 8) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * r; // half circle
  const filled = (value / max) * circumference;
  return (
    <svg width={size} height={size / 2 + 4} viewBox={`0 0 ${size} ${size / 2 + 4}`}>
      <path
        d={`M 4 ${size / 2} A ${r} ${r} 0 0 1 ${size - 4} ${size / 2}`}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d={`M 4 ${size / 2} A ${r} ${r} 0 0 1 ${size - 4} ${size / 2}`}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
      />
    </svg>
  );
}

export function ZoneSensorPanel({sensor}: {sensor: ZoneSensorReading | undefined}) {
  if (!sensor) {
    return (
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <p className="text-xs font-black text-slate-400">環境感測</p>
        <p className="mt-2 text-sm text-slate-400">此區域尚未設定感測板</p>
      </div>
    );
  }

  if (!sensor.connected || sensor.temp === null) {
    return (
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <p className="text-xs font-black text-slate-400">環境感測</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-slate-300" />
          <p className="text-sm text-slate-400">感測板離線</p>
        </div>
      </div>
    );
  }

  const {temp, hum, light} = sensor;
  const humValue = hum ?? 0;
  const lightValue = light ?? 0;
  const lp = lightPercent(lightValue);
  const now = Date.now();
  const ageMs = now - new Date(sensor.updatedAt).getTime();
  const ageLabel = ageMs < 10000 ? '剛剛' : `${Math.round(ageMs / 1000)} 秒前`;

  return (
    <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-black text-teal-700">環境感測</p>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-teal-500" />
          <span className="text-[10px] font-bold text-teal-600">LIVE · {ageLabel}</span>
        </div>
      </div>

      {/* Temperature */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center">
          <Thermometer className={`h-4 w-4 ${tempColor(temp)}`} />
          <span className={`text-3xl font-black leading-none ${tempColor(temp)}`}>{temp.toFixed(1)}</span>
          <span className="text-[10px] font-bold text-slate-500">°C</span>
          <span className={`mt-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-black ${tempColor(temp)} bg-white/60`}>
            {tempLabel(temp)}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-3">
          {/* Humidity arc */}
          <div className="flex items-center gap-2">
            <Droplets className="h-3.5 w-3.5 text-sky-400 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between text-[10px] font-black text-slate-500">
                <span>濕度</span>
                <span>{humValue}% · {humLabel(humValue)}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-sky-400 transition-all duration-700"
                  style={{width: `${humValue}%`}}
                />
              </div>
            </div>
          </div>

          {/* Light */}
          <div className="flex items-center gap-2">
            <Sun className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between text-[10px] font-black text-slate-500">
                <span>光線</span>
                <span>{lightLabel(lightValue)} ({lp}%)</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all duration-700"
                  style={{width: `${lp}%`}}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
cd "google ai studio/app_3（國中）/AI校園心靈守護者"
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add "google ai studio/app_3（國中）/AI校園心靈守護者/src/components/ZoneSensorPanel.tsx"
git commit -m "feat(app3): add ZoneSensorPanel with temperature/humidity/light gauges"
```

---

## Task 7: Create `SensorAssignmentWidget.tsx`

**Files:**
- Create: `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/SensorAssignmentWidget.tsx`

- [ ] **Step 1: Write the component**

```tsx
import {useState} from 'react';
import {Cpu, X, Check} from 'lucide-react';
import type {DetectedPort} from '../types';
import {assignSensorPort} from '../services/hardwareBridge';

const ZONE_OPTIONS = [
  {id: 'zone-library', name: '圖書館'},
  {id: 'zone-hall', name: '穿堂'},
  {id: 'zone-classroom', name: '九年級教室'},
  {id: 'zone-gym', name: '體育館'},
  {id: 'zone-field', name: '操場'},
];

interface Props {
  ports: DetectedPort[];
  onAssigned: () => void;
}

export function SensorAssignmentWidget({ports, onAssigned}: Props) {
  const [open, setOpen] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const p of ports) {
      init[p.portPath] = p.assignedZone ?? '';
    }
    return init;
  });
  const [saving, setSaving] = useState(false);

  const unassignedCount = ports.filter((p) => !p.assignedZone).length;
  if (unassignedCount === 0 && !open) return null;

  const handleSave = async () => {
    setSaving(true);
    for (const [portPath, zoneId] of Object.entries(assignments)) {
      await assignSensorPort(portPath, zoneId || null);
    }
    setSaving(false);
    setOpen(false);
    onAssigned();
  };

  const portLabel = (p: DetectedPort) => {
    const shortPath = p.portPath.split('/').pop() ?? p.portPath;
    if (p.reading) {
      return `${shortPath} · ${p.reading.temp.toFixed(1)}°C / ${p.reading.hum}% / 光${p.reading.light}`;
    }
    return `${shortPath} · 等待讀值...`;
  };

  return (
    <>
      {/* Banner */}
      {unassignedCount > 0 && !open && (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-black text-teal-700 transition hover:bg-teal-100"
        >
          <Cpu className="h-3.5 w-3.5 animate-pulse" />
          偵測到 {unassignedCount} 個感測板待指派
        </button>
      )}

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">感測板指派</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-xs font-bold text-slate-500">
              選擇每個感測板對應的校園空間，完成後即時顯示環境數據。
            </p>

            <div className="space-y-4">
              {ports.map((p) => (
                <div key={p.portPath} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="mb-2 text-[11px] font-black text-slate-700 font-mono truncate">{portLabel(p)}</p>
                  <select
                    value={assignments[p.portPath] ?? ''}
                    onChange={(e) => setAssignments((prev) => ({...prev, [p.portPath]: e.target.value}))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                  >
                    <option value="">-- 不指派 --</option>
                    {ZONE_OPTIONS.map((z) => (
                      <option key={z.id} value={z.id}>{z.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700 disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
              {saving ? '儲存中...' : '確認指派'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify**

```bash
cd "google ai studio/app_3（國中）/AI校園心靈守護者"
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add "google ai studio/app_3（國中）/AI校園心靈守護者/src/components/SensorAssignmentWidget.tsx"
git commit -m "feat(app3): add SensorAssignmentWidget for port-to-zone assignment UI"
```

---

## Task 8: Wire `ZoneSensorPanel` into `ZoneInspector` in `App.tsx`

**Files:**
- Modify: `google ai studio/app_3（國中）/AI校園心靈守護者/src/App.tsx`

- [ ] **Step 1: Add imports at top of App.tsx (after existing component imports)**

```typescript
import {ZoneSensorPanel} from './components/ZoneSensorPanel';
import {SensorAssignmentWidget} from './components/SensorAssignmentWidget';
import {fetchSensorPorts} from './services/hardwareBridge';
import type {DetectedPort} from './types';
```

- [ ] **Step 2: Add `detectedPorts` state after `zoneSensors` state**

After `const [zoneSensors, setZoneSensors] = useState<ZoneSensorReading[]>([]);`, add:
```typescript
const [detectedPorts, setDetectedPorts] = useState<DetectedPort[]>([]);
```

- [ ] **Step 3: Add ports polling useEffect (after the existing zoneSensors useEffect)**

After the `useEffect` that polls `fetchZoneSensors`, add:
```typescript
useEffect(() => {
  let cancelled = false;
  const poll = async () => {
    const ports = await fetchSensorPorts();
    if (!cancelled) setDetectedPorts(ports);
  };
  poll();
  const timer = setInterval(poll, 8000);
  return () => {
    cancelled = true;
    clearInterval(timer);
  };
}, []);
```

- [ ] **Step 4: Add `SensorAssignmentWidget` to the app header**

Find the `<header` element. After the last element inside the header's inner flex div (currently ends near the lock icon button), add the widget. Find the line with the privacy mode toggle button and after the closing `</div>` of the header's button group, add:

```tsx
<SensorAssignmentWidget
  ports={detectedPorts}
  onAssigned={() => {
    void fetchSensorPorts().then(setDetectedPorts);
    void fetchZoneSensors().then((r) => { if (r.length > 0) setZoneSensors(r); });
  }}
/>
```

The exact location: in the header's flex row that contains the nav buttons and lock button, insert as the last child before the closing `</div>` of the header inner content.

- [ ] **Step 5: Add `ZoneSensorPanel` inside `ZoneInspector`**

Find the `ZoneInspector` function (around line 732). Inside its return, after the `<DispatchProgress .../>` line and before `<PrimaryAction ...>`, add:

```tsx
<ZoneSensorPanel sensor={zone.sensor} />
```

The function signature needs updating to import `ZoneSensorPanel` — already done in Step 1. The `zone.sensor` field is already set in `SchoolZoneStatus` from Task 5.

- [ ] **Step 6: Full verify**

```bash
cd "google ai studio/app_3（國中）/AI校園心靈守護者"
npm run check 2>&1 | tail -20
```

Expected: all tests pass, TypeScript clean, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add "google ai studio/app_3（國中）/AI校園心靈守護者/src/App.tsx"
git commit -m "feat(app3): integrate ZoneSensorPanel in ZoneInspector + SensorAssignmentWidget in header"
```

---

## Task 9: Enhance `CampusMapSvg.tsx` — live animation, humidity badge, zone click

**Files:**
- Modify: `google ai studio/app_3（國中）/AI校園心靈守護者/src/components/CampusMapSvg.tsx`

- [ ] **Step 1: Add `onZoneClick` and `selectedZoneId` props, enhance `SensorBadge`, add live dot**

Replace the entire file with:

```tsx
import type {ZoneSensorReading} from '../types';

interface ZoneData {
  id: string;
  riskLevel: 'low' | 'medium' | 'high';
  sensor?: ZoneSensorReading;
}

interface CampusMapSvgProps {
  zones?: ZoneData[];
  selectedZoneId?: string;
  onZoneClick?: (zoneId: string) => void;
}

function SensorBadge({sensor, x, y}: {sensor: ZoneSensorReading | undefined; x: number; y: number}) {
  if (!sensor?.connected || sensor.temp === null) return null;
  const tempLabel = `${sensor.temp.toFixed(1)}°C`;
  const humLabel = sensor.hum !== null ? ` ${sensor.hum}%` : '';
  const width = humLabel ? 56 : 36;
  return (
    <g>
      <rect x={x} y={y} width={width} height="13" rx="4" fill="rgba(15,23,42,0.72)" />
      <text x={x + 10} y={y + 9.5} fontSize="7.5" fill="#fcd34d" fontWeight="700">🌡</text>
      <text x={x + 19} y={y + 9.5} fontSize="7.5" fill="#e2e8f0" fontWeight="600">{tempLabel}</text>
      {humLabel && (
        <>
          <text x={x + 38} y={y + 9.5} fontSize="7.5" fill="#93c5fd" fontWeight="600">{humLabel}</text>
        </>
      )}
    </g>
  );
}

function LiveDot({x, y, active}: {x: number; y: number; active: boolean}) {
  if (!active) return null;
  return (
    <g>
      <circle cx={x} cy={y} r="4" fill="#10b981" opacity="0.3">
        <animate attributeName="r" values="4;7;4" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx={x} cy={y} r="3" fill="#10b981" />
    </g>
  );
}

function getZoneFill(zones: ZoneData[], id: string, defaultFill: string): {fill: string; stroke: string} {
  const zone = zones.find((z) => z.id === id);
  if (!zone) return {fill: defaultFill, stroke: '#9ca3af'};
  const colors = {
    low: {fill: '#dcfce7', stroke: '#86efac'},
    medium: {fill: '#fef9c3', stroke: '#fde047'},
    high: {fill: '#fee2e2', stroke: '#fca5a5'},
  };
  return colors[zone.riskLevel];
}

export function CampusMapSvg({zones = [], selectedZoneId, onZoneClick}: CampusMapSvgProps) {
  const library = getZoneFill(zones, 'zone-library', '#dbeafe');
  const hall = getZoneFill(zones, 'zone-hall', '#d1fae5');
  const field = getZoneFill(zones, 'zone-field', '#fef9c3');
  const classroom = getZoneFill(zones, 'zone-classroom', '#ede9fe');
  const gym = getZoneFill(zones, 'zone-gym', '#fed7aa');

  const libSensor = zones.find((z) => z.id === 'zone-library')?.sensor;
  const hallSensor = zones.find((z) => z.id === 'zone-hall')?.sensor;
  const gymSensor = zones.find((z) => z.id === 'zone-gym')?.sensor;

  const selectedStroke = '#0d9488';
  const selectedWidth = 2.5;

  const zoneStroke = (id: string, base: string) =>
    selectedZoneId === id ? selectedStroke : base;
  const zoneStrokeWidth = (id: string) =>
    selectedZoneId === id ? selectedWidth : 1.5;

  const clickable = onZoneClick ? {cursor: 'pointer'} : {};

  return (
    <svg
      viewBox="0 0 400 320"
      className="absolute inset-0 h-full w-full"
      role="img"
      aria-label="校園平面示意圖"
    >
      <title>校園安全監控地圖</title>

      <style>{`
        @keyframes pulse-ring {
          0% { r: 12; opacity: 0.8; }
          100% { r: 22; opacity: 0; }
        }
        .risk-pulse { animation: pulse-ring 1.5s ease-out infinite; }
      `}</style>

      <rect x="0" y="0" width="400" height="320" fill="#f8fafc" />
      <defs>
        <pattern id="campusGrid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(15,23,42,0.045)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="400" height="320" fill="url(#campusGrid)" />

      {/* 圖書館 */}
      <g
        aria-label="圖書館"
        style={clickable}
        onClick={() => onZoneClick?.('zone-library')}
      >
        <rect x="10" y="10" width="100" height="70" rx="8" fill={library.fill} stroke={zoneStroke('zone-library', library.stroke)} strokeWidth={zoneStrokeWidth('zone-library')} />
        <text x="60" y="43" textAnchor="middle" fontSize="12" fill="#1e40af" fontWeight="700">圖書館</text>
        <line x1="22" y1="55" x2="78" y2="55" stroke={library.stroke} strokeWidth="1" />
        <line x1="22" y1="63" x2="78" y2="63" stroke={library.stroke} strokeWidth="1" />
        <line x1="22" y1="71" x2="78" y2="71" stroke={library.stroke} strokeWidth="1" />
        {zones.find((z) => z.id === 'zone-library')?.riskLevel === 'high' && (
          <circle cx="60" cy="45" r="12" fill="#ef4444" className="risk-pulse" />
        )}
        <SensorBadge sensor={libSensor} x={13} y={56} />
        <LiveDot x={103} y={13} active={libSensor?.connected === true} />
      </g>

      {/* 穿堂 */}
      <g
        aria-label="穿堂"
        style={clickable}
        onClick={() => onZoneClick?.('zone-hall')}
      >
        <rect x="120" y="10" width="80" height="70" rx="8" fill={hall.fill} stroke={zoneStroke('zone-hall', hall.stroke)} strokeWidth={zoneStrokeWidth('zone-hall')} />
        <text x="160" y="49" textAnchor="middle" fontSize="12" fill="#065f46" fontWeight="700">穿堂</text>
        {zones.find((z) => z.id === 'zone-hall')?.riskLevel === 'high' && (
          <circle cx="160" cy="45" r="12" fill="#ef4444" className="risk-pulse" />
        )}
        <SensorBadge sensor={hallSensor} x={122} y={56} />
        <LiveDot x={193} y={13} active={hallSensor?.connected === true} />
      </g>

      {/* 操場 */}
      <g
        aria-label="操場"
        style={clickable}
        onClick={() => onZoneClick?.('zone-field')}
      >
        <rect x="300" y="10" width="90" height="200" rx="8" fill={field.fill} stroke={zoneStroke('zone-field', field.stroke)} strokeWidth={zoneStrokeWidth('zone-field')} />
        <text x="345" y="30" textAnchor="middle" fontSize="12" fill="#713f12" fontWeight="700">操場</text>
        <ellipse cx="345" cy="118" rx="34" ry="72" fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 3" />
        <ellipse cx="345" cy="118" rx="20" ry="52" fill="none" stroke="#fde68a" strokeWidth="1" />
        {zones.find((z) => z.id === 'zone-field')?.riskLevel === 'high' && (
          <circle cx="345" cy="118" r="12" fill="#ef4444" className="risk-pulse" />
        )}
      </g>

      {/* 走廊 */}
      <g aria-label="走廊">
        <rect x="10" y="88" width="280" height="22" rx="4" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
        <text x="145" y="103" textAnchor="middle" fontSize="10" fill="#64748b">走廊</text>
      </g>

      {/* 九年級教室 */}
      <g
        aria-label="九年級教室"
        style={clickable}
        onClick={() => onZoneClick?.('zone-classroom')}
      >
        <rect x="10" y="118" width="150" height="80" rx="8" fill={classroom.fill} stroke={zoneStroke('zone-classroom', classroom.stroke)} strokeWidth={zoneStrokeWidth('zone-classroom')} />
        <text x="85" y="154" textAnchor="middle" fontSize="12" fill="#4c1d95" fontWeight="700">九年級教室</text>
        <rect x="20" y="128" width="16" height="11" rx="2" fill="#c4b5fd" opacity="0.7" />
        <rect x="42" y="128" width="16" height="11" rx="2" fill="#c4b5fd" opacity="0.7" />
        <rect x="64" y="128" width="16" height="11" rx="2" fill="#c4b5fd" opacity="0.7" />
        <rect x="86" y="128" width="16" height="11" rx="2" fill="#c4b5fd" opacity="0.7" />
        <rect x="20" y="145" width="16" height="11" rx="2" fill="#c4b5fd" opacity="0.7" />
        <rect x="42" y="145" width="16" height="11" rx="2" fill="#c4b5fd" opacity="0.7" />
        <rect x="64" y="145" width="16" height="11" rx="2" fill="#c4b5fd" opacity="0.7" />
        <rect x="86" y="145" width="16" height="11" rx="2" fill="#c4b5fd" opacity="0.7" />
        <rect x="20" y="162" width="16" height="11" rx="2" fill="#c4b5fd" opacity="0.7" />
        <rect x="42" y="162" width="16" height="11" rx="2" fill="#c4b5fd" opacity="0.7" />
        <rect x="64" y="162" width="16" height="11" rx="2" fill="#c4b5fd" opacity="0.7" />
        <rect x="86" y="162" width="16" height="11" rx="2" fill="#c4b5fd" opacity="0.7" />
        {zones.find((z) => z.id === 'zone-classroom')?.riskLevel === 'high' && (
          <circle cx="85" cy="158" r="12" fill="#ef4444" className="risk-pulse" />
        )}
      </g>

      {/* 體育館 */}
      <g
        aria-label="體育館"
        style={clickable}
        onClick={() => onZoneClick?.('zone-gym')}
      >
        <rect x="170" y="118" width="120" height="80" rx="8" fill={gym.fill} stroke={zoneStroke('zone-gym', gym.stroke)} strokeWidth={zoneStrokeWidth('zone-gym')} />
        <text x="230" y="154" textAnchor="middle" fontSize="12" fill="#7c2d12" fontWeight="700">體育館</text>
        <rect x="180" y="130" width="100" height="55" rx="2" fill="none" stroke="#f97316" strokeWidth="1.5" />
        <circle cx="230" cy="157" r="14" fill="none" stroke="#f97316" strokeWidth="1.5" />
        <line x1="230" y1="130" x2="230" y2="185" stroke="#f97316" strokeWidth="1" />
        {zones.find((z) => z.id === 'zone-gym')?.riskLevel === 'high' && (
          <circle cx="230" cy="157" r="12" fill="#ef4444" className="risk-pulse" />
        )}
        <SensorBadge sensor={gymSensor} x={172} y={172} />
        <LiveDot x={283} y={121} active={gymSensor?.connected === true} />
      </g>

      {/* 右側走廊 */}
      <g aria-label="右側走廊">
        <rect x="295" y="10" width="5" height="200" rx="2" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.5" />
      </g>

      {/* 下方走廊 */}
      <g aria-label="下方走廊">
        <rect x="10" y="206" width="280" height="18" rx="4" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
        <text x="145" y="219" textAnchor="middle" fontSize="10" fill="#64748b">走廊</text>
      </g>

      {/* 餐廳 */}
      <g aria-label="餐廳">
        <rect x="10" y="232" width="280" height="60" rx="8" fill="#fce7f3" stroke="#f9a8d4" strokeWidth="1.5" />
        <text x="145" y="266" textAnchor="middle" fontSize="12" fill="#831843" fontWeight="700">餐廳</text>
        <circle cx="60" cy="255" r="10" fill="none" stroke="#f9a8d4" strokeWidth="1.5" />
        <circle cx="100" cy="255" r="10" fill="none" stroke="#f9a8d4" strokeWidth="1.5" />
        <circle cx="140" cy="255" r="10" fill="none" stroke="#f9a8d4" strokeWidth="1.5" />
        <circle cx="180" cy="255" r="10" fill="none" stroke="#f9a8d4" strokeWidth="1.5" />
        <circle cx="220" cy="255" r="10" fill="none" stroke="#f9a8d4" strokeWidth="1.5" />
      </g>

      {/* 操場入口 */}
      <g aria-label="操場延伸">
        <rect x="300" y="218" width="90" height="74" rx="8" fill="#fef9c3" stroke="#fde047" strokeWidth="1.5" />
        <text x="345" y="259" textAnchor="middle" fontSize="10" fill="#92400e">入口</text>
      </g>

      {/* 指北針 */}
      <g transform="translate(22,298)">
        <text textAnchor="middle" fontSize="9" fill="#94a3b8" y="-8">北</text>
        <line x1="0" y1="-6" x2="0" y2="6" stroke="#94a3b8" strokeWidth="1.5" />
        <line x1="-6" y1="0" x2="6" y2="0" stroke="#94a3b8" strokeWidth="1.5" />
        <polygon points="0,-6 -2,-1 2,-1" fill="#94a3b8" />
      </g>

      <text x="50" y="314" textAnchor="start" fontSize="8" fill="#94a3b8">示意圖，非按比例</text>
    </svg>
  );
}
```

- [ ] **Step 2: Update the CampusMapSvg call site in App.tsx**

Find the line `<CampusMapSvg zones={zones.map((z) => ({id: z.id, riskLevel: z.riskLevel, sensor: z.sensor}))} />` and replace with:

```tsx
<CampusMapSvg
  zones={zones.map((z) => ({id: z.id, riskLevel: z.riskLevel, sensor: z.sensor}))}
  selectedZoneId={selectedZone.id}
  onZoneClick={(zoneId) => {
    const zone = zones.find((z) => z.id === zoneId);
    if (zone) onSelectZone(zone);
  }}
/>
```

Note: `onSelectZone` is already a prop of the `CampusMap2D` function — confirm it's in scope. It is: `CampusMap2D` receives `onSelectZone` and `zones` as props, so `zones` and `onSelectZone` are accessible.

- [ ] **Step 3: Full verify**

```bash
cd "google ai studio/app_3（國中）/AI校園心靈守護者"
npm run check 2>&1 | tail -20
```

Expected: all tests pass, TypeScript clean, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add "google ai studio/app_3（國中）/AI校園心靈守護者/src/components/CampusMapSvg.tsx" \
        "google ai studio/app_3（國中）/AI校園心靈守護者/src/App.tsx"
git commit -m "feat(app3): zone click on map, live-sensor animation, humidity badge in CampusMapSvg"
```

---

## Task 10: Final full-stack verify

- [ ] **Step 1: Verify command catalog consistency**

```bash
cd "/Volumes/Tim aaddtional/Download/115資通訊/tedt"
node scripts/verify-command-catalog.mjs
```

Expected: `"ok": true`

- [ ] **Step 2: Verify App 1 bridge**

```bash
cd "google ai studio/app_1（國小）/AI自動板擦機器人"
npm run check 2>&1 | tail -10
```

Expected: build succeeds, API contract ok.

- [ ] **Step 3: Verify App 3**

```bash
cd "google ai studio/app_3（國中）/AI校園心靈守護者"
npm run check 2>&1 | tail -10
```

Expected: all 6 guardianAi tests pass, TypeScript clean, build succeeds.

- [ ] **Step 4: Final commit**

```bash
cd "/Volumes/Tim aaddtional/Download/115資通訊/tedt"
git add docs/superpowers/plans/
git commit -m "docs: add sensor-zone-integration implementation plan"
```
