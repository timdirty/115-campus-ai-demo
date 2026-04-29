import {access, mkdir, readdir, readFile, unlink, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {constants} from 'node:fs';
import {backupsDir, baudRate, bridgePort, chatFile, classroomFile, dataDir, distDir, nodeEnv, notesFile, robotFile, taskLogFile} from './config';
import {defaultClassroomSession, defaultNotes, defaultRobotStatus, createNote} from './defaults';
import {ApiError} from './http';
import {normalizeBoardRegions} from './aiService';
import {ensureDataDir, readJsonFile, writeJsonFile} from './storage';
import type {ChatMessage, ClassroomSession, RobotStatus, TaskLogItem, TeacherPace, WhiteboardNote} from './types';

const exportSchemaVersion = 1;
const maxImportNotes = 1000;
const maxImportMessages = 2000;
const maxImportTaskLogItems = 500;

export type AppDataExport = {
  schemaVersion: number;
  app: 'ai-whiteboard-assistant';
  exportedAt: string;
  notes: WhiteboardNote[];
  chat: ChatMessage[];
  classroomSession: ClassroomSession;
  robotStatus: RobotStatus;
  taskLog: TaskLogItem[];
};

export type ReadyStatus = {
  ok: boolean;
  generatedAt: string;
  environment: string;
  bridgePort: number;
  baudRate: number;
  dataDir: string;
  geminiConfigured: boolean;
  storage: {
    writable: boolean;
    message: string;
  };
  staticBuild: {
    available: boolean;
    indexHtml: string;
    assetCount: number;
  };
  checks: Array<{
    name: string;
    ok: boolean;
    message: string;
  }>;
};

export type ImportResult = {
  ok: boolean;
  importedAt: string;
  counts: {
    notes?: number;
    chat?: number;
    taskLog?: number;
  };
  updated: string[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function optionalString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function normalizePace(value: unknown): TeacherPace {
  return value === 'review_needed' || value === 'slow_down' || value === 'normal' ? value : 'normal';
}

function normalizePercent(value: unknown, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(0, Math.min(100, numeric));
}

function sanitizeNotes(value: unknown): WhiteboardNote[] {
  if (!Array.isArray(value)) {
    throw new ApiError(400, 'notes must be an array');
  }
  if (value.length > maxImportNotes) {
    throw new ApiError(413, `notes import limit is ${maxImportNotes}`);
  }

  return value.map((item, index) => {
    if (!isObject(item)) {
      throw new ApiError(400, `notes[${index}] must be an object`);
    }

    const title = optionalString(item.title).trim();
    const subject = optionalString(item.subject).trim();
    const content = optionalString(item.content).trim();
    if (!title || !subject || !content) {
      throw new ApiError(400, `notes[${index}] requires title, subject, and content`);
    }

    return createNote({
      ...item,
      id: Number.isFinite(Number(item.id)) ? Number(item.id) : undefined,
      title,
      subject,
      content,
      period: optionalString(item.period, '即時紀錄'),
      desc: optionalString(item.desc, content.slice(0, 80)),
      ocrText: optionalString(item.ocrText, content),
      transcript: optionalString(item.transcript, '尚未匯入老師講解逐字稿。'),
      keywords: Array.isArray(item.keywords) ? item.keywords.map(String).slice(0, 20) : undefined,
      boardRegions: normalizeBoardRegions(item.boardRegions),
      aiRecommendation: optionalString(item.aiRecommendation),
      linkedTaskIds: Array.isArray(item.linkedTaskIds) ? item.linkedTaskIds.map(Number).filter(Number.isFinite) : [],
      date: optionalString(item.date),
      time: optionalString(item.time),
      createdAt: optionalString(item.createdAt) || undefined,
    });
  });
}

function sanitizeChat(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) {
    throw new ApiError(400, 'chat must be an array');
  }
  if (value.length > maxImportMessages) {
    throw new ApiError(413, `chat import limit is ${maxImportMessages}`);
  }

  return value.map((item, index) => {
    if (!isObject(item)) {
      throw new ApiError(400, `chat[${index}] must be an object`);
    }

    const role = item.role === 'user' ? 'user' : 'ai';
    const text = optionalString(item.text).trim();
    if (!text) {
      throw new ApiError(400, `chat[${index}] requires text`);
    }

    return {
      id: optionalString(item.id, `import-${Date.now()}-${index}`),
      role,
      text,
    };
  });
}

function sanitizeClassroomSession(value: unknown): ClassroomSession {
  if (!isObject(value)) {
    throw new ApiError(400, 'classroomSession must be an object');
  }

  return {
    ...defaultClassroomSession,
    focusPercent: normalizePercent(value.focusPercent, defaultClassroomSession.focusPercent),
    confusedPercent: normalizePercent(value.confusedPercent, defaultClassroomSession.confusedPercent),
    tiredPercent: normalizePercent(value.tiredPercent, defaultClassroomSession.tiredPercent),
    teacherPace: normalizePace(value.teacherPace),
    savedMinutes: Number.isFinite(Number(value.savedMinutes)) ? Number(value.savedMinutes) : defaultClassroomSession.savedMinutes,
    currentRecommendation: optionalString(value.currentRecommendation, defaultClassroomSession.currentRecommendation),
    boardRegions: normalizeBoardRegions(value.boardRegions),
    lastCaptureAt: optionalString(value.lastCaptureAt) || undefined,
    updatedAt: new Date().toISOString(),
  };
}

function sanitizeTaskLog(value: unknown): TaskLogItem[] {
  if (!Array.isArray(value)) {
    throw new ApiError(400, 'taskLog must be an array');
  }
  if (value.length > maxImportTaskLogItems) {
    throw new ApiError(413, `taskLog import limit is ${maxImportTaskLogItems}`);
  }

  return value.map((item, index) => {
    if (!isObject(item)) {
      throw new ApiError(400, `taskLog[${index}] must be an object`);
    }

    return {
      id: Number.isFinite(Number(item.id)) ? Number(item.id) : Date.now() + index,
      command: optionalString(item.command, 'IMPORTED_RECORD'),
      source: optionalString(item.source, 'import'),
      ok: Boolean(item.ok),
      message: optionalString(item.message, 'Imported task log item'),
      createdAt: optionalString(item.createdAt) || new Date().toISOString(),
    };
  });
}

async function checkStorageWritable() {
  const probePath = path.join(dataDir, `.write-check-${process.pid}-${Date.now()}.tmp`);
  try {
    await ensureDataDir();
    await writeFile(probePath, 'ok', 'utf8');
    await unlink(probePath).catch(() => undefined);
    return {writable: true, message: 'data directory is writable'};
  } catch (error) {
    return {writable: false, message: error instanceof Error ? error.message : String(error)};
  }
}

async function checkStaticBuild() {
  const indexHtml = path.join(distDir, 'index.html');
  try {
    await access(indexHtml, constants.R_OK);
    const assetsDir = path.join(distDir, 'assets');
    const assets = await readdir(assetsDir).catch(() => []);
    return {available: true, indexHtml, assetCount: assets.length};
  } catch {
    return {available: false, indexHtml, assetCount: 0};
  }
}

export async function getReadyStatus(geminiConfigured: boolean): Promise<ReadyStatus> {
  const [storage, staticBuild] = await Promise.all([checkStorageWritable(), checkStaticBuild()]);
  const staticOk = nodeEnv === 'production' ? staticBuild.available : true;
  const checks = [
    {name: 'storage', ok: storage.writable, message: storage.message},
    {
      name: 'static-build',
      ok: staticOk,
      message: staticBuild.available ? 'dist build is available' : 'dist build not found; run npm run build before production start',
    },
  ];

  return {
    ok: checks.every((check) => check.ok),
    generatedAt: new Date().toISOString(),
    environment: nodeEnv,
    bridgePort,
    baudRate,
    dataDir,
    geminiConfigured,
    storage,
    staticBuild,
    checks,
  };
}

export async function buildAppExport(): Promise<AppDataExport> {
  const [notes, chat, classroomSession, robotStatus, taskLog] = await Promise.all([
    readJsonFile<WhiteboardNote[]>(notesFile, defaultNotes),
    readJsonFile<ChatMessage[]>(chatFile, []),
    readJsonFile<ClassroomSession>(classroomFile, defaultClassroomSession),
    readJsonFile<RobotStatus>(robotFile, defaultRobotStatus),
    readJsonFile<TaskLogItem[]>(taskLogFile, []),
  ]);

  return {
    schemaVersion: exportSchemaVersion,
    app: 'ai-whiteboard-assistant',
    exportedAt: new Date().toISOString(),
    notes,
    chat,
    classroomSession: {
      ...classroomSession,
      boardRegions: normalizeBoardRegions(classroomSession.boardRegions),
    },
    robotStatus,
    taskLog,
  };
}

export async function writeBackupFile() {
  const payload = await buildAppExport();
  await mkdir(backupsDir, {recursive: true});
  const timestamp = payload.exportedAt.replace(/[:.]/g, '-');
  const filename = `whiteboard-backup-${timestamp}.json`;
  const filePath = path.join(backupsDir, filename);
  await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return {
    ok: true,
    backup: {
      filePath,
      filename,
      exportedAt: payload.exportedAt,
      notes: payload.notes.length,
      chat: payload.chat.length,
    },
  };
}

export async function importAppData(payload: unknown): Promise<ImportResult> {
  if (!isObject(payload)) {
    throw new ApiError(400, 'import payload must be an object');
  }

  const updated: string[] = [];
  const counts: ImportResult['counts'] = {};
  const writes: Array<Promise<void>> = [];

  if ('notes' in payload) {
    const notes = sanitizeNotes(payload.notes);
    counts.notes = notes.length;
    updated.push('notes');
    writes.push(writeJsonFile(notesFile, notes));
  }

  if ('chat' in payload) {
    const chat = sanitizeChat(payload.chat);
    counts.chat = chat.length;
    updated.push('chat');
    writes.push(writeJsonFile(chatFile, chat));
  }

  if ('classroomSession' in payload) {
    const session = sanitizeClassroomSession(payload.classroomSession);
    updated.push('classroomSession');
    writes.push(writeJsonFile(classroomFile, session));
  }

  if ('taskLog' in payload) {
    const taskLog = sanitizeTaskLog(payload.taskLog);
    counts.taskLog = taskLog.length;
    updated.push('taskLog');
    writes.push(writeJsonFile(taskLogFile, taskLog));
  }

  if (updated.length === 0) {
    throw new ApiError(400, 'import payload must include notes, chat, classroomSession, or taskLog');
  }

  await Promise.all(writes);
  return {
    ok: true,
    importedAt: new Date().toISOString(),
    counts,
    updated,
  };
}
