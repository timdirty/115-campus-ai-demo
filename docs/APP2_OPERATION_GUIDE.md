# App2 校園服務機器人 — 完整操作與 Demo 指南

**版本：** 2026-05-10（全面升級後版本）  
**驗證狀態：** ✅ npm run check 全過（test + lint + build）

---

## 目錄

1. [系統架構](#1-系統架構)
2. [啟動步驟](#2-啟動步驟)
3. [連線設定](#3-連線設定)
4. [五大功能介紹](#4-五大功能介紹)
5. [Demo 流程（比賽用）](#5-demo-流程比賽用)
6. [硬體指令對照表](#6-硬體指令對照表)
7. [故障排除](#7-故障排除)
8. [技術驗證結果](#8-技術驗證結果)

---

## 1. 系統架構

```
瀏覽器 (React App)
    ↕ HTTP REST + WebSocket
Bridge Server (localhost:3202)
    ↕ Serial / USB
Arduino UNO R4 WiFi
    ↕ L293D Motor Driver
    掃地滾筒 (M3+M4) + 車輪 (M1+M2)
    
[選配] EV3 / SPIKE Prime (USB)
[AI]   Gemini 2.5 Flash (via GEMINI_API_KEY in .env)
```

**前端網址：** http://localhost:3000  
**Bridge API：** http://localhost:3202  
**跨裝置（同網路）：** http://[你的IP]:3000

---

## 2. 啟動步驟

### 方法 A：一鍵啟動（推薦）

```bash
cd "google ai studio/app_2（國小）/校園服務機器人 app"
npm run dev
```

啟動後 console 會顯示：
```
[web]  ➜  Local:   http://localhost:3000/
[web]  ➜  Network: http://192.168.X.X:3000/
[bridge] App 2 service-robot serial bridge listening on http://localhost:3202
[bridge] reconnect in 500ms (no port detected)   ← Arduino 未插，正常
```

### 方法 B：分開啟動（Debug 用）

```bash
# Terminal 1：前端
npm run dev:web

# Terminal 2：Bridge
npm run dev:bridge
```

### 確認啟動成功

```bash
curl http://localhost:3202/api/ready
# 期望回應：{"ok":true,"arduino":false,"ai":true,"bridge_port":3202}
# arduino:false = 未插 Arduino（正常）
# ai:true = Gemini API 連線正常
```

---

## 3. 連線設定

### 3.1 Arduino 連線（有實體硬體時）

1. 用 USB-C 插上 **Arduino UNO R4 WiFi**
2. Bridge 自動偵測，console 顯示：
   ```
   [bridge] connected to /dev/cu.usbmodemXXXX at 115200
   ```
3. 前端右上角硬體狀態圖示從 🔴 變 🟢
4. WebSocket 立即推送 `arduino_status` 到前端（不需要等待）

### 3.2 Gemini AI 連線

`.env` 已設定（不需要動）：
```
GEMINI_API_KEY=AIzaSy...
```

Bridge 啟動時自動載入。前端 `/api/ready` 回 `"ai":true` 代表正常。

### 3.3 多裝置展示（平板 + 筆電）

平板用瀏覽器開啟：`http://[筆電IP]:3000`  
- 筆電 IP 從 console 的 `Network:` 那行看
- 同一個 WiFi 才能連

### 3.4 環境設定檔

```
.env
├── VITE_AI_PROXY_URL=http://localhost:3200   (備用 proxy，可不用)
├── VITE_AI_PROXY_KEY=campus-ai-proxy-2026
└── GEMINI_API_KEY=AIzaSy...                  (Gemini Vision 用)
```

---

## 4. 五大功能介紹

### 4.1 配送頁（預設首頁）`[配送]` tab

**功能：** 學校物品配送排班、路線追蹤

操作：
1. 點底部中央大按鈕 **「配送」**（預設已在這頁）
2. 選擇目標教室 → 確認配送
3. 有 Arduino 時機器人前進到目標位置
4. 點「確認送達」→ EV3 手臂縮回（若有連 EV3）

### 4.2 教學頁 `[教學]` tab

**功能：** AI 課堂輔助、學生狀態辨識、AI 點名

操作：
1. 點底部 **「教學」** tab
2. **開啟攝影機辨識：**
   - 點「開始上課」→ 攝影機啟動
   - Gemini 每 5 秒辨識一次學生專注狀態
   - 顯示場景標籤 + 信心度（`✦ Gemini 2.5 Flash`）
3. **AI 點名：**
   - 點「AI 場域點名」
   - 2.5 秒後自動完成 → toast 通知「點名完成：2 個座位待確認」
4. 攝影機關閉時 stream 確實停止（Chrome DevTools 攝影機圖示消失）

### 4.3 生活頁 `[生活]` tab ← **主要 Demo 亮點**

**四個子模組：**

#### 🔔 鐘聲時間表
- 自動計算當前時間，標示「即將」響的節次（藍色 + 動畫）
- 已過的節次顯示 ✓（灰色）
- 每分鐘自動更新

#### 🗺️ 校園掃描地圖
- 顯示校園各區域（A棟/B棟/操場/圖書館/廁所/走廊）
- 每 3 秒自動輪播到下一個區域
- 每個區域顯示狀態（正常/需清潔/人群聚集）

#### 🌡️ 環境監控
- 溫度、濕度、空氣品質卡片
- Demo 資料（無需真實感測器）

#### 📢 廣播系統（兩段式防誤觸）
1. 選擇廣播區域（全校/A棟/B棟/操場，可多選）
2. 第一次點「緊急廣播」→ 進入準備狀態
3. 2.5 秒內再次點擊 → 確認送出，顯示 toast
4. 有 Arduino 時送 `BROADCAST_EMERGENCY` 指令

#### 📷 Gemini Vision 場域辨識
1. 點頁面右上角攝影機按鈕
2. 鏡頭開啟（iOS 自動 fallback：後鏡頭 → 前鏡頭 → 任意）
3. Gemini 每 4 秒辨識一次：
   - `crowd` 人群 → 按鈕「立即廣播疏導」
   - `safety` 危險 → 按鈕「緊急安全巡查」
   - `cleaning` 清潔 → 按鈕「派遣清掃任務」
   - `delivery` 配送 → 按鈕「配送服務派遣」
   - `patrol` 一般 → 按鈕「開始巡邏任務」
4. **點按鈕才派遣**（不會自動送出硬體指令）
5. 有 Arduino 時按鈕會實際送 serial 指令給機器人

### 4.4 Dashboard（側邊欄，平板模式可見）

- 系統狀態總覽
- 任務佇列（近期派遣紀錄）
- 即時 WebSocket 硬體狀態

---

## 5. Demo 流程（比賽用）

### 建議 Demo 順序（10 分鐘版）

```
00:00  啟動說明
  → 「這是校園服務機器人系統，結合 AI 視覺辨識、自動派遣、
       廣播通知三個核心功能」
  → 展示瀏覽器開啟 http://localhost:3000

02:00  Gemini Vision 辨識（生活頁）
  → 切換到「生活」tab
  → 點攝影機按鈕
  → 對著人或走廊 → 展示辨識結果
  → 「AI 辨識到人群聚集，信心度 87%」
  → 點「立即廣播疏導」→ 廣播送出

05:00  廣播系統展示
  → 選「A棟 + B棟」
  → 點「緊急廣播」（第一次）
  → 「系統要求再次確認，防止誤觸」
  → 點第二次 → 送出成功 toast

07:00  教學輔助展示
  → 切換到「教學」tab
  → 開啟攝影機 → 辨識學生
  → 點「AI 場域點名」→ 2.5 秒完成

09:00  硬體控制展示（若有 Arduino）
  → 展示配送頁，選目標教室
  → 機器人前進
  → 「到達後自動停止，送出確認」

10:00  Q&A
```

### 無 Arduino 的 Demo 說詞

> 「目前展示純 AI 軟體功能，硬體在另一台機器上。系統架構設計為軟硬體分離，Bridge Server 負責橋接，前端完全不受影響——你可以看到 AI 辨識、廣播、鐘聲時間表全部正常運作。」

---

## 6. 硬體指令對照表

| 情境 | Serial 指令 | 觸發方式 |
|---|---|---|
| 前進 | `FORWARD` | 遙控面板 ↑ |
| 後退 | `BACKWARD` | 遙控面板 ↓ |
| 左轉 | `LEFT` | 遙控面板 ← |
| 右轉 | `RIGHT` | 遙控面板 → |
| 停止 | `STOP` | 遙控面板鬆手 / 緊急停止 |
| 啟動滾筒 | `SWEEP_START` | 遙控面板掃地按鈕 |
| 停止滾筒 | `SWEEP_STOP` | 掃地按鈕關閉 / 緊急停止 |
| 滾筒反向 | `SWEEP_REVERSE` | 遙控面板反向按鈕 |
| 緊急廣播 | `BROADCAST_EMERGENCY` | 生活頁廣播確認 |
| 場域派遣 | `PATROL` / `CROWD` / ... | 生活頁 AI 辨識 → 點派遣 |
| 心跳保持 | `HEARTBEAT` | 遙控面板開啟時每 5 秒自動 |

---

## 7. 故障排除

### ❌ 前端顯示「AI 服務未連線」

```bash
curl http://localhost:3202/api/ready
# 若 {"ai":false}：
# 1. 確認 .env 有 GEMINI_API_KEY
# 2. 重啟 bridge：Ctrl+C → npm run dev:bridge
```

### ❌ 攝影機開啟後一直轉（開啟攝影機中…）

- **iOS Safari：** 先給瀏覽器相機權限（設定 → Safari → 攝影機）
- **Chrome：** 網址列有鎖頭圖示 → 允許相機
- 系統現在會顯示具體錯誤訊息（不再卡在「開啟中」）

### ❌ Gemini 一直顯示「本地分析」不用 Gemini

- 確認 Bridge 是否正常：`curl http://localhost:3202/api/ready` → `"ai":true`
- Gemini 每次請求需要 3–8 秒（timeout 已改為 8 秒）
- 前端右上角若顯示「proxy offline」代表 Bridge 連不上

### ❌ Arduino 插上但還是「未連線」

```bash
# 查看 bridge console 輸出
# 應該要看到：[bridge] connected to /dev/cu.usbmodemXXXX
# 若一直 "reconnect in 8000ms"：
ls /dev/cu.usb*        # 確認裝置存在
# 若有多個裝置：重插 USB，讓 bridge 自動偵測
```

### ❌ 跨裝置連不上

- 確認兩台裝置在**同一個 WiFi**
- 筆電防火牆可能擋住：macOS → 系統設定 → 防火牆 → 暫時關閉
- 確認用 `Network:` 那行的 IP，不是 `localhost`

### ❌ npm run dev 報 port 3000 in use

```bash
# Bridge 會自動用 3001，前端 console 顯示新網址
# 或強制釋放：
lsof -ti:3000 | xargs kill -9
```

---

## 8. 技術驗證結果

以下為 2026-05-10 升級後的驗證結果：

### npm run check 結果

```
✅ appState.test.ts     — PASS
✅ localAi.test.ts      — PASS（全功能測試通過）
✅ localVision.test.ts  — PASS（500 輪像素驗證通過）
✅ tsc --noEmit         — 零 TypeScript 錯誤
✅ vite build           — ✓ built in 4.55s
```

### 關鍵 Bug 修復驗證

```bash
# 確認無 hardcoded localhost（跨裝置連不上的根源）
grep -rn "localhost:3202" src/   # → 零結果 ✅

# 確認無 AbortSignal.timeout（Safari 崩潰的根源）
grep -rn "AbortSignal.timeout" src/   # → 零結果 ✅

# 確認 LifeView 無 auto-dispatch（機器人自己亂跑的根源）
grep -n "auto.*dispatch\|自動.*sendHardware" src/views/LifeView.tsx  # → 零結果 ✅

# LifeView 行數（拆成 5 個 Card 元件後）
wc -l src/views/LifeView.tsx   # → 292 行（原 1051 行）✅
```

### 新架構驗證

| 元件 | 狀態 |
|---|---|
| `src/hooks/useCamera.ts` | ✅ iOS fallback + cleanup guards |
| `src/hooks/useGeminiVision.ts` | ✅ loop-based，全域 6s rate limiter |
| `src/components/life/BellScheduleCard.tsx` | ✅ |
| `src/components/life/EnvMonitorCard.tsx` | ✅ |
| `src/components/life/ScanMapCard.tsx` | ✅ |
| `src/components/life/BroadcastCard.tsx` | ✅ timer refs，cleanup 清除 |
| `src/components/life/VisionCameraCard.tsx` | ✅ 僅 user-triggered dispatch |

---

## 附錄：Bridge API 端點

```
GET  /api/ready          → {"ok":true,"arduino":bool,"ai":bool}
GET  /api/logs           → 最近操作紀錄
POST /api/robot/command  → {"command":"FORWARD"} → 送 Arduino
POST /api/robot/task     → {"taskType":"...","destination":"..."} 
GET  /api/ev3/status     → EV3 連線狀態
POST /api/ev3/command    → EV3 指令
GET  /api/spike/status   → SPIKE Prime 連線狀態
POST /api/spike/command  → SPIKE Prime 指令
WS   ws://localhost:3202 → 即時推送 arduino_status / command_ack
```
