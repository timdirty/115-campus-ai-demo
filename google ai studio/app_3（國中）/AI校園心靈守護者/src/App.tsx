import {useCallback, useEffect, useMemo, useReducer, useRef, useState} from 'react';
import {TourProvider} from './components/tour/TourProvider';
import {TourOverlay} from './components/tour/TourOverlay';
import {useTour} from './components/tour/useTour';
import {IssueReporter} from './components/IssueReporter';
import {DemoTimer} from './components/DemoTimer';
import {useProxyHealth} from './hooks/useProxyHealth';
import {useHardwareSocket} from './hooks/useHardwareSocket';
import {HardwareStatusBanner} from './components/HardwareStatusBanner';
import {CommandFeedbackToast} from './components/CommandFeedbackToast';
import type {Dispatch, ReactNode} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {
  Bell,
  Bot,
  Camera,
  CheckCircle2,
  Download,
  Droplets,
  HeartHandshake,
  Leaf,
  Lock,
  MapPin,
  MessageSquare,
  Mic,
  MicOff,
  Radar,
  RefreshCw,
  Send,
  ShieldCheck,
  Siren,
  Smile,
  Sun,
  Thermometer,
  Type,
  Upload,
  Volume2,
  Wifi,
  Settings,
  X,
} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import {AcousticSignal, DetectedPort, GuardianAlert, GuardianState, MoodType, RiskLevel, ZoneSensorReading} from './types';
import {guardianReducer, loadGuardianState, normalizeGuardianState, persistGuardianState} from './state/guardianState';
import {analyzeAcousticFrame, describeAcousticSignal} from './services/acousticGuardian';
import {generateSupportReply} from './services/localGuardianAi';
import {analyzeEmotionTypography} from './services/emotionTypography';
import {analyzePrivacyFrame, VisualPrivacyResult} from './services/visualPrivacyGuardian';
import {evaluateProactiveGuardianState, ProactiveInsight} from './services/proactiveGuardian';
import {buildSchoolZoneStatuses, SchoolZoneStatus} from './services/schoolSpaces';
import {assignSensorPort, evaluateCampusEvent, fetchBridgeHealth, fetchRobotEmotionEvents, fetchSensorPorts, fetchZoneInsight, fetchZoneSensors, pushGuardianSnapshot, pushRobotAssignment, resetBridgeDemoData, sendGuardianHardwareCommand, type RobotEmotionEvent, type ZoneInsightResponse} from './services/hardwareBridge';
import {AlertDetail, AlertRow, MetricCard, NodeRow, RiskPill} from './components/guardianUi';
import {EmotionHeatmap} from './components/EmotionHeatmap';
import {CampusMapSvg} from './components/CampusMapSvg';
import {ZoneSensorPanel} from './components/ZoneSensorPanel';
import {SensorSetupModal} from './components/SensorSetupModal';
import {BridgeStatusPill, GuardianControlPanel, GuardianDriveDock, QuickAlertButton} from './components/GuardianControlPanel';
import {RobotDisplaySync} from './components/RobotDisplaySync';

type ActivePanel = 'alerts' | 'sensing' | 'care' | 'robot' | null;
type RobotDispatchFeedback = {zoneId: string; zoneName: string; stage: '指令送出' | '前往現場' | '老師確認'; createdAt: number; missionId: string} | null;
type RobotDispatchStage = NonNullable<RobotDispatchFeedback>['stage'];
type ZoneInsightDialogState = {zone: SchoolZoneStatus; loading: boolean; result: ZoneInsightResponse | null; error?: string} | null;
type ZoneInsightAssessment = ZoneInsightResponse & {updatedAt: number};
type AutoDispatchTask = {id: string; zoneId: string; riskLevel: Exclude<RiskLevel, 'low'>; reason: string; createdAt: number};
type RobotRoutePoint = {zoneId: string; name: string; location: string};
type RobotTravelState = {
  from: RobotRoutePoint;
  to: RobotRoutePoint;
  riskLevel: RiskLevel;
  statusLabel: string;
  startedAt: number;
  durationMs: number;
} | null;

interface CommandCenterViewModel {
  zones: SchoolZoneStatus[];
  highestZone: SchoolZoneStatus;
  dispatchableZones: SchoolZoneStatus[];
  proactiveInsight: ProactiveInsight;
  openAlerts: GuardianAlert[];
  highPriorityCount: number;
  activeRobotCount: number;
  campusHealthLabel: string;
  signalSummary: Array<{label: string; value: string; tone: 'teal' | 'rose' | 'amber' | 'emerald'}>;
}

function mapToRobotEmotion(mood: MoodType | undefined, riskLevel: string, robotActive: boolean): string {
  if (robotActive) return 'focused';
  if (mood === 'happy') return 'happy';
  if (mood === 'steady') return 'calm';
  if (mood === 'tired') return 'sad';
  if (mood === 'worried') return riskLevel === 'high' ? 'stressed' : 'anxious';
  if (riskLevel === 'high') return 'stressed';
  if (riskLevel === 'medium') return 'anxious';
  return 'happy';
}

const moodOptions: Array<{mood: MoodType; label: string; note: string; tone: string}> = [
  {mood: 'happy', label: '開心', note: '今天有一點亮亮的事', tone: 'border-emerald-300 bg-emerald-400/15 text-emerald-100'},
  {mood: 'steady', label: '還可以', note: '狀態普通，能慢慢做', tone: 'border-sky-300 bg-sky-400/15 text-sky-100'},
  {mood: 'tired', label: '有點累', note: '需要短暫休息一下', tone: 'border-amber-300 bg-amber-400/15 text-amber-100'},
  {mood: 'worried', label: '有點擔心', note: '想找人一起想辦法', tone: 'border-rose-300 bg-rose-400/15 text-rose-100'},
];

const panelNav: Array<{id: Exclude<ActivePanel, null>; label: string; icon: LucideIcon}> = [
  {id: 'alerts', label: '預警', icon: Bell},
  {id: 'sensing', label: '感知', icon: Radar},
  {id: 'care', label: '照護', icon: Leaf},
  {id: 'robot', label: '機器人', icon: Bot},
];

const defaultAcoustic = describeAcousticSignal(0, 0);
const robotDispatchSteps: RobotDispatchStage[] = ['指令送出', '前往現場', '老師確認'];
const ROBOT_TRAVEL_MS = 5000;
const ROBOT_HOME_POINT: RobotRoutePoint = {zoneId: 'robot-home', name: '巡邏底盤', location: '中控待命點'};

function zoneToRobotRoutePoint(zone: SchoolZoneStatus): RobotRoutePoint {
  return {zoneId: zone.id, name: zone.name, location: zone.location};
}

function getRobotStageIndex(stage: RobotDispatchStage | undefined) {
  return stage ? Math.max(0, robotDispatchSteps.indexOf(stage)) : -1;
}

function getRobotStageMeta(stage: RobotDispatchStage | undefined) {
  if (stage === '指令送出') return {label: '送出', detail: '建立任務與備援紀錄', eta: '00:08'};
  if (stage === '前往現場') return {label: '移動', detail: '機器人沿巡邏線前往', eta: '00:04'};
  if (stage === '老師確認') return {label: '確認', detail: '老師收到低壓關懷提示', eta: '完成'};
  return {label: '待命', detail: '選取風險區後可派遣', eta: '--'};
}

function getRobotStageProgress(stage: RobotDispatchStage | undefined) {
  if (stage === '指令送出') return 34;
  if (stage === '前往現場') return 72;
  if (stage === '老師確認') return 100;
  return 0;
}

function getRiskStatusLabel(level: string) {
  if (level === 'high') return '高風險';
  if (level === 'medium') return '注意';
  return '安全';
}

function normalizeRiskLevel(level: unknown): RiskLevel {
  return level === 'high' || level === 'medium' || level === 'low' ? level : 'medium';
}

function getRiskStatusTone(level: string) {
  if (level === 'high') {
    return {
      dot: 'bg-rose-500',
      text: 'text-rose-700',
      soft: 'bg-rose-50 text-rose-700 ring-rose-200',
      panel: 'border-rose-200 bg-rose-50',
      bar: 'bg-rose-500',
    };
  }
  if (level === 'medium') {
    return {
      dot: 'bg-amber-500',
      text: 'text-amber-700',
      soft: 'bg-amber-50 text-amber-700 ring-amber-200',
      panel: 'border-amber-200 bg-amber-50',
      bar: 'bg-amber-500',
    };
  }
  return {
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
    soft: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    panel: 'border-emerald-200 bg-emerald-50',
    bar: 'bg-emerald-500',
  };
}

function getRiskStatusColor(level: string) {
  if (level === 'high') return '#f43f5e';
  if (level === 'medium') return '#f59e0b';
  return '#10b981';
}

const CRISIS_KEYWORDS_UI = ['不想活', '想死', '自殺', '消失', '傷害自己', '活不下去', '尋死', '割腕', '跳樓', '喝農藥', '結束生命', '不想存在'];
const MISSION_STEPS = ['送出', '抵達', '回報'] as const;
const POST_TYPES = ['support', 'gratitude', 'thought'] as const;

function isCrisisMessage(text: string): boolean {
  return CRISIS_KEYWORDS_UI.some((k) => text.includes(k));
}

export default function App() {
  return (
    <TourProvider>
      <AppContent />
      <TourOverlay />
      <IssueReporter storageKey="issues-app3:v1" accentColor="#0d9488" />
      <DemoTimer />
    </TourProvider>
  );
}

function AppContent() {
  const {restartTour} = useTour();
  const [state, dispatch] = useReducer(guardianReducer, undefined, loadGuardianState);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<GuardianAlert | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<MoodType>('steady');
  const [message, setMessage] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postType, setPostType] = useState<'thought' | 'gratitude' | 'support'>('support');
  const [chatBusy, setChatBusy] = useState(false);
  const [postBusy, setPostBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [robotFeedback, setRobotFeedback] = useState<RobotDispatchFeedback>(null);
  const [robotDisplayZoneId, setRobotDisplayZoneId] = useState<string | null>(null);
  const [robotTravel, setRobotTravel] = useState<RobotTravelState>(null);
  const [zoneInsightDialog, setZoneInsightDialog] = useState<ZoneInsightDialogState>(null);
  const [zoneAssessments, setZoneAssessments] = useState<Record<string, ZoneInsightAssessment>>({});
  const [manualEventText, setManualEventText] = useState('');
  const [manualEventZoneId, setManualEventZoneId] = useState('zone-field');
  const [manualEventBusy, setManualEventBusy] = useState(false);
  const [autoDispatchQueue, setAutoDispatchQueue] = useState<AutoDispatchTask[]>([]);
  const [micActive, setMicActive] = useState(false);
  const [micStarting, setMicStarting] = useState(false);
  const [micError, setMicError] = useState('');
  const [acousticLocation, setAcousticLocation] = useState('穿堂');
  const [currentAcoustic, setCurrentAcoustic] = useState(defaultAcoustic);
  const [zoneSensors, setZoneSensors] = useState<ZoneSensorReading[]>([]);
  const [detectedPorts, setDetectedPorts] = useState<DetectedPort[]>([]);
  const [bridgeOnline, setBridgeOnline] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const robotTimersRef = useRef<number[]>([]);
  const robotTravelTimerRef = useRef<number | null>(null);
  const robotTravelRef = useRef<RobotTravelState>(null);
  const robotLocationRef = useRef<SchoolZoneStatus | null>(null);
  const autoDemoRunningRef = useRef(false);
  const autoDemoTimersRef = useRef<number[]>([]);
  const zoneStatusBusyRef = useRef(false);
  const baseZonesRef = useRef<SchoolZoneStatus[]>([]);
  const autoDispatchSeenRef = useRef<Record<string, RiskLevel>>({});
  const robotEmotionCursorRef = useRef<string>('');
  const robotEmotionSeenRef = useRef<Set<string>>(new Set());
  const proxyOnline = useProxyHealth();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const hwStatus = useHardwareSocket('http://localhost:3203');
  const volumeHistoryRef = useRef<number[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const baseViewModel = useMemo(() => buildCommandCenterViewModel(state, zoneSensors), [state, zoneSensors]);
  const viewModel = useMemo(() => applyZoneAssessments(baseViewModel, zoneAssessments), [baseViewModel, zoneAssessments]);
  const selectedZone = useMemo(
    () => viewModel.zones.find((zone) => zone.id === selectedZoneId) ?? viewModel.highestZone,
    [viewModel.zones, viewModel.highestZone, selectedZoneId],
  );
  const robotDisplayZone = useMemo(
    () => robotDisplayZoneId ? viewModel.zones.find((zone) => zone.id === robotDisplayZoneId) ?? null : null,
    [robotDisplayZoneId, viewModel.zones],
  );
  const latestMood = state.moodLogs[0];

  useEffect(() => {
    baseZonesRef.current = baseViewModel.zones;
  }, [baseViewModel.zones]);

  useEffect(() => {
    persistGuardianState(state);
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const [online, readings] = await Promise.all([
          fetchBridgeHealth(),
          fetchZoneSensors(),
        ]);
        if (!cancelled) {
          setZoneSensors(readings);
          setBridgeOnline(online);
        }
      } catch {
        // bridge offline — keep last known state
      }
    };
    poll();
    const timer = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const ports = await fetchSensorPorts();
        if (!cancelled) setDetectedPorts(ports);
      } catch {
        // keep last known ports on transient error
      }
    };
    poll();
    const timer = setInterval(poll, 12000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (!robotFeedback) return;
    const timer = window.setTimeout(() => setRobotFeedback(null), 5600);
    return () => window.clearTimeout(timer);
  }, [robotFeedback]);

  useEffect(() => () => stopAcousticMonitor(), []);
  useEffect(() => () => { robotTimersRef.current.forEach(clearTimeout); robotTimersRef.current = []; }, []);
  useEffect(() => () => {
    if (robotTravelTimerRef.current) window.clearTimeout(robotTravelTimerRef.current);
  }, []);
  useEffect(() => () => { autoDemoTimersRef.current.forEach(clearTimeout); }, []);

  // Hash-based deep-link: guide page chips can link to e.g. ./app3/#sensing
  useEffect(() => {
    const hash = window.location.hash.slice(1) as ActivePanel;
    if (panelNav.find((p) => p.id === hash)) setActivePanel(hash);
  }, []);

  // Keep URL hash in sync with active panel so shared URLs always open correct panel
  useEffect(() => {
    if (activePanel) {
      history.replaceState(null, '', window.location.pathname + '#' + activePanel);
    } else {
      history.replaceState(null, '', window.location.pathname);
    }
  }, [activePanel]);

  // Push real state to robot display (debounced 1500ms to prevent iPad thrashing)
  const snapshotPushRef = useRef<number | null>(null);
  useEffect(() => {
    if (snapshotPushRef.current) clearTimeout(snapshotPushRef.current);
    snapshotPushRef.current = window.setTimeout(() => {
      const insight = viewModel.proactiveInsight;
      const latestMood = state.moodLogs[0];
      const latestAcoustic = state.acousticSignals[0];
      const robotActive = viewModel.activeRobotCount > 0;
      const stress = Math.min(100, Math.round((insight.score / 10) * 100));
      const stability = Math.max(0, 100 - stress);
      const focus = latestAcoustic?.volumeIndex != null
        ? Math.max(10, Math.min(95, 95 - Math.round(latestAcoustic.volumeIndex * 0.7)))
        : 75;
      const s = insight.signals;
      void pushGuardianSnapshot({
        emotion: mapToRobotEmotion(latestMood?.mood, insight.riskLevel, robotActive),
        stress,
        stability,
        focus,
        fusionScore: insight.score,
        signals: {
          moodScore: s.find((x) => x.label === '心情訊號')?.score ?? 0,
          soundScore: 0,
          nodeScore: s.find((x) => x.label === '節點狀態')?.score ?? 0,
          alertScore: s.find((x) => x.label === '未結提醒')?.score ?? 0,
        },
        riskScore: viewModel.highestZone.riskScore,
        riskLabel: insight.riskLevel === 'high' ? '高風險' : insight.riskLevel === 'medium' ? '中風險' : '低風險',
        moodLabel: latestMood?.label ?? '未簽到',
        robotActive,
      });
    }, 1500);
  }, [
    state.moodLogs,
    state.acousticSignals,
    state.robotMissions,
    state.alerts,
    state.nodes,
    viewModel.proactiveInsight,
    viewModel.highestZone.riskScore,
    viewModel.activeRobotCount,
  ]);

  useEffect(() => {
    if (!robotDisplayZone) return;
    if (robotTravel) return;
    const liveFeedback = robotFeedback?.zoneId === robotDisplayZone.id ? robotFeedback : null;
    void pushRobotAssignment({
      zoneId: robotDisplayZone.id,
      zoneName: robotDisplayZone.name,
      location: robotDisplayZone.location,
      riskLevel: robotDisplayZone.riskLevel,
      statusLabel: getRiskStatusLabel(robotDisplayZone.riskLevel),
      stage: liveFeedback?.stage ?? '現場待命',
      missionId: liveFeedback?.missionId ?? null,
      active: Boolean(liveFeedback),
      moving: false,
    });
  }, [
    robotDisplayZone?.id,
    robotDisplayZone?.name,
    robotDisplayZone?.location,
    robotDisplayZone?.riskLevel,
    robotFeedback?.zoneId,
    robotFeedback?.stage,
    robotFeedback?.missionId,
    robotTravel,
  ]);

  const selectZoneForRobotDisplay = useCallback((zone: SchoolZoneStatus): boolean => {
    if (robotTravelRef.current) return false;
    setSelectedZoneId(zone.id);
    setRobotDisplayZoneId(zone.id);
    if (robotLocationRef.current?.id === zone.id) return true;

    const travel: NonNullable<RobotTravelState> = {
      from: robotLocationRef.current ? zoneToRobotRoutePoint(robotLocationRef.current) : ROBOT_HOME_POINT,
      to: zoneToRobotRoutePoint(zone),
      riskLevel: zone.riskLevel,
      statusLabel: getRiskStatusLabel(zone.riskLevel),
      startedAt: Date.now(),
      durationMs: ROBOT_TRAVEL_MS,
    };
    const travelStartedAt = new Date(travel.startedAt).toISOString();
    const travelEndsAt = new Date(travel.startedAt + travel.durationMs).toISOString();
    if (robotTravelTimerRef.current) window.clearTimeout(robotTravelTimerRef.current);
    robotTravelRef.current = travel;
    setRobotTravel(travel);
    void pushRobotAssignment({
      zoneId: zone.id,
      zoneName: zone.name,
      location: zone.location,
      riskLevel: zone.riskLevel,
      statusLabel: getRiskStatusLabel(zone.riskLevel),
      stage: '前往現場',
      missionId: null,
      active: true,
      moving: true,
      travelStartedAt,
      travelEndsAt,
      fromZoneId: travel.from.zoneId,
      fromZoneName: travel.from.name,
      fromLocation: travel.from.location,
    });
    robotTravelTimerRef.current = window.setTimeout(() => {
      robotLocationRef.current = zone;
      robotTravelRef.current = null;
      setRobotTravel(null);
      robotTravelTimerRef.current = null;
    }, ROBOT_TRAVEL_MS);
    return true;
  }, []);

  const showToast = useCallback((text: string) => setToastMessage(text), []);

  const queueAutoDispatch = useCallback((zone: SchoolZoneStatus, reason: string, riskLevelOverride?: Exclude<RiskLevel, 'low'>) => {
    const riskLevel = riskLevelOverride ?? (zone.riskLevel === 'high' ? 'high' : zone.riskLevel === 'medium' ? 'medium' : null);
    if (!riskLevel) return;
    setAutoDispatchQueue((current) => {
      if (robotFeedback?.zoneId === zone.id || current.some((item) => item.zoneId === zone.id)) return current;
      return [
        ...current,
        {id: `auto-${zone.id}-${Date.now().toString(36)}`, zoneId: zone.id, riskLevel, reason, createdAt: Date.now()},
      ];
    });
  }, [robotFeedback?.zoneId]);

  const recordZoneAssessment = useCallback((zone: SchoolZoneStatus, result: ZoneInsightResponse) => {
    setZoneAssessments((current) => ({
      ...current,
      [zone.id]: {...result, updatedAt: Date.now()},
    }));
  }, []);

  const buildZoneInsightPayload = useCallback((zone: SchoolZoneStatus, mode: 'status' | 'detail' = 'detail') => {
    return {
      mode,
      zoneId: zone.id,
      zoneName: zone.name,
      location: zone.location,
      currentStatusLabel: getRiskStatusLabel(zone.riskLevel),
      currentRiskLevel: zone.riskLevel,
      ruleBasedScore: zone.riskScore,
      alertCount: zone.alertCount,
      nodeStatus: zone.nodeStatus,
      sensor: zone.sensor ? {
        temperature: zone.sensor.temp,
        humidity: zone.sensor.hum,
        light: zone.sensor.light,
        status: zone.sensor.connected ? 'online' : 'offline',
      } : undefined,
    };
  }, []);

  const requestZoneInsight = useCallback(async (zone: SchoolZoneStatus, mode: 'status' | 'detail' = 'detail') => {
    const result = await fetchZoneInsight(buildZoneInsightPayload(zone, mode));
    if (mode === 'status') {
      setZoneAssessments((current) => ({
        ...current,
        [zone.id]: {...result, updatedAt: Date.now()},
      }));
    }
    return result;
  }, [buildZoneInsightPayload]);

  const openZoneInsight = useCallback((zone: SchoolZoneStatus) => {
    if (!selectZoneForRobotDisplay(zone)) return;
    setZoneInsightDialog({zone, loading: true, result: null});
    void requestZoneInsight(zone, 'detail').then((result) => {
      setZoneInsightDialog((current) => current?.zone.id === zone.id ? {...current, loading: false, result} : current);
    }).catch((error) => {
      setZoneInsightDialog((current) => current?.zone.id === zone.id ? {
        ...current,
        loading: false,
        result: null,
        error: error instanceof Error ? error.message : String(error),
      } : current);
    });
  }, [requestZoneInsight, selectZoneForRobotDisplay]);

  const refreshAllZoneAssessments = useCallback(async (zones: SchoolZoneStatus[], silent = false) => {
    if (zones.length === 0) return;
    await Promise.allSettled(zones.map(async (zone) => {
      const result = await fetchZoneInsight(buildZoneInsightPayload(zone, 'status'));
      setZoneAssessments((current) => ({
        ...current,
        [zone.id]: {...result, updatedAt: Date.now()},
      }));
    }));
    if (!silent) showToast('三個區域燈號已依感測器數值重新判讀');
  }, [buildZoneInsightPayload, showToast]);

  const refreshZoneStatuses = useCallback(async () => {
    if (zoneStatusBusyRef.current || baseZonesRef.current.length === 0) return;
    zoneStatusBusyRef.current = true;
    try {
      await refreshAllZoneAssessments(baseZonesRef.current, true);
    } finally {
      zoneStatusBusyRef.current = false;
    }
  }, [refreshAllZoneAssessments]);

  useEffect(() => {
    if (!bridgeOnline) return;
    void refreshZoneStatuses();
    const timer = window.setInterval(() => {
      void refreshZoneStatuses();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [bridgeOnline, refreshZoneStatuses]);

  const sendHardwareCue = useCallback((command: string, source: string) => {
    void sendGuardianHardwareCommand(command, source).then((result) => {
      dispatch({
        type: 'RECORD_HARDWARE_EVENT',
        payload: {command, source, status: result.ok ? 'sent' : 'fallback', message: result.message},
      });
      showToast(result.ok ? `硬體已接收：${command}` : `硬體備援：${result.message}`);
    }).catch(() => {
      showToast('硬體指令發送失敗，使用備援模式');
    });
  }, [showToast]);

  const dispatchRobotToZone = useCallback((zone: SchoolZoneStatus) => {
    if (robotTravelRef.current) {
      showToast('機器人移動中，地圖暫時鎖定');
      return;
    }
    if (!selectZoneForRobotDisplay(zone)) return;
    if (robotFeedback?.zoneId === zone.id) {
      showToast(`${zone.name} 任務已在進行中`);
      return;
    }
    const createdAt = Date.now();
    robotTimersRef.current.forEach(clearTimeout);
    robotTimersRef.current = [];
    setRobotFeedback({zoneId: zone.id, zoneName: zone.name, stage: '指令送出', createdAt, missionId: `R-${createdAt.toString().slice(-4)}`});
    robotTimersRef.current.push(window.setTimeout(() => {
      setRobotFeedback((current) => current?.createdAt === createdAt ? {...current, stage: '前往現場'} : current);
      dispatch({type: 'UPDATE_ROBOT_MISSION_STATUS', payload: {zoneName: zone.name, status: 'arrived'}});
    }, 1200));
    robotTimersRef.current.push(window.setTimeout(() => {
      setRobotFeedback((current) => current?.createdAt === createdAt ? {...current, stage: '老師確認'} : current);
      dispatch({type: 'UPDATE_ROBOT_MISSION_STATUS', payload: {zoneName: zone.name, status: 'completed'}});
    }, 3200));
    robotTimersRef.current.push(window.setTimeout(() => setRobotFeedback((current) => current?.createdAt === createdAt ? null : current), 7200));
    dispatch({type: 'DISPATCH_ROBOT', payload: {zoneName: zone.name, riskScore: zone.riskScore, command: 'ROBOT_DISPATCH'}});
    sendHardwareCue('CARE_DEPLOYED', `app3:robot:${zone.id}`);
    showToast(`已指派機器人前往${zone.name}`);
  }, [robotFeedback, showToast, sendHardwareCue, selectZoneForRobotDisplay]);

  const submitManualEvent = useCallback(async () => {
    const eventText = manualEventText.trim();
    const zone = viewModel.zones.find((item) => item.id === manualEventZoneId) ?? selectedZone;
    if (!eventText || !zone || manualEventBusy) return;
    setManualEventBusy(true);
    const result = await evaluateCampusEvent({
      zoneId: zone.id,
      zoneName: zone.name,
      location: zone.location,
      eventText,
      source: 'manual',
    });
    const riskLevel: Exclude<RiskLevel, 'low'> = result.riskLevel === 'high' ? 'high' : 'medium';
    const normalizedResult: ZoneInsightResponse = {
      ...result,
      riskLevel,
      statusLabel: riskLevel === 'high' ? '高風險' : '注意',
      summary: result.summary || eventText,
    };
    dispatch({
      type: 'CREATE_CONTEXT_ALERT',
      payload: {
        location: zone.location,
        type: '手動輸入事件',
        description: `${normalizedResult.summary} 原始紀錄：${eventText}`,
        riskLevel,
        category: '手動事件',
        studentAlias: '值勤老師回報',
      },
    });
    recordZoneAssessment(zone, normalizedResult);
    queueAutoDispatch(zone, `手動事件：${normalizedResult.statusLabel}`, riskLevel);
    setManualEventText('');
    setActivePanel('alerts');
    setManualEventBusy(false);
    showToast(`已加入${zone.name}事件：${normalizedResult.statusLabel}`);
  }, [manualEventText, manualEventZoneId, manualEventBusy, viewModel.zones, selectedZone, recordZoneAssessment, queueAutoDispatch, showToast]);

  const handleRobotEmotionEvent = useCallback((event: RobotEmotionEvent) => {
    if (robotEmotionSeenRef.current.has(event.id)) return;
    robotEmotionSeenRef.current.add(event.id);
    const zone = viewModel.zones.find((item) => item.id === event.zoneId)
      ?? viewModel.zones.find((item) => event.zoneName.includes(item.name) || event.location.includes(item.name))
      ?? viewModel.zones.find((item) => item.id === 'zone-field')
      ?? viewModel.highestZone;
    const riskLevel: Exclude<RiskLevel, 'low'> = event.riskLevel === 'high' ? 'high' : 'medium';
    const statusLabel = riskLevel === 'high' ? '高風險' : '注意';
    const summary = `${event.zoneName || zone.name}偵測到「${event.emotionLabel || event.emotion}」情緒，建議老師確認現場。`;
    dispatch({
      type: 'CREATE_CONTEXT_ALERT',
      payload: {
        location: zone.location,
        type: '機器人情緒判斷',
        description: event.description || summary,
        riskLevel,
        category: '情緒判斷',
        studentAlias: '機器人前端',
      },
    });
    recordZoneAssessment(zone, {
      ok: true,
      source: event.source || 'robot-display',
      model: null,
      riskLevel,
      statusLabel,
      confidence: riskLevel === 'high' ? 88 : 66,
      summary,
      situations: [event.description || summary],
      suggestions: ['請機器人或值勤老師先前往確認，保持低壓關懷。'],
    });
    queueAutoDispatch(zone, `情緒事件：${event.emotionLabel || event.emotion}`, riskLevel);
    showToast(`機器人回報${zone.name}情緒事件：${statusLabel}`);
  }, [viewModel.zones, viewModel.highestZone, recordZoneAssessment, queueAutoDispatch, showToast]);

  useEffect(() => {
    if (!bridgeOnline) return;
    let stopped = false;
    const pull = async () => {
      const events = await fetchRobotEmotionEvents(robotEmotionCursorRef.current || undefined);
      if (stopped || events.length === 0) return;
      const sorted = [...events].sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
      for (const event of sorted) {
        handleRobotEmotionEvent(event);
        if (!robotEmotionCursorRef.current || Date.parse(event.updatedAt) > Date.parse(robotEmotionCursorRef.current)) {
          robotEmotionCursorRef.current = event.updatedAt;
        }
      }
    };
    void pull();
    const timer = window.setInterval(() => void pull(), 1800);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [bridgeOnline, handleRobotEmotionEvent]);

  useEffect(() => {
    for (const zone of viewModel.zones) {
      if (zone.riskLevel === 'low') {
        delete autoDispatchSeenRef.current[zone.id];
        continue;
      }
      const previous = autoDispatchSeenRef.current[zone.id];
      if (previous === zone.riskLevel) continue;
      autoDispatchSeenRef.current[zone.id] = zone.riskLevel;
      queueAutoDispatch(zone, `區域燈號變為${getRiskStatusLabel(zone.riskLevel)}`);
    }
  }, [viewModel.zones, queueAutoDispatch]);

  useEffect(() => {
    if (robotFeedback || robotTravel || autoDispatchQueue.length === 0) return;
    const next = [...autoDispatchQueue].sort((a, b) => {
      const riskDelta = (b.riskLevel === 'high' ? 2 : 1) - (a.riskLevel === 'high' ? 2 : 1);
      return riskDelta || a.createdAt - b.createdAt;
    })[0];
    if (!next) return;
    const zone = viewModel.zones.find((item) => item.id === next.zoneId);
    setAutoDispatchQueue((current) => current.filter((item) => item.id !== next.id));
    if (!zone || zone.riskLevel === 'low') return;
    dispatchRobotToZone(zone);
    showToast(`自動派遣：${zone.name}（${next.reason}）`);
  }, [autoDispatchQueue, robotFeedback, robotTravel, viewModel.zones, dispatchRobotToZone, showToast]);

  const createProactiveAlert = useCallback(() => {
    dispatch({type: 'CREATE_PROACTIVE_ALERT', payload: viewModel.proactiveInsight});
    sendHardwareCue('ALERT_SIGNAL', 'app3:proactive');
    setActivePanel('alerts');
    showToast('AI 主動巡查已建立提醒');
  }, [viewModel.proactiveInsight, sendHardwareCue, showToast]);

  const recordAcousticSignal = useCallback((signal: Omit<AcousticSignal, 'id' | 'createdAt'>) => {
    dispatch({type: 'RECORD_ACOUSTIC_SIGNAL', payload: signal});
    showToast('已記錄本機環境紀錄');
  }, [showToast]);

  const createAcousticAlert = useCallback(() => {
    if (!acousticLocation.trim()) { showToast('請先輸入感測位置再建立提醒'); return; }
    dispatch({
      type: 'CREATE_ACOUSTIC_ALERT',
      payload: {
        location: acousticLocation,
        level: currentAcoustic.level,
        volumeIndex: currentAcoustic.volumeIndex,
        volatility: currentAcoustic.volatility,
        summary: currentAcoustic.summary,
      },
    });
    sendHardwareCue('ALERT_SIGNAL', 'app3:acoustic');
    setActivePanel('alerts');
    showToast('已由環境聲量建立提醒');
  }, [acousticLocation, currentAcoustic, sendHardwareCue, showToast]);

  const handleMood = useCallback((mood: MoodType, noteOverride?: string) => {
    const option = moodOptions.find((item) => item.mood === mood) ?? moodOptions[1];
    setSelectedMood(mood);
    dispatch({type: 'ADD_MOOD', payload: {mood, label: option.label, note: noteOverride ?? option.note}});
  }, []);

  const addPost = async () => {
    const content = postContent.trim();
    if (!content || postBusy) return;
    setPostBusy(true);
    const postId = `post-${Date.now().toString(36)}-${Math.floor(Math.random() * 900 + 100)}`;
    dispatch({type: 'ADD_FOREST_POST', payload: {id: postId, content, type: postType}});
    setPostContent('');
    showToast('匿名支持已加入心靈森林');
    try {
      const reply = await generateSupportReply(content, selectedMood, undefined, undefined);
      dispatch({type: 'SET_FOREST_POST_REPLY', payload: {id: postId, botReply: reply}});
    } catch {
      // silent — bot reply is a bonus, not critical
    } finally {
      setPostBusy(false);
    }
  };

  const sendMessage = async () => {
    const text = message.trim();
    if (!text || chatBusy) return;
    setMessage('');
    dispatch({type: 'ADD_SUPPORT_MESSAGE', payload: {role: 'student', content: text}});
    setChatBusy(true);
    try {
      const alertSummary = viewModel.openAlerts?.length > 0
        ? `${viewModel.openAlerts.length} 則待處理警報`
        : undefined;
      const reply = await generateSupportReply(text, selectedMood, acousticLocation, alertSummary);
      dispatch({type: 'ADD_SUPPORT_MESSAGE', payload: {role: 'guardian', content: reply}});
    } catch {
      dispatch({type: 'ADD_SUPPORT_MESSAGE', payload: {role: 'guardian', content: '暫時無法回應，請稍後再試。'}});
      showToast('守護者暫時無法回應，請稍後再試');
    } finally {
      setChatBusy(false);
    }
  };

  const stopAcousticMonitor = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    analyserRef.current = null;
    setMicActive(false);
  };

  const startAcousticMonitor = async () => {
    if (micActive) {
      stopAcousticMonitor();
      return;
    }
    if (micStarting) return;
    setMicStarting(true);
    try {
      setMicError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {echoCancellation: true, noiseSuppression: false, autoGainControl: false},
      });
      try {
        const AudioContextCtor = window.AudioContext || (window as typeof window & {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
        if (!AudioContextCtor) throw new Error('AudioContext unavailable');
        const audioContext = new AudioContextCtor();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        audioContext.createMediaStreamSource(stream).connect(analyser);
        mediaStreamRef.current = stream;
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        setMicActive(true);

        const buffer = new Uint8Array(analyser.fftSize);
        let rafFrameCount = 0;
        const tick = () => {
          analyser.getByteTimeDomainData(buffer);
          const reading = analyzeAcousticFrame(buffer, volumeHistoryRef.current);
          volumeHistoryRef.current = [...volumeHistoryRef.current.slice(-24), reading.volumeIndex];
          rafFrameCount = (rafFrameCount + 1) % 6;
          if (rafFrameCount === 0) setCurrentAcoustic(reading);
          animationFrameRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch (setupError) {
        stream.getTracks().forEach((track) => track.stop());
        throw setupError;
      }
    } catch {
      setMicError('麥克風不可用（請確認瀏覽器權限或裝置硬體），可改用示範訊號。');
      showToast('麥克風權限未開啟，可改用示範聲量');
    } finally {
      setMicStarting(false);
    }
  };

  const runAutoDemo = useCallback(() => {
    if (autoDemoRunningRef.current) { showToast('示範進行中，請稍後再試'); return; }
    autoDemoRunningRef.current = true;
    autoDemoTimersRef.current.forEach(clearTimeout);
    autoDemoTimersRef.current = [];
    dispatch({type: 'RESET_DEMO'});
    showToast('自動示範開始，3 步快速展示全流程…');
    autoDemoTimersRef.current.push(window.setTimeout(() => {
      dispatch({type: 'CREATE_PROACTIVE_ALERT', payload: viewModel.proactiveInsight});
      setActivePanel('alerts');
      showToast('① AI 主動巡查偵測到異常，建立預警');
    }, 800));
    autoDemoTimersRef.current.push(window.setTimeout(() => {
      const elevated = {source: 'demo' as const, location: '穿堂', level: 'elevated' as const, volumeIndex: 72, volatility: 34, summary: '示範：下課時間穿堂聲量偏高，AI 融合多來源訊號建議低壓確認。'};
      dispatch({type: 'RECORD_ACOUSTIC_SIGNAL', payload: elevated});
      setActivePanel('sensing');
      showToast('② 環境聲量偏高訊號已記錄到感知中心');
    }, 2400));
    autoDemoTimersRef.current.push(window.setTimeout(() => {
      dispatchRobotToZone(viewModel.highestZone);
      setActivePanel('robot');
      showToast('③ 機器人已派往最高風險區，任務追蹤中');
    }, 4200));
    autoDemoTimersRef.current.push(window.setTimeout(() => {
      autoDemoRunningRef.current = false;
      autoDemoTimersRef.current = [];
    }, 5200));
  }, [dispatch, viewModel.proactiveInsight, viewModel.highestZone, showToast, dispatchRobotToZone]);

  const exportDemoData = () => {
    const blob = new Blob([JSON.stringify({app: 'AI 校園心靈守護者', exportedAt: new Date().toISOString(), state}, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `mindful-guardian-demo-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast('展示資料已匯出');
  };

  const importDemoData = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      dispatch({type: 'RESTORE_DEMO_STATE', payload: {state: normalizeGuardianState(parsed.state ?? parsed)}});
      showToast('展示資料已匯入並完成匿名安全修復');
    } catch {
      showToast('匯入失敗，請選擇展示資料檔');
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  return (
    <div className="guardian-shell min-h-screen overflow-x-hidden bg-[linear-gradient(160deg,#f5f9fc_0%,#eef3f8_60%,#e8f0f7_100%)] text-slate-950">
      <HardwareStatusBanner status={hwStatus} />
      <CommandFeedbackToast lastCommandAck={hwStatus.lastCommandAck} />
      <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void importDemoData(event.target.files?.[0])} />
      <Toast message={toastMessage} />

      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/95 shadow-[0_1px_12px_rgba(15,23,42,0.06)] backdrop-blur-xl">

        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button className="flex min-w-0 items-center gap-3 text-left" onClick={() => setActivePanel(null)}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-teal-500 to-teal-700 text-white shadow-md shadow-teal-200/60">
              <HeartHandshake className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="line-clamp-1 text-base font-black tracking-tight sm:text-xl">AI 校園心靈守護者</h1>
              <p className="text-[10px] font-black text-teal-600">校園關懷中控</p>
            </div>
          </button>

          {/* Bridge + campus health status */}
          <div className="hidden items-center gap-2 md:flex">
            <BridgeStatusPill online={bridgeOnline} sensorCount={zoneSensors.filter((s) => s.connected).length} />
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {viewModel.campusHealthLabel}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick alert — always one tap away */}
            <QuickAlertButton disabled={!bridgeOnline} />
            {/* Sensor setup button */}
            <button
              onClick={() => setShowSetup(true)}
              className="relative flex min-h-11 min-w-11 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 shadow-sm transition hover:border-teal-200 hover:text-teal-700"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">感測器</span>
              {detectedPorts.some((p) => !p.assignedZone) && (
                <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[8px] font-black text-white shadow">
                  !
                </span>
              )}
            </button>
            <button onClick={restartTour} className="hidden min-h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 shadow-sm transition hover:border-teal-200 hover:text-teal-700 md:block">
              導覽
            </button>
            <button
              onClick={runAutoDemo}
              className="hidden min-h-10 rounded-xl border border-teal-200 bg-teal-50 px-4 text-xs font-black text-teal-700 shadow-sm transition hover:bg-teal-100 md:block"
              title="自動執行完整示範流程（預警→感知→機器人）"
            >
              自動示範
            </button>
            <IconButton
              onClick={() => {
                dispatch({type: 'RESET_DEMO'});
                void resetBridgeDemoData();
                showToast('展示資料已重置');
              }}
              label="重設展示資料"
              icon={RefreshCw}
              emphasis
            />
          </div>
        </div>
      </header>

      {/* Proxy Health Banner — below header so it never covers navigation */}
      {proxyOnline === false && !bannerDismissed && (
        <div className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <span>⚠️ AI 雲端功能暫時離線，系統切換為本機示範模式</span>
          <button
            onClick={() => setBannerDismissed(true)}
            aria-label="關閉提示"
            className="flex h-11 w-11 shrink-0 items-center justify-center font-medium text-amber-600 hover:text-amber-900"
          >
            ✕
          </button>
        </div>
      )}

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 pb-28 sm:px-6 lg:pb-20 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <CommandCenterScreen
            viewModel={viewModel}
            selectedZone={selectedZone}
            selectedZoneId={selectedZoneId}
            robotFeedback={robotFeedback}
            robotTravel={robotTravel}
            zoneAssessments={zoneAssessments}
            onSelectZone={selectZoneForRobotDisplay}
            onOpenZoneInsight={openZoneInsight}
            onOpenPanel={setActivePanel}
            onCreateProactiveAlert={createProactiveAlert}
            onDispatchRobot={dispatchRobotToZone}
          />

        <aside className="hidden lg:flex lg:flex-col gap-4 lg:sticky lg:top-21 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          {/* Top open alerts */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="mb-2 text-[10px] font-black tracking-widest text-slate-400 uppercase">需注意狀況</p>
            {viewModel.openAlerts.length === 0 ? (
              <p className="text-xs text-slate-400 font-bold py-1">目前無待處理預警</p>
            ) : viewModel.openAlerts.slice(0, 4).map((alert) => (
              <button
                key={alert.id}
                onClick={() => setActivePanel('alerts')}
                className="w-full text-left mb-1.5 last:mb-0 flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition hover:bg-rose-50"
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${alert.riskLevel === 'high' ? 'bg-rose-500' : alert.riskLevel === 'medium' ? 'bg-amber-400' : 'bg-teal-400'}`} />
                <span className="truncate text-slate-700">{alert.location} — {alert.description}</span>
              </button>
            ))}
            <button onClick={() => setActivePanel('alerts')} className="mt-2 w-full rounded-xl bg-slate-50 min-h-11 py-1.5 text-[10px] font-black text-slate-500 transition hover:bg-rose-50 hover:text-rose-600">
              查看全部 →
            </button>
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10px] font-black tracking-widest text-teal-700 uppercase">手動新增事件</p>
                <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black text-slate-400 ring-1 ring-slate-200">LLM 分級</span>
              </div>
              <select
                value={manualEventZoneId}
                onChange={(event) => setManualEventZoneId(event.target.value)}
                className="mb-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none focus:border-teal-500"
              >
                {viewModel.zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>{zone.name} · {zone.location}</option>
                ))}
              </select>
              <textarea
                value={manualEventText}
                onChange={(event) => setManualEventText(event.target.value)}
                maxLength={180}
                rows={3}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold leading-5 text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                placeholder="例：操場有學生情緒低落、不願回教室..."
              />
              <button
                onClick={() => void submitManualEvent()}
                disabled={!manualEventText.trim() || manualEventBusy}
                className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-3 text-xs font-black text-white transition hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-500"
              >
                {manualEventBusy && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                {manualEventBusy ? '判斷中' : '加入需注意狀況'}
              </button>
            </div>
          </div>
          <div data-tour="zone-inspector" className="flex-1"><ZoneInspector zone={selectedZone} robotFeedback={robotFeedback} onDispatchRobot={dispatchRobotToZone} /></div>
          <div data-tour="panel-dock"><PanelDock activePanel={activePanel} onOpenPanel={setActivePanel} onShowDemo={restartTour} /></div>
          {/* 機器人顯示同步面板 */}
          <RobotDisplaySync
            latestMood={latestMood?.mood}
            alertCount={viewModel.highPriorityCount}
          />
        </aside>
      </main>

      {/* Mobile bottom 3-tab nav */}
      <nav className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t border-slate-200/80 bg-white/95 backdrop-blur-xl grid grid-cols-4">
        {panelNav.map((item) => (
          <button
            key={item.id}
            onClick={() => setActivePanel(activePanel === item.id ? null : item.id)}
            className={`flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-black transition-colors ${
              activePanel === item.id ? 'text-teal-600 bg-teal-50/60' : 'text-slate-500 hover:text-teal-600'
            }`}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="hidden lg:block"><GuardianDriveDock bridgeOnline={bridgeOnline} /></div>

      <DetailDrawer
        activePanel={activePanel}
        state={state}
        selectedAlert={selectedAlert}
        setSelectedAlert={setSelectedAlert}
        latestMood={latestMood}
        selectedMood={selectedMood}
        message={message}
        setMessage={setMessage}
        postContent={postContent}
        setPostContent={setPostContent}
        postType={postType}
        setPostType={setPostType}
        chatBusy={chatBusy}
        postBusy={postBusy}
        micActive={micActive}
        micError={micError}
        currentAcoustic={currentAcoustic}
        acousticLocation={acousticLocation}
        setAcousticLocation={setAcousticLocation}
        proactiveInsight={viewModel.proactiveInsight}
        robotFeedback={robotFeedback}
        onClose={() => setActivePanel(null)}
        onMood={handleMood}
        onAddPost={addPost}
        onSendMessage={sendMessage}
        onStartAcoustic={startAcousticMonitor}
        onRecordAcoustic={recordAcousticSignal}
        onCreateAcousticAlert={createAcousticAlert}
        onCreateProactiveAlert={createProactiveAlert}
        onDemoSound={() => {
          const demo = describeAcousticSignal(55 + Math.floor(Math.random() * 35), 18 + Math.floor(Math.random() * 28));
          setCurrentAcoustic(demo);
          recordAcousticSignal({source: 'demo', location: acousticLocation, ...demo});
        }}
        onRestartNode={(id) => {
          dispatch({type: 'RESTART_NODE', payload: {id}});
          sendHardwareCue('NODE_RESTART', `app3:node:${id}`);
        }}
        onDispatchRobot={(zone) => dispatchRobotToZone(zone)}
        onHardwareCommand={(command, source) => sendHardwareCue(command, `app3:${source}`)}
        dispatch={dispatch}
        zones={viewModel.zones}
        bridgeOnline={bridgeOnline}
        sensors={zoneSensors}
      />

      {/* Sensor setup modal */}
      <AnimatePresence>
        {showSetup && (
          <SensorSetupModal
            ports={detectedPorts}
            sensors={zoneSensors}
            onClose={() => setShowSetup(false)}
            onChanged={async () => {
              const ports = await fetchSensorPorts();
              setDetectedPorts(ports);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {zoneInsightDialog && (
          <ZoneInsightDialog
            insight={zoneInsightDialog}
            onRefresh={(zone) => {
              setZoneInsightDialog((current) => current?.zone.id === zone.id ? {...current, loading: true, error: undefined} : current);
              void requestZoneInsight(zone, 'detail').then((result) => {
                setZoneInsightDialog((current) => current?.zone.id === zone.id ? {...current, loading: false, result} : current);
              });
            }}
            onClose={() => setZoneInsightDialog(null)}
          />
        )}
      </AnimatePresence>

    </div>
  );
}

function buildCommandCenterViewModel(state: GuardianState, sensorReadings: ZoneSensorReading[] = []): CommandCenterViewModel {
  const zones = buildSchoolZoneStatuses(state, sensorReadings);
  const highestZone = [...zones].sort((a, b) => b.riskScore - a.riskScore)[0] ?? zones[0];
  const dispatchableZones = zones.filter((zone) => zone.riskLevel !== 'low');
  const proactiveInsight = evaluateProactiveGuardianState(state);
  const openAlerts = state.alerts.filter((alert) => alert.status !== 'resolved');
  const highPriorityCount = openAlerts.filter((alert) => alert.riskLevel === 'high').length;
  const activeRobotCount = state.robotMissions.filter((mission) => mission.status !== 'completed').length;
  const offlineNodeCount = state.nodes.filter((node) => node.status === 'offline').length;
  const onlineSensorCount = sensorReadings.filter((sensor) => sensor.connected).length;
  const campusHealthLabel = highestZone?.riskLevel === 'high' ? '高風險區需立即確認' : highestZone?.riskLevel === 'medium' ? '校園有區域需觀察' : '全校維持穩定巡查';
  const signalSummary: CommandCenterViewModel['signalSummary'] = [
    {label: '待關懷提醒', value: `${openAlerts.length} 則`, tone: openAlerts.length > 3 ? 'amber' : 'teal'},
    {label: '高優先處理', value: `${highPriorityCount} 則`, tone: highPriorityCount > 0 ? 'rose' : 'emerald'},
    {label: '感測器', value: `${onlineSensorCount}/3 在線`, tone: onlineSensorCount >= 3 ? 'emerald' : 'amber'},
    {label: '節點狀態', value: `${offlineNodeCount} 離線`, tone: offlineNodeCount > 0 ? 'rose' : 'emerald'},
  ];

  return {zones, highestZone, dispatchableZones, proactiveInsight, openAlerts, highPriorityCount, activeRobotCount, campusHealthLabel, signalSummary};
}

function applyZoneAssessments(viewModel: CommandCenterViewModel, assessments: Record<string, ZoneInsightAssessment>): CommandCenterViewModel {
  const zones = viewModel.zones.map((zone) => {
    const assessment = assessments[zone.id];
    if (!assessment) return zone;
    const riskLevel = normalizeRiskLevel(assessment.riskLevel);
    const confidence = typeof assessment.confidence === 'number' ? assessment.confidence : riskLevel === 'high' ? 86 : riskLevel === 'medium' ? 58 : 26;
    const levelBase = riskLevel === 'high' ? 72 : riskLevel === 'medium' ? 46 : 18;
    const riskScore = Math.max(0, Math.min(100, Math.round(levelBase + confidence * 0.18)));
    return {
      ...zone,
      riskLevel,
      riskScore,
      stability: Math.max(0, 100 - riskScore),
      summary: assessment.summary || zone.summary,
    };
  });
  const highestZone = [...zones].sort((a, b) => b.riskScore - a.riskScore)[0] ?? zones[0];
  const dispatchableZones = zones.filter((zone) => zone.riskLevel !== 'low');
  const campusHealthLabel = highestZone?.riskLevel === 'high' ? '高風險區需立即確認' : highestZone?.riskLevel === 'medium' ? '校園有區域需觀察' : '全校維持穩定巡查';
  return {...viewModel, zones, highestZone, dispatchableZones, campusHealthLabel};
}

function CommandCenterScreen({
  viewModel,
  selectedZone,
  selectedZoneId,
  robotFeedback,
  robotTravel,
  zoneAssessments,
  onSelectZone,
  onOpenZoneInsight,
  onOpenPanel,
  onCreateProactiveAlert,
  onDispatchRobot,
}: {
  viewModel: CommandCenterViewModel;
  selectedZone: SchoolZoneStatus;
  selectedZoneId: string | null;
  robotFeedback: RobotDispatchFeedback;
  robotTravel: RobotTravelState;
  zoneAssessments: Record<string, ZoneInsightAssessment>;
  onSelectZone: (zone: SchoolZoneStatus) => void;
  onOpenZoneInsight: (zone: SchoolZoneStatus) => void;
  onOpenPanel: (panel: ActivePanel) => void;
  onCreateProactiveAlert: () => void;
  onDispatchRobot: (zone: SchoolZoneStatus) => void;
}) {
  return (
    <section className="grid gap-4 lg:min-h-[calc(100vh-6.5rem)] lg:grid-rows-[auto_minmax(0,1fr)_auto]">
      <div data-tour="signal-overview">
        <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-linear-to-br from-white to-teal-50/40 shadow-sm">
          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-black text-teal-600 tracking-wide">校園指揮中心</p>
                <h2 className="mt-1.5 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">校園即時總覽</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">{viewModel.campusHealthLabel}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center sm:min-w-[16rem]">
                <SignalTile label="最高風險" value={getRiskStatusLabel(viewModel.highestZone.riskLevel)} tone={viewModel.highestZone.riskLevel === 'high' ? 'rose' : viewModel.highestZone.riskLevel === 'medium' ? 'amber' : 'emerald'} />
                <SignalTile label="機器人" value={viewModel.activeRobotCount.toString()} tone="emerald" />
              </div>
            </div>
          </div>
          {/* risk level accent bar */}
          <div className={`h-1 w-full ${viewModel.highestZone.riskLevel === 'high' ? 'bg-linear-to-r from-rose-400 to-rose-600' : viewModel.highestZone.riskLevel === 'medium' ? 'bg-linear-to-r from-amber-300 to-amber-500' : 'bg-linear-to-r from-teal-300 to-teal-500'}`} />
        </div>
      </div>

      <div data-tour="campus-map">
        <CampusMap2D zones={viewModel.zones} selectedZone={selectedZone} selectedZoneId={selectedZoneId} robotFeedback={robotFeedback} robotTravel={robotTravel} zoneAssessments={zoneAssessments} onSelectZone={onSelectZone} onOpenZoneInsight={onOpenZoneInsight} onDispatchRobot={onDispatchRobot} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <OperationsBrief viewModel={viewModel} onOpenPanel={onOpenPanel} />
        <div data-tour="dispatch-robot">
          <Surface className="h-full p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black text-slate-500">最高風險區</p>
                <h3 className="mt-1 text-2xl font-black text-slate-950">{viewModel.highestZone.name}</h3>
              </div>
              <StatusChip level={viewModel.highestZone.riskLevel} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <MetricTile label="燈號" value={getRiskStatusLabel(viewModel.highestZone.riskLevel)} />
              <MetricTile label="感測" value={viewModel.highestZone.sensor?.connected ? '在線' : '離線'} />
              <MetricTile label="提醒" value={viewModel.highestZone.alertCount} />
            </div>
            <PrimaryAction
              onClick={() => onDispatchRobot(viewModel.highestZone)}
              disabled={viewModel.highestZone.riskLevel === 'low' || Boolean(robotTravel)}
              active={robotFeedback?.zoneId === viewModel.highestZone.id || Boolean(robotTravel)}
              className="mt-4"
            >
              <Bot className={`h-5 w-5 ${robotFeedback?.zoneId === viewModel.highestZone.id || robotTravel ? 'animate-pulse' : ''}`} />
              {robotTravel ? '機器人移動中' : viewModel.highestZone.riskLevel === 'low' ? '維持一般巡查' : robotFeedback?.zoneId === viewModel.highestZone.id ? '已送出派遣' : '派遣機器人介入'}
            </PrimaryAction>
          </Surface>
        </div>
      </div>
    </section>
  );
}

const ZONE_EMOJI: Record<string, string> = {
  'zone-library': '📚',
  'zone-hall': '🚶',
  'zone-field': '⚽',
};

const ZONE_IDENTITY: Record<string, {bg: string; border: string; dot: string}> = {
  'zone-library': {bg: 'bg-blue-50/95',    border: 'border-blue-300',    dot: 'bg-blue-500'},
  'zone-hall':    {bg: 'bg-emerald-50/95', border: 'border-emerald-300', dot: 'bg-emerald-500'},
  'zone-field':   {bg: 'bg-emerald-50/95', border: 'border-emerald-300', dot: 'bg-emerald-500'},
};
const ZONE_IDENTITY_FALLBACK = {bg: 'bg-white/95', border: 'border-slate-200', dot: 'bg-slate-400'};

function CampusMap2D({
  zones,
  selectedZone,
  selectedZoneId,
  robotFeedback,
  robotTravel,
  zoneAssessments,
  onSelectZone,
  onOpenZoneInsight,
  onDispatchRobot,
}: {
  zones: SchoolZoneStatus[];
  selectedZone: SchoolZoneStatus;
  selectedZoneId: string | null;
  robotFeedback: RobotDispatchFeedback;
  robotTravel: RobotTravelState;
  zoneAssessments: Record<string, ZoneInsightAssessment>;
  onSelectZone: (zone: SchoolZoneStatus) => void;
  onOpenZoneInsight: (zone: SchoolZoneStatus) => void;
  onDispatchRobot: (zone: SchoolZoneStatus) => void;
}) {
  const selectedLeft = Math.min(selectedZone.x, 76);
  const mapLocked = Boolean(robotTravel);
  const activeDispatch = robotFeedback?.zoneId === selectedZone.id || robotTravel?.to.zoneId === selectedZone.id;
  const dispatchProgress = getRobotStageProgress(activeDispatch ? robotFeedback?.stage : undefined);
  const travelColor = getRiskStatusColor(robotTravel?.riskLevel ?? selectedZone.riskLevel);

  return (
    <Surface className="relative overflow-hidden p-3 sm:p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black text-teal-600">校園平面圖</p>
          <h3 className="text-xl font-black text-slate-950">區域狀態</h3>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-black text-slate-500">
          <LegendDot tone="emerald" label="安全" />
          <LegendDot tone="amber" label="注意" />
          <LegendDot tone="rose" label="高風險" />
        </div>
      </div>
      <ZoneStatusBar
        zones={zones}
        selectedZoneId={selectedZone.id}
        robotFeedback={robotFeedback}
        zoneAssessments={zoneAssessments}
        onSelectZone={onSelectZone}
        onOpenZoneInsight={onOpenZoneInsight}
      />
      <div className="relative min-h-112 overflow-hidden rounded-2xl border border-slate-200/80 bg-[linear-gradient(145deg,#eef4fb,#e6f0f9)] shadow-inner lg:min-h-152">
        <CampusMapSvg
          zones={zones.map((z) => ({id: z.id, riskLevel: z.riskLevel}))}
          selectedZoneId={selectedZoneId}
          onZoneClick={(id) => {
            if (mapLocked) return;
            const zone = zones.find((z) => z.id === id);
            if (zone) onSelectZone(zone);
          }}
        />
        <div
          className={`robot-route-line absolute z-8 h-1.5 origin-left rounded-full ${activeDispatch ? 'opacity-100' : 'opacity-0'}`}
          style={{
            left: '48%',
            top: '48%',
            width: `${Math.max(8, Math.min(30, Math.abs(selectedLeft - 48) + Math.abs(Math.min(selectedZone.y + 16, 82) - 48) / 2))}%`,
            transform: `rotate(${selectedLeft > 48 ? -18 : 28}deg)`,
          }}
        />
        <div
          className={`robot-marker absolute z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-2xl border border-teal-200 bg-white text-teal-700 shadow-xl shadow-teal-200/60 ${activeDispatch ? 'robot-marker-active' : ''}`}
          style={{left: `${selectedLeft + 8}%`, top: `${Math.min(selectedZone.y + 16, 82)}%`}}
        >
          <div className="absolute -right-1.5 -top-1.5 rounded-full bg-teal-600 px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm">
            {robotFeedback?.missionId ?? 'R-01'}
          </div>
          <Bot className="h-6 w-6" />
          <span className="text-[9px] font-black text-slate-500 leading-none">{activeDispatch ? robotFeedback?.stage : '待命'}</span>
        </div>
        <div className="absolute bottom-3 left-3 right-3 z-30 rounded-2xl border border-white/60 bg-white/88 p-3 shadow-xl shadow-slate-300/30 backdrop-blur-md">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
            <div>
              <p className="text-xs font-black text-slate-500">選取區域</p>
              <p className="font-black text-slate-950">{selectedZone.name} · {getRiskStatusLabel(selectedZone.riskLevel)}</p>
            </div>
            <StatusChip level={selectedZone.riskLevel} />
            <button
              onClick={() => onDispatchRobot(selectedZone)}
              disabled={selectedZone.riskLevel === 'low' || activeDispatch || mapLocked}
              className={`min-h-10 rounded-xl px-4 text-xs font-black text-white transition active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed ${activeDispatch ? 'bg-emerald-600 ring-4 ring-emerald-100' : 'bg-teal-600 hover:bg-teal-700'}`}
            >
              {mapLocked ? '移動中' : selectedZone.riskLevel === 'low' ? '維持巡查' : activeDispatch ? robotFeedback?.stage : '派遣'}
            </button>
          </div>
          {activeDispatch && (
            <motion.div
              initial={{opacity: 0, y: 8}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: 8}}
              className="mt-3 grid gap-2 rounded-lg bg-teal-50 px-3 py-2 text-xs font-black text-teal-800 sm:grid-cols-[auto_1fr_auto] sm:items-center"
            >
              <Bot className="h-4 w-4" />
              <span>{robotFeedback?.missionId} · {robotFeedback?.stage}</span>
              <span className="text-teal-700">{robotFeedback?.stage === '老師確認' ? '通知老師' : '持續回傳'}</span>
            </motion.div>
          )}
          {activeDispatch && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <motion.div animate={{width: `${dispatchProgress}%`}} className="h-full rounded-full bg-teal-600" />
            </div>
          )}
          <DispatchProgress stage={activeDispatch ? robotFeedback?.stage : undefined} connected={activeDispatch} className="mt-3" compact />
        </div>
      </div>
      <AnimatePresence>
        {robotTravel && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[3px]"
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <motion.div
              key={robotTravel.startedAt}
              className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-2xl shadow-slate-950/25"
              initial={{y: 14, scale: 0.98}}
              animate={{y: 0, scale: 1}}
              exit={{y: 14, scale: 0.98}}
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div>
                  <p className="text-[10px] font-black tracking-widest text-teal-600 uppercase">Robot Dispatch</p>
                  <h4 className="mt-0.5 text-2xl font-black text-slate-950">移動中</h4>
                </div>
                <span className="rounded-full px-3 py-1 text-xs font-black text-white shadow-sm" style={{background: travelColor}}>
                  地圖鎖定
                </span>
              </div>
              <div className="p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-black text-slate-400">出發</p>
                    <p className="mt-1 truncate text-lg font-black text-slate-900">{robotTravel.from.name}</p>
                    <p className="truncate text-xs font-bold text-slate-500">{robotTravel.from.location}</p>
                  </div>
                  <div className="hidden h-px w-10 bg-slate-200 sm:block" />
                  <div className="rounded-xl border p-3" style={{borderColor: `${travelColor}55`, background: `${travelColor}10`}}>
                    <p className="text-[10px] font-black text-slate-400">目的地</p>
                    <p className="mt-1 truncate text-lg font-black" style={{color: travelColor}}>{robotTravel.to.name}</p>
                    <p className="truncate text-xs font-bold text-slate-500">{robotTravel.to.location}</p>
                  </div>
                </div>
                <div className="relative mt-4 h-24 overflow-hidden rounded-2xl border border-slate-200 bg-linear-to-br from-slate-50 to-white">
                  <svg className="absolute inset-0 h-full w-full" viewBox="0 0 360 90" preserveAspectRatio="none" aria-hidden="true">
                    <motion.path
                      d="M28 52 C105 8 238 8 332 52"
                      fill="none"
                      stroke={travelColor}
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray="10 12"
                      initial={{pathLength: 0, opacity: 0.45}}
                      animate={{pathLength: 1, opacity: 0.9}}
                      transition={{duration: robotTravel.durationMs / 1000, ease: 'linear'}}
                    />
                  </svg>
                  <span className="absolute left-[8%] top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-white" style={{background: travelColor}} />
                  <span className="absolute left-[92%] top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-white" style={{background: travelColor}} />
                  <motion.div
                    className="absolute top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl text-white shadow-xl"
                    style={{background: travelColor, boxShadow: `0 18px 34px -16px ${travelColor}`}}
                    initial={{left: '8%'}}
                    animate={{left: '92%'}}
                    transition={{duration: robotTravel.durationMs / 1000, ease: [0.34, 0.9, 0.23, 1]}}
                  >
                    <Bot className="h-6 w-6" />
                  </motion.div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                  <motion.div
                    className="h-full rounded-full"
                    style={{background: travelColor}}
                    initial={{width: '0%'}}
                    animate={{width: '100%'}}
                    transition={{duration: robotTravel.durationMs / 1000, ease: 'linear'}}
                  />
                </div>
                <p className="mt-3 text-center text-xs font-bold text-slate-500">移動期間暫停地圖選取與派遣操作，預計 5 秒抵達。</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Surface>
  );
}

function ZoneStatusBar({
  zones,
  selectedZoneId,
  robotFeedback,
  zoneAssessments,
  onSelectZone,
  onOpenZoneInsight,
}: {
  zones: SchoolZoneStatus[];
  selectedZoneId: string;
  robotFeedback: RobotDispatchFeedback;
  zoneAssessments: Record<string, ZoneInsightAssessment>;
  onSelectZone: (zone: SchoolZoneStatus) => void;
  onOpenZoneInsight: (zone: SchoolZoneStatus) => void;
}) {
  return (
    <div className="mb-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black tracking-widest text-teal-600 uppercase">AI 區域燈號</p>
          <p className="text-xs font-bold text-slate-500">點選卡片查看 LLM 判讀與建議處置</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-slate-500 ring-1 ring-slate-200">
          感測器數值優先
        </span>
      </div>
      <div className="p-2">
      <div className="grid gap-2 md:grid-cols-3">
        {zones.map((zone) => {
          const selected = zone.id === selectedZoneId;
          const dispatching = robotFeedback?.zoneId === zone.id;
          const identity = ZONE_IDENTITY[zone.id] ?? ZONE_IDENTITY_FALLBACK;
          const assessment = zoneAssessments[zone.id];
          const cardBorder = zone.riskLevel === 'high' ? 'border-rose-300' : zone.riskLevel === 'medium' ? 'border-amber-300' : 'border-emerald-300';
          const tone = getRiskStatusTone(zone.riskLevel);
          const statusLabel = dispatching ? '派遣中' : getRiskStatusLabel(zone.riskLevel);
          const sensor = zone.sensor;
          const sourceLabel = !assessment ? '待判讀' : assessment.source === 'fallback' ? '備援規則' : 'LLM 判讀';

          return (
            <button
              key={zone.id}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                onSelectZone(zone);
                onOpenZoneInsight(zone);
              }}
              className={`group relative min-h-32 overflow-hidden rounded-xl border-2 bg-white px-3 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99] ${cardBorder} ${selected ? 'ring-2 ring-teal-500 ring-offset-1 ring-offset-slate-50' : ''} ${dispatching ? 'zone-dispatch-pulse' : ''}`}
            >
              <span className={`absolute inset-x-0 top-0 h-1 ${tone.bar}`} />
              <span className={`absolute -right-12 -top-12 h-28 w-28 rounded-full opacity-25 blur-xl ${tone.dot}`} />
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${identity.bg} text-lg leading-none ring-1 ring-white/70`}>{ZONE_EMOJI[zone.id] ?? '📍'}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black leading-tight text-slate-900">{zone.name}</p>
                    <p className="mt-0.5 text-[10px] font-bold text-slate-500">{zone.location}</p>
                  </div>
                </div>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/75 px-2 py-1 text-[10px] font-black text-slate-600 ring-1 ring-slate-200/70">
                  <span className={`h-2 w-2 rounded-full ${dispatching ? identity.dot : tone.dot}`} />
                  AI 判讀
                </span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-[0.9fr_1.1fr] sm:items-stretch">
                <div className={`flex min-h-16 flex-col justify-center rounded-xl border px-3 py-2 ${tone.panel}`}>
                  <div className="flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-full ${tone.dot}`} />
                    <p className={`text-lg font-black leading-tight ${tone.text}`}>{statusLabel}</p>
                  </div>
                  <p className="mt-1 text-[10px] font-black text-slate-500">依 LLM 對感測器數值判斷</p>
                  <p className="mt-1 text-[10px] font-black text-slate-400">{sourceLabel}</p>
                </div>
                <div className="grid min-w-0 flex-1 grid-cols-3 gap-1.5 text-[10px] font-black text-slate-600">
                  <span className="flex min-h-8 items-center justify-center gap-1 rounded-lg bg-white/65 px-1 tabular-nums">
                    <Thermometer className="h-3 w-3 shrink-0 text-rose-400" />
                    {sensor?.connected && sensor.temp !== null ? sensor.temp.toFixed(1) : '--'}°
                  </span>
                  <span className="flex min-h-8 items-center justify-center gap-1 rounded-lg bg-white/65 px-1 tabular-nums">
                    <Droplets className="h-3 w-3 shrink-0 text-blue-400" />
                    {sensor?.connected && sensor.hum !== null ? Math.round(sensor.hum) : '--'}%
                  </span>
                  <span className="flex min-h-8 items-center justify-center gap-1 rounded-lg bg-white/65 px-1 tabular-nums">
                    <Sun className="h-3 w-3 shrink-0 text-amber-400" />
                    {sensor?.connected && sensor.light !== null ? sensor.light : '--'}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      </div>
    </div>
  );
}

function ZoneInsightDialog({
  insight,
  onRefresh,
  onClose,
}: {
  insight: NonNullable<ZoneInsightDialogState>;
  onRefresh: (zone: SchoolZoneStatus) => void;
  onClose: () => void;
}) {
  const {zone, loading, result, error} = insight;
  const displayLevel = normalizeRiskLevel(result?.riskLevel ?? zone.riskLevel);
  const tone = getRiskStatusTone(displayLevel);
  const sensor = zone.sensor;
  const situations = result?.situations?.length ? result.situations : ['正在整理此區域可能發生的狀況。'];
  const suggestions = result?.suggestions?.length ? result.suggestions : ['請先依區域燈號與現場回報處理。'];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
      initial={{opacity: 0}}
      animate={{opacity: 1}}
      exit={{opacity: 0}}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="zone-insight-title"
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20"
        initial={{opacity: 0, y: 18, scale: 0.98}}
        animate={{opacity: 1, y: 0, scale: 1}}
        exit={{opacity: 0, y: 18, scale: 0.98}}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`h-1.5 ${tone.bar}`} />
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black tracking-wide text-teal-600">Gemma 區域判讀</p>
              <h3 id="zone-insight-title" className="mt-1 text-2xl font-black text-slate-950">{zone.name}</h3>
              <p className="mt-1 text-sm font-bold text-slate-500">{zone.location}</p>
            </div>
            <button
              onClick={onClose}
              aria-label="關閉區域判讀"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.4fr]">
            <div className={`rounded-2xl border p-4 ${tone.panel}`}>
              <p className="text-[10px] font-black tracking-widest text-slate-500 uppercase">目前狀態</p>
              <div className="mt-3 flex items-center gap-3">
                <span className={`h-5 w-5 rounded-full ${tone.dot}`} />
                <span className={`text-3xl font-black ${tone.text}`}>{result?.statusLabel || getRiskStatusLabel(displayLevel)}</span>
              </div>
              <p className="mt-2 text-xs font-bold text-slate-500">燈號由 LLM 依感測器數值判斷；沒有回應時使用本機備援規則。</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <SensorMiniStat icon={Thermometer} label="溫度" value={sensor?.connected && sensor.temp !== null ? `${sensor.temp.toFixed(1)}°C` : '--'} tone="text-rose-500" />
              <SensorMiniStat icon={Droplets} label="濕度" value={sensor?.connected && sensor.hum !== null ? `${Math.round(sensor.hum)}%` : '--'} tone="text-blue-500" />
              <SensorMiniStat icon={Sun} label="光照" value={sensor?.connected && sensor.light !== null ? sensor.light.toString() : '--'} tone="text-amber-500" />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black text-slate-500">LLM 設定</p>
              <p className="mt-1 text-xs font-bold text-slate-400">API key、URL、model 只從 `zone_advisor.py` 或環境變數讀取。</p>
            </div>
            <button
              type="button"
              onClick={() => onRefresh(zone)}
              className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-teal-600 px-3 text-xs font-black text-white shadow-sm shadow-teal-200 transition hover:bg-teal-700"
            >
              <RefreshCw className="h-4 w-4" />
              重新判讀
            </button>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-4">
            {loading ? (
              <div className="flex min-h-36 flex-col items-center justify-center gap-3 text-slate-500">
                <RefreshCw className="h-6 w-6 animate-spin text-teal-600" />
                <p className="text-sm font-black">正在請 Gemma 判讀區域狀況...</p>
              </div>
            ) : (
              <div className="grid gap-4">
                <div>
                  <p className="text-xs font-black text-slate-400">判讀摘要</p>
                  <p className="mt-1 text-sm font-bold leading-6 text-slate-800">{result?.summary || error || '目前沒有可用的 AI 判讀內容。'}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <InsightList title="可能狀況" items={situations} toneDot={tone.dot} />
                  <InsightList title="建議處置" items={suggestions} toneDot="bg-teal-500" />
                </div>
                <p className="text-[10px] font-bold text-slate-400">
                  來源：{result?.source === 'ollama-gemma' ? `Ollama / ${result.model ?? 'Gemma'}` : result?.source === 'cloud-gemma' ? `Cloud / ${result.model ?? 'Gemma'}` : '本機備援判讀'}
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SensorMiniStat({icon: Icon, label, value, tone}: {icon: LucideIcon; label: string; value: string; tone: string}) {
  return (
    <div className="flex min-h-24 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black text-slate-400">{label}</p>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <p className="text-xl font-black text-slate-950 tabular-nums">{value}</p>
    </div>
  );
}

function InsightList({title, items, toneDot}: {title: string; items: string[]; toneDot: string}) {
  return (
    <div>
      <p className="text-xs font-black text-slate-400">{title}</p>
      <div className="mt-2 grid gap-2">
        {items.map((item, index) => (
          <div key={`${title}-${index}`} className="flex gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold leading-5 text-slate-700 shadow-sm">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${toneDot}`} />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OperationsBrief({viewModel, onOpenPanel}: {viewModel: CommandCenterViewModel; onOpenPanel: (panel: ActivePanel) => void}) {
  const accentBar = viewModel.highestZone.riskLevel === 'high'
    ? 'bg-linear-to-r from-rose-400 to-rose-600'
    : viewModel.highestZone.riskLevel === 'medium'
      ? 'bg-linear-to-r from-amber-300 to-amber-500'
      : 'bg-linear-to-r from-teal-300 to-teal-500';
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className={`h-1 ${accentBar}`} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-slate-400">今日狀態</p>
            <h3 className="mt-1 text-lg font-black text-slate-950">{viewModel.campusHealthLabel}</h3>
          </div>
          <StatusChip level={viewModel.highestZone.riskLevel} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={() => onOpenPanel('alerts')} className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 text-left transition hover:border-teal-200 hover:bg-teal-50">
            <p className="text-[10px] font-black text-slate-400">預警</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{viewModel.highPriorityCount}</p>
          </button>
          <button onClick={() => onOpenPanel('care')} className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 text-left transition hover:border-teal-200 hover:bg-teal-50">
            <p className="text-[10px] font-black text-slate-400">照護</p>
            <p className="mt-1 text-2xl font-black text-slate-950">學生關懷</p>
          </button>
        </div>
      </div>
    </div>
  );
}

function RobotReadinessCard({state, robotFeedback}: {state: GuardianState; robotFeedback: RobotDispatchFeedback}) {
  const latestHardware = state.hardwareEvents[0];
  const connected = latestHardware?.status === 'sent';
  const meta = getRobotStageMeta(robotFeedback?.stage);
  return (
    <Surface className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-slate-500">機器人連動</p>
          <h3 className="mt-1 text-lg font-black text-slate-950">{robotFeedback ? `${robotFeedback.zoneName}：${robotFeedback.stage}` : connected ? '硬體已接收' : '系統就緒'}</h3>
          <p className="mt-1 text-xs font-bold text-slate-500">{meta.detail}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[10px] font-black ${connected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {connected ? '已連線' : '備援'}
        </span>
      </div>
      <DispatchProgress stage={robotFeedback?.stage} connected={connected} className="mt-4" />
      <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black">
        <span className="text-slate-500">預估抵達</span>
        <span className={robotFeedback ? 'text-teal-700' : 'text-slate-400'}>{meta.eta}</span>
      </div>
      <div className="mt-2 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black">
        <span className="text-slate-500">任務單號</span>
        <span className={robotFeedback ? 'text-slate-900' : 'text-slate-400'}>{robotFeedback?.missionId ?? '尚未建立'}</span>
      </div>
    </Surface>
  );
}

function ZoneInspector({zone, robotFeedback, onDispatchRobot}: {zone: SchoolZoneStatus; robotFeedback: RobotDispatchFeedback; onDispatchRobot: (zone: SchoolZoneStatus) => void}) {
  const tone = getRiskStatusTone(zone.riskLevel);
  const activeDispatch = robotFeedback?.zoneId === zone.id;
  return (
    <Surface className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-slate-500">目前選取區域</p>
          <h3 className="mt-2 text-2xl font-black text-slate-950">{zone.name}</h3>
          <p className="mt-1 text-xs font-bold text-slate-500">{zone.location}</p>
        </div>
        <StatusChip level={zone.riskLevel} />
      </div>
      <div className={`mt-4 overflow-hidden rounded-2xl border ${tone.panel}`}>
        <div className={`h-1 ${tone.bar}`} />
        <div className="flex items-center justify-between gap-3 p-4">
          <div>
            <p className="text-[10px] font-black tracking-widest text-slate-500 uppercase">LLM 燈號</p>
            <p className={`mt-1 text-3xl font-black ${tone.text}`}>{getRiskStatusLabel(zone.riskLevel)}</p>
          </div>
          <span className={`h-6 w-6 rounded-full shadow-sm ${tone.dot}`} />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <MetricTile label="燈號" value={getRiskStatusLabel(zone.riskLevel)} />
        <MetricTile label="感測" value={zone.sensor?.connected ? '在線' : '離線'} />
        <MetricTile label="提醒" value={zone.alertCount} />
      </div>
      {zone.sensor && <ZoneSensorPanel sensor={zone.sensor} />}
      <div className="mt-4 rounded-xl border border-teal-100 bg-teal-50 p-3">
        <p className="text-xs font-black text-teal-700">下一步</p>
        <p className="mt-1 text-sm font-bold text-teal-900">{activeDispatch ? robotFeedback?.stage : zone.riskLevel === 'low' ? '維持巡查' : '派遣 + 確認'}</p>
      </div>
      {activeDispatch && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between text-xs font-black text-slate-500">
            <span>{robotFeedback?.missionId}</span>
            <span>{getRobotStageProgress(robotFeedback?.stage)}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
            <motion.div animate={{width: `${getRobotStageProgress(robotFeedback?.stage)}%`}} className="h-full rounded-full bg-teal-600" />
          </div>
        </div>
      )}
      <DispatchProgress stage={activeDispatch ? robotFeedback?.stage : undefined} connected={Boolean(robotFeedback)} className="mt-3" compact />
      <PrimaryAction onClick={() => onDispatchRobot(zone)} disabled={zone.riskLevel === 'low' || activeDispatch} active={activeDispatch} className="mt-4">
        <Bot className={`h-5 w-5 ${activeDispatch ? 'animate-pulse' : ''}`} />
        {zone.riskLevel === 'low' ? '維持巡查' : activeDispatch ? '已送出派遣' : '指派機器人'}
      </PrimaryAction>
    </Surface>
  );
}

function MissionTimeline({state, robotFeedback}: {state: GuardianState; robotFeedback: RobotDispatchFeedback}) {
  const missions = state.robotMissions.slice(0, 6);
  const missionChip = (status: 'dispatching' | 'arrived' | 'completed') => {
    if (status === 'dispatching') return 'bg-amber-100 text-amber-700';
    if (status === 'arrived') return 'bg-teal-100 text-teal-700';
    return 'bg-emerald-100 text-emerald-700';
  };
  return (
    <Surface className="min-h-0 overflow-hidden p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-slate-950">機器人任務</h3>
        <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-teal-700">{state.robotMissions.length}</span>
      </div>
      <div className="mt-4 max-h-[18rem] space-y-3 overflow-y-auto pr-1">
        {missions.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-500">
            尚無任務。選取中高風險區即可派遣。
          </div>
        )}
        {missions.map((mission, index) => (
          <div key={mission.id} className={`relative rounded-xl border border-slate-200 bg-slate-50 p-3 pl-9 ${robotFeedback?.zoneName === mission.zoneName && index === 0 ? 'mission-live' : ''}`}>
            <span className="absolute left-3 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-black text-teal-700 ring-1 ring-slate-200">{index + 1}</span>
            <div className="flex items-center justify-between gap-3">
              <p className="font-black text-slate-900">→ {mission.zoneName}</p>
              <span className={`rounded-full px-2 py-1 text-[10px] font-black ${missionChip(mission.status)}`}>
                {mission.status === 'dispatching' ? '派遣中' : mission.status === 'arrived' ? '已到達' : '完成'}
              </span>
            </div>
            <MissionProgress status={mission.status} live={robotFeedback?.zoneName === mission.zoneName && index === 0} />
            <p className="mt-2 text-xs font-semibold text-slate-500">風險 {mission.riskScore} · {mission.createdAt}</p>
          </div>
        ))}
      </div>
    </Surface>
  );
}

function MissionProgress({status, live}: {status: 'dispatching' | 'arrived' | 'completed'; live: boolean}) {
  const current = status === 'completed' ? 2 : status === 'arrived' ? 1 : 0;
  return (
    <div className="mt-3 grid grid-cols-3 gap-1">
      {MISSION_STEPS.map((step, index) => {
        const active = index <= current || (live && index === Math.min(current + 1, 2));
        return (
          <span key={step} className={`rounded-full px-2 py-1 text-center text-[10px] font-black ${active ? 'bg-teal-100 text-teal-700' : 'bg-white text-slate-400'}`}>
            {step}
          </span>
        );
      })}
    </div>
  );
}

function DispatchProgress({stage, connected, compact = false, className = ''}: {stage?: RobotDispatchStage; connected: boolean; compact?: boolean; className?: string}) {
  const current = getRobotStageIndex(stage);
  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      {robotDispatchSteps.map((step, index) => {
        const active = current >= index;
        const waiting = current + 1 === index;
        return (
          <div
            key={step}
            className={`rounded-xl border text-center font-black transition ${compact ? 'px-2 py-2 text-[10px]' : 'px-3 py-2 text-[10px]'} ${
              active
                ? connected && index === 2
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-teal-200 bg-teal-50 text-teal-700'
                : waiting
                  ? 'border-slate-200 bg-white text-slate-500'
                  : 'border-slate-200 bg-slate-50 text-slate-400'
            }`}
          >
            {step}
          </div>
        );
      })}
    </div>
  );
}

function PanelDock({activePanel, onOpenPanel, onShowDemo}: {activePanel: ActivePanel; onOpenPanel: (panel: ActivePanel) => void; onShowDemo: () => void}) {
  return (
    <Surface className="p-2">
      <div className="mb-2 flex items-center justify-between px-2 pt-1">
        <p className="text-xs font-black text-slate-500">工作面板</p>
        <button onClick={onShowDemo} className="min-h-10 rounded-xl px-3 text-xs font-black text-teal-700 transition hover:bg-teal-50">
          導覽
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {panelNav.map((item) => (
          <button
            key={item.id}
            onClick={() => onOpenPanel(activePanel === item.id ? null : item.id)}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-black transition ${
              activePanel === item.id ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </button>
        ))}
      </div>
    </Surface>
  );
}

function DetailDrawer(props: {
  activePanel: ActivePanel;
  state: GuardianState;
  selectedAlert: GuardianAlert | null;
  setSelectedAlert: (alert: GuardianAlert | null) => void;
  latestMood?: {label: string; createdAt: string};
  selectedMood: MoodType;
  message: string;
  setMessage: (value: string) => void;
  postContent: string;
  setPostContent: (value: string) => void;
  postType: 'thought' | 'gratitude' | 'support';
  setPostType: (value: 'thought' | 'gratitude' | 'support') => void;
  chatBusy: boolean;
  postBusy: boolean;
  micActive: boolean;
  micError: string;
  currentAcoustic: ReturnType<typeof describeAcousticSignal>;
  acousticLocation: string;
  setAcousticLocation: (value: string) => void;
  proactiveInsight: ProactiveInsight;
  robotFeedback: RobotDispatchFeedback;
  onClose: () => void;
  onMood: (mood: MoodType, note?: string) => void;
  onAddPost: () => void;
  onSendMessage: () => void;
  onStartAcoustic: () => void;
  onRecordAcoustic: (signal: Omit<AcousticSignal, 'id' | 'createdAt'>) => void;
  onCreateAcousticAlert: () => void;
  onCreateProactiveAlert: () => void;
  onDemoSound: () => void;
  onRestartNode: (id: string) => void;
  onDispatchRobot: (zone: SchoolZoneStatus) => void;
  onHardwareCommand: (command: string, source: string) => void;
  dispatch: Dispatch<any>;
  zones: SchoolZoneStatus[];
  bridgeOnline: boolean;
  sensors: ZoneSensorReading[];
}) {
  const panel = props.activePanel;
  return (
    <AnimatePresence>
      {panel && (
        <>
          <motion.button
            aria-label="關閉面板"
            className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm lg:hidden"
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            onClick={props.onClose}
          />
          <motion.aside
            initial={{opacity: 0, x: 40}}
            animate={{opacity: 1, x: 0}}
            exit={{opacity: 0, x: 40}}
            onKeyDown={(e) => e.key === 'Escape' && props.onClose()}
            className="fixed bottom-0 right-0 z-50 flex max-h-[88vh] w-full flex-col rounded-t-2xl border border-slate-200 bg-white p-4 text-slate-950 shadow-2xl shadow-slate-950/15 sm:max-w-xl lg:bottom-4 lg:right-4 lg:top-21 lg:max-h-none lg:rounded-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs font-black text-teal-700">工作抽屜</p>
                <h2 className="text-2xl font-black">{panelTitle(panel)}</h2>
              </div>
              <button onClick={props.onClose} aria-label="關閉工作面板" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-4 pb-safe">
              {panel === 'alerts' && <AlertsPanel {...props} />}
              {panel === 'sensing' && <SensingPanel {...props} />}
              {panel === 'care' && <CarePanel {...props} />}
              {panel === 'robot' && (
                <div className="space-y-4">
                  <GuardianControlPanel
                    bridgeOnline={props.bridgeOnline}
                    zones={props.zones}
                    sensors={props.sensors}
                    state={props.state}
                    onDispatchRobot={props.onDispatchRobot}
                  />
                  <NodesPanel {...props} />
                  <LogsPanel {...props} />
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function AlertsPanel({state, selectedAlert, setSelectedAlert, dispatch, onHardwareCommand}: Parameters<typeof DetailDrawer>[0]) {
  const {openCount, processingCount, highCount} = useMemo(() => {
    let open = 0, processing = 0, high = 0;
    for (const a of state.alerts) {
      if (a.status !== 'resolved') { open++; if (a.riskLevel === 'high') high++; }
      if (a.status === 'processing') processing++;
    }
    return {openCount: open, processingCount: processing, highCount: high};
  }, [state.alerts]);
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-2">
        <MetricTile label="待處理" value={openCount} />
        <MetricTile label="高優先" value={highCount} />
        <MetricTile label="處理中" value={processingCount} />
      </div>
      <div className="space-y-3">
        {state.alerts.length === 0 && (
          <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-400">目前無待處理提醒 ✓</p>
        )}
        {state.alerts.map((alert) => (
          <AlertRow key={alert.id} alert={alert} onOpen={() => setSelectedAlert(alert)} />
        ))}
      </div>
      {selectedAlert && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-slate-900">
          <AlertDetail alert={selectedAlert} dispatch={dispatch} onHardwareCommand={onHardwareCommand} />
        </div>
      )}
    </div>
  );
}

const TREND_LS_KEY = 'guardian-sound-trend:v1';
const MAX_SAMPLES = 180; // 30 min @ 10s interval

function loadTrend(): {t: number; v: number}[] {
  try {
    const raw = localStorage.getItem(TREND_LS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) { localStorage.removeItem(TREND_LS_KEY); return []; }
    return parsed.filter((p): p is {t: number; v: number} =>
      p !== null && typeof p === 'object' && typeof (p as Record<string,unknown>).t === 'number' && typeof (p as Record<string,unknown>).v === 'number'
    );
  } catch {
    return [];
  }
}

function SoundSparkline({trend}: {trend: {t: number; v: number}[]}) {
  if (trend.length < 2) {
    return <p className="mt-3 text-xs font-bold text-slate-400">趨勢資料收集中，麥克風啟用後每 10 秒記錄一次…</p>;
  }
  const W = 280;
  const H = 48;
  const vals = trend.map((p) => p.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals) || 1;
  const range = max - min || 1;
  const toX = (i: number) => (i / (trend.length - 1)) * W;
  const toY = (v: number) => H - ((v - min) / range) * (H - 4) - 2;
  const points = trend.map((p, i) => `${toX(i).toFixed(1)},${toY(p.v).toFixed(1)}`).join(' ');
  const last3 = vals.slice(-3);
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const first3 = vals.slice(0, 3);
  const trend3 = last3.length >= 2 ? avg(last3) - avg(first3) : 0;
  const trendArrow = trend3 > 5 ? '↑ 上升' : trend3 < -5 ? '↓ 下降' : '→ 穩定';
  const trendColor = trend3 > 5 ? 'text-rose-500' : trend3 < -5 ? 'text-emerald-600' : 'text-slate-500';
  const latest = vals[vals.length - 1];
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-black text-slate-500">過去 {Math.round(trend.length * 10 / 60)} 分鐘聲量趨勢</p>
        <span className={`text-xs font-black ${trendColor}`}>{trendArrow}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{height: 48}}>
        <polyline fill="none" stroke="#0d9488" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={points} />
        <circle cx={toX(trend.length - 1)} cy={toY(latest)} r="3" fill="#0d9488" />
      </svg>
      <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-1">
        <span>{trend.length * 10 >= 60 ? `${Math.round(trend.length * 10 / 60)} 分前` : `${trend.length * 10} 秒前`}</span>
        <span>現在 {latest}</span>
      </div>
    </div>
  );
}

function SensingPanel({
  micActive,
  micError,
  currentAcoustic,
  acousticLocation,
  setAcousticLocation,
  proactiveInsight,
  onStartAcoustic,
  onRecordAcoustic,
  onCreateAcousticAlert,
  onCreateProactiveAlert,
  onDemoSound,
}: Parameters<typeof DetailDrawer>[0]) {
  const [visualResult, setVisualResult] = useState<VisualPrivacyResult>(() => analyzePrivacyFrame(1, 1, new Uint8ClampedArray([180, 180, 180, 255])));
  const [visualCameraReady, setVisualCameraReady] = useState(false);
  const [visualBusy, setVisualBusy] = useState(false);
  const [visualError, setVisualError] = useState('');
  const [visualAnalyzedAt, setVisualAnalyzedAt] = useState('尚未判讀');
  const visualVideoRef = useRef<HTMLVideoElement | null>(null);
  const visualCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const visualStreamRef = useRef<MediaStream | null>(null);
  const [soundTrend, setSoundTrend] = useState<{t: number; v: number}[]>(loadTrend);
  const acousticRef = useRef(currentAcoustic);

  useEffect(() => { acousticRef.current = currentAcoustic; }, [currentAcoustic]);

  useEffect(() => () => {
    visualStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (!micActive) return;
    const id = setInterval(() => {
      setSoundTrend((prev) => {
        const next = [...prev, {t: Date.now(), v: acousticRef.current.volumeIndex}].slice(-MAX_SAMPLES);
        try { localStorage.setItem(TREND_LS_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
    }, 10_000);
    return () => clearInterval(id);
  }, [micActive]);

  const toggleVisualCamera = async () => {
    if (visualCameraReady) {
      visualStreamRef.current?.getTracks().forEach((track) => track.stop());
      visualStreamRef.current = null;
      setVisualCameraReady(false);
      return;
    }
    try {
      setVisualBusy(true);
      setVisualError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {facingMode: {ideal: 'environment'}, width: {ideal: 960}, height: {ideal: 540}},
        audio: false,
      });
      visualStreamRef.current = stream;
      if (visualVideoRef.current) {
        visualVideoRef.current.srcObject = stream;
        await visualVideoRef.current.play();
      }
      setVisualCameraReady(true);
    } catch {
      visualStreamRef.current?.getTracks().forEach((track) => track.stop());
      visualStreamRef.current = null;
      setVisualError('無法開啟攝影機，請確認瀏覽器權限。');
    } finally {
      setVisualBusy(false);
    }
  };

  const analyzeVisualFrame = () => {
    const video = visualVideoRef.current;
    const canvas = visualCanvasRef.current;
    if (!video || !canvas || !visualCameraReady) return;
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 360;
    const maxSide = 180;
    const scale = Math.min(1, maxSide / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d', {willReadFrequently: true});
    if (!context) return;
    setVisualBusy(true);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    setVisualResult(analyzePrivacyFrame(frame.width, frame.height, frame.data));
    setVisualAnalyzedAt(new Intl.DateTimeFormat('zh-TW', {hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false}).format(new Date()));
    setVisualBusy(false);
  };

  return (
    <div className="space-y-4">
      <GlassPanel>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-slate-500">本機即時運算</p>
            <h3 className="mt-2 text-xl font-black text-slate-950">環境聲量感知</h3>
          </div>
          <button onClick={onStartAcoustic} className="flex min-h-11 items-center gap-2 rounded-xl bg-teal-600 px-4 text-sm font-black text-white">
            {micActive ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            {micActive ? '停止' : '啟用'}
          </button>
        </div>
        {micError && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">{micError}</p>}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <MiniMetric label="音量" value={currentAcoustic.volumeIndex} />
          <MiniMetric label="波動" value={currentAcoustic.volatility} />
          <MiniMetric label="狀態" value={currentAcoustic.level === 'elevated' ? '偏高' : currentAcoustic.level === 'active' ? '活動' : '平穩'} />
        </div>
        <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">{currentAcoustic.summary}</p>
        <SoundSparkline trend={soundTrend} />
        <input value={acousticLocation} onChange={(event) => setAcousticLocation(event.target.value)} aria-label="感測位置" placeholder="例：穿堂、教室等位置" className="mt-4 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button onClick={() => onRecordAcoustic({source: micActive ? 'microphone' : 'demo', location: acousticLocation, ...currentAcoustic})} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-black text-slate-700">
            記錄
          </button>
          <button onClick={onCreateAcousticAlert} className="rounded-xl bg-teal-600 px-3 py-3 text-xs font-black text-white">
            建立提醒
          </button>
          <button
            onClick={() => {
              onDemoSound();
              const now = Date.now();
              const demo = Array.from({length: 25}, (_, i) => ({
                t: now - (24 - i) * 10_000,
                v: Math.round(18 + Math.sin(i * 0.55) * 20 + Math.max(0, i - 12) * 2.5),
              }));
              setSoundTrend(demo);
              try { localStorage.setItem(TREND_LS_KEY, JSON.stringify(demo)); } catch {}
            }}
            className="rounded-xl bg-slate-100 px-3 py-3 text-xs font-black text-slate-700"
          >
            示範
          </button>
        </div>
      </GlassPanel>

      <GlassPanel>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-slate-500">隱私影像感知</p>
            <h3 className="mt-2 text-xl font-black text-slate-950">場域風險辨識</h3>
            <p className="mt-1 text-xs font-bold text-slate-400">最近判讀：{visualAnalyzedAt}</p>
          </div>
          <button onClick={toggleVisualCamera} disabled={visualBusy} className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-50">
            <Camera className="h-5 w-5" />
            {visualCameraReady ? '關閉' : '啟用'}
          </button>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
          <div className="relative aspect-video">
            <video ref={visualVideoRef} muted playsInline className={`h-full w-full object-cover ${visualCameraReady ? 'opacity-100' : 'opacity-20'}`} />
            {!visualCameraReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/65">
                <Camera className="h-8 w-8" />
                <p className="text-xs font-black">攝影機待啟用</p>
              </div>
            )}
            <canvas ref={visualCanvasRef} className="hidden" />
          </div>
        </div>
        {visualError && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">{visualError}</p>}
        <div className="mt-3 grid grid-cols-4 gap-2">
          <MiniMetric label="風險" value={visualResult.score} />
          <MiniMetric label="紋理" value={visualResult.metrics.crowdTexture} />
          <MiniMetric label="低光" value={visualResult.metrics.lowLightArea} />
          <MiniMetric label="狀態" value={visualResult.level === 'support' ? '關注' : visualResult.level === 'watch' ? '觀察' : '穩定'} />
        </div>
        <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">{visualResult.summary}</p>
        <div className={`mt-3 rounded-xl border px-4 py-3 text-xs font-bold leading-5 ${
          visualResult.quality.level === 'good'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : visualResult.quality.level === 'warn'
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
        }`}>
          <span className="font-black">畫面品質 · {visualResult.quality.label}</span>
          <span className="ml-2">{visualResult.quality.hints[0] ?? '環境畫面可用，系統只做低解析場域分析。'}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {visualResult.evidence.map((item) => (
            <span key={item} className="rounded-full bg-teal-50 px-3 py-1 text-[10px] font-black text-teal-700">{item}</span>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={analyzeVisualFrame} disabled={!visualCameraReady || visualBusy} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-black text-slate-700 disabled:opacity-50">
            {visualBusy ? '判讀中' : '擷取判讀'}
          </button>
          <button onClick={onCreateProactiveAlert} className="rounded-xl bg-teal-600 px-3 py-3 text-xs font-black text-white">
            建立關懷提醒
          </button>
        </div>
      </GlassPanel>

      <GlassPanel>
        <p className="text-xs font-black text-slate-500">AI 融合分析</p>
        <h3 className="mt-2 text-xl font-black text-slate-950">{proactiveInsight.title}</h3>
        <p className="mt-1 text-xs font-semibold text-slate-400">融合分數 {proactiveInsight.score}/10 · {proactiveInsight.score >= 7 ? '高風險' : proactiveInsight.score >= 4 ? '中風險' : '低風險'}</p>
        <div className="mt-3 space-y-1.5">
          {proactiveInsight.signals.map(({label, score: s, max}) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-16 text-[10px] font-black text-slate-500">{label}</span>
              <div className="flex flex-1 gap-0.5">
                {Array.from({length: max}).map((_, i) => (
                  <div key={i} className={`h-2 flex-1 rounded-full ${i < s ? (s === max ? 'bg-rose-400' : 'bg-amber-400') : 'bg-slate-200'}`} />
                ))}
              </div>
              <span className="w-8 text-right text-[10px] font-black text-slate-400">{s}/{max}</span>
            </div>
          ))}
        </div>
        <button onClick={onCreateProactiveAlert} className="mt-4 min-h-11 w-full rounded-xl bg-slate-950 text-sm font-black text-white">
          由多來源訊號建立提醒
        </button>
      </GlassPanel>

      <GlassPanel>
        <p className="mb-2 text-xs font-black text-on-surface-variant">情緒熱圖（示範）</p>
        <EmotionHeatmap />
      </GlassPanel>
    </div>
  );
}

function CarePanel({
  state,
  latestMood,
  selectedMood,
  onMood,
  postType,
  setPostType,
  postContent,
  setPostContent,
  onAddPost,
  postBusy,
  message,
  setMessage,
  onSendMessage,
  chatBusy,
}: Parameters<typeof DetailDrawer>[0]) {
  const [counselingInfoVisible, setCounselingInfoVisible] = useState(false);
  const [emotionText, setEmotionText] = useState('今天考試有點壓力，但我想慢慢整理。');
  const [emotionResult, setEmotionResult] = useState(() => analyzeEmotionTypography('今天考試有點壓力，但我想慢慢整理。'));
  const runEmotionTypography = () => {
    setEmotionResult(analyzeEmotionTypography(emotionText));
  };
  return (
    <div className="space-y-4">
      <GlassPanel>
        <h3 className="text-xl font-black text-slate-950">心情簽到</h3>
        <p className="mt-1 text-sm font-semibold text-slate-400">最近一次：{latestMood?.label ?? '尚未簽到'} · {latestMood?.createdAt ?? '今天'}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {moodOptions.map((item) => (
            <button key={item.mood} onClick={() => onMood(item.mood)} className={`min-h-24 rounded-xl border p-3 text-left ${selectedMood === item.mood ? item.tone : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
              <Smile className="h-5 w-5" />
              <span className="mt-2 block font-black">{item.label}</span>
              <span className="mt-1 block text-xs font-semibold opacity-75">{item.note}</span>
            </button>
          ))}
        </div>
      </GlassPanel>

      <GlassPanel>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-teal-700">情緒字體</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">文字心情辨識</h3>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <Type className="h-5 w-5" />
          </div>
        </div>
        <textarea
          value={emotionText}
          onChange={(event) => setEmotionText(event.target.value)}
          maxLength={240}
          aria-label="情緒文字"
          className="mt-3 min-h-24 w-full rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          placeholder="輸入匿名句子..."
        />
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black text-slate-400">辨識狀態</p>
              <p className="mt-1 text-sm font-black text-slate-950">{emotionResult.label}</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-teal-700 shadow-sm">{emotionResult.intensity}%</span>
          </div>
          <p className={`mt-4 rounded-xl bg-white px-4 py-3 text-lg leading-8 ${emotionResult.fontClass}`}>{emotionResult.preview}</p>
          <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">{emotionResult.guidance}</p>
          {emotionResult.keywords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {emotionResult.keywords.map((keyword) => (
                <span key={keyword} className="rounded-full bg-teal-50 px-3 py-1 text-[10px] font-black text-teal-700">{keyword}</span>
              ))}
            </div>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={runEmotionTypography} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700">
            重新辨識
          </button>
          <button
            onClick={() => onMood(emotionResult.mood, `情緒字體：${emotionResult.label}｜${emotionResult.preview}`)}
            className="min-h-11 rounded-xl bg-teal-600 px-3 text-xs font-black text-white"
          >
            加入簽到
          </button>
        </div>
      </GlassPanel>

      <GlassPanel>
        <h3 className="text-xl font-black text-slate-950">心靈森林</h3>
        <div className="mt-3 flex gap-2">
          {POST_TYPES.map((type) => (
            <button key={type} onClick={() => setPostType(type)} className={`rounded-xl px-3 py-2 text-xs font-black ${postType === type ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {type === 'support' ? '互助' : type === 'gratitude' ? '感謝' : '想法'}
            </button>
          ))}
        </div>
        <textarea value={postContent} onChange={(event) => setPostContent(event.target.value)} maxLength={500} aria-label="匿名留言" className="mt-3 min-h-24 w-full rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" placeholder="匿名寫下一句支持自己的話..." />
        <p className="text-right text-xs text-gray-400 mt-0.5">{postContent.length} / 500</p>
        <button onClick={onAddPost} disabled={!postContent.trim() || postBusy} className="mt-3 min-h-11 w-full rounded-xl bg-teal-600 text-sm font-black text-white disabled:opacity-50 disabled:cursor-not-allowed">發表葉子</button>
        <div className="mt-4 space-y-2">
          {state.forestPosts.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <p className="text-3xl mb-2">🌳</p>
              <p className="text-sm">心靈森林正在生長...</p>
              <p className="text-xs mt-1">分享一個感受，種下第一片葉子</p>
            </div>
          )}
          {state.forestPosts.slice(0, 3).map((post) => (
            <div key={post.id} className="rounded-xl border border-green-100 bg-linear-to-br from-green-50 to-emerald-50 p-3">
              <div className="flex items-start gap-2">
                <span className="text-lg leading-none mt-0.5">🌿</span>
                <p className="text-sm font-semibold leading-6 text-gray-700 flex-1 line-clamp-4">{post.content}</p>
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs font-black text-teal-700">🌱 {post.likes} 人支持</p>
                <p className="text-xs text-gray-400">{post.createdAt}</p>
              </div>
              {post.botReply && (
                <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-white/70 border border-teal-100 px-2.5 py-2">
                  <span className="text-sm leading-none mt-0.5">🤝</span>
                  <p className="text-xs font-medium text-teal-800 leading-5">{post.botReply}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </GlassPanel>

      <GlassPanel>
        <h3 className="text-xl font-black text-slate-950">安全空間聊天</h3>
        <div className="mt-4 flex h-80 flex-col rounded-xl border border-slate-200 bg-slate-50">
          <ChatScrollContainer messages={state.supportMessages}>
            {state.supportMessages.map((item, index) => (
              item.role === 'student' ? (
                <div key={item.id} className="ml-auto max-w-[86%] rounded-xl px-4 py-3 text-sm font-semibold leading-6 bg-teal-600 text-white wrap-break-word">
                  {item.content}
                </div>
              ) : (
                <div key={item.id} className="max-w-[86%]">
                  <div className="flex items-start gap-2">
                    <div className="shrink-0 w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center text-sm">
                      🤝
                    </div>
                    <div className="border border-teal-200 bg-teal-50 text-slate-700 rounded-xl px-3 py-2 text-sm font-semibold leading-6 flex-1 wrap-break-word">
                      {item.content}
                    </div>
                  </div>
                  {index > 0 && isCrisisMessage(state.supportMessages[index - 1]?.content ?? '') && (
                    <div className="mt-2 ml-9 rounded-xl border border-red-200 bg-red-50 p-3 text-sm">
                      <p className="font-semibold text-red-700 mb-2">🆘 需要立即幫助？</p>
                      <div className="flex flex-col gap-1.5">
                        <a
                          href="tel:1925"
                          className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-white font-medium hover:bg-red-700 transition-colors"
                        >
                          📞 撥打安心專線 1925
                        </a>
                        <button
                          type="button"
                          className="flex items-center gap-2 rounded-lg bg-white border border-red-300 px-3 py-2 text-red-700 font-medium hover:bg-red-50 transition-colors"
                          onClick={() => setCounselingInfoVisible((v) => !v)}
                        >
                          🏫 前往輔導室尋求幫助
                        </button>
                        {counselingInfoVisible && (
                          <p className="rounded-lg bg-white border border-red-200 px-3 py-2 text-xs text-red-700 font-medium">
                            輔導室在教學大樓 2 樓，老師隨時歡迎你來談談。
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            ))}
            {chatBusy && <div className="w-fit rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-500 animate-pulse">守護者正在回覆中...</div>}
          </ChatScrollContainer>
          <div className="flex gap-2 border-t border-slate-200 p-3">
            <div className="flex flex-col flex-1">
              <input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && !chatBusy && !!message.trim() && onSendMessage()} maxLength={300} aria-label="心情輸入" className="min-h-11 w-full rounded-xl bg-white px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-100" placeholder="輸入今天想說的心情..." />
              <p className="text-right text-xs text-gray-400 mt-0.5">{message.length} / 300</p>
            </div>
            <button onClick={onSendMessage} disabled={chatBusy || !message.trim()} aria-label="傳送訊息" className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity">
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}

function NodesPanel({state, zones, robotFeedback, onRestartNode, onDispatchRobot}: Parameters<typeof DetailDrawer>[0]) {
  return (
    <div className="space-y-4">
      <GlassPanel>
        <h3 className="text-xl font-black text-slate-950">校園空間</h3>
        <div className="mt-4 space-y-2">
          {zones.map((zone) => (
            <button
              key={zone.id}
              onClick={() => zone.riskLevel !== 'low' && onDispatchRobot(zone)}
              disabled={zone.riskLevel === 'low' || robotFeedback?.zoneId === zone.id}
              className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition active:scale-[0.99] disabled:cursor-not-allowed ${
                robotFeedback?.zoneId === zone.id
                  ? 'border-teal-200 bg-teal-50 shadow-sm shadow-teal-100'
                  : zone.riskLevel === 'low'
                    ? 'border-slate-200 bg-slate-50 opacity-75'
                    : 'border-slate-200 bg-slate-50 hover:border-teal-200 hover:bg-teal-50'
              }`}
            >
              <span>
                <span className="block font-black text-slate-950">{zone.name}</span>
                <span className="text-xs font-semibold text-slate-500">
                  {robotFeedback?.zoneId === zone.id ? '派遣確認中' : zone.riskLevel === 'low' ? '維持巡查' : '可派遣'} · {getRiskStatusLabel(zone.riskLevel)}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {robotFeedback?.zoneId === zone.id && <Bot className="h-4 w-4 animate-pulse text-teal-700" />}
                <RiskBadge level={zone.riskLevel} />
              </span>
            </button>
          ))}
        </div>
      </GlassPanel>
      <GlassPanel>
        <h3 className="text-xl font-black text-slate-950">節點狀態</h3>
        <div className="mt-4 space-y-3">
          {state.nodes.length === 0 && (
            <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-5 text-center text-sm font-semibold text-slate-400">尚無節點</p>
          )}
          {state.nodes.map((node) => (
            <NodeRow key={node.id} node={node} onRestart={() => onRestartNode(node.id)} />
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}

function LogsPanel({state, robotFeedback}: Parameters<typeof DetailDrawer>[0]) {
  const latestHardware = state.hardwareEvents[0];
  return (
    <div className="space-y-4">
      <GlassPanel>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-slate-500">連動狀態</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">{robotFeedback ? `${robotFeedback.zoneName} 派遣中` : latestHardware?.status === 'sent' ? '硬體已接收' : '智慧派遣就緒'}</h3>
          </div>
          <Bot className={`h-6 w-6 ${robotFeedback ? 'animate-pulse text-teal-700' : 'text-slate-400'}`} />
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
          {latestHardware?.status === 'sent' ? '已送到橋接服務；接上實體機器人後會走同一條指令路徑。' : '目前尚未連到實體機器人，但派遣、任務紀錄與示範紀錄都會完整保留。'}
        </p>
      </GlassPanel>
      <GlassPanel>
        <h3 className="text-xl font-black text-slate-950">硬體提示紀錄</h3>
        <div className="mt-4 space-y-3">
          {state.hardwareEvents.length === 0 && (
            <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-5 text-center text-sm font-semibold text-slate-400">尚無硬體事件</p>
          )}
          {state.hardwareEvents.slice(0, 8).map((event) => (
            <div key={event.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 flex-1 truncate font-black text-slate-950" title={event.command}>{event.command}</p>
                <span className={`rounded-full px-2 py-1 text-[10px] font-black ${event.status === 'sent' ? 'bg-teal-100 text-teal-700' : 'bg-amber-100 text-amber-700'}`}>
                  {event.status === 'sent' ? '已送' : '備援'}
                </span>
              </div>
              <p className="mt-1 text-xs font-semibold text-slate-500">{event.source} · {event.createdAt}</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{event.message}</p>
            </div>
          ))}
        </div>
      </GlassPanel>
      <GlassPanel>
        <h3 className="text-xl font-black text-slate-950">支援方案</h3>
        <div className="mt-4 space-y-3">
          {state.interventions.slice(0, 6).map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="font-black text-slate-950">{item.title}</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{item.description}</p>
              <p className="mt-2 text-xs font-black text-teal-700">{item.area} · {item.updatedAt}</p>
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}

function Toast({message}: {message: string | null}) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{opacity: 0, y: -16, x: '-50%'}}
          animate={{opacity: 1, y: 0, x: '-50%'}}
          exit={{opacity: 0, y: -16, x: '-50%'}}
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-20 z-80 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-2xl border border-cyan-200/30 bg-slate-950/90 px-4 py-3 text-sm font-black text-white shadow-xl backdrop-blur"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-cyan-200" />
          <span className="truncate">{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ChatScrollContainer({messages, children}: {messages: unknown[]; children: ReactNode}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [messages.length]);
  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-3">
      {children}
      <div ref={endRef} />
    </div>
  );
}

function Surface({children, className = ''}: {children: ReactNode; className?: string}) {
  return <div className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm ${className}`}>{children}</div>;
}

function GlassPanel({children, className = ''}: {children: ReactNode; className?: string}) {
  return <Surface className={`p-4 ${className}`}>{children}</Surface>;
}

const SIGNAL_TILE_STYLES: Record<string, {bg: string; val: string; lbl: string}> = {
  teal:    {bg: 'bg-teal-50/80 border-teal-200/80',       val: 'text-teal-700',    lbl: 'text-teal-500'},
  rose:    {bg: 'bg-rose-50/80 border-rose-200/80',       val: 'text-rose-700',    lbl: 'text-rose-500'},
  amber:   {bg: 'bg-amber-50/80 border-amber-200/80',     val: 'text-amber-700',   lbl: 'text-amber-600'},
  emerald: {bg: 'bg-emerald-50/80 border-emerald-200/80', val: 'text-emerald-700', lbl: 'text-emerald-600'},
};

function SignalTile({label, value, tone}: {label: string; value: string; tone: 'teal' | 'rose' | 'amber' | 'emerald'}) {
  const s = SIGNAL_TILE_STYLES[tone];
  return (
    <div className={`min-w-20 rounded-xl border p-3 ${s.bg}`}>
      <p className={`text-[10px] font-black ${s.lbl}`}>{label}</p>
      <p className={`mt-1 text-2xl font-black ${s.val}`}>{value}</p>
    </div>
  );
}

function MetricTile({label, value}: {label: string; value: string | number}) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 text-center">
      <p className="text-[10px] font-black text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-900">{value}</p>
    </div>
  );
}

function MiniMetric({label, value}: {label: string; value: string | number}) {
  return <MetricTile label={label} value={value} />;
}

function StatusLine({label, value, icon: Icon, tone = 'teal'}: {key?: unknown; label: string; value: string; icon?: LucideIcon; tone?: 'teal' | 'rose' | 'amber' | 'emerald'}) {
  const dot = tone === 'rose' ? 'bg-rose-500' : tone === 'amber' ? 'bg-amber-500' : tone === 'emerald' ? 'bg-emerald-500' : 'bg-teal-500';
  const valColor = tone === 'rose' ? 'text-rose-700' : tone === 'amber' ? 'text-amber-700' : tone === 'emerald' ? 'text-emerald-700' : 'text-teal-700';
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-slate-50/70 p-3">
      <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-600">
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-teal-600" /> : <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />}
        <span className="truncate">{label}</span>
      </span>
      <span className={`shrink-0 text-sm font-black ${valColor}`}>{value}</span>
    </div>
  );
}

function StatusChip({level}: {level: 'high' | 'medium' | 'low'}) {
  const label = level === 'high' ? '高風險 ⚠' : level === 'medium' ? '注意' : '安全';
  const tone = level === 'high'
    ? 'border-rose-200/80 bg-rose-50 text-rose-700 shadow-sm shadow-rose-100'
    : level === 'medium'
      ? 'border-amber-200/80 bg-amber-50 text-amber-700 shadow-sm shadow-amber-100'
      : 'border-emerald-200/80 bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-100';
  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${tone}`}>{label}</span>;
}

function RiskBadge({level}: {level: 'high' | 'medium' | 'low'}) {
  return <StatusChip level={level} />;
}

function PrimaryAction({children, onClick, disabled, active, className = ''}: {children: ReactNode; onClick: () => void; disabled?: boolean; active?: boolean; className?: string}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 ${
        active
          ? 'bg-emerald-600 shadow-md shadow-emerald-200 ring-4 ring-emerald-100 hover:bg-emerald-700'
          : 'bg-teal-600 shadow-md shadow-teal-200/60 hover:bg-teal-700'
      } ${className}`}
    >
      {children}
    </button>
  );
}

function IconButton({icon: Icon, label, onClick, emphasis}: {icon: LucideIcon; label: string; onClick: () => void; emphasis?: boolean}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-slate-700 shadow-sm transition hover:border-teal-200 hover:text-teal-700 ${emphasis ? 'border-slate-900 bg-slate-900 text-white hover:text-white' : 'border-slate-200 bg-white'}`}
      aria-label={label}
      title={label}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function LegendDot({tone, label}: {tone: 'emerald' | 'amber' | 'rose'; label: string}) {
  const s = tone === 'emerald'
    ? {dot: 'bg-emerald-500', pill: 'border-emerald-200/70 bg-emerald-50/80 text-emerald-700'}
    : tone === 'amber'
      ? {dot: 'bg-amber-500', pill: 'border-amber-200/70 bg-amber-50/80 text-amber-700'}
      : {dot: 'bg-rose-500', pill: 'border-rose-200/70 bg-rose-50/80 text-rose-700'};
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-black ${s.pill}`}>
      <span className={`h-2 w-2 rounded-full shadow-sm ${s.dot}`} />
      {label}
    </span>
  );
}

function InsightStrip({
  proactiveInsight,
  dispatchableCount,
  onCreateProactiveAlert,
  onOpenPanel,
}: {
  proactiveInsight: ProactiveInsight;
  dispatchableCount: number;
  onCreateProactiveAlert: () => void;
  onOpenPanel: (panel: ActivePanel) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-teal-200/50 bg-linear-to-r from-teal-50/60 to-white shadow-sm">
      <div className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-100/80 text-teal-700 shadow-sm shadow-teal-100">
            <Radar className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black text-teal-600">AI 巡查</p>
            <h3 className="mt-1 text-lg font-black text-slate-950">{proactiveInsight.riskLevel === 'high' ? '優先關懷' : proactiveInsight.riskLevel === 'medium' ? '需要觀察' : '穩定'}</h3>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 md:w-72">
          <button onClick={onCreateProactiveAlert} className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">
            建立提醒
          </button>
          <button onClick={() => onOpenPanel('alerts')} className="min-h-11 rounded-xl border border-teal-200/70 bg-white px-4 text-sm font-black text-teal-700 shadow-sm transition hover:bg-teal-50">
            {dispatchableCount} 區可派
          </button>
        </div>
      </div>
    </div>
  );
}

function panelTitle(panel: Exclude<ActivePanel, null>) {
  if (panel === 'alerts') return '注意警報';
  if (panel === 'sensing') return '感知中心';
  if (panel === 'care') return '學生照護';
  return '控制機器人';
}
