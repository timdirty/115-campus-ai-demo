// Resilient serial-port helper for the App 3 guardian bridge.
// - 自動偵測 Arduino-like 串口（R4 WiFi / Minima 都能配對）
// - 拔掉 USB / Arduino 重啟後會自動重連（exponential backoff）
// - Port busy 會嘗試清掉佔用者再重試一次
// - 解析 SENSORS:... 行給 zone 資料用
// - 對外暴露 health telemetry 給 /api/health 用

import {execSync} from 'node:child_process';
import {SerialPort} from 'serialport';
import {ReadlineParser} from '@serialport/parser-readline';

export interface PortInfo {
  path: string;
  manufacturer?: string;
  vendorId?: string;
  productId?: string;
}

export interface SensorSnapshot {
  temp: number | null;
  hum: number | null;
  light: number | null;
  receivedAt: string;
}

export interface BridgeTelemetry {
  connected: boolean;
  activePath: string | null;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
  lastError: string | null;
  reconnectAttempts: number;
}

const baudRate = 115200;
const requestedPath = process.env.ARDUINO_PORT?.trim() || undefined;

const RECONNECT_MIN_MS = 500;
const RECONNECT_MAX_MS = 8000;

let activePort: SerialPort | null = null;
let activePath: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = RECONNECT_MIN_MS;
let isOpening = false;
let cleanupAttempted = false;
let pendingSensorResolvers: Array<(value: SensorSnapshot) => void> = [];
let lastSensorSnapshot: SensorSnapshot | null = null;

type ConnectionChangeHandler = (connected: boolean, path: string | null) => void;
const connectionHandlers: ConnectionChangeHandler[] = [];

export function onConnectionChange(handler: ConnectionChangeHandler): void {
  connectionHandlers.push(handler);
}

function notifyConnectionChange(connected: boolean, path: string | null): void {
  for (const handler of connectionHandlers) {
    try { handler(connected, path); } catch { /* ignore */ }
  }
}

const telemetry: BridgeTelemetry = {
  connected: false,
  activePath: null,
  lastConnectedAt: null,
  lastDisconnectedAt: null,
  lastError: null,
  reconnectAttempts: 0,
};

export async function listPorts(): Promise<PortInfo[]> {
  const ports = await SerialPort.list();
  return ports.map((port) => ({
    path: port.path,
    manufacturer: port.manufacturer,
    vendorId: port.vendorId,
    productId: port.productId,
  }));
}

export function isArduinoLikePort(port: PortInfo) {
  const text = `${port.path} ${port.manufacturer ?? ''}`.toLowerCase();
  return text.includes('arduino') || text.includes('usbmodem') || text.includes('uno');
}

async function pickPortPath(): Promise<string | null> {
  if (requestedPath) return requestedPath;
  const ports = await listPorts();
  const match = ports.find(isArduinoLikePort);
  return match?.path ?? null;
}

export function getActivePath(): string | null {
  return activePath;
}

export function isConnected(): boolean {
  return Boolean(activePort?.isOpen);
}

export function getLastSensorSnapshot(): SensorSnapshot | null {
  return lastSensorSnapshot;
}

export function getTelemetry(): BridgeTelemetry {
  return {...telemetry, connected: isConnected(), activePath};
}

function parseSensorLine(line: string): SensorSnapshot | null {
  if (!line.startsWith('SENSORS:')) return null;
  const body = line.slice('SENSORS:'.length).trim();
  if (body === 'ERR' || body === 'NONE') {
    return {temp: null, hum: null, light: null, receivedAt: new Date().toISOString()};
  }
  const fields: Record<string, number> = {};
  for (const part of body.split(',')) {
    const [key, raw] = part.split(':');
    if (!key || raw == null) continue;
    const num = Number(raw);
    if (Number.isFinite(num)) fields[key.trim().toUpperCase()] = num;
  }
  return {
    temp: fields.TEMP ?? null,
    hum: fields.HUM ?? null,
    light: fields.LIGHT ?? null,
    receivedAt: new Date().toISOString(),
  };
}

function scheduleReconnect(reason: string) {
  if (activePort?.isOpen) return;
  if (reconnectTimer) return;
  telemetry.reconnectAttempts += 1;
  telemetry.lastError = reason;
  console.log(`[bridge] reconnect in ${reconnectDelay}ms (${reason})`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void tryAutoOpen();
  }, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
}

function attachListeners(port: SerialPort, parser: ReadlineParser) {
  parser.on('data', (raw: string) => {
    const line = raw.toString().trim();
    if (!line) return;
    process.stdout.write(`[arduino] ${line}\n`);
    const snapshot = parseSensorLine(line);
    if (snapshot) {
      lastSensorSnapshot = snapshot;
      const resolvers = pendingSensorResolvers;
      pendingSensorResolvers = [];
      for (const resolve of resolvers) resolve(snapshot);
    }
  });
  port.on('close', () => {
    if (activePort === port) {
      activePort = null;
      activePath = null;
      telemetry.connected = false;
      telemetry.activePath = null;
      telemetry.lastDisconnectedAt = new Date().toISOString();
      console.log('[bridge] arduino disconnected');
      notifyConnectionChange(false, null);
      scheduleReconnect('port closed');
    }
  });
  port.on('error', (error) => {
    console.error(`[arduino] port error: ${error.message}`);
    telemetry.lastError = error.message;
    if (activePort === port) {
      try {
        port.close(() => {});
      } catch {
        // ignore — close handler will fire scheduleReconnect
      }
    }
  });
}

function killPortHolders(portPath: string): boolean {
  try {
    const pids = execSync(`lsof -ti "${portPath}" 2>/dev/null`, {encoding: 'utf8'}).trim();
    if (!pids) return false;
    execSync(`kill -9 ${pids.split('\n').join(' ')} 2>/dev/null || true`);
    console.log(`[bridge] cleared stale holder(s) on ${portPath}: ${pids.replace(/\n/g, ' ')}`);
    return true;
  } catch {
    return false;
  }
}

async function openPortOnce(portPath: string): Promise<SerialPort> {
  const port = new SerialPort({path: portPath, baudRate, autoOpen: false});
  await new Promise<void>((resolve, reject) => {
    port.open((error) => (error ? reject(error) : resolve()));
  });
  const parser = port.pipe(new ReadlineParser({delimiter: '\n'}));
  attachListeners(port, parser);
  return port;
}

async function openPort(): Promise<SerialPort | null> {
  if (activePort?.isOpen) return activePort;
  if (isOpening) return null;
  isOpening = true;
  try {
    const portPath = await pickPortPath();
    if (!portPath) {
      telemetry.lastError = 'no Arduino-like serial port found';
      scheduleReconnect('no port detected');
      return null;
    }
    try {
      const port = await openPortOnce(portPath);
      activePort = port;
      activePath = portPath;
      telemetry.connected = true;
      telemetry.activePath = portPath;
      telemetry.lastConnectedAt = new Date().toISOString();
      telemetry.lastError = null;
      reconnectDelay = RECONNECT_MIN_MS;
      cleanupAttempted = false;
      console.log(`[bridge] connected to ${portPath}`);
      notifyConnectionChange(true, portPath);
      return port;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      telemetry.lastError = message;
      if (!cleanupAttempted && /resource busy|cannot lock|in use/i.test(message)) {
        cleanupAttempted = true;
        if (killPortHolders(portPath)) {
          try {
            const port = await openPortOnce(portPath);
            activePort = port;
            activePath = portPath;
            telemetry.connected = true;
            telemetry.activePath = portPath;
            telemetry.lastConnectedAt = new Date().toISOString();
            telemetry.lastError = null;
            reconnectDelay = RECONNECT_MIN_MS;
            console.log(`[bridge] connected after cleanup to ${portPath}`);
            notifyConnectionChange(true, portPath);
            return port;
          } catch (retryError) {
            telemetry.lastError = retryError instanceof Error ? retryError.message : String(retryError);
          }
        }
      }
      console.error(`[bridge] open failed: ${message}`);
      scheduleReconnect(message);
      return null;
    }
  } finally {
    isOpening = false;
  }
}

export async function sendCommand(command: string): Promise<{ok: boolean; message: string}> {
  if (process.env.DEMO_SIMULATE_HARDWARE === '1') {
    return {ok: true, message: `[SIM] ${command}`};
  }
  try {
    const port = await openPort();
    if (!port) {
      return {ok: false, message: telemetry.lastError ?? 'No Arduino available. Plug in the UNO R4 (WiFi or Minima) or set ARDUINO_PORT.'};
    }
    await new Promise<void>((resolve, reject) => {
      port.write(`${command}\n`, (error) => (error ? reject(error) : resolve()));
    });
    return {ok: true, message: `Sent ${command}`};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    telemetry.lastError = message;
    return {ok: false, message};
  }
}

export async function requestSensorRead(timeoutMs = 1500): Promise<SensorSnapshot | null> {
  if (process.env.DEMO_SIMULATE_HARDWARE === '1') {
    return {temp: 25.5, hum: 60, light: 512, receivedAt: new Date().toISOString()};
  }
  const port = await openPort().catch(() => null);
  if (!port) return null;

  const deferred = new Promise<SensorSnapshot>((resolve) => {
    pendingSensorResolvers.push(resolve);
  });

  await new Promise<void>((resolve) => {
    port.write('READ_SENSORS\n', () => resolve());
  });

  return Promise.race([
    deferred,
    new Promise<SensorSnapshot | null>((resolve) => setTimeout(() => resolve(lastSensorSnapshot), timeoutMs)),
  ]);
}

export async function tryAutoOpen(): Promise<boolean> {
  const port = await openPort();
  return Boolean(port?.isOpen);
}
