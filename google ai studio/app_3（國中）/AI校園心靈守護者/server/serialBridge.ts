// App 3 standalone Arduino serial bridge.
// Self-contained: no dependency on App 1 / App 2 or any sibling project.
// Frontend (src/services/hardwareBridge.ts) talks to this on http://localhost:<BRIDGE_PORT>.

import {execSync} from 'node:child_process';
import {createServer} from 'node:http';
import {networkInterfaces} from 'node:os';
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
import {appendAlertLog, getAlertLogs, loadPortZoneAssignments, resetDemoData, savePortZoneAssignments} from './storage';
import {analyzeGuardianAlert, isGeminiConfigured} from './aiService';
import {getEV3Status, sendEV3Command, startEV3Manager} from './ev3Manager';
import {getSpikeStatus, sendSpikeCommand, startSpikeManager} from './spikeManager';

function getLanIp(): string {
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

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

const bridgePort = Number(process.env.BRIDGE_PORT ?? 3203) || 3203;
const sensorPollIntervalMs = Number(process.env.SENSOR_POLL_INTERVAL_MS ?? 5000) || 5000;

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

interface GuardianSnapshot {
  emotion: string;
  stress: number;
  stability: number;
  focus: number;
  fusionScore: number;
  signals: {moodScore: number; soundScore: number; nodeScore: number; alertScore: number};
  riskScore: number;
  riskLabel: string;
  moodLabel: string;
  robotActive: boolean;
  updatedAt: string;
}

let latestGuardianSnapshot: GuardianSnapshot | null = null;

type WsEvent =
  | {type: 'arduino_status'; connected: boolean; port: string; simulated: boolean}
  | {type: 'command_ack'; command: string; ok: boolean; response?: string}
  | {type: 'sensor_snapshot'; temp: number | null; hum: number | null; light: number | null}
  | {type: 'guardian_snapshot'} & GuardianSnapshot;

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({server: httpServer});

// Server-side keepalive: terminate ghost connections within 2 ping cycles (~50s)
const wsAlive = new WeakMap<WebSocket, boolean>();
const wsKeepalive = setInterval(() => {
  for (const ws of wss.clients) {
    if (wsAlive.get(ws) === false) { ws.terminate(); continue; }
    wsAlive.set(ws, false);
    ws.ping();
  }
}, 25000);

// Robot face display clients (iPad on robot, connected via LAN WebSocket)
const displayClients = new Set<WebSocket>();

wss.on('connection', (ws, req) => {
  wsAlive.set(ws, true);
  ws.on('pong', () => wsAlive.set(ws, true));
  if (req.url === '/display') {
    displayClients.add(ws);
    ws.send(JSON.stringify({type: 'display_ready'}));
    // Replay latest snapshot immediately so reconnecting iPad gets current state
    if (latestGuardianSnapshot) {
      ws.send(JSON.stringify({type: 'guardian_snapshot', ...latestGuardianSnapshot}), (err) => { if (err) { /* ignore */ } });
    }
    ws.on('close', () => displayClients.delete(ws));
  }
});
httpServer.on('close', () => clearInterval(wsKeepalive));

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

const ALLOWED_ORIGINS_ENV = process.env.ALLOWED_ORIGINS ?? '';
const extraOrigins = ALLOWED_ORIGINS_ENV ? ALLOWED_ORIGINS_ENV.split(',').map((s) => s.trim()) : [];

app.use((req, res, next) => {
  const origin = req.get('origin') ?? '';
  const isLocal = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  const isAllowed = extraOrigins.includes(origin);
  if (isLocal || isAllowed) {
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

// Timeout middleware: command endpoints must respond within 6s
app.use('/api/robot', (req, res, next) => {
  if (req.method !== 'POST') { next(); return; }
  const t = setTimeout(() => {
    if (!res.headersSent) res.status(503).json({ok: false, error: 'request timeout — bridge busy'});
  }, 6000);
  res.on('finish', () => clearTimeout(t));
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
    void savePortZoneAssignments(Object.fromEntries(portZoneMap)).catch(() => {});
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
  void savePortZoneAssignments(Object.fromEntries(portZoneMap)).catch(() => {});
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

app.get('/api/ready', (_req, res) => {
  res.json({
    ok: true,
    arduino: isConnected(),
    ai: isGeminiConfigured(),
    bridge_port: bridgePort,
  });
});

app.post('/api/ai/guardian', async (req, res) => {
  const {alertType, severity, zoneId, zoneName, message} = req.body ?? {};
  try {
    const result = await analyzeGuardianAlert({
      alertType: typeof alertType === 'string' ? alertType : undefined,
      severity: severity === 'high' || severity === 'medium' || severity === 'low' ? severity : undefined,
      zoneId: typeof zoneId === 'string' ? zoneId : undefined,
      zoneName: typeof zoneName === 'string' ? zoneName : undefined,
      message: typeof message === 'string' ? message : undefined,
    });
    res.json({ok: true, reply: result.reply, source: result.source});
  } catch (error) {
    res.status(500).json({ok: false, error: error instanceof Error ? error.message : String(error)});
  }
});

app.get('/api/logs/alerts', async (_req, res) => {
  try {
    const logs = await getAlertLogs();
    res.json({ok: true, logs});
  } catch (error) {
    res.status(500).json({ok: false, error: error instanceof Error ? error.message : String(error)});
  }
});

app.post('/api/logs/alerts', async (req, res) => {
  const {zoneId, alertType, severity, message} = req.body ?? {};
  if (typeof zoneId !== 'string' || !zoneId) {
    return res.status(400).json({error: 'zoneId required'});
  }
  try {
    const logs = await appendAlertLog({
      zoneId,
      alertType: typeof alertType === 'string' ? alertType : 'unknown',
      severity: severity === 'high' || severity === 'medium' ? severity : 'low',
      message: typeof message === 'string' ? message : undefined,
      resolved: false,
    });
    res.json({ok: true, logs});
  } catch (error) {
    res.status(500).json({ok: false, error: error instanceof Error ? error.message : String(error)});
  }
});

app.post('/api/ops/reset', async (_req, res) => {
  try {
    await resetDemoData();
    portZoneMap.clear();
    res.json({ok: true, message: 'Demo data reset'});
  } catch (error) {
    res.status(500).json({ok: false, error: error instanceof Error ? error.message : String(error)});
  }
});

// EV3 endpoints
app.get('/api/ev3/status', (_req, res) => res.json(getEV3Status()));
app.post('/api/ev3/command', async (req, res) => {
  const command = String(req.body?.command ?? '').trim().toUpperCase();
  if (!command) { res.status(400).json({ok: false, error: 'command required'}); return; }
  const result = await sendEV3Command(command);
  res.json(result);
});

// SPIKE Prime endpoints
app.get('/api/spike/status', (_req, res) => res.json(getSpikeStatus()));
app.post('/api/spike/command', async (req, res) => {
  const command = String(req.body?.command ?? '').trim().toUpperCase();
  if (!command) { res.status(400).json({ok: false, error: 'command required'}); return; }
  const result = await sendSpikeCommand(command);
  res.json(result);
});

// Guardian snapshot — App3 pushes real state; bridge stores + replays to display clients
app.post('/api/display/guardian-snapshot', (req, res) => {
  const snap = req.body as Partial<GuardianSnapshot>;
  if (!snap || typeof snap.emotion !== 'string') {
    res.status(400).json({ok: false, error: 'invalid snapshot'});
    return;
  }
  latestGuardianSnapshot = {
    emotion: snap.emotion,
    stress: typeof snap.stress === 'number' ? snap.stress : 0,
    stability: typeof snap.stability === 'number' ? snap.stability : 100,
    focus: typeof snap.focus === 'number' ? snap.focus : 75,
    fusionScore: typeof snap.fusionScore === 'number' ? snap.fusionScore : 0,
    signals: snap.signals ?? {moodScore: 0, soundScore: 0, nodeScore: 0, alertScore: 0},
    riskScore: typeof snap.riskScore === 'number' ? snap.riskScore : 0,
    riskLabel: typeof snap.riskLabel === 'string' ? snap.riskLabel : '低風險',
    moodLabel: typeof snap.moodLabel === 'string' ? snap.moodLabel : '未簽到',
    robotActive: snap.robotActive === true,
    updatedAt: new Date().toISOString(),
  };
  const payload = JSON.stringify({type: 'guardian_snapshot', ...latestGuardianSnapshot});
  let pushed = 0;
  for (const client of displayClients) {
    if (client.readyState === WebSocket.OPEN) { client.send(payload, (err) => { if (err) { /* ignore */ } }); pushed++; }
  }
  res.json({ok: true, pushed});
});

app.get('/api/display/guardian-snapshot', (_req, res) => {
  res.json(latestGuardianSnapshot ?? {ok: false, message: 'no snapshot yet'});
});

// Robot face display info — returns LAN IP + full robot-display URL for QR generation
app.get('/api/display/info', (_req, res) => {
  const ip = getLanIp();
  const vitePort = Number(process.env.VITE_PORT ?? 3000);
  res.json({
    ok: true,
    ip,
    bridgePort,
    robotDisplayUrl: `http://${ip}:${vitePort}/robot-display.html?bridge=${ip}:${bridgePort}`,
  });
});

// Robot face display: push emotion to all connected iPad display clients
app.post('/api/display/emotion', (req, res) => {
  const {emotion} = req.body as {emotion?: string};
  if (!emotion || typeof emotion !== 'string') {
    res.status(400).json({ok: false, error: 'missing emotion'});
    return;
  }
  const data = JSON.stringify({type: 'display_emotion', emotion});
  let sent = 0;
  for (const client of displayClients) {
    if (client.readyState === WebSocket.OPEN) { client.send(data); sent++; }
  }
  res.json({ok: true, emotion, clients: sent});
});

app.get('/api/display/status', (_req, res) => {
  res.json({ok: true, clients: displayClients.size});
});

app.use('/api', (_req, res) => {
  res.status(404).json({error: 'API route not found'});
});

function serializeAssignments() {
  return Array.from(portZoneMap.entries()).map(([path, zone]) => ({path, assignedZone: zone}));
}

let pollingActive = false;

async function startSensorPolling() {
  pollingActive = true;
  while (pollingActive) {
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

// Load persisted zone assignments into portZoneMap
loadPortZoneAssignments().then((saved) => {
  for (const [port, zone] of Object.entries(saved)) {
    portZoneMap.set(port, zone);
  }
}).catch(() => {});

httpServer.listen(bridgePort, () => {
  console.log(`[bridge] App 3 guardian serial bridge listening on http://localhost:${bridgePort}`);
  console.log(`[bridge] Baud rate: 115200`);
  void tryAutoOpen();
  void startSensorPolling();
  startEV3Manager();
  startSpikeManager();
});

httpServer.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[bridge] port ${bridgePort} already in use, exiting.`);
    process.exit(1);
  }
  console.error(`[bridge] server error: ${error.message}`);
});

process.on('uncaughtException', (err) => {
  console.error('[bridge] uncaughtException (bridge stays up):', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[bridge] unhandledRejection (bridge stays up):', reason);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    pollingActive = false;
    console.log(`[bridge] received ${signal}, shutting down`);
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  });
}
