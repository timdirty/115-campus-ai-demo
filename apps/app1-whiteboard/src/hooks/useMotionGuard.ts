// FUN-343 — Visual obstacle guard hook.
//
// Watches a `<video>` stream and runs detectMotionInRobotZone() on a slow
// frame-pair cadence. When the camera is on AND `enabled === true` (Home
// passes `busy.startsWith('task-')`), motion in the robot's path band fires
// `onTriggered()` once per debounced burst. This replaces the non-existent
// ultrasonic narrative on Notion Q8 / 攤位 SOP 動作 ④.

import {useEffect, useRef, useState} from 'react';
import type {RefObject} from 'react';
import {
  DEFAULT_MOTION_THRESHOLD,
  DEFAULT_ROBOT_ZONE,
  detectMotionInRobotZone,
  type MotionResult,
  type MotionZone,
} from '../services/boardVision';

export type MotionGuardState = {
  active: boolean;          // 偵測中（攝影機 ready 且 enabled）
  triggered: boolean;       // 最近一次比對結果為「有障礙物」
  intensity: number;        // 0..100，最近一次的避障訊號強度
  samples: number;          // 取樣點數，0 表示尚未開始或無畫面
  lastTriggeredAt: number;  // performance.now() 時間戳，未觸發為 0
};

const SAMPLE_INTERVAL_MS = 200;
const DEBOUNCE_MS = 1500;       // 同一波觸發避免狂送 PAUSE_TASK
const DOWNSAMPLE_WIDTH = 160;   // 取樣解析度（高度按比例算）

export function useMotionGuard(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  onTriggered: () => void,
  options?: {zone?: MotionZone; threshold?: number},
): MotionGuardState {
  const [state, setState] = useState<MotionGuardState>({
    active: false, triggered: false, intensity: 0, samples: 0, lastTriggeredAt: 0,
  });
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);
  const prevDimsRef = useRef<{w: number; h: number} | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTriggeredAtRef = useRef<number>(0);
  // 把 callback 鎖在 ref 裡，避免父層每次 render 都重啟 interval。
  const onTriggeredRef = useRef(onTriggered);
  useEffect(() => { onTriggeredRef.current = onTriggered; }, [onTriggered]);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      prevFrameRef.current = null;
      prevDimsRef.current = null;
      setState((s) => s.active || s.triggered ? {active: false, triggered: false, intensity: 0, samples: 0, lastTriggeredAt: s.lastTriggeredAt} : s);
      return;
    }

    setState((s) => ({...s, active: true}));
    const zone = options?.zone ?? DEFAULT_ROBOT_ZONE;
    const threshold = options?.threshold ?? DEFAULT_MOTION_THRESHOLD;

    const tick = () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;
      if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
      const sourceW = video.videoWidth;
      const sourceH = video.videoHeight;
      const scale = Math.min(1, DOWNSAMPLE_WIDTH / sourceW);
      const w = Math.max(1, Math.round(sourceW * scale));
      const h = Math.max(1, Math.round(sourceH * scale));
      const canvas = canvasRef.current;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', {willReadFrequently: true});
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      let imageData: ImageData;
      try {
        imageData = ctx.getImageData(0, 0, w, h);
      } catch {
        // 攝影機跨來源時 getImageData 會 throw — 安全降級
        return;
      }
      const curr = imageData.data;

      const prev = prevFrameRef.current;
      const prevDims = prevDimsRef.current;
      // 第一張 frame 只記錄不比對；尺寸改變時也重置。
      if (!prev || !prevDims || prevDims.w !== w || prevDims.h !== h) {
        prevFrameRef.current = new Uint8ClampedArray(curr);
        prevDimsRef.current = {w, h};
        return;
      }

      const result: MotionResult = detectMotionInRobotZone(w, h, prev, curr, zone, threshold);
      // 寫回新 frame 給下次比對
      prevFrameRef.current = new Uint8ClampedArray(curr);

      const now = performance.now();
      const debounceOk = now - lastTriggeredAtRef.current > DEBOUNCE_MS;
      if (result.triggered && debounceOk) {
        lastTriggeredAtRef.current = now;
        onTriggeredRef.current();
        setState({active: true, triggered: true, intensity: result.intensity, samples: result.samples, lastTriggeredAt: now});
      } else {
        setState((s) => ({
          active: true,
          triggered: result.triggered && !debounceOk ? s.triggered : false,
          intensity: result.intensity,
          samples: result.samples,
          lastTriggeredAt: s.lastTriggeredAt,
        }));
      }
    };

    timerRef.current = setInterval(tick, SAMPLE_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      prevFrameRef.current = null;
      prevDimsRef.current = null;
    };
  }, [enabled, videoRef, options?.zone, options?.threshold]);

  return state;
}
