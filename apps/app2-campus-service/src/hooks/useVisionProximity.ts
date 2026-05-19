import {useEffect, useRef, useState} from 'react';

export type ProximityRisk = 'safe' | 'warn' | 'danger';

export interface ProximityDetection {
  label: string;
  score: number;
  bbox: [number, number, number, number];
  proximity: number;
  risk: ProximityRisk;
}

export interface VisionProximityResult {
  modelStatus: 'idle' | 'loading' | 'ready' | 'error';
  modelError: string | null;
  modelProgress: number;
  detections: ProximityDetection[];
  maxProximity: number;
  risk: ProximityRisk;
  topLabel: string | null;
  fps: number;
}

interface Options {
  warnThreshold?: number;
  dangerThreshold?: number;
  intervalMs?: number;
  scoreThreshold?: number;
}

type CocoSsdModule = typeof import('@tensorflow-models/coco-ssd');
type LoadedModel = Awaited<ReturnType<CocoSsdModule['load']>>;

let modelLoadPromise: Promise<LoadedModel> | null = null;

async function loadModel(
  setProgress: (value: number) => void,
): Promise<LoadedModel> {
  if (!modelLoadPromise) {
    modelLoadPromise = (async () => {
      setProgress(0.1);
      await import('@tensorflow/tfjs');
      setProgress(0.5);
      const cocoSsd = (await import('@tensorflow-models/coco-ssd')) as CocoSsdModule;
      setProgress(0.7);
      const model = await cocoSsd.load({base: 'lite_mobilenet_v2'});
      setProgress(1);
      return model;
    })();
  } else {
    setProgress(1);
  }
  return modelLoadPromise;
}

function riskFor(proximity: number, warn: number, danger: number): ProximityRisk {
  if (proximity >= danger) return 'danger';
  if (proximity >= warn) return 'warn';
  return 'safe';
}

/**
 * Vision-based proximity detector. Loads COCO-SSD on first activation, then
 * polls the provided video element at `intervalMs`, returning bounding boxes
 * plus a 0..1 "proximity" score derived from box area ratio. Used to drive
 * an on-screen overlay + auto-brake demo for App2 機器人視角.
 */
export function useVisionProximity(
  active: boolean,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  options: Options = {},
): VisionProximityResult {
  const warn = options.warnThreshold ?? 0.18;
  const danger = options.dangerThreshold ?? 0.35;
  const intervalMs = options.intervalMs ?? 220;
  const scoreThreshold = options.scoreThreshold ?? 0.55;

  const [modelStatus, setModelStatus] = useState<VisionProximityResult['modelStatus']>('idle');
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelProgress, setModelProgress] = useState(0);
  const [detections, setDetections] = useState<ProximityDetection[]>([]);
  const [fps, setFps] = useState(0);

  const modelRef = useRef<LoadedModel | null>(null);
  const lastTickRef = useRef<number>(0);
  const fpsBufferRef = useRef<number[]>([]);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function start() {
      setModelStatus('loading');
      setModelError(null);
      try {
        const model = await loadModel(setModelProgress);
        if (cancelled) return;
        modelRef.current = model;
        setModelStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setModelStatus('error');
        setModelError(err instanceof Error ? err.message : '模型載入失敗');
        return;
      }

      async function tick() {
        if (cancelled) return;
        const video = videoRef.current;
        const model = modelRef.current;
        if (!video || !model || video.readyState < 2 || video.videoWidth === 0) {
          timer = setTimeout(tick, intervalMs);
          return;
        }
        try {
          const raw = await model.detect(video, 8, 0.4);
          if (cancelled) return;
          const canvasArea = Math.max(1, video.videoWidth * video.videoHeight);
          const mapped: ProximityDetection[] = raw
            .filter((d) => d.score >= scoreThreshold)
            .map((d) => {
              const [, , w, h] = d.bbox;
              const proximity = Math.min(1, (w * h) / canvasArea);
              return {
                label: d.class,
                score: d.score,
                bbox: d.bbox as [number, number, number, number],
                proximity,
                risk: riskFor(proximity, warn, danger),
              };
            })
            .sort((a, b) => b.proximity - a.proximity);
          setDetections(mapped);

          const now = performance.now();
          if (lastTickRef.current) {
            const dt = now - lastTickRef.current;
            if (dt > 0) {
              const sample = 1000 / dt;
              const buf = fpsBufferRef.current;
              buf.push(sample);
              if (buf.length > 8) buf.shift();
              const avg = buf.reduce((s, n) => s + n, 0) / buf.length;
              setFps(Math.round(avg * 10) / 10);
            }
          }
          lastTickRef.current = now;
        } catch (err) {
          if (!cancelled) {
            setModelError(err instanceof Error ? err.message : '辨識失敗');
          }
        }
        if (!cancelled) timer = setTimeout(tick, intervalMs);
      }

      void tick();
    }

    void start();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      setDetections([]);
      setFps(0);
      lastTickRef.current = 0;
      fpsBufferRef.current = [];
    };
  }, [active, videoRef, intervalMs, scoreThreshold, warn, danger]);

  const top = detections[0];
  const maxProximity = top ? top.proximity : 0;
  const risk = top ? top.risk : 'safe';
  const topLabel = top ? top.label : null;

  return {
    modelStatus,
    modelError,
    modelProgress,
    detections,
    maxProximity,
    risk,
    topLabel,
    fps,
  };
}
