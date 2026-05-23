import {apiRequest} from './apiClient';
import {directAnalyzeBoard, directChat, directTranscribe, isDirectGeminiAvailable} from './directGemini';
import {analyzeWhiteboardImage, WhiteboardVisionResult} from './boardVision';
import {loadNotes, normalizeNotes, saveNotes} from './notesStore';
import {defaultRobotPose, RobotPoseEstimate} from './robotPose';
import {BoardCalibration, BoardCalibrationMode, defaultBoardCalibration, normalizeBoardCalibration} from './whiteboardCalibration';

export type BoardRegionStatus = 'keep' | 'erasable' | 'erased';
export type TeacherPace = 'normal' | 'slow_down' | 'review_needed';
export type BoardContentType = 'question' | 'illustration' | 'message' | 'reminder';

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

export type HardwareCalibrationProfile = {
  [legacyKey: string]: any;
  cameraMounted: boolean;
  boardAnchored: boolean;
  visionReady: boolean;
  boardCalibration: BoardCalibration;
  boardCalibrationMode: BoardCalibrationMode;
  boardDetectionConfidence: number;
  robotPose: RobotPoseEstimate;
  notes: string;
  lastCalibratedAt?: string;
};

export type ClassroomSession = {
  focusPercent: number;
  confusedPercent: number;
  tiredPercent: number;
  teacherPace: TeacherPace;
  savedMinutes: number;
  currentRecommendation: string;
  boardRegions: BoardRegion[];
  hardwareProfile: HardwareCalibrationProfile;
  lastCaptureAt?: string;
  updatedAt: string;
  boardOcrText?: string;
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
  hardwareSimulation?: boolean;
  arduinoConnected?: boolean;
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
    contentType?: BoardContentType;
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

type SubjectBoardRegionTemplate = {label: string; keep: boolean; reason: string; contentType: BoardContentType};

const SUBJECT_BOARD_REGIONS: Record<string, SubjectBoardRegionTemplate[]> = {
  '國小數學': [
    {label: '左區', keep: true, reason: '解題重點需要保留複習', contentType: 'question'},
    {label: '右區', keep: false, reason: '練習已完成，可擦除', contentType: 'question'},
  ],
  '數學': [
    {label: '左區', keep: true, reason: '解題重點需要保留複習', contentType: 'question'},
    {label: '右區', keep: false, reason: '練習已完成，可擦除', contentType: 'question'},
  ],
  '國語': [
    {label: '左區', keep: true, reason: '本課生字與重點需要繼續練習', contentType: 'question'},
    {label: '右區', keep: false, reason: '學生已抄寫完畢', contentType: 'question'},
  ],
  '語文': [
    {label: '左區', keep: true, reason: '本課生字與重點需要繼續練習', contentType: 'question'},
    {label: '右區', keep: false, reason: '學生已抄寫完畢', contentType: 'question'},
  ],
  '自然': [
    {label: '左區', keep: true, reason: '實驗方法需要對照', contentType: 'question'},
    {label: '右區', keep: false, reason: '已記錄在課本', contentType: 'question'},
  ],
  '社會': [
    {label: '左區', keep: true, reason: '時序與位置關係需要對照', contentType: 'question'},
    {label: '右區', keep: false, reason: '已完成討論', contentType: 'question'},
  ],
  '英語': [
    {label: '左區', keep: true, reason: '句型需要反覆練習', contentType: 'question'},
    {label: '右區', keep: false, reason: '口語活動已結束', contentType: 'question'},
  ],
  practice: [
    {label: '左區', keep: true, reason: '題目說明需要保留', contentType: 'question'},
    {label: '右區', keep: false, reason: '練習已完成，可擦除', contentType: 'question'},
  ],
  exercise: [
    {label: '左區', keep: true, reason: '題目說明需要保留', contentType: 'question'},
    {label: '右區', keep: false, reason: '練習已完成，可擦除', contentType: 'question'},
  ],
  '美術': [
    {label: '左區', keep: true, reason: '學生小插圖有鼓勵與展示價值', contentType: 'illustration'},
    {label: '右區', keep: false, reason: '空白練習區可清出空間', contentType: 'illustration'},
  ],
  '繪畫': [
    {label: '左區', keep: true, reason: '學生小插圖有鼓勵與展示價值', contentType: 'illustration'},
    {label: '右區', keep: false, reason: '空白練習區可清出空間', contentType: 'illustration'},
  ],
  '塗鴉': [
    {label: '左區', keep: true, reason: '學生小插圖有鼓勵與展示價值', contentType: 'illustration'},
    {label: '右區', keep: false, reason: '空白練習區可清出空間', contentType: 'illustration'},
  ],
  'illustration-style': [
    {label: '左區', keep: true, reason: '學生小插圖有鼓勵與展示價值', contentType: 'illustration'},
    {label: '右區', keep: false, reason: '空白練習區可清出空間', contentType: 'illustration'},
  ],
  '鼓勵話': [
    {label: '左區', keep: true, reason: '鼓勵話能照顧班級情緒', contentType: 'message'},
    {label: '右區', keep: false, reason: '練習區已保存，可清出空間', contentType: 'message'},
  ],
  '班級口號': [
    {label: '左區', keep: true, reason: '班級口號能維持班級凝聚', contentType: 'message'},
    {label: '右區', keep: false, reason: '練習區已保存，可清出空間', contentType: 'message'},
  ],
  cheer: [
    {label: '左區', keep: true, reason: '鼓勵話能照顧班級情緒', contentType: 'message'},
    {label: '右區', keep: false, reason: '練習區已保存，可清出空間', contentType: 'message'},
  ],
  motivation: [
    {label: '左區', keep: true, reason: '鼓勵話能照顧班級情緒', contentType: 'message'},
    {label: '右區', keep: false, reason: '練習區已保存，可清出空間', contentType: 'message'},
  ],
  '提醒事項': [
    {label: '左區', keep: true, reason: '提醒事項下課前仍需要看見', contentType: 'reminder'},
    {label: '右區', keep: false, reason: '已完成內容可清出空間', contentType: 'reminder'},
  ],
  '校規': [
    {label: '左區', keep: true, reason: '校規提醒下課前仍需要看見', contentType: 'reminder'},
    {label: '右區', keep: false, reason: '已完成內容可清出空間', contentType: 'reminder'},
  ],
  rules: [
    {label: '左區', keep: true, reason: '提醒事項下課前仍需要看見', contentType: 'reminder'},
    {label: '右區', keep: false, reason: '已完成內容可清出空間', contentType: 'reminder'},
  ],
  reminders: [
    {label: '左區', keep: true, reason: '提醒事項下課前仍需要看見', contentType: 'reminder'},
    {label: '右區', keep: false, reason: '已完成內容可清出空間', contentType: 'reminder'},
  ],
  default: [
    {label: '左區', keep: true, reason: '核心概念需保留', contentType: 'question'},
    {label: '右區', keep: false, reason: '練習已完成', contentType: 'question'},
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
const SUBJECT_KEYS = [
  '國小數學', '數學', '語文', '國語', '自然', '社會', '英語', '體育', '藝術',
  'practice', 'exercise', '美術', '繪畫', '塗鴉', 'illustration-style',
  '鼓勵話', '班級口號', 'cheer', 'motivation', '提醒事項', '校規', 'rules', 'reminders',
] as const;

const REGION_POSITIONS: Array<{id: string; x: number; y: number; width: number; height: number}> = [
  {id: 'A', x: 5, y: 12, width: 43, height: 76},
  {id: 'B', x: 52, y: 12, width: 43, height: 76},
];

export const defaultHardwareCalibrationProfile: HardwareCalibrationProfile = {
  cameraMounted: false,
  boardAnchored: false,
  visionReady: false,
  boardCalibration: defaultBoardCalibration(),
  boardCalibrationMode: 'default',
  boardDetectionConfidence: 0,
  robotPose: defaultRobotPose(),
  notes: '預設展示只使用左區與右區；實機角度由工程模式維護。',
};

function resolveSubjectKey(subject: string) {
  const normalized = subject.toLowerCase();
  const key = SUBJECT_KEYS.find((item) => normalized.includes(item.toLowerCase()));
  return key ?? '綜合';
}

function resolveBoardContentType(subject: string): BoardContentType {
  const subjectKey = resolveSubjectKey(subject);
  return SUBJECT_BOARD_REGIONS[subjectKey]?.[0]?.contentType ?? SUBJECT_BOARD_REGIONS.default[0].contentType;
}

function recommendationForContentType(contentType: BoardContentType, fallback: string) {
  if (contentType === 'illustration') return '發現學生畫的鼓勵小插圖，建議保留這區不擦';
  if (contentType === 'message') return '發現鼓勵話，建議保留這區';
  if (contentType === 'reminder') return '提醒事項，建議保留';
  return fallback;
}

function buildBoardRegions(subject: string): BoardRegion[] {
  const subjectKey = resolveSubjectKey(subject);
  const templates = SUBJECT_BOARD_REGIONS[subjectKey] ?? SUBJECT_BOARD_REGIONS['default'];
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
  currentRecommendation: '展示模式：白板重點與教師決策會保存在這台展示裝置，接上實體機器人後可再送出任務。',
  boardRegions: buildBoardRegions('綜合'),
  hardwareProfile: defaultHardwareCalibrationProfile,
  updatedAt: new Date().toISOString(),
};

const fallbackRobotStatus: RobotStatus = {
  connected: false,
  activePort: '',
  lastCommand: '',
  lastResponse: '展示模式：尚未連到實體機器人',
  lastUpdatedAt: new Date().toISOString(),
};

const fallbackCommands: RobotCommandInfo[] = [
  {command: 'SHOW_ON', label: '開始動畫', group: 'display'},
  {command: 'SHOW_OFF', label: '停止動畫', group: 'display'},
  {command: 'FIREWORK', label: '放煙火', group: 'display'},
  {command: 'RESET', label: '重置動畫', group: 'display'},
  {command: 'LED_ON', label: 'LED 開', group: 'hardware'},
  {command: 'LED_OFF', label: 'LED 關', group: 'hardware'},
  {command: 'ERASE_ALL', label: '一鍵全擦', group: 'task'},
  {command: 'ERASE_REGION_A', label: '擦除左區', group: 'task'},
  {command: 'ERASE_REGION_B', label: '擦除右區', group: 'task'},
  {command: 'KEEP_REGION_A', label: '保留左區', group: 'task'},
  {command: 'KEEP_REGION_B', label: '保留右區', group: 'task'},
  {command: 'PAUSE_TASK', label: '暫停任務', group: 'task'},
  {command: 'STOP', label: '停止', group: 'task'},
  {command: 'DELIVERY_START', label: '配送開始', group: 'task'},
  {command: 'ALERT_SIGNAL', label: '關懷提醒訊號', group: 'task'},
  {command: 'CARE_DEPLOYED', label: '佈署關懷', group: 'task'},
];

const fallbackTaskActions = {
  erase: {A: 'ERASE_REGION_A', B: 'ERASE_REGION_B', ALL: 'ERASE_ALL'},
  keep: {A: 'KEEP_REGION_A', B: 'KEEP_REGION_B'},
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
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // QuotaExceededError or storage disabled — best-effort
  }
}

function normalizeHardwareProfile(value: unknown): HardwareCalibrationProfile {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const rawRobotPose = source.robotPose && typeof source.robotPose === 'object' && !Array.isArray(source.robotPose)
    ? source.robotPose as Record<string, unknown>
    : {};
  const fallbackPose = defaultRobotPose();
  return {
    ...defaultHardwareCalibrationProfile,
    cameraMounted: Boolean(source.cameraMounted),
    boardAnchored: Boolean(source.boardAnchored),
    visionReady: Boolean(source.visionReady),
    boardCalibration: normalizeBoardCalibration(source.boardCalibration),
    boardCalibrationMode: source.boardCalibrationMode === 'manual' || source.boardCalibrationMode === 'auto' ? source.boardCalibrationMode : 'default',
    boardDetectionConfidence: Math.max(0, Math.min(100, Math.round(Number(source.boardDetectionConfidence) || 0))),
    robotPose: {
      ...fallbackPose,
      x: Math.max(0, Math.min(100, Math.round((Number(rawRobotPose.x) || fallbackPose.x) * 10) / 10)),
      y: Math.max(0, Math.min(100, Math.round((Number(rawRobotPose.y) || fallbackPose.y) * 10) / 10)),
      heading: Math.round(Number(rawRobotPose.heading) || fallbackPose.heading),
      stage: ['standby', 'preview', 'moving', 'erasing', 'paused', 'done'].includes(String(rawRobotPose.stage))
        ? String(rawRobotPose.stage) as RobotPoseEstimate['stage']
        : fallbackPose.stage,
      label: typeof rawRobotPose.label === 'string' ? rawRobotPose.label : fallbackPose.label,
      targetRegion: typeof rawRobotPose.targetRegion === 'string' ? rawRobotPose.targetRegion : undefined,
      command: typeof rawRobotPose.command === 'string' ? rawRobotPose.command : fallbackPose.command,
      updatedAt: typeof rawRobotPose.updatedAt === 'string' ? rawRobotPose.updatedAt : fallbackPose.updatedAt,
    },
    notes: typeof source.notes === 'string' ? source.notes : defaultHardwareCalibrationProfile.notes,
    lastCalibratedAt: typeof source.lastCalibratedAt === 'string' && source.lastCalibratedAt ? source.lastCalibratedAt : undefined,
  };
}

function normalizeLocalBoardRegions(value: unknown): BoardRegion[] {
  const fallback = buildBoardRegions('綜合');
  if (!Array.isArray(value)) {
    return fallback;
  }
  const regions = value
    .filter((item): item is Partial<BoardRegion> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((item, index) => {
      const fallbackRegion = fallback[index] ?? fallback[Math.min(index, fallback.length - 1)];
      const rawId = String(item.id ?? fallbackRegion.id).trim().toUpperCase();
      const id = rawId === 'B' || /REGION[\s_-]*B|區塊[\s_-]*B/.test(rawId) ? 'B' : 'A';
      return {
        id,
        label: String(item.label ?? fallbackRegion.label),
        x: Math.max(0, Math.min(100, Number(item.x) || fallbackRegion.x)),
        y: Math.max(0, Math.min(100, Number(item.y) || fallbackRegion.y)),
        width: Math.max(1, Math.min(100, Number(item.width) || fallbackRegion.width)),
        height: Math.max(1, Math.min(100, Number(item.height) || fallbackRegion.height)),
        status: item.status === 'erasable' || item.status === 'erased' || item.status === 'keep' ? item.status : fallbackRegion.status,
        reason: String(item.reason ?? fallbackRegion.reason),
      };
    })
    .filter((region, index, list) => (region.id === 'A' || region.id === 'B') && list.findIndex((item) => item.id === region.id) === index)
    .slice(0, 2);
  return regions.length === 2 ? regions : fallback;
}

function normalizeSession(session: ClassroomSession): ClassroomSession {
  return {
    ...fallbackSession,
    ...session,
    boardRegions: normalizeLocalBoardRegions(session.boardRegions),
    hardwareProfile: normalizeHardwareProfile(session.hardwareProfile),
  };
}

function loadLocalSession(): ClassroomSession {
  return normalizeSession(readJson<ClassroomSession>(SESSION_KEY, fallbackSession));
}

function saveLocalSession(update: Partial<ClassroomSession>): ClassroomSession {
  const session = {
    ...loadLocalSession(),
    ...update,
    boardRegions: normalizeLocalBoardRegions(update.boardRegions ?? loadLocalSession().boardRegions),
    hardwareProfile: normalizeHardwareProfile(update.hardwareProfile ?? loadLocalSession().hardwareProfile),
    updatedAt: new Date().toISOString(),
  };
  writeJson(SESSION_KEY, session);
  return normalizeSession(session);
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
    lastResponse: '展示模式：已記錄任務，接上實體板擦機器人後可直接送出',
    lastUpdatedAt: now,
  };
  const taskLog = [
    {
      id: Date.now(),
      command,
      source,
      ok: false,
      message: '展示模式已保留任務，實體機器人連線後會送出',
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
    bridgePort: 3201,
    baudRate: 115200,
    dataDir: 'browser localStorage',
    geminiConfigured: false,
    storage: {writable: true, message: '瀏覽器 localStorage 可用'},
    staticBuild: {available: true, indexHtml: '靜態展示頁', assetCount: 0},
    checks: [
      {name: 'static-page', ok: true, message: '靜態展示模式可操作'},
      {name: 'hardware-link', ok: true, message: '未連實體機器人，任務會保留為展示紀錄'},
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

function localBoardAnalysis(input: {imageBase64: string; transcript?: string; subjectHint?: string; boardCalibration?: BoardCalibration}, vision?: WhiteboardVisionResult): BoardAnalysisResponse {
  const subject = input.subjectHint?.trim() || '綜合';
  const subjectKey = resolveSubjectKey(subject);
  const status = SUBJECT_LEARNING_STATUS[subjectKey] ?? SUBJECT_LEARNING_STATUS['綜合'];
  const boardRegions = vision?.regions ?? buildBoardRegions(subject);
  const contentType = resolveBoardContentType(subject);
  const fallbackTranscript = SUBJECT_TRANSCRIPTS[subjectKey] ?? SUBJECT_TRANSCRIPTS['default'];

  const keepLabels = boardRegions.filter(r => r.status === 'keep').map(r => r.label).join('、');
  const eraseLabels = boardRegions.filter(r => r.status === 'erasable').map(r => r.label).join('、');
  const recommendation = recommendationForContentType(
    contentType,
    vision?.recommendation ?? `靜態展示分析完成：保留「${keepLabels}」，「${eraseLabels}」可清出空間繼續教學。`,
  );

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
    '3. 右區練習已保存，可換下一題繼續教學。',
    '',
    `老師講解：${resolvedTranscript}`,
  ].join('\n');
  return {
    noteDraft: {
      title: `${subject} 白板重點`,
      subject,
      period: '展示模式',
      desc: vision ? '由白板照片判斷產生的國小白板紀錄。' : '由展示模式產生的國小白板紀錄。',
      content,
      captureSource: 'camera',
      ocrText: content,
      transcript: resolvedTranscript,
      imageUrl: input.imageBase64,
      img: input.imageBase64,
      keywords: vision ? [subject, '白板', '國小', '照片判斷', ...vision.evidence] : [subject, '白板', '國小', '展示模式'],
      boardRegions: session.boardRegions,
      aiRecommendation: session.currentRecommendation,
      contentType,
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
    const normalized = normalizeSession(result.session);
    writeJson(SESSION_KEY, normalized);
    return normalized;
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
    const normalized = normalizeSession(result.session);
    writeJson(SESSION_KEY, normalized);
    return normalized;
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

export async function analyzeBoardCapture(input: {imageBase64: string; transcript?: string; subjectHint?: string; boardCalibration?: BoardCalibration}, signal?: AbortSignal): Promise<BoardAnalysisResponse> {
  try {
    return await apiRequest<BoardAnalysisResponse>('/api/ai/analyze-board', {
      method: 'POST',
      body: JSON.stringify(input),
      timeoutMs: 60000,
      signal,
    });
  } catch {
    // Bridge unreachable. If a direct Gemini key is baked into the bundle (deploy mode), use it.
    if (isDirectGeminiAvailable()) {
      try {
        return await directAnalyzeBoard(input);
      } catch {
        // fall through to local
      }
    }
    try {
      return localBoardAnalysis(input, await analyzeWhiteboardImage(input.imageBase64, input.boardCalibration));
    } catch {
      return localBoardAnalysis(input);
    }
  }
}

export async function analyzeBoardDemoSample(input: {imageBase64: string; transcript?: string; subjectHint?: string; boardCalibration?: BoardCalibration}): Promise<BoardAnalysisResponse> {
  try {
    return localBoardAnalysis(input, await analyzeWhiteboardImage(input.imageBase64, input.boardCalibration));
  } catch {
    return localBoardAnalysis(input);
  }
}

export type OcrLocalResult = {
  ok: boolean;
  text: string;
  blocks: {text: string; confidence: number; bbox: number[][]}[];
  engine: string;
  error?: string;
};

export async function ocrBoardLocal(imageBase64: string): Promise<OcrLocalResult> {
  try {
    return await apiRequest<OcrLocalResult>('/api/ai/ocr-local', {
      method: 'POST',
      body: JSON.stringify({imageBase64}),
      timeoutMs: 14_000,
    });
  } catch {
    return {ok: false, text: '', blocks: [], engine: 'none', error: 'service unavailable'};
  }
}

export async function getOcrStatus(): Promise<boolean> {
  try {
    const r = await apiRequest<{ready: boolean}>('/api/ai/ocr-status', {timeoutMs: 3000});
    return r.ready;
  } catch {
    return false;
  }
}

export type EraseSequenceEvent =
  | {type: 'start'; regions: string[]; gapMs: number}
  | {kind: 'progress'; region: string; pass: number; total: number}
  | {type: 'sending'; region: string; command: string}
  | {type: 'ok'; region: string; command: string; response: string}
  | {type: 'timeout'; region: string; command: string; message: string}
  | {type: 'error'; region: string; command: string; message: string}
  | {type: 'done'; total: number; ok: number; failed: number};

/**
 * Opens an SSE stream that sends ERASE_REGION_X for each region in order.
 * Calls onEvent for each progress update. Returns a cancel function.
 */
export function eraseRegionSequence(
  regionIds: string[],
  onEvent: (event: EraseSequenceEvent) => void,
  gapMs = 1500,
): () => void {
  const base = (window as any).__BRIDGE_BASE__ ?? '';
  const url = `${base}/api/robot/erase-sequence?regions=${regionIds.join(',')}&gap=${gapMs}`;
  const es = new EventSource(url);
  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data) as EraseSequenceEvent;
      onEvent(data);
      if ('type' in data && data.type === 'done') es.close();
    } catch {}
  };
  es.onerror = () => {
    onEvent({type: 'done', total: regionIds.length, ok: 0, failed: regionIds.length});
    es.close();
  };
  return () => es.close();
}

export async function transcribeAudio(input: {audioBase64: string; mimeType: string}, signal?: AbortSignal): Promise<{transcript: string; aiMode: 'gemini' | 'local-fallback'}> {
  try {
    return await apiRequest<{transcript: string; aiMode: 'gemini' | 'local-fallback'}>('/api/ai/transcribe', {
      method: 'POST',
      body: JSON.stringify(input),
      timeoutMs: 60000,
      signal,
    });
  } catch {
    if (isDirectGeminiAvailable()) {
      try { return await directTranscribe(input); } catch { /* fall through */ }
    }
    return {
      transcript: `展示模式：未連接 AI，請改用文字輸入老師講解。`,
      aiMode: 'local-fallback',
    };
  }
}
