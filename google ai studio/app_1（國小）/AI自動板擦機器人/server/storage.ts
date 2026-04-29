import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dataDir, robotFile, taskLogFile} from './config';
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
