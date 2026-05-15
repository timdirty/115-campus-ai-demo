# App 1 Demo 可靠性加固設計

**日期**: 2026-05-15
**範圍**: `apps/app1-whiteboard/`
**目標**: 消除比賽現場 demo 流程的已知崩潰點，確保 AI 分析、OCR、機器人任務三條鏈路在不穩定網路與硬體環境下仍可靠運行。

---

## 問題清單

| ID | 位置 | 問題 | 風險等級 |
|----|------|------|----------|
| A | `server/aiService.ts` | `analyzeBoardWithAI` 等所有 Gemini 呼叫無 server-side timeout，網路不穩時 hang 無限久 | 致命 |
| B | `server/routes.ts` | `/api/robot/task` serial ACK timeout 後仍回 `{ok: true}`，機器人沒動 UI 卻說成功 | 致命 |
| C | `src/pages/Home.tsx` | async action 無 AbortController，網路切換後 busy state 永久鎖住 | 致命 |
| D | `src/pages/Home.tsx` | `captureAndAnalyze` 同時呼叫 `analyze-board`（含 OCR）+ 獨立 `ocr-local`，OCR 跑兩次 | 中 |
| E | `src/pages/Home.tsx` | `ssSet` catch 空白，sessionStorage QuotaExceededError 靜默吃掉，圖片在 iOS Safari 私密模式遺失 | 中 |

---

## 設計

### A：AI endpoint 超時保護（含真正 cancel）

**檔案**: `server/aiService.ts`

用 `AbortController` 真正中止 Gemini SDK 請求（SDK 支援 `abortSignal` 選項），而非只靠 `Promise.race`（race 後請求仍在後台跑浪費 quota）。

加一個 `makeAiCall` 工具：

```ts
function makeAiCall<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  ms = 20_000
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fn(controller.signal).finally(() => clearTimeout(timer));
}
```

各 function 的 `ai.models.generateContent` 改為傳入 signal：

```ts
const response = await makeAiCall((signal) =>
  ai.models.generateContent({ model, contents, config, abortSignal: signal })
);
```

超時後 SDK 拋 AbortError，由各 function 現有的 `catch` 攔截並落入 local fallback。

**四個 function 都要修**：`analyzeBoardWithAI`、`transcribeWithAI`、`chatWithAI`、`reviewWithAI`。

`ocrBridge.ts` 的 Gemini OCR 已有 `Promise.race` + 20s 保護，同樣改用 `abortSignal` 模式。

---

### B：機器人任務 ACK timeout 回報修正

**檔案**: `server/routes.ts`

`POST /api/robot/task` handler 裡，`sendSerialCommand` 回傳含 `timedOut` 欄位。修改判斷：

```ts
const result = await sendSerialCommand(command, requestedPath);
if (result.timedOut) {
  // 注意：命令已送出，只是 ACK 超時，不等於動作未執行（idempotency）
  const message = `命令已送出但機器人未回應確認 (${command})`;
  const status = await updateRobotStatus({ connected: false, activePort: result.port, lastCommand: command, lastResponse: message });
  const taskLog = await appendTaskLog({ command, source, ok: false, message });
  res.status(503).json({ ok: false, error: 'ack_timeout', message, action, regionId, command, status, taskLog });
  broadcast({ type: 'command_ack', command, ok: false });
  return;
}
// 原有成功路徑不動
```

前端 `src/services/classroomApi.ts` 的 robot task 呼叫已有 `ok` 欄位判斷，不需額外修改（API 回 503 會進 catch）。

---

### C：前端 AbortController — in-flight 請求中止

**檔案**: `src/pages/Home.tsx`

新增一個 module-level ref 管理當前 action 的 abort controller：

```ts
const abortRef = useRef<AbortController | null>(null);

function beginAction(busyKey: string) {
  abortRef.current?.abort();
  abortRef.current = new AbortController();
  setBusy(busyKey);
  return abortRef.current.signal;
}

function endAction() {
  abortRef.current = null;
  setBusy('');
}
```

`captureAndAnalyze`、`handleImageUpload`、`runDemoSample` 三個 action 改用 `beginAction` 取得 signal，並在 finally 呼叫 `endAction`。

`src/services/classroomApi.ts` 所有 `fetch` 函式加可選 `signal?: AbortSignal` 參數並傳入。

AbortError 在 catch 中靜默忽略（不顯示錯誤通知、不更新 `notice` state），只呼叫 `endAction()` 重置 busy state。其他錯誤路徑照舊。

---

### D：移除重複 OCR

**檔案**: `src/pages/Home.tsx`

`captureAndAnalyze` 現況：

```ts
const [result, ocr] = await Promise.all([
  analyzeBoardCapture({...}),  // server 已含 OCR
  runOcr(imageBase64),         // 重複！
]);
```

修改後：server `analyze-board` 回傳的 `result.noteDraft.ocrText` 即為 OCR 結果，直接用於更新 `ocrResult` state：

```ts
const result = await analyzeBoardCapture({...});
// 用 server 回傳的 ocrText 更新 OCR panel
const serverOcrText = result.noteDraft?.ocrText?.trim() ?? '';
if (serverOcrText) {
  setOcrResult({
    ok: true,
    text: serverOcrText,
    blocks: [],
    engine: 'server-embedded',
  });
}
```

`handleImageUpload` 同樣修改。`runOcr` function 本身保留，供未來手動按鈕使用。

---

### E：sessionStorage Quota Guard

**檔案**: `src/pages/Home.tsx`

`ssGet` / `ssSet` 改用 in-memory fallback：

```ts
const SS_PREFIX = 'app1:home:';
const memFallback = new Map<string, unknown>();

function ssGet<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(SS_PREFIX + key);
    if (raw !== null) return JSON.parse(raw) as T;
  } catch {}
  const mem = memFallback.get(key);
  return mem !== undefined ? (mem as T) : fallback;
}

function ssSet(key: string, value: unknown): void {
  if (value === null || value === undefined || value === '') {
    try { sessionStorage.removeItem(SS_PREFIX + key); } catch {}
    memFallback.delete(key);
    return;
  }
  try {
    sessionStorage.setItem(SS_PREFIX + key, JSON.stringify(value));
    memFallback.delete(key); // sessionStorage 成功就清 mem
  } catch {
    memFallback.set(key, value); // QuotaExceeded → fallback
  }
}
```

---

## 實作範圍

| 檔案 | 修改性質 |
|------|----------|
| `server/aiService.ts` | 加 `withTimeout`，修 4 個 function |
| `server/routes.ts` | 修 robot/task timedOut 判斷 |
| `src/pages/Home.tsx` | 加 AbortController ref、移除重複 OCR、修 ssGet/ssSet |
| `src/services/classroomApi.ts` | 所有 fetch 加可選 `signal` 參數 |

**不修改**：`ocrBridge.ts`（已有 timeout）、`serialBridge.ts`、其他 pages。

---

## 成功標準

- Gemini 網路不穩時，`analyze-board` 最多 20s 後回傳 local fallback，不 hang
- Arduino 沒接時，robot/task 回 `{ok: false, error: 'ack_timeout'}`，UI 顯示失敗
- Demo 途中網路切換，busy state 在 5s 內自動重置
- `captureAndAnalyze` 只觸發一次 OCR（server-side）
- iOS Safari 私密模式下，previewImage 存在 memory fallback，功能正常
