# EV3 USB 有線整合設計

**日期**：2026-05-04  
**專案**：115資通訊 — App 1（AI 自動板擦機器人）  
**目標**：讓 LEGO EV3（上層握筆 + Arduino 底盤移動）透過 USB 有線連接，插上即用，零設定給學生與比賽現場使用。

---

## 1. 硬體配置

| 裝置 | 角色 | 連接方式 |
|---|---|---|
| Arduino UNO R4 WiFi | 底盤移動（輪子）+ 板擦 servo + LED matrix + 感測器 | USB Serial（現有） |
| LEGO EV3（ev3dev） | 上層握筆機構：中型馬達 C 控制筆上下，大馬達 A+B 控制筆臂水平延伸/收回 | USB → USB 網路（192.168.0.1） |

> **注意**：地面移動（前後左右）由 Arduino 負責，使用現有的 `FORWARD` / `BACKWARD` / `LEFT` / `RIGHT` 指令。EV3 的大馬達 A+B 控制的是筆臂本身的機械動作，不是輪子。

EV3 插 USB 後，作業系統自動建立 USB 網路介面，EV3 固定 IP `192.168.0.1`。

---

## 2. 系統架構

```
React Frontend (App 1, port 3000)
        ↓ HTTP REST API
Node.js Bridge (port 3200) — server/serialBridge.ts
        ├── robotService.ts  ── SerialPort ──► Arduino UNO R4 WiFi（不動）
        └── ev3Manager.ts   ── WebSocket ──► EV3 192.168.0.1:8765
                                                   ↓ USB 網路
                                            ev3_server.py（ev3dev，開機自動跑）
                                            - MediumMotor OUTPUT_C（筆上下）
                                            - LargeMotor OUTPUT_A（筆臂延伸/收回）
                                            - LargeMotor OUTPUT_B（筆臂延伸/收回）
```

### 指令路由規則

- 指令前綴 `EV3_` → `ev3Manager.sendEV3Command()`
- 其他所有指令 → 現有 `robotService.sendSerialCommand()`（完全不動）

---

## 3. EV3 指令集

新增至 `server/defaults.ts` 的 `commandCatalog`，group: `'ev3'`：

| 指令 | 動作 | 馬達 |
|---|---|---|
| `EV3_PEN_DOWN` | 壓筆到板面 | 中型馬達 C，旋轉 +90° |
| `EV3_PEN_UP` | 抬筆離開板面 | 中型馬達 C，旋轉 −90° |
| `EV3_ARM_EXTEND` | 筆臂向外延伸（500ms） | 大馬達 A+B，speed 50 |
| `EV3_ARM_RETRACT` | 筆臂向內收回（500ms） | 大馬達 A+B，speed −50 |
| `EV3_STOP` | 全部馬達立即停止 | A+B+C |
| `EV3_DRAW_LINE` | 自動序列：壓筆→延伸→抬筆 | C then A+B then C |

> 地面移動請繼續使用現有 Arduino 指令：`FORWARD` / `BACKWARD` / `LEFT` / `RIGHT`
| `EV3_STATUS` | 回傳連線與馬達狀態 JSON | — |

---

## 4. 新增檔案清單

### Bridge 端（TypeScript）

| 檔案 | 內容 |
|---|---|
| `server/ev3Manager.ts` | WebSocket client、自動重連（3s 間隔）、`startEV3Manager()` / `sendEV3Command()` / `getEV3Status()` |

### 修改現有檔案（最小改動）

| 檔案 | 改動 |
|---|---|
| `server/serialBridge.ts` | 啟動時呼叫 `startEV3Manager()`（1 行） |
| `server/routes.ts` | EV3 指令 if-else 分流到 ev3Manager（約 10 行） |
| `server/defaults.ts` | 追加 9 個 EV3 指令到 `commandCatalog` |

### EV3 磚頭端（Python，一次部署）

| 檔案 | 內容 |
|---|---|
| `ev3/ev3_server.py` | asyncio WebSocket server（port 8765），解析 JSON 指令，驅動 ev3dev2 |
| `ev3/boot.sh` | 開機自動執行 ev3_server.py 的 shell script |
| `ev3/README.md` | 老師部署說明（刷 ev3dev + 執行 setup script） |

### 自動化 setup（老師一次性）

| 檔案 | 內容 |
|---|---|
| `scripts/ev3-setup.sh` | SSH 進磚頭、scp 部署 ev3_server.py + boot.sh、設定 rc.local autostart |

### Frontend（App 1）

| 檔案 | 內容 |
|---|---|
| `src/components/EV3ControlPanel.tsx` | 連線狀態指示器 + 9 個控制按鈕，走現有 `/api/robot/command` endpoint |

---

## 5. ev3Manager.ts 核心行為

```typescript
// 啟動：自動連線，背景重連
startEV3Manager()
  → connect to ws://192.168.0.1:8765
  → on close: retry after 3000ms
  → on open: log "[ev3] connected"

// 發送指令
sendEV3Command(command: string): Promise<{ok: boolean; response?: string}>
  → if not connected: return {ok: false, response: 'EV3 not connected'}
  → ws.send(JSON.stringify({type: command}))
  → await response with 2000ms timeout

// 狀態查詢
getEV3Status(): {connected: boolean; lastCommand: string; lastResponse: string}
```

---

## 6. ev3_server.py 核心行為

```python
# 開機自動啟動，監聽所有 IP
asyncio.run(websockets.serve(handle, "0.0.0.0", 8765))

# 指令 dispatch
EV3_PEN_DOWN    → medium_motor.run_to_rel_pos(position_sp=90,  speed_sp=300)
EV3_PEN_UP      → medium_motor.run_to_rel_pos(position_sp=-90, speed_sp=300)
EV3_ARM_EXTEND  → large_a.on(50); large_b.on(50); sleep(0.5); stop()
EV3_ARM_RETRACT → large_a.on(-50); large_b.on(-50); sleep(0.5); stop()
EV3_DRAW_LINE   → PEN_DOWN → ARM_EXTEND → PEN_UP（sequential）
EV3_STATUS     → return JSON motor states + server uptime
```

---

## 7. 零設定啟動流程

### 老師設定（只做一次）

1. 下載 ev3dev microSD image，燒錄，插入 EV3
2. EV3 開機，接 USB 到電腦
3. 執行 `bash scripts/ev3-setup.sh`
4. 完成，之後無需再操作

### 比賽 / 每次使用

1. EV3 開機（Python server 自動啟動）
2. USB 接電腦
3. `npm run dev`
4. App 1 顯示「EV3 已連線 ✓」→ 即可控制

---

## 8. 錯誤處理與防呆

| 情境 | 處理 |
|---|---|
| EV3 未連線 | API 回 `{ok: false, response: 'EV3 not connected'}`，前端顯示「EV3 尋找中...」 |
| EV3 指令逾時（>2s） | resolve with timeout message，不阻塞其他指令 |
| EV3 斷線 | ev3Manager 每 3s 自動重連，前端狀態即時更新 |
| Arduino 不受影響 | EV3 路徑與 Arduino 路徑完全獨立，一邊壞不影響另一邊 |

---

## 9. 不在此次 scope 的項目

- EV3 感測器回傳（超音波、顏色感測器）— 留待後續
- 多 EV3 同時控制
- EV3 自主巡邏模式（無指令自動行動）
- 精確位置控制（encoder-based）
