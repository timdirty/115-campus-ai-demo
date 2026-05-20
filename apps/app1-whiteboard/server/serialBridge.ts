import express from 'express';
import path from 'node:path';
import {access} from 'node:fs/promises';
import {createServer} from 'node:http';
import {WebSocketServer, WebSocket} from 'ws';
import {baudRate, bridgePort, distDir, isHardwareSimulationEnabled, nodeEnv} from './config';
import {registerRoutes} from './routes';
import {registerProxyRoutes} from './proxyRoutes';
import {startSensorPolling} from './sensorManager';
import {startEV3Manager} from './ev3Manager';
import {setBroadcast} from './wsBroadcast';
import {getActivePath, isArduinoLikePort, listPorts} from './robotService';

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
wss.on('connection', (ws) => {
  wsAlive.set(ws, true);
  ws.on('pong', () => wsAlive.set(ws, true));

  // Push current hardware status immediately so frontend doesn't wait for first command
  const sendStatus = async () => {
    const simulated = isHardwareSimulationEnabled();
    let port = getActivePath();
    let connected = !simulated && port !== '' && !port.startsWith('simulated://');
    if (!simulated && !connected) {
      try {
        const ports = await listPorts();
        const found = ports.find(isArduinoLikePort);
        if (found) { connected = true; port = found.path; }
      } catch { /* ignore */ }
    }
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({type: 'arduino_status', connected, port, simulated}), () => {});
    }
  };
  void sendStatus();
});
httpServer.on('close', () => clearInterval(wsKeepalive));

setBroadcast((event) => {
  const data = JSON.stringify(event);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data, (err) => { if (err) { /* ignore */ } });
    }
  }
});
const distIndex = path.join(distDir, 'index.html');

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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-AI-Mode, X-AI-Fallback, X-Proxy-Key');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), serial=(self)');
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

app.options('*', (_req, res) => {
  res.sendStatus(204);
});

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    if (nodeEnv !== 'test') {
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`);
    }
  });
  next();
});

app.use(express.json({limit: '24mb'}));
registerRoutes(app);
registerProxyRoutes(app);

app.use('/api', (_req, res) => {
  res.status(404).json({error: 'API route not found'});
});

async function registerStaticFrontend() {
  try {
    await access(distIndex);
    app.use(express.static(distDir, {
      etag: true,
      maxAge: nodeEnv === 'production' ? '1h' : 0,
    }));
    app.get('*', (_req, res) => {
      res.sendFile(distIndex);
    });
    return true;
  } catch {
    app.get('/', (_req, res) => {
      res.status(nodeEnv === 'production' ? 503 : 200).json({
        ok: nodeEnv !== 'production',
        message: nodeEnv === 'production'
          ? 'Production build not found. Run npm run build before npm run start.'
          : 'Bridge is running. Start Vite with npm run dev:web or run npm run build for single-server mode.',
      });
    });
    return false;
  }
}

await registerStaticFrontend();

// Keep bridge alive through non-fatal errors so demo doesn't crash mid-presentation
process.on('uncaughtException', (err) => {
  console.error('[bridge] uncaughtException (bridge stays up):', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[bridge] unhandledRejection (bridge stays up):', reason);
});

httpServer.listen(bridgePort, () => {
  console.log(`Arduino serial bridge listening on http://localhost:${bridgePort}`);
  console.log(`Baud rate: ${baudRate}`);
  console.log(`Mode: ${nodeEnv}`);
  if (nodeEnv !== 'test') {
    startSensorPolling().catch(console.error);
    startEV3Manager();
  }
});
