import {apiRequest} from './apiClient';
import {loadNotes, normalizeNotes, saveNotes} from './notesStore';

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

const SESSION_KEY = 'whiteboard-session:elementary:v1';
const ROBOT_STATUS_KEY = 'whiteboard-robot-status:elementary:v1';
const TASK_LOG_KEY = 'whiteboard-task-log:elementary:v1';
const CHAT_KEY = 'whiteboard-chat:elementary:v1';

const SUBJECT_LEARNING_STATUS: Record<string, {focus: number; confused: number; tired: number}> = {
  '數學': {focus: 75, confused: 18, tired: 7},
  '語文': {focus: 82, confused: 10, tired: 8},
  '自然': {focus: 85, confused: 9, tired: 6},
  '社會': {focus: 78, confused: 14, tired: 8},
  '英語': {focus: 72, confused: 20, tired: 8},
  '體育': {focus: 88, confused: 5, tired: 7},
  '藝術': {focus: 83, confused: 8, tired: 9},
  '綜合': {focus: 80, confused: 12, tired: 8},
};

const SUBJECT_BOARD_REGIONS: Record<string, Array<{label: string; keep: boolean; reason: string}>> = {
  '數學': [
    {label: '例題解析區', keep: true, reason: '解題步驟需要保留複習'},
    {label: '公式總整理', keep: true, reason: '重要公式下課後仍需參考'},
    {label: '練習題作答', keep: false, reason: '已完成，可擦除'},
  ],
  '語文': [
    {label: '生字詞彙區', keep: true, reason: '本課生字需要繼續練習'},
    {label: '課文重點段落', keep: true, reason: '閱讀理解重點保留'},
    {label: '造句練習', keep: false, reason: '學生已抄寫完畢'},
  ],
  '自然': [
    {label: '實驗步驟圖示', keep: true, reason: '實驗方法需要對照'},
    {label: '觀察記錄表', keep: true, reason: '資料整理中'},
    {label: '結論討論', keep: false, reason: '已記錄在課本'},
  ],
  '社會': [
    {label: '歷史時間軸', keep: true, reason: '時序關係需要對照'},
    {label: '地圖標示區', keep: true, reason: '地理位置重要'},
    {label: '課堂討論紀錄', keep: false, reason: '已完成討論'},
  ],
  '英語': [
    {label: '單字例句區', keep: true, reason: '句型需要反覆練習'},
    {label: '文法重點', keep: true, reason: '文法規則本節重點'},
    {label: '口語練習記錄', keep: false, reason: '口語活動已結束'},
  ],
  default: [
    {label: '圖解與例題', keep: true, reason: '核心概念需保留'},
    {label: '練習作答區', keep: false, reason: '練習已完成'},
    {label: '口訣提醒區', keep: true, reason: '記憶口訣仍有用'},
  ],
};

const SUBJECT_TRANSCRIPTS: Record<string, string> = {
  '數學': '範例一：已知三角形底邊為8公分，高為6公分，求面積。\n解：面積 = 底×高÷2 = 8×6÷2 = 24（平方公分）\n公式：三角形面積 = 底×高÷2',
  '語文': '本課生字：「勤」、「奮」、「努」、「力」\n造句練習：他每天勤奮努力地讀書。\n課文重點：第三段描述主角克服困難的過程。',
  '自然': '實驗：觀察植物光合作用\n材料：植物、光源、水\n步驟1：將植物放在陽光充足處\n步驟2：觀察葉片顏色變化\n結論：光照充足時葉片顏色更深綠。',
  '社會': '台灣歷史時間軸：\n1624年 荷蘭佔領台灣\n1661年 鄭成功收復台灣\n1895年 馬關條約，台灣割讓日本\n1945年 二次大戰結束，台灣回歸',
  '英語': 'New Words: happy (快樂的), sad (悲傷的), angry (生氣的)\nSentence Pattern: I feel ___.\nExample: I feel happy today.',
  default: '今日課堂重點整理\n一、主要概念說明\n二、重要定義與公式\n三、練習題與解答\n請同學課後複習以上內容。',
};

const REGION_POSITIONS: Array<{id: string; x: number; y: number; width: number; height: number}> = [
  {id: 'A', x: 8, y: 18, width: 38, height: 58},
  {id: 'B', x: 54, y: 20, width: 34, height: 50},
  {id: 'C', x: 22, y: 78, width: 58, height: 16},
];

function buildBoardRegions(subject: string): BoardRegion[] {
  const templates = SUBJECT_BOARD_REGIONS[subject] ?? SUBJECT_BOARD_REGIONS['default'];
  return templates.map((tmpl, i) => ({
    ...REGION_POSITIONS[i],
    label: tmpl.label,
    status: tmpl.keep ? 'keep' : 'erasable',
    reason: tmpl.reason,
  })) as BoardRegion[];
}

const fallbackSession: ClassroomSession = {
  focusPercent: 80,
  confusedPercent: 12,
  tiredPercent: 8,
  teacherPace: 'normal',
  savedMinutes: 3.1,
  currentRecommendation: '本機展示模式：白板重點與教師決策會保存在這台瀏覽器，接上本機橋接後可再送到 UNO R4。',
  boardRegions: buildBoardRegions('綜合'),
  updatedAt: new Date().toISOString(),
};

const fallbackRobotStatus: RobotStatus = {
  connected: false,
  activePort: '',
  lastCommand: '',
  lastResponse: '靜態展示模式：尚未連到本機硬體橋接',
  lastUpdatedAt: new Date().toISOString(),
};

const fallbackCommands: RobotCommandInfo[] = [
  {command: 'SHOW_ON', label: '開始動畫', group: 'display'},
  {command: 'SHOW_OFF', label: '停止動畫', group: 'display'},
  {command: 'FIREWORK', label: '放煙火', group: 'display'},
  {command: 'RESET', label: '重置動畫', group: 'display'},
  {command: 'LED_ON', label: 'LED 開', group: 'hardware'},
  {command: 'LED_OFF', label: 'LED 關', group: 'hardware'},
  {command: 'SERVO_0', label: '伺服 0 度', group: 'hardware'},
  {command: 'SERVO_90', label: '伺服 90 度', group: 'hardware'},
  {command: 'SERVO_180', label: '伺服 180 度', group: 'hardware'},
  {command: 'ERASE_ALL', label: '一鍵全擦', group: 'task'},
  {command: 'ERASE_REGION_A', label: '擦除區塊 A', group: 'task'},
  {command: 'ERASE_REGION_B', label: '擦除區塊 B', group: 'task'},
  {command: 'ERASE_REGION_C', label: '擦除區塊 C', group: 'task'},
  {command: 'KEEP_REGION_A', label: '保留區塊 A', group: 'task'},
  {command: 'KEEP_REGION_B', label: '保留區塊 B', group: 'task'},
  {command: 'KEEP_REGION_C', label: '保留區塊 C', group: 'task'},
  {command: 'PAUSE_TASK', label: '暫停任務', group: 'task'},
  {command: 'STOP', label: '停止', group: 'task'},
  {command: 'DELIVERY_START', label: '配送開始', group: 'task'},
  {command: 'ALERT_SIGNAL', label: '關懷提醒訊號', group: 'task'},
  {command: 'CARE_DEPLOYED', label: '佈署關懷', group: 'task'},
];

const fallbackTaskActions = {
  erase: {A: 'ERASE_REGION_A', B: 'ERASE_REGION_B', C: 'ERASE_REGION_C', ALL: 'ERASE_ALL'},
  keep: {A: 'KEEP_REGION_A', B: 'KEEP_REGION_B', C: 'KEEP_REGION_C'},
  pause: {DEFAULT: 'PAUSE_TASK'},
  clean_start: {DEFAULT: 'CLEAN_START'},
  clean_stop: {DEFAULT: 'CLEAN_STOP'},
  stop: {DEFAULT: 'STOP'},
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadLocalSession(): ClassroomSession {
  return readJson<ClassroomSession>(SESSION_KEY, fallbackSession);
}

function saveLocalSession(update: Partial<ClassroomSession>): ClassroomSession {
  const session = {
    ...loadLocalSession(),
    ...update,
    boardRegions: update.boardRegions ?? loadLocalSession().boardRegions,
    updatedAt: new Date().toISOString(),
  };
  writeJson(SESSION_KEY, session);
  return session;
}

function loadLocalRobotStatus(): RobotStatus {
  return readJson<RobotStatus>(ROBOT_STATUS_KEY, fallbackRobotStatus);
}

function loadLocalTaskLog(): TaskLogItem[] {
  return readJson<TaskLogItem[]>(TASK_LOG_KEY, []);
}

function appendLocalTask(command: string, source: string): RobotCommandResult {
  const now = new Date().toISOString();
  const status: RobotStatus = {
    ...loadLocalRobotStatus(),
    connected: false,
    lastCommand: command,
    lastResponse: '本機展示模式：已記錄指令，接上實體板擦機器人後可直接送出',
    lastUpdatedAt: now,
  };
  const taskLog = [
    {
      id: Date.now(),
      command,
      source,
      ok: false,
      message: '本機展示模式已保留指令，實體機器人連線後會送出',
      createdAt: now,
    },
    ...loadLocalTaskLog(),
  ].slice(0, 50);
  writeJson(ROBOT_STATUS_KEY, status);
  writeJson(TASK_LOG_KEY, taskLog);
  return {ok: false, error: '靜態展示模式', command, status, taskLog};
}

function chatMessages() {
  return readJson<unknown[]>(CHAT_KEY, []);
}

function localReadyStatus(): ReadyStatus {
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    environment: 'local-showcase',
    bridgePort: 3200,
    baudRate: 115200,
    dataDir: 'browser localStorage',
    geminiConfigured: false,
    storage: {writable: true, message: '瀏覽器 localStorage 可用'},
    staticBuild: {available: true, indexHtml: '靜態展示頁', assetCount: 0},
    checks: [
      {name: 'static-page', ok: true, message: '靜態展示模式可操作'},
      {name: 'hardware-link', ok: true, message: '未連實體機器人，硬體指令會保留為展示紀錄'},
    ],
  };
}

function localExportPayload(): AppDataExport {
  return {
    schemaVersion: 1,
    app: 'ai-whiteboard-assistant-showcase',
    exportedAt: new Date().toISOString(),
    notes: loadNotes(),
    chat: chatMessages(),
    classroomSession: loadLocalSession(),
    robotStatus: loadLocalRobotStatus(),
    taskLog: loadLocalTaskLog(),
  };
}

function localBoardAnalysis(input: {imageBase64: string; transcript?: string; subjectHint?: string}): BoardAnalysisResponse {
  const subject = input.subjectHint?.trim() || '綜合';
  const status = SUBJECT_LEARNING_STATUS[subject] ?? SUBJECT_LEARNING_STATUS['綜合'];
  const boardRegions = buildBoardRegions(subject);
  const fallbackTranscript = SUBJECT_TRANSCRIPTS[subject] ?? SUBJECT_TRANSCRIPTS['default'];

  const keepLabels = boardRegions.filter(r => r.status === 'keep').map(r => r.label).join('、');
  const eraseLabels = boardRegions.filter(r => r.status === 'erasable').map(r => r.label).join('、');
  const recommendation = `靜態展示分析完成：保留「${keepLabels}」，「${eraseLabels}」可清出空間繼續教學。`;

  const session = saveLocalSession({
    ...fallbackSession,
    focusPercent: status.focus,
    confusedPercent: status.confused,
    tiredPercent: status.tired,
    boardRegions,
    currentRecommendation: recommendation,
    lastCaptureAt: new Date().toISOString(),
  });
  const resolvedTranscript = input.transcript || fallbackTranscript;
  const content = [
    `今日課堂：${subject}`,
    '',
    '板書重點：',
    '1. 先看圖或例題，讓孩子說出自己的想法。',
    '2. 把老師講解整理成三個孩子聽得懂的句子。',
    '3. 右側練習區已保存，可換下一題繼續教學。',
    '',
    `老師講解：${resolvedTranscript}`,
  ].join('\n');
  return {
    noteDraft: {
      title: `${subject} 白板重點`,
      subject,
      period: '本機展示',
      desc: '由靜態展示模式產生的國小白板紀錄。',
      content,
      captureSource: 'camera',
      ocrText: content,
      transcript: resolvedTranscript,
      imageUrl: input.imageBase64,
      img: input.imageBase64,
      keywords: [subject, '白板', '國小', '展示模式'],
      boardRegions: session.boardRegions,
      aiRecommendation: session.currentRecommendation,
    },
    boardRegions: session.boardRegions,
    currentRecommendation: session.currentRecommendation,
    teacherPace: session.teacherPace,
    focusPercent: session.focusPercent,
    confusedPercent: session.confusedPercent,
    tiredPercent: session.tiredPercent,
    aiMode: 'local-fallback',
    session,
  };
}

export async function loadBridgeHealth(): Promise<BridgeHealth> {
  try {
    return await apiRequest<BridgeHealth>('/api/health');
  } catch {
    return localReadyStatus();
  }
}

export async function loadReadyStatus(): Promise<ReadyStatus> {
  try {
    return await apiRequest<ReadyStatus>('/api/ready', {
      allowStatuses: [503],
    });
  } catch {
    return localReadyStatus();
  }
}

export async function exportAppData(): Promise<AppDataExport> {
  try {
    return await apiRequest<AppDataExport>('/api/export');
  } catch {
    return localExportPayload();
  }
}

export async function backupAppData(): Promise<BackupResult> {
  try {
    return await apiRequest<BackupResult>('/api/backup', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  } catch {
    const exportedAt = new Date().toISOString();
    return {
      ok: true,
      backup: {
        filePath: 'browser localStorage',
        filename: `showcase-backup-${exportedAt.replace(/[:.]/g, '-')}.json`,
        exportedAt,
        notes: loadNotes().length,
        chat: chatMessages().length,
      },
    };
  }
}

export async function importAppData(payload: unknown): Promise<ImportResult> {
  try {
    return await apiRequest<ImportResult>('/api/import', {
      method: 'POST',
      body: JSON.stringify(payload),
      timeoutMs: 30000,
    });
  } catch {
    const data = payload as Partial<AppDataExport>;
    const notes = normalizeNotes(data.notes);
    saveNotes(notes);
    if (data.classroomSession) writeJson(SESSION_KEY, data.classroomSession);
    if (data.robotStatus) writeJson(ROBOT_STATUS_KEY, data.robotStatus);
    if (Array.isArray(data.taskLog)) writeJson(TASK_LOG_KEY, data.taskLog);
    return {
      ok: true,
      importedAt: new Date().toISOString(),
      counts: {notes: notes.length, chat: Array.isArray(data.chat) ? data.chat.length : 0, taskLog: Array.isArray(data.taskLog) ? data.taskLog.length : 0},
      updated: ['browser-localStorage'],
    };
  }
}

export async function loadClassroomSession(): Promise<ClassroomSession> {
  try {
    const result = await apiRequest<SessionResponse>('/api/classroom/session');
    writeJson(SESSION_KEY, result.session);
    return result.session;
  } catch {
    return loadLocalSession();
  }
}

export async function saveClassroomSession(update: Partial<ClassroomSession>): Promise<ClassroomSession> {
  try {
    const result = await apiRequest<SessionResponse>('/api/classroom/session', {
      method: 'POST',
      body: JSON.stringify(update),
    });
    writeJson(SESSION_KEY, result.session);
    return result.session;
  } catch {
    return saveLocalSession(update);
  }
}

export async function loadRobotStatus(): Promise<{status: RobotStatus; taskLog: TaskLogItem[]}> {
  try {
    const result = await apiRequest<RobotStatusResponse>('/api/robot/status');
    writeJson(ROBOT_STATUS_KEY, result.status);
    writeJson(TASK_LOG_KEY, result.taskLog ?? []);
    return {status: result.status, taskLog: result.taskLog ?? []};
  } catch {
    return {status: loadLocalRobotStatus(), taskLog: loadLocalTaskLog()};
  }
}

export async function loadRobotCommands(): Promise<RobotCommandsResponse> {
  try {
    return await apiRequest<RobotCommandsResponse>('/api/robot/commands');
  } catch {
    return {commands: fallbackCommands, taskActions: fallbackTaskActions, baudRate: 115200};
  }
}

export async function sendRobotCommand(command: string, source = 'app', port?: string): Promise<RobotCommandResult> {
  try {
    return await apiRequest<RobotCommandResult>('/api/robot/command', {
      method: 'POST',
      body: JSON.stringify({command, source, port}),
      allowStatuses: [503],
    });
  } catch {
    return appendLocalTask(command, source);
  }
}

export async function sendRobotTask(action: string, regionId?: string, source = 'app', port?: string): Promise<RobotCommandResult & {action: string; regionId?: string}> {
  try {
    return await apiRequest<RobotCommandResult & {action: string; regionId?: string}>('/api/robot/task', {
      method: 'POST',
      body: JSON.stringify({action, regionId, source, port}),
      allowStatuses: [503],
    });
  } catch {
    const commandMap = fallbackTaskActions[action as keyof typeof fallbackTaskActions] as Record<string, string> | undefined;
    const command = commandMap?.[regionId ?? 'DEFAULT'] ?? commandMap?.DEFAULT ?? action.toUpperCase();
    return {...appendLocalTask(command, source), action, regionId};
  }
}

export async function analyzeBoardCapture(input: {imageBase64: string; transcript?: string; subjectHint?: string}): Promise<BoardAnalysisResponse> {
  try {
    return await apiRequest<BoardAnalysisResponse>('/api/ai/analyze-board', {
      method: 'POST',
      body: JSON.stringify(input),
      timeoutMs: 30000,
    });
  } catch {
    return localBoardAnalysis(input);
  }
}

export async function transcribeAudio(input: {audioBase64: string; mimeType: string}): Promise<{transcript: string; aiMode: 'gemini' | 'local-fallback'}> {
  try {
    return await apiRequest<{transcript: string; aiMode: 'gemini' | 'local-fallback'}>('/api/ai/transcribe', {
      method: 'POST',
      body: JSON.stringify(input),
      timeoutMs: 30000,
    });
  } catch {
    return {
      transcript: `靜態展示逐字稿：已收到 ${input.mimeType} 錄音，系統會先使用本機範例文字。`,
      aiMode: 'local-fallback',
    };
  }
}
