export type PortInfo = {
  path: string;
  manufacturer?: string;
  vendorId?: string;
  productId?: string;
};

export type NoteTheme = 'primary' | 'secondary' | 'tertiary';

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

export type HardwareCalibrationProfile = {
  servoAngles: {
    regionA: number;
    regionB: number;
    eraseAll: number;
    standby: number;
  };
  cameraMounted: boolean;
  boardAnchored: boolean;
  visionReady: boolean;
  boardCalibrationMode: 'default' | 'manual' | 'auto';
  boardDetectionConfidence: number;
  boardCalibration: {
    topLeft: {x: number; y: number};
    topRight: {x: number; y: number};
    bottomRight: {x: number; y: number};
    bottomLeft: {x: number; y: number};
  };
  robotPose: {
    x: number;
    y: number;
    heading: number;
    stage: 'standby' | 'preview' | 'moving' | 'erasing' | 'paused' | 'done';
    label: string;
    targetRegion?: string;
    command: string;
    updatedAt: string;
  };
  notes: string;
  lastCalibratedAt?: string;
};

export type WhiteboardNote = {
  id: number;
  title: string;
  subject: string;
  period: string;
  desc: string;
  content: string;
  captureSource?: 'camera' | 'upload' | 'quick-note' | 'seed';
  ocrText?: string;
  transcript?: string;
  imageUrl?: string;
  audioUrl?: string;
  keywords?: string[];
  boardRegions?: BoardRegion[];
  aiRecommendation?: string;
  linkedTaskIds?: number[];
  date: string;
  time: string;
  theme: NoteTheme;
  img: string;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  role: 'ai' | 'user';
  text: string;
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
  /** Raw OCR text extracted from the last whiteboard capture. */
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

export type QuizQuestion = {
  q: string;
  options: string[];
  ans: number;
  explanation: string;
};

export type BoardAnalysisResult = {
  noteDraft: Partial<WhiteboardNote> & Pick<WhiteboardNote, 'title' | 'subject' | 'content'>;
  boardRegions: BoardRegion[];
  currentRecommendation: string;
  teacherPace: TeacherPace;
  focusPercent: number;
  confusedPercent: number;
  tiredPercent: number;
  aiMode: 'gemini' | 'local-fallback';
};

export type RobotCommandInfo = {
  command: string;
  label: string;
  group: 'display' | 'hardware' | 'task' | 'sensor' | 'drive' | 'ev3';
};
