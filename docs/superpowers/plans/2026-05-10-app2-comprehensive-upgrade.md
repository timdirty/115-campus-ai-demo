# App2 校園服務機器人全面升級 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修復 35 個已知問題（8 Critical + 12 Memory Leaks + 9 Smells + 6 Quick Wins）、建立共用 camera/vision hooks、將 LifeView（1039行）拆為獨立元件，讓 App2 在比賽現場不崩潰。

**Architecture:** 新建 `useCamera` + `useGeminiVision` 兩個共用 hook，取代 LifeView/TeachView/DashboardView 三份重複的鏡頭管理程式碼。LifeView 拆成 5 個獨立 Card 元件放在 `src/components/life/`，LifeView.tsx 縮短至 ~200 行。appState.ts 維持原樣（連動 Action 重構風險極高）。

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Tailwind v4, motion/react, Gemini 2.5 Flash via bridge

**App root:** `google ai studio/app_2（國小）/校園服務機器人 app/`  
（以下所有路徑皆相對於此目錄）

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| **Modify** | `src/services/localVision.ts` | Fix: 2s→8s timeout, remove dup getBridgeUrl, validate scene, fix abort listener |
| **Modify** | `src/services/hardwareBridge.ts` | Fix: auto-retry only on 503, not on timeout (prevents duplicate Arduino commands) |
| **Modify** | `server/serialBridge.ts` | Fix: double-response race, send initial arduino_status on WS connect |
| **Create** | `src/hooks/useCamera.ts` | Shared camera lifecycle: getUserMedia, iOS fallback, cleanup |
| **Create** | `src/hooks/useGeminiVision.ts` | Shared Gemini Vision polling: rate limiter, loop-based (no overlap), cancel-safe |
| **Modify** | `src/views/TeachView.tsx` | Use useCamera + useGeminiVision, fix AbortSignal.timeout, fix attendance timeout leak |
| **Modify** | `src/views/LifeView.tsx` | Fix _eventId placement, remove auto-dispatch, fix srcObject, fix broadcast timer leaks |
| **Create** | `src/components/life/BellScheduleCard.tsx` | 鐘聲時間表（~80行，zero deps） |
| **Create** | `src/components/life/EnvMonitorCard.tsx` | 環境監控卡片（~80行） |
| **Create** | `src/components/life/BroadcastCard.tsx` | 廣播系統（~100行，accepts showToast + addDispatchTask） |
| **Create** | `src/components/life/ScanMapCard.tsx` | 掃描地圖（~120行） |
| **Create** | `src/components/life/VisionCameraCard.tsx` | 攝影機 + Gemini 辨識（~160行，uses useCamera + useGeminiVision） |
| **Modify** | `src/views/LifeView.tsx` (final) | 整合所有 Card 元件，縮短至 ~220 行 |
| **Modify** | `src/views/DashboardView.tsx` | Fix hardcoded URL, use useCamera + useGeminiVision for vision modal |
| **Modify** | `src/hooks/useHardwareSocket.ts` | Fix connectDeadline ref leak, use URL constructor |

---

## Task 1: Fix localVision.ts — timeout、URL dedup、scene 驗證、abort listener

**Files:**
- Modify: `src/services/localVision.ts`

- [ ] **Step 1: 移除重複的 getBridgeUrl() 函數，改 import BRIDGE_URL from hardwareBridge**

在 `src/services/localVision.ts` 最頂端，將現有的：
```typescript
import type {DispatchTaskType} from '../state/appState';
import {analyzeFrameQuality, FrameQualityResult} from './frameQuality';
```
改為：
```typescript
import type {DispatchTaskType} from '../state/appState';
import {analyzeFrameQuality, FrameQualityResult} from './frameQuality';
import {BRIDGE_URL} from './hardwareBridge';
```

然後刪除整個 `getBridgeUrl()` 函數（約 line 221–229）：
```typescript
// 刪除這整段：
function getBridgeUrl(): string {
  try {
    return (
      (import.meta as unknown as {env?: Record<string, string>}).env?.VITE_ARDUINO_BRIDGE_URL ||
      'http://localhost:3202'
    );
  } catch {
    return 'http://localhost:3202';
  }
}
```

在 `analyzeCampusImageWithGemini` 函數內，將 `${getBridgeUrl()}` 改為 `${BRIDGE_URL}`。

- [ ] **Step 2: 改 Gemini timeout 2000ms → 8000ms**

在 `analyzeCampusImageWithGemini` 函數內找到：
```typescript
const timeout = setTimeout(() => controller.abort(), 2000);
```
改為：
```typescript
const timeout = setTimeout(() => controller.abort(), 8000);
```

- [ ] **Step 3: 加 scene 白名單驗證，防止 unknown scene 流入前端**

在 `analyzeCampusImageWithGemini` 的 try block 內，找到這段：
```typescript
const scene = data.scene as VisionScene;
const profile = sceneProfiles[scene] ?? sceneProfiles.patrol;
```
改為：
```typescript
const VALID_SCENES: VisionScene[] = ['crowd', 'safety', 'cleaning', 'delivery', 'patrol'];
const scene: VisionScene = VALID_SCENES.includes(data.scene as VisionScene)
  ? (data.scene as VisionScene)
  : 'patrol';
const profile = sceneProfiles[scene];
```

- [ ] **Step 4: 修 abort listener 累積問題（`{once: true}`）**

在 `analyzeCampusImageWithGemini` 函數內找到：
```typescript
cancelSignal?.addEventListener('abort', () => controller.abort(), {once: true});
```
這行已有 `{once: true}`，確認它確實存在。若沒有，加上去。

- [ ] **Step 5: 跑 TypeScript 確認無錯誤**
```bash
cd "google ai studio/app_2（國小）/校園服務機器人 app" && npx tsc --noEmit 2>&1 | head -20
```
Expected: 無錯誤輸出。

- [ ] **Step 6: Commit**
```bash
git add "google ai studio/app_2（國小）/校園服務機器人 app/src/services/localVision.ts"
git commit -m "fix(vision): 8s Gemini timeout, remove dup getBridgeUrl, validate scene, once listener"
```

---

## Task 2: Fix hardwareBridge.ts — auto-retry 不重送已送達的指令

**Files:**
- Modify: `src/services/hardwareBridge.ts`

背景：目前 `statusCode === 0`（timeout）也會 retry，但 timeout 時 Arduino 可能已收到指令，重送會讓機器人做兩次。只有 503（bridge busy，指令未送出）才安全重試。

- [ ] **Step 1: 修改 auto-retry 條件**

找到 `sendHardwareCommand` 函數：
```typescript
export async function sendHardwareCommand(command: string, source: string): Promise<HardwareBridgeResult> {
  const first = await doPost(command, source, 5000);
  // Auto-retry once on transient 503/timeout (bridge momentarily busy)
  if (!first.ok && (first.statusCode === 503 || first.statusCode === 0)) {
    await new Promise((r) => setTimeout(r, 400));
    return doPost(command, source, 5000);
  }
  return first;
}
```

改為（只重試 503，不重試 timeout）：
```typescript
export async function sendHardwareCommand(command: string, source: string): Promise<HardwareBridgeResult> {
  const first = await doPost(command, source, 5000);
  // Retry ONLY on 503 (bridge busy — command was NOT sent to Arduino).
  // Do NOT retry on timeout (statusCode 0) — Arduino may have already received the command.
  if (!first.ok && first.statusCode === 503) {
    await new Promise((r) => setTimeout(r, 400));
    return doPost(command, source, 5000);
  }
  return first;
}
```

- [ ] **Step 2: Commit**
```bash
git add "google ai studio/app_2（國小）/校園服務機器人 app/src/services/hardwareBridge.ts"
git commit -m "fix(bridge): only retry on 503, not timeout — prevent duplicate Arduino commands"
```

---

## Task 3: Fix serialBridge.ts — double-response bug + 初始 arduino_status

**Files:**
- Modify: `server/serialBridge.ts`

- [ ] **Step 1: 修 timeout middleware double-response**

找到 timeout middleware（約 line 105–112）：
```typescript
app.use('/api/robot', (req, res, next) => {
  if (req.method !== 'POST') { next(); return; }
  const t = setTimeout(() => {
    if (!res.headersSent) res.status(503).json({ok: false, error: 'request timeout — bridge busy'});
  }, 6000);
  res.on('finish', () => clearTimeout(t));
  next();
});
```

確認 `if (!res.headersSent)` 已存在（它在 line 108）。這個 guard 已正確。但問題是 handler 在 503 後還會 res.json()。加上讓 handler 也檢查 headersSent：

在 `app.post('/api/robot/command', ...)` handler 內，找到最終 `res.status(...).json(...)` 之前加：
```typescript
// 在 handler 回應前先檢查
if (res.headersSent) return;
```

具體來說，在 line 135 的 `res.status(result.ok ? 200 : 503).json({...})` 前加這行。

- [ ] **Step 2: WS 連線時推送初始 arduino_status**

找到 `wss.on('connection', ...)` 區塊（約 line 61–69）：
```typescript
wss.on('connection', (ws, req) => {
  wsAlive.set(ws, true);
  ws.on('pong', () => wsAlive.set(ws, true));
  if (req.url === '/display') {
    displayClients.add(ws);
    ws.send(JSON.stringify({type: 'display_ready'}));
    ws.on('close', () => displayClients.delete(ws));
  }
});
```

改為（非 display 連線時立即推送 arduino_status）：
```typescript
wss.on('connection', (ws, req) => {
  wsAlive.set(ws, true);
  ws.on('pong', () => wsAlive.set(ws, true));
  if (req.url === '/display') {
    displayClients.add(ws);
    ws.send(JSON.stringify({type: 'display_ready'}));
    ws.on('close', () => displayClients.delete(ws));
  } else {
    // Push current hardware state immediately so frontend doesn't wait for next status change
    ws.send(JSON.stringify({
      type: 'arduino_status',
      connected: isConnected(),
      port: getActivePath() ?? '',
      simulated: false,
    }));
  }
});
```

- [ ] **Step 3: Commit**
```bash
git add "google ai studio/app_2（國小）/校園服務機器人 app/server/serialBridge.ts"
git commit -m "fix(bridge): guard double-response in timeout middleware + push initial arduino_status on WS connect"
```

---

## Task 4: 建立共用 useCamera hook

**Files:**
- Create: `src/hooks/useCamera.ts`

- [ ] **Step 1: 建立 useCamera.ts**

```typescript
// src/hooks/useCamera.ts
import { useState, useEffect, useRef } from 'react';

export interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  ready: boolean;
  error: string | null;
}

/**
 * Manages camera lifecycle tied to `active` flag.
 * Tries rear camera first, falls back to front (iOS workaround), then any video device.
 * Cleans up stream + srcObject on deactivate.
 */
export function useCamera(active: boolean): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      setReady(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function startCamera() {
      // Try three constraint sets in order (rear → front → any)
      const constraintSets: MediaStreamConstraints[] = [
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false },
        { video: { facingMode: 'user', width: { ideal: 1280 } }, audio: false },
        { video: true, audio: false },
      ];

      let stream: MediaStream | null = null;
      let lastError: Error | null = null;
      for (const c of constraintSets) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(c);
          break;
        } catch (e) {
          lastError = e instanceof Error ? e : new Error(String(e));
          if (e instanceof DOMException && (e.name === 'OverconstrainedError' || e.name === 'NotFoundError')) {
            continue; // try next constraint
          }
          break; // fatal error (NotAllowedError etc.) — stop trying
        }
      }

      if (cancelled) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }

      if (!stream) {
        const msg = lastError?.name === 'NotAllowedError'
          ? '相機權限被拒絕，請在瀏覽器設定中允許'
          : `相機無法啟動：${lastError?.message ?? '未知錯誤'}`;
        setError(msg);
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (!cancelled) setReady(true);
        };
        videoRef.current.play().catch(() => {/* autoplay policy — OK */});
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      setReady(false);
    };
  }, [active]);

  return { videoRef, canvasRef, ready, error };
}
```

- [ ] **Step 2: 確認 TypeScript 通過**
```bash
cd "google ai studio/app_2（國小）/校園服務機器人 app" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**
```bash
git add "google ai studio/app_2（國小）/校園服務機器人 app/src/hooks/useCamera.ts"
git commit -m "feat(hooks): add useCamera — shared camera lifecycle with iOS env→user fallback"
```

---

## Task 5: 建立共用 useGeminiVision hook

**Files:**
- Create: `src/hooks/useGeminiVision.ts`

設計重點：
- **Loop-based**（不是 setInterval）：上一次請求完成後才等 intervalMs，徹底避免 overlap
- **全域 rate limiter**：singleton token bucket，跨所有 view 每 6s 最多 1 次 Gemini 呼叫

- [ ] **Step 1: 建立 useGeminiVision.ts**

```typescript
// src/hooks/useGeminiVision.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { analyzeCampusImageWithGemini, type CampusVisionResult } from '../services/localVision';

// ─── Global rate limiter (singleton) ───────────────────────────────────────
// Ensures at most 1 Gemini Vision call every 6s across all active views.
let _lastGeminiCallMs = 0;
const GEMINI_MIN_INTERVAL_MS = 6000;

async function waitForGeminiSlot(signal: AbortSignal): Promise<void> {
  const now = Date.now();
  const waitMs = Math.max(0, _lastGeminiCallMs + GEMINI_MIN_INTERVAL_MS - now);
  if (waitMs <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, waitMs);
    signal.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('aborted', 'AbortError')); }, { once: true });
  });
}
// ───────────────────────────────────────────────────────────────────────────

export interface GeminiVisionResult {
  result: (CampusVisionResult & { aiSource?: 'gemini' | 'pixel' }) | null;
  analyzing: boolean;
  source: 'gemini' | 'local';
}

/**
 * Continuously captures frames and sends them to Gemini Vision.
 * Starts when `active` is true, stops and cleans up when false.
 * Uses a loop (not setInterval) to avoid overlapping requests.
 *
 * @param active   Start/stop the analysis loop
 * @param videoRef Ref to the live <video> element
 * @param canvasRef Ref to an offscreen <canvas> (can be hidden)
 * @param intervalMs Minimum delay between captures (default 5000ms). Actual gap = intervalMs + Gemini round-trip.
 */
export function useGeminiVision(
  active: boolean,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  intervalMs = 5000,
): GeminiVisionResult {
  const [result, setResult] = useState<(CampusVisionResult & { aiSource?: 'gemini' | 'pixel' }) | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [source, setSource] = useState<'gemini' | 'local'>('local');
  const abortRef = useRef<AbortController | null>(null);

  const captureJpeg = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || !video.videoWidth) return null;
    const scale = Math.min(1, 320 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.65);
  }, [videoRef, canvasRef]);

  useEffect(() => {
    if (!active) {
      abortRef.current?.abort();
      abortRef.current = null;
      setAnalyzing(false);
      return;
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    async function loop() {
      while (!ctrl.signal.aborted) {
        // Respect global rate limit
        try {
          await waitForGeminiSlot(ctrl.signal);
        } catch {
          break; // aborted during wait
        }
        if (ctrl.signal.aborted) break;

        const dataUrl = captureJpeg();
        if (!dataUrl) {
          // Camera not ready yet — wait a bit and retry
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }

        _lastGeminiCallMs = Date.now();
        setAnalyzing(true);
        try {
          const r = await analyzeCampusImageWithGemini(dataUrl, ctrl.signal);
          if (!ctrl.signal.aborted) {
            setResult(r);
            setSource(r.aiSource === 'gemini' ? 'gemini' : 'local');
          }
        } catch {
          // analyzeCampusImageWithGemini already falls back to local — nothing to do
        } finally {
          if (!ctrl.signal.aborted) setAnalyzing(false);
        }

        // Wait intervalMs after completion before next capture
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, intervalMs);
          ctrl.signal.addEventListener('abort', () => { clearTimeout(t); reject(); }, { once: true });
        }).catch(() => {/* aborted — exit loop */});
      }
    }

    void loop();

    return () => {
      ctrl.abort();
      abortRef.current = null;
      setAnalyzing(false);
    };
  }, [active, captureJpeg, intervalMs]);

  return { result, analyzing, source };
}
```

- [ ] **Step 2: 確認 TypeScript 通過**
```bash
cd "google ai studio/app_2（國小）/校園服務機器人 app" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**
```bash
git add "google ai studio/app_2（國小）/校園服務機器人 app/src/hooks/useGeminiVision.ts"
git commit -m "feat(hooks): add useGeminiVision — loop-based, global 6s rate limiter, abort-safe"
```

---

## Task 6: Refactor TeachView — 使用 useCamera + useGeminiVision，修 AbortSignal + timer leaks

**Files:**
- Modify: `src/views/TeachView.tsx`

- [ ] **Step 1: 更新 imports，移除已不需要的手動 ref/state**

將現有 import 區段最頂端改為：
```typescript
import React, { useState, useEffect, useRef, useCallback } from 'react';
```
改為：
```typescript
import React, { useState, useRef } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useGeminiVision } from '../hooks/useGeminiVision';
```

移除不再需要的 `useEffect`, `useCallback`（若其他地方仍有使用就保留）。

- [ ] **Step 2: 替換 camera/vision state 與 refs**

找到元件內這一整塊 camera state（約 10–15 行）：
```typescript
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const visionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [camReady, setCamReady] = useState(false);
  const [camAnalyzing, setCamAnalyzing] = useState(false);
  const [camScene, setCamScene] = useState<string>('patrol');
  const [camConfidence, setCamConfidence] = useState<number>(0);
  const [camZone, setCamZone] = useState<string>('');
  const [camSummary, setCamSummary] = useState<string>('');
  const [camSource, setCamSource] = useState<'gemini' | 'local'>('local');
```

整個替換為：
```typescript
  const { videoRef, canvasRef, ready: camReady, error: camError } = useCamera(modal === 'video');
  const { result: camResult, analyzing: camAnalyzing, source: camSource } = useGeminiVision(
    modal === 'video' && camReady, videoRef, canvasRef, 5000,
  );
  const camScene = camResult?.scene ?? 'patrol';
  const camConfidence = camResult?.confidence ?? 0;
  const camZone = camResult?.zone ?? '';
  const camSummary = camResult?.summary ?? '';
```

- [ ] **Step 3: 刪除 captureAndAnalyze callback 和 camera useEffect**

找到並刪除整個 `captureAndAnalyze` useCallback 函數。
找到並刪除以 `if (modal !== 'video') {` 開頭的整個 camera lifecycle useEffect。

- [ ] **Step 4: 修 AbortSignal.timeout → AbortController（TeachView 內若還有殘留）**

搜尋 `AbortSignal.timeout`，若還有：
```typescript
signal: AbortSignal.timeout(8000),
```
改為 `useGeminiVision` 已在 hook 內部處理，TeachView 應不再有直接的 fetch。確認刪乾淨。

- [ ] **Step 5: 修 attendance setTimeout leak**

找到 `handleRollCall`：
```typescript
  const handleRollCall = () => {
    setModal('attendance_scan');
    setTimeout(() => {
      actions.scanAttendance();
      setModal(null);
      showToast('AI 場域點名已完成：2 個座位待確認');
    }, 2500);
  };
```

在元件 state 宣告區加：
```typescript
  const attendanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

改 `handleRollCall` 為：
```typescript
  const handleRollCall = () => {
    setModal('attendance_scan');
    if (attendanceTimerRef.current) clearTimeout(attendanceTimerRef.current);
    attendanceTimerRef.current = setTimeout(() => {
      attendanceTimerRef.current = null;
      actions.scanAttendance();
      setModal(null);
      showToast('AI 場域點名已完成：2 個座位待確認');
    }, 2500);
  };
```

在元件的 focus score useEffect 之前加 cleanup useEffect：
```typescript
  useEffect(() => {
    return () => {
      if (attendanceTimerRef.current) clearTimeout(attendanceTimerRef.current);
    };
  }, []);
```

- [ ] **Step 6: 更新 video modal — 加 camError 顯示，移除 BRIDGE_URL 常數（改用 hook）**

在 video modal 的 placeholder div（目前顯示「開啟攝影機中…」）內加 error 顯示：
```tsx
          {/* Placeholder shown while camera starts */}
          {!camReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none"
              style={{background: 'linear-gradient(160deg, #0d2137 0%, #1e3a5f 60%, #0a1a2e 100%)'}}>
              {camError ? (
                <>
                  <Video size={48} className="text-red-400" />
                  <p className="text-red-300 text-sm font-mono text-center px-6">{camError}</p>
                </>
              ) : (
                <>
                  <Video size={48} className="text-white/40 animate-pulse" />
                  <p className="text-white/50 text-sm font-mono">開啟攝影機中…</p>
                </>
              )}
            </div>
          )}
```

移除頂端已不需要的 `const BRIDGE_URL = ...` 常數（useCamera/useGeminiVision 已封裝）。

- [ ] **Step 7: 確認 TypeScript 通過**
```bash
cd "google ai studio/app_2（國小）/校園服務機器人 app" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 8: Commit**
```bash
git add "google ai studio/app_2（國小）/校園服務機器人 app/src/views/TeachView.tsx"
git commit -m "refactor(teach): use useCamera+useGeminiVision hooks, fix AbortSignal compat, fix attendance timer leak"
```

---

## Task 7: Fix LifeView — _eventId placement, auto-dispatch, srcObject, broadcast timers

**Files:**
- Modify: `src/views/LifeView.tsx`

- [ ] **Step 1: 移動 `let _eventId = 100;` 到 imports 之後**

找到 LifeView.tsx 最頂端：
```typescript
import React, { useState, useEffect, useRef, useCallback } from 'react';
let _eventId = 100;   // ← 目前在這裡（第2行，夾在 import 中間）
import { motion, AnimatePresence } from 'motion/react';
// ...其他 imports
```

將 `let _eventId = 100;` 這行刪除，然後在所有 import 結束後（第一個 const/function 前）加：
```typescript
let _eventId = 100;
```

- [ ] **Step 2: 移除 auto-dispatch useEffect（最危險的 bug）**

找到並刪除整個 auto-dispatch useEffect（約 line 322–327）：
```typescript
  // Auto-dispatch scene-specific hardware command when the detected scene changes.
  useEffect(() => {
    if (!visionResult || prevVisionSceneRef.current === visionResult.scene) return;
    prevVisionSceneRef.current = visionResult.scene;
    sendHardwareCommand(visionResult.command, 'life-vision').catch(() => {});
  }, [visionResult]);
```

**整個刪除**。hardware 指令應由使用者點擊「派遣」按鈕觸發，不應自動送出。

同時移除不再使用的 `prevVisionSceneRef`：找到並刪除：
```typescript
const prevVisionSceneRef = useRef<VisionScene | null>(null);
```

- [ ] **Step 3: 修 camera cleanup — 加 srcObject = null**

找到 camera cleanup（`modal !== 'mapcam'` 分支）：
```typescript
    if (modal !== 'mapcam') {
      cameraStreamRef.current?.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
      setCameraReady(false);
      setCameraError(null);
      return;
    }
```

改為：
```typescript
    if (modal !== 'mapcam') {
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setCameraReady(false);
      setCameraError(null);
      return;
    }
```

同理，在 cleanup return 函數內：
```typescript
    return () => {
      cameraStreamRef.current?.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
      setCameraReady(false);
    };
```
改為：
```typescript
    return () => {
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setCameraReady(false);
    };
```

- [ ] **Step 4: 修 broadcast timeout leaks**

在元件 state 宣告區加兩個 ref：
```typescript
  const broadcastPressingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const broadcastSentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

在 `handleEmergencyBroadcast` 內，找到：
```typescript
      setBroadcastPressing(true);
      setTimeout(() => setBroadcastPressing(false), 2500);
```
改為：
```typescript
      setBroadcastPressing(true);
      if (broadcastPressingTimerRef.current) clearTimeout(broadcastPressingTimerRef.current);
      broadcastPressingTimerRef.current = setTimeout(() => {
        broadcastPressingTimerRef.current = null;
        setBroadcastPressing(false);
      }, 2500);
```

找到：
```typescript
    setBroadcastSent(true);
    showToast('緊急廣播已發送至：' + zones);
    setTimeout(() => setBroadcastSent(false), 3000);
```
改為：
```typescript
    setBroadcastSent(true);
    showToast('緊急廣播已發送至：' + zones);
    if (broadcastSentTimerRef.current) clearTimeout(broadcastSentTimerRef.current);
    broadcastSentTimerRef.current = setTimeout(() => {
      broadcastSentTimerRef.current = null;
      setBroadcastSent(false);
    }, 3000);
```

在元件第一個 useEffect 前加 cleanup：
```typescript
  useEffect(() => {
    return () => {
      if (broadcastPressingTimerRef.current) clearTimeout(broadcastPressingTimerRef.current);
      if (broadcastSentTimerRef.current) clearTimeout(broadcastSentTimerRef.current);
    };
  }, []);
```

- [ ] **Step 5: 修 frame analysis cleanup — 不在 cleanup 內呼叫 setState**

找到 frame analysis useEffect 的 cleanup：
```typescript
    return () => {
      cancelController.abort();
      clearInterval(intv);
      stableFramesRef.current = null;
      setIsAnalyzing(false);  // ← 問題：cleanup 不應 setState
    };
```
改為：
```typescript
    return () => {
      cancelController.abort();
      clearInterval(intv);
      stableFramesRef.current = null;
      // Do NOT call setIsAnalyzing here — the abort signal will prevent any setState from the in-flight analyze()
    };
```

- [ ] **Step 6: 確認 TypeScript 通過**
```bash
cd "google ai studio/app_2（國小）/校園服務機器人 app" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 7: Commit**
```bash
git add "google ai studio/app_2（國小）/校園服務機器人 app/src/views/LifeView.tsx"
git commit -m "fix(life): move _eventId, remove auto-dispatch hw cmd, fix srcObject cleanup, fix broadcast timer leaks"
```

---

## Task 8: 建立 BellScheduleCard + EnvMonitorCard

**Files:**
- Create: `src/components/life/BellScheduleCard.tsx`
- Create: `src/components/life/EnvMonitorCard.tsx`

先讀 LifeView.tsx 的鐘聲表和環境卡片區段再提取。

- [ ] **Step 1: 讀 LifeView.tsx 鐘聲表區段**

在執行此 task 前，先讀 LifeView.tsx 中鐘聲 JSX 渲染區段（找包含 `bellSchedule.map` 的部分），確認確切的 JSX 結構。

- [ ] **Step 2: 建立 BellScheduleCard.tsx**

將鐘聲表相關的 constants（`ALL_BELLS`, `toMins()`, `computeBells()`）和對應 JSX 提取為：

```typescript
// src/components/life/BellScheduleCard.tsx
import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

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
  const base = afterSchool
    ? ALL_BELLS.map((b) => ({ ...b, done: false, next: false }))
    : ALL_BELLS.map((b) => ({ ...b, done: toMins(b.time) <= nowMins, next: false }));
  const nextIdx = base.findIndex((b) => !b.done);
  if (nextIdx !== -1) base[nextIdx] = { ...base[nextIdx], next: true };
  const windowStart = Math.max(0, nextIdx === -1 ? base.length - 6 : nextIdx - 2);
  return base.slice(windowStart, windowStart + 6);
}

export function BellScheduleCard() {
  const [bellSchedule, setBellSchedule] = useState(computeBells);

  useEffect(() => {
    const intv = setInterval(() => setBellSchedule(computeBells()), 60_000);
    return () => clearInterval(intv);
  }, []);

  const firstUndoneIdx = bellSchedule.findIndex((b) => !b.done);

  return (
    // ← 從 LifeView.tsx 中直接複製對應的鐘聲表 JSX 區段，替換 bellSchedule/firstUndoneIdx 來源即可
    // 確保所有 className 完整複製，不刪減任何 Tailwind class
    <section className="rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-md p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant font-mono flex items-center gap-2">
          <Clock size={12} /> 今日鐘聲時程
        </p>
      </div>
      <div className="space-y-1.5">
        {bellSchedule.map((bell, i) => (
          <div
            key={bell.time + bell.label}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
              bell.next
                ? 'bg-primary/10 border border-primary/20'
                : bell.done
                ? 'opacity-40'
                : ''
            }`}
          >
            <span className={`text-[10px] font-black font-mono w-10 ${bell.next ? 'text-primary' : 'text-on-surface-variant'}`}>
              {bell.time}
            </span>
            <span className={`flex-1 text-xs font-bold ${bell.next ? 'text-primary' : bell.done ? 'text-on-surface-variant' : 'text-on-surface'}`}>
              {bell.label}
            </span>
            {bell.next && (
              <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full tracking-widest animate-pulse">
                即將
              </span>
            )}
            {bell.done && i < firstUndoneIdx && (
              <span className="text-[9px] font-black text-on-surface-variant/40">✓</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
```

**注意：** 實際 JSX 應與 LifeView.tsx 現有的鐘聲表 JSX 一致。上面是骨架，實作時以 LifeView.tsx 現有 JSX 為準，直接複製貼上後刪除原本 LifeView 內的版本。

- [ ] **Step 3: 建立 EnvMonitorCard.tsx**

從 LifeView.tsx 中找到環境感測（溫濕度/空氣品質等）的卡片 JSX 區段，提取為：

```typescript
// src/components/life/EnvMonitorCard.tsx
import React from 'react';
// 從 LifeView 複製所需 lucide-react icons import
// 從 LifeView 複製環境感測 JSX 區段
// 此元件無需 props（使用 hardcoded demo 資料）

export function EnvMonitorCard() {
  // 複製 LifeView 中環境監控卡片的完整 JSX，包含所有 Tailwind class
  return (
    /* 從 LifeView 複製對應 JSX */
    <div>{/* 環境感測內容 */}</div>
  );
}
```

- [ ] **Step 4: TypeScript check**
```bash
cd "google ai studio/app_2（國小）/校園服務機器人 app" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**
```bash
git add "google ai studio/app_2（國小）/校園服務機器人 app/src/components/life/"
git commit -m "refactor(life): extract BellScheduleCard + EnvMonitorCard components"
```

---

## Task 9: 建立 BroadcastCard + ScanMapCard

**Files:**
- Create: `src/components/life/BroadcastCard.tsx`
- Create: `src/components/life/ScanMapCard.tsx`

- [ ] **Step 1: 讀 LifeView.tsx 廣播系統與掃描地圖區段**

在執行此 task 前，先讀 LifeView.tsx 對應區段確認 props 需求。

- [ ] **Step 2: 建立 BroadcastCard.tsx**

廣播系統需要 `showToast` + `actions.addDispatchTask`，通過 props 傳入：

```typescript
// src/components/life/BroadcastCard.tsx
import React, { useState, useRef, useCallback } from 'react';
import { Megaphone } from 'lucide-react';
import { sendHardwareCommand } from '../../services/hardwareBridge';

const BROADCAST_ZONES = ['全校', 'A棟', 'B棟', '操場'];

interface BroadcastCardProps {
  showToast: (msg: string) => void;
  onDispatch: (zone: string) => void; // calls actions.addDispatchTask
}

export function BroadcastCard({ showToast, onDispatch }: BroadcastCardProps) {
  const [broadcastZones, setBroadcastZones] = useState<Set<string>>(new Set(['全校']));
  const [broadcastPressing, setBroadcastPressing] = useState(false);
  const [broadcastSent, setBroadcastSent] = useState(false);
  const pressingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleZone = (zone: string) => {
    if (zone === '全校') { setBroadcastZones(new Set(['全校'])); return; }
    const next = new Set(broadcastZones);
    next.delete('全校');
    if (next.has(zone)) next.delete(zone); else next.add(zone);
    if (next.size === 0) next.add('全校');
    setBroadcastZones(next);
  };

  const handleBroadcast = useCallback(() => {
    if (!broadcastPressing) {
      setBroadcastPressing(true);
      if (pressingTimerRef.current) clearTimeout(pressingTimerRef.current);
      pressingTimerRef.current = setTimeout(() => {
        pressingTimerRef.current = null;
        setBroadcastPressing(false);
      }, 2500);
      return;
    }
    const zones = Array.from(broadcastZones).join('、');
    onDispatch(zones);
    sendHardwareCommand('BROADCAST_EMERGENCY', 'life').catch(() => {});
    setBroadcastSent(true);
    showToast('緊急廣播已發送至：' + zones);
    if (sentTimerRef.current) clearTimeout(sentTimerRef.current);
    sentTimerRef.current = setTimeout(() => {
      sentTimerRef.current = null;
      setBroadcastSent(false);
    }, 3000);
    setBroadcastPressing(false);
  }, [broadcastPressing, broadcastZones, onDispatch, showToast]);

  // 複製 LifeView 中廣播系統的完整 JSX，替換 state/handler 來源
  return (
    <section className="rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-md p-5">
      {/* 從 LifeView 複製廣播 JSX，使用上方定義的 state/handler */}
      <div>{/* 廣播內容 */}</div>
    </section>
  );
}
```

**實作時：** JSX 從 LifeView 直接複製，保留所有 Tailwind class 和動畫效果，只替換 state/callback 的來源為 props。

- [ ] **Step 3: 建立 ScanMapCard.tsx**

```typescript
// src/components/life/ScanMapCard.tsx
import React, { useState, useEffect } from 'react';
import { Radio } from 'lucide-react';

// 從 LifeView 複製 SCAN_ZONES, ZONE_MSGS, levelColor 定義

interface ScanMapCardProps {
  // 無需外部 props，掃描區域 state 為 local
}

export function ScanMapCard(_props: ScanMapCardProps) {
  // 複製 LifeView 的 scanZoneIdx state + 輪播 useEffect
  // 複製對應 JSX
  return (
    <section>{/* 從 LifeView 複製掃描地圖 JSX */}</section>
  );
}
```

- [ ] **Step 4: TypeScript check**
```bash
cd "google ai studio/app_2（國小）/校園服務機器人 app" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**
```bash
git add "google ai studio/app_2（國小）/校園服務機器人 app/src/components/life/"
git commit -m "refactor(life): extract BroadcastCard + ScanMapCard components"
```

---

## Task 10: 建立 VisionCameraCard — 整合 useCamera + useGeminiVision

**Files:**
- Create: `src/components/life/VisionCameraCard.tsx`

這是最複雜的元件，整合攝影機 + Gemini Vision 辨識 + dispatch 按鈕。

- [ ] **Step 1: 建立 VisionCameraCard.tsx**

```typescript
// src/components/life/VisionCameraCard.tsx
import React from 'react';
import { motion } from 'motion/react';
import { Camera, Users, ShieldAlert, Sparkles, Package, Eye } from 'lucide-react';
import { useCamera } from '../../hooks/useCamera';
import { useGeminiVision } from '../../hooks/useGeminiVision';
import { sendHardwareCommand } from '../../services/hardwareBridge';
import type { CampusVisionResult, VisionScene } from '../../services/localVision';

const SCENE_ACCENTS: Record<VisionScene, string> = {
  crowd: '#f59e0b', safety: '#ef4444', cleaning: '#14b8a6', delivery: '#22c55e', patrol: '#3b82f6',
};
const SCENE_ICONS: Record<VisionScene, React.ElementType> = {
  crowd: Users, safety: ShieldAlert, cleaning: Sparkles, delivery: Package, patrol: Eye,
};
const SCENE_ACTION_LABELS: Record<VisionScene, string> = {
  crowd: '立即廣播疏導', safety: '緊急安全巡查', cleaning: '派遣清掃任務', delivery: '配送服務派遣', patrol: '開始巡邏任務',
};

interface VisionCameraCardProps {
  isOpen: boolean;          // camera should be active (modal === 'mapcam')
  onClose: () => void;
  showToast: (msg: string) => void;
  onDispatch: (result: CampusVisionResult) => void; // calls actions.addDispatchTask
}

export function VisionCameraCard({ isOpen, onClose, showToast, onDispatch }: VisionCameraCardProps) {
  const { videoRef, canvasRef, ready, error } = useCamera(isOpen);
  const { result, analyzing, source } = useGeminiVision(isOpen && ready, videoRef, canvasRef, 4000);

  const scene: VisionScene = result?.scene ?? 'patrol';
  const SceneIcon = SCENE_ICONS[scene];
  const accent = SCENE_ACCENTS[scene];

  const handleDispatch = () => {
    if (!result) return;
    onDispatch(result);
    sendHardwareCommand(result.command, 'life-vision').catch(() => {});
    showToast(`已派遣：${result.label} — ${result.zone}`);
  };

  // 從 LifeView 複製 mapcam modal 的完整 JSX，替換 state 來源
  // 確保：
  // 1. <video ref={videoRef}> 始終渲染（不條件渲染）
  // 2. <canvas ref={canvasRef} className="hidden" /> 渲染
  // 3. 使用 ready/error 控制顯示
  // 4. 使用 result.label/confidence/zone/summary 顯示辨識結果
  // 5. 使用 analyzing 顯示「Gemini 辨識中…」
  // 6. source === 'gemini' ? '✦ Gemini 2.5 Flash' : '本地分析' 顯示來源
  // 7. 派遣按鈕呼叫 handleDispatch()

  return (
    <div className="w-full h-full bg-black relative overflow-hidden">
      <canvas ref={canvasRef} className="hidden" />
      <video
        ref={videoRef}
        autoPlay playsInline muted
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`}
      />
      {!ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4"
          style={{ background: 'linear-gradient(160deg, #0d2137 0%, #1e3a5f 60%, #0a1a2e 100%)' }}>
          {error ? (
            <p className="text-red-300 text-sm font-mono text-center px-6">{error}</p>
          ) : (
            <p className="text-white/50 text-sm font-mono animate-pulse">開啟攝影機中…</p>
          )}
        </div>
      )}
      {/* AI scan line */}
      {ready && (
        <motion.div
          animate={{ y: ['0%', '100%', '0%'] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-x-0 h-0.5 bg-primary/40 shadow-[0_0_8px_rgba(var(--color-primary),0.8)] pointer-events-none z-10"
        />
      )}
      {/* Bottom info bar — 從 LifeView mapcam modal 複製對應 JSX */}
      <div className="absolute bottom-0 inset-x-0 z-20 bg-linear-to-t from-black/90 via-black/60 to-transparent pt-16 pb-6 px-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-white font-headline font-bold text-lg truncate">
                {result?.zone ?? '校園即時場域'}
              </p>
              <p className="text-white/60 text-sm font-mono mt-0.5">
                {analyzing ? 'Gemini 辨識中…' : (result?.summary ?? (ready ? 'Gemini Vision 監控中' : '啟動中'))}
              </p>
              {result && !analyzing && (
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full tracking-widest text-white"
                    style={{ background: accent + 'cc' }}>
                    {result.label}
                  </span>
                  <span className="text-[10px] text-white/50 font-mono">
                    {source === 'gemini' ? '✦ Gemini 2.5 Flash' : '本地分析'} · {result.confidence}%
                  </span>
                </div>
              )}
            </div>
            <div className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 ${ready ? 'bg-error/80 text-white' : 'bg-black/60 text-white/40'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${ready ? 'bg-white animate-pulse' : 'bg-white/30'}`}></div>
              {ready ? '實況' : '待機'}
            </div>
          </div>
          {result && (
            <button
              onClick={handleDispatch}
              className="w-full py-4 font-bold text-white rounded-2xl transition-all active:scale-[0.98]"
              style={{ background: accent }}
            >
              <SceneIcon size={18} className="inline mr-2" />
              {SCENE_ACTION_LABELS[scene]}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**
```bash
cd "google ai studio/app_2（國小）/校園服務機器人 app" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**
```bash
git add "google ai studio/app_2（國小）/校園服務機器人 app/src/components/life/VisionCameraCard.tsx"
git commit -m "feat(life): VisionCameraCard using useCamera+useGeminiVision, user-triggered dispatch"
```

---

## Task 11: LifeView 最終整合 — 使用所有新 Card 元件

**Files:**
- Modify: `src/views/LifeView.tsx`

目標：從 ~1039 行縮短至 ~220 行。

- [ ] **Step 1: 讀 LifeView.tsx 完整 JSX 結構**

確認 LifeView 的 JSX 頂層結構（所有 section 的順序），以便知道要替換哪些區段。

- [ ] **Step 2: 在 LifeView 頂端加 imports**

```typescript
import { BellScheduleCard } from '../components/life/BellScheduleCard';
import { EnvMonitorCard } from '../components/life/EnvMonitorCard';
import { BroadcastCard } from '../components/life/BroadcastCard';
import { ScanMapCard } from '../components/life/ScanMapCard';
import { VisionCameraCard } from '../components/life/VisionCameraCard';
```

- [ ] **Step 3: 替換 JSX 中各 section 為元件**

在 LifeView return JSX 內：
- 找到鐘聲表 section → 替換為 `<BellScheduleCard />`
- 找到環境監控 section → 替換為 `<EnvMonitorCard />`
- 找到廣播系統 section → 替換為 `<BroadcastCard showToast={showToast} onDispatch={(zone) => actions.addDispatchTask({ zone, taskType: 'broadcast' })} />`
- 找到掃描地圖 section → 替換為 `<ScanMapCard />`
- 找到 mapcam modal 內的攝影機 UI → 替換為 `<VisionCameraCard isOpen={modal === 'mapcam'} onClose={() => setModal(null)} showToast={showToast} onDispatch={(r) => actions.addDispatchTask({ zone: r.zone, taskType: r.dispatchTaskType })} />`

- [ ] **Step 4: 移除所有已提取的 state/refs/handlers**

移除現在已移到子元件的：
- `scanZoneIdx`, `setScanZoneIdx` + 相關 useEffect
- `bellSchedule`, `setBellSchedule` + 相關 useEffect
- `broadcastZones`, `broadcastPressing`, `broadcastSent` + 相關 state/refs/handlers
- `cameraReady`, `cameraError`, `videoRef`, `cameraStreamRef`, `analyzeCanvasRef` + camera useEffects
- `visionResult`, `isAnalyzing`, `stableFramesRef`, `prevVisionSceneRef` + vision useEffect

保留：
- `modal`, `setModal` （控制哪個 modal 開啟）
- `aiEvents`, `setAiEvents` + 掃描事件 useEffect
- `heroSceneIdx` + cycling useEffect
- `isEmergency` + 其他全校狀態
- `editingSchedule`, `editTime`, `editArea` + schedule handlers

- [ ] **Step 5: 確認 TypeScript 通過**
```bash
cd "google ai studio/app_2（國小）/校園服務機器人 app" && npx tsc --noEmit 2>&1 | head -20
```

確認行數縮短：
```bash
wc -l "google ai studio/app_2（國小）/校園服務機器人 app/src/views/LifeView.tsx"
```
Expected: ≤ 280 行。

- [ ] **Step 6: Commit**
```bash
git add "google ai studio/app_2（國小）/校園服務機器人 app/src/views/LifeView.tsx"
git commit -m "refactor(life): LifeView down to ~220 lines using Card components"
```

---

## Task 12: Fix DashboardView — hardcoded URL + 使用 useCamera + useGeminiVision

**Files:**
- Modify: `src/views/DashboardView.tsx`

- [ ] **Step 1: 修 hardcoded localhost:3202**

找到：
```typescript
        const res = await fetch('http://localhost:3202/api/logs');
```
改為（先在頂端加 import）：
```typescript
import { BRIDGE_URL } from '../services/hardwareBridge';
// ...
        const res = await fetch(`${BRIDGE_URL}/api/logs`);
```

- [ ] **Step 2: 讀 DashboardView 的 camera/vision 區段**

讀 DashboardView.tsx line 100–200 確認現有的 visionVideoRef/visionCanvasRef 使用方式，確認 modal 名稱（'vision' 或其他）。

- [ ] **Step 3: 替換 camera/vision 為 hooks**

在 DashboardView 找到 camera vision modal state，替換為：
```typescript
import { useCamera } from '../hooks/useCamera';
import { useGeminiVision } from '../hooks/useGeminiVision';

// 在元件內：
const visionModalOpen = modal === 'vision'; // 調整為實際 modal 名稱
const { videoRef: visionVideoRef, canvasRef: visionCanvasRef, ready: visionReady, error: visionError } = useCamera(visionModalOpen);
const { result: visionResult, analyzing: visionAnalyzing } = useGeminiVision(
  visionModalOpen && visionReady, visionVideoRef, visionCanvasRef, 5000,
);
```

刪除 DashboardView 內手動的 camera stream 管理 useEffect 和 fetch-based vision 分析邏輯（已由 hooks 取代）。

- [ ] **Step 4: TypeScript check**
```bash
cd "google ai studio/app_2（國小）/校園服務機器人 app" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**
```bash
git add "google ai studio/app_2（國小）/校園服務機器人 app/src/views/DashboardView.tsx"
git commit -m "fix(dashboard): use BRIDGE_URL env var, refactor camera to useCamera+useGeminiVision"
```

---

## Task 13: Fix useHardwareSocket — connectDeadline ref leak

**Files:**
- Modify: `src/hooks/useHardwareSocket.ts`

- [ ] **Step 1: 將 connectDeadline 改為 ref**

在 `useHardwareSocket` 函數內，在現有的 ref 宣告後加：
```typescript
  const connectDeadlineRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

在 `connect()` 函數內，將：
```typescript
    const connectDeadline = setTimeout(() => {
      if (wsRef.current && wsRef.current.readyState !== WebSocket.OPEN) {
        startPolling();
      }
    }, 5000);
```
改為：
```typescript
    if (connectDeadlineRef.current) clearTimeout(connectDeadlineRef.current);
    connectDeadlineRef.current = setTimeout(() => {
      connectDeadlineRef.current = null;
      if (wsRef.current && wsRef.current.readyState !== WebSocket.OPEN) {
        startPolling();
      }
    }, 5000);
```

在 `ws.onopen` 內，將 `clearTimeout(connectDeadline)` 改為 `clearTimeout(connectDeadlineRef.current ?? undefined); connectDeadlineRef.current = null;`。

在 `ws.onclose` 內，同理改為 `clearTimeout(connectDeadlineRef.current ?? undefined); connectDeadlineRef.current = null;`。

在 cleanup（useEffect return）內加：
```typescript
      if (connectDeadlineRef.current !== null) {
        clearTimeout(connectDeadlineRef.current);
        connectDeadlineRef.current = null;
      }
```

- [ ] **Step 2: TypeScript check**
```bash
cd "google ai studio/app_2（國小）/校園服務機器人 app" && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**
```bash
git add "google ai studio/app_2（國小）/校園服務機器人 app/src/hooks/useHardwareSocket.ts"
git commit -m "fix(socket): move connectDeadline to ref so cleanup can clear it"
```

---

## Task 14: 最終驗證

- [ ] **Step 1: 完整 check 通過**
```bash
cd "google ai studio/app_2（國小）/校園服務機器人 app" && npm run check 2>&1 | tail -20
```
Expected: `npm run test` + `npm run lint` + `npm run build` 全部通過。

- [ ] **Step 2: 確認 LifeView 行數**
```bash
wc -l "google ai studio/app_2（國小）/校園服務機器人 app/src/views/LifeView.tsx"
```
Expected: ≤ 280 行。

- [ ] **Step 3: 確認無 critical bugs 殘留**
```bash
grep -n "AbortSignal\.timeout\|localhost:3202\|let _eventId" \
  "google ai studio/app_2（國小）/校園服務機器人 app/src/views/TeachView.tsx" \
  "google ai studio/app_2（國小）/校園服務機器人 app/src/views/DashboardView.tsx" \
  "google ai studio/app_2（國小）/校園服務機器人 app/src/views/LifeView.tsx" \
  "google ai studio/app_2（國小）/校園服務機器人 app/src/services/localVision.ts"
```
Expected: 無輸出（所有問題已修復）。

- [ ] **Step 4: 啟動 dev server 確認正常**
```bash
cd "google ai studio/app_2（國小）/校園服務機器人 app" && npm run dev &
sleep 5 && curl -s http://localhost:3202/api/ready | head -c 200
```
Expected: `{"ok":true,"arduino":false,"ai":true,"bridge_port":3202}` 或類似。

- [ ] **Step 5: Commit 最終 memory**

記錄此次升級要點到 memory 系統。

---

## 成功條件

1. `npm run check` 完整通過（tsc + test + build）
2. LifeView.tsx ≤ 280 行
3. `grep -rn "localhost:3202" src/` → 零結果
4. `grep -n "AbortSignal.timeout" src/views/TeachView.tsx` → 零結果
5. camera modal 關閉後，Chrome DevTools 的 camera indicator 消失
6. 生活頁派遣按鈕改為使用者主動觸發（不再 auto-dispatch）
