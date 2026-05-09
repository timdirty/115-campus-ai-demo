import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BottomSheet } from '../components/ui';
import {
  Calendar, Terminal, Thermometer, Droplets, Wind, Activity,
  AlertOctagon, Zap, Radio, Clock, ChevronRight, Megaphone,
  Users, ShieldAlert, Sparkles, Package, Eye,
} from 'lucide-react';
import { useAppActions, useAppState } from '../state/AppStateProvider';
import { sendHardwareCommand } from '../services/hardwareBridge';
import { analyzeCampusImageWithGemini, type CampusVisionResult, type VisionScene } from '../services/localVision';

let _eventId = 100;

const SCENE_IMAGES: Record<VisionScene, string> = {
  crowd:    '/scenes/crowd.png',
  safety:   '/scenes/safety.png',
  cleaning: '/scenes/cleaning.png',
  delivery: '/scenes/delivery.png',
  patrol:   '/scenes/patrol.png',
};

const SCENE_ACCENTS: Record<VisionScene, string> = {
  crowd: '#f59e0b',
  safety: '#ef4444',
  cleaning: '#14b8a6',
  delivery: '#22c55e',
  patrol: '#3b82f6',
};

const SCENE_ICONS: Record<VisionScene, typeof Users> = {
  crowd: Users,
  safety: ShieldAlert,
  cleaning: Sparkles,
  delivery: Package,
  patrol: Eye,
};

const SCENE_ACTION_LABELS: Record<VisionScene, string> = {
  crowd: '立即廣播疏導',
  safety: '緊急安全巡查',
  cleaning: '派遣清掃任務',
  delivery: '配送服務派遣',
  patrol: '開始巡邏任務',
};

const HERO_SCENES: VisionScene[] = ['crowd', 'safety', 'cleaning', 'delivery', 'patrol'];

const SCENE_DEMO_RESULTS: Record<VisionScene, CampusVisionResult> = {
  crowd:    { scene: 'crowd',    label: '人流疏導辨識', confidence: 91, zone: 'B-4 走廊',   isReliable: true, summary: '畫面符合下課人流情境，適合啟動廣播疏導。',       suggestedAction: '派遣疏導廣播並提示慢行',     dispatchTaskType: 'broadcast', command: 'VISION_CROWD_BROADCAST', tags: ['人流','廣播','疏導'], evidence: ['示範場景','人流偏高'] },
  safety:   { scene: 'safety',   label: '安全巡查辨識', confidence: 88, zone: 'A-2 入口',   isReliable: true, summary: '走廊存在阻塞物，建議保守派巡邏。',               suggestedAction: '建立安全巡查並保留影像回報', dispatchTaskType: 'patrol',    command: 'VISION_SAFETY_PATROL',   tags: ['安全','阻塞','巡查'], evidence: ['示範場景','物品阻塞'] },
  cleaning: { scene: 'cleaning', label: '清掃需求辨識', confidence: 85, zone: 'B 棟走廊',   isReliable: true, summary: '地面有明顯清潔需求，建議加入清潔巡邏。',         suggestedAction: '派清掃路線並回傳完成狀態',   dispatchTaskType: 'patrol',    command: 'VISION_CLEAN_SWEEP',     tags: ['清掃','走廊','地面'], evidence: ['示範場景','地面髒污'] },
  delivery: { scene: 'delivery', label: '物品配送辨識', confidence: 93, zone: '五年級教室', isReliable: true, summary: '畫面為取餐配送情境，適合派服務機器人協助。',     suggestedAction: '建立配送提示讓機器人前往',   dispatchTaskType: 'patrol',    command: 'VISION_DELIVERY_ROUTE', tags: ['取物','教室','服務'], evidence: ['示範場景','取餐情境'] },
  patrol:   { scene: 'patrol',   label: '一般巡邏辨識', confidence: 79, zone: '操場入口',   isReliable: true, summary: '畫面未見急迫事件，適合列入日常巡邏與環境紀錄。', suggestedAction: '排入巡邏熱區並持續觀察',     dispatchTaskType: 'patrol',    command: 'VISION_PATROL',         tags: ['巡邏','紀錄','觀察'], evidence: ['示範場景','正常狀態'] },
};

function truncateVisionLine(text: string, max = 20) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

const SCAN_ZONES = [
  { id: 'b4',  label: 'B-4 走廊',  status: '人流偏高',  level: 'warn'  as const, cx: '38%', cy: '48%' },
  { id: 'a2',  label: 'A-2 入口',  status: '正常通行',  level: 'ok'    as const, cx: '63%', cy: '31%' },
  { id: 'ops', label: '操場出口', status: '正常通行', level: 'ok'    as const, cx: '52%', cy: '68%' },
];

const ZONE_MSGS: Record<'warn' | 'ok' | 'error', string[]> = {
  warn:  ['人流密度偏高', '走廊壅塞', '需要疏導'],
  ok:    ['人員正常流動', '場域正常', '無異常狀況'],
  error: ['偵測到異常聚集', '緊急狀況', '需立即處置'],
};

// Full school bell schedule — done/next computed from real time
const ALL_BELLS = [
  { label: '到校',  time: '07:50' },
  { label: '第1節', time: '08:00' },
  { label: '下課',  time: '08:40' },
  { label: '第2節', time: '08:50' },
  { label: '下課',  time: '09:30' },
  { label: '第3節', time: '09:40' },
  { label: '下課',  time: '10:20' },
  { label: '第4節', time: '10:40' },
  { label: '午餐',  time: '11:20' },
  { label: '午休',  time: '12:00' },
  { label: '第5節', time: '13:00' },
  { label: '下課',  time: '13:40' },
  { label: '第6節', time: '13:50' },
  { label: '放學',  time: '14:30' },
];

function toMins(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function computeBells() {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const afterSchool = nowMins >= toMins('14:30');

  // If after school, show tomorrow's schedule (all upcoming)
  const base = afterSchool
    ? ALL_BELLS.map(b => ({ ...b, done: false, next: false }))
    : ALL_BELLS.map(b => ({ ...b, done: toMins(b.time) <= nowMins, next: false }));

  // Mark first undone as "next"
  const nextIdx = base.findIndex(b => !b.done);
  if (nextIdx !== -1) base[nextIdx] = { ...base[nextIdx], next: true };

  // Show a window: 2 before next + next + 3 after
  const windowStart = Math.max(0, nextIdx === -1 ? base.length - 6 : nextIdx - 2);
  return base.slice(windowStart, windowStart + 6);
}

const BROADCAST_ZONES = ['全校', 'A棟', 'B棟', '操場'];

const MATCH_PCT = ['98%', '95%', '91%'];

function levelColor(level: 'ok' | 'warn' | 'error') {
  return level === 'error' ? 'text-error' : level === 'warn' ? 'text-amber-400' : 'text-[#87d46c]';
}
function levelBg(level: 'ok' | 'warn' | 'error') {
  return level === 'error'
    ? 'bg-error/20 border-error/30'
    : level === 'warn'
    ? 'bg-amber-400/15 border-amber-400/30'
    : 'bg-[#87d46c]/15 border-[#87d46c]/30';
}

export function LifeView({
  showToast,
  navigateTo,
}: {
  showToast: (msg: string) => void;
  navigateTo: (id: string, props?: Record<string, unknown>) => void;
}) {
  const state   = useAppState();
  const actions = useAppActions();

  const [modal,             setModal]             = useState<string | null>(null);
  const [scanZoneIdx,       setScanZoneIdx]       = useState(0);
  const [broadcastZones,    setBroadcastZones]    = useState<Set<string>>(new Set(['全校']));
  const [broadcastPressing, setBroadcastPressing] = useState(false);
  const [broadcastSent,     setBroadcastSent]     = useState(false);
  const [lastUpdated,       setLastUpdated]       = useState<Date>(new Date());
  const [editingSchedule,   setEditingSchedule]   = useState('');
  const [editTime,          setEditTime]          = useState('');
  const [editArea,          setEditArea]          = useState('');
  const [bellSchedule,      setBellSchedule]      = useState(computeBells);
  const [heroSceneIdx,      setHeroSceneIdx]      = useState(0);
  const [aiEvents, setAiEvents] = useState<{ id: number; zone: string; msg: string; level: 'ok' | 'warn' | 'error'; time: string }[]>(() => {
    const now = new Date();
    const t = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
    return [
      { id: 1, zone: 'B-4 走廊',  msg: '人流密度偏高',    level: 'warn',  time: t },
      { id: 2, zone: 'A-2 入口',  msg: '人員正常流動',    level: 'ok',    time: t },
      { id: 3, zone: '操場出口', msg: '偵測到異常聚集', level: 'error', time: t },
    ];
  });
  const scanZoneIdxRef = useRef(0);
  const videoRef        = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const analyzeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevVisionSceneRef = useRef<VisionScene | null>(null);
  // Stability: track last 2 reliable scene results — only commit if consecutive match
  const stableFramesRef = useRef<{ scene: VisionScene; count: number } | null>(null);
  const [cameraError,   setCameraError]   = useState<string | null>(null);
  const [visionResult,  setVisionResult]  = useState<CampusVisionResult | null>(null);
  const [cameraReady,   setCameraReady]   = useState(false);
  const [isAnalyzing,   setIsAnalyzing]   = useState(false);

  const sensors    = state.sensors;
  const isEmergency = state.campusStatus.isEmergency;
  const remindWarning = state.settings.remindWarning;

  const sensorsRef  = useRef(sensors);
  const logsEndRef  = useRef<HTMLDivElement>(null);
  useEffect(() => { sensorsRef.current = sensors; }, [sensors]);

  // Sensor fluctuation
  useEffect(() => {
    const intv = setInterval(() => {
      const s = sensorsRef.current;
      actions.tickSensors({
        temp: +(s.temp + (Math.random() * 0.4 - 0.2)).toFixed(1),
        hum:  Math.max(0, Math.min(100, Math.round(s.hum  + (Math.random() * 2 - 1)))),
        aqi:  Math.max(0, Math.round(s.aqi + (Math.random() * 4 - 2))),
      });
      setLastUpdated(new Date());
    }, 3000);
    return () => clearInterval(intv);
  }, [actions]);

  // Auto-cycle scan zones every 3 s — generate real-time events
  useEffect(() => {
    const intv = setInterval(() => {
      const nextIdx = (scanZoneIdxRef.current + 1) % SCAN_ZONES.length;
      scanZoneIdxRef.current = nextIdx;
      setScanZoneIdx(nextIdx);
      const zone = SCAN_ZONES[nextIdx];
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
      const msgs = ZONE_MSGS[zone.level];
      const msg = msgs[Math.floor(Math.random() * msgs.length)];
      setAiEvents(prev => [
        { id: ++_eventId, zone: zone.label, msg, level: zone.level, time: timeStr },
        ...prev.slice(0, 4),
      ]);
    }, 3000);
    return () => clearInterval(intv);
  }, []);

  // Refresh bell schedule every minute so done/next stays current
  useEffect(() => {
    const intv = setInterval(() => setBellSchedule(computeBells()), 60_000);
    return () => clearInterval(intv);
  }, []);

  // Hero card scene demo cycling — advances every 5 s when camera modal is closed
  useEffect(() => {
    if (modal === 'mapcam') return;
    const intv = setInterval(() => {
      setHeroSceneIdx(prev => (prev + 1) % HERO_SCENES.length);
    }, 5000);
    return () => clearInterval(intv);
  }, [modal]);

  // Camera: start when mapcam modal opens, stop on close
  useEffect(() => {
    if (modal !== 'mapcam') {
      cameraStreamRef.current?.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
      setCameraReady(false);
      setCameraError(null);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('此裝置不支援相機存取');
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } } })
      .then(stream => {
        cameraStreamRef.current = stream;
        setCameraError(null);
        // Attach stream after video element mounts (short delay)
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => setCameraReady(true);
          }
        }, 100);
      })
      .catch(err => {
        setCameraError(err.name === 'NotAllowedError' ? '相機權限被拒絕，請在瀏覽器允許' : `相機錯誤：${err.message}`);
      });
    return () => {
      cameraStreamRef.current?.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
      setCameraReady(false);
    };
  }, [modal]);

  // Frame analysis: capture frame → Gemini Vision classify (fallback: pixel)
  // Runs every 4s; skips if a previous call is still in-flight.
  useEffect(() => {
    if (modal !== 'mapcam' || !cameraReady) return;
    if (!analyzeCanvasRef.current) analyzeCanvasRef.current = document.createElement('canvas');
    const canvas = analyzeCanvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let busy = false;
    const cancelController = new AbortController();

    const analyze = async () => {
      if (busy || cancelController.signal.aborted) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth) return;

      // Capture frame as JPEG data URL (quality 0.6 to keep base64 small)
      const scale = Math.min(1, 320 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width  = Math.max(1, Math.round(video.videoWidth  * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);

      busy = true;
      setIsAnalyzing(true);
      try {
        const result = await analyzeCampusImageWithGemini(dataUrl, cancelController.signal);
        if (cancelController.signal.aborted) return;

        stableFramesRef.current = { scene: result.scene, count: 1 };
        setVisionResult(result);
        setIsAnalyzing(false);
        const now = new Date();
        const t = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
        const lvl: 'ok' | 'warn' | 'error' =
          result.scene === 'safety' ? 'error' : result.scene === 'crowd' ? 'warn' : 'ok';
        setAiEvents(prev2 => [
          { id: ++_eventId, zone: result.zone, msg: result.label, level: lvl, time: t },
          ...prev2.slice(0, 4),
        ]);
      } catch {
        // ignore transient errors
      } finally {
        busy = false;
        setIsAnalyzing(false);
      }
    };

    void analyze();
    const intv = setInterval(() => { void analyze(); }, 3000);
    return () => {
      cancelController.abort();
      clearInterval(intv);
      stableFramesRef.current = null;
      setIsAnalyzing(false);
    };
  }, [modal, cameraReady]);

  // Auto-dispatch scene-specific hardware command when the detected scene changes.
  useEffect(() => {
    if (!visionResult || prevVisionSceneRef.current === visionResult.scene) return;
    prevVisionSceneRef.current = visionResult.scene;
    sendHardwareCommand(visionResult.command, 'life-vision').catch(() => {});
  }, [visionResult]);

  // Scroll logs to bottom
  useEffect(() => {
    if (modal === 'logs' && logsEndRef.current)
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [state.logs, modal]);

  const currentZone = SCAN_ZONES[scanZoneIdx];
  const heroScene: VisionScene = HERO_SCENES[heroSceneIdx];
  // Real camera result takes priority; fall back to cycling demo scene
  const activeVision: CampusVisionResult = visionResult ?? SCENE_DEMO_RESULTS[heroScene];
  const visionAccent = SCENE_ACCENTS[activeVision.scene];
  const VisionSceneIcon = SCENE_ICONS[activeVision.scene];
  const visionActionLabel = SCENE_ACTION_LABELS[activeVision.scene];

  const toggleBroadcastZone = (zone: string) => {
    if (zone === '全校') { setBroadcastZones(new Set(['全校'])); return; }
    const next = new Set(broadcastZones);
    next.delete('全校');
    if (next.has(zone)) next.delete(zone); else next.add(zone);
    if (next.size === 0) next.add('全校');
    setBroadcastZones(next);
  };

  const handleEmergencyBroadcast = useCallback(() => {
    if (!broadcastPressing) {
      setBroadcastPressing(true);
      setTimeout(() => setBroadcastPressing(false), 2500);
      return;
    }
    const zones = Array.from(broadcastZones).join('、');
    // Log to state so it appears in 系統日誌
    actions.addDispatchTask({ zone: zones, taskType: 'broadcast' });
    // Fire hardware command (non-blocking, best-effort)
    sendHardwareCommand('BROADCAST_EMERGENCY', 'life').catch(() => {});
    setBroadcastSent(true);
    showToast('緊急廣播已發送至：' + zones);
    setTimeout(() => setBroadcastSent(false), 3000);
    setBroadcastPressing(false);
  }, [broadcastPressing, broadcastZones, actions, showToast]);

  const handleOpenSchedule = (id: string, time: string, area: string) => {
    setEditingSchedule(id); setEditTime(time); setEditArea(area);
    setModal('schedule');
  };
  const handleSaveSchedule = () => {
    if (!editTime.trim() || !editArea.trim()) { showToast('時間和區域不能為空'); return; }
    actions.saveSchedule({ id: editingSchedule, time: editTime.trim(), area: editArea.trim() });
    showToast('任務排程設定已更新');
    setModal(null);
  };

  const firstUndoneIdx = bellSchedule.findIndex(b => !b.done);

  return (
    <div className="space-y-4 pb-10">

      {/* ① Emergency Banner */}
      <div className={`rounded-2xl px-5 py-3.5 flex items-center justify-between border transition-all duration-500 ${isEmergency ? 'bg-error text-white border-error shadow-lg shadow-error/30' : 'bg-surface-container-low border-outline-variant/30'}`}>
        <div className="flex items-center gap-3">
          <AlertOctagon size={18} className={isEmergency ? 'text-white animate-pulse' : 'text-error'} />
          <div>
            <p className={`text-[10px] font-black tracking-widest uppercase font-mono ${isEmergency ? 'text-white/70' : 'text-on-surface-variant/50'}`}>全校安全應變</p>
            <p className={`text-sm font-bold leading-none mt-0.5 ${isEmergency ? 'text-white' : 'text-on-surface'}`}>
              {isEmergency ? '[CRITICAL] 全校進入封控模式' : '系統待命 · 正常狀態'}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            actions.setEmergency(!isEmergency);
            showToast(isEmergency ? '已解除緊急狀態，系統恢復正常' : '【警告】全校進入緊急安全封控模式！');
          }}
          className={`shrink-0 relative w-14 h-7 rounded-full transition-all duration-500 border-2 ${isEmergency ? 'bg-white border-white' : 'bg-surface-container-high border-outline-variant/30'}`}
        >
          <motion.div
            animate={{ x: isEmergency ? 28 : 2 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={`absolute top-0.5 w-5 h-5 rounded-full shadow-lg ${isEmergency ? 'bg-error' : 'bg-white'}`}
          />
        </button>
      </div>

      {/* ② Sensor Chips Row */}
      <div className="flex items-center gap-2 flex-wrap px-1">
        {[
          { icon: Thermometer, val: `${sensors.temp}°C`,  label: '溫度', warn: sensors.temp > 35 || isEmergency },
          { icon: Droplets,    val: `${sensors.hum}%`,    label: '濕度', warn: sensors.hum  > 85 || isEmergency },
          { icon: Wind,        val: `AQI ${sensors.aqi}`, label: '空氣', warn: sensors.aqi  > 100 || isEmergency },
          { icon: Activity,    val: isEmergency ? '封閉' : '良好', label: '通風', warn: isEmergency },
        ].map(s => (
          <motion.button
            key={s.label}
            whileTap={{ scale: 0.94 }}
            onClick={() => showToast(`${s.label}感測器資料同步中…`)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border text-sm font-bold transition-all ${s.warn ? 'bg-error/10 border-error/30 text-error' : 'bg-surface-container-low border-outline-variant/30 text-on-surface hover:border-primary/40'}`}
          >
            <s.icon size={14} className="shrink-0" />
            <span>{s.val}</span>
          </motion.button>
        ))}
        <span className="ml-auto text-[10px] text-on-surface-variant/40 font-mono font-bold">
          更新 {lastUpdated.getHours().toString().padStart(2, '0')}:{lastUpdated.getMinutes().toString().padStart(2, '0')}
        </span>
      </div>

      {/* ③ AI Monitor Hero Card */}
      <section className="px-1">
        <motion.div
          className="relative h-80 bg-[#0c121d] rounded-2xl overflow-hidden border-2 border-primary/20 cursor-pointer shadow-2xl"
          onClick={() => setModal('mapcam')}
          whileHover={{ borderColor: 'rgba(var(--color-primary),0.5)' }}
          whileTap={{ scale: 0.99 }}
        >
          {/* Campus floor plan (mini) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style={{ opacity: 0.18 }}>
            <rect x="4" y="20" width="32" height="34" rx="2" fill="rgba(74,128,219,0.1)" stroke="#4a80db" strokeWidth="0.7"/>
            <text x="20" y="38" fill="#4a80db" fontSize="4" textAnchor="middle" fontFamily="monospace">B棟</text>
            <rect x="46" y="8" width="46" height="38" rx="2" fill="rgba(74,128,219,0.1)" stroke="#4a80db" strokeWidth="0.7"/>
            <text x="69" y="27" fill="#4a80db" fontSize="4" textAnchor="middle" fontFamily="monospace">A棟</text>
            <rect x="26" y="41" width="46" height="11" rx="1.5" fill="rgba(74,128,219,0.15)" stroke="#4a80db" strokeWidth="0.4" strokeDasharray="2,1.5"/>
            <text x="49" y="48" fill="#4a80db" fontSize="2.5" textAnchor="middle" fontFamily="monospace">走廊</text>
            <rect x="12" y="57" width="70" height="30" rx="3" fill="rgba(74,128,219,0.06)" stroke="#4a80db" strokeWidth="0.5" strokeDasharray="3,2"/>
            <text x="47" y="73" fill="#4a80db" fontSize="4" textAnchor="middle" fontFamily="monospace">操場</text>
          </svg>

          {/* Scene photo — cycles every 5 s, fades in as dark background layer */}
          <AnimatePresence mode="wait">
            <motion.img
              key={heroScene}
              src={SCENE_IMAGES[heroScene]}
              alt=""
              aria-hidden
              initial={{ opacity: 0, scale: 1.06 }}
              animate={{ opacity: 0.28, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 1.0, ease: 'easeOut' }}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />
          </AnimatePresence>

          {/* Zone dots */}
          {SCAN_ZONES.map((zone, i) => (
            <div key={zone.id} className="absolute" style={{ left: zone.cx, top: zone.cy, transform: 'translate(-50%,-50%)' }}>
              {i === scanZoneIdx && (
                <div className={`absolute w-4 h-4 rounded-full animate-ping ${zone.level === 'warn' ? 'bg-amber-400/60' : 'bg-[#87d46c]/60'}`} style={{ transform: 'scale(2.5)' }} />
              )}
              <div className={`w-3.5 h-3.5 rounded-full border-2 border-white/80 shadow-lg relative z-10 ${zone.level === 'warn' ? 'bg-amber-400' : 'bg-[#87d46c]'}`} />
              <div className={`absolute top-5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold whitespace-nowrap border z-10 transition-all ${i === scanZoneIdx ? 'bg-primary/90 text-white border-white/20 opacity-100' : 'opacity-0'}`}>
                {zone.label}
              </div>
            </div>
          ))}

          {/* Scan box */}
          <AnimatePresence mode="wait">
            <motion.div
              key={scanZoneIdx}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: [1, 1.05, 1] }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ duration: 0.4, scale: { duration: 3, repeat: Infinity, ease: 'easeInOut' } }}
              className="absolute w-36 h-36 border-2 border-primary/60 pointer-events-none z-20"
              style={{ left: SCAN_ZONES[scanZoneIdx].cx, top: SCAN_ZONES[scanZoneIdx].cy, transform: 'translate(-50%,-50%)' }}
            >
              {/* Corners */}
              <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
              <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
              <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
              <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />
              {/* Label */}
              <div className="absolute -top-8 left-0 bg-primary text-white text-[9px] font-mono font-bold px-2.5 py-1 rounded-full whitespace-nowrap border border-white/20 shadow-lg">
                目標分析：匹配度 {MATCH_PCT[scanZoneIdx]}
              </div>
              {/* Scan line */}
              <motion.div
                animate={{ y: ['-100%', '100%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-x-0 h-0.5 bg-primary/60"
                style={{ filter: 'blur(1px)' }}
              />
            </motion.div>
          </AnimatePresence>

          {/* Bottom overlay */}
          <div className="absolute bottom-0 inset-x-0 p-4 pt-14" style={{ background: 'linear-gradient(to top, #0c121d 60%, transparent)' }}>
            <div className="flex items-end justify-between mb-3">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                  <span className="text-[9px] text-primary font-extrabold tracking-[0.2em] font-mono uppercase">AI 即時視覺監控</span>
                </div>
                <p className="text-white font-bold text-lg leading-tight">{currentZone.label}</p>
                <p className={`text-xs font-bold mt-0.5 ${levelColor(currentZone.level)}`}>{currentZone.status}</p>
                {/* Scene badge — animates on each scene change */}
                <AnimatePresence mode="wait">
                  <motion.p
                    key={heroScene}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.35 }}
                    className="text-[9px] font-bold font-mono mt-1"
                    style={{ color: visionAccent }}
                  >
                    ▸ {activeVision.label}
                  </motion.p>
                </AnimatePresence>
              </div>
              <div className="flex flex-col gap-1.5 items-end">
                {aiEvents.slice(0, 2).map(ev => (
                  <div key={ev.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-mono font-bold ${levelBg(ev.level)} ${levelColor(ev.level)}`}>
                    <span className="opacity-60">{ev.time}</span>
                    <span>{ev.zone}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={e => { e.stopPropagation(); navigateTo('dispatch-map'); }}
              className="w-full py-3.5 rounded-2xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-3 shadow-lg shadow-primary/30 active:scale-[0.98] border-b-4 border-primary-container transition-all hover:shadow-primary/50"
            >
              <Zap size={18} />
              <AnimatePresence mode="wait">
                <motion.span
                  key={heroScene}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                >
                  {visionActionLabel}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>

          {/* "tap for detail" hint */}
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/5 px-2.5 py-1.5 rounded-xl border border-white/10 text-white/40 text-[10px] font-bold pointer-events-none">
            點擊查看詳情 <ChevronRight size={11} />
          </div>
        </motion.div>
      </section>

      {/* ④ Smart Broadcast */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 px-1">

        {/* Bell timeline */}
        <div className="bg-surface-container-low rounded-2xl p-5 border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-primary" />
              <h3 className="font-headline text-sm font-bold">今日鐘聲時程</h3>
            </div>
            <button
              onClick={() => { actions.setRemindWarning(!remindWarning); showToast(remindWarning ? '已關閉智慧鐘聲提醒' : '已開啟智慧鐘聲提醒'); }}
              className="flex items-center gap-2"
            >
              <span className="text-[10px] font-bold text-on-surface-variant/60">智慧提醒</span>
              <div className={`w-10 h-5 rounded-full relative border transition-all ${remindWarning ? 'bg-primary border-primary' : 'bg-surface-container-highest border-outline-variant/30'}`}>
                <motion.div
                  layout
                  animate={{ x: remindWarning ? 18 : 1 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                  className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow"
                />
              </div>
            </button>
          </div>

          <div className="flex items-center gap-0.5 overflow-x-auto pb-1 scrollbar-hide">
            {bellSchedule.map((bell, i) => (
              <React.Fragment key={i}>
                <div className={`flex flex-col items-center shrink-0 gap-1 px-2.5 py-2 rounded-xl ${bell.next ? 'bg-primary/15 border border-primary/30' : ''}`}>
                  <div className={`w-2.5 h-2.5 rounded-full border-2 transition-colors ${bell.done ? 'bg-primary border-primary' : bell.next ? 'bg-white border-primary animate-pulse' : 'bg-transparent border-outline-variant/40'}`} />
                  <p className={`text-[9px] font-bold font-mono whitespace-nowrap ${bell.done ? 'text-primary/50' : bell.next ? 'text-primary' : 'text-on-surface-variant/40'}`}>{bell.time}</p>
                  <p className={`text-[9px] font-bold whitespace-nowrap ${bell.done ? 'text-on-surface-variant/40 line-through' : bell.next ? 'text-on-surface font-extrabold' : 'text-on-surface-variant/50'}`}>{bell.label}</p>
                </div>
                {i < bellSchedule.length - 1 && (
                  <div className={`h-px flex-1 min-w-2 shrink-0 ${i < firstUndoneIdx ? 'bg-primary/30' : 'bg-outline-variant/20'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Broadcast control */}
        <div className="bg-surface-container-low rounded-2xl p-5 border border-outline-variant/30 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Radio size={15} className="text-primary" />
            <h3 className="font-headline text-sm font-bold">廣播控制</h3>
          </div>

          <div className="flex flex-wrap gap-2">
            {BROADCAST_ZONES.map(zone => (
              <button
                key={zone}
                onClick={() => toggleBroadcastZone(zone)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 ${broadcastZones.has(zone) ? 'bg-primary/15 border-primary/40 text-primary' : 'bg-surface-container-lowest border-outline-variant/20 text-on-surface-variant hover:border-primary/20'}`}
              >
                {zone}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {broadcastSent ? (
              <motion.div
                key="sent"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 py-4 bg-[#87d46c]/15 border-2 border-[#87d46c]/40 rounded-2xl text-center text-[#87d46c] font-bold text-sm"
              >
                ✓ 廣播已發送
              </motion.div>
            ) : (
              <motion.button
                key="btn"
                onClick={handleEmergencyBroadcast}
                whileTap={{ scale: 0.96 }}
                className={`flex-1 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition-all border-2 ${broadcastPressing ? 'bg-error text-white border-error shadow-lg shadow-error/40' : 'bg-error/10 border-error/30 text-error hover:bg-error/20'}`}
              >
                <Megaphone size={17} className={broadcastPressing ? 'animate-bounce' : ''} />
                {broadcastPressing ? '再按一次確認發送' : '緊急廣播'}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ⑤ Compact Schedule */}
      <section className="px-1">
        <div className="bg-surface-container-low rounded-2xl p-5 border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-headline text-sm font-bold">預約巡邏排程</h3>
            <button onClick={() => navigateTo('dispatch-map')} className="flex items-center gap-1 text-[10px] text-primary font-bold hover:underline">
              查看全部 <ChevronRight size={11} />
            </button>
          </div>
          <div className="space-y-2">
            {state.schedules.slice(0, 2).map(schedule => (
              <motion.div
                key={schedule.id}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => handleOpenSchedule(schedule.id, schedule.time, schedule.area)}
                className="flex items-center gap-3 p-3.5 bg-surface-container-lowest rounded-xl border border-outline-variant/20 hover:border-primary/30 cursor-pointer transition-all"
              >
                <Calendar size={15} className="text-on-surface-variant shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{schedule.title}</p>
                  <p className="text-[10px] text-on-surface-variant font-mono opacity-60 truncate">{schedule.area}</p>
                </div>
                <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg shrink-0">{schedule.time}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Log button */}
      <div className="px-1 flex justify-end">
        <button
          onClick={() => setModal('logs')}
          className="flex items-center gap-1.5 text-[10px] text-on-surface-variant/40 hover:text-primary transition-colors font-mono font-bold"
        >
          <Terminal size={12} />
          系統日誌
        </button>
      </div>

      {/* ===== Modals ===== */}

      {/* Mapcam — upgraded fullscreen */}
      <BottomSheet isOpen={modal === 'mapcam'} onClose={() => setModal(null)} fullScreen>
        <div className="w-full h-full bg-[#050912] relative overflow-hidden">

          {/* Live camera feed (or dark bg fallback) */}
          <div className="absolute inset-0 bg-[#0c121d]" />
          {!cameraError && (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: cameraReady ? 0.65 : 0 }}
            />
          )}
          {/* Camera error fallback message */}
          {cameraError && (
            <div className="absolute top-1/3 inset-x-0 flex justify-center z-20 pointer-events-none">
              <div className="bg-black/60 text-white/50 text-xs font-mono px-4 py-2 rounded-xl border border-white/10">
                📷 {cameraError}
              </div>
            </div>
          )}

          {/* Campus floor plan (fades when camera is live) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style={{ opacity: cameraReady ? 0.08 : 0.25, transition: 'opacity 1s' }}>
            {/* B棟 教學樓 — left */}
            <rect x="4" y="20" width="32" height="34" rx="2" fill="rgba(74,128,219,0.08)" stroke="#4a80db" strokeWidth="0.6"/>
            <text x="20" y="35" fill="#6a9fe8" fontSize="3.5" textAnchor="middle" fontFamily="monospace" fontWeight="bold">B棟</text>
            <text x="20" y="40" fill="#4a80db" fontSize="2.5" textAnchor="middle" fontFamily="monospace">教學樓</text>
            {/* A棟 教學樓 — upper right */}
            <rect x="46" y="8" width="46" height="38" rx="2" fill="rgba(74,128,219,0.08)" stroke="#4a80db" strokeWidth="0.6"/>
            <text x="69" y="24" fill="#6a9fe8" fontSize="3.5" textAnchor="middle" fontFamily="monospace" fontWeight="bold">A棟</text>
            <text x="69" y="29" fill="#4a80db" fontSize="2.5" textAnchor="middle" fontFamily="monospace">教學樓</text>
            {/* A棟 door marker */}
            <rect x="58" y="44" width="8" height="2" rx="0.5" fill="#4a80db" opacity="0.6"/>
            {/* Central corridor connecting */}
            <rect x="26" y="41" width="46" height="11" rx="1.5" fill="rgba(74,128,219,0.12)" stroke="#4a80db" strokeWidth="0.4" strokeDasharray="2,1.5"/>
            <text x="49" y="48" fill="#4a80db" fontSize="2.2" textAnchor="middle" fontFamily="monospace">B-4 中央走廊</text>
            {/* Playground — bottom */}
            <rect x="12" y="57" width="70" height="30" rx="3" fill="rgba(74,128,219,0.05)" stroke="#4a80db" strokeWidth="0.5" strokeDasharray="3,2"/>
            <text x="47" y="73" fill="#4a80db" fontSize="3.5" textAnchor="middle" fontFamily="monospace" fontWeight="bold">操 場</text>
            {/* Playground exit marker */}
            <path d="M50 57 L50 52" stroke="#4a80db" strokeWidth="0.6" strokeDasharray="1.5,1"/>
            {/* Connection lines */}
            <path d="M36 37 L46 37" stroke="#4a80db" strokeWidth="0.4" strokeDasharray="1.5,1"/>
            <path d="M36 41 L36 44 L26 44" stroke="#4a80db" strokeWidth="0.4" strokeDasharray="1.5,1"/>
            <path d="M64 46 L64 52 L50 52" stroke="#4a80db" strokeWidth="0.4" strokeDasharray="1.5,1"/>
          </svg>

          {/* Scan lines */}
          {[0.25, 0.5, 0.75].map((y, i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.05, 0.25, 0.05] }}
              transition={{ duration: 3, delay: i * 1.1, repeat: Infinity }}
              className="absolute inset-x-0 h-px bg-white pointer-events-none z-10"
              style={{ top: `${y * 100}%` }}
            />
          ))}

          {/* Header */}
          <div className="absolute top-10 left-8 right-8 z-30 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${cameraReady ? 'bg-error' : 'bg-amber-400'}`} />
                <span className="text-white font-mono font-bold tracking-[0.3em] text-sm uppercase">AI 視覺監控</span>
                {cameraReady && (
                  <span className="bg-error/80 text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded border border-white/20 tracking-widest">LIVE</span>
                )}
              </div>
              <p className="text-white/30 text-[10px] font-mono mt-1 ml-4 tracking-widest">
                {cameraReady ? (isAnalyzing ? 'Gemini 辨識中…' : ((visionResult as CampusVisionResult & {aiSource?: string})?.aiSource === 'gemini' ? 'Gemini Vision AI · 即時辨識' : '本機像素辨識 · 即時掃描')) : '即時場域偵測 · 多區域掃描'}
              </p>
            </div>
            <button
              onClick={() => setModal(null)}
              className="bg-white/10 hover:bg-white/20 text-white/60 text-xs font-bold px-4 py-2 rounded-xl border border-white/10 transition-all"
            >
              ✕ 關閉
            </button>
          </div>

          {/* Zone dots */}
          <div className="absolute inset-0 z-20">
            {SCAN_ZONES.map((zone, i) => (
              <div key={zone.id} className="absolute" style={{ left: zone.cx, top: zone.cy, transform: 'translate(-50%,-50%)' }}>
                {i === scanZoneIdx && (
                  <div className={`absolute w-5 h-5 rounded-full animate-ping ${zone.level === 'warn' ? 'bg-amber-400/50' : 'bg-[#87d46c]/50'}`} style={{ transform: 'scale(3)', top: '-4px', left: '-4px' }} />
                )}
                <div className={`w-4 h-4 rounded-full border-2 border-white/80 shadow-xl relative z-10 ${zone.level === 'warn' ? 'bg-amber-400' : 'bg-[#87d46c]'}`} />
                <div className={`absolute top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold whitespace-nowrap border transition-all ${i === scanZoneIdx ? 'bg-primary/90 text-white border-white/20 opacity-100' : 'bg-[#0c121d]/80 text-white/30 border-white/10 opacity-70'}`}>
                  {zone.label}
                </div>
              </div>
            ))}
          </div>

          {/* Scan box */}
          <AnimatePresence mode="wait">
            <motion.div
              key={scanZoneIdx}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: [1, 1.05, 1] }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ duration: 0.4, scale: { duration: 3, repeat: Infinity, ease: 'easeInOut' } }}
              className="absolute w-52 h-52 border-2 border-primary/60 z-20 pointer-events-none"
              style={{
                left: SCAN_ZONES[scanZoneIdx].cx,
                top: SCAN_ZONES[scanZoneIdx].cy,
                transform: 'translate(-50%,-50%)',
                boxShadow: '0 0 80px rgba(var(--color-primary),0.15)',
              }}
            >
              <div className="absolute -top-0.5 -left-0.5 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl" />
              <div className="absolute -top-0.5 -right-0.5 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl" />
              <div className="absolute -bottom-0.5 -left-0.5 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl" />
              <div className="absolute -bottom-0.5 -right-0.5 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl" />
              <div className="absolute -top-9 left-0 bg-primary text-white text-[10px] font-mono font-bold px-3 py-1 rounded-full border border-white/20 shadow-lg whitespace-nowrap">
                {isAnalyzing ? '⬤ Gemini 辨識中…' : visionResult ? `${visionResult.label} · ${visionResult.confidence}%` : `${SCAN_ZONES[scanZoneIdx].label} · ${MATCH_PCT[scanZoneIdx]}`}
              </div>
              <motion.div
                animate={{ y: ['-100%', '100%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-x-0 h-0.5 bg-primary/60"
                style={{ filter: 'blur(1px)' }}
              />
            </motion.div>
          </AnimatePresence>

          {/* AI scene image card — camera live: only shows on reliable detection; camera off: demo */}
          {(() => {
            const cardResult = cameraReady ? (visionResult ?? null) : activeVision;
            const cardAccent = cardResult ? SCENE_ACCENTS[cardResult.scene] : undefined;
            const CardIcon = cardResult ? SCENE_ICONS[cardResult.scene] : null;
            return (
              <AnimatePresence mode="wait">
                {cardResult ? (
                  <motion.div
                    key={cardResult.scene}
                    initial={{ opacity: 0, x: -20, scale: 0.93 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -14, scale: 0.96 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className="absolute bottom-44 left-5 z-30 w-36 rounded-xl overflow-hidden border shadow-2xl"
                    style={{ borderColor: cardAccent }}
                  >
                    {CardIcon && (
                      <div className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: `${cardAccent}33` }}>
                        <CardIcon size={11} style={{ color: cardAccent, opacity: 0.7 }} />
                      </div>
                    )}
                    <img src={SCENE_IMAGES[cardResult.scene]} alt={cardResult.label} className="w-full h-22 object-cover" style={{ height: '88px' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    <div className="bg-[#0c121d]/95 px-2.5 py-2">
                      <p className="text-[8px] text-primary font-mono font-black tracking-[0.15em] uppercase mb-0.5">{cameraReady ? ((cardResult as CampusVisionResult & {aiSource?: string})?.aiSource === 'gemini' ? '✦ Gemini Vision' : '本地分析') : 'AI 示範模式'}</p>
                      <p className="text-[11px] font-bold leading-tight" style={{ color: cardAccent }}>{cardResult.label}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="flex-1 h-0.5 bg-white/10 rounded-full overflow-hidden">
                          <motion.div className="h-full rounded-full" style={{ backgroundColor: cardAccent }} initial={{ width: 0 }} animate={{ width: `${cardResult.confidence}%` }} transition={{ duration: 0.5 }} />
                        </div>
                        <span className="text-[8px] font-mono text-white/50 shrink-0">{cardResult.confidence}%</span>
                      </div>
                    </div>
                  </motion.div>
                ) : cameraReady ? (
                  /* Scanning placeholder — camera is live but no confident detection yet */
                  <motion.div
                    key="scanning"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute bottom-44 left-5 z-30 w-36 rounded-xl border border-white/10 bg-[#0c121d]/80 px-3 py-4 flex flex-col items-center gap-2"
                  >
                    <motion.div
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.6, repeat: Infinity }}
                      className="w-8 h-8 rounded-full border-2 border-primary/50 flex items-center justify-center"
                    >
                      <div className="w-2 h-2 rounded-full bg-primary/70" />
                    </motion.div>
                    <p className="text-[9px] text-white/40 font-mono font-bold text-center">Gemini 辨識中</p>
                    <p className="text-[8px] text-white/25 font-mono text-center">對準場景照片</p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            );
          })()}

          {/* Vignette */}
          <div className="absolute inset-0 pointer-events-none z-10" style={{ boxShadow: 'inset 0 0 120px rgba(0,0,0,0.85)' }} />

          {/* Bottom action panel — compact */}
          <div className="absolute bottom-0 inset-x-0 z-30 px-4 pb-6">
            <div className="bg-[#0c121d]/95 backdrop-blur-3xl rounded-3xl border border-white/10 px-4 py-3 shadow-[0_-12px_40px_rgba(0,0,0,0.7)]">

              {/* Status row */}
              <div className="flex items-center justify-between mb-2.5 gap-3">
                <AnimatePresence mode="wait">
                  {visionResult ? (
                    <motion.div key={visionResult.scene} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="min-w-0 flex-1">
                      <p className="text-[9px] text-primary font-mono font-black tracking-[0.25em] uppercase leading-none mb-0.5">
                        {(visionResult as CampusVisionResult & {aiSource?: string}).aiSource === 'gemini' ? '✦ Gemini Vision' : '本地分析'}
                      </p>
                      <p className="text-white text-base font-bold leading-none truncate">{visionResult.zone}</p>
                      <p className={`text-[11px] font-bold mt-0.5 truncate ${visionResult.scene === 'safety' ? 'text-error' : visionResult.scene === 'crowd' ? 'text-amber-400' : 'text-[#87d46c]'}`}>
                        {visionResult.label}
                      </p>
                      {visionResult.summary && (
                        <p className="text-[9px] text-white/40 mt-1 leading-tight line-clamp-2">{visionResult.summary}</p>
                      )}
                    </motion.div>
                  ) : cameraReady ? (
                    <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-w-0">
                      <p className="text-[9px] text-primary font-mono font-black tracking-[0.25em] uppercase leading-none mb-0.5">Gemini Vision AI</p>
                      <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.4, repeat: Infinity }} className="text-white/60 text-sm font-bold leading-none">
                        辨識中…
                      </motion.p>
                    </motion.div>
                  ) : (
                    <motion.div key="demo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-w-0">
                      <p className="text-[9px] text-primary/60 font-mono font-black tracking-[0.25em] uppercase leading-none mb-0.5">AI 示範模式</p>
                      <p className="text-white text-base font-bold leading-none truncate">{activeVision.zone}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 2 compact events */}
                <div className="flex flex-col gap-1 items-end shrink-0">
                  {aiEvents.slice(0, 2).map(ev => (
                    <div key={ev.id} className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[8px] font-mono font-bold ${levelBg(ev.level)} ${levelColor(ev.level)}`}>
                      <span className="opacity-50">{ev.time}</span>
                      <span className="max-w-[60px] truncate">{ev.zone}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setModal(null)}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 font-bold rounded-2xl border border-white/10 transition-all text-xs tracking-widest uppercase active:scale-95 shrink-0"
                >
                  關閉
                </button>
                <button
                  onClick={() => { setModal(null); navigateTo('dispatch-map'); }}
                  disabled={false}
                  className="flex-1 py-2.5 bg-primary text-white font-bold rounded-2xl active:scale-95 transition-all text-sm flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(var(--color-primary),0.35)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Zap size={15} />
                  <AnimatePresence mode="wait">
                    <motion.span key={visionActionLabel} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
                      {visionActionLabel}
                    </motion.span>
                  </AnimatePresence>
                </button>
              </div>

            </div>
          </div>
        </div>
      </BottomSheet>

      {/* Logs modal */}
      <BottomSheet isOpen={modal === 'logs'} onClose={() => setModal(null)} title="系統紀錄">
        <div className="p-6 bg-[#0c121d] rounded-[2.5rem] mx-4 mb-10 mt-2 font-mono text-[11px] text-[#a9b1d6] leading-relaxed h-[50vh] overflow-y-auto custom-scrollbar shadow-2xl border-4 border-surface-container-low">
          <div className="flex items-center justify-between mb-6 sticky top-0 bg-[#0c121d]/90 backdrop-blur-xl pb-3 z-10 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
                <Terminal size={16} />
              </div>
              <span className="text-white font-extrabold tracking-widest text-[10px]">派遣與硬體紀錄</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-[#87d46c]/10 rounded-full border border-[#87d46c]/20">
              <div className="w-1.5 h-1.5 bg-[#87d46c] rounded-full animate-pulse" />
              <span className="text-[9px] text-[#87d46c] font-extrabold tracking-[0.2em]">即時更新</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-[10px] text-primary/40 font-bold mb-4 italic px-2">本次展示紀錄</div>
            {state.logs.map(log => (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                key={log.id}
                className={`flex gap-3 p-2 rounded-lg hover:bg-white/5 ${log.type === 'warn' ? 'text-tertiary' : log.type === 'error' ? 'text-error' : 'text-[#a9b1d6]'}`}
              >
                <span className="opacity-30 font-bold shrink-0">{log.time}</span>
                <span className="flex-1">{log.message}</span>
              </motion.div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </BottomSheet>

      {/* Schedule edit modal */}
      <BottomSheet isOpen={modal === 'schedule'} onClose={() => setModal(null)} title="編輯預約任務">
        <div className="p-4 space-y-8 pb-8">
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">任務時間</label>
            <input
              type="time"
              value={editTime}
              onChange={e => setEditTime(e.target.value)}
              className="w-full bg-surface-container-lowest shadow-sm border border-outline-variant/20 rounded-2xl px-5 py-4 text-xl font-headline font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">覆蓋區域設定</label>
            <div className="relative">
              <select
                value={editArea}
                onChange={e => setEditArea(e.target.value)}
                className="w-full bg-surface-container-lowest shadow-sm border border-outline-variant/20 rounded-2xl px-5 py-4 text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
              >
                <option value="所有走廊與公共區">所有走廊與公共區</option>
                <option value="僅 A 棟教學樓">僅 A 棟教學樓</option>
                <option value="B 棟活動中心與操場">B 棟活動中心與操場</option>
              </select>
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">▼</div>
            </div>
          </div>
          <button
            onClick={handleSaveSchedule}
            className="w-full bg-primary hover:bg-primary/95 text-white font-bold py-4 rounded-2xl active:scale-95 shadow-lg shadow-primary/20 transition-all text-lg"
          >
            儲存變更
          </button>
        </div>
      </BottomSheet>

    </div>
  );
}
