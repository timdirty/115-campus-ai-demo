import path from 'node:path';
import {SerialPort} from 'serialport';
import {baudRate, dataDir} from './config';
import {getActivePath, isArduinoLikePort, listPorts} from './robotService';
import {readJsonFile, writeJsonFile} from './storage';
import type {PortInfo} from './types';

const POLL_INTERVAL_MS = 5_000;
const READ_TIMEOUT_MS = 2_000;
const ASSIGNMENTS_FILE = path.join(dataDir, 'sensor-assignments.json');
const CANONICAL_ZONE_IDS = ['zone-library', 'zone-hall', 'zone-classroom', 'zone-gym', 'zone-field'];

export interface ZoneSensorReading {
  zoneId: string;
  portPath: string | null;
  temp: number | null;
  hum: number | null;
  light: number | null;
  connected: boolean;
  updatedAt: string;
}

export interface DetectedPort {
  path: string;
  manufacturer?: string;
  assignedZone: string | null;
}

const portCache = new Map<string, SerialPort>();
const sensorCache = new Map<string, ZoneSensorReading>();
const zoneAssignments = new Map<string, string>(); // zoneId → portPath
let lastDetectedPorts: PortInfo[] = [];
let saveChain: Promise<void> = Promise.resolve();

async function loadAssignments(): Promise<void> {
  const saved = await readJsonFile<Record<string, string>>(ASSIGNMENTS_FILE, {});
  zoneAssignments.clear();
  for (const [zoneId, portPath] of Object.entries(saved)) {
    if (CANONICAL_ZONE_IDS.includes(zoneId)) {
      zoneAssignments.set(zoneId, portPath);
    }
  }
}

function saveAssignments(): Promise<void> {
  const snapshot = Object.fromEntries(zoneAssignments);
  saveChain = saveChain.then(() => writeJsonFile(ASSIGNMENTS_FILE, snapshot));
  return saveChain;
}

function parseSensorLine(raw: string): {temp: number; hum: number; light: number} | null {
  const match = raw.match(/SENSORS:TEMP:([\d.]+),HUM:(\d+),LIGHT:(\d+)/);
  if (!match) return null;
  return {temp: parseFloat(match[1]), hum: parseInt(match[2], 10), light: parseInt(match[3], 10)};
}

async function openPort(portPath: string): Promise<SerialPort> {
  const existing = portCache.get(portPath);
  if (existing?.isOpen) return existing;

  const port = new SerialPort({path: portPath, baudRate, autoOpen: false});
  await new Promise<void>((resolve, reject) => {
    port.open((err) => (err ? reject(err) : resolve()));
  });
  port.on('data', (data: Buffer) => {
    process.stdout.write(`[sensor:${portPath}] ${data.toString()}`);
  });
  const cleanup = () => portCache.delete(portPath);
  port.on('error', cleanup);
  port.on('close', cleanup);
  portCache.set(portPath, port);
  return port;
}

function waitForSensorResponse(port: SerialPort): Promise<string> {
  return new Promise<string>((resolve) => {
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
    }, READ_TIMEOUT_MS);
    port.on('data', onData);
  });
}

async function readSensorFromPort(portPath: string): Promise<{temp: number | null; hum: number | null; light: number | null; connected: boolean}> {
  try {
    const port = await openPort(portPath);
    const responsePromise = waitForSensorResponse(port);
    await new Promise<void>((resolve, reject) => {
      port.write('READ_SENSORS\n', (err) => {
        if (err) reject(err);
        else port.drain((drainErr) => (drainErr ? reject(drainErr) : resolve()));
      });
    });
    const raw = await responsePromise;
    const parsed = parseSensorLine(raw);
    return {
      temp: parsed?.temp ?? null,
      hum: parsed?.hum ?? null,
      light: parsed?.light ?? null,
      connected: parsed !== null,
    };
  } catch {
    portCache.delete(portPath);
    return {temp: null, hum: null, light: null, connected: false};
  }
}

async function scanArduinoPorts(): Promise<PortInfo[]> {
  // Also fall back to ARDUINO_PORT env var before the robot port is opened
  const robotPath = getActivePath() || (process.env.ARDUINO_PORT ?? '');
  const all = await listPorts().catch(() => [] as PortInfo[]);
  return all.filter(isArduinoLikePort).filter((p) => !robotPath || p.path !== robotPath);
}

async function pollSensors(): Promise<void> {
  const detected = await scanArduinoPorts();
  const detectedPaths = detected.map((p) => p.path);
  lastDetectedPorts = detected;

  // Close ports that disappeared
  for (const [portPath, sp] of portCache.entries()) {
    if (!detectedPaths.includes(portPath) && sp.isOpen) {
      sp.close(() => {});
      portCache.delete(portPath);
    }
  }

  // Open newly detected ports (best effort)
  for (const port of detected) {
    if (!portCache.has(port.path)) {
      openPort(port.path).catch(() => {});
    }
  }

  // Read sensors for assigned zones
  for (const [zoneId, portPath] of zoneAssignments.entries()) {
    if (!detectedPaths.includes(portPath)) {
      sensorCache.set(zoneId, {
        zoneId,
        portPath,
        temp: null,
        hum: null,
        light: null,
        connected: false,
        updatedAt: new Date().toISOString(),
      });
      continue;
    }
    const reading = await readSensorFromPort(portPath);
    sensorCache.set(zoneId, {
      ...reading,
      zoneId,
      portPath,
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function startSensorPolling(): Promise<void> {
  await loadAssignments();
  const runPoll = async () => {
    try {
      await pollSensors();
    } catch (err) {
      console.error('[sensorManager] poll error:', err);
    }
    setTimeout(runPoll, POLL_INTERVAL_MS);
  };
  runPoll();
}

export function getAllDetectedPorts(): DetectedPort[] {
  const reverseMap = new Map<string, string>();
  for (const [zoneId, portPath] of zoneAssignments.entries()) {
    reverseMap.set(portPath, zoneId);
  }
  return lastDetectedPorts.map((p) => ({
    path: p.path,
    manufacturer: p.manufacturer,
    assignedZone: reverseMap.get(p.path) ?? null,
  }));
}

export function getLiveZoneReadings(): ZoneSensorReading[] {
  return Array.from(sensorCache.values());
}

export async function assignPortToZone(portPath: string, zoneId: string): Promise<void> {
  if (!lastDetectedPorts.some((p) => p.path === portPath)) {
    throw new Error(`Port ${portPath} not in detected ports`);
  }
  if (!CANONICAL_ZONE_IDS.includes(zoneId)) {
    throw new Error(`Invalid zone ID: ${zoneId}`);
  }
  // Remove existing mappings for this port or zone
  for (const [z, p] of zoneAssignments.entries()) {
    if (p === portPath || z === zoneId) zoneAssignments.delete(z);
  }
  zoneAssignments.set(zoneId, portPath);
  await saveAssignments();
}

export async function unassignPort(portPath: string): Promise<void> {
  for (const [z, p] of zoneAssignments.entries()) {
    if (p === portPath) zoneAssignments.delete(z);
  }
  await saveAssignments();
}
