import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {motion, AnimatePresence} from 'motion/react';
import {AlertOctagon, BellOff, Bell, Camera, Eye, EyeOff, Gauge, Loader2, Power, ShieldAlert, Square, Volume2} from 'lucide-react';
import {useCameraSelection} from '../hooks/useCameraSelection';
import {useVisionProximity, type ProximityDetection, type ProximityRisk} from '../hooks/useVisionProximity';
import {CameraPicker} from '../components/CameraPicker';
import {sendHardwareCommand} from '../services/hardwareBridge';

const LABEL_ZH: Record<string, string> = {
  person: '人',
  bicycle: '腳踏車',
  car: '汽車',
  motorcycle: '機車',
  bus: '公車',
  truck: '卡車',
  chair: '椅子',
  couch: '沙發',
  bed: '床',
  'dining table': '桌子',
  bottle: '瓶子',
  cup: '杯子',
  book: '書',
  laptop: '筆電',
  'cell phone': '手機',
  backpack: '背包',
  handbag: '手提包',
  suitcase: '行李',
  ball: '球',
  'sports ball': '球',
  dog: '狗',
  cat: '貓',
  pottedplant: '盆栽',
  'potted plant': '盆栽',
  refrigerator: '冰箱',
  tv: '電視',
  keyboard: '鍵盤',
  mouse: '滑鼠',
};

const RISK_COLOR: Record<ProximityRisk, {stroke: string; fill: string; text: string; label: string}> = {
  safe:   {stroke: '#10b981', fill: 'rgba(16,185,129,0.12)',  text: '#047857', label: '安全'},
  warn:   {stroke: '#f59e0b', fill: 'rgba(245,158,11,0.18)',  text: '#b45309', label: '警示'},
  danger: {stroke: '#ef4444', fill: 'rgba(239,68,68,0.22)',   text: '#b91c1c', label: '煞車'},
};

function zhLabel(s: string): string {
  return LABEL_ZH[s] ?? s;
}

function useBeeper(enabled: boolean, risk: ProximityRisk) {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled || risk === 'safe') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    const beep = () => {
      try {
        if (!ctxRef.current) {
          const Ctx = window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
          if (!Ctx) return;
          ctxRef.current = new Ctx();
        }
        const ctx = ctxRef.current;
        if (ctx.state === 'suspended') void ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const freq = risk === 'danger' ? 1100 : 720;
        osc.type = 'square';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } catch {
        // AudioContext blocked — silent fallback
      }
    };
    beep();
    timerRef.current = setInterval(beep, risk === 'danger' ? 380 : 720);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, risk]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (ctxRef.current) void ctxRef.current.close().catch(() => {});
  }, []);
}

function ProximityBar({value}: {value: number}) {
  const pct = Math.round(value * 100);
  const color = value >= 0.35 ? 'bg-rose-500' : value >= 0.18 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
      <motion.div
        className={`h-full ${color}`}
        initial={{width: 0}}
        animate={{width: `${pct}%`}}
        transition={{type: 'spring', stiffness: 240, damping: 28}}
      />
    </div>
  );
}

interface OverlayProps {
  detections: ProximityDetection[];
  containerWidth: number;
  containerHeight: number;
  sourceWidth: number;
  sourceHeight: number;
}

function DetectionOverlay({detections, containerWidth, containerHeight, sourceWidth, sourceHeight}: OverlayProps) {
  if (!sourceWidth || !sourceHeight || !containerWidth || !containerHeight) return null;
  // object-cover: scale so shorter side fills, longer side gets cropped.
  const scale = Math.max(containerWidth / sourceWidth, containerHeight / sourceHeight);
  const displayedW = sourceWidth * scale;
  const displayedH = sourceHeight * scale;
  const offsetX = (containerWidth - displayedW) / 2;
  const offsetY = (containerHeight - displayedH) / 2;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {detections.slice(0, 6).map((d, i) => {
        const [x, y, w, h] = d.bbox;
        const left = offsetX + x * scale;
        const top = offsetY + y * scale;
        const width = w * scale;
        const height = h * scale;
        const color = RISK_COLOR[d.risk];
        return (
          <motion.div
            key={`${d.label}-${i}-${Math.round(x)}-${Math.round(y)}`}
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            transition={{duration: 0.18}}
            className="absolute rounded-md border-2"
            style={{
              left, top, width, height,
              borderColor: color.stroke,
              background: color.fill,
              boxShadow: d.risk === 'danger' ? `0 0 22px ${color.stroke}` : 'none',
            }}
          >
            <span
              className="absolute -top-6 left-0 rounded px-1.5 py-0.5 text-[10px] font-black tracking-wide text-white shadow"
              style={{background: color.stroke}}
            >
              {zhLabel(d.label)} · {Math.round(d.proximity * 100)}%
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

export function VisionProximityView() {
  const [active, setActive] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [autoStopOn, setAutoStopOn] = useState(true);
  const [lastStopTs, setLastStopTs] = useState<number | null>(null);
  const [stopMessage, setStopMessage] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({width: 0, height: 0});
  const containerRef = useRef<HTMLDivElement>(null);
  const lastStopFireRef = useRef(0);

  const camera = useCameraSelection(active);
  const proximity = useVisionProximity(active && camera.ready, camera.videoRef);
  useBeeper(active && soundOn, proximity.risk);

  // Track container dimensions for bbox overlay mapping.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({width: entry.contentRect.width, height: entry.contentRect.height});
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [active]);

  // Auto-brake: when risk goes danger, throttle-send STOP to bridge (max 1/2s).
  useEffect(() => {
    if (!active || !autoStopOn) return;
    if (proximity.risk !== 'danger') return;
    const now = Date.now();
    if (now - lastStopFireRef.current < 2000) return;
    lastStopFireRef.current = now;
    setLastStopTs(now);
    void sendHardwareCommand('STOP', 'app2:vision-proximity').then((result) => {
      setStopMessage(result.ok ? `已送出 STOP（${result.message}）` : `STOP 失敗：${result.message}`);
    }).catch((err) => {
      setStopMessage(`STOP 失敗：${err instanceof Error ? err.message : '未知錯誤'}`);
    });
  }, [active, autoStopOn, proximity.risk]);

  const videoEl = camera.videoRef.current;
  const sourceWidth = videoEl?.videoWidth ?? 0;
  const sourceHeight = videoEl?.videoHeight ?? 0;

  const headerRisk = useMemo(() => RISK_COLOR[proximity.risk], [proximity.risk]);
  const stopRelative = useMemo(() => {
    if (!lastStopTs) return null;
    const seconds = Math.max(0, Math.floor((Date.now() - lastStopTs) / 1000));
    return `${seconds} 秒前`;
  }, [lastStopTs, proximity.detections]);

  const sendManualStop = useCallback(async () => {
    setLastStopTs(Date.now());
    const result = await sendHardwareCommand('STOP', 'app2:vision-manual');
    setStopMessage(result.ok ? `手動 STOP 已送出（${result.message}）` : `手動 STOP 失敗：${result.message}`);
  }, []);

  return (
    <div className="space-y-5 pb-6">
      <section className="flex items-center justify-between rounded-3xl border border-primary/15 bg-white p-4 shadow-sm">
        <div>
          <p className="text-[10px] font-black tracking-[0.22em] text-primary uppercase">機器人視角</p>
          <h2 className="mt-1 text-lg font-black text-on-surface">即時影像距離判讀（COCO-SSD）</h2>
          <p className="mt-0.5 text-xs font-bold leading-5 text-on-surface-variant">
            iPad 鏡頭 → TensorFlow.js 本機跑 80 類物體偵測 → 框面積換算「相對距離」→ 觸發警示音 + 自動 STOP。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActive((v) => !v)}
          className={`shrink-0 min-h-12 rounded-2xl px-5 text-sm font-black shadow-lg transition active:scale-[0.98] ${
            active
              ? 'bg-rose-500 text-white shadow-rose-500/30'
              : 'bg-primary text-white shadow-primary/20'
          }`}
        >
          <Power size={16} className="mr-1.5 inline -translate-y-px" />
          {active ? '停止偵測' : '啟動偵測'}
        </button>
      </section>

      <section
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-3xl bg-black shadow-xl"
        style={{aspectRatio: '4/3'}}
      >
        <video
          ref={camera.videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            camera.ready ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <canvas ref={camera.canvasRef} className="hidden" />

        {!active && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center"
            style={{background: 'linear-gradient(160deg, #0d2137 0%, #1e3a5f 60%, #0a1a2e 100%)'}}
          >
            <Eye size={40} className="text-white/70" />
            <p className="text-white text-base font-black">機器人視角待命</p>
            <p className="text-white/60 text-xs max-w-xs leading-relaxed">
              按右上「啟動偵測」開啟 iPad 後鏡頭。物體靠近時，框會變紅、嗶嗶聲響起，並送 STOP 給 Arduino。
            </p>
          </div>
        )}

        {active && !camera.ready && !camera.error && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            style={{background: 'linear-gradient(160deg, #0d2137 0%, #1e3a5f 60%, #0a1a2e 100%)'}}
          >
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
            <p className="text-white/70 text-sm font-mono">攝影機啟動中…</p>
          </div>
        )}

        {active && camera.error && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
            style={{background: 'linear-gradient(160deg, #3a1414 0%, #1a0a0a 100%)'}}
          >
            <Camera size={36} className="text-red-300" />
            <p className="text-red-100 text-sm font-bold leading-relaxed max-w-sm">{camera.error}</p>
          </div>
        )}

        {active && camera.ready && proximity.modelStatus === 'loading' && (
          <div className="absolute inset-x-4 top-4 z-10 rounded-2xl border border-white/10 bg-black/60 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-3">
              <Loader2 size={18} className="animate-spin text-white" />
              <div className="flex-1">
                <p className="text-[11px] font-bold text-white">COCO-SSD 模型載入中…</p>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full bg-primary"
                    initial={{width: 0}}
                    animate={{width: `${Math.round(proximity.modelProgress * 100)}%`}}
                    transition={{duration: 0.3}}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {active && camera.ready && proximity.modelStatus === 'error' && (
          <div className="absolute inset-x-4 top-4 z-10 rounded-2xl border border-rose-300/30 bg-rose-500/20 px-4 py-3 backdrop-blur">
            <p className="text-[11px] font-bold text-white">模型載入失敗：{proximity.modelError ?? '未知錯誤'}</p>
          </div>
        )}

        {active && camera.ready && proximity.modelStatus === 'ready' && (
          <DetectionOverlay
            detections={proximity.detections}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
            sourceWidth={sourceWidth}
            sourceHeight={sourceHeight}
          />
        )}

        {camera.devices.length > 1 && active && (
          <div className="absolute top-3 right-3 z-20">
            <CameraPicker
              devices={camera.devices}
              selectedDeviceId={camera.selectedDeviceId}
              onSelect={camera.selectDevice}
              variant="inline"
            />
          </div>
        )}

        <AnimatePresence>
          {proximity.risk === 'danger' && active && (
            <motion.div
              initial={{opacity: 0, y: -10}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: -10}}
              className="absolute inset-x-3 top-3 z-10 flex items-center gap-2 rounded-2xl border border-rose-400/40 bg-rose-500/90 px-4 py-2 text-white shadow-xl backdrop-blur"
            >
              <ShieldAlert size={18} className="shrink-0" />
              <p className="text-xs font-black tracking-wide">
                {autoStopOn ? '⚠️ 障礙物接近 — 已自動送 STOP 給 Arduino' : '⚠️ 障礙物接近（手動煞車模式）'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <section className="rounded-3xl border border-outline-variant/20 bg-surface-container-lowest p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-outline-variant/15 bg-white px-3 py-2.5">
            <p className="text-[10px] font-extrabold tracking-widest text-on-surface-variant uppercase">最近物體</p>
            <p className="mt-1 truncate text-base font-black text-on-surface">{proximity.topLabel ? zhLabel(proximity.topLabel) : '—'}</p>
          </div>
          <div className="rounded-2xl border border-outline-variant/15 bg-white px-3 py-2.5">
            <p className="text-[10px] font-extrabold tracking-widest text-on-surface-variant uppercase">距離指數</p>
            <p className="mt-1 text-base font-black" style={{color: headerRisk.text}}>
              {Math.round(proximity.maxProximity * 100)}% · {headerRisk.label}
            </p>
          </div>
          <div className="rounded-2xl border border-outline-variant/15 bg-white px-3 py-2.5">
            <p className="text-[10px] font-extrabold tracking-widest text-on-surface-variant uppercase">辨識 FPS</p>
            <p className="mt-1 text-base font-black text-on-surface">
              {proximity.modelStatus === 'ready' ? `${proximity.fps.toFixed(1)}` : '—'}
            </p>
          </div>
          <div className="rounded-2xl border border-outline-variant/15 bg-white px-3 py-2.5">
            <p className="text-[10px] font-extrabold tracking-widest text-on-surface-variant uppercase">已偵測</p>
            <p className="mt-1 truncate text-base font-black text-on-surface">{proximity.detections.length} 個</p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-on-surface-variant">距離條（框面積 / 畫面比例）</p>
            <p className="text-[10px] font-mono text-on-surface-variant/60">
              閾值 warn 18% · danger 35%
            </p>
          </div>
          <ProximityBar value={proximity.maxProximity} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundOn((v) => !v)}
            className={`flex min-h-10 items-center gap-1.5 rounded-2xl border px-3 text-xs font-black active:scale-[0.98] ${
              soundOn
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-outline-variant/30 bg-surface-container-low text-on-surface-variant'
            }`}
          >
            {soundOn ? <Volume2 size={14} /> : <BellOff size={14} />}
            {soundOn ? '警示音 ON' : '靜音'}
          </button>
          <button
            type="button"
            onClick={() => setAutoStopOn((v) => !v)}
            className={`flex min-h-10 items-center gap-1.5 rounded-2xl border px-3 text-xs font-black active:scale-[0.98] ${
              autoStopOn
                ? 'border-rose-300 bg-rose-500/10 text-rose-600'
                : 'border-outline-variant/30 bg-surface-container-low text-on-surface-variant'
            }`}
          >
            {autoStopOn ? <AlertOctagon size={14} /> : <EyeOff size={14} />}
            {autoStopOn ? '自動煞車 ON' : '自動煞車 OFF'}
          </button>
          <button
            type="button"
            onClick={() => void sendManualStop()}
            disabled={!active}
            className="flex min-h-10 items-center gap-1.5 rounded-2xl bg-rose-500 px-3 text-xs font-black text-white shadow-lg shadow-rose-500/30 active:scale-[0.98] disabled:opacity-40"
          >
            <Square size={14} />
            手動送 STOP 測試
          </button>
          {stopMessage && (
            <span className="ml-auto truncate rounded-full bg-surface-container-high px-3 py-1.5 text-[10px] font-mono text-on-surface-variant">
              {stopRelative ? `${stopRelative} · ${stopMessage}` : stopMessage}
            </span>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-primary/15 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-on-surface flex items-center gap-2">
            <Gauge size={16} className="text-primary" /> 偵測清單（前 6 名）
          </h3>
          <span className="text-[10px] font-mono text-on-surface-variant">依框面積排序</span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {proximity.detections.slice(0, 6).map((d, i) => {
            const color = RISK_COLOR[d.risk];
            return (
              <div
                key={`row-${d.label}-${i}-${Math.round(d.bbox[0])}`}
                className="flex items-center gap-3 rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-2.5"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black"
                  style={{background: color.fill, color: color.text}}
                >
                  {Math.round(d.proximity * 100)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-on-surface">
                    {zhLabel(d.label)} <span className="text-xs font-bold text-on-surface-variant/60">({d.label})</span>
                  </p>
                  <p className="text-[10px] text-on-surface-variant/70 font-mono">
                    信心 {(d.score * 100).toFixed(0)}% · {color.label}
                  </p>
                </div>
                <Bell
                  size={14}
                  className={
                    d.risk === 'danger' ? 'text-rose-500 animate-pulse' : d.risk === 'warn' ? 'text-amber-500' : 'text-emerald-500/50'
                  }
                />
              </div>
            );
          })}
          {proximity.detections.length === 0 && active && (
            <p className="col-span-full rounded-xl border border-dashed border-outline-variant/30 px-3 py-4 text-center text-xs font-bold text-on-surface-variant/60">
              {proximity.modelStatus === 'ready' ? '畫面中沒有偵測到物體' : '等待模型就緒…'}
            </p>
          )}
          {!active && (
            <p className="col-span-full rounded-xl border border-dashed border-outline-variant/30 px-3 py-4 text-center text-xs font-bold text-on-surface-variant/60">
              偵測未啟動
            </p>
          )}
        </div>
      </section>

      <p className="px-2 text-[11px] leading-relaxed font-medium text-on-surface-variant/70">
        架構分工：Gemini Vision 負責「場景理解」（教學/配送/生活分類），COCO-SSD 負責「即時測距」（safety-critical，本機 ms 級反應，不耗網路）。
        firmware 端 3 秒看門狗為第二層保險：視覺判讀失靈時，Arduino 自己也會煞車。
      </p>
    </div>
  );
}
