# App2 Demo Reliability + Closure 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠️ Plan revisions (post-dual-review)**:
> - `abortSignal` 是 **`GenerateContentConfig` 的 field**（不是 top-level `GenerateContentParameters`）— SDK 型別已驗 `apps/app2-campus-service/node_modules/@google/genai/dist/genai.d.ts:4423-4432`。所有 generateContent 包裝都是 `config: {...原 config, abortSignal: signal}` 不是 top-level。
> - useActionAbort 加 token guard 防 race：begin() 回傳 `{signal, token}`，end(token) 只有 token 匹配才清。
> - 把 signal **真的傳進 service 層**（`localAi.ts` 的 `askGemini` 接 `signal?: AbortSignal`），不然 handler abort 不會真的取消 fetch。
> - Task 3 narrow scope：不 retro 改全 5 view，只改證實「busy 卡住 / cross-handler 取消 / 缺 signal 傳遞」的 handler。WIP 既綠的 component-local controller 保留。
> - Task 9 Reset broadcast 兩個 WS channel 都要送（wss.clients + displayClients）。

**Goal:** 把 app2-campus-service 拉到 app1 demo 穩定度水準：AI timeout / robot ACK polish / per-handler abort / state Map fallback / demo:check / 3-step closure audit / 現場災難 fail-safe / 5-view 亮點。

**Architecture:** Server-side 加 `withAiTimeout` 包 7 個 generateContent (top-level abortSignal)。前端用 per-handler abort hook 取代散落的 component-local controller。state 加 in-memory Map fallback。新增 `scripts/demo-readiness-check.mjs` + `server/api-contract.test.mjs` (SHOULD)。加 wakeLock / swipe-back disable / 離線 banner / 投影 chip。

**Tech Stack:** TypeScript 5.8, React 19, Express 4, `@google/genai` ^1.29, tsx, Vite 6, motion (animation), tone (audio synth), qrcode

**Spec reference:** [docs/superpowers/specs/2026-05-16-app2-demo-reliability-design.md](../specs/2026-05-16-app2-demo-reliability-design.md)

---

## File Map

| 檔案 | 修改性質 |
|------|----------|
| `apps/app2-campus-service/server/aiService.ts` | 加 `withAiTimeout` helper；7 個 generateContent 包裝（top-level abortSignal） |
| `apps/app2-campus-service/server/serialPort.ts` | sendCommand 加 1s write timeout guard + 友善 error message |
| `apps/app2-campus-service/src/hooks/useActionAbort.ts` | **新建**：per-handler AbortController hook |
| `apps/app2-campus-service/src/hooks/useWakeLock.ts` | **新建**：iPad 螢幕保持喚醒 |
| `apps/app2-campus-service/src/views/{TeachView,DeliveryView,LifeView,DispatchMapView,DashboardView}.tsx` | 改用 `useActionAbort` 取代散落 controller |
| `apps/app2-campus-service/src/state/appState.ts` | persistState 加 `_memoryFallback` Map |
| `apps/app2-campus-service/src/App.tsx` | wakeLock + swipe-back disable + 離線 banner + 投影 chip + reset 徹底化 |
| `apps/app2-campus-service/src/components/DemoClosureRail.tsx` | audit 3 step done 條件穩定性 |
| `apps/app2-campus-service/scripts/demo-readiness-check.mjs` | **新建** |
| `apps/app2-campus-service/server/api-contract.test.mjs` | **新建** (SHOULD 階段) |
| `apps/app2-campus-service/一鍵啟動展示.command` | **新建** |
| `apps/app2-campus-service/一鍵停止展示.command` | **新建** |
| `apps/app2-campus-service/docs/DEMO_SOAK_CHECKLIST.md` | **新建** (SHOULD) |
| `apps/app2-campus-service/package.json` | 加 `demo:check` + 更新 `check` script |

---

## Phase MUST — Demo 不能崩

### Task 0: 凍結 WIP baseline（5 min）

**Files:**
- Stage: 14 個 M 檔案 + 3 個新檔案

- [ ] **Step 1: 確認 WIP 綠燈**

```bash
cd apps/app2-campus-service && npm run check
```

預期：lint + 3 個 test + build 全綠（已驗）

- [ ] **Step 2: 分批 stage（不用 git add -A）**

```bash
cd "/Volumes/Tim aaddtional/Download/115資通訊/tedt"
git add apps/app2-campus-service/server/aiService.ts apps/app2-campus-service/server/serialBridge.ts
git add apps/app2-campus-service/src/App.tsx apps/app2-campus-service/src/views/TeachView.tsx apps/app2-campus-service/src/views/LifeView.tsx apps/app2-campus-service/src/views/DeliveryView.tsx
git add apps/app2-campus-service/src/components/life/VisionCameraCard.tsx apps/app2-campus-service/src/components/life/ScanMapCard.tsx apps/app2-campus-service/src/components/DemoClosureRail.tsx apps/app2-campus-service/src/components/tour/TourProvider.tsx
git add apps/app2-campus-service/src/components/CameraPicker.tsx apps/app2-campus-service/src/hooks/useCameraSelection.ts
git add apps/app2-campus-service/src/services/geminiAi.ts apps/app2-campus-service/src/services/hardwareBridge.ts
git add apps/app2-campus-service/.env.example apps/app2-campus-service/README.md
```

不 stage 的：`care-*.png`、`demo-00-*.png`、`final-clean.png`、`full-view.png`、`sensing-panel.png`、`clean-view.png` 等截圖 + `e2e-demo-flow.mjs` / `simulate-real-demo.mjs`（後續 demo:check 整合決定）。

- [ ] **Step 3: commit baseline**

```bash
git commit -m "$(cat <<'EOF'
feat(app2): finish WIP — Gemini migration, new AI endpoints, view refactor

- Migrate Gemma → hosted Gemini 2.5 flash naming (visionModel / textModel)
- Add /api/ai/teacher-reply, dispatch-recommend, student-report endpoints
- Split LifeView into VisionCameraCard + ScanMapCard
- Rewrite TeachView (344 lines) with real-time vision + roster
- Add CameraPicker + useCameraSelection for multi-camera
- 6 places of 503 fallback in serialBridge

Status: lint + 3 client tests green. Reliability hardening to follow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

預期：commit 成功，工作目錄只剩截圖等 untracked。

---

### Task 1: `withAiTimeout` helper + 7 個 generateContent 包裝（30 min）

**Files:**
- Modify: `apps/app2-campus-service/server/aiService.ts`

- [ ] **Step 1: 讀目前 aiService.ts 結構**

```bash
sed -n '1,80p' apps/app2-campus-service/server/aiService.ts
```

確認 `getAiErrorInfo`、`checkAiAccess`、`classifyVisionScene` 等 function 位置。

- [ ] **Step 2: 加 `withAiTimeout` helper（在 `getAiErrorInfo` 之後）**

在 `getAiErrorInfo` 結尾 `}` 之後、`export async function checkAiAccess` 之前插入：

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

- [ ] **Step 3: 包裝 line 54 (`checkAiAccess` 探針)**

找到：
```ts
await ai.models.generateContent({
  model: visionModel,
  contents: 'Return exactly OK.',
});
```

改為（`abortSignal` 在 `config` 內，per SDK 型別）：
```ts
await withAiTimeout((signal) =>
  ai.models.generateContent({
    model: visionModel,
    contents: 'Return exactly OK.',
    config: {abortSignal: signal},
  })
);
```

- [ ] **Step 4: 包裝 line 172 (`classifyVisionScene`)**

找到 `const response = await ai.models.generateContent({` 包到 `});`。

改為（`abortSignal` 是 `config` 的 field，與 `temperature` / `systemInstruction` 平級）：
```ts
const response = await withAiTimeout((signal) =>
  ai.models.generateContent({
    model: visionModel,
    config: {
      systemInstruction: '...',
      ...原 config 內容,
      abortSignal: signal,
    },
    contents: [...原 contents],
  })
);
```

- [ ] **Step 5: 包裝 line 203 (`analyzeDeliveryTask`), 219, 232, 245, 264**

每個 callsite 套同樣 pattern：包進 `withAiTimeout((signal) => ai.models.generateContent({..., config: {...原 config, abortSignal: signal}}))`。若原本沒 config 物件，新增 `config: {abortSignal: signal}`。

- [ ] **Step 6: lint 驗證**

```bash
cd apps/app2-campus-service && npm run lint
```

預期：0 errors。`abortSignal` 確認在 `GenerateContentConfig` 內（per SDK d.ts:4423-4432）。如果 lint 紅燈 → 檢查是不是不小心放 top-level，移回 config 內。**不要用 `as any` 繞**。

- [ ] **Step 7: Commit**

```bash
git add apps/app2-campus-service/server/aiService.ts
git commit -m "fix(app2): wrap 7 Gemini generateContent calls with withAiTimeout AbortController (top-level abortSignal)"
```

---

### Task 2: Robot ACK timeout 降級 polish（15 min）

**Files:**
- Modify: `apps/app2-campus-service/server/serialPort.ts`

韌體無 ACK echo 已驗（`grep -rn "ACK " firmware/` 無結果），不做 ACK wait。只 polish error + 加 write timeout guard。

- [ ] **Step 1: 加 port.write 1s timeout guard**

找到 `serialPort.ts:228-230`：
```ts
await new Promise<void>((resolve, reject) => {
  port.write(`${command}\n`, (error) => (error ? reject(error) : resolve()));
});
```

改為：
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

找到 `serialPort.ts:226`：
```ts
return {ok: false, message: telemetry.lastError ?? 'No Arduino available. Plug in the UNO R4 (WiFi or Minima) or set ARDUINO_PORT.'};
```

改為：
```ts
return {ok: false, message: telemetry.lastError ?? 'No Arduino available. 請插 UNO R4 並上傳 app2-sweeper-drive 韌體（pio run -e uno_r4_minima_app2_sweeper -t upload）'};
```

- [ ] **Step 3: lint 驗證**

```bash
cd apps/app2-campus-service && npm run lint
```

預期：0 errors。

- [ ] **Step 4: Commit**

```bash
git add apps/app2-campus-service/server/serialPort.ts
git commit -m "fix(app2): add 1s serial write timeout guard + clearer Arduino error message"
```

---

### Task 3: Per-handler abort hook + 5 views 套用（90 min — 大頭）

**Files:**
- Create: `apps/app2-campus-service/src/hooks/useActionAbort.ts`
- Modify: `apps/app2-campus-service/src/views/TeachView.tsx`, `DeliveryView.tsx`, `LifeView.tsx`, `DispatchMapView.tsx`, `DashboardView.tsx`

- [ ] **Step 1: 建立 `useActionAbort.ts` hook（含 token guard）**

token guard 防 race：舊 handler 的 finally end() 可能清掉新 controller。begin 回傳 token，end 只在 token 匹配時才清。

```bash
cat > apps/app2-campus-service/src/hooks/useActionAbort.ts <<'EOF'
import {useRef} from 'react';

/**
 * Per-handler abort controller with race-guarded end().
 *
 * Usage:
 *   const captureAbort = useActionAbort();
 *   async function handleCapture() {
 *     const {signal, token} = captureAbort.begin();
 *     try { await analyze({...}, signal); }
 *     catch (e) { if (e instanceof Error && e.name === 'AbortError') return; throw e; }
 *     finally { captureAbort.end(token); }  // 只有 token 匹配才清
 *   }
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

- [ ] **Step 2: Narrow audit — 哪些 view 真的需要改？**

per adversarial review：不要 retro 改全 5 view。先 audit 每個 view 哪個 handler 真的有問題。

```bash
grep -n "AbortController\|abortRef\|isCancelled\|setBusy" apps/app2-campus-service/src/views/*.tsx
```

判斷標準：
- ✅ 改：handler 無 abort + 重複呼叫會卡 busy / 切 view 後仍寫 state
- ✅ 改：handler 跨多 view 互相取消（rare in app2）
- ❌ 跳過：已有 component-local controller 且 useEffect cleanup 跑得正常的（如 VisionCameraCard）

列出需改的 handler 清單（預期 2-3 個 view，不是 5 個）。

- [ ] **Step 3: 套用到 audit 出的 handler**

針對每個有問題的 handler：

```ts
import {useActionAbort} from '../hooks/useActionAbort';
// ...
const captureAbort = useActionAbort();

async function handleCapture() {
  const {signal, token} = captureAbort.begin();
  try {
    // 既有邏輯，**把 fetch / service call 改傳 signal**
    const result = await analyzeCampusVision(imageBase64, signal);
    // ...
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return;
    // 既有錯誤處理
  } finally {
    captureAbort.end(token);
  }
}
```

**關鍵**：signal 必須真的傳進 service 層（見 Step 4），不然只 abort fetch 不會取消 in-flight AI 呼叫。

- [ ] **Step 4: service 層支援 signal**

讀 `apps/app2-campus-service/src/services/localAi.ts` 找 `askGemini`：

```bash
grep -n "askGemini\|function askGemini" apps/app2-campus-service/src/services/*.ts
```

若 `askGemini` 沒接 `signal?: AbortSignal`，加：

```ts
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

`hardwareBridge.ts` / `geminiAi.ts` 其他客戶端 fetch wrapper 同樣加 signal 參數。所有呼叫鏈 handler → service → fetch 都把 signal 傳進去。

注意：component-local controller（VisionCameraCard line 119）只負責 cleanup 不需 signal 傳遞 — 保留不動。

- [ ] **Step 5: 對 Step 2 audit 出的每個 view 逐一改（**僅有問題的 handler**，非 retro 全 5 view）**

針對每個 view + 每個確認有問題的 handler 套用 Step 3 pattern。每改一個 handler 跑 `npm run lint`。

預期 view 範圍（per Step 2 audit）：通常 2-3 個 view（如 TeachView capture/AI、DeliveryView dispatch、LifeView broadcast），非全 5 view。**WIP 已綠的 component-local controller 保留不動**。

- [ ] **Step 6: 跑 rollback tag 標記點（高風險 task 前置）**

在 commit 前打 tag：
```bash
git tag rollback-pre-task3-app2
```
若後續發現 view abort 改壞，可 `git reset --hard rollback-pre-task3-app2` 回退。

- [ ] **Step 7: 全套 lint 驗證**

```bash
cd apps/app2-campus-service && npm run lint
```

預期：0 errors。

- [ ] **Step 8: 手動測試 — 快速連點不卡 busy**

```bash
cd apps/app2-campus-service && npm run dev
```

在瀏覽器：問題 view 快速連點 3 次，busy state 重置不卡；切到他 view 立刻派遣，舊 in-flight 應 abort。

- [ ] **Step 9: Commit（依實際改的檔案 stage）**

```bash
# 範例：實際 view 依 audit 結果調整
git add apps/app2-campus-service/src/hooks/useActionAbort.ts apps/app2-campus-service/src/services/localAi.ts
# 加 audit 後實際改的 view（不一定是 5 個）
git add apps/app2-campus-service/src/views/TeachView.tsx  # 例
git commit -m "feat(app2): per-handler useActionAbort hook + signal propagation to service layer"
```

備註：若全 5 view 都檢驗後實際只改 2-3 個，commit message 反映實際範圍。預估時間從原 90 min 可降到 **60 min**（audit narrow scope 後）。

---

### Task 4: state localStorage Map fallback（20 min）

**Files:**
- Modify: `apps/app2-campus-service/src/state/appState.ts`

- [ ] **Step 1: 加 `_memoryFallback` Map**

找到 `STORAGE_KEY` 宣告附近（搜 `const STORAGE_KEY`）。加：

```ts
const _memoryFallback = new Map<string, AppState>();
```

- [ ] **Step 2: 改 `persistState`（line 1055-1075）**

```ts
export function persistState(state: AppState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    _memoryFallback.delete(STORAGE_KEY);
  } catch (error) {
    if (error instanceof DOMException && (error.code === 22 || error.name === 'QuotaExceededError')) {
      const trimmed = {...state, logs: state.logs.slice(0, 30), robotCommandLogs: state.robotCommandLogs.slice(0, 30)};
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        _memoryFallback.delete(STORAGE_KEY);
        return;
      } catch {
        // 連 trim 都不行 → 落 memory
      }
    }
    _memoryFallback.set(STORAGE_KEY, state);
  }
}
```

- [ ] **Step 3: 改 load 函數加 memory fallback**

找到 `loadPersistedState`（或 init reducer 從 localStorage 取的地方）：
```ts
const raw = window.localStorage.getItem(STORAGE_KEY);
```

改為：
```ts
let raw: string | null = null;
try {
  raw = window.localStorage.getItem(STORAGE_KEY);
} catch {
  // private mode read 也可能 throw
}
if (raw !== null) {
  // 既有解析邏輯
} else {
  // 試 memory fallback
  const memState = _memoryFallback.get(STORAGE_KEY);
  if (memState) return memState;
}
```

- [ ] **Step 4: 跑 appState.test 確認沒破**

```bash
cd apps/app2-campus-service && npm run test
```

預期：`appState.test.ts` + `localAi.test.ts` + `localVision.test.ts` 全綠。

- [ ] **Step 5: Commit**

```bash
git add apps/app2-campus-service/src/state/appState.ts
git commit -m "feat(app2): add in-memory Map fallback for localStorage Quota (iOS Safari private mode safe)"
```

---

### Task 5: demo:check script（30 min）

**Files:**
- Create: `apps/app2-campus-service/scripts/demo-readiness-check.mjs`
- Modify: `apps/app2-campus-service/package.json`

- [ ] **Step 1: 建 scripts/ 目錄 + 仿 app1 模板**

```bash
mkdir -p apps/app2-campus-service/scripts
```

複製 app1 模板 + adapt：

```bash
cat > apps/app2-campus-service/scripts/demo-readiness-check.mjs <<'SCRIPT'
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
      checkEndpoint('POST', `${base}/api/ops/reset`, {}, 'ops/reset'),
      checkEndpoint('GET',  `${base}/api/ai/status`, undefined, 'ai/status'),
      checkEndpoint('POST', `${base}/api/ai/vision-classify`, {imageBase64: TINY_PNG}, 'ai/vision-classify'),
      checkEndpoint('POST', `${base}/api/ai/classroom-scan`, {imageBase64: TINY_PNG}, 'ai/classroom-scan'),
      checkEndpoint('POST', `${base}/api/robot/command`, {command: 'BEEP'}, 'robot/command'),
      checkEndpoint('POST', `${base}/api/robot/task`, {action: 'PATROL', regionId: 'A'}, 'robot/task'),
      checkEndpoint('GET',  `${base}/api/display/info`, undefined, 'display/info'),
      checkEndpoint('GET',  `${base}/api/display/status`, undefined, 'display/status'),
    ]);

    let allOk = true;
    for (const r of results) {
      const tag = r.ok ? 'PASS' : 'FAIL';
      console.log(`[${tag}] ${r.label.padEnd(25)} ${r.status || '---'} ${r.url}${r.error ? ' ' + r.error : ''}`);
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

讀 `apps/app2-campus-service/package.json`，在 `"scripts": {...}` 內加：
```json
"demo:check": "node scripts/demo-readiness-check.mjs",
```

- [ ] **Step 3: 試跑（sim mode）**

```bash
cd apps/app2-campus-service && DEMO_SIMULATE_HARDWARE=1 npm run demo:check
```

預期：10 個 endpoint PASS。

- [ ] **Step 4: Commit**

```bash
git add apps/app2-campus-service/scripts/demo-readiness-check.mjs apps/app2-campus-service/package.json
git commit -m "feat(app2): add demo:check script — 10 endpoint pre-flight health probe"
```

---

### Task 6: 一鍵啟動 / 一鍵停止 .command（20 min）

**Files:**
- Create: `apps/app2-campus-service/一鍵啟動展示.command`
- Create: `apps/app2-campus-service/一鍵停止展示.command`

- [ ] **Step 1: 讀 app3 既有 .command 當模板**

```bash
cat "apps/app3-guardian/一鍵啟動展示.command"
```

理解結構：port detection / kill old process / start bridge + vite / open browser。

- [ ] **Step 2: 寫 app2 啟動 script**

```bash
cat > "apps/app2-campus-service/一鍵啟動展示.command" <<'SCRIPT'
#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

BRIDGE_PORT=3202

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
echo "✓ App2 已啟動"
echo "✓ 主畫面 (學生)    : http://localhost:$VITE_PORT"
echo "✓ Bridge API       : http://localhost:$BRIDGE_PORT/api/health"
echo "✓ 第二螢幕         : http://localhost:$VITE_PORT/#robot"
echo ""
echo "按 Ctrl+C 停止，或執行 一鍵停止展示.command"

open "http://localhost:$VITE_PORT" 2>/dev/null || true

wait $DEV_PID
SCRIPT
chmod +x "apps/app2-campus-service/一鍵啟動展示.command"
```

- [ ] **Step 3: 寫停止 script**

```bash
cat > "apps/app2-campus-service/一鍵停止展示.command" <<'SCRIPT'
#!/usr/bin/env bash
echo "==> 停止 app2 (bridge :3202 + vite)"
lsof -ti:3202 2>/dev/null | xargs -r kill -9 2>/dev/null || true
pkill -f "vite.*app2-campus-service" 2>/dev/null || true
pkill -f "tsx server/serialBridge" 2>/dev/null || true
echo "✓ 停止完成"
sleep 2
SCRIPT
chmod +x "apps/app2-campus-service/一鍵停止展示.command"
```

- [ ] **Step 4: 手動測試**

雙擊 `一鍵啟動展示.command` → 看到 ✓ 訊息 + 瀏覽器開啟。
雙擊 `一鍵停止展示.command` → 確認 port 3202 釋放。

- [ ] **Step 5: Commit**

```bash
git add "apps/app2-campus-service/一鍵啟動展示.command" "apps/app2-campus-service/一鍵停止展示.command"
git commit -m "feat(app2): add 一鍵啟動/停止.command launcher scripts (port detect + kill-old)"
```

---

### Task 7: 3-step 閉環 audit + 亮點 audit fix（60 min）

**Files:**
- Modify: `apps/app2-campus-service/src/components/DemoClosureRail.tsx`
- Modify: `apps/app2-campus-service/src/state/appState.ts`
- Modify: 5 views (verification only, fix where needed)

- [ ] **Step 1: Audit 3 step done 條件穩定性**

讀 `DemoClosureRail.tsx:21-29`：
```ts
const doneById: Record<string, boolean> = {
  teach: state.attendance.scanned,
  delivery: state.orders.length > 2,
  life: state.tasks.some((task) => task.source === 'dispatch'),
};
```

問題分析：
- `delivery: state.orders.length > 2` 寫死 2（預載數量），不穩定
- `life: task.source === 'dispatch'` 字串嚴格 match

- [ ] **Step 2: 引入 INITIAL_ORDERS_COUNT 常數**

讀 `appState.ts` 找 `createInitialAppState`。確認初始 orders 陣列長度，假設為 2，加 export：

```ts
// appState.ts
export const INITIAL_ORDERS_COUNT = 2;  // 預載 demo 訂單數，DemoClosureRail 用此判斷 delivery 完成
```

- [ ] **Step 3: DemoClosureRail 用常數**

```ts
import {INITIAL_ORDERS_COUNT} from '../state/appState';
// ...
delivery: state.orders.length > INITIAL_ORDERS_COUNT,
```

- [ ] **Step 4: 確認 teach step 在 TeachView 確實 emit done**

```bash
grep -n "setAttendance\|attendance.scanned\|dispatch({type: 'SET_ATTENDANCE" apps/app2-campus-service/src/views/TeachView.tsx
```

確認 WIP 重構後 TeachView 在點完點名 + AI 分析時呼叫 `setAttendance({scanned: true})`。若無，補上。

- [ ] **Step 5: 確認 life step 在 LifeView 確實 emit done**

```bash
grep -n "source: 'dispatch'\|addTask\|dispatch({type: 'ADD_TASK" apps/app2-campus-service/src/views/LifeView.tsx
```

確認 LifeView 派遣按鈕觸發 `addTask({source: 'dispatch', ...})`。

- [ ] **Step 6: 亮點 audit — 配送 SVG 動畫**

```bash
grep -n "animateMotion\|<motion\.\|Truck\|robot.*svg" apps/app2-campus-service/src/views/DeliveryView.tsx
```

若無 SVG path animation：在地圖區域加：
```tsx
<svg className="absolute inset-0 pointer-events-none" viewBox="0 0 100 100">
  <path id="route" d="M 10 90 Q 50 50 90 10" fill="none" stroke="rgba(59,130,246,0.3)" strokeWidth="2" />
  {dispatching && (
    <circle r="3" fill="#3b82f6">
      <animateMotion dur="3s" repeatCount="indefinite">
        <mpath href="#route" />
      </animateMotion>
    </circle>
  )}
</svg>
```

- [ ] **Step 7: 亮點 audit — 廣播 Tone.js 真實播放**

```bash
grep -n "Tone\." apps/app2-campus-service/src/views/LifeView.tsx apps/app2-campus-service/src/components/life/*.tsx
```

若未 wire：在廣播觸發 handler 加：
```tsx
import * as Tone from 'tone';
async function playBroadcast() {
  await Tone.start();
  const synth = new Tone.Synth().toDestination();
  synth.triggerAttackRelease('C5', '0.3');
  synth.triggerAttackRelease('E5', '0.3', '+0.3');
  synth.triggerAttackRelease('G5', '0.3', '+0.6');
}
```

- [ ] **Step 8: 亮點 audit — 派遣地圖 pulse + QR code**

```bash
grep -n "animate-pulse\|qrcode\|QRCode" apps/app2-campus-service/src/views/DispatchMapView.tsx apps/app2-campus-service/src/views/StudentReportView.tsx
```

DispatchMapView active zone 加 `className="... animate-pulse"`。StudentReportView 在報告生成完成時用 `qrcode` 套件生 data URL：
```tsx
import QRCode from 'qrcode';
const [qrDataUrl, setQrDataUrl] = useState('');
useEffect(() => {
  if (reportMarkdown) QRCode.toDataURL(reportShareUrl).then(setQrDataUrl);
}, [reportMarkdown, reportShareUrl]);
// 顯示
{qrDataUrl && <img src={qrDataUrl} alt="掃我看報告" className="w-32 h-32" />}
```

- [ ] **Step 9: 跑 check 確認沒破**

```bash
cd apps/app2-campus-service && npm run check
```

預期：lint + test + build 全綠。

- [ ] **Step 10: Commit**

```bash
git add apps/app2-campus-service/src/components/DemoClosureRail.tsx apps/app2-campus-service/src/state/appState.ts apps/app2-campus-service/src/views/TeachView.tsx apps/app2-campus-service/src/views/LifeView.tsx apps/app2-campus-service/src/views/DeliveryView.tsx apps/app2-campus-service/src/views/DispatchMapView.tsx apps/app2-campus-service/src/views/StudentReportView.tsx
git commit -m "feat(app2): 3-step closure audit + highlight wire-up (Tone broadcast / SVG dispatch animation / animate-pulse / QR code)"
```

---

### Task 8: 現場災難 fail-safe (L)（45 min）

**Files:**
- Create: `apps/app2-campus-service/src/hooks/useWakeLock.ts`
- Modify: `apps/app2-campus-service/src/App.tsx`

- [ ] **Step 1: 建立 useWakeLock hook**

```bash
cat > apps/app2-campus-service/src/hooks/useWakeLock.ts <<'EOF'
import {useEffect} from 'react';

/**
 * Keep iPad / mobile screen awake during demo. Releases on unmount.
 * Silently no-ops on browsers without wakeLock API (Safari iOS 16.4+).
 */
export function useWakeLock(active: boolean = true): void {
  useEffect(() => {
    if (!active) return;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let released = false;
    (async () => {
      try {
        sentinel = await (navigator as any).wakeLock.request('screen');
        // visibility change 時 wake lock 會自動釋放，需在 focus 回來時重新取得
        const handler = async () => {
          if (document.visibilityState === 'visible' && !released) {
            try { sentinel = await (navigator as any).wakeLock.request('screen'); } catch {}
          }
        };
        document.addEventListener('visibilitychange', handler);
        return () => document.removeEventListener('visibilitychange', handler);
      } catch {
        // 失敗就算了，例如未啟用權限
      }
    })();
    return () => {
      released = true;
      sentinel?.release().catch(() => {});
    };
  }, [active]);
}
EOF
```

- [ ] **Step 2: App.tsx 套用 useWakeLock**

讀 `src/App.tsx`，在 `AppContent` 內加：

```ts
import {useWakeLock} from './hooks/useWakeLock';
// ...
useWakeLock(true);  // 整個 demo 期間保持喚醒
```

- [ ] **Step 3: App.tsx 加 Safari swipe-back 防呆**

```ts
useEffect(() => {
  if (typeof window === 'undefined') return;
  const handler = () => {
    window.history.pushState(null, '', window.location.href);
    // 也可選擇 showToast 提示，但 popstate 監聽不主動觸發 toast 因為 PopStateEvent 是被動的
  };
  window.history.pushState(null, '', window.location.href);
  window.addEventListener('popstate', handler);
  return () => window.removeEventListener('popstate', handler);
}, []);
```

- [ ] **Step 4: 加離線 banner — 偵測 useProxyHealth 連續失敗**

讀 `src/hooks/useProxyHealth.ts`。確認回傳含 `online: boolean` + `failureCount: number`。若無 failureCount，加：

```ts
// useProxyHealth.ts 內
const [failureCount, setFailureCount] = useState(0);
// 在 fetch fail 時 setFailureCount(c => c + 1)
// 在 fetch ok 時 setFailureCount(0)
return {online, failureCount};
```

App.tsx 用：
```tsx
const {online, failureCount} = useProxyHealth();
{failureCount >= 3 && (
  <div className="fixed top-0 inset-x-0 z-50 bg-amber-500 text-white text-sm font-bold px-4 py-2 text-center shadow-lg">
    離線備援模式 — 影像辨識用本機分析 ·
    <button onClick={() => window.location.reload()} className="ml-2 underline">重試</button>
  </div>
)}
```

- [ ] **Step 5: 加投影 URL chip**

App.tsx 在 RobotDisplaySync 旁加：
```tsx
{process.env.NODE_ENV === 'production' || window.location.search.includes('show-cast') ? (
  <div className="fixed bottom-2 right-2 z-40 bg-black/70 text-white text-xs px-2 py-1 rounded">
    投影 URL: {window.location.origin}/#robot
  </div>
) : null}
```

- [ ] **Step 6: 跑 lint + 手動驗證**

```bash
cd apps/app2-campus-service && npm run lint
```

預期：0 errors。

手動：開 dev，模擬：
- 切到他 tab 等 5 秒回來 → wakelock 仍有效
- iOS Safari swipe back → 不會退出 demo
- Chrome devtool → Network → Offline → 看離線 banner

- [ ] **Step 7: Commit**

```bash
git add apps/app2-campus-service/src/hooks/useWakeLock.ts apps/app2-campus-service/src/App.tsx apps/app2-campus-service/src/hooks/useProxyHealth.ts
git commit -m "feat(app2): on-site disaster fail-safe — wakeLock + swipe-back disable + offline banner + projection chip"
```

---

### Task 8.5: Demo Rehearsal Script + 連續驗收（45 min — per adversarial review 5）

**Files:**
- Create: `apps/app2-campus-service/docs/DEMO_REHEARSAL.md`

per adversarial review 5：spec 解工程可靠性多於「學生手忙腳亂仍能展示」。需要固定的學生 demo script + iPad+投影+robot-app+實體 Arduino 連續走完的驗收。

- [ ] **Step 1: 寫 DEMO_REHEARSAL.md（學生視角逐句操作）**

```markdown
# App2 Demo Rehearsal Script — 學生 7 分鐘逐句腳本

## 開場（30 秒）
1. 按下「教學陪跑」 → 等 closure rail 顯示 1/3
2. 念：「我們現在示範教學陪跑機器人會做的事」

## 教學流程（2 分鐘）
1. 按「拍攝白板」→ 等 AI 圖框出現
2. 念：「AI 即時辨識出白板的字，這是真實的 Gemini Vision 不是假的」
3. 按「點名」逐項勾選 → counter 跳 1/3 ✓
4. 念：「教學完成，可以看到 X 個學生有來」

## 配送流程（2 分鐘）
1. 切到「配送」tab
2. 按「派遣配送」 → 看 SVG 動畫機器人移動
3. 念：「機器人沿路徑移動，這也是真實送指令給 Arduino」
4. 等抵達 toast → counter 跳 2/3 ✓

## 生活流程（2 分鐘）
1. 切到「生活」tab
2. 按「開啟視覺」→ 看真實校園影像辨識
3. 念：「scene 分類為 X，廣播系統會自動觸發」
4. 觀察 Tone.js 廣播音效真的響
5. counter 跳 3/3 ✓

## 結尾（30 秒）
1. closure rail 3/3 完成
2. 念：「整個 demo 三個流程都閉環了，請評審看右下角投影 URL 可以掃 QR」
```

- [ ] **Step 2: 連續走完一次（含硬體）**

開 iPad mirror 到投影機 + bridge + 接上 Arduino + 另一台裝置開 robot-display 第二螢幕。

照 script 從頭到尾走一次，記錄每段花的時間 + 卡住的地方。

預期問題：
- 投影鏡像比例（→ 用 L 段加的投影 chip 校正）
- 鏡像 + Tone.js 廣播音量是否到喇叭
- 廣播 tone 跟機器人馬達聲衝不衝突
- 7 分鐘是否合適（demo 範圍可調）

- [ ] **Step 3: 把驗收結果加進 rehearsal md 底部 + commit**

```bash
git add apps/app2-campus-service/docs/DEMO_REHEARSAL.md
git commit -m "docs(app2): demo rehearsal script + first dry run results"
```

---

### Phase MUST 收尾

- [ ] **Final Check + rollback tag**

```bash
cd apps/app2-campus-service && npm run check
git tag must-app2-done
```

預期：全綠。如紅燈不進 SHOULD。

- [ ] **手動驗收 checklist（MUST 7 項）**

1. 拔網 (Chrome devtool Offline) → 點 capture → 20s 內 fallback 不 hang
2. 拔線 → 點 robot/command → 503 顯示拔線提示（不假裝成功）
3. 快速連點 capture 3 次 → busy 不卡 / 舊 abort（且 abort 真的傳到 service 層）
4. iOS Safari 私密模式 → state 走 memory fallback
5. 跑 demo 3 個 view → DemoClosureRail 顯示 3/3 完成
6. iPad swipe back → 不退出 demo
7. 跑完 DEMO_REHEARSAL.md 整套 7 分鐘 — 學生腳本順、評審看得懂亮點

---

## Phase SHOULD — Demo 體驗順

### Task 9: Reset 徹底化 + 第二螢幕 sync（30 min）

**Files:**
- Modify: `apps/app2-campus-service/src/state/appState.ts`, `App.tsx`, `RobotDisplaySync.tsx`

- [ ] **Step 1: 加 RESET_DEMO action**

`appState.ts` 加：
```ts
case 'RESET_DEMO':
  // 保留 settings/cameraSelection 等使用者偏好，清 demo 資料
  return {...createInitialAppState(), cameraSelection: state.cameraSelection, settings: state.settings};
```

- [ ] **Step 2: useAppActions 暴露 resetDemo**

```ts
const resetDemo = useCallback(() => {
  dispatch({type: 'RESET_DEMO'});
  try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
  _memoryFallback.delete(STORAGE_KEY);
}, []);
```

- [ ] **Step 3: WS broadcast demo_reset**

App.tsx 用 useHardwareSocket / fetch 觸發：
```ts
async function handleResetDemo() {
  resetDemo();
  await fetch(`${BRIDGE_URL}/api/ops/reset`, {method: 'POST'}).catch(() => {});
  // ops/reset 內已會 broadcast 'demo_reset' 給 WS clients
}
```

- [ ] **Step 4: RobotDisplaySync 收聽 demo_reset**

讀 `RobotDisplaySync.tsx`。在既有 WS message handler 加：
```ts
if (msg.type === 'demo_reset') {
  setEmotion('calm');
  setMission(null);
  // 重置所有第二螢幕 local state
}
```

- [ ] **Step 5: serialBridge `/api/ops/reset` 廣播兩個 WS channel**

讀 `serialBridge.ts:339` 周邊。**rigor review 9**：app2 有兩套 WS channel：`wss.clients` (全廣播) 跟 `displayClients` (第二螢幕 subscriber set, line 77+)。Reset 必須兩個都廣播：

```ts
const resetMsg = {type: 'demo_reset', timestamp: Date.now()};
broadcast(resetMsg);  // wss.clients 全廣播
sendToDisplayClients(resetMsg);  // displayClients 第二螢幕，不然 RobotDisplaySync 收不到
```

- [ ] **Step 6: 手動驗證**

開 demo，跑幾個動作累積 state；點 reset；確認所有 view 歸初始、第二螢幕也重置、demo closure counter 0/3。

- [ ] **Step 7: Commit**

```bash
git add apps/app2-campus-service/src/state/appState.ts apps/app2-campus-service/src/App.tsx apps/app2-campus-service/src/components/RobotDisplaySync.tsx apps/app2-campus-service/server/serialBridge.ts
git commit -m "feat(app2): Reset demo broadcasts demo_reset to all WS clients + RobotDisplaySync responds"
```

---

### Task 10: K 亮點補完（30 min）

Audit Task 7 後仍 ❓ 的項目實作到位。每項獨立 commit。

- [ ] **Step 1: 列出 Task 7 audit 後仍缺的亮點**

從 commit 訊息 / spec K 表回看哪些 ❓ 未實作。

- [ ] **Step 2-N: 逐項補完並 commit**

每項一個 commit，message: `feat(app2): wire up <highlight name> highlight`

---

### Task 11: api-contract.test.mjs（60 min）

**Files:**
- Create: `apps/app2-campus-service/server/api-contract.test.mjs`
- Modify: `apps/app2-campus-service/package.json` (加進 `check` script)

- [ ] **Step 1: 仿 app1 模板建立**

複製 `apps/app1-whiteboard/server/api-contract.test.mjs` 為起點，改 app2 endpoint。

- [ ] **Step 2: 覆蓋 21 個 endpoint**

每個 endpoint 一個 case，含正確 payload（per spec）。

範例片段：
```js
{
  const {response, body} = await request('/api/health');
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
}
{
  const {response, body} = await request('/api/ai/teacher-reply', {
    method: 'POST',
    body: JSON.stringify({question: '測試問題'}),
  });
  assert.ok([200, 503].includes(response.status), `teacher-reply status ${response.status}`);
}
// ...
```

- [ ] **Step 3: 加進 check script**

`package.json`：
```json
"check": "npm run test && tsx server/api-contract.test.mjs && npm run lint && npm run build"
```

- [ ] **Step 4: 跑 check 確認**

```bash
cd apps/app2-campus-service && npm run check
```

預期：全綠。

- [ ] **Step 5: Commit**

```bash
git add apps/app2-campus-service/server/api-contract.test.mjs apps/app2-campus-service/package.json
git commit -m "test(app2): add api-contract.test.mjs covering all 21 endpoints"
```

---

### Task 12: DEMO_SOAK_CHECKLIST + 跑一次（45 min）

**Files:**
- Create: `apps/app2-campus-service/docs/DEMO_SOAK_CHECKLIST.md`

- [ ] **Step 1: 寫 checklist md**

```markdown
# App2 Demo Soak Checklist（30 min 手動驗證）

開 demo + DevTools Memory + Performance tab。

## 流程（每 5 min 切一次 view，重複 6 輪）

1. 教學 → 拍攝白板 + 點名 → 等 AI 回應 → 完成
2. 配送 → 派遣訂單 → 觀察 SVG 動畫 → 完成
3. 生活 → 啟動 vision → 廣播 → 觀察 tone 音效 → 完成
4. 點 reset → counter 歸 0
5. 重複 5 次

## 驗收指標

- [ ] JS heap (Chrome devtool Memory) 30 min 後不應持續增長（GC 後回到初始 ±10MB 內）
- [ ] WS 重連次數 < 5 次
- [ ] localStorage 大小 < 1MB（用 `JSON.stringify(localStorage).length`）
- [ ] 廣播 tone.js 第 20 次仍能正常播放
- [ ] iPad mirror 到 1080p 投影機 layout 不破版
- [ ] 第二螢幕 30 min 後仍 sync 即時
```

- [ ] **Step 2: 跑一次 soak**

開 demo 30 min，跑 6 輪流程，紀錄 metrics。把結果加進 checklist md 底部。

- [ ] **Step 3: Commit**

```bash
git add apps/app2-campus-service/docs/DEMO_SOAK_CHECKLIST.md
git commit -m "docs(app2): add DEMO_SOAK_CHECKLIST + first soak run results"
```

---

### Phase SHOULD 收尾

```bash
cd apps/app2-campus-service && npm run check
```

預期：全綠 + api-contract test 也綠。

---

## Phase NICE — 工程潔癖 / 後續精進

以下任務**只在時間餘裕時做**。每個獨立 task，可單獨 ship。

### Task 13: defaults.ts（30 min）

**Files:** Create `apps/app2-campus-service/server/defaults.ts`

抽 demo 預設值集中。`aiService.ts` + endpoint handlers 引用。

- [ ] Step 1: 抽 DEMO_ZONES / DEMO_BROADCASTS / AI_PROMPT_TEMPLATES
- [ ] Step 2: 各引用點 import
- [ ] Step 3: check 綠
- [ ] Step 4: commit

---

### Task 14: hardwareSimulation.test.ts（45 min）

**Files:** Create `apps/app2-campus-service/server/hardwareSimulation.test.ts`

仿 app1 同名檔。sim mode 下 endpoint 200 / sendCommand 模擬 ACK / WS broadcast 觸發。

加進 `check` script。

- [ ] Step 1: 仿 app1 結構
- [ ] Step 2: 15-20 個 assertion
- [ ] Step 3: 加 check script
- [ ] Step 4: commit

---

### Task 15: directGemini.ts（60 min — 條件式）

**只做於：規劃 GitHub Pages public deploy 時**。比賽現場有 bridge 不需要。

**Files:** Create `apps/app2-campus-service/src/services/directGemini.ts`

仿 app1。4 個 function: directClassifyVisionScene / directGenerateTeacherReply / directGenerateDispatchRecommendation / directGenerateStudentReport。

`geminiAi.ts` 偵測 bridge fail 自動切。

- [ ] Step 1-N: per app1 pattern

---

### Task 16: serialBridge 拆檔（90 min — 條件式）

**只做於：時間餘裕 + regression test 都綠**。

**Files:** Create wsBroadcast.ts / routes/aiRoutes.ts / routes/robotRoutes.ts / validation.ts。重構 `serialBridge.ts` 444 → ~220 行。

注意 rigor review 8：兩套 WS channel (wss.clients + displayClients) 都要 export。

- [ ] Step 1: 抽 wsBroadcast.ts (2 channels)
- [ ] Step 2: 抽 validation.ts
- [ ] Step 3: 抽 aiRoutes.ts (用工廠函數注入 deps)
- [ ] Step 4: 抽 robotRoutes.ts
- [ ] Step 5: serialBridge.ts 改用 routes mount
- [ ] Step 6: 跑完整 api-contract test 確認 0 regression
- [ ] Step 7: commit

---

## 全 phase 收尾

```bash
cd apps/app2-campus-service && npm run check
```

預期：全綠。

**最終手動驗收（demo 視角 10 項）** — per spec 成功標準。

---

## 估計總時長（per dual review 校準）

| Task | Est | Notes |
|---|---|---|
| 0 WIP commit baseline | 5 min | mechanical |
| 1 withAiTimeout × 7 callsite | 30 min | mechanical |
| 2 ACK 503 polish | 15 min | small |
| 3 Per-handler abort (narrow + service signal) | 60 min | 90→60 narrow scope |
| 4 state Map fallback | 20 min | |
| 5 demo:check script | 30 min | mechanical |
| 6 一鍵啟停.command | 20 min | |
| 7 Closure 3-step + 亮點 audit | 60 min | 跨檔 audit |
| 8 現場災難 fail-safe (L) | 45 min | UX 整合 |
| **8.5 Demo rehearsal + 連續驗收** | 45 min | **new per adv review** |
| **MUST 小計** | **5.5 hrs** | + 20% buffer = **6.5 hrs** |
| SHOULD 9-12 | 2.75 hrs | + buffer = 3.5 hrs |
| NICE 必做 (13-14) | 1.25 hrs | + buffer = 1.5 hrs |
| NICE 條件式 (15-16) | +2.5 hrs | optional |

**Solo 合計**: ~11.5 hrs MUST+SHOULD+NICE 必做（不含 NICE 條件式）
**平行派 codex**: ~7-8 hrs
**比賽現場準備**: 完成到 SHOULD 即可 demo，NICE 可後做

**Adversarial review 1 提醒**: 不是 8 hr，是無緩衝 11.5 hr 起跳。每個高風險 task 前打 rollback tag（Task 3, 7, 8, 11）：
```bash
git tag rollback-pre-task<N>-app2
```

---

## Codex 平行派送點

獨立 chunk 可派 `codex-x "<task spec>"`：

- Task 1 (withAiTimeout 7 callsite) — pure mechanical wrap
- Task 4 (state Map fallback) — focused state edit
- Task 5 (demo:check script) — copy + adapt
- Task 11 (api-contract.test) — 21 endpoint mechanical write
- Task 14 (hardwareSimulation.test) — sim mode mechanical
- Task 15 / 16 (directGemini / serialBridge split) — 大塊獨立工作

Claude 主力做：Task 3 (per-handler abort 套 5 view — 需 view 上下文)、Task 7 (closure + highlight audit — 需跨檔判斷)、Task 8 (災難 fail-safe — UX 整合)、Task 9 (Reset 徹底化 — 跨 client/server)。
