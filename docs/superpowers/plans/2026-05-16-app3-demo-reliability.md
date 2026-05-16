# App3 Demo Reliability + Closure 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠️ Plan revisions (post-dual-review)**:
> - `abortSignal` 是 **`GenerateContentConfig` 的 field**（不是 top-level）— SDK 型別已驗 `apps/app3-guardian/node_modules/@google/genai/dist/genai.d.ts:4423-4432`。所有 generateContent 包裝都是 `config: {...原 config, abortSignal: signal}`。
> - Task 1 `analyzeGuardianAlert` 既有 hardcode `'gemini-2.0-flash'` (line 51 周邊) — **保留 model 不要改成 visionModel**，這不是 mechanical wrap。
> - Task 4 useActionAbort 加 token guard。`askGemini` (geminiAi.ts) + `composeChatReply` (localGuardianAi.ts) 都要接 `signal?: AbortSignal`。
> - Task 8 `GuardianState` interface 在 **`src/types.ts:125`**，不是 `guardianState.ts`。`demoClosureFlags` 型別加到 types.ts。
> - Task 8 reducer cases **使用實際 action name**（已 grep 驗）：
>   - signalFused: `RECORD_ACOUSTIC_SIGNAL`, `ADD_MOOD`
>   - alertCreated: `CREATE_ACOUSTIC_ALERT`, `CREATE_PROACTIVE_ALERT`, `CREATE_CONTEXT_ALERT`
>   - robotDispatched: `DISPATCH_ROBOT`
>   - studentSupported: `ADD_SUPPORT_MESSAGE`, `ADD_FOREST_POST`, `DEPLOY_INTERVENTION`
>   - closed: `UPDATE_ALERT_STATUS` (status='resolved'), `COMPLETE_CARE_LOOP`

**Goal:** 把 app3-guardian 拉到 app1 demo 穩定度水準：AI timeout (含 abortSignal 正確位置) / 新增缺失的 `/api/ai/guardian-chat` endpoint (真實 bug fix) / robot ACK polish / per-handler abort / state Map fallback / demo:check / 5-段閉環 explicit flag / 現場災難 fail-safe / robot-app build 驗證。

**Architecture:** Server-side 加 `withAiTimeout` 包 2 個 generateContent + 新增 `generateGuardianChatReply` + `/api/ai/guardian-chat` endpoint。前端 `App.tsx` 用 per-handler `useActionAbort` (5 個 handler 各自) + `GuardianControlPanel` 自帶不依賴 App.tsx。`guardianState.ts` 加 `_memoryFallback` + `demoClosureFlags` 補強閉環判斷。

**Tech Stack:** TypeScript 5.8, React 19, Express 4, `@google/genai` ^1.50, tsx, Vite 6, motion, qrcode, firebase ^12 (optional)

**Spec reference:** [docs/superpowers/specs/2026-05-16-app3-demo-reliability-design.md](../specs/2026-05-16-app3-demo-reliability-design.md)

---

## File Map

| 檔案 | 修改性質 |
|------|----------|
| `apps/app3-guardian/server/aiService.ts` | 加 `withAiTimeout` + `generateGuardianChatReply` + 包 2 callsite |
| `apps/app3-guardian/server/serialBridge.ts` | 加 `/api/ai/guardian-chat` route |
| `apps/app3-guardian/server/serialPort.ts` | sendCommand 加 1s write timeout + 友善 error message |
| `apps/app3-guardian/src/hooks/useActionAbort.ts` | **新建**：per-handler hook（同 app2 介面，重複實作避免循環） |
| `apps/app3-guardian/src/hooks/useWakeLock.ts` | **新建**：同 app2 |
| `apps/app3-guardian/src/App.tsx` | 5 個 handler 各自 useActionAbort + wakeLock + swipe-back + 離線 banner + 投影 chip + reset 廣播 + closure explicit flag wire |
| `apps/app3-guardian/src/components/GuardianControlPanel.tsx` | 自己的 useActionAbort（不從 App.tsx import） |
| `apps/app3-guardian/src/state/guardianState.ts` | `_memoryFallback` Map + `demoClosureFlags` field + reducer actions |
| `apps/app3-guardian/src/services/localGuardianAi.ts` | 確認 `/api/ai/guardian-chat` 呼叫 path（已有，server 新增 endpoint 接） |
| `apps/app3-guardian/scripts/demo-readiness-check.mjs` | **新建** |
| `apps/app3-guardian/server/api-contract.test.mjs` | **新建** (SHOULD) |
| `apps/app3-guardian/一鍵啟動展示.command` | 既有，audit + 強化 port kill / 訊息 |
| `apps/app3-guardian/一鍵停止展示.command` | 新建或既有確認 |
| `apps/app3-guardian/docs/DEMO_SOAK_CHECKLIST.md` | **新建** (SHOULD) |
| `apps/app3-guardian/server/defaults.ts` | **新建** (NICE) |
| `apps/app3-guardian/server/hardwareSimulation.test.ts` | **新建** (NICE) |
| `apps/app3-guardian/src/lib/firebase.ts` | try/catch guard (NICE) |
| `apps/app3-guardian/src/services/directGemini.ts` | **新建** (NICE 條件式) |
| `apps/app3-guardian/server/wsBroadcast.ts` + `routes/*` | **新建** (NICE 條件式 — 901 行拆檔) |
| `apps/app3-guardian/package.json` | 加 demo:check + 更新 check |

---

## Phase MUST — Demo 不能崩

### Task 0: 凍結 WIP baseline + robot-app build 驗證（10 min）

**Files:**
- Stage: 7 個 M 檔案

- [ ] **Step 1: 確認 main app WIP 綠燈**

```bash
cd apps/app3-guardian && npm run check
```

預期：lint + 4 個 test + build 全綠（已驗）。

- [ ] **Step 2: 確認 robot-app 子專案 WIP 沒破**

```bash
cd apps/app3-guardian/robot-app && npm run build
```

預期：build 綠。WIP 改了 `LLMEmotion.py`，但 robot-app 是 React app，Python 不影響 build。

- [ ] **Step 3: Stage + commit baseline**

```bash
cd "/Volumes/Tim aaddtional/Download/115資通訊/tedt"
git add apps/app3-guardian/server/aiService.ts apps/app3-guardian/server/serialBridge.ts
git add apps/app3-guardian/src/App.tsx apps/app3-guardian/src/components/GuardianControlPanel.tsx
git add apps/app3-guardian/src/services/hardwareBridge.ts
git add apps/app3-guardian/robot-app/LLMEmotion.py
git add "apps/app3-guardian/一鍵啟動展示.command"

git commit -m "$(cat <<'EOF'
feat(app3): finish WIP — EmotionAnalysis pipeline, hardwareBridge polish

- Add EmotionAnalysis interface + analyzeEmotionFromImage (server, 114 lines)
- Add JSON parsing helpers (stripDataUrl, parseJsonLoose, clampInt)
- Polish hardwareBridge retry/fallback (59 lines)
- Tune GuardianControlPanel (40 lines)
- Update robot-app LLMEmotion.py prompt
- Refine 一鍵啟動展示.command

Status: lint + 4 client tests green (incl. 500-round pixel validation).
robot-app build green. Reliability hardening to follow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 1: `withAiTimeout` + 2 個 generateContent 包裝（30 min）

**Files:**
- Modify: `apps/app3-guardian/server/aiService.ts`

- [ ] **Step 1: 讀 aiService.ts 結構**

```bash
sed -n '1,70p' apps/app3-guardian/server/aiService.ts
```

確認 `isGeminiConfigured`、`analyzeGuardianAlert`（line 51）、`analyzeEmotionFromImage`（line 139）位置。

- [ ] **Step 2: 加 textModel + withAiTimeout helper**

在 `visionModel` 宣告下加 `textModel`（要給後面 guardian-chat 用）：
```ts
const textModel = process.env.GEMINI_TEXT_MODEL?.trim() || process.env.GEMINI_MODEL?.trim() || visionModel;
```

在 `isGeminiConfigured` 之前加：
```ts
function withAiTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  ms = 20_000
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`AI call timed out after ${ms}ms`)), ms);
  return fn(controller.signal).finally(() => clearTimeout(timer));
}
```

- [ ] **Step 3: 包裝 line 51 (`analyzeGuardianAlert`) — 保留 model**

既有 hardcode `model: 'gemini-2.0-flash'`，**保留不改**。只加 withAiTimeout + abortSignal 在 config：

```ts
const response = await withAiTimeout((signal) =>
  ai.models.generateContent({
    model: 'gemini-2.0-flash',  // 既有 hardcode，保留
    contents: [{role: 'user', parts: [{text: prompt}]}],
    config: {abortSignal: signal},  // 既有沒 config，新加
  })
);
```

- [ ] **Step 4: 包裝 line 139 (`analyzeEmotionFromImage`)**

WIP 既有 controller + 30s setTimeout（line 135 周邊）。整段重構為用 `withAiTimeout`：

刪除：
```ts
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 30_000);
```

把 generateContent 包成（`abortSignal` 在 `config` 內）：
```ts
const response = await withAiTimeout((signal) =>
  ai.models.generateContent({
    model: visionModel,
    contents: [...],
    config: {
      temperature: 0.4,
      abortSignal: signal,  // 在 config 內，與 temperature 平級
    },
  }), 30_000  // emotion 用 30s
);
```

移除原 finally clearTimeout（已被 withAiTimeout 內部處理）。

- [ ] **Step 5: lint 驗證**

```bash
cd apps/app3-guardian && npm run lint
```

預期：0 errors。

- [ ] **Step 6: Commit**

```bash
git add apps/app3-guardian/server/aiService.ts
git commit -m "fix(app3): wrap 2 Gemini generateContent with withAiTimeout AbortController (top-level abortSignal)"
```

---

### Task 2: 新增 `/api/ai/guardian-chat` endpoint（25 min — 真實 bug fix）

**Bug**: `src/services/localGuardianAi.ts:128` 呼叫 `askGemini('/api/ai/guardian-chat', ...)`，但 server 沒實作此 endpoint → fetch 404 → 學生支持流程永遠 fallback 到本機樣板，假裝是 AI 回覆但實際 AI 從未被叫到。

**Files:**
- Modify: `apps/app3-guardian/server/aiService.ts`
- Modify: `apps/app3-guardian/server/serialBridge.ts`

- [ ] **Step 1: aiService.ts 加 GuardianChatContext + generateGuardianChatReply**

在檔案底部加：
```ts
export interface GuardianChatContext {
  text: string;
  mood?: string;
  location?: string;
  alertSummary?: string;
}

export async function generateGuardianChatReply(
  ctx: GuardianChatContext
): Promise<{reply: string; source: 'gemini' | 'local'}> {
  if (!ai) return {reply: '', source: 'local'};
  try {
    const prompt = `你是國中校園心靈守護者 AI。學生說：「${ctx.text}」。
心情：${ctx.mood ?? '未指定'}。地點：${ctx.location ?? '未指定'}。
當前預警：${ctx.alertSummary ?? '無'}。
請用繁體中文 2-3 句回覆。語氣溫暖、不評判、提供具體下一步建議（例如建議找誰、做什麼）。不要說「我是 AI」之類。`;

    const response = await withAiTimeout((signal) =>
      ai.models.generateContent({
        model: textModel,
        contents: [{role: 'user', parts: [{text: prompt}]}],
        config: {
          temperature: 0.7,
          abortSignal: signal,  // 在 config 內
        },
      })
    );
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    return text ? {reply: text, source: 'gemini'} : {reply: '', source: 'local'};
  } catch (error) {
    console.warn('[ai] guardian-chat failed:', error instanceof Error ? error.message : String(error));
    return {reply: '', source: 'local'};
  }
}
```

- [ ] **Step 2: serialBridge.ts 加 route**

讀 `serialBridge.ts:520` (`/api/ai/guardian` 既有 route 位置)。在其後加：

```ts
app.post('/api/ai/guardian-chat', async (req, res) => {
  const {text, mood, location, alertSummary} = req.body ?? {};
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ok: false, error: 'text required'});
  }
  try {
    const result = await generateGuardianChatReply({
      text: text.trim(),
      mood: typeof mood === 'string' ? mood : undefined,
      location: typeof location === 'string' ? location : undefined,
      alertSummary: typeof alertSummary === 'string' ? alertSummary : undefined,
    });
    if (!result.reply) {
      return res.status(503).json({ok: false, error: 'AI 暫時不可用', fallback: true});
    }
    res.json({ok: true, reply: result.reply, source: result.source});
  } catch (error) {
    res.status(500).json({ok: false, error: error instanceof Error ? error.message : String(error)});
  }
});
```

- [ ] **Step 3: 更新 import**

`serialBridge.ts` 頂部 import 加 `generateGuardianChatReply`：

```ts
import {analyzeGuardianAlert, analyzeEmotionFromImage, analyzeZoneAdvisor, generateGuardianChatReply, ...} from './aiService';
```

- [ ] **Step 4: lint + 手動 curl 驗證**

```bash
cd apps/app3-guardian && npm run lint
```

```bash
# 啟 bridge 後 curl
curl -X POST http://localhost:3203/api/ai/guardian-chat -H 'Content-Type: application/json' -d '{"text":"我最近壓力很大","mood":"anxious"}'
```

預期：200 + `{ok: true, reply: "...", source: "gemini"}` 或 503 + fallback flag。

- [ ] **Step 5: Commit**

```bash
git add apps/app3-guardian/server/aiService.ts apps/app3-guardian/server/serialBridge.ts
git commit -m "fix(app3): add missing /api/ai/guardian-chat endpoint (frontend was 404ing into local template)"
```

---

### Task 3: Robot ACK timeout 降級 polish（15 min）

**Files:**
- Modify: `apps/app3-guardian/server/serialPort.ts`

- [ ] **Step 1: 加 port.write 1s timeout guard**

找到 `serialPort.ts:381-383`：
```ts
await new Promise<void>((resolve, reject) => {
  port.write(`${command}\n`, (error) => (error ? reject(error) : resolve()));
});
```

改為（同 app2 設計）：
```ts
await Promise.race([
  new Promise<void>((resolve, reject) => {
    port.write(`${command}\n`, (error) => (error ? reject(error) : resolve()));
  }),
  new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error('serial write timeout 1s')), 1000)
  ),
]);
```

- [ ] **Step 2: Polish 拔線錯誤訊息**

```ts
return {ok: false, message: telemetry.lastError ?? 'No Arduino available. 請插 UNO R4 並上傳 app3-guardian-drive 或 app3-guardian-sensor 韌體（pio run -e uno_r4_minima_app3_guardian_drive -t upload）'};
```

- [ ] **Step 3: lint 驗證**

```bash
cd apps/app3-guardian && npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add apps/app3-guardian/server/serialPort.ts
git commit -m "fix(app3): add 1s serial write timeout guard + clearer Arduino error message"
```

---

### Task 4: Per-handler abort hook + App.tsx + GuardianControlPanel 套用（90 min）

**Files:**
- Create: `apps/app3-guardian/src/hooks/useActionAbort.ts`（介面同 app2，重複實作避免循環）
- Modify: `apps/app3-guardian/src/App.tsx`
- Modify: `apps/app3-guardian/src/components/GuardianControlPanel.tsx`

- [ ] **Step 1: 建立 useActionAbort hook（同 app2 介面 + token guard）**

```bash
cat > apps/app3-guardian/src/hooks/useActionAbort.ts <<'EOF'
import {useRef} from 'react';

/**
 * Per-handler abort controller with race-guarded end().
 * Interface aligned with app2's same-named hook (intentional duplicate per
 * spec "interface alignment without shared package").
 */
export function useActionAbort() {
  const ref = useRef<{controller: AbortController; token: number} | null>(null);
  const tokenSeq = useRef(0);
  return {
    begin(): {signal: AbortSignal; token: number} {
      ref.current?.controller.abort();
      const controller = new AbortController();
      const token = ++tokenSeq.current;
      ref.current = {controller, token};
      return {signal: controller.signal, token};
    },
    end(token: number): void {
      if (ref.current?.token === token) ref.current = null;
    },
    abort(): void {
      ref.current?.controller.abort();
      ref.current = null;
    },
  };
}
EOF
```

- [ ] **Step 2: App.tsx 5 個 handler 各自 useActionAbort**

在 `AppContent` 內加：
```ts
import {useActionAbort} from './hooks/useActionAbort';
// ...
const autoDemoAbort = useActionAbort();
const dispatchAbort = useActionAbort();
const emotionAbort = useActionAbort();
const acousticAbort = useActionAbort();
const chatAbort = useActionAbort();
```

每個 handler 套用：

`handleRunAutoDemo` →
```ts
async function handleRunAutoDemo() {
  const {signal, token} = autoDemoAbort.begin();
  try {
    // 既有 demo step 邏輯 — 把 fetch / service call 改傳 signal
    await someServiceCall(args, signal);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return;
    // 既有錯誤處理
  } finally {
    autoDemoAbort.end(token);  // token guard
  }
}
```

`handleDispatchRobot`、`handleConfirmRobotArrival`（共用 `dispatchAbort`） / `handleAnalyzeEmotion` (用 `emotionAbort`) / `handleAcousticAnalyze` (用 `acousticAbort`) / `handleSendChatMessage` (用 `chatAbort`)。每個都用 `const {signal, token} = xxxAbort.begin()` + `finally xxxAbort.end(token)`。

- [ ] **Step 3: GuardianControlPanel 自己 useActionAbort（不從 App.tsx import）**

讀 `components/GuardianControlPanel.tsx`，在元件內加：
```ts
import {useActionAbort} from '../hooks/useActionAbort';
// ...
const controlAbort = useActionAbort();
```

panel 內的 async handler 用 `controlAbort`。

- [ ] **Step 4: askGemini 介面 + composeChatReply 同步加 signal**

讀 `src/services/geminiAi.ts` 找 `askGemini` 函數定義（不是 localGuardianAi.ts 用的那個 — askGemini 來源是 geminiAi.ts）：

```bash
grep -n "function askGemini\|export.*askGemini" apps/app3-guardian/src/services/*.ts
```

若 `askGemini` 無 signal 參數，加：

```ts
// services/geminiAi.ts
export async function askGemini(path: string, body: unknown, signal?: AbortSignal): Promise<any> {
  const response = await fetch(`${BRIDGE_URL}${path}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json();
}
```

對應 `localGuardianAi.ts` 的 `composeChatReply`（或其他用 askGemini 的 wrapper）接受 signal 傳入並 forward：

```ts
export async function composeChatReply(text: string, mood: string, location: string, alertSummary: string, signal?: AbortSignal): Promise<string> {
  // ...
  const data = await askGemini('/api/ai/guardian-chat', {text, mood, location, alertSummary}, signal);
  // ...
}
```

`hardwareBridge.ts` 內所有 fetch wrapper 同樣加 signal 參數。

注意：只改 caller 不改 callee 介面會 TS red。改了 askGemini 簽名後，**搜所有 askGemini callsite** 確認傳 signal:
```bash
grep -rn "askGemini(" apps/app3-guardian/src
```

- [ ] **Step 5: lint + 手動測試**

```bash
cd apps/app3-guardian && npm run lint
```

```bash
npm run dev
```

手動：快速點 emotion analyze + acoustic analyze + dispatch — 各自 abort 不互相干擾。

- [ ] **Step 6: Commit**

```bash
git add apps/app3-guardian/src/hooks/useActionAbort.ts apps/app3-guardian/src/App.tsx apps/app3-guardian/src/components/GuardianControlPanel.tsx apps/app3-guardian/src/services/localGuardianAi.ts
git commit -m "feat(app3): per-handler useActionAbort hook (5 handlers in App.tsx + 1 in GuardianControlPanel, no cross-handler cancellation)"
```

---

### Task 5: state localStorage Map fallback（20 min）

**Files:**
- Modify: `apps/app3-guardian/src/state/guardianState.ts`

- [ ] **Step 1: 加 `_memoryFallback` Map（line 550 周邊）**

讀 `guardianState.ts` 找 `persistGuardianState` / `loadGuardianState` function。

加：
```ts
const _memoryFallback = new Map<string, GuardianState>();
```

- [ ] **Step 2: 改 persistGuardianState**

```ts
export function persistGuardianState(state: GuardianState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    _memoryFallback.delete(STORAGE_KEY);
  } catch (error) {
    if (error instanceof DOMException && (error.code === 22 || error.name === 'QuotaExceededError')) {
      const trimmed = {
        ...state,
        moodLogs: state.moodLogs.slice(0, 50),
        acousticSignals: state.acousticSignals.slice(0, 50),
        robotMissions: state.robotMissions.slice(0, 50),
        alerts: state.alerts.slice(0, 50),
      };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        _memoryFallback.delete(STORAGE_KEY);
        return;
      } catch {
        // 連 trim 都不行
      }
    }
    _memoryFallback.set(STORAGE_KEY, state);
  }
}
```

- [ ] **Step 3: 改 loadGuardianState**

```ts
export function loadGuardianState(): GuardianState | null {
  if (typeof window === 'undefined') return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // private mode 也可能 throw
  }
  if (raw !== null) {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return _memoryFallback.get(STORAGE_KEY) ?? null;
}
```

- [ ] **Step 4: 跑 guardianState.test**

```bash
cd apps/app3-guardian && npm run test
```

預期：全 4 個 test 綠（含 500-round pixel validation）。

- [ ] **Step 5: Commit**

```bash
git add apps/app3-guardian/src/state/guardianState.ts
git commit -m "feat(app3): in-memory Map fallback for localStorage Quota (iOS Safari private mode safe)"
```

---

### Task 6: demo:check script（35 min）

**Files:**
- Create: `apps/app3-guardian/scripts/demo-readiness-check.mjs`
- Modify: `apps/app3-guardian/package.json`

- [ ] **Step 1: 建 scripts/ + 仿 app2 模板**

```bash
mkdir -p apps/app3-guardian/scripts
```

```bash
cat > apps/app3-guardian/scripts/demo-readiness-check.mjs <<'SCRIPT'
import {spawn} from 'node:child_process';
import net from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';

const appDir = process.cwd();
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function waitForOk(url, label, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error?.message ?? String(error);
    }
    await delay(250);
  }
  throw new Error(`${label} not ready at ${url}: ${lastError}`);
}

async function checkEndpoint(method, url, body, label) {
  const init = {method, headers: {'Content-Type': 'application/json'}};
  if (body !== undefined) init.body = JSON.stringify(body);
  try {
    const response = await fetch(url, init);
    const acceptable = response.status === 200 || response.status === 503 || response.status === 202;
    return {label, status: response.status, ok: acceptable, url};
  } catch (error) {
    return {label, status: 0, ok: false, error: error?.message ?? String(error), url};
  }
}

async function main() {
  const bridgePort = await getFreePort();
  const env = {...process.env, BRIDGE_PORT: String(bridgePort), DEMO_SIMULATE_HARDWARE: '1'};
  const child = spawn(npmBin, ['run', 'dev:bridge'], {cwd: appDir, env, stdio: 'inherit'});

  try {
    await waitForOk(`http://127.0.0.1:${bridgePort}/api/health`, 'Bridge');

    const base = `http://127.0.0.1:${bridgePort}`;
    const results = await Promise.all([
      checkEndpoint('GET',  `${base}/api/health`, undefined, 'health'),
      checkEndpoint('GET',  `${base}/api/ready`, undefined, 'ready'),
      checkEndpoint('GET',  `${base}/api/sensors/ports`, undefined, 'sensors/ports'),
      checkEndpoint('POST', `${base}/api/ops/reset`, {}, 'ops/reset'),
      checkEndpoint('POST', `${base}/api/ai/guardian`, {
        type: '國中壓力事件', riskLevel: 'medium', severity: 'medium', description: 'demo:check',
      }, 'ai/guardian'),
      checkEndpoint('POST', `${base}/api/ai/guardian-chat`, {
        text: 'demo:check probe', mood: 'calm',
      }, 'ai/guardian-chat'),
      checkEndpoint('POST', `${base}/api/ai/zone-advisor`, {zone: '圖書館', recentReadings: []}, 'ai/zone-advisor'),
      checkEndpoint('POST', `${base}/api/robot/command`, {command: 'BEEP'}, 'robot/command'),
      checkEndpoint('POST', `${base}/api/robot/drive`, {command: 'STOP'}, 'robot/drive'),
      checkEndpoint('POST', `${base}/api/robot/emotion-scan`, {imageBase64: TINY_PNG}, 'robot/emotion-scan'),
      checkEndpoint('GET',  `${base}/api/display/status`, undefined, 'display/status'),
      checkEndpoint('GET',  `${base}/api/display/info`, undefined, 'display/info'),
      checkEndpoint('POST', `${base}/api/display/emotion`, {emotion: 'calm'}, 'display/emotion'),
      checkEndpoint('GET',  `${base}/api/display/emotion-events`, undefined, 'display/emotion-events'),
    ]);

    let allOk = true;
    for (const r of results) {
      const tag = r.ok ? 'PASS' : 'FAIL';
      console.log(`[${tag}] ${r.label.padEnd(28)} ${r.status || '---'} ${r.url}${r.error ? ' ' + r.error : ''}`);
      if (!r.ok) allOk = false;
    }
    process.exit(allOk ? 0 : 1);
  } finally {
    child.kill('SIGINT');
  }
}

main().catch((err) => {
  console.error('[demo:check] crashed:', err);
  process.exit(1);
});
SCRIPT
```

- [ ] **Step 2: 加 npm script**

`package.json` `"scripts"` 內加：
```json
"demo:check": "node scripts/demo-readiness-check.mjs",
```

- [ ] **Step 3: 試跑**

```bash
cd apps/app3-guardian && DEMO_SIMULATE_HARDWARE=1 npm run demo:check
```

預期：14 個 endpoint PASS。

- [ ] **Step 4: Commit**

```bash
git add apps/app3-guardian/scripts/demo-readiness-check.mjs apps/app3-guardian/package.json
git commit -m "feat(app3): add demo:check script — 14 endpoint pre-flight (incl. new guardian-chat)"
```

---

### Task 7: 一鍵啟動.command 強化 + 一鍵停止.command（25 min）

**Files:**
- Modify (or already exists): `apps/app3-guardian/一鍵啟動展示.command`
- Create: `apps/app3-guardian/一鍵停止展示.command`

- [ ] **Step 1: 讀 既有 .command**

```bash
cat "apps/app3-guardian/一鍵啟動展示.command"
```

確認 baseline commit 後內容。Identify gaps: port kill 嚴格度 / 訊息清晰度 / 投影 URL 印出。

- [ ] **Step 2: 強化啟動 .command**

完整內容：
```bash
cat > "apps/app3-guardian/一鍵啟動展示.command" <<'SCRIPT'
#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

BRIDGE_PORT=3203

echo "==> 清理舊 bridge process (port $BRIDGE_PORT)"
lsof -ti:$BRIDGE_PORT 2>/dev/null | while read pid; do
  if ps -p $pid -o command= 2>/dev/null | grep -q "tsx server/serialBridge"; then
    echo "    killing pid $pid"
    kill -9 $pid 2>/dev/null || true
  fi
done

echo "==> 找 vite 可用 port"
VITE_PORT=3000
while lsof -ti:$VITE_PORT >/dev/null 2>&1; do
  VITE_PORT=$((VITE_PORT + 1))
done
echo "    vite will use :$VITE_PORT"

echo "==> 啟動 bridge + vite"
npm run dev -- --port $VITE_PORT &
DEV_PID=$!

sleep 5

echo ""
echo "✓ App3 已啟動"
echo "✓ 主畫面 (學生)    : http://localhost:$VITE_PORT"
echo "✓ Bridge API       : http://localhost:$BRIDGE_PORT/api/health"
echo "✓ 第二螢幕 (情緒)  : http://localhost:$VITE_PORT/?screen=robot"
echo "✓ 圖卡列印         : http://localhost:$VITE_PORT/demo-scenes/guardian-printable-scene-cards.html"
echo ""
echo "按 Ctrl+C 停止，或執行 一鍵停止展示.command"

open "http://localhost:$VITE_PORT" 2>/dev/null || true

wait $DEV_PID
SCRIPT
chmod +x "apps/app3-guardian/一鍵啟動展示.command"
```

- [ ] **Step 3: 寫停止 .command**

```bash
cat > "apps/app3-guardian/一鍵停止展示.command" <<'SCRIPT'
#!/usr/bin/env bash
echo "==> 停止 app3 (bridge :3203 + vite)"
lsof -ti:3203 2>/dev/null | xargs -r kill -9 2>/dev/null || true
pkill -f "vite.*app3-guardian" 2>/dev/null || true
pkill -f "tsx server/serialBridge" 2>/dev/null || true
echo "✓ 停止完成"
sleep 2
SCRIPT
chmod +x "apps/app3-guardian/一鍵停止展示.command"
```

- [ ] **Step 4: 手動驗證**

雙擊啟動 / 停止確認可用。

- [ ] **Step 5: Commit**

```bash
git add "apps/app3-guardian/一鍵啟動展示.command" "apps/app3-guardian/一鍵停止展示.command"
git commit -m "feat(app3): polish 一鍵啟動.command (port detect, kill-old, clearer info) + add 停止.command"
```

---

### Task 8: 5 段閉環 explicit flag wire（45 min）

**Files:**
- Modify: `apps/app3-guardian/src/state/guardianState.ts`（加 `demoClosureFlags` field + reducer cases）
- Modify: `apps/app3-guardian/src/App.tsx`（`buildDemoClosureSteps` 用 flag）

- [ ] **Step 1: 加 type 到 `src/types.ts`（rigor review 7）**

`GuardianState` interface 在 `src/types.ts:125`，**不是** `guardianState.ts`。

`src/types.ts` 加：
```ts
export interface DemoClosureFlags {
  signalFused: boolean;
  alertCreated: boolean;
  robotDispatched: boolean;
  studentSupported: boolean;
  closed: boolean;
}
```

`GuardianState` interface 加 field：
```ts
demoClosureFlags: DemoClosureFlags;
```

`guardianState.ts` 加常數 + initial 值：
```ts
import type {DemoClosureFlags} from '../types';

export const INITIAL_DEMO_CLOSURE_FLAGS: DemoClosureFlags = {
  signalFused: false,
  alertCreated: false,
  robotDispatched: false,
  studentSupported: false,
  closed: false,
};
```

`createInitialGuardianState` 加：
```ts
demoClosureFlags: {...INITIAL_DEMO_CLOSURE_FLAGS},
```

- [ ] **Step 2: reducer cases 設旗標（用實際 action names — 已 grep 驗證）**

找到 reducer，在關鍵 action **末尾返回的 newState** 加 closureFlags 更新（不替換 heuristic 是補強）：

```ts
case 'RECORD_ACOUSTIC_SIGNAL':
case 'ADD_MOOD':
  return {
    ...newState,  // 既有 state 更新
    demoClosureFlags: {...newState.demoClosureFlags, signalFused: true},
  };

case 'CREATE_ACOUSTIC_ALERT':
case 'CREATE_PROACTIVE_ALERT':
case 'CREATE_CONTEXT_ALERT':
  return {
    ...newState,
    demoClosureFlags: {...newState.demoClosureFlags, alertCreated: true},
  };

case 'DISPATCH_ROBOT':
  return {
    ...newState,
    demoClosureFlags: {...newState.demoClosureFlags, robotDispatched: true},
  };

case 'ADD_SUPPORT_MESSAGE':
case 'ADD_FOREST_POST':
case 'DEPLOY_INTERVENTION':
  return {
    ...newState,
    demoClosureFlags: {...newState.demoClosureFlags, studentSupported: true},
  };

case 'UPDATE_ALERT_STATUS':
  // 既有處理放上面，回傳前若新 status === 'resolved' 設 closed
  return {
    ...newState,
    demoClosureFlags: action.status === 'resolved'
      ? {...newState.demoClosureFlags, closed: true}
      : newState.demoClosureFlags,
  };

case 'COMPLETE_CARE_LOOP':
  return {
    ...newState,
    demoClosureFlags: {...newState.demoClosureFlags, closed: true},
  };

case 'RESET_DEMO':
  return {...createInitialGuardianState()};  // closure flags 自然歸 false
```

實際 action names 已 grep `apps/app3-guardian/src/state/guardianState.ts` 驗證。Reducer 內現有的 case 結構不變，只在每個 return statement 加 demoClosureFlags field。

注意：`UPDATE_ALERT_STATUS` action payload 結構需 grep 確認是 `action.status` 還是 `action.payload.status`，調整 conditional 寫法。

- [ ] **Step 3: App.tsx buildDemoClosureSteps 用 flag**

讀 `App.tsx:1526-1548`。改 `done` 計算：
```ts
function buildDemoClosureSteps(state: GuardianState, viewModel: CommandCenterViewModel): DemoClosureStep[] {
  const flags = state.demoClosureFlags;
  // 既有 heuristic 保留
  const hasFusedSignal = state.moodLogs.some(...);
  const hasAlert = state.alerts.some(...);
  // ...
  const signalDone = hasFusedSignal || hasAlert || hasIntervention || hasMission || hasSupport || hasClosure || flags.signalFused;
  const alertDone = hasAlert || hasIntervention || hasMission || hasSupport || hasClosure || flags.alertCreated;
  const dispatchDone = hasIntervention || hasMission || hasSupport || hasClosure || flags.robotDispatched;
  const supportDone = hasSupport || hasClosure || flags.studentSupported;
  const closureDone = hasClosure || flags.closed;

  return [
    {label: '訊號融合', detail: '心情、聲量、節點進入判讀', done: signalDone, panel: 'sensing'},
    {label: '預警成案', detail: '匿名提醒與處置清單建立', done: alertDone, panel: 'alerts'},
    {label: '派遣處置', detail: '機器人或老師到場確認', done: dispatchDone, panel: 'robot'},
    {label: '學生支持', detail: '照護回覆與自我調節紀錄', done: supportDone, panel: 'care'},
    {label: '回報結案', detail: '完成追蹤並保留證據', done: closureDone, panel: 'robot'},
  ];
}
```

- [ ] **Step 4: 跑 guardianState.test 確認沒破**

```bash
cd apps/app3-guardian && npm run test
```

預期：4 個 test 全綠（含 500-round pixel）。

- [ ] **Step 5: 手動驗證**

開 demo，依序觸發 5 段 action → 5/5 counter 完成。reset → counter 歸 0。

- [ ] **Step 6: Commit**

```bash
git add apps/app3-guardian/src/state/guardianState.ts apps/app3-guardian/src/App.tsx
git commit -m "feat(app3): demoClosureFlags explicit flag for 5-segment closure (covers substring-match brittleness)"
```

---

### Task 9: 5 段亮點 audit + fix（45 min）

**Files:**
- Modify: 各 panel components + `robot-app/`

- [ ] **Step 1: Audit 訊號融合段 — 麥克風波形 + 風險指數**

```bash
grep -n "useAcoustic\|waveform\|volumeIndex" apps/app3-guardian/src/components/*.tsx
```

確認 SensingPanel 有實時 waveform 顯示。閾值跨越時加色彩變化（risk-aware className）。

- [ ] **Step 2: Audit 預警成案段 — 校園 2.5D 地圖紅點脈衝**

```bash
grep -n "CampusMapSvg\|animate-pulse" apps/app3-guardian/src/components/CampusMapSvg.tsx
```

確認新建 alert 時 zone marker 觸發 `animate-pulse` ≥ 5 秒。

- [ ] **Step 3: Audit 派遣處置段 — 第二螢幕 emotion 切換**

```bash
grep -rn "emotion-event\|emotionType" apps/app3-guardian/robot-app/src 2>/dev/null
```

確認 robot-app 收到 `emotion-event` WS 訊息後立即重 render。若切換動畫不流暢加 CSS transition：
```css
.emotion-face { transition: opacity 0.4s ease, transform 0.4s ease; }
```

從觸發到第二螢幕換臉應 < 3 秒。

- [ ] **Step 4: Audit 學生支持段 — AI 串流回覆**

`generateGuardianChatReply`（Task 2 新增）是同步回應，不串流。Phase MUST 不做串流（NICE 可加）。確認 chat 回覆有明顯 typing indicator + 完整 reply 顯示。

- [ ] **Step 5: Audit 回報結案段 — RGB LED 收尾**

```bash
grep -rn "LED_CONFIRM\|LED_" apps/app3-guardian
```

確認 RESOLVE_ALERT 或 closure action 時呼叫 `fetch('/api/robot/command', {body: JSON.stringify({command: 'LED_CONFIRM'})})`。若無，加。

韌體支援的 LED 指令（per `firmware/app3-guardian-sensor/main.cpp`）確認名稱（grep `LED_`）。

- [ ] **Step 6: check 綠 + 手動驗收**

```bash
cd apps/app3-guardian && npm run check && cd robot-app && npm run build && cd ..
```

預期：全綠。

- [ ] **Step 7: Commit（每項亮點獨立 commit 也可，這裡合併）**

```bash
git add apps/app3-guardian/src/components/ apps/app3-guardian/src/App.tsx apps/app3-guardian/robot-app/src
git commit -m "feat(app3): 5-segment highlight audit + fix (waveform / pulse / robot-app emotion transition / LED_CONFIRM)"
```

---

### Task 10: 現場災難 fail-safe (L1)（45 min）

**Files:**
- Create: `apps/app3-guardian/src/hooks/useWakeLock.ts`
- Modify: `apps/app3-guardian/src/App.tsx`

- [ ] **Step 1: useWakeLock hook（同 app2）**

```bash
cat > apps/app3-guardian/src/hooks/useWakeLock.ts <<'EOF'
import {useEffect} from 'react';

export function useWakeLock(active: boolean = true): void {
  useEffect(() => {
    if (!active) return;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let sentinel: any = null;
    let released = false;
    (async () => {
      try {
        sentinel = await (navigator as any).wakeLock.request('screen');
        const handler = async () => {
          if (document.visibilityState === 'visible' && !released) {
            try { sentinel = await (navigator as any).wakeLock.request('screen'); } catch {}
          }
        };
        document.addEventListener('visibilitychange', handler);
        return () => document.removeEventListener('visibilitychange', handler);
      } catch {}
    })();
    return () => {
      released = true;
      sentinel?.release().catch(() => {});
    };
  }, [active]);
}
EOF
```

- [ ] **Step 2: App.tsx 套用 wakeLock + swipe-back + 離線 banner + 投影 chip**

App.tsx `AppContent` 內加：
```ts
import {useWakeLock} from './hooks/useWakeLock';
// ...
useWakeLock(state.autoDemoRunning || true);  // 整 demo 期間
```

Safari swipe-back：
```ts
useEffect(() => {
  if (typeof window === 'undefined') return;
  window.history.pushState(null, '', window.location.href);
  const handler = () => {
    window.history.pushState(null, '', window.location.href);
  };
  window.addEventListener('popstate', handler);
  return () => window.removeEventListener('popstate', handler);
}, []);
```

離線 banner（用 `bridgeOnline` state，App.tsx 既有）：
```tsx
{!bridgeOnline && (
  <div className="fixed top-0 inset-x-0 z-50 bg-amber-500 text-white text-sm font-bold px-4 py-2 text-center shadow-lg">
    離線備援模式 — 守護判讀走本機分析
    <button onClick={() => window.location.reload()} className="ml-2 underline">重試</button>
  </div>
)}
```

投影 URL chip：
```tsx
{(window.location.search.includes('show-cast') || process.env.NODE_ENV === 'production') && (
  <div className="fixed bottom-2 right-2 z-40 bg-black/70 text-white text-xs px-2 py-1 rounded">
    第二螢幕: {window.location.origin}/?screen=robot
  </div>
)}
```

- [ ] **Step 3: lint + 手動驗證**

```bash
cd apps/app3-guardian && npm run lint
```

手動：模擬 wifi disconnect → 離線 banner 顯示 + 重試按鈕。

- [ ] **Step 4: Commit**

```bash
git add apps/app3-guardian/src/hooks/useWakeLock.ts apps/app3-guardian/src/App.tsx
git commit -m "feat(app3): on-site disaster fail-safe — wakeLock + swipe-back disable + offline banner + projection chip"
```

---

### Phase MUST 收尾

```bash
cd apps/app3-guardian && npm run check && cd robot-app && npm run build && cd ..
```

預期：全綠 + robot-app build 綠。

**手動驗收 6 項**:
1. 拔網 → emotion-scan 20s 內 fallback
2. 拔線 → robot/command 503 + 明確訊息
3. 快速連點各 panel 不互相干擾
4. iOS 私密模式 demo 不崩
5. 5/5 counter 完整跑完
6. iPad swipe back 不退 demo

---

## Phase SHOULD — Demo 體驗順

### Task 11: Reset 徹底化 + 第二螢幕 sync（40 min）

**Files:**
- Modify: `apps/app3-guardian/src/state/guardianState.ts`, `App.tsx`, `RobotDisplaySync.tsx`, `serialBridge.ts`

- [ ] **Step 1: state RESET_DEMO action**

guardianState.ts 加：
```ts
case 'RESET_DEMO':
  return {...createInitialGuardianState()};
```

- [ ] **Step 2: useGuardianActions 暴露 resetDemo**

```ts
const resetDemo = useCallback(async () => {
  dispatch({type: 'RESET_DEMO'});
  try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
  await fetch(`${BRIDGE_URL}/api/ops/reset`, {method: 'POST'}).catch(() => {});
}, []);
```

- [ ] **Step 3: server /api/ops/reset 加 broadcast**

讀 `serialBridge.ts:593` 周邊。在 reset 完後加：
```ts
broadcast({type: 'demo_reset', timestamp: Date.now()});
for (const client of displayClients) {
  if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({type: 'demo_reset'}), () => {});
}
```

- [ ] **Step 4: RobotDisplaySync + robot-app 收聽 demo_reset**

讀 RobotDisplaySync.tsx + robot-app 的 WS handler，加：
```ts
if (msg.type === 'demo_reset') {
  // 重置第二螢幕 state
}
```

- [ ] **Step 5: 手動驗證**

跑五段累積 state → reset → 第二螢幕 + 主畫面 + counter 全部歸初。

- [ ] **Step 6: Commit**

```bash
git add apps/app3-guardian/src/state/guardianState.ts apps/app3-guardian/src/App.tsx apps/app3-guardian/src/components/RobotDisplaySync.tsx apps/app3-guardian/server/serialBridge.ts apps/app3-guardian/robot-app/src
git commit -m "feat(app3): Reset broadcasts demo_reset to wss.clients + displayClients + robot-app secondary screen"
```

---

### Task 12: K 亮點補完未實作的（30 min）

Audit Task 9 後仍 ❓ 的項目補完。

每項獨立 commit。

---

### Task 13: api-contract.test.mjs（75 min）

**Files:**
- Create: `apps/app3-guardian/server/api-contract.test.mjs`
- Modify: `apps/app3-guardian/package.json`

- [ ] **Step 1: 仿 app1 模板建立**

複製 app1 模板，改 app3 endpoints。

- [ ] **Step 2: 覆蓋 25 個 endpoint（含 guardian-chat）**

每個 endpoint 一個 case，含正確 payload（per spec SHOULD 3）。注意 rigor review 6 警告：POST endpoint 不能用空 body 否則 400。

範例片段：
```js
{
  // /api/ai/guardian-chat 新增的 endpoint
  const {response, body} = await request('/api/ai/guardian-chat', {
    method: 'POST',
    body: JSON.stringify({text: '測試訊息', mood: 'calm'}),
  });
  assert.ok([200, 503].includes(response.status), `guardian-chat status ${response.status}`);
  if (response.status === 200) {
    assert.equal(typeof body.reply, 'string');
    assert.ok(body.reply.length > 0);
  }
}
```

- [ ] **Step 3: 加進 check script**

```json
"check": "npm run test && tsx server/api-contract.test.mjs && npm run lint && npm run build"
```

- [ ] **Step 4: 跑 check 確認**

```bash
cd apps/app3-guardian && npm run check
```

預期：全綠。

- [ ] **Step 5: Commit**

```bash
git add apps/app3-guardian/server/api-contract.test.mjs apps/app3-guardian/package.json
git commit -m "test(app3): api-contract.test.mjs covering all 25 endpoints (incl. /api/ai/guardian-chat)"
```

---

### Task 14: DEMO_SOAK_CHECKLIST + 跑一次（45 min）

**Files:**
- Create: `apps/app3-guardian/docs/DEMO_SOAK_CHECKLIST.md`

- [ ] **Step 1: 寫 checklist md**

```markdown
# App3 Demo Soak Checklist（30 min 手動驗證）

## 流程（跑五段閉環 3 輪）

1. 點「開始示範」→ 走訊號融合 / 預警成案 / 派遣處置 / 學生支持 / 回報結案
2. 觀察 5/5 counter 跑滿
3. 點 reset → counter 歸 0
4. 重複 3 輪

## 驗收指標

- [ ] JS heap 30 min 後不持續增長
- [ ] 第二螢幕 30 min 後 emotion 切換仍流暢
- [ ] WS reconnect log < 5 次
- [ ] localStorage < 1MB
- [ ] iPad mirror 1080p 不破版
- [ ] robot-app 30 min 後可正常 build (`cd robot-app && npm run build`)
```

- [ ] **Step 2: 跑一次 soak**

紀錄結果。

- [ ] **Step 3: Commit**

```bash
git add apps/app3-guardian/docs/DEMO_SOAK_CHECKLIST.md
git commit -m "docs(app3): DEMO_SOAK_CHECKLIST + first soak run"
```

---

### Phase SHOULD 收尾

```bash
cd apps/app3-guardian && npm run check && cd robot-app && npm run build && cd ..
```

預期：全綠。

---

## Phase NICE — 工程潔癖 / 後續精進

### Task 15: defaults.ts（30 min）

抽 `GUARDIAN_DEMO_ZONES` / `PRINTABLE_VISUAL_SCENES` / `AI_PROMPT_TEMPLATES` / `EMOTION_LABELS`。

- [ ] Step 1: 抽常數
- [ ] Step 2: 各引用點 import
- [ ] Step 3: check + commit

---

### Task 16: hardwareSimulation.test.ts（50 min）

仿 app1 同名檔。覆蓋 sim mode。~20 assertion。

- [ ] Step 1: 仿 app1
- [ ] Step 2: 加 check script
- [ ] Step 3: commit

---

### Task 17: Firebase try/catch guard（10 min）

`src/lib/firebase.ts` 加 try/catch 避免未設定時 console 噪音。

- [ ] Step 1: try/catch wrap
- [ ] Step 2: commit

---

### Task 18: directGemini.ts（60 min — 條件式）

**只做於：規劃 GitHub Pages public deploy 時**。

3 個 function: directAnalyzeGuardianAlert / directAnalyzeEmotion / directGenerateGuardianChatReply。

---

### Task 19: serialBridge 拆 6 個 routes（120 min — 條件式）

**只做於：時間餘裕**。

- 拆 wsBroadcast.ts (**含 broadcast + sendToDisplayClients 兩個 channel**, rigor review 8)
- 拆 routes/{aiRoutes, robotRoutes, displayRoutes, sensorRoutes}.ts
- 拆 validation.ts
- serialBridge.ts 留 ~400 行

每組 routes 工廠函數注入 deps 避免 circular import。

拆完跑完整 api-contract test 驗 0 regression。

---

## 全 phase 收尾

```bash
cd apps/app3-guardian && npm run check && cd robot-app && npm run build && cd ..
```

預期：全綠。

**最終手動驗收（demo 視角 12 項）** — per spec 成功標準。

---

## 估計總時長

- MUST (Task 0-10): ~6.5 hrs
- SHOULD (Task 11-14): ~3.2 hrs
- NICE 必做 (Task 15-17): ~1.5 hrs
- NICE 條件式 (Task 18-19): +3 hrs

Solo: ~11-14 hrs
Codex 平行：~8-10 hrs

---

## Codex 平行派送點

獨立 chunk 可派 `codex-x`:

- Task 1 (withAiTimeout) — pure mechanical wrap
- Task 2 (new guardian-chat endpoint) — independent server endpoint
- Task 5 (state Map fallback) — focused state edit
- Task 6 (demo:check script) — copy + adapt
- Task 13 (api-contract.test — 25 endpoints) — mechanical write
- Task 16 (hardwareSimulation.test) — mechanical
- Task 18 / 19 (directGemini / serialBridge split) — 大塊獨立

Claude 主力做：Task 4 (per-handler abort 套 App.tsx + GuardianControlPanel — 跨檔)、Task 8 (5 段 explicit flag wire — state/reducer/App.tsx 整合)、Task 9 (5 段亮點 audit — 跨 panel + robot-app)、Task 10 (災難 fail-safe — UX 整合)、Task 11 (Reset 徹底化 — 跨 client/server/robot-app)。
