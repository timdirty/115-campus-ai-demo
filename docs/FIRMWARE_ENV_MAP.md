# Firmware Environment Map

Use this file when you need to open, maintain, build, or upload the correct Arduino firmware for each competition project.

## Quick Map

| Project | PlatformIO env | Firmware file | Board | Hardware role |
| --- | --- | --- | --- | --- |
| App 1 白板機器人雙馬達 | `uno_r4_minima_app1_whiteboard_drive` | `src/app1_whiteboard_drive/main.cpp` | UNO R4 Minima | L293D Motor Shield v1, M3/M4 drive base |
| App 2 掃地機器人 (R4 WiFi) | `uno_r4_wifi_app2_sweeper` | `src/app2_sweeper_drive/main.cpp` | UNO R4 WiFi | L293D shield, M1+M2 雙輪驅動，M3+M4 掃地滾筒 |
| App 2 掃地機器人 (R4 Minima) | `uno_r4_minima_app2_sweeper` | `src/app2_sweeper_drive/main.cpp` | UNO R4 Minima | 同上，DFU 上傳 |
| App 3 心靈守護者感測器 | `uno_r4_wifi_sensor` | `src/app3_guardian_sensor/main.cpp` | UNO R4 WiFi | HY-M302 / DHT11 / photoresistor / RGB LED sensor node |
| App 3 心靈守護者四輪底盤 (R4 WiFi) | `uno_r4_wifi_app3_guardian_drive` | `src/app3_guardian_drive/main.cpp` | UNO R4 WiFi | L293D M1+M4 left side, M2+M3 right side |
| App 3 心靈守護者四輪底盤 (R4 Minima) | `uno_r4_minima_app3_guardian_drive` | `src/app3_guardian_drive/main.cpp` | UNO R4 Minima | 同上，改用 DFU 上傳 |
| Shared three-app command demo | `uno_r4_wifi` | `src/main.cpp`, `src/commands.cpp`, `src/matrix_show.cpp` | UNO R4 WiFi | Shared serial command catalog, LED matrix, servo, DHT |

## Upload Commands

```bash
# App 1: 白板機器人 L293D M3/M4 雙馬達
pio run -e uno_r4_minima_app1_whiteboard_drive -t upload

# App 2: 掃地機器人（R4 WiFi）
pio run -e uno_r4_wifi_app2_sweeper -t upload

# App 2: 掃地機器人（R4 Minima，DFU 上傳）
pio run -e uno_r4_minima_app2_sweeper -t upload

# App 3: 心靈守護者 HY-M302 / DHT / 光敏感測器
pio run -e uno_r4_wifi_sensor -t upload

# App 3: 心靈守護者 L293D 四輪底盤（R4 WiFi）
pio run -e uno_r4_wifi_app3_guardian_drive -t upload

# App 3: 心靈守護者 L293D 四輪底盤（R4 Minima，DFU 上傳）
pio run -e uno_r4_minima_app3_guardian_drive -t upload

# Shared: 三組共用序列指令展示 firmware
pio run -e uno_r4_wifi -t upload
```

## 故障排除（三組通用）

每組 firmware 都支援以下診斷指令，遇到「某顆馬達不轉」「車子方向反」時直接用：

```bash
# 透過自家 bridge 送指令（App 1=3201, App 2=3202, App 3=3203）
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"command":"MOTOR_TEST"}' http://localhost:3202/api/robot/command
```

| 指令 | 行為 |
| --- | --- |
| `MOTOR_TEST` | 依序 M1→M4（或 M3→M4 對 App 1）各正轉 700ms，目視判斷哪顆沒反應 |
| `M1_FWD` / `M1_BACK` / `M1_OFF` | 個別馬達直驅（M2/M3/M4 同理；App 1 只有 M3/M4） |
| `READ_SENSORS` | 回 `SENSORS:TEMP:..,HUM:..,LIGHT:..` 或 `SENSORS:NONE` |
| `HEARTBEAT` | App 2/3 drive 專用：重設看門狗計時器，回 `HEARTBEAT:OK` |

### Watchdog（App 2 / App 3 drive firmware）

App 2 和 App 3 的 drive firmware 內建 3 秒看門狗：收到任何方向指令後開始計時，3 秒內沒收到下一條動作指令或 `HEARTBEAT` 就自動停車並回 `WATCHDOG:TIMEOUT`。前端 UI 在搖桿移動或 D-pad 按住時每 1 秒送一次 `HEARTBEAT` 維持計時；放開後計時器自然倒數至停車。

方向反了改 firmware 對應 `invertMotorN` 旗標（App 2/3）或 `invertM3 / invertM4`（App 1），重燒即可，不用拆排線。

App 2 sweeper 因為兩顆滾筒預設「反向相對」轉，掃地方向相反就送 `SWEEP_REVERSE` 切換、或永久改 invertMotor3/4。

App 2 sweeper 還支援 kick-start（靜止 → 移動瞬間用高 PWM 突破靜摩擦力），所以速度可拉到 60-90 也能起步。

## Maintenance Rules

- Do not put App 1 motor code in `src/app3_guardian_sensor/main.cpp`; that file is now the App 3 sensor node.
- Do not put App 3 drive code in `src/commands.cpp`; keep it in `src/app3_guardian_drive/main.cpp`.
- Keep standalone firmware folders excluded from `uno_r4_wifi` in `platformio.ini`, or the shared build will compile multiple `setup()` / `loop()` functions.
- If you add another physical robot firmware, create a new folder under `src/` and a new PlatformIO env instead of reusing an existing app env.

## Current Verification

These environments compiled successfully after the split:

```bash
pio run -e uno_r4_minima_app1_whiteboard_drive
pio run -e uno_r4_wifi_app2_sweeper
pio run -e uno_r4_minima_app2_sweeper
pio run -e uno_r4_wifi_sensor
pio run -e uno_r4_wifi_app3_guardian_drive
pio run -e uno_r4_minima_app3_guardian_drive
pio run -e uno_r4_wifi
```
