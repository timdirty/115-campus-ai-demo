import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {calibrationFile, dataDir, robotFile, taskLogFile} from './config';
import {defaultRobotStatus} from './defaults';
import type {RobotStatus, TaskLogItem} from './types';

export async function ensureDataDir() {
  await mkdir(dataDir, {recursive: true});
}

export async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  await ensureDataDir();
  try {
    const raw = await readFile(file, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    await writeJsonFile(file, fallback);
    return fallback;
  }
}

export async function writeJsonFile<T>(file: string, value: T) {
  await ensureDataDir();
  await writeFile(file, JSON.stringify(value, null, 2), 'utf8');
}

export async function updateRobotStatus(partial: Partial<RobotStatus>) {
  const current = await readJsonFile<RobotStatus>(robotFile, defaultRobotStatus);
  const next = {
    ...current,
    ...partial,
    lastUpdatedAt: new Date().toISOString(),
  };
  await writeJsonFile(robotFile, next);
  return next;
}

export async function appendTaskLog(item: Omit<TaskLogItem, 'id' | 'createdAt'>) {
  const current = await readJsonFile<TaskLogItem[]>(taskLogFile, []);
  const nextItem = {
    id: Date.now(),
    createdAt: new Date().toISOString(),
    ...item,
  };
  const next = [nextItem, ...current].slice(0, 80);
  await writeJsonFile(taskLogFile, next);
  return next;
}

export interface CalibrationCorner {
  x: number;
  y: number;
}

export interface CalibrationData {
  version: 1;
  topLeft: CalibrationCorner;
  topRight: CalibrationCorner;
  bottomRight: CalibrationCorner;
  bottomLeft: CalibrationCorner;
  savedAt: string;
}

const defaultCalibration: CalibrationData = {
  version: 1,
  topLeft: {x: 5, y: 5},
  topRight: {x: 95, y: 5},
  bottomRight: {x: 95, y: 95},
  bottomLeft: {x: 5, y: 95},
  savedAt: new Date().toISOString(),
};

export async function readCalibration(): Promise<CalibrationData> {
  const raw = await readJsonFile<unknown>(calibrationFile, defaultCalibration);
  if (
    typeof raw === 'object' && raw !== null &&
    'version' in raw && (raw as {version: unknown}).version === 1 &&
    'topLeft' in raw && 'topRight' in raw && 'bottomRight' in raw && 'bottomLeft' in raw
  ) {
    return raw as CalibrationData;
  }
  return defaultCalibration;
}

export async function saveCalibration(data: CalibrationData): Promise<void> {
  await writeJsonFile(calibrationFile, {...data, savedAt: new Date().toISOString()});
}
