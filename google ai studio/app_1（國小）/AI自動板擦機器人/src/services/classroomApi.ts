import {apiRequest} from './apiClient';

export type BoardRegionStatus = 'keep' | 'erasable' | 'erased';
export type TeacherPace = 'normal' | 'slow_down' | 'review_needed';

export type BoardRegion = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  status: BoardRegionStatus;
  reason: string;
};

export type ClassroomSession = {
  focusPercent: number;
  confusedPercent: number;
  tiredPercent: number;
  teacherPace: TeacherPace;
  savedMinutes: number;
  currentRecommendation: string;
  boardRegions: BoardRegion[];
  lastCaptureAt?: string;
  updatedAt: string;
};

export type RobotStatus = {
  connected: boolean;
  activePort: string;
  lastCommand: string;
  lastResponse: string;
  lastUpdatedAt: string;
};

export type TaskLogItem = {
  id: number;
  command: string;
  source: string;
  ok: boolean;
  message: string;
  createdAt: string;
};

export type BridgeHealth = {
  ok: boolean;
  bridgePort: number;
  baudRate: number;
  dataDir: string;
  geminiConfigured: boolean;
};

export type ReadyStatus = BridgeHealth & {
  generatedAt: string;
  environment: string;
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

export type AppDataExport = {
  schemaVersion: number;
  app: string;
  exportedAt: string;
  notes: unknown[];
  chat: unknown[];
  classroomSession: ClassroomSession;
  robotStatus?: RobotStatus;
  taskLog?: TaskLogItem[];
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

export type BackupResult = {
  ok: boolean;
  backup: {
    filePath: string;
    filename: string;
    exportedAt: string;
    notes: number;
    chat: number;
  };
};

export type RobotCommandInfo = {
  command: string;
  label: string;
  group: 'display' | 'hardware' | 'task' | string;
};

export type RobotCommandsResponse = {
  commands: RobotCommandInfo[];
  taskActions: Record<string, Record<string, string>>;
  baudRate: number;
};

export type BoardAnalysisResponse = {
  noteDraft: {
    title: string;
    subject: string;
    period?: string;
    desc?: string;
    content: string;
    captureSource?: 'camera' | 'upload' | 'quick-note' | 'seed';
    ocrText?: string;
    transcript?: string;
    imageUrl?: string;
    img?: string;
    keywords?: string[];
    boardRegions?: BoardRegion[];
    aiRecommendation?: string;
  };
  boardRegions: BoardRegion[];
  currentRecommendation: string;
  teacherPace: TeacherPace;
  focusPercent: number;
  confusedPercent: number;
  tiredPercent: number;
  aiMode: 'gemini' | 'local-fallback';
  session: ClassroomSession;
};

export type RobotCommandResult = {
  ok?: boolean;
  error?: string;
  command: string;
  port?: string;
  response?: string;
  status: RobotStatus;
  taskLog: TaskLogItem[];
};

type SessionResponse = {session: ClassroomSession};
type RobotStatusResponse = {status: RobotStatus; taskLog?: TaskLogItem[]};

export async function loadBridgeHealth(): Promise<BridgeHealth> {
  return apiRequest<BridgeHealth>('/api/health');
}

export async function loadReadyStatus(): Promise<ReadyStatus> {
  return apiRequest<ReadyStatus>('/api/ready', {
    allowStatuses: [503],
  });
}

export async function exportAppData(): Promise<AppDataExport> {
  return apiRequest<AppDataExport>('/api/export');
}

export async function backupAppData(): Promise<BackupResult> {
  return apiRequest<BackupResult>('/api/backup', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function importAppData(payload: unknown): Promise<ImportResult> {
  return apiRequest<ImportResult>('/api/import', {
    method: 'POST',
    body: JSON.stringify(payload),
    timeoutMs: 30000,
  });
}

export async function loadClassroomSession(): Promise<ClassroomSession> {
  const result = await apiRequest<SessionResponse>('/api/classroom/session');
  return result.session;
}

export async function saveClassroomSession(update: Partial<ClassroomSession>): Promise<ClassroomSession> {
  const result = await apiRequest<SessionResponse>('/api/classroom/session', {
    method: 'POST',
    body: JSON.stringify(update),
  });
  return result.session;
}

export async function loadRobotStatus(): Promise<{status: RobotStatus; taskLog: TaskLogItem[]}> {
  const result = await apiRequest<RobotStatusResponse>('/api/robot/status');
  return {status: result.status, taskLog: result.taskLog ?? []};
}

export async function loadRobotCommands(): Promise<RobotCommandsResponse> {
  return apiRequest<RobotCommandsResponse>('/api/robot/commands');
}

export async function sendRobotCommand(command: string, source = 'app', port?: string): Promise<RobotCommandResult> {
  return apiRequest<RobotCommandResult>('/api/robot/command', {
    method: 'POST',
    body: JSON.stringify({command, source, port}),
    allowStatuses: [503],
  });
}

export async function sendRobotTask(action: string, regionId?: string, source = 'app', port?: string): Promise<RobotCommandResult & {action: string; regionId?: string}> {
  return apiRequest<RobotCommandResult & {action: string; regionId?: string}>('/api/robot/task', {
    method: 'POST',
    body: JSON.stringify({action, regionId, source, port}),
    allowStatuses: [503],
  });
}

export async function analyzeBoardCapture(input: {imageBase64: string; transcript?: string; subjectHint?: string}): Promise<BoardAnalysisResponse> {
  return apiRequest<BoardAnalysisResponse>('/api/ai/analyze-board', {
    method: 'POST',
    body: JSON.stringify(input),
    timeoutMs: 30000,
  });
}

export async function transcribeAudio(input: {audioBase64: string; mimeType: string}): Promise<{transcript: string; aiMode: 'gemini' | 'local-fallback'}> {
  return apiRequest<{transcript: string; aiMode: 'gemini' | 'local-fallback'}>('/api/ai/transcribe', {
    method: 'POST',
    body: JSON.stringify(input),
    timeoutMs: 30000,
  });
}
