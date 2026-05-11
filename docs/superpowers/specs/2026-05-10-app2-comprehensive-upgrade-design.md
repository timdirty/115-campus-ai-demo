# App2 校園服務機器人 — 全面升級設計規格

**日期：** 2026-05-10  
**範圍：** Bug 修復 + 共用基礎設施 + LifeView 元件拆分  
**排除：** appState.ts 拆 slice（Gemini 評估：連動 Action 重構風險極高，比賽前不動）

---

## 問題總覽（Codex 靜態分析 + 手動 review）

- 8 Critical bugs（含可讓 demo 崩潰或機器人亂跑的問題）
- 12 Memory leaks / race conditions
- 9 Design smells（含 1039/776/565/1226 行巨型檔案）
- 6 Quick wins

---

## 架構決策

### 新增共用 hooks（src/hooks/）

**`useCamera(active: boolean)`**
- 目的：統一管理所有頁面的攝影機生命週期，消滅 LifeView / TeachView / DashboardView 重複的 getUserMedia 邏輯
- 介面：`{ videoRef, canvasRef, ready, error: string | null }`
- iOS fallback：先 `facingMode: 'environment'`，OverconstrainedError → 重試 `facingMode: 'user'`
- cleanup：停止所有 tracks + 設 srcObject = null

**`useGeminiVision(active: boolean, intervalMs = 5000)`**
- 目的：統一 Gemini Vision 輪詢 + 防止重疊請求
- 全域 rate limiter（singleton token bucket，6s 最小間隔跨所有 view）
- 只在前一次請求完成後才啟動下一次（解決 5s timer + 8s timeout 重疊問題）
- 介面：`{ result: CampusVisionResult | null, analyzing: boolean, source: 'gemini' | 'local' }`

### LifeView 元件化

```
src/components/life/
├── VisionCameraCard.tsx    (~150 行) — 攝影機 + Gemini Vision 辨識
├── ScanMapCard.tsx         (~120 行) — 校園掃描地圖 + 區域狀態
├── BellScheduleCard.tsx    (~80 行)  — 鐘聲時間表
├── BroadcastCard.tsx       (~100 行) — 全校廣播系統
└── EnvMonitorCard.tsx      (~80 行)  — 環境感測/天氣卡片

src/views/LifeView.tsx      (~200 行) — 只負責 layout + state 協調（拆後）
```

---

## Phase 1：Critical Bug 修復

| # | 檔案 | 問題 | 修法 |
|---|------|------|------|
| 1 | `LifeView.tsx:2` | `let _eventId = 100` 夾在 import 間 | 移到所有 imports 之後 |
| 2 | `DashboardView.tsx:51` | 硬寫 `localhost:3202` | 改用 `hardwareBridge.BRIDGE_URL` |
| 3 | `localVision.ts:285` | Gemini timeout 2000ms（Gemini 要 3-8s） | 改 8000ms |
| 4 | `localVision.ts:298` | `data.scene as VisionScene` 無驗證 | 加 VALID_SCENES 白名單，未知值 fallback patrol |
| 5 | `localVision.ts:221-229` | `getBridgeUrl()` 與 hardwareBridge.ts 重複實作 | 統一使用 `BRIDGE_URL` from hardwareBridge |
| 6 | `TeachView.tsx:76` | `AbortSignal.timeout(8000)` Safari < 16.4 不支援 | 改 AbortController + setTimeout |
| 7 | `TeachView.tsx:114` | camera 失敗只 setCamReady=false，畫面卡在「開啟攝影機中」 | 加 error state，顯示錯誤訊息 |
| 8 | `serialBridge.ts:107-110` | timeout middleware 送 503 後 handler 還會再送 response | 加 `if (res.headersSent) return` guard |
| 9 | `serialBridge.ts:61` | WS 連線後不送初始狀態，前端可能一直顯示「未連線」 | 連線時立即 push `arduino_status` |
| 10 | `LifeView.tsx:323` | scene 改變自動送硬體指令，無使用者確認 | 改為「使用者點擊派遣按鈕」才送指令 |
| 11 | `hardwareBridge.ts:37` | auto-retry 在命令已送達時重複觸發 Arduino | 加 flag：只有 503（bridge busy）才重試，不重試 timeout（命令可能已送達） |

---

## Phase 2：Memory Leak 修復

| # | 位置 | 問題 | 修法 |
|---|------|------|------|
| 12 | `LifeView.tsx:240` | getUserMedia 無 cancelled guard | `useCamera` hook 統一處理 |
| 13 | `LifeView.tsx:230` | 停止 tracks 後未清 srcObject | stop 後設 `videoRef.current.srcObject = null` |
| 14 | `LifeView.tsx:355,365` | 廣播 timeout 未清理 | 存 ref，cleanup 清除 |
| 15 | `LifeView.tsx:318` | cleanup 內呼叫 setState | 改用 cancelled flag，只 abort/clear interval |
| 16 | `localVision.ts:286` | abort listener 累積 | 改 `{once: true}` 選項 |
| 17 | `TeachView.tsx:72` | vision fetch 未隨 modal 關閉 abort | `useGeminiVision` hook 統一處理 |
| 18 | `TeachView.tsx:111` | 5s 輪詢 + 8s timeout 重疊 | `useGeminiVision` 改為「上次完成後才啟動」 |
| 19 | `TeachView.tsx:170` | 點名 setTimeout 未清 | 存 ref，cleanup 清除 |
| 20 | `DashboardView.tsx:143` | camera getUserMedia 無 cancelled guard | `useCamera` hook 統一處理 |
| 21 | `useHardwareSocket.ts:75` | connectDeadline 是區域變數無法 cleanup | 存 ref |
| 22 | `useHardwareSocket.ts:13` | `replace(/^http/, 'ws')` 不安全 | 改用 `new URL()` |

---

## Phase 3：LifeView 元件拆分

目標：LifeView.tsx 從 1039 行拆到 ~200 行。

**拆分策略：**
- 每個 Card 元件是 pure-ish component，只透過 props 接收所需資料 + callback
- 不共用內部 state（各自 local state），LifeView 只傳必要的 appState 片段
- 先抽，再測試 TypeScript 通過才算完成

**VisionCameraCard**：接收 `showToast`，內部用 `useCamera` + `useGeminiVision`  
**ScanMapCard**：接收 scan zone 資料（可從 LifeView 傳入，或 hardcode scan zones）  
**BellScheduleCard**：無 props（自行計算 computeBells）  
**BroadcastCard**：接收 `showToast`, `onDispatch` callback  
**EnvMonitorCard**：接收環境感測資料（可 hardcode demo 資料）

---

## Phase 4：DashboardView 攝影機整合

- 用 `useCamera` + `useGeminiVision` 替換 DashboardView 自有的 visionVideoRef/visionCanvasRef/visionStreamRef
- 解決 DashboardView camera stream 的 cancelled guard leak（Codex 找到的 line 143）

---

## Phase 5：Server-side 強化

- serialBridge: timeout middleware double-response bug（Phase 1 已含）
- serialBridge: 初始 arduino_status push（Phase 1 已含）
- serialBridge: `lsof + kill -9` 加 guard 避免殺掉其他程序（快速加 grep 過濾 pid 判斷）

---

## 不做的事

- appState.ts 拆 slice（Gemini 評估：極高風險，連動 Action 同步極易崩）
- 加新功能（功能完整性 > 新功能，比賽前）
- CSS/設計大幅改動（現有設計品質已高）

---

## 成功條件

1. `npm run check` 全過（tsc + test + build）
2. `npm run dev` 啟動後：proxy online banner 消失 / camera 開啟 / Gemini 正常辨識
3. 模擬斷網：fallback 到本地分析，不崩潰
4. 模擬關閉 video modal：camera stream 確實停止（DevTools → Camera indicator 消失）
5. LifeView.tsx 行數 ≤ 250 行
