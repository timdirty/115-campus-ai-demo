# LEGO EV3 Integration Plan

本 workspace 的 EV3 路線是：三隊 App 各自獨立展示，但共用 App 1 的本機 bridge 作為硬體 gateway。EV3 與 Arduino UNO R4 都是選配硬體層；沒有接硬體時，三隊 App 仍要能完整展示、留下任務紀錄與說明備援狀態。

## Architecture

```text
App 1 / App 2 / App 3
  -> http://localhost:3200/api/robot/command
  -> App 1 Node bridge
  -> Arduino Serial for normal commands
  -> EV3 WebSocket for EV3_* commands
  -> EV3 brick running ev3/ev3_server.py
```

三隊作品資訊與 EV3 指令規格集中在：

```text
scripts/app-catalog.mjs
```

每一隊都有 `ev3.role` 與 `ev3.commands`。新增 EV3 動作時，先改 catalog，再確認 App 1 bridge command catalog 與 `ev3/ev3_server.py` 都支援。

## Team Roles

| Team | App | EV3 role | Required EV3 commands |
| --- | --- | --- | --- |
| 國小隊伍 1 | App 1：AI 自動板擦機器人 | 白板筆臂 / 板擦路徑展示 | `EV3_STATUS`, `EV3_CALIBRATE`, `EV3_PEN_DOWN`, `EV3_PEN_UP`, `EV3_DRAW_LINE`, `EV3_HOME`, `EV3_STOP` |
| 國小隊伍 2 | App 2：校園服務機器人 | 配送旗標 / 服務機器人手臂展示 | `EV3_STATUS`, `EV3_ARM_EXTEND`, `EV3_ARM_RETRACT`, `EV3_SAFE_POSE`, `EV3_STOP` |
| 國中隊伍 | App 3：AI 校園心靈守護者 | 關懷提醒 / 實體提示動作展示 | `EV3_STATUS`, `EV3_ARM_EXTEND`, `EV3_SAFE_POSE`, `EV3_CANCEL`, `EV3_STOP` |

## Daily Use

1. EV3 開機，確認已使用 ev3dev microSD。
2. USB 接 Mac，EV3 使用 USB tethering。
3. 第一次或重新刷卡後執行：

```zsh
bash scripts/ev3-setup.sh
```

4. 日常診斷：

```zsh
bash scripts/ev3-diagnose.sh
```

5. 啟動三隊開發：

```zsh
npm run dev
```

固定服務：

```text
App 1 bridge: http://localhost:3200
EV3 server:   ws://192.168.0.1:8765 or ws://ev3dev.local:8765
```

## Multi-EV3 / Custom Host

預設會依序嘗試：

```text
EV3_HOSTS
EV3_HOST
ws://192.168.0.1:8765
ws://ev3dev.local:8765
```

單台自訂：

```zsh
EV3_HOST=ws://192.168.0.1:8765 npm run dev
```

多台候選清單：

```zsh
EV3_HOSTS=ws://192.168.0.1:8765,ws://192.168.0.2:8765 npm run dev
```

目前 bridge 會連到第一台可用 EV3。未來如果三隊同時各有一台 EV3，需要把 `server/ev3Manager.ts` 從單一 WebSocket 升級為 `Map<teamId, WebSocket>`，並讓 `/api/robot/command` 接收 `targetTeam` 或 `targetEv3`。

## Verification

EV3 catalog 檢查：

```zsh
npm run check:ev3
```

完整比賽驗收：

```zsh
node scripts/competition-readiness-check.mjs
```

驗收會確認：

- `scripts/app-catalog.mjs` 內三隊 EV3 指令都有定義。
- App 1 bridge `server/defaults.ts` 有列出這些 `EV3_*` 指令。
- EV3 brick server `ev3/ev3_server.py` 的 `dispatch()` 有處理這些指令。
- 每一隊至少包含 `EV3_STOP`，避免未來忘記安全停止路徑。

## Command Rules

- 一般 Arduino 指令維持原有名稱，例如 `DELIVERY_START`、`ALERT_SIGNAL`。
- EV3 指令一律使用 `EV3_` prefix，例如 `EV3_ARM_EXTEND`。
- `STOP` 仍是安全總停，App 1 bridge 會同時送 Arduino `STOP` 與 EV3 `EV3_STOP`。
- 若只想控制 EV3，使用 `EV3_STOP`、`EV3_SAFE_POSE`、`EV3_CANCEL` 等明確 EV3 指令。
- 新增 EV3 動作時，先把低階動作加到 `ev3/ev3_server.py`，再加到 App 1 `server/defaults.ts`，最後加到 `scripts/app-catalog.mjs` 的隊伍清單。

## Hardware Fallback

沒有 EV3 時：

- App 操作流程不能中斷。
- `/api/robot/command` 會回傳 EV3 未連線。
- 任務 log 仍會保留，學生可以說明「目前是無硬體展示模式，接上 EV3 後同一個指令會變成實體動作」。

這點和 Arduino fallback 一樣，是比賽現場穩定展示的核心要求。
