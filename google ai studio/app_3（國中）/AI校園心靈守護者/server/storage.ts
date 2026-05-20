import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

const dataDir = path.join(process.cwd(), 'data');

export async function ensureDataDir(): Promise<void> {
  await mkdir(dataDir, {recursive: true});
}

export async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  await ensureDataDir();
  try {
    const raw = await readFile(file, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
    if (typeof fallback === 'object' && fallback !== null && typeof parsed !== 'object') return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonFile<T>(file: string, value: T): Promise<void> {
  await ensureDataDir();
  await writeFile(file, JSON.stringify(value, null, 2), 'utf8');
}

// --- Data types ---

export interface AlertLogEntry {
  id: number;
  createdAt: string;
  zoneId: string;
  alertType: string;
  severity: 'high' | 'medium' | 'low';
  message?: string;
  resolved: boolean;
}

const alertLogFile = path.join(dataDir, 'alert-log.json');
const assignmentsFile = path.join(dataDir, 'sensor-assignments.json');
const driveAssignmentFile = path.join(dataDir, 'drive-assignment.json');

export async function appendAlertLog(entry: Omit<AlertLogEntry, 'id' | 'createdAt'>): Promise<AlertLogEntry[]> {
  const current = await readJsonFile<AlertLogEntry[]>(alertLogFile, []);
  const next: AlertLogEntry[] = [
    {id: Date.now(), createdAt: new Date().toISOString(), ...entry},
    ...current,
  ].slice(0, 200);
  await writeJsonFile(alertLogFile, next);
  return next;
}

export async function getAlertLogs(): Promise<AlertLogEntry[]> {
  return readJsonFile<AlertLogEntry[]>(alertLogFile, []);
}

export async function loadPortZoneAssignments(): Promise<Record<string, string>> {
  return readJsonFile<Record<string, string>>(assignmentsFile, {});
}

export async function savePortZoneAssignments(assignments: Record<string, string>): Promise<void> {
  await writeJsonFile(assignmentsFile, assignments);
}

export async function clearPortZoneAssignments(): Promise<void> {
  await writeJsonFile(assignmentsFile, {});
}

export async function loadDrivePortAssignment(): Promise<string | null> {
  const payload = await readJsonFile<{portPath?: string | null}>(driveAssignmentFile, {});
  return typeof payload.portPath === 'string' && payload.portPath.trim() ? payload.portPath.trim() : null;
}

export async function saveDrivePortAssignment(portPath: string | null): Promise<void> {
  await writeJsonFile(driveAssignmentFile, {portPath});
}

export async function resetDemoData(): Promise<void> {
  await writeJsonFile(alertLogFile, []);
  await writeJsonFile(assignmentsFile, {});
}
