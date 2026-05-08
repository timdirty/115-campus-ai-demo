// App 3 standalone Arduino serial bridge.
// Self-contained: no dependency on App 1 / App 2 or any sibling project.
// Frontend (src/services/hardwareBridge.ts) talks to this on http://localhost:<BRIDGE_PORT>.

import {execSync} from 'node:child_process';
import {createServer} from 'node:http';
import express from 'express';
import {WebSocketServer, WebSocket} from 'ws';
import {
  getActivePath,
  getLastSensorSnapshot,
  getTelemetry,
  isArduinoLikePort,
  isConnected,
  listPorts,
  onConnectionChange,
  requestSensorRead,
  sendCommand,
  tryAutoOpen,
} from './serialPort';

function freeBridgePort(port: number) {
  try {
    const pids = execSync(`lsof -ti :${port} 2>/dev/null`, {encoding: 'utf8'}).trim();
    if (!pids) return;
    execSync(`kill -9 ${pids.split('\n').join(' ')} 2>/dev/null || true`);
    console.log(`[bridge] freed port ${port} from stale pid(s) ${pids.replace(/\n/g, ' ')}`);
  } catch {
    // nothing to free
  }
}

const bridgePort = Number(process.env.BRIDGE_PORT ?? 3203);
const sensorPollIntervalMs = Number(process.env.SENSOR_POLL_INTERVAL_MS ?? 5000);

interface ZoneSensorReading {
  zoneId: string;
  portPath?: string | null;
  temp: number | null;
  hum: number | null;
  light: number | null;
  connected: boolean;
  updatedAt: string;
}

const portZoneMap = new Map<string, string>();

type WsEvent =
  | {type: 'arduino_status'; connected: boolean; port: string; simulated: boolean}
  | {type: 'command_ack'; command: string; ok: boolean; response?: string}
  | {type: 'sensor_snapshot'; temp: number | null; hum: number | null; light: number | null};

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({server: httpServer});

function broadcast(event: WsEvent): void {
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

app.disable('x-powered-by');

app.use((req, res, next) => {
  const origin = req.get('origin') ?? '';
  if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  }
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

app.options('*', (_req, res) => res.sendStatus(204));
app.use(express.json({limit: '256kb'}));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    bridgePort,
    arduinoConnected: isConnected(),
    activePath: getActivePath(),
    uptimeSeconds: Math.round(process.uptime()),
    telemetry: getTelemetry(),
  });
});

app.get('/api/sensors/ports', async (_req, res) => {
  try {
    const detected = await listPorts();
    const arduinoLike = detected.filter(isArduinoLikePort);
    const ports = arduinoLike.map((p) => ({
      path: p.path,
      manufacturer: p.manufacturer ?? 'UNO R4 (WiFi/Minima)',
      assignedZone: portZoneMap.get(p.path) ?? null,
    }));
    res.json({ports});
  } catch (error) {
    res.status(500).json({error: error instanceof Error ? error.message : String(error)});
  }
});

app.post('/api/sensors/assign', (req, res) => {
  const {portPath, zoneId, unassign} = req.body ?? {};
  if (typeof portPath !== 'string' || !portPath) {
    return res.status(400).json({error: 'portPath required'});
  }
  if (unassign === true) {
    portZoneMap.delete(portPath);
    return res.json({ok: true, ports: serializeAssignments()});
  }
  if (typeof zoneId !== 'string' || !zoneId) {
    return res.status(400).json({error: 'zoneId required when assigning'});
  }
  // One zone per port; clear any previous assignment that mapped to this zoneId.
  for (const [existingPath, existingZone] of portZoneMap.entries()) {
    if (existingZone === zoneId) portZoneMap.delete(existingPath);
  }
  portZoneMap.set(portPath, zoneId);
  res.json({ok: true, ports: serializeAssignments()});
});

app.get('/api/sensors/live', async (_req, res) => {
  const snapshot = getLastSensorSnapshot() ?? (await requestSensorRead(1200));
  const activePath = getActivePath();
  const zones: ZoneSensorReading[] = [];
  if (activePath) {
    const zoneId = portZoneMap.get(activePath) ?? 'default';
    zones.push({
      zoneId,
      portPath: activePath,
      temp: snapshot?.temp ?? null,
      hum: snapshot?.hum ?? null,
      light: snapshot?.light ?? null,
      connected: isConnected(),
      updatedAt: snapshot?.receivedAt ?? new Date().toISOString(),
    });
  }
  res.json({zones});
});

app.post('/api/robot/command', async (req, res) => {
  const {command, source} = req.body ?? {};
  if (typeof command !== 'string' || !command.trim()) {
    return res.status(400).json({error: 'command required'});
  }
  const normalized = command.trim().toUpperCase();
  const result = await sendCommand(normalized);
  res.status(result.ok ? 200 : 503).json({
    ok: result.ok,
    response: result.ok ? `Sent ${normalized}` : undefined,
    error: result.ok ? undefined : result.message,
    source: typeof source === 'string' ? source : undefined,
  });
  broadcast({type: 'command_ack', command: normalized, ok: result.ok, response: result.ok ? `Sent ${normalized}` : result.message});
});

app.post('/api/robot/drive', async (req, res) => {
  const {command} = req.body ?? {};
  if (typeof command !== 'string' || !command.trim()) {
    return res.status(400).json({error: 'command required'});
  }
  const normalized = command.trim().toUpperCase();
  if (!/^(FORWARD|BACKWARD|LEFT|RIGHT|STOP|SPEED:\d+)$/.test(normalized)) {
    return res.status(400).json({error: `unsupported drive command: ${normalized}`});
  }
  const result = await sendCommand(normalized);
  res.status(result.ok ? 200 : 503).json({
    ok: result.ok,
    response: result.ok ? `Drive ${normalized}` : undefined,
    error: result.ok ? undefined : result.message,
  });
  broadcast({type: 'command_ack', command: normalized, ok: result.ok, response: result.ok ? `Drive ${normalized}` : result.message});
});

app.use('/api', (_req, res) => {
  res.status(404).json({error: 'API route not found'});
});

function serializeAssignments() {
  return Array.from(portZoneMap.entries()).map(([path, zone]) => ({path, assignedZone: zone}));
}

async function startSensorPolling() {
  while (true) {
    if (isConnected()) {
      const snap = await requestSensorRead(1500).catch(() => null);
      if (snap) {
        broadcast({type: 'sensor_snapshot', temp: snap.temp, hum: snap.hum, light: snap.light});
      }
    }
    await new Promise((resolve) => setTimeout(resolve, sensorPollIntervalMs));
  }
}

freeBridgePort(bridgePort);

httpServer.listen(bridgePort, () => {
  console.log(`[bridge] App 3 guardian serial bridge listening on http://localhost:${bridgePort}`);
  console.log(`[bridge] Baud rate: 115200`);
  void tryAutoOpen();
  void startSensorPolling();
});

httpServer.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[bridge] port ${bridgePort} already in use, exiting.`);
    process.exit(1);
  }
  console.error(`[bridge] server error: ${error.message}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`[bridge] received ${signal}, shutting down`);
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  });
}
