// App 3 standalone Arduino serial bridge.
// Self-contained: no dependency on App 1 / App 2 or any sibling project.
// Frontend (src/services/hardwareBridge.ts) talks to this on http://localhost:<BRIDGE_PORT>.

import 'dotenv/config';
import {execSync, spawn} from 'node:child_process';
import {createServer, type IncomingMessage} from 'node:http';
import {networkInterfaces} from 'node:os';
import {fileURLToPath} from 'node:url';
import express from 'express';
import {WebSocketServer, WebSocket} from 'ws';
import {
  assignDrivePort,
  getActivePath,
  getDrivePortPath,
  getTelemetry,
  isConnected,
  isDrivePortConnected,
  isSensorPortConnected,
  listDrivePorts,
  listSensorPorts,
  onConnectionChange,
  requestAllSensorReads,
  sendCommand,
  sendDriveCommand,
  sendSensorCommand,
  tryAutoOpen,
} from './serialPort';
import {appendAlertLog, getAlertLogs, loadDrivePortAssignment, resetDemoData, saveDrivePortAssignment, savePortZoneAssignments} from './storage';
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPortHolderPids(port: number): string[] {
  try {
    const pids = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN 2>/dev/null`, {encoding: 'utf8'}).trim();
    return pids ? pids.split('\n').filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function freeBridgePort(port: number): Promise<void> {
  const pids = getPortHolderPids(port);
  if (pids.length === 0) return;

  execSync(`kill -9 ${pids.join(' ')} 2>/dev/null || true`);
  console.log(`[bridge] freed port ${port} from stale pid(s) ${pids.join(' ')}`);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (getPortHolderPids(port).length === 0) return;
    await sleep(50);
  }

  throw new Error(`port ${port} is still busy after cleanup`);
}

const bridgePort = Number(process.env.BRIDGE_PORT ?? 3203) || 3203;
const sensorPollIntervalMs = Number(process.env.SENSOR_POLL_INTERVAL_MS ?? 5000) || 5000;
const zoneAdvisorScript = fileURLToPath(new URL('./zone_advisor.py', import.meta.url));
const zoneAdvisorApiUrl = (process.env.ZONE_ADVISOR_API_URL || process.env.GEMINI_API_URL || process.env.GOOGLE_AI_STUDIO_API_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
const zoneAdvisorModel = process.env.ZONE_ADVISOR_MODEL || process.env.GEMINI_MODEL || process.env.GOOGLE_AI_MODEL || 'gemini-3.5-flash';
const zoneAdvisorApiKey = process.env.ZONE_ADVISOR_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_AI_STUDIO_API_KEY || '';

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

interface RobotAssignmentSnapshot {
  zoneId: string;
  zoneName: string;
  location: string;
  riskLevel: 'low' | 'medium' | 'high';
  statusLabel: string;
  stage: string;
  missionId: string | null;
  active: boolean;
  moving: boolean;
  travelStartedAt: string | null;
  travelEndsAt: string | null;
  fromZoneId: string | null;
  fromZoneName: string | null;
  fromLocation: string | null;
  updatedAt: string;
}

let latestRobotAssignment: RobotAssignmentSnapshot | null = null;

interface RobotEmotionEvent {
  id: string;
  zoneId: string;
  zoneName: string;
  location: string;
  emotion: string;
  emotionLabel: string;
  riskLevel: 'medium' | 'high';
  description: string;
  source: string;
  updatedAt: string;
}

const latestRobotEmotionEvents: RobotEmotionEvent[] = [];

interface ZoneAdvisorResult {
  ok: boolean;
  source: 'google-ai-studio' | 'ollama-gemma' | 'cloud-gemma' | 'fallback' | string;
  model: string | null;
  riskLevel: 'low' | 'medium' | 'high';
  statusLabel: string;
  confidence: number | null;
  summary: string;
  situations: string[];
  suggestions: string[];
  error?: string;
}

const zoneLedCommands: Record<ZoneAdvisorResult['riskLevel'], string> = {
  low: 'STATUS_LOW',
  medium: 'STATUS_MEDIUM',
  high: 'STATUS_HIGH',
};

type WsEvent =
  | {type: 'arduino_status'; connected: boolean; port: string; simulated: boolean}
  | {type: 'command_ack'; command: string; ok: boolean; response?: string}
  | {type: 'sensor_snapshot'; temp: number | null; hum: number | null; light: number | null}
  | ({type: 'guardian_snapshot'} & GuardianSnapshot)
  | ({type: 'robot_assignment'} & RobotAssignmentSnapshot)
  | ({type: 'robot_emotion_event'} & RobotEmotionEvent);

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
type DisplayClientInfo = {
  id: string;
  ip: string;
  userAgent: string;
  connectedAt: string;
  lastSeen: string;
};
const displayClientInfo = new WeakMap<WebSocket, DisplayClientInfo>();

function getRequestIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ip = (raw?.split(',')[0] || req.socket.remoteAddress || '').trim();
  return ip.replace(/^::ffff:/, '') || 'unknown';
}

function serializeDisplayClients(): DisplayClientInfo[] {
  return Array.from(displayClients)
    .filter((client) => client.readyState === WebSocket.OPEN)
    .map((client, index) => {
      const info = displayClientInfo.get(client);
      return info ?? {
        id: `frontend-${index + 1}`,
        ip: 'unknown',
        userAgent: 'unknown',
        connectedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      };
    });
}

wss.on('connection', (ws, req) => {
  wsAlive.set(ws, true);
  ws.send(JSON.stringify({type: 'arduino_status', connected: isConnected(), port: getActivePath() ?? '', simulated: false}), (err) => { if (err) { /* ignore */ } });
  if (req.url === '/display') {
    const connectedAt = new Date().toISOString();
    displayClientInfo.set(ws, {
      id: `frontend-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      ip: getRequestIp(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      connectedAt,
      lastSeen: connectedAt,
    });
    displayClients.add(ws);
    ws.send(JSON.stringify({type: 'display_ready'}));
    // Replay latest snapshot immediately so reconnecting iPad gets current state
    if (latestGuardianSnapshot) {
      ws.send(JSON.stringify({type: 'guardian_snapshot', ...latestGuardianSnapshot}), (err) => { if (err) { /* ignore */ } });
    }
    if (latestRobotAssignment) {
      ws.send(JSON.stringify({type: 'robot_assignment', ...latestRobotAssignment}), (err) => { if (err) { /* ignore */ } });
    }
    ws.on('close', () => {
      displayClients.delete(ws);
      displayClientInfo.delete(ws);
    });
  }
  ws.on('pong', () => {
    wsAlive.set(ws, true);
    const info = displayClientInfo.get(ws);
    if (info) info.lastSeen = new Date().toISOString();
  });
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

function fallbackZoneAdvisor(error: string): ZoneAdvisorResult {
  return {
    ok: true,
    source: 'fallback',
    model: null,
    riskLevel: 'medium',
    statusLabel: '注意',
    confidence: null,
    summary: 'AI 區域判讀暫時無法連線，請先依目前燈號與現場巡查結果處理。',
    situations: ['目前只能使用本機規則判讀，可能缺少完整語意分析。'],
    suggestions: ['確認已設定 GEMINI_API_KEY 或 GOOGLE_API_KEY，並檢查網路連線後重試。'],
    error,
  };
}

function findPortForZone(zoneId: string): string | null {
  for (const [portPath, assignedZoneId] of portZoneMap.entries()) {
    if (assignedZoneId === zoneId) return portPath;
  }
  return null;
}

async function syncZoneLed(zoneId: string, riskLevel: ZoneAdvisorResult['riskLevel']): Promise<void> {
  const portPath = findPortForZone(zoneId);
  if (!portPath) {
    console.warn(`[bridge] LED sync skipped: no sensor port assigned to ${zoneId}`);
    return;
  }
  const command = zoneLedCommands[riskLevel];
  const result = await sendSensorCommand(portPath, command);
  if (!result.ok) {
    console.warn(`[bridge] LED sync failed for ${zoneId} (${portPath}): ${result.message}`);
  }
}

function runZoneAdvisor(payload: unknown): Promise<ZoneAdvisorResult> {
  const pythonBin = process.env.PYTHON_BIN || process.env.PYTHON || 'python3';
  return new Promise((resolve) => {
    const child = spawn(pythonBin, [zoneAdvisorScript], {stdio: ['pipe', 'pipe', 'pipe']});
    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (result: ZoneAdvisorResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish(fallbackZoneAdvisor('zone advisor timeout'));
    }, 15000);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdin.on('error', () => {});
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => finish(fallbackZoneAdvisor(error.message)));
    child.on('close', () => {
      if (settled) return;
      try {
        const parsed = JSON.parse(stdout.trim()) as ZoneAdvisorResult;
        finish(parsed);
      } catch (error) {
        finish(fallbackZoneAdvisor(stderr.trim() || (error instanceof Error ? error.message : String(error))));
      }
    });
    child.stdin.end(JSON.stringify(payload ?? {}));
  });
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
  const isLan = /^http:\/\/((10\.\d{1,3}\.\d{1,3}\.\d{1,3})|(192\.168\.\d{1,3}\.\d{1,3})|(172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})):\d+$/.test(origin);
  const isAllowed = extraOrigins.includes(origin);
  if (isLocal || isLan || isAllowed) {
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
  const connectedSensors = Array.from(portZoneMap.keys()).filter(isSensorPortConnected).length;
  res.json({
    ok: true,
    bridgePort,
    arduinoConnected: isConnected(),
    activePath: getActivePath(),
    drivePortPath: getDrivePortPath(),
    driveConnected: isDrivePortConnected(),
    sensorPortLimit: 3,
    assignedSensorCount: portZoneMap.size,
    connectedSensorCount: connectedSensors,
    uptimeSeconds: Math.round(process.uptime()),
    telemetry: getTelemetry(),
  });
});

app.get('/api/llm/health', async (_req, res) => {
  if (!zoneAdvisorApiKey) {
    res.status(503).json({
      ok: false,
      provider: 'google-ai-studio',
      model: zoneAdvisorModel,
      baseUrl: zoneAdvisorApiUrl,
      error: 'GEMINI_API_KEY or GOOGLE_API_KEY is not configured',
    });
    return;
  }

  const endpoint = `${zoneAdvisorApiUrl}/models/${encodeURIComponent(zoneAdvisorModel)}:generateContent?key=${encodeURIComponent(zoneAdvisorApiKey)}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        contents: [{role: 'user', parts: [{text: 'Return exactly this JSON and nothing else: {"ok":true}'}]}],
        generationConfig: {temperature: 0, maxOutputTokens: 256, responseMimeType: 'application/json', thinkingConfig: {thinkingBudget: 0}},
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) {
      res.status(503).json({ok: false, provider: 'google-ai-studio', model: zoneAdvisorModel, error: `Gemini HTTP ${response.status}`});
      return;
    }
    const payload = await response.json().catch(() => null);
    const text = payload?.candidates?.[0]?.content?.parts?.map((part: {text?: string}) => part.text ?? '').join('').trim() ?? '';
    let parsed: {ok?: boolean} | null = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    if (parsed?.ok !== true) {
      res.status(503).json({
        ok: false,
        provider: 'google-ai-studio',
        model: zoneAdvisorModel,
        baseUrl: zoneAdvisorApiUrl,
        error: 'Gemini returned malformed health response',
      });
      return;
    }
    res.json({
      ok: true,
      provider: 'google-ai-studio',
      model: zoneAdvisorModel,
      baseUrl: zoneAdvisorApiUrl,
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      provider: 'google-ai-studio',
      model: zoneAdvisorModel,
      baseUrl: zoneAdvisorApiUrl,
      error: error instanceof Error && error.name === 'AbortError' ? 'Gemini health check timed out' : error instanceof Error ? error.message : String(error),
    });
  }
});

app.get('/api/sensors/ports', async (_req, res) => {
  try {
    const arduinoLike = await listSensorPorts();
    const ports = arduinoLike.map((p) => ({
      path: p.path,
      manufacturer: p.manufacturer ?? 'UNO R4 (WiFi/Minima)',
      assignedZone: portZoneMap.get(p.path) ?? null,
      assignedDrive: p.path === getDrivePortPath(),
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
  if (portPath === getDrivePortPath()) {
    return res.status(409).json({error: 'this port is assigned to the drive chassis'});
  }
  // One zone per port; clear any previous assignment that mapped to this zoneId.
  for (const [existingPath, existingZone] of portZoneMap.entries()) {
    if (existingZone === zoneId) portZoneMap.delete(existingPath);
  }
  portZoneMap.set(portPath, zoneId);
  void savePortZoneAssignments(Object.fromEntries(portZoneMap)).catch(() => {});
  res.json({ok: true, ports: serializeAssignments()});
});

app.get('/api/drive/ports', async (_req, res) => {
  try {
    const arduinoLike = await listDrivePorts();
    const assignedPath = getDrivePortPath();
    const ports = arduinoLike.map((p) => ({
      path: p.path,
      manufacturer: p.manufacturer ?? 'UNO R4 Minima / WiFi',
      assignedDrive: p.path === assignedPath,
      assignedZone: portZoneMap.get(p.path) ?? null,
      connected: p.path === assignedPath ? isDrivePortConnected() : false,
    }));
    res.json({ports, assignedPath, connected: isDrivePortConnected()});
  } catch (error) {
    res.status(500).json({error: error instanceof Error ? error.message : String(error)});
  }
});

app.post('/api/drive/assign', async (req, res) => {
  const {portPath, unassign} = req.body ?? {};
  const nextPath = unassign === true ? null : typeof portPath === 'string' && portPath.trim() ? portPath.trim() : null;
  if (unassign !== true && !nextPath) {
    return res.status(400).json({error: 'portPath required'});
  }

  if (nextPath) {
    portZoneMap.delete(nextPath);
    void savePortZoneAssignments(Object.fromEntries(portZoneMap)).catch(() => {});
  }

  const result = await assignDrivePort(nextPath);
  if (result.ok) {
    void saveDrivePortAssignment(nextPath).catch(() => {});
  }

  res.status(result.ok ? 200 : 503).json({
    ok: result.ok,
    assignedPath: getDrivePortPath(),
    connected: isDrivePortConnected(),
    response: result.ok ? result.message : undefined,
    error: result.ok ? undefined : result.message,
  });
});

app.post('/api/drive/test', async (_req, res) => {
  const result = await sendDriveCommand('MOTOR_TEST');
  res.status(result.ok ? 200 : 503).json({
    ok: result.ok,
    response: result.ok ? 'Drive motor test sent' : undefined,
    error: result.ok ? undefined : result.message,
  });
  broadcast({type: 'command_ack', command: 'MOTOR_TEST', ok: result.ok, response: result.ok ? 'Drive motor test sent' : result.message});
});

app.post('/api/sensors/assignments/reset', async (_req, res) => {
  portZoneMap.clear();
  res.json({ok: true, ports: serializeAssignments()});
});

app.post('/api/sensors/test', async (req, res) => {
  const {portPath} = req.body ?? {};
  if (typeof portPath !== 'string' || !portPath) {
    return res.status(400).json({error: 'portPath required'});
  }
  const result = await sendSensorCommand(portPath, 'LED_TEST');
  res.status(result.ok ? 200 : 503).json({
    ok: result.ok,
    response: result.ok ? `LED test sent to ${portPath}` : undefined,
    error: result.ok ? undefined : result.message,
  });
  broadcast({type: 'command_ack', command: 'LED_TEST', ok: result.ok, response: result.ok ? `Sensor LED test: ${portPath}` : result.message});
});

app.get('/api/sensors/live', async (_req, res) => {
  const snapshots = await requestAllSensorReads(1200);
  const zones: ZoneSensorReading[] = [];
  for (const [portPath, zoneId] of portZoneMap.entries()) {
    const snapshot = snapshots.get(portPath) ?? null;
    zones.push({
      zoneId,
      portPath,
      temp: snapshot?.temp ?? null,
      hum: snapshot?.hum ?? null,
      light: snapshot?.light ?? null,
      connected: Boolean(snapshot && (snapshot.temp !== null || snapshot.hum !== null || snapshot.light !== null)),
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
  if (!/^(FORWARD|BACKWARD|LEFT|RIGHT|STOP|HEARTBEAT|PATROL_START|ROBOT_RESUME|ROBOT_PAUSE|SPEED:\d+)$/.test(normalized)) {
    return res.status(400).json({error: `unsupported drive command: ${normalized}`});
  }
  const result = await sendDriveCommand(normalized);
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
  const {alertType, severity, zoneId, zoneName, category, className, studentAlias, message} = req.body ?? {};
  try {
    const context = {
      alertType: typeof alertType === 'string' ? alertType : undefined,
      severity: severity === 'high' || severity === 'medium' || severity === 'low' ? severity : undefined,
      zoneId: typeof zoneId === 'string' ? zoneId : undefined,
      zoneName: typeof zoneName === 'string' ? zoneName : undefined,
      category: typeof category === 'string' ? category : undefined,
      className: typeof className === 'string' ? className : undefined,
      studentAlias: typeof studentAlias === 'string' ? studentAlias : undefined,
      message: typeof message === 'string' ? message : undefined,
    };
    const result = await runZoneAdvisor({
      mode: 'care_advice',
      ...context,
      riskLevel: context.severity,
      location: context.zoneName,
    });
    if (!result.summary) {
      const fallback = await analyzeGuardianAlert(context);
      res.json({ok: true, reply: fallback.reply, source: fallback.source});
      return;
    }
    res.json({ok: true, reply: result.summary, source: result.source, model: result.model});
  } catch (error) {
    res.status(500).json({ok: false, error: error instanceof Error ? error.message : String(error)});
  }
});

app.post('/api/ai/zone-advisor', async (req, res) => {
  const payload = req.body ?? {};
  if (typeof payload.zoneId !== 'string' && typeof payload.zoneName !== 'string' && typeof payload.name !== 'string') {
    return res.status(400).json({ok: false, error: 'zoneId or zoneName required'});
  }
  const result = await runZoneAdvisor(payload);
  const shouldSyncLed = typeof payload.zoneId === 'string' && (payload.mode === 'status' || payload.mode == null);
  if (shouldSyncLed) {
    void syncZoneLed(payload.zoneId, result.riskLevel).catch((error) => {
      console.warn(`[bridge] LED sync error: ${error instanceof Error ? error.message : String(error)}`);
    });
  }
  res.json(result);
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
    await saveDrivePortAssignment(null);
    await assignDrivePort(null);
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

app.post('/api/display/robot-assignment', (req, res) => {
  const body = req.body as Partial<RobotAssignmentSnapshot>;
  if (!body || typeof body.zoneId !== 'string' || typeof body.zoneName !== 'string') {
    res.status(400).json({ok: false, error: 'zoneId and zoneName required'});
    return;
  }
  const riskLevel = body.riskLevel === 'high' || body.riskLevel === 'medium' || body.riskLevel === 'low'
    ? body.riskLevel
    : 'low';
  latestRobotAssignment = {
    zoneId: body.zoneId,
    zoneName: body.zoneName,
    location: typeof body.location === 'string' && body.location.trim() ? body.location.trim() : body.zoneName,
    riskLevel,
    statusLabel: typeof body.statusLabel === 'string' && body.statusLabel.trim()
      ? body.statusLabel.trim()
      : riskLevel === 'high' ? '高風險' : riskLevel === 'medium' ? '注意' : '安全',
    stage: typeof body.stage === 'string' && body.stage.trim() ? body.stage.trim() : '現場待命',
    missionId: typeof body.missionId === 'string' && body.missionId.trim() ? body.missionId.trim() : null,
    active: body.active === true,
    moving: body.moving === true,
    travelStartedAt: typeof body.travelStartedAt === 'string' && body.travelStartedAt.trim() ? body.travelStartedAt.trim() : null,
    travelEndsAt: typeof body.travelEndsAt === 'string' && body.travelEndsAt.trim() ? body.travelEndsAt.trim() : null,
    fromZoneId: typeof body.fromZoneId === 'string' && body.fromZoneId.trim() ? body.fromZoneId.trim() : null,
    fromZoneName: typeof body.fromZoneName === 'string' && body.fromZoneName.trim() ? body.fromZoneName.trim() : null,
    fromLocation: typeof body.fromLocation === 'string' && body.fromLocation.trim() ? body.fromLocation.trim() : null,
    updatedAt: new Date().toISOString(),
  };
  const payload = JSON.stringify({type: 'robot_assignment', ...latestRobotAssignment});
  let pushed = 0;
  for (const client of displayClients) {
    if (client.readyState === WebSocket.OPEN) { client.send(payload, (err) => { if (err) { /* ignore */ } }); pushed++; }
  }
  res.json({ok: true, pushed, assignment: latestRobotAssignment});
});

app.get('/api/display/robot-assignment', (_req, res) => {
  res.json(latestRobotAssignment ?? {ok: false, message: 'no robot assignment yet'});
});

app.post('/api/display/emotion-event', (req, res) => {
  const body = req.body as Partial<RobotEmotionEvent>;
  if (!body || typeof body.emotion !== 'string') {
    res.status(400).json({ok: false, error: 'emotion required'});
    return;
  }
  if (!latestRobotAssignment && (typeof body.zoneId !== 'string' || !body.zoneId.trim())) {
    res.status(409).json({ok: false, error: 'robot location not assigned'});
    return;
  }
  const riskLevel: RobotEmotionEvent['riskLevel'] = body.riskLevel === 'high' ? 'high' : 'medium';
  const event: RobotEmotionEvent = {
    id: typeof body.id === 'string' && body.id.trim() ? body.id.trim() : `robot-emotion-${Date.now().toString(36)}`,
    zoneId: typeof body.zoneId === 'string' && body.zoneId.trim() ? body.zoneId.trim() : latestRobotAssignment?.zoneId ?? '',
    zoneName: typeof body.zoneName === 'string' && body.zoneName.trim() ? body.zoneName.trim() : latestRobotAssignment?.zoneName ?? '',
    location: typeof body.location === 'string' && body.location.trim() ? body.location.trim() : latestRobotAssignment?.location ?? '',
    emotion: body.emotion.trim(),
    emotionLabel: typeof body.emotionLabel === 'string' && body.emotionLabel.trim() ? body.emotionLabel.trim() : body.emotion.trim(),
    riskLevel,
    description: typeof body.description === 'string' && body.description.trim()
      ? body.description.trim()
      : `機器人前端偵測到 ${body.emotion.trim()} 情緒，需要老師確認。`,
    source: typeof body.source === 'string' && body.source.trim() ? body.source.trim() : 'robot-display',
    updatedAt: new Date().toISOString(),
  };
  latestRobotEmotionEvents.unshift(event);
  latestRobotEmotionEvents.splice(50);
  const payload = JSON.stringify({type: 'robot_emotion_event', ...event});
  let pushed = 0;
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) { client.send(payload, (err) => { if (err) { /* ignore */ } }); pushed++; }
  }
  res.json({ok: true, pushed, event});
});

app.get('/api/display/emotion-events', (req, res) => {
  const sinceRaw = typeof req.query.since === 'string' ? req.query.since : '';
  const sinceTime = sinceRaw ? Date.parse(sinceRaw) : 0;
  const events = Number.isFinite(sinceTime) && sinceTime > 0
    ? latestRobotEmotionEvents.filter((event) => Date.parse(event.updatedAt) > sinceTime)
    : latestRobotEmotionEvents.slice(0, 20);
  res.json({ok: true, events});
});

// Robot face display info — returns LAN IP + full robot-display URL for QR generation
app.get('/api/display/info', (_req, res) => {
  const ip = getLanIp();
  const useHttps = process.env.VITE_DEV_HTTPS === '1' || process.env.VITE_DEV_HTTPS === 'true';
  const pairingPort = Number(process.env.HTTPS_PAIRING_PORT ?? 0);
  const vitePort = Number(process.env.VITE_PORT ?? (useHttps ? 3001 : 3000));
  const displayPort = useHttps && pairingPort ? pairingPort : vitePort;
  const protocol = useHttps ? 'https' : 'http';
  res.json({
    ok: true,
    ip,
    bridgePort,
    protocol,
    vitePort: displayPort,
    robotDisplayUrl: `${protocol}://${ip}:${displayPort}/robot-display.html`,
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
  const connectedClients = serializeDisplayClients();
  res.json({ok: true, clients: connectedClients.length, displays: connectedClients});
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
    const snapshots = await requestAllSensorReads(1500).catch(() => new Map());
    for (const snap of snapshots.values()) {
      if (snap) {
        broadcast({type: 'sensor_snapshot', temp: snap.temp, hum: snap.hum, light: snap.light});
      }
    }
    await new Promise((resolve) => setTimeout(resolve, sensorPollIntervalMs));
  }
}

async function startBridge() {
  await freeBridgePort(bridgePort);
  portZoneMap.clear();
  const savedDrivePort = await loadDrivePortAssignment().catch(() => null);
  if (savedDrivePort) {
    const result = await assignDrivePort(savedDrivePort);
    console.log(`[bridge] restored drive port ${savedDrivePort}: ${result.ok ? 'connected' : result.message}`);
  }

  httpServer.listen(bridgePort, () => {
    console.log(`[bridge] App 3 guardian serial bridge listening on http://localhost:${bridgePort}`);
    console.log(`[bridge] Baud rate: 115200`);
    void (async () => {
      await tryAutoOpen();
      await startSensorPolling();
    })();
    startEV3Manager();
    startSpikeManager();
  });
}

void startBridge().catch((error) => {
  console.error(`[bridge] startup failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
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
