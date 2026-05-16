# App3 校園心靈守護者 — Demo 可靠性 + 閉環亮點設計

**日期**: 2026-05-16
**範圍**: `apps/app3-guardian/`（含 `robot-app/` 第二螢幕子專案）
**目標**: 把 app3 拉到 app1 同等的「比賽展示穩定度」— 五段閉環（訊號融合 → 預警成案 → 派遣處置 → 學生支持 → 回報結案）任何條件下都能跑完，第二螢幕情緒切換動畫不卡，每段閉環有明確完成證明跟亮點。
**非目標**: 上線級別 rate-limit / authn / observability。Firebase 仍是「未來可接選項」，本 spec 不開 production firebase。

---

## 現況審計（WIP 已做、缺什麼）

WIP 為 855 行未提交修改中包含 app3 的 ~7 個檔案，`npm run check` 已綠（lint + 4 個 client test 全過，含 emotionTypography / visualPrivacyGuardian / localGuardianAi / guardianState 500-round pixel validation）。

### 已做 ✅

- **AbortController 4 處**: `useHardwareSocket.ts`, `useProxyHealth.ts`, `services/hardwareBridge.ts`, `services/geminiAi.ts`
- **server emotion analysis AbortController**: `server/aiService.ts:135` 用 30s controller
- **localStorage memory fallback comment**: `guardianState.ts:560` catch 後 in-memory only
- **WS reconnect + 初始 push**: `useHardwareSocket.ts`, server 連線時即送 `arduino_status`
- **5 段閉環 counter**: `buildDemoClosureSteps()` in `App.tsx:1526` 用 `done` 陣列計算 `doneCount/totalCount`，狀態列顯示「閉環: N/5」
- **新 EmotionAnalysis pipeline**: WIP 在 server/aiService.ts 加 114 行（`EmotionAnalysis` interface, `stripDataUrl`, `parseJsonLoose`, `clampInt`, `localEmotionFallback`, `analyzeEmotionWithAI`）
- **GuardianControlPanel 改造**: WIP 40 行修改
- **hardwareBridge 改造**: WIP 59 行（含 retry / fallback 改良）
- **第二螢幕端點**: `/api/display/guardian-snapshot`, `/api/display/robot-assignment`, `/api/display/emotion-event`, `/api/display/emotion`（已有完整 emotion event 路徑）
- **一鍵啟動.command**: 已存在（git status 顯示 M，WIP 有改）

### 缺 ❌（要做的真實清單）

| ID | 缺什麼 | 位置 |
|----|--------|------|
| A | `withAiTimeout` helper 沒寫；`generateContent` 2 處 (1 在 `analyzeGuardianAlert` line 51 無 controller / 1 在 `analyzeEmotionWithAI` line 139 有 30s controller 但**未傳 abortSignal 到 generateContent**) | `server/aiService.ts:51,139` |
| B | Robot ACK `result.timedOut` → 503 早返回沒寫 | `server/serialBridge.ts` `/api/robot/command:471` |
| C | AbortController 全 component-local，無 module-scoped + generation counter pattern。view 切換時殘留 in-flight 可能寫錯 state | App.tsx 內各 panel handler（不像 app2 拆成多 view，app3 集中在 App.tsx 跟 GuardianControlPanel）|
| D | `localStorage` 是「fail then memory only」隱式，無顯式 Map fallback，重新讀取時無法從 memory 救回 | `guardianState.ts:550-565` 周邊 |
| F | `demo:check` script + `scripts/` 目錄不存在 | `scripts/demo-readiness-check.mjs` 待建 |
| G | 一鍵啟動.command 已存在但 WIP 有改動，需驗證仍可跑 + 加 port-conflict 自動 kill | `apps/app3-guardian/一鍵啟動展示.command` |
| H | server 端 test 全缺（無 `api-contract.test.mjs` / 無 hardwareSimulation test） | `server/*.test.*` |
| J | 5 段閉環 done 判斷邏輯靠 substring match `'示範'`（line 1527-1535）— **脆弱**，學生若實際操作沒觸發特定文字 done 就不會亮 | `App.tsx:1526-1548` |
| K | 5 段閉環亮點：訊號融合動畫、預警紅點脈衝、第二螢幕情緒切換、聊天串流、影像判讀標註 — 部分已有，需 audit | App.tsx / robot-app/ |
| L | `robot-app/` 子專案 — WIP 改了 `LLMEmotion.py`，需驗 `cd robot-app && npm run build` 沒破 | `robot-app/` |

WIP **沒有可丟掉**的東西。lint 跟 4 個 test 已綠（含 500-round pixel validation），可直接 commit 凍結 baseline。

---

## 設計 — Phase MUST（必做，demo 不能崩，~4 hrs）

### A. `withAiTimeout` helper + 2 個 generateContent 真正可取消 + 新增 guardian-chat endpoint

**Rigor review 1-2 修正**: `abortSignal` 是 `GenerateContentConfig` 的 field（per SDK `genai.d.ts:4423-4432`）— 在 `config` 內跟 `temperature` 同級，**不是** top-level `GenerateContentParameters`。

在 file 開頭、`isGeminiConfigured` 之前加：

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

**修 line 51 (`analyzeGuardianAlert`)** — **保留既有 hardcode model `'gemini-2.0-flash'`**（非 mechanical 改成 visionModel）：
```ts
const response = await withAiTimeout((signal) =>
  ai.models.generateContent({
    model: 'gemini-2.0-flash',  // 既有 hardcode，保留
    contents: [{role: 'user', parts: [{text: prompt}]}],
    config: {abortSignal: signal},  // 既有沒 config，新加
  })
);
```

**修 line 139 (`analyzeEmotionWithAI`)**: WIP 既有 controller + 30s setTimeout，但 signal **沒傳到 generateContent**。改用 `withAiTimeout`，signal 放 `config` 內（與 temperature 同級）：
```ts
const response = await withAiTimeout((signal) =>
  ai.models.generateContent({
    model: visionModel,
    contents: [...],
    config: {
      temperature: 0.4,
      abortSignal: signal,  // 在 config 內
    },
  }), 30_000  // emotion 用 30s（影像分析較長）
);
```

### A2. 新增缺失的 `/api/ai/guardian-chat` endpoint（rigor review 7 + 真實 bug）

**Bug**: `src/services/localGuardianAi.ts:128` 呼叫 `askGemini('/api/ai/guardian-chat', ...)`，但 server `serialBridge.ts` 只有 `/api/ai/guardian` (520) 跟 `/api/ai/zone-advisor` (550)。**`/api/ai/guardian-chat` server 不存在** → fetch 404 → 學生支持流程 AI 永遠 fallback 到本機樣板，假裝是 AI 回覆。Demo 上看不出來但 AI 從未被叫到。

**修法**:

1. `server/aiService.ts` 加：
   ```ts
   export interface GuardianChatContext {
     text: string;
     mood?: string;
     location?: string;
     alertSummary?: string;
   }

   export async function generateGuardianChatReply(ctx: GuardianChatContext): Promise<{reply: string; source: 'gemini' | 'local'}> {
     if (!ai) return {reply: '', source: 'local'};
     try {
       const prompt = `你是國中校園心靈守護者 AI。學生說：「${ctx.text}」。心情：${ctx.mood ?? '未指定'}。地點：${ctx.location ?? '未指定'}。當前預警：${ctx.alertSummary ?? '無'}。請用繁體中文 2-3 句回覆，語氣溫暖、不評判、提供具體下一步建議。`;
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
     } catch {
       return {reply: '', source: 'local'};
     }
   }
   ```

2. `server/serialBridge.ts` 在 `/api/ai/guardian` 旁加：
   ```ts
   app.post('/api/ai/guardian-chat', async (req, res) => {
     const {text, mood, location, alertSummary} = req.body ?? {};
     if (typeof text !== 'string' || !text.trim()) {
       return res.status(400).json({ok: false, error: 'text required'});
     }
     try {
       const result = await generateGuardianChatReply({text, mood, location, alertSummary});
       if (!result.reply) return res.status(503).json({ok: false, error: 'AI 暫時不可用', fallback: true});
       res.json({ok: true, reply: result.reply, source: result.source});
     } catch (error) {
       res.status(500).json({ok: false, error: error instanceof Error ? error.message : String(error)});
     }
   });
   ```

3. (textModel 加到 file 開頭)：`const textModel = process.env.GEMINI_TEXT_MODEL?.trim() || process.env.GEMINI_MODEL?.trim() || visionModel;`

### B. Robot ACK timeout 降級 polish（15 min）

**Rigor review 3-4 警告 + 已驗證**: ACK wait Map 設計作廢（race condition + 韌體不送 ACK）。

**已驗**: `grep -rn "ACK " firmware/` 全無結果。`/api/robot/emotion-scan:774` 不是 robot command（AI 影像 scan），由 A 段 timeout 涵蓋。

**B 降級 polish**:
1. **Verify** 既有 `robotCommandStatus(result.ok)` 在拔線時正確回 503（`/api/robot/command:471` + `/api/robot/drive:490` 都用此函數，line 108-110 已確認）
2. **Polish error message**：
   ```ts
   return {ok: false, message: telemetry.lastError ?? 'No Arduino. 請插 UNO R4 並上傳 app3-guardian-drive 或 app3-guardian-sensor 韌體（pio run -e uno_r4_minima_app3_guardian_drive -t upload）'};
   ```
3. **加 `port.write` 1s timeout guard**（同 app2 設計）：
   ```ts
   await Promise.race([
     new Promise<void>((resolve, reject) => port.write(`${command}\n`, (err) => err ? reject(err) : resolve())),
     new Promise<void>((_, reject) => setTimeout(() => reject(new Error('serial write timeout 1s')), 1000)),
   ]);
   ```

**完整 ACK wait 不在本 spec**（依賴韌體改動 + 重新 flash 多板子 + 處理 request id / queue / serial mutex — 後續單獨 task）。

### C. Per-handler AbortController（不是全域）— rigor review 9 修正

**Rigor review 9 警告**: 全局 module-scoped controller 會讓不同 panel 互相取消（按 emotion analyze 會 abort 進行中的 acoustic analyze）。`GuardianControlPanel` import from `App.tsx` 製造 component → module → component 循環依賴。

**修正設計**: 每個 handler **自己的 controller**，不共享全域。用 useRef 維持跨 render 穩定性：

```ts
// 在 App.tsx 內、AppContent function 內加 helper hook
function useActionAbort() {
  const ref = useRef<AbortController | null>(null);
  return {
    begin: () => {
      ref.current?.abort();
      const c = new AbortController();
      ref.current = c;
      return c.signal;
    },
    end: () => { ref.current = null; },
  };
}

// 在 AppContent 內
const emotionAbort = useActionAbort();
const acousticAbort = useActionAbort();
const dispatchAbort = useActionAbort();
const chatAbort = useActionAbort();
const autoDemoAbort = useActionAbort();
```

每個 handler 用自己的 abort hook：
```ts
async function handleAnalyzeEmotion(image: string) {
  const signal = emotionAbort.begin();
  try {
    const result = await analyzeEmotion(image, signal);
    // ...
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return;
    // ...
  } finally {
    emotionAbort.end();
  }
}
```

**`GuardianControlPanel.tsx`** 自己 import `useActionAbort`（從 `src/hooks/useActionAbort.ts` 抽到共用 hook）— **不從 App.tsx import** 避免循環。

關鍵 handler：
- `handleRunAutoDemo`（用 `autoDemoAbort`）
- `handleDispatchRobot` / `handleConfirmRobotArrival`（共用 `dispatchAbort`）
- `handleAnalyzeEmotion`（emotionAbort）
- `handleAcousticAnalyze`（acousticAbort）
- `handleSendChatMessage`（chatAbort）

`GuardianControlPanel` 內部用自己的 ref（如 `controlAbort`）。

### D. localStorage Map fallback

**檔案**: `src/state/guardianState.ts` (line 550-580 周邊)

讀 + 寫都加 in-memory Map fallback：

```ts
const _memoryFallback = new Map<string, GuardianState>();

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
      } catch {}
    }
    _memoryFallback.set(STORAGE_KEY, state);
  }
}

export function loadGuardianState(): GuardianState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return _memoryFallback.get(STORAGE_KEY) ?? null;
}
```

### F. `scripts/demo-readiness-check.mjs` + `npm run demo:check`

**檔案**: `apps/app3-guardian/scripts/demo-readiness-check.mjs`（新建）, `package.json`

仿 app1 模板。app3 endpoints 檢核（已 grep 驗證 `serialBridge.ts`）：

1. `GET /api/health` 200
2. `GET /api/ready` 200
3. `GET /api/sensors/ports` 200
4. `POST /api/ops/reset` 200
5. `POST /api/ai/guardian` `{type:'國中壓力事件',riskLevel:'medium',severity:'medium'}` 200/503
6. `POST /api/ai/guardian-chat` `{text:'測試',mood:'calm'}` 200/503（**A2 新增的 endpoint**）
7. `POST /api/ai/zone-advisor` (基本 payload) 200/503
8. `POST /api/robot/command` `{command:'BEEP'}` 200/503
9. `POST /api/robot/drive` `{command:'STOP'}` 200/400/503
10. `POST /api/robot/emotion-scan` (1×1 tiny png) 200/503
11. `GET /api/display/status` 200
12. `GET /api/display/info` 200
13. `POST /api/display/emotion` `{emotion:'calm'}` 200
14. `GET /api/display/emotion-events` 200

`package.json` 加：
```json
"demo:check": "node scripts/demo-readiness-check.mjs"
```

不立即加進 `check`（同 app2 做法），穩定後再加。

### G. 一鍵啟動.command 強化

**檔案**: `apps/app3-guardian/一鍵啟動展示.command`（既有，需修正）

WIP 已改過此檔（git status 顯示 M）。先 commit 凍結 baseline，再做下面強化：

- 啟動前 `lsof -ti:3203 | xargs -r kill -9`（grep 確認是 bridge process）
- 自動找 vite 可用 port（3000 起跳）
- 啟動完印明顯成功訊息: `✓ App3 ready: http://localhost:<vite_port>` + `✓ Robot display: http://localhost:<vite_port>?screen=robot`
- 失敗時印可讀錯誤 + 暫停 5 秒讓使用者看
- 加 `一鍵停止展示.command`（若不存在，仿 app2 製作）

### H. `server/api-contract.test.mjs`（移到 SHOULD 階段做）

**Note**: 此項從 MUST 降到 SHOULD（per adversarial review 6: 測試補強排在抽檔/fallback 之後）。spec 後面 SHOULD 段重新詳列。

範圍預告：覆蓋 app3 全 ~25 個 endpoint，含 A2 新增的 `/api/ai/guardian-chat`。每個 endpoint 需正確 payload（rigor review 6 警告：固定 200 + 空 body 在 contract test 必紅）。

### I. WIP commit 凍結 baseline

操作：
1. `cd apps/app3-guardian && npm run check` 確認綠（已驗）
2. `cd robot-app && npm run build` 確認 robot-app 沒破（**新 check，WIP 改過 LLMEmotion.py**）
3. 列每個 M 檔案分批 stage：
   - `git add apps/app3-guardian/server/aiService.ts apps/app3-guardian/server/serialBridge.ts`
   - `git add apps/app3-guardian/src/App.tsx apps/app3-guardian/src/components/GuardianControlPanel.tsx apps/app3-guardian/src/services/hardwareBridge.ts`
   - `git add apps/app3-guardian/robot-app/LLMEmotion.py`
   - `git add "apps/app3-guardian/一鍵啟動展示.command"`
4. commit:
   ```
   feat(app3): finish WIP — EmotionAnalysis vision pipeline, hardwareBridge polish

   - Add EmotionAnalysis interface + analyzeEmotionWithAI (114 lines aiService)
   - Add JSON parsing helpers (stripDataUrl, parseJsonLoose, clampInt)
   - Polish hardwareBridge retry/fallback (59 lines)
   - Tune GuardianControlPanel (40 lines)
   - Update robot-app LLMEmotion.py prompt
   - Refine 一鍵啟動展示.command

   Status: lint + 4 client tests green (incl. 500-round pixel validation).
   robot-app build green. Reliability hardening to follow.
   ```

### J. 5 段閉環 done 邏輯加強

**檔案**: `src/App.tsx:1526-1548`

現況 `buildDemoClosureSteps` 用 substring `'示範'` match 太脆弱 — 學生實際操作如沒包含特定字眼，步驟不會亮 done。

加 explicit done flag 到 state（不替換 heuristic，補充）：

```ts
// guardianState.ts 加
type DemoClosureFlags = {
  signalFused: boolean;
  alertCreated: boolean;
  robotDispatched: boolean;
  studentSupported: boolean;
  closed: boolean;
};

// state 增 field
demoClosureFlags: DemoClosureFlags;

// reducer 在關鍵 action 設旗標
case 'ADD_ACOUSTIC_SIGNAL':
case 'ADD_MOOD_LOG':
  return {...state, demoClosureFlags: {...state.demoClosureFlags, signalFused: true}};
case 'CREATE_ALERT':
  return {...state, demoClosureFlags: {...state.demoClosureFlags, alertCreated: true}};
case 'DISPATCH_ROBOT':
  return {...state, demoClosureFlags: {...state.demoClosureFlags, robotDispatched: true}};
case 'ADD_SUPPORT_MESSAGE':
  return {...state, demoClosureFlags: {...state.demoClosureFlags, studentSupported: true}};
case 'RESOLVE_ALERT':
  return {...state, demoClosureFlags: {...state.demoClosureFlags, closed: true}};
```

`buildDemoClosureSteps` 改 `done = oldHeuristic || flags.X`：

```ts
return [
  {label: '訊號融合', done: signalDone || flags.signalFused, ...},
  {label: '預警成案', done: alertDone || flags.alertCreated, ...},
  {label: '派遣處置', done: dispatchDone || flags.robotDispatched, ...},
  {label: '學生支持', done: supportDone || flags.studentSupported, ...},
  {label: '回報結案', done: hasClosure || flags.closed, ...},
];
```

Reset 時清空 flags。

### K. 5 段閉環亮點 audit

| 段 | 亮點 | 目前狀態 | 補強 |
|---|---|---|---|
| 訊號融合 | 即時麥克風波形 + 風險指數動畫 | acousticGuardian 已有實時量化 | 確認 SensingPanel waveform 可見、閾值跨越時有色彩變化 |
| 預警成案 | 校園 2.5D 地圖紅點脈衝 | CampusMapSvg 已有 | 確認新建 alert 時 zone 觸發 animate-pulse 至少 5 秒 |
| 派遣處置 | **第二螢幕 robot-app 情緒切換**（emotion event flow） | WIP 已加 `/api/display/emotion-event` 路徑 + EmotionAnalysis | 確認從派遣按鈕 → emotion-event → robot-app 顯示換臉，全程 < 3 秒 |
| 學生支持 | AI 串流回覆 | localGuardianAi 有同步回覆 | Phase SHOULD 加真實 Gemini 串流（可選）|
| 回報結案 | 完成卡 + counter 5/5 + RGB LED 收尾動作 | counter 已有 | 確認 RESOLVE_ALERT 時送 `LED_CONFIRM` 指令到 Arduino |

每項缺的 < 30 min 可補完。第二螢幕情緒切換是最大亮點，要確保 emotion-event WS broadcast 後 robot-app 立即重 render。

### L1. 現場災難 fail-safe（NEW — per adversarial review 2）

**問題**: spec 原本沒處理「現場常見災難」— iPad 鎖屏 / Safari swipe-back / Wi-Fi 整網壞 / 投影鏡像比例錯。比 AI timeout 更會直接毀展示。

**MUST 4 項 fail-safe**:

1. **iPad 螢幕保持喚醒** — `src/hooks/useWakeLock.ts`（新建，跟 app2 同設計）：
   ```ts
   useEffect(() => {
     let wl: WakeLockSentinel | null = null;
     navigator.wakeLock?.request('screen').then((s) => { wl = s; }).catch(() => {});
     return () => { wl?.release().catch(() => {}); };
   }, []);
   ```
   `App.tsx` `autoDemoRunning` 為 true 時呼叫。

2. **Safari swipe-back 防呆** — `App.tsx` `useEffect`：
   ```ts
   useEffect(() => {
     const handler = (e: PopStateEvent) => {
       if (state.autoDemoRunning) {
         window.history.pushState(null, '', window.location.href);
         showToast('比賽 demo 中，請用「重置舞台」按鈕');
       }
     };
     window.addEventListener('popstate', handler);
     return () => window.removeEventListener('popstate', handler);
   }, [state.autoDemoRunning]);
   ```

3. **Wi-Fi 整網壞 UI 提示** — `useProxyHealth` 連續 3 次 fetch fail 後顯示明顯 banner：「離線備援模式 — 影像辨識用本機分析」+ 重試按鈕。

4. **第二螢幕投影比例 fallback** — `RobotDisplaySync` / `robot-app` 啟動時印明顯「投影 URL: ...」chip + 加 `screen.width !== window.innerWidth * dpr` 警示。

### L2. robot-app 子專案驗證

WIP 改了 `robot-app/LLMEmotion.py`。每次大改 commit 前必跑：

```bash
cd apps/app3-guardian/robot-app && npm run build
```

確認 build 綠才能 commit。加進 demo:check 流程（probe robot-app dist 存在）。

---

## 設計 — Phase SHOULD（demo 體驗順，~2.75 hrs）

per adversarial review：directGemini 跟 serialBridge 拆檔降到 NICE。SHOULD 留實際幫助 demo 順的：

### 1. Reset demo 徹底化 + 第二螢幕同步

reset 後送 WS broadcast `demo_reset` 到所有 client（含 robot-app 第二螢幕）。第二螢幕收到後：
- 清空 emotion event 顯示
- 重置情緒臉為初始 calm
- 清空 mission 顯示

`demoClosureFlags`（J 段新增）reset 後全 false，所有 panel 回到初始狀態。`一鍵啟動.command` 啟動時自動觸發 reset 確保乾淨環境。

### 2. 五段閉環亮點 fix（K 補完未實作的）

完成 Phase MUST K 表中所有 ❓ 標記亮點：
- 第二螢幕 emotion 切換動畫流暢（CSS transition + 短暫淡入）
- RGB LED 收尾動作 wire（`LED_CONFIRM` 指令）
- 麥克風 waveform 風險閾值跨越時色彩變化
- 預警 zone 新建時 `animate-pulse` 至少 5 秒

### 3. `server/api-contract.test.mjs`（25 endpoints, 含 A2 新增）

**Rigor review 6 警告**: contract test payload 不能空，否則 server 400 → test 紅。每個 POST 必須含合理 payload。

完整 endpoint 列表（已 grep 驗證 `serialBridge.ts:402-774`）：
- `GET /api/health` → 200 + `{ok:true}`
- `GET /api/ready` → 200
- `GET /api/sensors/ports` → 200, array
- `POST /api/sensors/assign` `{port:'/dev/null',zoneId:'zone-test'}` → 200/400
- `GET /api/sensors/live` → 200
- `POST /api/robot/command` `{command:'BEEP'}` → 200/503
- `POST /api/robot/drive` `{command:'STOP'}` → 200/400/503
- `POST /api/robot/emotion-scan` `{imageBase64:tinyPng}` → 200/503
- `POST /api/ai/guardian` `{type:'國中壓力事件',riskLevel:'medium',severity:'medium',description:'測試'}` → 200/503
- `POST /api/ai/guardian-chat` `{text:'測試',mood:'calm'}` → 200/503（A2 新增）
- `POST /api/ai/zone-advisor` `{zone:'A棟',recentReadings:[]}` → 200/503
- `GET /api/logs/alerts` → 200, array
- `POST /api/logs/alerts` `{type:'測試',riskLevel:'low',category:'test'}` → 200/400
- `POST /api/ops/reset` → 200
- `GET /api/ev3/status` → 200
- `POST /api/ev3/command` `{command:'BEEP'}` → 200/400/503
- `GET /api/spike/status` → 200
- `POST /api/spike/command` `{command:'BEEP'}` → 200/400/503
- `POST /api/display/guardian-snapshot` `{emotion:'calm',stress:30,stability:70,focus:60,fusionScore:50,signals:{moodScore:0,soundScore:0,nodeScore:0,alertScore:0},riskScore:30,riskLabel:'低',moodLabel:'平穩',robotActive:false,updatedAt:'2026-05-16T00:00:00Z'}` → 200
- `GET /api/display/guardian-snapshot` → 200
- `POST /api/display/robot-assignment` `{zoneId:'zone-test',zoneName:'測試',stage:'指令送出',missionId:'test-1',createdAt:'2026-05-16T00:00:00Z'}` → 200
- `GET /api/display/robot-assignment` → 200
- `POST /api/display/emotion-event` `{id:'test-1',zoneId:'zone-test',emotion:'calm',moodLabel:'平穩',severity:'low',createdAt:'2026-05-16T00:00:00Z'}` → 200
- `GET /api/display/emotion-events` → 200, array
- `GET /api/display/info` → 200
- `POST /api/display/emotion` `{emotion:'calm'}` → 200
- `GET /api/display/status` → 200

`check` script 加：
```json
"check": "npm run test && tsx server/api-contract.test.mjs && npm run lint && npm run build"
```

### 4. Soak checklist（手動驗證）

加 `apps/app3-guardian/docs/DEMO_SOAK_CHECKLIST.md`：
- 開 demo 30 min，跑五段閉環 3 輪
- chrome devtool Memory tab：JS heap 不持續增長
- 觀察 WS 累積斷線 / 重連 log
- 第二螢幕（robot-app）30 min 後 emotion 切換仍流暢
- 點 reset 10 次，counter 乾淨歸零
- iPad mirror 到投影機 1080p layout 不破版

---

## 設計 — Phase NICE（工程潔癖 / 後續精進，~3.5 hrs）

per adversarial review 4-5：directGemini + serialBridge 拆檔降到 NICE。如餘裕可做。

### 1. `server/defaults.ts`

抽集中：
```ts
export const GUARDIAN_DEMO_ZONES = [...];
export const PRINTABLE_VISUAL_SCENES = [...];  // 從 App.tsx 移過來
export const AI_PROMPT_TEMPLATES = {guardianAlert: '...', guardianChat: '...', zoneAdvisor: '...', emotion: '...'};
export const DEFAULT_DEMO_CLOSURE_FLAGS = {signalFused: false, ...};
export const EMOTION_LABELS = {happy: '...', calm: '...', focused: '...', anxious: '...', sad: '...', stressed: '...'};
```

### 2. `server/hardwareSimulation.test.ts`

仿 app1。sim mode 下：
- bridge 啟動不開 serial port
- `sendCommand` 模擬 ACK
- emotion-scan endpoint 用 sim image 200
- display endpoint 全可用

~20 assertion，~90 行。

### 3. Firebase guard

WIP 沒動 firebase。加 firebase init 的 try/catch：

`src/lib/firebase.ts`：
```ts
let firebaseApp: FirebaseApp | null = null;
try {
  if (firebaseConfig.apiKey && !getApps().length) {
    firebaseApp = initializeApp(firebaseConfig);
  }
} catch (error) {
  console.warn('[firebase] init skipped:', error instanceof Error ? error.message : error);
}
export {firebaseApp};
```

### 4. `src/services/directGemini.ts`（從 SHOULD 降至此）

仿 app1 / app2 同名檔。3 個 function：
- `directAnalyzeGuardianAlert(context)`
- `directAnalyzeEmotion(imageBase64)`
- `directGenerateGuardianChatReply(context)`

**只做於：規劃 GitHub Pages public deploy 時**。

### 5. serialBridge 拆檔（從 SHOULD 降至此 — 901 行 → ~400 行）

App3 `serialBridge.ts` 901 行是 app2 的兩倍，拆收益更大但 regression 風險也大。

拆 6 個檔（rigor review 8 警告要處理 2 套 WS channel）：

- `server/wsBroadcast.ts` (~50 行) — 注意：**有兩套 channel**，wss.clients (全廣播) + displayClients (專為第二螢幕的 subscriber set)。需明確 export 兩個函數 `broadcast(msg)` 跟 `broadcastToDisplay(msg)`，不能只抽一個
- `server/routes/aiRoutes.ts` (~100 行): `/api/ai/guardian` + `/api/ai/guardian-chat` + `/api/ai/zone-advisor`
- `server/routes/robotRoutes.ts` (~120 行): `/api/robot/*`（含 emotion-scan）
- `server/routes/displayRoutes.ts` (~180 行): `/api/display/*` 8 個 endpoint
- `server/routes/sensorRoutes.ts` (~80 行): `/api/sensors/*` 3 個 + `/api/ops/reset` + `/api/logs/alerts`
- `server/validation.ts` (~60 行)

`serialBridge.ts` 留 ~400 行。每組 routes 用工廠函數注入 `{broadcast, broadcastToDisplay, sendCommand, getLatestGuardianSnapshot, setLatestGuardianSnapshot, ...}` 避免 circular import。

**只做於：時間餘裕** + 拆完跑完整 contract test。

---

## 不做的事

- ❌ `proxyRoutes.ts` + `express-rate-limit` + `zod` — 非 public 產品
- ❌ `opsService.ts` / `config.ts` / `http.ts` / `types.ts` 抽檔 — 為產品才用
- ❌ `dev:full` script — app3 也無額外服務（zone_advisor.py 是 stateless helper，不常駐）
- ❌ 改 `guardianState.ts` 拆 slice — 同 app2 高風險
- ❌ 刪 `legacy/` 目錄
- ❌ 開 production Firebase — 仍是「未來可接選項」
- ❌ 改 `acousticGuardian` / `visualPrivacyGuardian` / `proactiveGuardian` 核心邏輯（這三是已測過的本機 service，動了會破 500-round pixel validation）
- ❌ 改 `zone_advisor.py` Python helper（如改先確認獨立可跑）
- ❌ 整 robot-app 改 React 19（保留現況 React 版本，只測 build 綠）

---

## 成功標準（demo 視角驗收）

完成所有 phase 後，**人工現場驗收**：

1. **拔網測試**: 切斷 wifi 後跑 emotion-scan / guardian-alert — 20s 內看到 local fallback，第二螢幕仍顯示情緒臉
2. **拔 Arduino 測試**: 不接 bridge 直接送 robot/command — 看到 503「Arduino 未確認」訊息
3. **快速連點測試**: 快速點派遣 3 次 — busy state 不卡，舊 request 自動 abort
4. **iOS 私密模式測試**: iOS Safari 私密模式跑 demo — memoryFallback 接手，state 不丟
5. **bridge 重啟測試**: kill bridge → 重啟 — 前端 WS reconnect、第二螢幕重連、5/5 counter 不重置（state 保留）
6. **五段閉環測試**: 從首頁點「開始示範」一路跑完 — counter 從 0/5 → 5/5，每段有明確完成證明
7. **五段亮點驗收**: 麥克風波形 / 預警紅點脈衝 / **第二螢幕情緒切換流暢** / 學生支持回覆 / 結案 RGB LED 動作
8. **第二螢幕 sync 測試**: 主畫面派遣 → robot-app 收到 emotion-event → 換臉動畫 < 3 秒
9. **Reset demo 測試**: 點 reset → counter 歸零、第二螢幕清空、demoClosureFlags 全 false
10. **demo:check 全綠**: `npm run demo:check` 全 endpoint PASS
11. **完整 check 全綠**: `npm run check` 全綠（含 api-contract test + 4 個 client test + 500-round pixel validation）
12. **robot-app build 綠**: `cd robot-app && npm run build` 0 error

---

## 風險與緩解

| 風險 | 緩解 |
|---|---|
| Module-scoped abort pattern 改大檔 App.tsx 破功能 | 一次只改一個 handler，每次 commit + check 綠才進下個 |
| serialBridge 拆檔（901 → 6 個 routes）改動最大、影響面廣 | 拆完跑 api-contract test，紅燈不進下 phase |
| WIP 改了 robot-app/LLMEmotion.py 但沒測 build | 每次 commit 前強制跑 `cd robot-app && npm run build` |
| 第二螢幕 emotion 切換動畫不流暢 | Phase MUST K 強制驗 < 3 秒；不過則加 CSS preload + image preload |
| `buildDemoClosureSteps` substring 邏輯破壞學生現場操作 | Phase MUST J 加 explicit flag，舊 substring 保留為 fallback |
| Firebase 未設定但有 console 噪音 | Phase NICE 加 try/catch guard |
| Reset 後第二螢幕沒同步 | Phase SHOULD 3 強制 WS broadcast + 第二螢幕收聽 |

---

## 執行順序

A1（MUST）→ A2（SHOULD）→ A3（NICE），每階段 `npm run check` + `cd robot-app && npm run build` 綠才進下一階段。

- **A1.0 WIP commit baseline + robot-app build 驗證**（10 min）
- **A1.1 withAiTimeout 2 個 callsite (proper AbortController)**（30 min）
- **A1.2 A2 新增 `/api/ai/guardian-chat` endpoint**（25 min — 真實 bug fix）
- **A1.3 Robot ACK timeout 降級 polish**（15 min — 韌體無 ACK echo 已驗）
- **A1.4 per-handler AbortController 5 handlers**（90 min — 大頭，per-handler ref 不共享）
- **A1.5 localStorage Map fallback**（20 min）
- **A1.6 scripts/demo-readiness-check.mjs**（35 min）
- **A1.7 一鍵啟動.command 強化**（25 min）
- **A1.8 5 段閉環 explicit flag + audit**（45 min）
- **A1.9 5 段亮點 audit + fix**（45 min）
- **A1.10 現場災難 fail-safe (L1)**: wakeLock + swipe-back + 離線 banner + 投影 chip（45 min）
- **A1.11 robot-app build 驗證 (L2)**（5 min — 已含在 A1.0 但每 phase 完再跑一次保險）
- → check 綠 + robot-app build 綠 → commit MUST done
- **A2.1 Reset 徹底化 + 第二螢幕 sync**（40 min）
- **A2.2 K 亮點補完未實作的**（30 min）
- **A2.3 api-contract.test.mjs (25 endpoints, 含 guardian-chat)**（75 min）
- **A2.4 docs/DEMO_SOAK_CHECKLIST.md + 跑一次 soak**（45 min）
- → check 綠 → commit SHOULD done
- **A3.1 defaults.ts**（30 min）
- **A3.2 hardwareSimulation.test.ts**（50 min）
- **A3.3 Firebase try/catch guard**（10 min）
- **A3.4 directGemini.ts (if GitHub Pages 部署需求)**（60 min — 條件式）
- **A3.5 serialBridge 拆 6 個 routes (if 時間餘裕)**（120 min — 條件式）
- → check 綠 → commit NICE done

**估計總時長**:
- MUST: 6.5 hrs（含 L1 + A2 guardian-chat 新增 + 5 段 explicit flag）
- SHOULD: 3.2 hrs
- NICE: 1.5 hrs 必做 + 3 hrs 條件式 = 1.5-4.5 hrs
- Solo 合計 ~11-14 hrs
- **平行派 codex 可壓到 ~8-10 hrs**
