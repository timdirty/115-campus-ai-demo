# App 1 Demo 可靠性加固 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修復 App 1 demo 流程的 5 個已知可靠性漏洞，讓 Gemini 超時、Arduino 無回應、網路切換、重複 OCR、iOS sessionStorage 失效等情境下系統仍可靠運作。

**Architecture:** Server-side 用 `withAiTimeout` 包住所有 Gemini 呼叫（20s 超時自動 fallback）；routes.ts 修正 robot/task timedOut 誤報；前端 Home.tsx 加 AbortController generation counter 管理 in-flight 請求、移除重複 OCR call、加 sessionStorage memory fallback。

**Tech Stack:** TypeScript 5.8, Express 4, React 19, `@google/genai` ^1.29, tsx, Vite 6

---

## File Map

| 檔案 | 修改性質 |
|------|----------|
| `apps/app1-whiteboard/server/aiService.ts` | 新增 `withAiTimeout`；5 個 `generateContent` 呼叫加包裝 |
| `apps/app1-whiteboard/server/routes.ts` | `/api/robot/task` handler 加 timedOut 早返回 |
| `apps/app1-whiteboard/src/services/classroomApi.ts` | `analyzeBoardCapture`、`transcribeAudio` 加 `signal?` 參數 |
| `apps/app1-whiteboard/src/pages/Home.tsx` | AbortController generation counter；移除 `runOcr`/`mergeOcrIntoAnalysis`；修 `ssGet`/`ssSet` |

---

## Task 1: Server — AI 超時保護（aiService.ts）

**Files:**
- Modify: `apps/app1-whiteboard/server/aiService.ts`

- [ ] **Step 1: 在 `normalizePercent` function 之後插入 `withAiTimeout`**

在第 27 行 `function normalizePercent` 結尾後，`function normalizeRegionId` 之前，插入：

```ts
function withAiTimeout<T>(promise: Promise<T>, ms = 20_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`AI call timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer!));
}
```

- [ ] **Step 2: 包住 `analyzeBoardWithAI` 的 Gemini 呼叫**

找到（約第 255 行）：
```ts
    const response = await ai.models.generateContent({
      model: geminiVisionModel,
      contents: [{role: 'user', parts: [{text: prompt}, createPartFromBase64(media.data, media.mimeType)]}],
      config: {temperature: 0.35},
    });
```

改為：
```ts
    const response = await withAiTimeout(ai.models.generateContent({
      model: geminiVisionModel,
      contents: [{role: 'user', parts: [{text: prompt}, createPartFromBase64(media.data, media.mimeType)]}],
      config: {temperature: 0.35},
    }));
```

- [ ] **Step 3: 包住 `transcribeWithAI` 的 Gemini 呼叫**

找到（約第 297 行）：
```ts
    const response = await ai.models.generateContent({
      model: geminiVisionModel,
      contents: [{
        role: 'user',
        parts: [
          {text: '請將這段國小課堂錄音整理成繁體中文逐字稿，保留老師講解重點、孩子可能卡住的地方，以及可直接拿來做學習單的句子。'},
          createPartFromBase64(media.data, media.mimeType),
        ],
      }],
      config: {temperature: 0.2},
    });
```

改為：
```ts
    const response = await withAiTimeout(ai.models.generateContent({
      model: geminiVisionModel,
      contents: [{
        role: 'user',
        parts: [
          {text: '請將這段國小課堂錄音整理成繁體中文逐字稿，保留老師講解重點、孩子可能卡住的地方，以及可直接拿來做學習單的句子。'},
          createPartFromBase64(media.data, media.mimeType),
        ],
      }],
      config: {temperature: 0.2},
    }));
```

- [ ] **Step 4: 包住 `chatWithAI` 的 Gemini 呼叫**

找到（約第 329 行）：
```ts
    const response = await ai.models.generateContent({
      model: geminiModel,
      contents: [
        ...history.slice(-8).map((item) => ({
          role: item.role === 'ai' ? 'model' : 'user',
          parts: [{text: item.text}],
        })),
        {
          role: 'user',
          parts: [{text: `請根據以下課堂紀錄本內容回答。使用繁體中文，語氣像國小課堂小老師，句子短，提供老師能直接使用的說法、活動或小檢核；避免高中以上術語。\n\n${notesContext}\n\n問題：${message}`}],
        },
      ],
      config: {temperature: 0.55},
    });
```

改為：
```ts
    const response = await withAiTimeout(ai.models.generateContent({
      model: geminiModel,
      contents: [
        ...history.slice(-8).map((item) => ({
          role: item.role === 'ai' ? 'model' : 'user',
          parts: [{text: item.text}],
        })),
        {
          role: 'user',
          parts: [{text: `請根據以下課堂紀錄本內容回答。使用繁體中文，語氣像國小課堂小老師，句子短，提供老師能直接使用的說法、活動或小檢核；避免高中以上術語。\n\n${notesContext}\n\n問題：${message}`}],
        },
      ],
      config: {temperature: 0.55},
    }));
```

- [ ] **Step 5: 包住 `reviewWithAI` 的兩個 Gemini 呼叫**

第一個（summary mode，約第 359 行）：
```ts
      const response = await ai.models.generateContent({
        model: geminiModel,
        contents: `請將以下白板紀錄整理成國小生可讀的繁體中文 Markdown 學習單。句子短、步驟清楚，包含「今天我學到」、「畫一畫或說一說」、「小檢核」、「老師提醒」。\n\n${note.content}\n\n白板文字:${note.ocrText ?? ''}\n逐字稿:${note.transcript ?? ''}`,
        config: {temperature: 0.35},
      });
```

改為：
```ts
      const response = await withAiTimeout(ai.models.generateContent({
        model: geminiModel,
        contents: `請將以下白板紀錄整理成國小生可讀的繁體中文 Markdown 學習單。句子短、步驟清楚，包含「今天我學到」、「畫一畫或說一說」、「小檢核」、「老師提醒」。\n\n${note.content}\n\n白板文字:${note.ocrText ?? ''}\n逐字稿:${note.transcript ?? ''}`,
        config: {temperature: 0.35},
      }));
```

第二個（quiz mode，約第 367 行）：
```ts
    const response = await ai.models.generateContent({
      model: geminiModel,
      contents: `請根據以下白板紀錄產生 5 題適合國小生的繁體中文單選題。題幹要短，一題只測一個概念，解析要像老師鼓勵孩子的說明。題目必須優先引用「白板文字」中的實際內容。只輸出 JSON array，每題格式 {"q":"題目","options":["A","B","C","D"],"ans":0,"explanation":"解析"}。\n\n白板文字:${note.ocrText ?? ''}\n逐字稿:${note.transcript ?? ''}\n課堂紀錄:${note.content}`,
      config: {temperature: 0.35},
    });
```

改為：
```ts
    const response = await withAiTimeout(ai.models.generateContent({
      model: geminiModel,
      contents: `請根據以下白板紀錄產生 5 題適合國小生的繁體中文單選題。題幹要短，一題只測一個概念，解析要像老師鼓勵孩子的說明。題目必須優先引用「白板文字」中的實際內容。只輸出 JSON array，每題格式 {"q":"題目","options":["A","B","C","D"],"ans":0,"explanation":"解析"}。\n\n白板文字:${note.ocrText ?? ''}\n逐字稿:${note.transcript ?? ''}\n課堂紀錄:${note.content}`,
      config: {temperature: 0.35},
    }));
```

- [ ] **Step 6: TypeScript 型別檢查**

```bash
cd "/Volumes/Tim aaddtional/Download/115資通訊/tedt/apps/app1-whiteboard" && npm run lint
```
預期：0 errors

- [ ] **Step 7: Commit**

```bash
git add apps/app1-whiteboard/server/aiService.ts
git commit -m "fix(app1): add 20s timeout to all Gemini AI calls, fallback to local on timeout"
```

---

## Task 2: Server — Robot Task ACK Timeout 修正（robotService.ts + routes.ts）

**Files:**
- Modify: `apps/app1-whiteboard/server/robotService.ts`
- Modify: `apps/app1-whiteboard/server/routes.ts`

背景：`sendSerialCommand` 的模擬路徑回傳 `{port, response}`（無 `timedOut`），真實路徑回傳 `{port, response, timedOut}`。TypeScript 推導為 union，導致 routes.ts 直接存取 `result.timedOut` 會 type error（這就是 erase-sequence endpoint 用 `(result as any).timedOut` 的原因）。需先修正回傳型別。

- [ ] **Step 1: 給 `sendSerialCommand` 加明確回傳型別**

找到 `robotService.ts`（約第 154 行）：
```ts
export async function sendSerialCommand(command: string, requestedPath?: string) {
```

改為：
```ts
export async function sendSerialCommand(command: string, requestedPath?: string): Promise<{port: string; response: string; timedOut?: boolean}> {
```

`timedOut?` 為 optional（`undefined` 等同 `false`），涵蓋模擬路徑無此欄位的情況。

- [ ] **Step 2: 找到 `/api/robot/task` handler 並加入 timedOut 早返回**

找到（約第 556 行）這個模式：
```ts
      const result = await sendSerialCommand(command, requestedPath);
      const message = result.response || `Sent ${command} to ${result.port}`;
```

在這兩行之間插入：
```ts
      if (result.timedOut) {
        const timeoutMsg = `命令已送出但機器人未回應確認 (${command})`;
        const status = await updateRobotStatus({
          connected: false,
          activePort: result.port,
          lastCommand: command,
          lastResponse: timeoutMsg,
        });
        const taskLog = await appendTaskLog({command, source, ok: false, message: timeoutMsg});
        res.status(503).json({ok: false, error: 'ack_timeout', message: timeoutMsg, action, regionId, command, status, taskLog});
        broadcast({type: 'command_ack', command, ok: false});
        return;
      }
```

完整插入後：
```ts
      const result = await sendSerialCommand(command, requestedPath);
      if (result.timedOut) {
        const timeoutMsg = `命令已送出但機器人未回應確認 (${command})`;
        const status = await updateRobotStatus({
          connected: false,
          activePort: result.port,
          lastCommand: command,
          lastResponse: timeoutMsg,
        });
        const taskLog = await appendTaskLog({command, source, ok: false, message: timeoutMsg});
        res.status(503).json({ok: false, error: 'ack_timeout', message: timeoutMsg, action, regionId, command, status, taskLog});
        broadcast({type: 'command_ack', command, ok: false});
        return;
      }
      const message = result.response || `Sent ${command} to ${result.port}`;
```

- [ ] **Step 3: TypeScript 型別檢查**

```bash
cd "/Volumes/Tim aaddtional/Download/115資通訊/tedt/apps/app1-whiteboard" && npm run lint
```
預期：0 errors（`result.timedOut` 現在型別合法）

- [ ] **Step 4: Commit**

```bash
git add apps/app1-whiteboard/server/robotService.ts apps/app1-whiteboard/server/routes.ts
git commit -m "fix(app1): type sendSerialCommand return, report robot task ACK timeout as ok:false"
```

---

## Task 3: Client — classroomApi AbortSignal 傳遞

**Files:**
- Modify: `apps/app1-whiteboard/src/services/classroomApi.ts`

注意：`src/services/apiClient.ts` 的 `apiRequest` 已原生支援 `signal?: AbortSignal`（繼承自 `RequestInit`，並有 abort forward 邏輯），不需修改 apiClient.ts。

- [ ] **Step 1: `analyzeBoardCapture` 加 `signal` 參數**

找到（約第 709 行）：
```ts
export async function analyzeBoardCapture(input: {imageBase64: string; transcript?: string; subjectHint?: string; boardCalibration?: BoardCalibration}): Promise<BoardAnalysisResponse> {
  try {
    return await apiRequest<BoardAnalysisResponse>('/api/ai/analyze-board', {
      method: 'POST',
      body: JSON.stringify(input),
      timeoutMs: 30000,
    });
```

改為：
```ts
export async function analyzeBoardCapture(input: {imageBase64: string; transcript?: string; subjectHint?: string; boardCalibration?: BoardCalibration}, signal?: AbortSignal): Promise<BoardAnalysisResponse> {
  try {
    return await apiRequest<BoardAnalysisResponse>('/api/ai/analyze-board', {
      method: 'POST',
      body: JSON.stringify(input),
      timeoutMs: 30000,
      signal,
    });
```

- [ ] **Step 2: `transcribeAudio` 加 `signal` 參數**

找到（約第 796 行）：
```ts
export async function transcribeAudio(input: {audioBase64: string; mimeType: string}): Promise<{transcript: string; aiMode: 'gemini' | 'local-fallback'}> {
  try {
    return await apiRequest<{transcript: string; aiMode: 'gemini' | 'local-fallback'}>('/api/ai/transcribe', {
      method: 'POST',
      body: JSON.stringify(input),
      timeoutMs: 30000,
    });
```

改為：
```ts
export async function transcribeAudio(input: {audioBase64: string; mimeType: string}, signal?: AbortSignal): Promise<{transcript: string; aiMode: 'gemini' | 'local-fallback'}> {
  try {
    return await apiRequest<{transcript: string; aiMode: 'gemini' | 'local-fallback'}>('/api/ai/transcribe', {
      method: 'POST',
      body: JSON.stringify(input),
      timeoutMs: 30000,
      signal,
    });
```

- [ ] **Step 3: TypeScript 型別檢查**

```bash
cd "/Volumes/Tim aaddtional/Download/115資通訊/tedt/apps/app1-whiteboard" && npm run lint
```
預期：0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/app1-whiteboard/src/services/classroomApi.ts
git commit -m "feat(app1): add optional AbortSignal to analyzeBoardCapture and transcribeAudio"
```

---

## Task 4: Client — Home.tsx AbortController + 移除重複 OCR

**Files:**
- Modify: `apps/app1-whiteboard/src/pages/Home.tsx`

### 4a: React import 更新

- [ ] **Step 1: 在第 1 行加入 `useRef`**

找到：
```ts
import {useEffect, useState} from 'react';
```

改為：
```ts
import {useEffect, useRef, useState} from 'react';
```

### 4b: ssGet/ssSet 上方加入 abort helpers

- [ ] **Step 2: 在 `const SS_PREFIX` 之前加入 abort state 宣告**

在第 15 行 `const SS_PREFIX = 'app1:home:';` 之前插入：

```ts
let _abortController: AbortController | null = null;
let _actionGeneration = 0;
```

> 注意：這兩個變數放在 module scope（function 外），避免 React re-render 重置。

### 4c: component 內加入 helpers

- [ ] **Step 3: 在 `const [busy, setBusy] = useState('')` 之後加入 action helpers**

找到（約第 74 行）：
```ts
  const [busy, setBusy] = useState('');
```

在其正下方插入：
```ts
  const beginAction = (busyKey: string): {signal: AbortSignal; gen: number} => {
    _abortController?.abort();
    const controller = new AbortController();
    _abortController = controller;
    const gen = ++_actionGeneration;
    setBusy(busyKey);
    return {signal: controller.signal, gen};
  };

  const endAction = (gen: number) => {
    if (_actionGeneration === gen) {
      _abortController = null;
      setBusy('');
    }
  };
```

### 4d: 移除 `runOcr` 和 `mergeOcrIntoAnalysis`

- [ ] **Step 4: 刪除 `runOcr` function（約第 131-137 行）**

找到並刪除整個 function：
```ts
  const runOcr = async (imageBase64: string) => {
    setOcrBusy(true);
    const r = await ocrBoardLocal(imageBase64);
    setOcrResult(r);
    setOcrBusy(false);
    return r;
  };
```

- [ ] **Step 5: 刪除 `mergeOcrIntoAnalysis` function（約第 310-334 行）**

找到並刪除整個 function：
```ts
  const mergeOcrIntoAnalysis = (result: BoardAnalysisResponse, ocr: OcrLocalResult): BoardAnalysisResponse => {
    const text = ocr.ok && ocr.text.trim() ? ocr.text.trim() : '';
    if (!text) return result;
    const content = result.noteDraft.content.includes(text)
      ? result.noteDraft.content
      : [
        result.noteDraft.content,
        '',
        '白板實際辨識文字：',
        text,
      ].join('\n');
    return {
      ...result,
      noteDraft: {
        ...result.noteDraft,
        ocrText: text,
        content,
        keywords: [...new Set([...(result.noteDraft.keywords ?? []), '白板OCR', ...text.split(/\s+/).slice(0, 6)])],
      },
      session: {
        ...result.session,
        boardOcrText: text,
      },
    };
  };
```

### 4e: 更新 `captureAndAnalyze`

- [ ] **Step 6: 以新版本取代 `captureAndAnalyze`**

找到整個 `captureAndAnalyze` function（約第 139-172 行）並完整替換：

```ts
  const captureAndAnalyze = async () => {
    const {signal, gen} = beginAction('analyze');
    try {
      const imageBase64 = media.captureFrame();
      setPreviewImage(imageBase64);
      setOcrResult(null);
      setOcrBusy(true);
      const result = await analyzeBoardCapture({imageBase64, transcript, subjectHint, boardCalibration}, signal);
      const serverOcrText = result.noteDraft?.ocrText?.trim() ?? '';
      if (serverOcrText) {
        setOcrResult({ok: true, text: serverOcrText, blocks: [], engine: 'server-embedded'});
      }
      setAnalysis(result);
      const mergedSession = {
        ...result.session,
        boardOcrText: serverOcrText || result.session.boardOcrText,
        hardwareProfile: {
          ...result.session.hardwareProfile,
          boardCalibration,
          boardCalibrationMode: calibrationMode,
          boardDetectionConfidence: detectionConfidence,
          cameraMounted: media.cameraReady || result.session.hardwareProfile.cameraMounted,
        },
      };
      setClassroom(mergedSession);
      saveDemoProgress({whiteboard: true});
      setNotice('白板整理完成，下一步請確認哪一區可以擦');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setPreviewImage('');
      setNotice(error instanceof Error ? error.message : '白板分析失敗');
    } finally {
      setOcrBusy(false);
      endAction(gen);
    }
  };
```

### 4f: 更新 `handleImageUpload`

- [ ] **Step 7: 以新版本取代 `handleImageUpload`**

找到整個 `handleImageUpload` function（約第 174-214 行）並完整替換：

```ts
  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setNotice('請選擇圖片檔案（JPEG、PNG 等）');
      return;
    }
    const {signal, gen} = beginAction('analyze');
    try {
      const reader = new FileReader();
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('圖片讀取失敗'));
        reader.readAsDataURL(file);
      });
      setPreviewImage(imageBase64);
      setOcrResult(null);
      setOcrBusy(true);
      const result = await analyzeBoardCapture({imageBase64, transcript, subjectHint, boardCalibration}, signal);
      const serverOcrText = result.noteDraft?.ocrText?.trim() ?? '';
      if (serverOcrText) {
        setOcrResult({ok: true, text: serverOcrText, blocks: [], engine: 'server-embedded'});
      }
      setAnalysis(result);
      const mergedSession = {
        ...result.session,
        boardOcrText: serverOcrText || result.session.boardOcrText,
        hardwareProfile: {
          ...result.session.hardwareProfile,
          boardCalibration,
          boardCalibrationMode: calibrationMode,
          boardDetectionConfidence: detectionConfidence,
        },
      };
      setClassroom(mergedSession);
      saveDemoProgress({whiteboard: true});
      setNotice('白板整理完成，下一步請確認哪一區可以擦');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setPreviewImage('');
      setNotice(error instanceof Error ? error.message : '圖片上傳分析失敗');
    } finally {
      setOcrBusy(false);
      endAction(gen);
    }
  };
```

### 4g: 清理 import

- [ ] **Step 8: 從 classroomApi import 中移除 `ocrBoardLocal`**

找到（約第 9 行）：
```ts
import {analyzeBoardCapture, analyzeBoardDemoSample, BoardAnalysisResponse, BoardRegion, ocrBoardLocal, OcrLocalResult, saveClassroomSession, transcribeAudio} from '../services/classroomApi';
```

改為：
```ts
import {analyzeBoardCapture, analyzeBoardDemoSample, BoardAnalysisResponse, BoardRegion, OcrLocalResult, saveClassroomSession, transcribeAudio} from '../services/classroomApi';
```

### 4h: 驗證

- [ ] **Step 9: TypeScript 型別檢查**

```bash
cd "/Volumes/Tim aaddtional/Download/115資通訊/tedt/apps/app1-whiteboard" && npm run lint
```
預期：0 errors（確認無殘留 `runOcr`、`mergeOcrIntoAnalysis`、`ocrBoardLocal` 引用）

- [ ] **Step 10: Commit**

```bash
git add apps/app1-whiteboard/src/pages/Home.tsx
git commit -m "fix(app1): add AbortController to board capture, remove duplicate client-side OCR call"
```

---

## Task 5: Client — sessionStorage Memory Fallback（Home.tsx）

**Files:**
- Modify: `apps/app1-whiteboard/src/pages/Home.tsx`

- [ ] **Step 1: 用 memory fallback 版本取代 `ssGet`/`ssSet`**

找到（約第 15-37 行）這整段：
```ts
const SS_PREFIX = 'app1:home:';

function ssGet<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(SS_PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function ssSet(key: string, value: unknown): void {
  try {
    if (value === null || value === undefined || value === '') {
      sessionStorage.removeItem(SS_PREFIX + key);
    } else {
      sessionStorage.setItem(SS_PREFIX + key, JSON.stringify(value));
    }
  } catch {
    // quota exceeded — silently ignore
  }
}
```

完整替換為：
```ts
const SS_PREFIX = 'app1:home:';
const _ssMem = new Map<string, unknown>();

function ssGet<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(SS_PREFIX + key);
    if (raw !== null) return JSON.parse(raw) as T;
  } catch {}
  const mem = _ssMem.get(key);
  return mem !== undefined ? (mem as T) : fallback;
}

function ssSet(key: string, value: unknown): void {
  if (value === null || value === undefined || value === '') {
    try { sessionStorage.removeItem(SS_PREFIX + key); } catch {}
    _ssMem.delete(key);
    return;
  }
  try {
    sessionStorage.setItem(SS_PREFIX + key, JSON.stringify(value));
    _ssMem.delete(key);
  } catch {
    _ssMem.set(key, value);
  }
}
```

- [ ] **Step 2: TypeScript 型別檢查**

```bash
cd "/Volumes/Tim aaddtional/Download/115資通訊/tedt/apps/app1-whiteboard" && npm run lint
```
預期：0 errors

- [ ] **Step 3: Full check suite**

```bash
cd "/Volumes/Tim aaddtional/Download/115資通訊/tedt/apps/app1-whiteboard" && npm run check
```
預期：全部 pass（tsc + unit tests + build + api-contract test）

- [ ] **Step 4: Commit**

```bash
git add apps/app1-whiteboard/src/pages/Home.tsx
git commit -m "fix(app1): add in-memory fallback for sessionStorage quota failures on iOS Safari"
```

---

## 驗收清單

完成所有 task 後，人工確認以下場景：

1. **AI 超時**：切斷網路後點「拍攝白板」，應在 20s 內看到 local fallback 結果（非無限等待）
2. **機器人 ACK timeout**：拔除 Arduino 後發送 ERASE 任務，應看到「命令已送出但機器人未回應確認」而非「成功」
3. **重複點擊**：快速連點「拍攝白板」兩次，busy state 應正常重置不卡住
4. **OCR panel**：拍照後 OCR 文字應從 server response 直接顯示，不再有第二次 OCR 呼叫
5. **iOS 私密模式**：sessionStorage 故障時 previewImage 應保留在 memory，不影響功能
