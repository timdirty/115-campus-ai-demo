import {useEffect, useMemo, useReducer, useRef, useState} from 'react';
import {useProxyHealth} from './hooks/useProxyHealth';
import type {Dispatch, ReactNode} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {
  Activity,
  Bell,
  Bot,
  CheckCircle2,
  Download,
  HeartHandshake,
  Leaf,
  Lock,
  MapPin,
  MessageSquare,
  Mic,
  MicOff,
  Radio,
  Radar,
  RefreshCw,
  Send,
  ShieldCheck,
  Siren,
  Smile,
  Upload,
  Volume2,
  Wifi,
  X,
} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import {AcousticSignal, DetectedPort, GuardianAlert, GuardianState, MoodType, ZoneSensorReading} from './types';
import {guardianReducer, loadGuardianState, normalizeGuardianState, persistGuardianState} from './state/guardianState';
import {analyzeAcousticFrame, describeAcousticSignal} from './services/acousticGuardian';
import {generateSupportReply} from './services/localGuardianAi';
import {evaluateProactiveGuardianState, ProactiveInsight} from './services/proactiveGuardian';
import {buildSchoolZoneStatuses, SchoolZoneStatus} from './services/schoolSpaces';
import {assignSensorPort, fetchSensorPorts, fetchZoneSensors, sendGuardianHardwareCommand} from './services/hardwareBridge';
import {AlertDetail, AlertRow, MetricCard, NodeRow, RiskPill} from './components/guardianUi';
import {CampusMapSvg} from './components/CampusMapSvg';
import {ZoneSensorPanel} from './components/ZoneSensorPanel';
import {SensorAssignmentWidget} from './components/SensorAssignmentWidget';

type ActivePanel = 'alerts' | 'sensing' | 'care' | 'nodes' | 'logs' | null;
type RobotDispatchFeedback = {zoneId: string; zoneName: string; stage: '指令送出' | '前往現場' | '老師確認'; createdAt: number; missionId: string} | null;
type RobotDispatchStage = NonNullable<RobotDispatchFeedback>['stage'];

interface CommandCenterViewModel {
  zones: SchoolZoneStatus[];
  highestZone: SchoolZoneStatus;
  dispatchableZones: SchoolZoneStatus[];
  proactiveInsight: ProactiveInsight;
  openAlerts: GuardianAlert[];
  highPriorityCount: number;
  activeRobotCount: number;
  latestSoundLabel: string;
  campusHealthLabel: string;
  signalSummary: Array<{label: string; value: string; tone: 'teal' | 'rose' | 'amber' | 'emerald'}>;
}

const moodOptions: Array<{mood: MoodType; label: string; note: string; tone: string}> = [
  {mood: 'happy', label: '開心', note: '今天有一點亮亮的事', tone: 'border-emerald-300 bg-emerald-400/15 text-emerald-100'},
  {mood: 'steady', label: '還可以', note: '狀態普通，能慢慢做', tone: 'border-sky-300 bg-sky-400/15 text-sky-100'},
  {mood: 'tired', label: '有點累', note: '需要短暫休息一下', tone: 'border-amber-300 bg-amber-400/15 text-amber-100'},
  {mood: 'worried', label: '有點擔心', note: '想找人一起想辦法', tone: 'border-rose-300 bg-rose-400/15 text-rose-100'},
];

const panelNav: Array<{id: Exclude<ActivePanel, null>; label: string; icon: LucideIcon}> = [
  {id: 'alerts', label: '預警', icon: Bell},
  {id: 'sensing', label: '感知', icon: Mic},
  {id: 'care', label: '照護', icon: Leaf},
  {id: 'nodes', label: '節點', icon: Radio},
  {id: 'logs', label: '紀錄', icon: Activity},
];

const defaultAcoustic = describeAcousticSignal(0, 0);
const robotDispatchSteps: RobotDispatchStage[] = ['指令送出', '前往現場', '老師確認'];

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

const CRISIS_KEYWORDS_UI = ['不想活', '想死', '自殺', '消失', '傷害自己', '活不下去', '尋死', '割腕', '跳樓', '喝農藥', '結束生命', '不想存在'];

function isCrisisMessage(text: string): boolean {
  return CRISIS_KEYWORDS_UI.some((k) => text.includes(k));
}

export default function App() {
  const [state, dispatch] = useReducer(guardianReducer, undefined, loadGuardianState);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [showDemoGuide, setShowDemoGuide] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<GuardianAlert | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<MoodType>('steady');
  const [message, setMessage] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postType, setPostType] = useState<'thought' | 'gratitude' | 'support'>('support');
  const [chatBusy, setChatBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [robotFeedback, setRobotFeedback] = useState<RobotDispatchFeedback>(null);
  const [micActive, setMicActive] = useState(false);
  const [micError, setMicError] = useState('');
  const [acousticLocation, setAcousticLocation] = useState('穿堂');
  const [currentAcoustic, setCurrentAcoustic] = useState(defaultAcoustic);
  const [zoneSensors, setZoneSensors] = useState<ZoneSensorReading[]>([]);
  const [detectedPorts, setDetectedPorts] = useState<DetectedPort[]>([]);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const robotTimersRef = useRef<number[]>([]);
  const proxyOnline = useProxyHealth();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const volumeHistoryRef = useRef<number[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const viewModel = useMemo(() => buildCommandCenterViewModel(state, zoneSensors), [state, zoneSensors]);
  const selectedZone = viewModel.zones.find((zone) => zone.id === selectedZoneId) ?? viewModel.highestZone;
  const latestMood = state.moodLogs[0];

  useEffect(() => {
    persistGuardianState(state);
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const readings = await fetchZoneSensors();
        if (!cancelled) setZoneSensors(readings);
      } catch {
        // keep last known readings on transient error
      }
    };
    poll();
    const timer = setInterval(poll, 8000);
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

  const showToast = (text: string) => setToastMessage(text);

  const sendHardwareCue = (command: string, source: string) => {
    void sendGuardianHardwareCommand(command, source).then((result) => {
      dispatch({
        type: 'RECORD_HARDWARE_EVENT',
        payload: {command, source, status: result.ok ? 'sent' : 'fallback', message: result.message},
      });
      showToast(result.ok ? `硬體已接收：${command}` : `硬體備援：${result.message}`);
    });
  };

  const dispatchRobotToZone = (zone: SchoolZoneStatus) => {
    setSelectedZoneId(zone.id);
    if (robotFeedback?.zoneId === zone.id) {
      showToast(`${zone.name} 任務已在進行中`);
      return;
    }
    const createdAt = Date.now();
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
  };

  const createProactiveAlert = () => {
    dispatch({type: 'CREATE_PROACTIVE_ALERT', payload: viewModel.proactiveInsight});
    sendHardwareCue('ALERT_SIGNAL', 'app3:proactive');
    setActivePanel('alerts');
    showToast('AI 主動巡查已建立提醒');
  };

  const recordAcousticSignal = (signal: Omit<AcousticSignal, 'id' | 'createdAt'>) => {
    dispatch({type: 'RECORD_ACOUSTIC_SIGNAL', payload: signal});
    showToast('已記錄本機環境聲量訊號');
  };

  const createAcousticAlert = () => {
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
  };

  const handleMood = (mood: MoodType) => {
    const option = moodOptions.find((item) => item.mood === mood) ?? moodOptions[1];
    setSelectedMood(mood);
    dispatch({type: 'ADD_MOOD', payload: {mood, label: option.label, note: option.note}});
  };

  const addPost = async () => {
    const content = postContent.trim();
    if (!content) return;
    const postId = `post-${Date.now().toString(36)}-${Math.floor(Math.random() * 900 + 100)}`;
    dispatch({type: 'ADD_FOREST_POST', payload: {id: postId, content, type: postType}});
    setPostContent('');
    showToast('匿名支持已加入心靈森林');
    try {
      const reply = await generateSupportReply(content, selectedMood, undefined, undefined);
      dispatch({type: 'SET_FOREST_POST_REPLY', payload: {id: postId, botReply: reply}});
    } catch {
      // silent — bot reply is a bonus, not critical
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
    try {
      setMicError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {echoCancellation: true, noiseSuppression: false, autoGainControl: false},
      });
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
      const tick = () => {
        analyser.getByteTimeDomainData(buffer);
        const reading = analyzeAcousticFrame(buffer, volumeHistoryRef.current);
        volumeHistoryRef.current = [...volumeHistoryRef.current.slice(-24), reading.volumeIndex];
        setCurrentAcoustic(reading);
        animationFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setMicError('麥克風不可用（請確認瀏覽器權限或裝置硬體），可改用示範訊號。');
      showToast('麥克風權限未開啟，可改用示範聲量');
    }
  };

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
    <div className="guardian-shell min-h-screen overflow-x-hidden bg-slate-100 text-slate-950">
      {/* Proxy Health Banner */}
      {proxyOnline === false && !bannerDismissed && (
        <div className="fixed top-0 inset-x-0 z-50 flex items-center justify-between gap-2 bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800">
          <span>⚠️ AI 橋接伺服器未連線（localhost:3200），智慧功能將使用本地模式</span>
          <button
            onClick={() => setBannerDismissed(true)}
            aria-label="關閉提示"
            className="shrink-0 w-11 h-11 flex items-center justify-center text-amber-600 hover:text-amber-900 font-medium"
          >
            ✕
          </button>
        </div>
      )}

      <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void importDemoData(event.target.files?.[0])} />
      <Toast message={toastMessage} />

      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button className="flex min-w-0 items-center gap-3 text-left" onClick={() => setActivePanel(null)}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-teal-100 bg-teal-50 text-teal-700 shadow-sm">
              <HeartHandshake className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-black tracking-tight sm:text-xl">AI 校園心靈守護者</h1>
              <p className="text-[10px] font-black text-slate-500">校園關懷中控</p>
            </div>
          </button>

          <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600 md:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {viewModel.campusHealthLabel}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setShowDemoGuide(true)} className="hidden min-h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 shadow-sm transition hover:border-teal-200 hover:text-teal-700 md:block">
              導覽
            </button>
            <IconButton onClick={exportDemoData} label="匯出展示資料" icon={Download} />
            <IconButton onClick={() => importInputRef.current?.click()} label="匯入展示資料" icon={Upload} />
            <IconButton
              onClick={() => {
                dispatch({type: 'RESET_DEMO'});
                showToast('展示資料已重置');
              }}
              label="重設展示資料"
              icon={RefreshCw}
              emphasis
            />
          </div>
        </div>
      </header>

      <SensorAssignmentWidget
        ports={detectedPorts}
        onAssigned={async () => {
          const ports = await fetchSensorPorts();
          setDetectedPorts(ports);
        }}
      />

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 pb-24 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:pb-8">
        <CommandCenterScreen
          viewModel={viewModel}
          selectedZone={selectedZone}
          selectedZoneId={selectedZoneId}
          state={state}
          robotFeedback={robotFeedback}
          onSelectZone={(zone) => {
            setSelectedZoneId(zone.id);
          }}
          onOpenPanel={setActivePanel}
          onCreateProactiveAlert={createProactiveAlert}
          onDispatchRobot={dispatchRobotToZone}
        />

        <aside className="grid gap-4 lg:sticky lg:top-[5.25rem] lg:max-h-[calc(100vh-6rem)] lg:grid-rows-[auto_1fr_auto]">
          <ZoneInspector zone={selectedZone} robotFeedback={robotFeedback} onDispatchRobot={dispatchRobotToZone} />
          <MissionTimeline state={state} robotFeedback={robotFeedback} />
          <PanelDock activePanel={activePanel} onOpenPanel={setActivePanel} onShowDemo={() => setShowDemoGuide(true)} />
        </aside>
      </main>

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
      />

      <DemoGuide open={showDemoGuide} onClose={() => setShowDemoGuide(false)} />
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
  const latestSound = state.acousticSignals[0];
  const latestSoundLabel = latestSound?.level === 'elevated' ? '偏高' : latestSound?.level === 'active' ? '活動' : '平穩';
  const offlineNodeCount = state.nodes.filter((node) => node.status === 'offline').length;
  const campusHealthLabel = highestZone?.riskLevel === 'high' ? '高風險區需立即確認' : highestZone?.riskLevel === 'medium' ? '校園有區域需觀察' : '全校維持穩定巡查';
  const signalSummary: CommandCenterViewModel['signalSummary'] = [
    {label: '待關懷提醒', value: `${openAlerts.length} 則`, tone: openAlerts.length > 3 ? 'amber' : 'teal'},
    {label: '高優先處理', value: `${highPriorityCount} 則`, tone: highPriorityCount > 0 ? 'rose' : 'emerald'},
    {label: '聲量訊號', value: latestSoundLabel, tone: latestSound?.level === 'elevated' ? 'amber' : 'teal'},
    {label: '節點狀態', value: `${offlineNodeCount} 離線`, tone: offlineNodeCount > 0 ? 'rose' : 'emerald'},
  ];

  return {zones, highestZone, dispatchableZones, proactiveInsight, openAlerts, highPriorityCount, activeRobotCount, latestSoundLabel, campusHealthLabel, signalSummary};
}

function CommandCenterScreen({
  viewModel,
  selectedZone,
  selectedZoneId,
  state,
  robotFeedback,
  onSelectZone,
  onOpenPanel,
  onCreateProactiveAlert,
  onDispatchRobot,
}: {
  viewModel: CommandCenterViewModel;
  selectedZone: SchoolZoneStatus;
  selectedZoneId: string | null;
  state: GuardianState;
  robotFeedback: RobotDispatchFeedback;
  onSelectZone: (zone: SchoolZoneStatus) => void;
  onOpenPanel: (panel: ActivePanel) => void;
  onCreateProactiveAlert: () => void;
  onDispatchRobot: (zone: SchoolZoneStatus) => void;
}) {
  return (
    <section className="grid gap-4 lg:min-h-[calc(100vh-6.5rem)] lg:grid-rows-[auto_minmax(0,1fr)_auto]">
      <Surface className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black text-teal-700">校園指揮中心</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">地圖先看</h2>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[24rem]">
            <SignalTile label="守護指數" value={`${state.stabilityScore}%`} tone="teal" />
            <SignalTile label="最高風險" value={viewModel.highestZone.riskScore.toString()} tone={viewModel.highestZone.riskLevel === 'high' ? 'rose' : 'amber'} />
            <SignalTile label="機器人" value={viewModel.activeRobotCount.toString()} tone="emerald" />
          </div>
        </div>
      </Surface>

      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <CampusMap2D zones={viewModel.zones} selectedZone={selectedZone} selectedZoneId={selectedZoneId} robotFeedback={robotFeedback} onSelectZone={onSelectZone} onDispatchRobot={onDispatchRobot} />
        <div className="grid gap-4">
          <OperationsBrief viewModel={viewModel} onOpenPanel={onOpenPanel} />
          <RobotReadinessCard state={state} robotFeedback={robotFeedback} />
          <Surface className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black text-slate-500">最高風險區</p>
                <h3 className="mt-1 text-2xl font-black text-slate-950">{viewModel.highestZone.name}</h3>
              </div>
              <StatusChip level={viewModel.highestZone.riskLevel} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <MetricTile label="風險" value={viewModel.highestZone.riskScore} />
              <MetricTile label="聲量" value={viewModel.highestZone.soundIndex} />
              <MetricTile label="提醒" value={viewModel.highestZone.alertCount} />
            </div>
            <PrimaryAction
              onClick={() => onDispatchRobot(viewModel.highestZone)}
              disabled={viewModel.highestZone.riskLevel === 'low'}
              active={robotFeedback?.zoneId === viewModel.highestZone.id}
              className="mt-4"
            >
              <Bot className={`h-5 w-5 ${robotFeedback?.zoneId === viewModel.highestZone.id ? 'animate-pulse' : ''}`} />
              {viewModel.highestZone.riskLevel === 'low' ? '維持一般巡查' : robotFeedback?.zoneId === viewModel.highestZone.id ? '已送出派遣' : '派遣機器人介入'}
            </PrimaryAction>
          </Surface>

          <Surface className="p-4">
            <p className="text-xs font-black text-slate-500">訊號總覽</p>
            <div className="mt-4 space-y-2">
              {viewModel.signalSummary.map((item) => (
                <StatusLine key={item.label} label={item.label} value={item.value} tone={item.tone} />
              ))}
            </div>
          </Surface>
        </div>
      </div>

      <InsightStrip proactiveInsight={viewModel.proactiveInsight} dispatchableCount={viewModel.dispatchableZones.length} onCreateProactiveAlert={onCreateProactiveAlert} onOpenPanel={onOpenPanel} />
    </section>
  );
}

function CampusMap2D({
  zones,
  selectedZone,
  selectedZoneId,
  robotFeedback,
  onSelectZone,
  onDispatchRobot,
}: {
  zones: SchoolZoneStatus[];
  selectedZone: SchoolZoneStatus;
  selectedZoneId: string | null;
  robotFeedback: RobotDispatchFeedback;
  onSelectZone: (zone: SchoolZoneStatus) => void;
  onDispatchRobot: (zone: SchoolZoneStatus) => void;
}) {
  const selectedLeft = Math.min(selectedZone.x, 72);
  const activeDispatch = robotFeedback?.zoneId === selectedZone.id;
  const dispatchProgress = getRobotStageProgress(activeDispatch ? robotFeedback?.stage : undefined);
  return (
    <Surface className="relative min-h-[30rem] overflow-hidden p-3 sm:min-h-[32rem] sm:p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black text-slate-500">校園平面圖</p>
          <h3 className="text-xl font-black text-slate-950">區域狀態</h3>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-black text-slate-500">
          <LegendDot tone="emerald" label="安全" />
          <LegendDot tone="amber" label="注意" />
          <LegendDot tone="rose" label="高風險" />
        </div>
      </div>
      <div className="relative min-h-[25rem] overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#f8fafc,#eef7f8)] sm:min-h-[28rem]">
        <CampusMapSvg
          zones={zones.map((z) => ({id: z.id, riskLevel: z.riskLevel, sensor: z.sensor}))}
          selectedZoneId={selectedZoneId}
          onZoneClick={(id) => {
            const zone = zones.find((z) => z.id === id);
            if (zone) onSelectZone(zone);
          }}
        />
        <div className="absolute left-[10%] top-[12%] h-2 w-[72%] -rotate-6 rounded-full bg-teal-200/70 shadow-sm" />
        <div className="absolute left-[18%] top-[59%] h-2 w-[60%] rotate-3 rounded-full bg-teal-200/70 shadow-sm" />
        <div className="absolute left-[48%] top-[15%] h-[65%] w-2 rounded-full bg-teal-200/70 shadow-sm" />
        <div className="absolute left-[48%] top-[48%] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-600 shadow-[0_0_0_8px_rgba(13,148,136,.12)]" />
        <div
          className={`robot-route-line absolute z-[8] h-2 origin-left rounded-full ${activeDispatch ? 'opacity-100' : 'opacity-35'}`}
          style={{
            left: '48%',
            top: '48%',
            width: `${Math.max(8, Math.min(30, Math.abs(selectedLeft - 48) + Math.abs(Math.min(selectedZone.y + 16, 82) - 48) / 2))}%`,
            transform: `rotate(${selectedLeft > 48 ? -18 : 28}deg)`,
          }}
        />
        <div
          className={`robot-marker absolute z-10 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[1.4rem] border border-teal-200 bg-white text-teal-700 shadow-2xl shadow-teal-200/80 ${activeDispatch ? 'robot-marker-active' : ''}`}
          style={{left: `${selectedLeft + 8}%`, top: `${Math.min(selectedZone.y + 16, 82)}%`}}
        >
          {activeDispatch && <span className="absolute h-32 w-32 rounded-full border-2 border-teal-300 opacity-70" />}
          <div className="absolute -right-2 -top-2 rounded-full bg-teal-600 px-2 py-1 text-[10px] font-black text-white shadow-sm">
            R-03
          </div>
          <div className="grid place-items-center">
            <div className="relative grid h-12 w-12 place-items-center rounded-2xl bg-teal-50">
              <Bot className="h-8 w-8" />
              <span className="absolute left-3 top-5 h-1.5 w-1.5 rounded-full bg-teal-600" />
              <span className="absolute right-3 top-5 h-1.5 w-1.5 rounded-full bg-teal-600" />
            </div>
            <span className="mt-1 text-[10px] font-black text-slate-600">{activeDispatch ? robotFeedback?.stage : '待命'}</span>
          </div>
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-teal-100 bg-white px-3 py-1.5 text-[10px] font-black text-teal-700 shadow-sm">
            守護機器人
          </div>
        </div>
        {zones.map((zone) => {
          const selected = zone.id === selectedZone.id;
          const dispatching = robotFeedback?.zoneId === zone.id;
          const left = Math.min(zone.x, 72);
          const tone =
            zone.riskLevel === 'high'
              ? 'border-rose-300 bg-rose-50 text-rose-950 shadow-rose-100'
              : zone.riskLevel === 'medium'
                ? 'border-amber-300 bg-amber-50 text-amber-950 shadow-amber-100'
                : 'border-emerald-300 bg-emerald-50 text-emerald-950 shadow-emerald-100';
          return (
            <button
              key={zone.id}
              onClick={() => onSelectZone(zone)}
              className={`campus-zone-card absolute z-20 w-[7.2rem] rounded-xl border p-2 text-left shadow-lg transition hover:-translate-y-1 sm:w-40 sm:p-3 ${tone} ${selected ? 'ring-2 ring-teal-500 ring-offset-2' : ''} ${dispatching ? 'zone-dispatch-pulse' : ''}`}
              style={{left: `${left}%`, top: `${zone.y}%`}}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-black">{zone.name}</span>
                <span className={`h-2.5 w-2.5 rounded-full ${zone.riskLevel === 'high' ? 'bg-rose-500' : zone.riskLevel === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              </span>
              <span className="mt-3 flex items-end justify-between gap-2">
                <span className="text-2xl font-black">{zone.riskScore}</span>
                <span className="text-[10px] font-black text-slate-600">{dispatching ? '派遣中' : selected ? '選取' : zone.riskLevel === 'low' ? '巡查' : '可派遣'}</span>
              </span>
            </button>
          );
        })}
        <div className="absolute bottom-3 left-3 right-3 z-30 rounded-xl border border-slate-200 bg-white/92 p-3 shadow-lg shadow-slate-200/70 backdrop-blur">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
            <div>
              <p className="text-xs font-black text-slate-500">選取區域</p>
              <p className="font-black text-slate-950">{selectedZone.name} · 風險 {selectedZone.riskScore}</p>
            </div>
            <StatusChip level={selectedZone.riskLevel} />
            <button
              onClick={() => onDispatchRobot(selectedZone)}
              disabled={selectedZone.riskLevel === 'low' || activeDispatch}
              className={`min-h-10 rounded-xl px-4 text-xs font-black text-white transition active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-500 ${activeDispatch ? 'bg-emerald-600 ring-4 ring-emerald-100' : 'bg-teal-600 hover:bg-teal-700'}`}
            >
              {selectedZone.riskLevel === 'low' ? '維持巡查' : activeDispatch ? robotFeedback?.stage : '派遣'}
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
    </Surface>
  );
}

function OperationsBrief({viewModel, onOpenPanel}: {viewModel: CommandCenterViewModel; onOpenPanel: (panel: ActivePanel) => void}) {
  return (
    <Surface className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-slate-500">今日狀態</p>
          <h3 className="mt-1 text-lg font-black text-slate-950">{viewModel.campusHealthLabel}</h3>
        </div>
        <StatusChip level={viewModel.highestZone.riskLevel} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={() => onOpenPanel('alerts')} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-teal-200 hover:bg-teal-50">
          <p className="text-[10px] font-black text-slate-500">預警</p>
          <p className="mt-1 text-2xl font-black text-slate-950">{viewModel.highPriorityCount}</p>
        </button>
        <button onClick={() => onOpenPanel('sensing')} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-teal-200 hover:bg-teal-50">
          <p className="text-[10px] font-black text-slate-500">聲量</p>
          <p className="mt-1 text-2xl font-black text-slate-950">{viewModel.latestSoundLabel}</p>
        </button>
      </div>
    </Surface>
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
          <h3 className="mt-1 text-lg font-black text-slate-950">{robotFeedback ? `${robotFeedback.zoneName}：${robotFeedback.stage}` : connected ? '硬體已接收' : '展示備援就緒'}</h3>
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
  const riskTone = zone.riskLevel === 'high' ? 'bg-rose-500' : zone.riskLevel === 'medium' ? 'bg-amber-500' : 'bg-emerald-500';
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
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-black text-slate-500">
          <span>風險刻度</span>
          <span>{zone.riskScore}/100</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${riskTone}`} style={{width: `${zone.riskScore}%`}} />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <MetricTile label="穩定" value={zone.stability} />
        <MetricTile label="風險" value={zone.riskScore} />
        <MetricTile label="聲量" value={zone.soundIndex} />
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
      {['送出', '抵達', '回報'].map((step, index) => {
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
      <div className="grid grid-cols-5 gap-1">
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
  micActive: boolean;
  micError: string;
  currentAcoustic: ReturnType<typeof describeAcousticSignal>;
  acousticLocation: string;
  setAcousticLocation: (value: string) => void;
  proactiveInsight: ProactiveInsight;
  robotFeedback: RobotDispatchFeedback;
  onClose: () => void;
  onMood: (mood: MoodType) => void;
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
            className="fixed bottom-0 right-0 z-50 flex max-h-[88vh] w-full flex-col rounded-t-2xl border border-slate-200 bg-white p-4 text-slate-950 shadow-2xl shadow-slate-950/15 sm:max-w-xl lg:bottom-4 lg:right-4 lg:top-[5.25rem] lg:max-h-none lg:rounded-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs font-black text-teal-700">工作抽屜</p>
                <h2 className="text-2xl font-black">{panelTitle(panel)}</h2>
              </div>
              <button onClick={props.onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-4">
              {panel === 'alerts' && <AlertsPanel {...props} />}
              {panel === 'sensing' && <SensingPanel {...props} />}
              {panel === 'care' && <CarePanel {...props} />}
              {panel === 'nodes' && <NodesPanel {...props} />}
              {panel === 'logs' && <LogsPanel {...props} />}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function AlertsPanel({state, selectedAlert, setSelectedAlert, dispatch, onHardwareCommand}: Parameters<typeof DetailDrawer>[0]) {
  const openCount = state.alerts.filter((alert) => alert.status !== 'resolved').length;
  const processingCount = state.alerts.filter((alert) => alert.status === 'processing').length;
  const highCount = state.alerts.filter((alert) => alert.riskLevel === 'high' && alert.status !== 'resolved').length;
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
        <input value={acousticLocation} onChange={(event) => setAcousticLocation(event.target.value)} aria-label="感測位置" placeholder="例：穿堂、教室等位置" className="mt-4 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button onClick={() => onRecordAcoustic({source: micActive ? 'microphone' : 'demo', location: acousticLocation, ...currentAcoustic})} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-black text-slate-700">
            記錄
          </button>
          <button onClick={onCreateAcousticAlert} className="rounded-xl bg-teal-600 px-3 py-3 text-xs font-black text-white">
            建立提醒
          </button>
          <button onClick={onDemoSound} className="rounded-xl bg-slate-100 px-3 py-3 text-xs font-black text-slate-700">
            示範
          </button>
        </div>
      </GlassPanel>

      <GlassPanel>
        <p className="text-xs font-black text-slate-500">主動判斷</p>
        <h3 className="mt-2 text-xl font-black text-slate-950">{proactiveInsight.title}</h3>
        <button onClick={onCreateProactiveAlert} className="mt-4 min-h-11 w-full rounded-xl bg-slate-950 text-sm font-black text-white">
          由多來源訊號建立提醒
        </button>
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
  message,
  setMessage,
  onSendMessage,
  chatBusy,
}: Parameters<typeof DetailDrawer>[0]) {
  const [counselingInfoVisible, setCounselingInfoVisible] = useState(false);
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
        <h3 className="text-xl font-black text-slate-950">心靈森林</h3>
        <div className="mt-3 flex gap-2">
          {(['support', 'gratitude', 'thought'] as const).map((type) => (
            <button key={type} onClick={() => setPostType(type)} className={`rounded-xl px-3 py-2 text-xs font-black ${postType === type ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {type === 'support' ? '互助' : type === 'gratitude' ? '感謝' : '想法'}
            </button>
          ))}
        </div>
        <textarea value={postContent} onChange={(event) => setPostContent(event.target.value)} maxLength={500} className="mt-3 min-h-24 w-full rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" placeholder="匿名寫下一句支持自己的話..." />
        <p className="text-right text-xs text-gray-400 mt-0.5">{postContent.length} / 500</p>
        <button onClick={onAddPost} disabled={!postContent.trim()} className="mt-3 min-h-11 w-full rounded-xl bg-teal-600 text-sm font-black text-white disabled:opacity-50 disabled:cursor-not-allowed">發表葉子</button>
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
            {chatBusy && <div className="w-fit rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-500">整理回覆中...</div>}
          </ChatScrollContainer>
          <div className="flex gap-2 border-t border-slate-200 p-3">
            <div className="flex flex-col flex-1">
              <input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && !chatBusy && onSendMessage()} maxLength={300} className="min-h-11 w-full rounded-xl bg-white px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-100" placeholder="輸入今天想說的心情..." />
              <p className="text-right text-xs text-gray-400 mt-0.5">{message.length} / 300</p>
            </div>
            <button onClick={onSendMessage} disabled={chatBusy || !message.trim()} className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-600 text-white disabled:opacity-40">
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
                  {robotFeedback?.zoneId === zone.id ? '派遣確認中' : zone.riskLevel === 'low' ? '維持巡查' : '可派遣'} · 風險 {zone.riskScore}
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
            <h3 className="mt-1 text-xl font-black text-slate-950">{robotFeedback ? `${robotFeedback.zoneName} 派遣中` : latestHardware?.status === 'sent' ? '硬體已接收' : '備援流程可展示'}</h3>
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

function DemoGuide({open, onClose}: {open: boolean; onClose: () => void}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button className="fixed inset-0 z-[60] bg-slate-950/30 backdrop-blur-sm" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} onClick={onClose} aria-label="關閉展示導覽" />
          <motion.div
            initial={{opacity: 0, y: 24, scale: 0.98}}
            animate={{opacity: 1, y: 0, scale: 1}}
            exit={{opacity: 0, y: 24, scale: 0.98}}
            className="fixed left-1/2 top-1/2 z-[70] w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-6 text-slate-950 shadow-2xl shadow-slate-950/15"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black text-teal-700">操作導覽</p>
                <h2 className="mt-2 text-2xl font-black">10 秒上手主流程</h2>
              </div>
              <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                {title: '看地圖，找風險', desc: '主畫面地圖顯示各區域風險、聲量與提醒數'},
                {title: '指派機器人介入', desc: '點選中高風險區，按派遣按鈕送出關懷指令'},
                {title: '預警抽屜', desc: '選一筆提醒，勾選處置清單，更新處理狀態'},
                {title: '感知抽屜', desc: '啟用麥克風偵測或按示範訊號，建立聲量提醒'},
                {title: '照護抽屜', desc: '心情簽到、匿名心情牆、安全空間聊天'},
                {title: '節點抽屜', desc: '查看節點狀態，一鍵重新連線離線節點'},
                {title: '紀錄抽屜', desc: '確認機器人任務、硬體提示與支持方案'},
                {title: '匯出與重置', desc: '匯出 JSON 留存展示資料，或重置回初始狀態'},
              ].map(({title, desc}, index) => (
                <div key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black text-teal-700">0{index + 1}</p>
                  <p className="mt-1 text-sm font-bold leading-5 text-slate-800">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
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
          className="fixed left-1/2 top-20 z-[80] flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-2xl border border-cyan-200/30 bg-slate-950/90 px-4 py-3 text-sm font-black text-white shadow-xl backdrop-blur"
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
  return <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

function GlassPanel({children, className = ''}: {children: ReactNode; className?: string}) {
  return <Surface className={`p-4 ${className}`}>{children}</Surface>;
}

function SignalTile({label, value, tone}: {label: string; value: string; tone: 'teal' | 'rose' | 'amber' | 'emerald'}) {
  const toneClass = tone === 'teal' ? 'text-teal-700' : tone === 'rose' ? 'text-rose-700' : tone === 'amber' ? 'text-amber-700' : 'text-emerald-700';
  return (
    <div className="min-w-20 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[10px] font-black text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-black ${toneClass}`}>{value}</p>
    </div>
  );
}

function MetricTile({label, value}: {label: string; value: string | number}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
      <p className="text-[10px] font-black text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function MiniMetric({label, value}: {label: string; value: string | number}) {
  return <MetricTile label={label} value={value} />;
}

function StatusLine({label, value, icon: Icon, tone = 'teal'}: {key?: unknown; label: string; value: string; icon?: LucideIcon; tone?: 'teal' | 'rose' | 'amber' | 'emerald'}) {
  const dot = tone === 'rose' ? 'bg-rose-500' : tone === 'amber' ? 'bg-amber-500' : tone === 'emerald' ? 'bg-emerald-500' : 'bg-teal-500';
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-600">
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-teal-700" /> : <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />}
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 text-sm font-black text-slate-950">{value}</span>
    </div>
  );
}

function StatusChip({level}: {level: 'high' | 'medium' | 'low'}) {
  const label = level === 'high' ? '高風險 ⚠' : level === 'medium' ? '注意' : '安全';
  const tone = level === 'high' ? 'border-rose-200 bg-rose-50 text-rose-700' : level === 'medium' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700';
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
      className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-white shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 ${
        active ? 'bg-emerald-600 ring-4 ring-emerald-100 hover:bg-emerald-700' : 'bg-teal-600 hover:bg-teal-700'
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
      className={`flex h-10 w-10 items-center justify-center rounded-xl border text-slate-700 shadow-sm transition hover:border-teal-200 hover:text-teal-700 ${emphasis ? 'border-slate-900 bg-slate-900 text-white hover:text-white' : 'border-slate-200 bg-white'}`}
      aria-label={label}
      title={label}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function LegendDot({tone, label}: {tone: 'emerald' | 'amber' | 'rose'; label: string}) {
  const color = tone === 'emerald' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1">
      <span className={`h-2 w-2 rounded-full ${color}`} />
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
    <Surface className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center">
      <div className="flex min-w-0 gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
          <Radar className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black text-teal-700">AI 巡查</p>
          <h3 className="mt-1 text-lg font-black text-slate-950">{proactiveInsight.riskLevel === 'high' ? '優先關懷' : proactiveInsight.riskLevel === 'medium' ? '需要觀察' : '穩定'}</h3>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 md:w-72">
        <button onClick={onCreateProactiveAlert} className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-black text-white">
          建立提醒
        </button>
        <button onClick={() => onOpenPanel('alerts')} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">
          {dispatchableCount} 區可派
        </button>
      </div>
    </Surface>
  );
}

function panelTitle(panel: Exclude<ActivePanel, null>) {
  if (panel === 'alerts') return '預警與處置';
  if (panel === 'sensing') return '聲量感知';
  if (panel === 'care') return '學生照護';
  if (panel === 'nodes') return '節點與空間';
  return '紀錄與證據';
}
