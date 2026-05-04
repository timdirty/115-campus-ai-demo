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
