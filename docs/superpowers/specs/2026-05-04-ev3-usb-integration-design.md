# EV3 USB 有線整合設計（v2 — Codex review 整合版）

**日期**：2026-05-04  
**專案**：115資通訊 — App 1（AI 自動板擦機器人）  
**目標**：讓 LEGO EV3（上層握筆 + Arduino 底盤移動）透過 USB 有線連接，插上即用，零設定給學生與比賽現場使用。

---

## 1. 硬體配置

| 裝置 | 角色 | 連接方式 |
|---|---|---|
| Arduino UNO R4 WiFi | 底盤移動（輪子）+ 板擦 servo + LED matrix + 感測器 | USB Serial（現有，不動） |
| LEGO EV3（ev3dev） | 上層握筆機構：中型馬達 C 控制筆上下，大馬達 A+B 控制筆臂水平延伸/收回 | USB → USB Tethering 網路 |

> **重要**：地面移動由 Arduino 負責（現有 `FORWARD` / `BACKWARD` / `LEFT` / `RIGHT`）。EV3 的馬達只控制筆臂機構，不控制移動。

### USB 連線模式：Tethering（非 Internet Sharing）

ev3dev 必須使用 **USB Tethering 模式**，不是 macOS Internet Sharing。  
Tethering 模式下 EV3 直接取得固定 IP，不需要網際網路，不需要 macOS 共享設定。

---

## 2. 系統架構

```
React Frontend (App 1, port 3000)
        ↓ HTTP REST API
Node.js Bridge (port 3200) — server/serialBridge.ts
        ├── robotService.ts ── SerialPort ──► Arduino UNO R4 WiFi（不動）
        └── ev3Manager.ts  ── WebSocket ──► EV3（自動探測 IP）
                                                  ↓ USB Tethering 網路
                                           ev3_server.py（systemd 管理，開機自動跑）
                                           - MediumMotor OUTPUT_C（筆上下）
                                           - LargeMotor OUTPUT_A（筆臂延伸/收回）
                                           - LargeMotor OUTPUT_B（筆臂延伸/收回）
```

### 指令路由規則

- 指令前綴 `EV3_` → `ev3Manager.sendEV3Command()`
- 其他所有指令 → 現有 `robotService.sendSerialCommand()`（完全不動）
- `STOP` 同時送往 Arduino **和** EV3（安全規則）

---

## 3. EV3 指令集

新增至 `server/defaults.ts` 的 `commandCatalog`，group: `'ev3'`：

### 核心控制

| 指令 | 動作 | 馬達 |
|---|---|---|
| `EV3_PEN_DOWN` | 壓筆到板面（絕對位置，非相對） | 中型馬達 C |
| `EV3_PEN_UP` | 抬筆離開板面（絕對位置） | 中型馬達 C |
| `EV3_ARM_EXTEND` | 筆臂向外延伸（500ms） | 大馬達 A+B |
| `EV3_ARM_RETRACT` | 筆臂向內收回（500ms） | 大馬達 A+B |
| `EV3_STOP` | 全部馬達立即停止 | A+B+C |

### 安全與校準

| 指令 | 動作 |
|---|---|
| `EV3_HOME` | 移到 home 位置（筆抬起 + 臂收回） |
| `EV3_CALIBRATE` | 重置 encoder，建立已知零點 |
| `EV3_SAFE_POSE` | 安全姿態：PEN_UP + ARM_RETRACT（比賽開始/結束時用） |
| `EV3_CANCEL` | 取消當前執行中的序列，回到安全姿態（不是緊急停止） |

### 序列動作

| 指令 | 動作 |
|---|---|
| `EV3_DRAW_LINE` | 自動序列：PEN_DOWN → ARM_EXTEND → PEN_UP，執行中拒絕其他指令 |

### 診斷

| 指令 | 動作 |
|---|---|
| `EV3_STATUS` | 回傳 JSON：connected, busy, currentCmd, motorPositions, batteryVoltage, uptime |
| `EV3_TEST` | 小自我測試：PEN_UP/DOWN 各一次，回報結果（老師 setup 驗證用） |

> 地面移動請繼續使用現有 Arduino 指令：`FORWARD` / `BACKWARD` / `LEFT` / `RIGHT`

---

## 4. 新增檔案清單

### Bridge 端（TypeScript）

| 檔案 | 說明 |
|---|---|
| `server/ev3Manager.ts` | WebSocket client，自動探測 IP，request-id 關聯，指令序列化，失連安全 |

### 修改現有檔案（最小改動）

| 檔案 | 改動 |
|---|---|
| `server/serialBridge.ts` | 啟動時呼叫 `startEV3Manager()`（1 行） |
| `server/routes.ts` | EV3 指令分流（含 `STOP` 雙送）約 15 行 |
| `server/defaults.ts` | 追加 11 個 EV3 指令到 `commandCatalog` |

### EV3 磚頭端（Python，一次部署）

| 檔案 | 說明 |
|---|---|
| `ev3/ev3_server.py` | asyncio WebSocket server（port 8765），request-id 回傳，指令序列化，斷線自動停馬達 |
| `ev3/ev3-bridge.service` | systemd unit，Restart=always，RestartSec=2，以 robot 身份執行 |
| `ev3/vendor/` | 離線 Python wheel：`websockets`（避免在沒有網路的 EV3 上 pip install 失敗） |
| `ev3/README.md` | 老師部署說明 |

### 自動化 setup（老師一次性）

| 檔案 | 說明 |
|---|---|
| `scripts/ev3-setup.sh` | 偵測 EV3 → SSH → 部署檔案 → 安裝離線 wheel → 啟用 systemd service → 健康檢查 |
| `scripts/ev3-diagnose.sh` | 診斷：USB 介面 / ping / SSH / service 狀態 / Python import / WebSocket 連線 |

### Frontend（App 1）

| 檔案 | 說明 |
|---|---|
| `src/components/EV3ControlPanel.tsx` | 連線狀態 + 11 個控制按鈕 + busy 鎖定，呼叫現有 `/api/robot/command` endpoint |

---

## 5. ev3Manager.ts 核心行為規格

### 連線探測順序

```
1. process.env.EV3_HOST（若設了 env）
2. ws://192.168.0.1:8765
3. ws://ev3dev.local:8765
→ 第一個成功的保存，後續重連用同一個
```

### 重連邏輯

```typescript
// 單一 reconnect timer（防止多個 timer 堆疊）
// backoff: 立即 → 1s → 3s → 5s（維持 5s）
// close / error 事件都進同一個 reconnect 路徑
```

### 指令傳送

```typescript
// 每個指令附帶 id（UUID）
sendEV3Command(command: string): Promise<{ok: boolean; response?: string}>
  → ws.send(JSON.stringify({id: uuid(), type: command}))
  → await matching response {id, ok, response} with 3000ms timeout
  → on timeout: resolve {ok: false, response: 'timeout'}

// 序列指令（DRAW_LINE 等）執行時設 busy=true，拒絕新指令
// 斷線時清除所有 pending promises（以 timeout message 結束）
```

### EV3 狀態 API

新增 `GET /api/ev3/status`，回傳：  
`{connected, busy, lastCommand, lastResponse, batteryVoltage, uptime}`  
前端每 2s polling，顯示即時狀態。

---

## 6. ev3_server.py 核心行為規格

```python
# 啟動：監聽所有 IP，port 8765
asyncio.run(websockets.serve(handle, "0.0.0.0", 8765))

# 指令 dispatch（附 request-id 回傳）
async def handle(ws):
    async for msg in ws:
        req = json.loads(msg)
        result = await dispatch(req["type"])
        await ws.send(json.dumps({"id": req["id"], "ok": result.ok, "response": result.msg}))

# Pen 使用絕對 encoder 位置，不用相對旋轉（防止累積漂移）
EV3_PEN_DOWN    → medium_motor.run_to_abs_pos(position_sp=PEN_DOWN_POS)
EV3_PEN_UP      → medium_motor.run_to_abs_pos(position_sp=PEN_UP_POS)
EV3_ARM_EXTEND  → large_a.on_for_seconds(50, 0.5); large_b.on_for_seconds(50, 0.5)
EV3_ARM_RETRACT → large_a.on_for_seconds(-50, 0.5); large_b.on_for_seconds(-50, 0.5)
EV3_DRAW_LINE   → busy=True → PEN_DOWN → ARM_EXTEND → PEN_UP → busy=False
EV3_CALIBRATE   → reset_all_encoders(); PEN_UP_POS = current_pos
EV3_HOME        → EV3_PEN_UP + EV3_ARM_RETRACT
EV3_SAFE_POSE   → EV3_HOME（別名）
EV3_STATUS      → return JSON with connected/busy/positions/battery/uptime

# 斷線安全：client 斷線時立即停所有馬達
async def on_disconnect():
    stop_all_motors()
```

---

## 7. 零設定啟動流程

### 老師設定（只做一次）

1. 下載 ev3dev microSD image → 燒錄 → 插入 EV3
2. EV3 開機 → USB 接電腦（Tethering 模式，自動 IP）
3. 執行 `bash scripts/ev3-setup.sh`：
   - 自動偵測 EV3（`192.168.0.1` 或 `ev3dev.local`）
   - SSH 進磚頭，部署檔案 + 離線安裝 wheel
   - 啟用 systemd service（`ev3-bridge.service`，Restart=always）
   - 執行 `EV3_TEST` 健康檢查確認成功
4. 完成，之後無需再操作

若有問題，執行 `bash scripts/ev3-diagnose.sh` 逐步診斷。

### 比賽 / 每次使用

1. EV3 開機（systemd 自動啟動 ev3_server.py）
2. USB 接電腦
3. `npm run dev`
4. App 1 顯示「EV3 已連線 ✓」→ 可用

---

## 8. 錯誤處理與防呆

| 情境 | 處理 |
|---|---|
| EV3 未連線 | bridge 每 1~5s backoff 重連；前端顯示「EV3 尋找中...」 |
| 指令逾時（>3s） | resolve `{ok: false, response: 'timeout'}`，不阻塞其他指令 |
| EV3 斷線 | pending promises 立即以 timeout 結束；EV3 側停所有馬達 |
| DRAW_LINE 執行中 | busy=true，新指令收到 `{ok: false, response: 'busy'}`；前端按鈕鎖定 |
| Arduino 不受影響 | EV3 路徑與 Arduino 路徑完全獨立 |
| STOP 指令 | 同時送 Arduino + EV3，確保兩端都停 |
| 重刷 SD 卡後 known_hosts 衝突 | ev3-setup.sh 自動執行 `ssh-keygen -R ev3dev.local` |

---

## 9. 不在此次 scope 的項目

- EV3 感測器回傳（超音波、顏色感測器）— 留待後續
- encoder-based 精確位置控制（比賽 demo 用時間型即可）
- 多 EV3 同時控制
- EV3 自主序列（無指令自動行動）
- `EV3_DRAW_STROKE lengthMs` 參數化延伸時間

---

## Codex Review 整合摘要

| 問題 | 原始設計 | 修正後 |
|---|---|---|
| USB 連線模式 | 假設固定 192.168.0.1 | Tethering 模式；依序試 `EV3_HOST` → `192.168.0.1` → `ev3dev.local` |
| websockets 安裝 | 依賴 pip install（需網路） | vendor/ 離線 wheel，setup.sh 本地安裝 |
| 重連健壯性 | 固定 3s，無 request-id | backoff 重連 + UUID request-id + pending 清除 |
| 筆位置漂移 | 相對旋轉（累積誤差） | 絕對 encoder 位置（calibrate 後不漂移） |
| Autostart 機制 | rc.local | systemd service（Restart=always，可 status/log） |
| Setup 健壯性 | scp + 手動 | 完整 preflight + health check + ev3-diagnose.sh |
| STOP 安全 | 只送 Arduino | 同時送 Arduino + EV3 |
