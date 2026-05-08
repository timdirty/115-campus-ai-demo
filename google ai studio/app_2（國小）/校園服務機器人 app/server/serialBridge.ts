// App 2 standalone Arduino serial bridge.
// Self-contained: no dependency on App 1 / App 3 or any sibling project.
// Frontend (src/services/hardwareBridge.ts) talks to this on http://localhost:<BRIDGE_PORT>.

import {createServer} from 'node:http';
import {execSync} from 'node:child_process';
import express from 'express';
import {WebSocketServer, WebSocket} from 'ws';
import {getActivePath, getTelemetry, isConnected, onConnectionChange, sendCommand, tryAutoOpen} from './serialPort';
import {analyzeDeliveryTask, isGeminiConfigured} from './aiService';
import {appendDeliveryLog, appendTaskLog, getRecentDeliveryLogs, getRecentTaskLogs, resetDemoData} from './storage';

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

const bridgePort = Number(process.env.BRIDGE_PORT ?? 3202);

const app = express();
app.disable('x-powered-by');

type WsEvent =
  | {type: 'arduino_status'; connected: boolean; port: string; simulated: boolean}
  | {type: 'command_ack'; command: string; ok: boolean; response?: string};

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

app.get('/api/ready', (_req, res) => {
  res.json({
    ok: true,
    arduino: isConnected(),
    ai: isGeminiConfigured(),
    bridge_port: bridgePort,
  });
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
    if (typeof command === 'string' && command.trim()) {
      const normalized = command.trim().toUpperCase();
      const result = await sendCommand(normalized);
      broadcast({type: 'command_ack', command: normalized, ok: result.ok});
      await appendDeliveryLog({
        command: normalized,
        destination: typeof destination === 'string' ? destination : undefined,
        status: result.ok ? 'sent' : 'failed',
        message: result.message,
      });
    }
    res.json({ok: true, logs});
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

app.use('/api', (_req, res) => {
  res.status(404).json({error: 'API route not found'});
});

freeBridgePort(bridgePort);

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

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`[bridge] received ${signal}, shutting down`);
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  });
}
