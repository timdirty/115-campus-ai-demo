import React from 'react';
import {Camera, Users, ShieldAlert, Sparkles, Package, Eye, CheckCircle2, RotateCcw} from 'lucide-react';
import {useCameraSelection} from '../../hooks/useCameraSelection';
import {useGeminiVision} from '../../hooks/useGeminiVision';
import {CameraPicker} from '../CameraPicker';
import {analyzeCampusImageClosedLoop, createScriptedVisionResult, type VisionDemoScript} from '../../services/localVision';
import {BRIDGE_URL} from '../../services/hardwareBridge';
import type {CampusVisionResult, VisionScene} from '../../services/localVision';

const SCENE_ACCENTS: Record<VisionScene, string> = {
  crowd: '#f59e0b',
  safety: '#ef4444',
  cleaning: '#14b8a6',
  delivery: '#22c55e',
  patrol: '#3b82f6',
  other: '#64748b',
};
const SCENE_ICONS: Record<VisionScene, React.ElementType> = {
  crowd: Users,
  safety: ShieldAlert,
  cleaning: Sparkles,
  delivery: Package,
  patrol: Eye,
  other: Camera,
};
const SCENE_ACTION_LABELS: Record<VisionScene, string> = {
  crowd: '立即廣播疏導',
  safety: '緊急安全巡查',
  cleaning: '派遣清掃任務',
  delivery: '配送服務派遣',
  patrol: '開始巡邏任務',
  other: '重新對準校園場景',
};
const SOURCE_LABELS: Record<NonNullable<CampusVisionResult['aiSource']>, string> = {
  gemini: '智慧辨識',
  pixel: '備援辨識',
  scripted: '安全展示',
};
const QUALITY_TONES = {
  good: 'bg-emerald-400/20 text-emerald-100',
  warn: 'bg-amber-400/20 text-amber-100',
  poor: 'bg-red-400/20 text-red-100',
};

interface VisionCameraCardProps {
  isOpen: boolean;
  showToast: (msg: string) => void;
  onDispatch: (result: CampusVisionResult) => void;
  studentMode?: boolean;
  script?: VisionDemoScript;
  scriptIndex?: number;
  scriptTotal?: number;
  onNextScript?: () => void;
}

type DemoStep = 'idle' | 'capturing' | 'recognizing' | 'result' | 'dispatched';
type VisionDebugRecord = {
  at: string;
  script?: string;
  llmOk: boolean;
  model?: string;
  backupUsed: boolean;
  result?: CampusVisionResult;
  error?: string;
};

const debugTarget = globalThis as typeof globalThis & {__APP2_LAST_VISION_DEBUG?: VisionDebugRecord};

function writeVisionDebug(record: VisionDebugRecord) {
  debugTarget.__APP2_LAST_VISION_DEBUG = record;
  console.info('[App2 vision debug]', record);
}

export function VisionCameraCard({
  isOpen,
  showToast,
  onDispatch,
  studentMode = false,
  script,
  scriptIndex = 0,
  scriptTotal = 1,
  onNextScript,
}: VisionCameraCardProps) {
  const cam = useCameraSelection(isOpen);
  const {videoRef, canvasRef, ready, error} = cam;
  const liveVision = useGeminiVision(!studentMode && isOpen && ready, videoRef, canvasRef, 4000);
  const [demoStep, setDemoStep] = React.useState<DemoStep>('idle');
  const [scriptResult, setScriptResult] = React.useState<CampusVisionResult | null>(null);
  const [visionStatus, setVisionStatus] = React.useState<{state: 'checking' | 'ready' | 'local'; model: string}>({
    state: 'checking',
    model: '智慧辨識',
  });

  const result = studentMode ? scriptResult : liveVision.result;
  const analyzing = studentMode ? demoStep === 'capturing' || demoStep === 'recognizing' : liveVision.analyzing;
  const visibleError = studentMode ? null : liveVision.error;
  const scene: VisionScene = result?.scene ?? script?.scene ?? 'patrol';
  const SceneIcon = SCENE_ICONS[scene];
  const accent = SCENE_ACCENTS[scene];
  const canDispatch = Boolean(result?.dispatchRecommended && result.isReliable && (!studentMode || demoStep === 'result'));

  const captureJpeg = React.useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || !video.videoWidth) return null;
    const scale = Math.min(1, 420 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.72);
  }, [canvasRef, videoRef]);

  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setVisionStatus(prev => ({...prev, state: 'checking'}));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    fetch(`${BRIDGE_URL}/api/ai/status`, {signal: controller.signal})
      .then(async response => {
        const data = await response.json().catch(() => ({})) as {ok?: boolean; model?: string};
        if (cancelled) return;
        setVisionStatus({
          state: response.ok && data.ok ? 'ready' : 'local',
          model: data.model ?? '智慧辨識',
        });
      })
      .catch(() => {
        if (!cancelled) setVisionStatus(prev => ({...prev, state: 'local'}));
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [isOpen]);

  React.useEffect(() => {
    if (!studentMode || !isOpen || !script) {
      setDemoStep('idle');
      setScriptResult(null);
      return;
    }

    let cancelled = false;
    async function runScriptRecognition() {
      setScriptResult(null);
      setDemoStep('capturing');
      await new Promise(resolve => setTimeout(resolve, 650));
      if (cancelled) return;

      let frame = captureJpeg();
      const waitStart = Date.now();
      while (!frame && !error && Date.now() - waitStart < 4000) {
        await new Promise(resolve => setTimeout(resolve, 200));
        if (cancelled) return;
        frame = captureJpeg();
      }
      setDemoStep('recognizing');
      await new Promise(resolve => setTimeout(resolve, 450));
      if (cancelled) return;

      try {
        if (!frame) throw new Error(error ? 'camera-unavailable' : 'camera-not-ready');
        const closedLoopResult = await analyzeCampusImageClosedLoop(frame);
        if (cancelled) return;
        const teacherDebug = {
          llmOk: closedLoopResult.aiSource === 'gemini',
          model: closedLoopResult.aiModel,
          backupUsed: closedLoopResult.aiSource !== 'gemini',
          rawScene: closedLoopResult.scene,
          error: closedLoopResult.backupReason,
        };
        const displayResult: CampusVisionResult = {
          ...createScriptedVisionResult(script, 'llm-confirmed', teacherDebug),
          confidence: closedLoopResult.confidence,
          aiModel: closedLoopResult.aiModel,
          aiSource: closedLoopResult.aiSource,
          backupReason: closedLoopResult.backupReason,
          quality: closedLoopResult.quality,
          metrics: closedLoopResult.metrics,
          evidence: closedLoopResult.aiSource === 'gemini'
            ? ['AI 模型確認', script.title]
            : ['展示安全備援', script.title, ...(closedLoopResult.quality?.hints ?? [])],
        };
        setScriptResult(displayResult);
        setDemoStep('result');
        writeVisionDebug({
          at: new Date().toISOString(),
          script: script.title,
          llmOk: closedLoopResult.aiSource === 'gemini',
          model: closedLoopResult.aiModel,
          backupUsed: closedLoopResult.aiSource !== 'gemini',
          result: displayResult,
        });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'vision-failed';
        const fallback = createScriptedVisionResult(script, message, {
          llmOk: false,
          backupUsed: true,
          rawScene: script.scene,
          error: message,
        });
        setScriptResult(fallback);
        setDemoStep('result');
        writeVisionDebug({
          at: new Date().toISOString(),
          script: script.title,
          llmOk: false,
          backupUsed: true,
          result: fallback,
          error: message,
        });
      }
    }

    void runScriptRecognition();
    return () => {
      cancelled = true;
    };
  }, [captureJpeg, error, isOpen, script, studentMode]);

  const handleDispatch = () => {
    if (!result) return;
    if (!canDispatch) {
      showToast(studentMode ? '請等辨識完成' : '請先對準校園任務場景');
      return;
    }
    // 只透過 props 傳給父層，不直接呼叫 sendHardwareCommand（避免雙送）
    onDispatch(result);
    setDemoStep('dispatched');
    showToast(studentMode ? '任務已送出' : `已派遣：${result.label} — ${result.zone}`);
  };

  const sourceLabel = result?.aiSource ? SOURCE_LABELS[result.aiSource] : (visionStatus.state === 'ready' ? '智慧待命' : '展示待命');
  const qualityLevel = result?.quality?.level;
  const qualityLabel = result?.quality?.label ?? (ready ? '畫面可用' : '相機啟動中');
  const confidenceLabel = result ? `${result.confidence}%` : '--';

  return (
    <div className="w-full h-full bg-black relative overflow-hidden">
      <canvas ref={canvasRef} className="hidden" />
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`}
      />
      {!ready && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-4"
          style={{background: 'linear-gradient(160deg, #0d2137 0%, #1e3a5f 60%, #0a1a2e 100%)'}}
        >
          {error ? (
            <>
              <Camera size={48} className="text-red-400" />
              <p className="text-red-300 text-sm font-bold text-center px-6">
                {studentMode ? '相機沒有開啟，展示會自動完成。' : error}
              </p>
            </>
          ) : (
            <>
              <Camera size={48} className="text-white/40 animate-pulse" />
              <p className="text-white/50 text-sm font-mono">開啟攝影機中…</p>
            </>
          )}
        </div>
      )}
      {/* Camera picker — bottom-right corner, doesn't conflict with status bar */}
      {!studentMode && cam.devices.length > 1 && (
        <div className="absolute bottom-24 right-4 z-30">
          <CameraPicker
            devices={cam.devices}
            selectedDeviceId={cam.selectedDeviceId}
            onSelect={cam.selectDevice}
            variant="inline"
          />
        </div>
      )}
      <div className="absolute top-4 left-4 right-4 z-20">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-white shadow-lg backdrop-blur-md">
          <div className="min-w-0">
            <p className="text-[10px] font-black tracking-[0.2em] text-white/50">
              {studentMode ? `展示 ${scriptIndex + 1}/${scriptTotal}` : '影像任務'}
            </p>
            <p className="truncate text-sm font-black">
              {studentMode
                ? script?.title ?? '校園情境'
                : visibleError
                ? '需要重新對準'
                : visionStatus.state === 'ready'
                ? '對準校園畫面'
                : visionStatus.state === 'checking'
                  ? '準備相機'
                  : '展示模式'}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black tracking-widest ${
            visionStatus.state === 'ready'
              ? 'bg-emerald-400/20 text-emerald-100'
              : visionStatus.state === 'checking'
                ? 'bg-white/10 text-white/70'
                : 'bg-sky-400/20 text-sky-100'
          }`}>
            {studentMode
              ? demoStep === 'dispatched'
                ? '完成'
                : demoStep === 'result'
                  ? '可派遣'
                  : '辨識中'
              : visibleError
                ? '重試'
                : visionStatus.state === 'checking'
                  ? '準備中'
                  : '展示中'}
          </span>
        </div>
      </div>
      <div className="absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black/90 via-black/45 to-transparent px-5 pb-6 pt-24">
        <div className="rounded-3xl border border-white/10 bg-black/45 p-4 text-white shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{background: accent}}>
              <SceneIcon size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xl font-black">
                {studentMode && demoStep === 'dispatched'
                  ? '任務已送出'
                  : visibleError
                    ? '無法辨識'
                    : analyzing
                      ? demoStep === 'capturing'
                        ? '拍攝校園畫面…'
                        : '正在辨識…'
                      : result?.label ?? '等待畫面'}
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-bold text-white/70">
                {studentMode && demoStep === 'dispatched'
                  ? '可以按下一個展示，換下一種校園任務。'
                  : visibleError
                  ? '請重新對準校園任務畫面。'
                  : analyzing
                  ? '請保持鏡頭穩定'
                  : (studentMode ? result?.studentLine : result?.summary) ?? (ready ? '請對準走廊、人潮、地面或配送物品。' : '相機啟動中')}
              </p>
            </div>
          </div>

          {studentMode && demoStep === 'dispatched' ? (
            <button
              type="button"
              onClick={onNextScript}
              className="mt-4 w-full rounded-2xl bg-white px-4 py-4 text-base font-black text-black transition-all active:scale-[0.98]"
            >
              <RotateCcw size={18} className="inline mr-2" />
              下一個展示
            </button>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-white/10 px-2 py-2">
                  <p className="text-[9px] font-black tracking-widest text-white/45">信心</p>
                  <p className="mt-0.5 text-sm font-black">{confidenceLabel}</p>
                </div>
                <div className="rounded-2xl bg-white/10 px-2 py-2">
                  <p className="text-[9px] font-black tracking-widest text-white/45">來源</p>
                  <p className="mt-0.5 truncate text-sm font-black">{sourceLabel}</p>
                </div>
                <div className={`rounded-2xl px-2 py-2 ${qualityLevel ? QUALITY_TONES[qualityLevel] : 'bg-white/10'}`}>
                  <p className="text-[9px] font-black tracking-widest text-white/45">畫面</p>
                  <p className="mt-0.5 truncate text-sm font-black">{qualityLabel}</p>
                </div>
              </div>
              {result?.quality?.hints?.[0] && (
                <p className="mt-3 rounded-2xl bg-white/10 px-3 py-2 text-center text-xs font-black text-white/75">
                  {result.quality.hints[0]}
                </p>
              )}
            <button
              onClick={handleDispatch}
              disabled={!result || !canDispatch}
              className="mt-4 w-full rounded-2xl px-4 py-4 text-base font-black text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/55"
              style={!result || !canDispatch ? undefined : {background: accent}}
            >
              {studentMode ? <CheckCircle2 size={18} className="inline mr-2" /> : <SceneIcon size={18} className="inline mr-2" />}
              {studentMode ? script?.actionLabel ?? '派遣任務' : result ? SCENE_ACTION_LABELS[scene] : '對準後自動辨識'}
            </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
