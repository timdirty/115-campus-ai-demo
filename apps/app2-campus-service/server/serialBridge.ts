// App 2 standalone Arduino serial bridge.
// Self-contained: no dependency on App 1 / App 3 or any sibling project.
// Frontend (src/services/hardwareBridge.ts) talks to this on http://localhost:<BRIDGE_PORT>.

import {createServer} from 'node:http';
import {execSync} from 'node:child_process';
import {networkInterfaces} from 'node:os';
import express from 'express';
import {WebSocketServer, WebSocket} from 'ws';
import {getActivePath, getTelemetry, isConnected, onConnectionChange, sendCommand, tryAutoOpen} from './serialPort';
import {analyzeDeliveryTask, checkAiAccess, classifyVisionScene, estimateClassroomAttendance, generateDispatchRecommendation, generateStudentReport, generateTeacherReply, getAiErrorInfo, getAiModelName, isGeminiConfigured} from './aiService';
import {appendDeliveryLog, appendTaskLog, getRecentDeliveryLogs, getRecentTaskLogs, resetDemoData} from './storage';
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

const bridgePort = Number(process.env.BRIDGE_PORT ?? 3202) || 3202;

const app = express();
app.disable('x-powered-by');

type WsEvent =
  | {type: 'arduino_status'; connected: boolean; port: string; simulated: boolean}
  | {type: 'command_ack'; command: string; ok: boolean; response?: string};

type DisplayEmotion =
  | 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised'
  | 'love' | 'sleepy' | 'cool' | 'thinking' | 'wink' | 'excited' | 'crying';

type DisplayCuePayload = {
  emotion?: string;
  mission?: string;
  status?: string;
  message?: string;
  source?: string;
  command?: string;
};

const displayEmotions = new Set<DisplayEmotion>([
  'neutral', 'happy', 'sad', 'angry', 'surprised',
  'love', 'sleepy', 'cool', 'thinking', 'wink', 'excited', 'crying',
]);

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
    ws.on('close', () => displayClients.delete(ws));
  } else {
    ws.send(JSON.stringify({type: 'arduino_status', connected: isConnected(), port: getActivePath() ?? '', simulated: false}));
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

function sendToDisplayClients(payload: unknown): number {
  const data = JSON.stringify(payload);
  let sent = 0;
  for (const client of displayClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
      sent += 1;
    }
  }
  return sent;
}

function cleanDisplayText(input: unknown, fallback: string, maxLength: number): string {
  const text = typeof input === 'string' ? input.replace(/\s+/g, ' ').trim() : '';
  return (text || fallback).slice(0, maxLength);
}

function getDisplayWebPort(origin: string): number {
  try {
    const parsed = new URL(origin);
    const port = Number(parsed.port);
    if (port) return port;
  } catch {
    // Fall back to env/default below.
  }
  return Number(process.env.VITE_PORT ?? 3000) || 3000;
}

onConnectionChange((connected, path) => {
  broadcast({type: 'arduino_status', connected, port: path ?? '', simulated: false});
});

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

// Timeout middleware: command/task endpoints must respond within 6s
app.use('/api/robot', (req, res, next) => {
  if (req.method !== 'POST') { next(); return; }
  const t = setTimeout(() => {
    if (!res.headersSent) res.status(503).json({ok: false, error: 'request timeout — bridge busy'});
  }, 6000);
  res.on('finish', () => clearTimeout(t));
  next();
});

app.options('*', (_req, res) => res.sendStatus(204));
app.use(express.json({limit: '4mb'})); // vision-classify sends base64 JPEG; 320px @ q0.6 ≈ 40-120 kb but allow headroom

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

app.post('/api/robot/command', async (req, res) => {
  const {command, source} = req.body ?? {};
  if (typeof command !== 'string' || !command.trim()) {
    return res.status(400).json({error: 'command required'});
  }
  const normalized = command.trim().toUpperCase();
  const result = await sendCommand(normalized);
  if (res.headersSent) return;
  res.status(result.ok ? 200 : 503).json({
    ok: result.ok,
    response: result.ok ? `Sent ${normalized}` : undefined,
    error: result.ok ? undefined : result.message,
    source: typeof source === 'string' ? source : undefined,
  });
  broadcast({type: 'command_ack', command: normalized, ok: result.ok, response: result.ok ? `Sent ${normalized}` : result.message});
});

app.get('/api/ready', (_req, res) => {
  res.json({
    ok: true,
    arduino: isConnected(),
    ai: isGeminiConfigured(),
    aiModel: getAiModelName(),
    bridge_port: bridgePort,
  });
});

app.get('/api/ai/status', async (_req, res) => {
  const status = await checkAiAccess();
  res.status(status.ok ? 200 : 503).json(status);
});

app.post('/api/robot/task', async (req, res) => {
  const {taskType, description, destination, command} = req.body ?? {};
  if (typeof taskType !== 'string' || !taskType) {
    return res.status(400).json({error: 'taskType required'});
  }
  try {
    const logs = await appendTaskLog({
      taskType,
      description: typeof description === 'string' ? description : taskType,
      status: 'pending',
    });
    let commandOk: boolean | null = null;
    if (typeof command === 'string' && command.trim()) {
      const normalized = command.trim().toUpperCase();
      const result = await sendCommand(normalized);
      commandOk = result.ok;
      broadcast({type: 'command_ack', command: normalized, ok: result.ok});
      await appendDeliveryLog({
        command: normalized,
        destination: typeof destination === 'string' ? destination : undefined,
        status: result.ok ? 'sent' : 'failed',
        message: result.message,
      });
    }
    res.json({ok: true, logs, commandOk});
  } catch (error) {
    res.status(500).json({ok: false, error: error instanceof Error ? error.message : String(error)});
  }
});

app.post('/api/ai/campus', async (req, res) => {
  const {command, destination, taskDescription, userMessage} = req.body ?? {};
  try {
    const result = await analyzeDeliveryTask({
      command: typeof command === 'string' ? command : undefined,
      destination: typeof destination === 'string' ? destination : undefined,
      taskDescription: typeof taskDescription === 'string' ? taskDescription : undefined,
      userMessage: typeof userMessage === 'string' ? userMessage : undefined,
    });
    res.json({ok: true, reply: result.reply, source: result.source});
  } catch (error) {
    res.status(500).json({ok: false, error: error instanceof Error ? error.message : String(error)});
  }
});

app.post('/api/ai/vision-classify', async (req, res) => {
  const {imageBase64} = req.body ?? {};
  if (typeof imageBase64 !== 'string' || imageBase64.length < 100) {
    res.status(400).json({ok: false, error: 'imageBase64 required'});
    return;
  }
  try {
    const result = await classifyVisionScene(imageBase64);
    res.json({ok: true, ...result});
  } catch (error) {
    const info = getAiErrorInfo(error);
    res.status(info.statusCode).json({
      ok: false,
      error: info.message,
      errorCode: info.code,
      model: getAiModelName(),
    });
  }
});

app.post('/api/ai/teacher-reply', async (req, res) => {
  const {question, subject} = req.body ?? {};
  if (typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ok: false, error: 'question required'});
  }
  try {
    const result = await generateTeacherReply(question, typeof subject === 'string' ? subject : undefined);
    if (!result.reply) return res.status(503).json({ok: false, error: 'AI 暫時不可用', fallback: true});
    res.json({ok: true, reply: result.reply, source: result.source});
  } catch (error) {
    res.status(500).json({ok: false, error: error instanceof Error ? error.message : String(error)});
  }
});

app.post('/api/ai/dispatch-recommend', async (req, res) => {
  const {zone, taskType} = req.body ?? {};
  if (typeof zone !== 'string' || !zone.trim()) {
    return res.status(400).json({ok: false, error: 'zone required'});
  }
  try {
    const result = await generateDispatchRecommendation(zone, typeof taskType === 'string' ? taskType : 'patrol');
    if (!result.recommendation) return res.status(503).json({ok: false, error: 'AI 暫時不可用', fallback: true});
    res.json({ok: true, recommendation: result.recommendation, source: result.source});
  } catch (error) {
    res.status(500).json({ok: false, error: error instanceof Error ? error.message : String(error)});
  }
});

app.post('/api/ai/student-report', async (req, res) => {
  const {name, data} = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ok: false, error: 'name required'});
  }
  try {
    const result = await generateStudentReport(name, typeof data === 'object' && data ? data : {});
    if (!result.report) return res.status(503).json({ok: false, error: 'AI 暫時不可用', fallback: true});
    res.json({ok: true, report: result.report, source: result.source});
  } catch (error) {
    res.status(500).json({ok: false, error: error instanceof Error ? error.message : String(error)});
  }
});

app.post('/api/ai/classroom-scan', async (req, res) => {
  const {imageBase64} = req.body ?? {};
  if (typeof imageBase64 !== 'string' || imageBase64.length < 100) {
    res.status(400).json({ok: false, error: 'imageBase64 required'});
    return;
  }
  try {
    const result = await estimateClassroomAttendance(imageBase64);
    res.json({ok: true, ...result});
  } catch (error) {
    const info = getAiErrorInfo(error);
    res.status(info.statusCode).json({ok: false, error: info.message, errorCode: info.code, model: getAiModelName()});
  }
});

app.get('/api/logs', async (_req, res) => {
  try {
    const [deliveryLogs, taskLogs] = await Promise.all([getRecentDeliveryLogs(), getRecentTaskLogs()]);
    res.json({ok: true, deliveryLogs, taskLogs});
  } catch (error) {
    res.status(500).json({ok: false, error: error instanceof Error ? error.message : String(error)});
  }
});

app.post('/api/ops/reset', async (_req, res) => {
  try {
    await resetDemoData();
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

// Robot face display info — returns LAN IP + full robot-display URL for QR generation
app.get('/api/display/info', (req, res) => {
  const ip = getLanIp();
  const vitePort = getDisplayWebPort(req.get('origin') ?? '');
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
  if (!emotion || typeof emotion !== 'string' || !displayEmotions.has(emotion as DisplayEmotion)) {
    res.status(400).json({ok: false, error: 'invalid emotion'});
    return;
  }
  const sent = sendToDisplayClients({type: 'display_emotion', emotion});
  res.json({ok: true, emotion, clients: sent});
});

app.post('/api/display/cue', (req, res) => {
  const body = req.body as DisplayCuePayload;
  const emotion = displayEmotions.has(body.emotion as DisplayEmotion) ? body.emotion as DisplayEmotion : 'neutral';
  const cue = {
    type: 'display_cue',
    emotion,
    mission: cleanDisplayText(body.mission, '展示待命', 18),
    status: cleanDisplayText(body.status, '等待下一步', 24),
    message: cleanDisplayText(body.message, '我準備好了，請照順序展示。', 80),
    source: cleanDisplayText(body.source, 'system', 18),
    command: cleanDisplayText(body.command, 'DISPLAY_CUE', 32),
  };
  const sent = sendToDisplayClients(cue);
  res.json({ok: true, cue, clients: sent});
});

app.get('/api/display/status', (_req, res) => {
  res.json({ok: true, clients: displayClients.size});
});

app.use('/api', (_req, res) => {
  res.status(404).json({error: 'API route not found'});
});

freeBridgePort(bridgePort);

httpServer.listen(bridgePort, () => {
  console.log(`[bridge] App 2 service-robot serial bridge listening on http://localhost:${bridgePort}`);
  console.log(`[bridge] Baud rate: 115200`);
  void tryAutoOpen();
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
    console.log(`[bridge] received ${signal}, shutting down`);
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  });
}
