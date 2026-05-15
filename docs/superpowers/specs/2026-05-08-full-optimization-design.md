# 三 App 全面最佳化設計（穩定優先版）— 2026-05-08

## 目標

以「評審 Demo 品質最大化 + 現場穩定性」為主軸。Codex + Gemini 雙重審查後確認：穩定性 > 功能完整性。移除高風險 UI、精簡 server 架構、補齊 Demo 保命 gate。

## 設計原則（Codex + Gemini 審查後修訂）

1. **App 2/3 server 精簡化**：不是 6-7 個新檔，擴展現有 `serialBridge.ts` + 最多 2 個新檔
2. **WebSocket + 輪詢雙軌**：WS 優先，連不上 fallback 到每 3 秒 polling `/api/health`
3. **ACK 兼容層**：新格式 backward-compatible，不破壞現有 parser
4. **Demo gate 最優先**：一鍵三橋啟動、30 秒彩排、一鍵 reset
5. **移除高風險 UI**：拖拉排序 → 按鈕排序；路徑動畫 → 靜態 highlight
6. **持久化加 schema 防護**：JSON 讀取加驗證 + 自動恢復

---

## 現況落差總表

| 層 | App 1 板擦機器人 | App 2 服務機器人 | App 3 心靈守護者 |
|---|---|---|---|
| Server AI Proxy | ✅ | ❌ | ❌ |
| Server Storage (JSON) | ✅ | ❌ | ❌ (重啟消失) |
| `/api/ready` health | ✅ | ❌ | ❌ |
| WebSocket 即時推播 | ❌ | ❌ | ❌ |
| 硬體 ACK 兼容格式 | ⚠️ | ⚠️ | ⚠️ |
| Demo gate (reset/rehearsal) | ⚠️ | ⚠️ | ⚠️ |
| 校準/指派資料持久化 | ❌ | N/A | ❌ |

---

## 實作優先序（由高到低）

### P0 — Demo 保命 Gate（最高優先）

#### A. 三橋一鍵啟動腳本 `scripts/start-all-bridges.sh`
```bash
# 啟動全部三個 bridge，顯示每個 port 狀態，CTRL+C 一次全停
BRIDGE_PORT=3201 npm --prefix "<app1>" run start &
BRIDGE_PORT=3202 npm --prefix "<app2>" run start &
BRIDGE_PORT=3203 npm --prefix "<app3>" run start &
# 等待 2 秒後 health check 三個 port
```
- 每個 port 健康後顯示 `✅ App N bridge :320N ready`
- 任一 port 失敗顯示 `❌ App N bridge failed`，但不中斷其他 app

#### B. 一鍵全 reset `scripts/reset-all-demos.sh`
- 依序呼叫三個 App 的 `POST /api/ops/reset`（或直接清 data/ 目錄）
- 用於比賽前還原所有 demo 資料

#### C. 30 秒彩排腳本 `scripts/rehearsal-check.mjs`
- 啟動三個 bridge → `/api/ready` 檢查 → Arduino 連線確認 → AI fallback 確認
- 全通過輸出 `🟢 DEMO READY`，任一失敗詳細說明原因

### P1 — WebSocket + 狀態 Banner（高優先）

#### 三個 Bridge 加入 WebSocket endpoint
使用 `ws` npm package（App 1 package.json 已有，App 2/3 需新增 dependency）。

**endpoint**: `ws://localhost:320X/ws`

**事件格式**（backward-compatible，不改既有 HTTP 行為）：
```ts
type WsEvent =
  | { type: 'arduino_status'; connected: boolean; port: string; simulated: boolean }
  | { type: 'command_ack'; command: string; ok: boolean; response?: string }
  | { type: 'sensor_snapshot'; temp: number|null; hum: number|null; light: number|null }
```

**推送時機**：
- Arduino 連線/斷線
- 每次指令送出後有 ACK（原有 HTTP 回應不受影響）
- 感測器輪詢每輪（App 1 和 App 3）

#### 前端 `useHardwareSocket` hook（三個 App 各加）
```ts
// src/hooks/useHardwareSocket.ts
function useHardwareSocket(bridgeUrl: string) {
  // 1. 嘗試 WebSocket 連線
  // 2. 若 5 秒內無法建立 WS → fallback 到每 3 秒 polling /api/health
  // 3. WS 重連：指數退避，最大 30 秒
  return { connected, lastCommand, sensorSnapshot, mode: 'ws'|'polling' }
}
```

#### `HardwareStatusBanner` 元件（三個 App 各加）
- 頂部 4px 色帶：🟢 連線 / 🟡 模擬 / 🔴 斷線
- 顯示 port path 和 mode（ws / polling）
- 斷線時顯示「重新連線」按鈕

### P2 — App 2/3 Server 精簡升級（中優先）

**策略**：不建立 6-7 個新檔的完整架構；在現有 `serialBridge.ts` 擴展 + 新增最多 2 個輔助檔。

#### App 2 新增 `server/storage.ts`（獨立檔案）
- `readJsonFile<T>` / `writeJsonFile` — 同 App 1 的工具函式
- `appendDeliveryLog(entry)`, `appendTaskLog(entry)`, `getRecentLogs()`
- `resetDemoData()` — 清除 data/ 下的 JSON 日誌
- Schema 驗證：讀取時若格式異常自動 fallback 到空陣列，不中斷

#### App 2 新增 `server/aiService.ts`（獨立檔案）
- Gemini proxy：`analyzeDeliveryTask(context)` — 配送建議
- 本機 fallback：curriculum-aware 教學回覆
- `isGeminiConfigured()` → false 時靜默使用 fallback，不顯示錯誤

#### App 2 `serialBridge.ts` 新增路由
- `GET /api/ready` — `{ok, arduino, ai, bridge_port}`
- `POST /api/robot/task` — 高層指令 + 任務日誌寫入
- `POST /api/ai/campus` — AI proxy 端點
- `POST /api/ops/reset` — 重置 demo 資料

#### App 3 新增 `server/storage.ts`
- 節點指派持久化：`data/sensor-assignments.json`
- 提醒日誌：`data/alert-log.json`
- 介入紀錄：`data/intervention-log.json`
- Schema 驗證 + 自動恢復

#### App 3 新增 `server/aiService.ts`
- Gemini proxy：`analyzeGuardianAlert(context)` — 關懷建議
- 本機 fallback：`localGuardianReply(alertType)` — 非診斷式回覆
- `isGeminiConfigured()` 同上

#### App 3 `serialBridge.ts` 新增路由
- `GET /api/ready` — `{ok, arduino, ai, bridge_port}`
- `POST /api/ai/guardian` — AI proxy 端點
- `GET /api/logs/alerts` / `POST /api/logs/alerts`
- `POST /api/ops/reset` — 重置 demo 資料

節點指派從記憶體 `portZoneMap` → 改為透過 `storage.ts` 持久化。

### P3 — 韌體改善（中優先）

**統一規範（所有 4 個 firmware target）**：
- `HEARTBEAT` 收到後回 `PONG\n`（所有 target 統一，App 1 目前缺回應）
- ACK 格式為**新增**，不移除現有回應格式：
  - 執行成功後附加一行 `OK:<COMMAND>\n`（在原有回應後）
  - 未知指令回 `ERR:UNKNOWN:<COMMAND>\n`
  - 前端 parser 兼容層：看到 `OK:` 或 `ERR:` 就解析，其他行維持現有處理

**App 1** (`firmware/app1-whiteboard-drive/main.cpp`)：
- 加入 `HEARTBEAT → PONG` 回應
- 加入 `STATUS` 指令：回 `STATUS:SPEED:<n>,WDT:<armed|off>\n`

**App 2** (`firmware/app2-sweeper-drive/main.cpp`)：
- 加入 `HEARTBEAT → PONG` 回應
- `SWEEP_STATUS` 查詢回 `STATUS:SWEEP:<on|off|reversed>,SPEED:<n>\n`

**App 3** (`firmware/app3-guardian-drive/main.cpp`)：
- `SENSOR_SNAPSHOT` 指令：立即回 `SENSORS:TEMP:<f>,HUM:<n>,LIGHT:<n>\n`
- `NODE_STATUS` 查詢回 `STATUS:NODES:connected,WDT:<armed|off>\n`

### P4 — 持久化 + 校準（中低優先）

**App 1 白板校準持久化**：
- `server/storage.ts` 新增 `readCalibration()` / `saveCalibration(data)`
- 儲存於 `data/calibration.json`
- Schema：`{ version: 1, regions: BoardRegion[], savedAt: string }`
- Server 啟動時讀回；PUT `/api/calibration` 時非同步寫入（不 block 回應）

**App 3 感測器指派持久化**：
- 現有 `portZoneMap` → storage 層持久化（已在 P2 規劃中）

### P5 — 前端 UI Polish（低優先，穩定後做）

**跨 App 統一（三個 App）**：
- `CommandFeedbackToast`：指令送出 → ACK 的視覺反饋（2 秒淡出）
- `AiThinkingOverlay`：skeleton pulse + Gemini/本機模式標示

**App 1**：
- 白板校準精靈（3 步驟）：拍照 → 標記區塊 → 儲存（已有 calibration routes，補 UI）
- 教師決策歷史（底部抽屜，讀 data/tasks.json）

**App 2**（安全版，移除拖拉）：
- 配送隊列優先序：上移/下移按鈕（不做拖拉）
- 派遣地圖：選定任務後 SVG 路徑靜態 highlight（不做動畫）
- 任務歷史面板：讀 server storage 的日誌

**App 3**：
- 情緒熱圖：靜態矩陣（校園空間 × 時間段），顏色代表平均分數
- 提醒嚴重度統一色碼：高（紅）/ 中（橘）/ 低（黃）
- Guardian AI 信心度標示：Gemini 標「AI 分析」，本機標「本機建議」

---

## package.json 異動

**App 2 新增 dependency**：
```json
{ "ws": "^8.18.0", "@types/ws": "^8.5.14" }
```

**App 3 新增 dependency**：
```json
{ "ws": "^8.18.0", "@types/ws": "^8.5.14" }
```
（App 1 已有 `ws`）

**Root 新增 scripts**：
```json
{
  "scripts": {
    "start:all": "bash scripts/start-all-bridges.sh",
    "reset:all": "bash scripts/reset-all-demos.sh",
    "rehearsal": "node scripts/rehearsal-check.mjs"
  }
}
```

---

## 驗收標準（全部 App）

```bash
# 各 App 個別驗收
npm run check         # TypeScript + build + API contract + state tests
npm run verify:ui     # 手機 390px 截圖不溢出（需要有此 script）

# 跨 App 驗收
npm run rehearsal     # 三橋 + /api/ready + Arduino + AI fallback 全通過
npm run reset:all     # Demo 資料全部恢復初始狀態
pio run -e uno_r4_minima_app1_whiteboard_drive
pio run -e uno_r4_minima_app2_sweeper
pio run -e uno_r4_minima_app3_guardian_drive

# 最終 Demo gate
# 三個 bridge 同時啟動，全部 /api/ready 回 ok:true
# 每個 App 的 HardwareStatusBanner 顯示正確狀態
# Arduino 拔插後 5 秒內 banner 更新
```

---

## 實作任務清單

### 批次 A（P0 + P1，可平行）
- [ ] A1: 寫 `scripts/start-all-bridges.sh` + `scripts/reset-all-demos.sh`
- [ ] A2: 寫 `scripts/rehearsal-check.mjs`（三橋健康檢查）
- [ ] A3: App 1 bridge 加 WebSocket + 前端 `useHardwareSocket` hook + `HardwareStatusBanner`
- [ ] A4: App 2 bridge 加 WebSocket + 前端 `useHardwareSocket` hook + `HardwareStatusBanner`
- [ ] A5: App 3 bridge 加 WebSocket + 前端 `useHardwareSocket` hook + `HardwareStatusBanner`

### 批次 B（P2 + P3，依批次 A 完成後平行）
- [ ] B1: App 2 新增 `server/storage.ts` + `server/aiService.ts`，serialBridge 擴充路由
- [ ] B2: App 3 新增 `server/storage.ts` + `server/aiService.ts`，serialBridge 擴充路由 + 持久化指派
- [ ] B3: 韌體改善 App 1（HEARTBEAT + STATUS）
- [ ] B4: 韌體改善 App 2（HEARTBEAT + SWEEP_STATUS）
- [ ] B5: 韌體改善 App 3（SENSOR_SNAPSHOT + NODE_STATUS）

### 批次 C（P4 + P5，最後執行）
- [ ] C1: App 1 白板校準持久化（storage 擴充 + routes）
- [ ] C2: App 2 UI polish（CommandFeedbackToast + 隊列排序按鈕 + 派遣 highlight）
- [ ] C3: App 3 UI polish（情緒熱圖 + 嚴重度色碼 + AI 標示）
- [ ] C4: App 1 白板校準精靈 UI + 教師決策歷史抽屜
