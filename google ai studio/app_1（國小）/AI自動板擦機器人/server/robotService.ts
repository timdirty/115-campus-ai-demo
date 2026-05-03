import {SerialPort} from 'serialport';
import {baudRate} from './config';
import {taskActions} from './defaults';
import {appendTaskLog, updateRobotStatus} from './storage';
import type {PortInfo} from './types';

let activePort: SerialPort | null = null;
let activePath = process.env.ARDUINO_PORT ?? '';

export function getActivePath() {
  return activePath;
}

export function resolveTaskCommand(action: string, regionId?: string) {
  const normalizedAction = action.trim().toLowerCase();
  const normalizedRegion = (regionId || '').trim().toUpperCase();

  if (normalizedAction === 'erase') {
    return taskActions.erase[(normalizedRegion || 'ALL') as keyof typeof taskActions.erase];
  }
  if (normalizedAction === 'keep') {
    return taskActions.keep[normalizedRegion as keyof typeof taskActions.keep];
  }
  if (normalizedAction in taskActions) {
    const actionMap = taskActions[normalizedAction as keyof typeof taskActions] as {DEFAULT?: string};
    return actionMap.DEFAULT;
  }
  return undefined;
}

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

async function choosePortPath(requestedPath?: string) {
  if (requestedPath) {
    // Reject obviously non-hardware ports passed from the frontend
    if (/debug-console|bluetooth/i.test(requestedPath)) {
      const ports = await listPorts();
      const likelyArduino = ports.find(isArduinoLikePort);
      if (likelyArduino) return likelyArduino.path;
    }
    return requestedPath;
  }

  if (activePath) {
    return activePath;
  }

  const ports = await listPorts();
  const likelyArduino = ports.find(isArduinoLikePort);

  if (!likelyArduino) {
    throw new Error('No Arduino-like serial port found. Set ARDUINO_PORT or plug in the UNO R4 WiFi.');
  }

  return likelyArduino.path;
}

async function getPort(requestedPath?: string) {
  const path = await choosePortPath(requestedPath);

  if (activePort?.isOpen && activePath === path) {
    return activePort;
  }

  if (activePort?.isOpen) {
    await new Promise<void>((resolve, reject) => {
      activePort?.close((error) => (error ? reject(error) : resolve()));
    });
  }

  activePath = path;
  activePort = new SerialPort({path, baudRate, autoOpen: false});

  await new Promise<void>((resolve, reject) => {
    activePort?.open((error) => (error ? reject(error) : resolve()));
  });

  activePort.on('data', (data) => {
    process.stdout.write(`[arduino] ${data.toString()}`);
  });

  return activePort;
}

async function waitForSerialResponse(port: SerialPort, timeoutMs = 1800) {
  return new Promise<string>((resolve) => {
    let buffer = '';
    const cleanup = () => {
      clearTimeout(timer);
      port.off('data', onData);
    };
    const finish = () => {
      cleanup();
      resolve(buffer.trim());
    };
    const onData = (data: Buffer) => {
      buffer += data.toString();
      if (buffer.includes('\n')) {
        finish();
      }
    };
    const timer = setTimeout(finish, timeoutMs);
    port.on('data', onData);
  });
}

export async function sendSerialCommandDrive(command: string, requestedPath?: string) {
  const port = await getPort(requestedPath);
  await new Promise<void>((resolve, reject) => {
    port.write(`${command}\n`, (error) => (error ? reject(error) : resolve()));
  });
  return {port: activePath};
}

export async function sendSerialCommand(command: string, requestedPath?: string) {
  const port = await getPort(requestedPath);
  const responsePromise = waitForSerialResponse(port);

  await new Promise<void>((resolve, reject) => {
    port.write(`${command}\n`, (error) => {
      if (error) {
        reject(error);
        return;
      }

      port.drain((drainError) => (drainError ? reject(drainError) : resolve()));
    });
  });

  return {port: activePath, response: await responsePromise};
}

function parseSensorLine(raw: string): {temp: number; hum: number; light: number} | null {
  const match = raw.match(/SENSORS:TEMP:([\d.]+),HUM:(\d+),LIGHT:(\d+)/);
  if (!match) return null;
  return {temp: parseFloat(match[1]), hum: parseInt(match[2], 10), light: parseInt(match[3], 10)};
}

export async function readRobotSensors(): Promise<{
  temp: number | null;
  hum: number | null;
  light: number | null;
  connected: boolean;
}> {
  try {
    const {response} = await sendSerialCommand('READ_SENSORS');
    const parsed = parseSensorLine(response);
    return {
      temp: parsed?.temp ?? null,
      hum: parsed?.hum ?? null,
      light: parsed?.light ?? null,
      connected: parsed !== null,
    };
  } catch {
    return {temp: null, hum: null, light: null, connected: false};
  }
}

export async function recordUnsupportedTask(command: string, source: string, message: string) {
  const status = await updateRobotStatus({
    connected: Boolean(activePath),
    activePort: activePath,
    lastCommand: command,
    lastResponse: message,
  });
  const taskLog = await appendTaskLog({command, source, ok: false, message});
  return {status, taskLog};
}
