# App2 校園服務機器人 — Demo 可靠性 + 閉環亮點設計

**日期**: 2026-05-16
**範圍**: `apps/app2-campus-service/`
**目標**: 把 app2 拉到 app1 同等的「比賽展示穩定度」— 任何網路 / 硬體 / 裝置條件下五個 demo 流程都能跑完，每個流程閉環可見、亮點明確，學生操作不會卡住、評審能看懂在做什麼。
**非目標**: 上線級別 rate-limit / authn / observability。這是現場 demo，不是 production。

---

## 現況審計（WIP 已做、缺什麼）

WIP 為 855 行未提交修改（`95ccb8a` 後），`npm run check` 已綠（lint + 3 個 client test 全過）。

### 已做 ✅

- **AbortController 多處**: `ExternalRobotPanel.tsx`, `RemoteControlPanel.tsx`, `RobotDisplaySync.tsx`×3, `VisionCameraCard.tsx`, `useGeminiVision.ts`, `useHardwareSocket.ts`, `useProxyHealth.ts`
- **localStorage Quota handler**: `appState.ts:1061` 有 try/catch + trim retry（保留 logs 30 條）
- **WS reconnect + 初始 push**: `useHardwareSocket.ts` 有 reconnect / polling，server 連線時即送 `arduino_status`
- **DemoClosureRail wire-up**: `App.tsx` 已 import 使用（5 step）
- **新 AI endpoints**: WIP 加了 `/api/ai/teacher-reply`, `/api/ai/dispatch-recommend`, `/api/ai/student-report`
- **Gemma → Gemini 遷移**: `aiService.ts` model 變數已改名 `visionModel` / `textModel`，預設 `gemini-2.5-flash`
- **LifeView 拆元件**: WIP 已抽 `VisionCameraCard`, `ScanMapCard`（LifeView 減 86 行）
- **TeachView 重構**: WIP 加 249 行新功能 / 移除 95 行舊邏輯
- **CameraPicker** + `useCameraSelection`: 多攝影機切換
- **6 處 503 處理**: middleware 6s timeout、ai endpoints fallback、status endpoint

### 缺 ❌（要做的真實清單）

| ID | 缺什麼 | 位置 |
|----|--------|------|
| A | `withAiTimeout(promise, ms=20000)` helper 沒寫，7 個 `generateContent` 全無 wrap | `server/aiService.ts:54,172,203,219,232,245,264` |
| B | Robot ACK `result.timedOut` → 503 早返回沒寫 | `server/serialBridge.ts` 的 `/api/robot/command` handler |
| C | AbortController 是 component-local 散落各處，**無 module-scoped + generation counter pattern**，快速切換 view 時舊 in-flight request 可能更新後 view 的 state | 5 個 view（LifeView / TeachView / DeliveryView / DispatchMapView / DashboardView） |
| D | `localStorage` Quota handler 是「trim retry」不是 in-memory Map fallback，trim 失敗後就 give up | `appState.ts:1061` |
| F | `demo:check` script 跟 `scripts/` 目錄都不存在 | `scripts/demo-readiness-check.mjs` 待建 |
| G | 一鍵啟動 `.command` 不存在（app3 有，app2 沒有） | repo root |
| H | server 端 test 全缺（無 `api-contract.test.mjs` / 無 hardwareSimulation test） | `server/*.test.*` |
| J | 5 個流程**閉環點 wire 完整度**沒驗證（DemoClosureRail 雖 wire 進 App.tsx 但每個 view 是否確實 emit done state 沒查）| 各 view |
| K | 部分**亮點**動畫 / 音效未到位：配送路徑 SVG 動畫、廣播 tone.js 真實播放、QR code 即時生成 | DeliveryView / LifeView / StudentReportView |

WIP 中**沒有可丟掉**的東西。lint 跟 test 已綠，可直接 commit 凍結 baseline。

---

## 設計 — Phase MUST（必做，demo 不能崩，~4 hrs）

### A. `withAiTimeout` helper + 7 個 generateContent 真正可取消

**檔案**: `server/aiService.ts`

**設計修正**（rigor review 1, 2）：純 `Promise.race` 只讓**呼叫端** timeout，**底層 Gemini request 仍會跑到完**，浪費 quota 跟記憶體。改用 AbortController 真正取消請求。

`@google/genai` SDK 的 `generateContent` 接受 top-level `abortSignal`（不是放在 `config` 內）。

在 `getAiErrorInfo` 之後插入：

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

7 個 callsite 改（注意 signal 是傳到 `ai.models.generateContent` 的 top-level，**不要放 config**）：

```ts
// 原
const response = await ai.models.generateContent({
  model: visionModel,
  contents: [...],
  config: {temperature: 0.35},
});

// 改
const response = await withAiTimeout((signal) =>
  ai.models.generateContent({
    model: visionModel,
    contents: [...],
    config: {temperature: 0.35},
    abortSignal: signal,  // top-level，不是放 config 內
  })
);
```

7 callsites: line 54 (`checkAiAccess` probe), 172 (`classifyVisionScene`), 203 (`analyzeDeliveryTask`), 219 (`generateTeacherReply`), 232 (`generateDispatchRecommendation`), 245 (`generateStudentReport`), 264 (`estimateClassroomAttendance`)。每個 callsite 既有 catch 攔 AbortError → fallback 路徑。

### B. Robot ACK timeout 降級 polish（15 min）

**rigor review 3-4 警告**: ACK wait Map 設計有 race condition（同 command 連點覆蓋 resolver / ACK 回來無序），**且韌體不送 ACK**。整段 ACK wait 設計**作廢**，只走降級。

**已驗證**: `grep -rn "ACK " firmware/` 全無結果。`firmware/app2-sweeper-drive/main.cpp` 跟 `firmware/shared-command-demo/commands.cpp` 都沒送 `ACK <command>` 回應。

**現況穩定**: `serialPort.ts:219` 的 `sendCommand` 在拔線時 `openPort()` 回 null → `robotCommandStatus(false)` 已正確回 503。

**B 降級 polish**:
1. **Verify** 既有 503 path 正確（手動拔線測試 + grep `robotCommandStatus` 確認所有 robot endpoint 都用它）
2. **Polish error message**：`telemetry.lastError` 訊息加韌體名稱提示：
   ```ts
   return {ok: false, message: telemetry.lastError ?? 'No Arduino. 請插 UNO R4 並上傳 app2-sweeper-drive 韌體（pio run -e uno_r4_minima_app2_sweeper -t upload）'};
   ```
3. **加 `port.write` 1s timeout guard**（防 half-closed port hang）：
   ```ts
   await Promise.race([
     new Promise<void>((resolve, reject) => port.write(`${command}\n`, (err) => err ? reject(err) : resolve())),
     new Promise<void>((_, reject) => setTimeout(() => reject(new Error('serial write timeout 1s')), 1000)),
   ]);
   ```

**完整 ACK wait 不在本 spec**：需改韌體加 `Serial.println("ACK " + cmd)` + 重新 flash 多板子，比賽前風險過大，且需處理 request id / queue / serial mutex 才能正確 — 後續單獨 task。

### C. Module-scoped AbortController pattern（5 個 view）

**檔案**: `src/views/LifeView.tsx`, `TeachView.tsx`, `DeliveryView.tsx`, `DispatchMapView.tsx`, `DashboardView.tsx`

每個 view 在 module-scope（component 外）加：

```ts
let _abortController: AbortController | null = null;
let _actionGeneration = 0;
```

view 內 helper：

```ts
function beginAction(busyKey: string): {signal: AbortSignal; gen: number} {
  _abortController?.abort();
  const controller = new AbortController();
  _abortController = controller;
  const gen = ++_actionGeneration;
  setBusy(busyKey);
  return {signal: controller.signal, gen};
}

function endAction(gen: number) {
  if (_actionGeneration === gen) {
    _abortController = null;
    setBusy('');
  }
}
```

每個 async handler（捕捉影像 / 派遣任務 / 教學分析 / 配送 / dashboard 寫入）改用 `beginAction` 取 signal，catch 中 `AbortError` 靜默忽略。

既有 component-local AbortController 保留（用於 useEffect cleanup），但 user action（按鈕點擊）一律走 module-scoped，避免 view 切換時殘留 in-flight request 寫入錯誤 state。

### D. localStorage Map fallback（補強 trim retry）

**檔案**: `src/state/appState.ts:1055-1075`

WIP 的 trim retry 在「即使 trim 完仍超出 quota」會 give up。加 in-memory Map fallback：

```ts
const _memoryFallback = new Map<string, AppState>();

export function persistState(state: AppState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    _memoryFallback.delete(STORAGE_KEY); // localStorage 成功就清 mem
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

export function loadPersistedState(): AppState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return _memoryFallback.get(STORAGE_KEY) ?? null;
}
```

注意 iOS Safari 私密模式下 `localStorage` 寫入會 throw → 此時整個 demo 走 memory fallback。

### F. `scripts/demo-readiness-check.mjs` + `npm run demo:check`

**檔案**: `apps/app2-campus-service/scripts/demo-readiness-check.mjs`（新建）, `package.json`

仿 `apps/app1-whiteboard/scripts/demo-readiness-check.mjs` 結構。針對 app2 實際 endpoints（已 grep 驗證 `serialBridge.ts`）：

1. spawn vite dev + bridge in test ports
2. wait `GET /api/health` 200
3. `GET /api/ready` 200（注意：app2 **沒有** `/api/robot/status`，狀態用 `/api/ready` 看 arduino + ai flags）
4. `POST /api/ops/reset` 200 (line 339)
5. `GET /api/ai/status` 200 或 503（503 = AI 知道自己不可用，算合格）
6. `POST /api/ai/vision-classify` (1×1 tiny png) 200/503
7. `POST /api/ai/classroom-scan` (1×1 tiny png) 200/503
8. `POST /api/robot/command` `{command:'BEEP'}` 200/503
9. `POST /api/robot/task` `{action:'PATROL',regionId:'A'}` 200/503
10. `GET /api/display/info` 200
11. `GET /api/display/status` 200
12. shut down，回報 PASS/FAIL，列出每 endpoint 狀態

`package.json` 加：
```json
"demo:check": "node scripts/demo-readiness-check.mjs",
"check": "npm run test && npm run lint && npm run build && npm run demo:check"
```

註: 加進 `check` 是把 demo:check 變必跑。若初版時間吃緊可先不放進 check，僅手動跑。

### G. 一鍵啟動 `.command` 加進 app2

**檔案**: `apps/app2-campus-service/一鍵啟動展示.command`（新建）, `一鍵停止展示.command`（新建）

仿 app3 的同名檔案。功能：
- 自動找可用 vite port（3000 起跳）
- kill 既存 bridge process（lsof 確認 PID 後 kill -9，加 grep 確認是自己的）
- 啟動 bridge `:3202` + vite
- 開 default browser 到主頁
- print 第二螢幕 URL（QR-friendly）

注意：app3 既有 .command 在 git status 顯示 `M` — 表示已被改過，先讀現況再仿。

### H. `server/api-contract.test.mjs`（移到 SHOULD 階段做，先列範圍）

**Note**: 此項從 MUST 降到 SHOULD（per adversarial review 6: 測試補強排在抽檔/fallback 之後）。spec 後面 SHOULD 段重新列。

範圍預告：覆蓋 app2 全 21 個 endpoint（已 grep 驗證），每個 endpoint 一個 case，含 payload + 預期 status code。

### J. 閉環 audit — 3 主流程的「完成證明」wire 確認

`DemoClosureRail.tsx` 實際只有 **3 step**：teach / delivery / life。Done 條件已是 heuristic（line 21-29）：

| Step | 現況 done 條件 | 風險 | 補強 |
|---|---|---|---|
| teach | `state.attendance.scanned` 為 true | scanned 在點完點名才設 true，**正確** | 確認 TeachView WIP 重構後仍呼叫 `setAttendance({scanned: true})` |
| delivery | `state.orders.length > 2`（初始預載 2 筆）| 預載數量改動時 done 條件需同步調整 | 加 `INITIAL_ORDERS_COUNT` 常數，閉環條件改 `orders.length > INITIAL_ORDERS_COUNT` |
| life | `state.tasks.some(t => t.source === 'dispatch')` | source 字串需嚴格 match | 確認 LifeView WIP 派遣時呼叫 `addTask({source: 'dispatch', ...})` |

`DispatchMapView` / `StudentReportView` / `DeliveryTrackingView` / `TaskScheduleView` / `DashboardView` 是 nav 目標**非主閉環**，不必每個都計入 DemoClosureRail，但仍要在 K 段做亮點。

### K. 亮點 audit — 3 主流程 + 2 重要 sub-view 的「wow 瞬間」

| view | 計畫亮點 | 目前狀態 | 補強 |
|---|---|---|---|
| 教學 TeachView | 真實 Gemini Vision 即時辨識 + 點名表動畫 | WIP VisionCameraCard 已有 vision | 確認 AI 標註框可見、點名表勾選有 motion 動畫 |
| 配送 DeliveryView | 配送路徑 SVG 動畫 + 馬達 ACK 回饋 | SVG 動畫 ❓（需查現況）| 加 `<animateMotion>` 沿路徑移動 robot icon；發 command 時 toast 顯示 ACK |
| 生活 LifeView | 廣播鈴聲 Tone.js 真實播放 + scene 動態標籤 | `tone` package 已裝 | 確認 BroadcastCard / 派遣 toggle 觸發 `Tone.Synth().triggerAttackRelease('C5', '0.3')` 真的播 |
| 派遣地圖 DispatchMapView | 區域脈衝 + 機器人 ETA 倒數 | 脈衝動畫 ❓ | tailwind animate-pulse 套到 active zone；ETA 用 useEffect 倒數 |
| 學生報告 StudentReportView | QR code 即時生成可掃 | `qrcode` 已裝 | confirm 報告生成完成時 qrcode 產 data URL 顯示 |

每個亮點若 WIP 已實作則加註，缺的最多 30 min 可補完。Audit 時用 `grep -n "Tone\.\|animateMotion\|animate-pulse\|qrcode"` 各對應檔案確認。

### L. 現場災難 fail-safe（NEW — per adversarial review 2）

**問題**: spec 原本完全沒處理「現場常見災難」— iPad 自動鎖屏、Safari swipe-back 不小心退出 demo、Wi-Fi 整網壞、外接螢幕鏡像比例錯亂。比 AI timeout 更會直接毀展示。

**MUST 4 項 fail-safe**:

1. **iPad 螢幕保持喚醒** — 加 `wakeLock` 在 demo 進入時取得：
   ```ts
   // 加 src/hooks/useWakeLock.ts
   useEffect(() => {
     let wl: WakeLockSentinel | null = null;
     navigator.wakeLock?.request('screen').then((sentinel) => { wl = sentinel; }).catch(() => {});
     return () => { wl?.release().catch(() => {}); };
   }, []);
   ```
   `App.tsx` 在 demo 模式啟動時呼叫。

2. **Safari swipe-back 防呆** — 在 `App.tsx` `useEffect`：
   ```ts
   useEffect(() => {
     const handler = (e: PopStateEvent) => {
       if (state.demoActive) {
         e.preventDefault?.();
         window.history.pushState(null, '', window.location.href);
         showToast('比賽 demo 中，請用 reset 按鈕回首頁');
       }
     };
     window.addEventListener('popstate', handler);
     return () => window.removeEventListener('popstate', handler);
   }, [state.demoActive]);
   ```

3. **Wi-Fi 整網壞 UI 提示** — 在 `useProxyHealth` 偵測到連續 3 次 fetch fail 後，顯示明顯離線 banner（不是只小角小字）。banner 內容：「離線備援模式 — 影像辨識用本機分析」+ 一個「重試」按鈕。

4. **鏡像 / 投影比例 fallback** — `App.tsx` 加 viewport detect：當 screen.width !== window.innerWidth × deviceScaleRatio 時警示「外接螢幕比例可能不正確」。第二螢幕 `RobotDisplaySync` 啟動時印明顯的「投影 URL: ...」chip，讓老師可手動驗證。

### I. WIP commit 凍結 baseline

在做 A-K 之前，先 commit WIP：

1. `cd apps/app2-campus-service && npm run check` 確認綠（已驗）
2. 列每個 M 檔案，分批 stage（不 `git add -A`）：
   - `git add apps/app2-campus-service/server/aiService.ts apps/app2-campus-service/server/serialBridge.ts`
   - `git add apps/app2-campus-service/src/App.tsx apps/app2-campus-service/src/views/TeachView.tsx apps/app2-campus-service/src/views/LifeView.tsx apps/app2-campus-service/src/views/DeliveryView.tsx`
   - `git add apps/app2-campus-service/src/components/life/VisionCameraCard.tsx apps/app2-campus-service/src/components/life/ScanMapCard.tsx`
   - `git add apps/app2-campus-service/src/components/CameraPicker.tsx apps/app2-campus-service/src/hooks/useCameraSelection.ts apps/app2-campus-service/src/components/DemoClosureRail.tsx apps/app2-campus-service/src/components/tour/TourProvider.tsx apps/app2-campus-service/src/services/geminiAi.ts apps/app2-campus-service/src/services/hardwareBridge.ts`
   - `git add apps/app2-campus-service/.env.example apps/app2-campus-service/README.md`
3. 不 stage：`care-bottom.png` 等截圖 / `e2e-demo-flow.mjs` / `simulate-real-demo.mjs`（留待 demo:check 整合後決定）
4. commit message:
   ```
   feat(app2): finish WIP — Gemini migration, new AI endpoints, LifeView/TeachView refactor

   - Migrate Gemma → hosted Gemini 2.5 flash naming
   - Add /api/ai/teacher-reply, dispatch-recommend, student-report endpoints
   - Split LifeView into VisionCameraCard + ScanMapCard
   - Rewrite TeachView (344 lines) with real-time vision + roster
   - Add CameraPicker + useCameraSelection for multi-camera
   - 6 places of 503 fallback in serialBridge

   Status: lint + tests green; reliability hardening to follow.
   ```

---

## 設計 — Phase SHOULD（demo 體驗順，~2 hrs）

per adversarial review：directGemini 跟 serialBridge 拆檔都降到 NICE（非 demo 穩定核心）。SHOULD 留實際幫助 demo 順的：

### 1. Reset demo 徹底化

點 reset 後完整清空：
- localStorage + memoryFallback
- WS broadcast `demo_reset` 給所有 client（含 robot-display 第二螢幕 — app2 用 `RobotDisplaySync.tsx`）
- 第二螢幕收到後重置自己的 state
- demo timer / closure rail done flags 同步歸零

`appState.ts` 加 `RESET_DEMO` action，dispatch 後同步 `localStorage.removeItem` + `_memoryFallback.delete` + WS broadcast。

### 2. 三流程亮點 fix（K 補完未實作的）

把 Phase MUST K 表中 ❓ 標記的亮點實作到位：
- 配送 SVG `<animateMotion>` 動畫
- 廣播 `Tone.Synth` 觸發
- 派遣地圖 active zone `animate-pulse`
- 學生報告 QR code 即時生成
- 教學 AI 標註框可見性

每項 < 30 分鐘。

### 3. `server/api-contract.test.mjs`

**檔案**: `apps/app2-campus-service/server/api-contract.test.mjs`（新建）

仿 `apps/app1-whiteboard/server/api-contract.test.mjs`，覆蓋 app2 全部 21 個 endpoint，每個一個 case：

- `GET /api/health` → 200 + `{ok: true}`
- `GET /api/ready` → 200
- `GET /api/ai/status` → 200 或 503
- `POST /api/robot/command` `{command:'BEEP'}` → 200/503
- `POST /api/robot/task` `{action:'PATROL',regionId:'A'}` → 200/503
- `POST /api/ai/campus` (basic payload) → 200/503
- `POST /api/ai/vision-classify` (tiny png) → 200 包 scene/confidence/zone/summary, OR 503 + fallback
- `POST /api/ai/teacher-reply` `{question:'測試問題'}` → 200/503
- `POST /api/ai/dispatch-recommend` `{zone:'A棟',taskType:'patrol'}` → 200/503
- `POST /api/ai/student-report` `{name:'測試',data:{}}` → 200/503
- `POST /api/ai/classroom-scan` (tiny png) → 200/503
- `GET /api/logs` → 200, array
- `POST /api/ops/reset` → 200
- `GET /api/ev3/status` → 200
- `POST /api/ev3/command` `{command:'BEEP'}` → 200/400/503
- `GET /api/spike/status` → 200
- `POST /api/spike/command` `{command:'BEEP'}` → 200/400/503
- `GET /api/display/info` → 200
- `POST /api/display/emotion` `{emotion:'calm'}` → 200/400
- `POST /api/display/cue` `{cue:'BEEP'}` → 200/400
- `GET /api/display/status` → 200

`check` script 加：
```json
"check": "npm run test && tsx server/api-contract.test.mjs && npm run lint && npm run build"
```

### 4. Soak checklist（30-60 min 手動驗證）

加 `docs/DEMO_SOAK_CHECKLIST.md`（不在自動測試裡，給人跑）：
- 開 demo 30 min，每 5 min 切一次 view（teach → delivery → life → 重複）
- 觀察 chrome devtool Memory tab：JS heap 不應持續增長（短暫飆升 OK，但要 GC 回來）
- 觀察 WS 是否累積斷線 / 重連 log
- 點 reset 10 次，觀察 closure rail counter 是否乾淨歸零
- iPad mirror 到投影機，觀察 1080p 解析度下 layout 是否破版

---

## 設計 — Phase NICE（工程潔癖 / 後續精進，~3 hrs）

per adversarial review 4-5：directGemini 跟 serialBridge 拆檔是「工程潔癖」不是 demo 穩定核心，移到 NICE。如有餘裕可做。

### 1. `server/defaults.ts`

抽 demo 預設值集中：
```ts
export const DEMO_ZONES = [...];
export const DEMO_BROADCASTS = [...];
export const DEMO_TEACHER_QUESTIONS = [...];
export const AI_PROMPT_TEMPLATES = {visionClassify: '...', teacherReply: '...', ...};
export const DEFAULT_DEMO_PROGRESS = {teach: false, deliver: false, ...};
```

`aiService.ts` 跟各 endpoint 引用，改 demo 內容只改一個檔。

### 2. `server/hardwareSimulation.test.ts`

仿 app1 同名檔。覆蓋 sim mode 下：
- bridge 啟動不會去 open serial port
- `sendCommand` 在 sim mode 回模擬 ACK
- `/api/robot/command` 在 sim mode 200

15-20 個 assertion，~80 行。

### 3. `src/services/directGemini.ts`（從 SHOULD 降至此 — 比賽現場有 bridge 不需要）

仿 `apps/app1-whiteboard/src/services/directGemini.ts`。4 個 function：
- `directClassifyVisionScene(imageBase64, zonePool)`
- `directGenerateTeacherReply(question, subject?)`
- `directGenerateDispatchRecommendation(zone, taskType)`
- `directGenerateStudentReport(name, data)`

用 `import.meta.env.VITE_GEMINI_API_KEY` 客戶端版呼叫。`geminiAi.ts` 偵測 bridge fail 自動切。

**只做於：規劃 GitHub Pages public deploy 時**。比賽機就有 bridge，不需要 expose API key。

### 4. serialBridge 拆檔（從 SHOULD 降至此 — 工程潔癖不是 demo 穩定）

`serialBridge.ts` 444 行 → 拆 4 個檔（~220 行 main + 子模組）：
- `server/wsBroadcast.ts` (~50 行): 抽 `broadcast()` (wss.clients) + `sendToDisplayClients()` (displayClients subscriber set, line 77+) — **rigor review 8**：兩套 channel 都要 export，不能只抽一個
- `server/routes/aiRoutes.ts` (~120 行): 5 個 `/api/ai/*` endpoint
- `server/routes/robotRoutes.ts` (~80 行): `/api/robot/*` + `/api/robot/task` + display/cue endpoint
- `server/validation.ts` (~50 行): 輸入檢查 helpers

每組 routes 用工廠函數注入 `{broadcast, sendToDisplayClients, sendCommand, ...}` 避免 circular import。

**只做於：時間有餘裕**。比賽前要拆需重跑完整 contract test 防 regression。

---

## 不做的事

- ❌ `proxyRoutes.ts` + `express-rate-limit` + `zod` — 不是 public 產品，rate-limit 無意義
- ❌ `opsService.ts` 抽檔 — 功能保留在 serialBridge 即可
- ❌ `http.ts` helpers 抽檔
- ❌ `config.ts` 抽檔 — `.env` 已負責環境變數
- ❌ `types.ts` 抽檔 — 各檔案 inline
- ❌ `dev:full` script — app2 無額外 service（OCR 是 app1 限定）
- ❌ 改 `appState.ts` 拆 slice — Gemini 評估極高風險（per 既有 `2026-05-10-app2-comprehensive-upgrade-design.md`）
- ❌ 刪 `legacy/` 目錄 — per CLAUDE.md「Do not delete project files unless the user explicitly asks」
- ❌ 改 robot-app（app2 沒有 robot-app 子專案，app2 第二螢幕用 RobotDisplaySync）

---

## 成功標準（demo 視角驗收）

完成所有 phase 後，**人工現場驗收**：

1. **拔網測試**: 切斷 wifi 後點教學分析 / 配送 / 視覺辨識 — 20s 內看到 local fallback 回應，畫面不轉圈
2. **拔 Arduino 測試**: 不接 bridge 直接送 `/api/robot/command` — 看到 503 「命令已送出但 Arduino 未確認」訊息，UI 不假裝成功
3. **快速連點測試**: 快速點配送按鈕 3 次 — busy state 不卡，舊 request 自動 abort
4. **iOS 私密模式測試**: iOS Safari 開私密模式跑 demo — 整個流程不崩，state 走 memoryFallback
5. **bridge 重啟測試**: 跑 demo 過程 kill bridge → 重啟 — 前端 WS 自動 reconnect，狀態恢復
6. **3 主閉環測試**: teach → delivery → life 依序跑完 — DemoClosureRail 顯示 3/3 完成，標題切「3/3 完成 · 可以收尾報告」
7. **5 view 亮點驗收**: 教學 vision 標註可見 / 配送 SVG 動畫流暢 / 廣播 tone 真實響 / 派遣 pulse 動畫 / 報告 QR 可掃
8. **demo:check 全綠**: `npm run demo:check` 全 endpoint PASS
9. **完整 check 全綠**: `npm run check` 全綠（含新 api-contract test）
10. **Reset demo 完整**: 點 reset 後第二螢幕同步重置，無殘留 state

---

## 風險與緩解

| 風險 | 緩解 |
|---|---|
| Module-scoped abort pattern 套 5 view 改太大破功能 | 一次只改一個 view，每 view commit + check 綠才進下個 |
| serialBridge 拆檔破壞既有 endpoint | 拆完跑 api-contract test，紅燈不進下 phase |
| directGemini 客戶端 API key 洩漏疑慮 | README 已標明這是 demo，public deploy 用獨立低 quota key |
| `demo:check` script 一開始太嚴格阻擋 commit | 第一版不加進 `check`，僅手動跑；穩定後再 wire 進 check |
| WIP commit 後發現有遺漏 bug | 用後續 commit 修；commit message 已標 baseline |
| 拆檔時 dependency 循環 | aiRoutes / robotRoutes 不互相 import，共用透過 wsBroadcast + validation |

---

## 執行順序

A1（MUST）→ A2（SHOULD）→ A3（NICE），每階段 `npm run check` 綠才進下一階段。

- **A1.0 WIP commit baseline**（5 min）
- **A1.1 withAiTimeout 7 個 callsite (proper AbortController)**（30 min）
- **A1.2 Robot ACK timeout 降級 polish**（15 min — 韌體無 ACK echo 已驗）
- **A1.3 module-scoped abort 5 view**（90 min — 大頭）
- **A1.4 localStorage Map fallback**（20 min）
- **A1.5 scripts/demo-readiness-check.mjs + npm script**（30 min）
- **A1.6 一鍵啟動 .command + 一鍵停止.command**（20 min）
- **A1.7 閉環 audit (3 step) + 亮點 audit fix**（60 min — 3 step 不是 5）
- **A1.8 現場災難 fail-safe (L)**: wakeLock + swipe-back disable + 離線 banner + 鏡像 chip（45 min）
- → check 綠 + manual 拔網/拔線測試 → commit MUST done
- **A2.1 Reset 徹底化 + 第二螢幕 sync**（30 min）
- **A2.2 K 亮點補完未實作的**（30 min）
- **A2.3 api-contract.test.mjs (21 endpoints)**（60 min）
- **A2.4 docs/DEMO_SOAK_CHECKLIST.md + 跑一次 soak**（45 min）
- → check 綠 → commit SHOULD done
- **A3.1 defaults.ts**（30 min）
- **A3.2 hardwareSimulation.test.ts**（45 min）
- **A3.3 directGemini.ts (if GitHub Pages 部署需求)**（60 min — 條件式）
- **A3.4 serialBridge 拆檔 (if 時間餘裕)**（90 min — 條件式）
- → check 綠 → commit NICE done

**估計總時長**:
- MUST: 5 hrs（含新 L 段，扣掉 api-contract test 移 SHOULD）
- SHOULD: 2.75 hrs
- NICE: 2 hrs 必做 + 2.5 hrs 條件式 = 2-4.5 hrs
- Solo 合計 ~10-12 hrs
- **平行派 codex 可壓到 ~7-9 hrs**
