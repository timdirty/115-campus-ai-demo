# 三隊 Arduino 連線就緒說明

目標狀態：三個 App 的非硬體功能都可直接展示；硬體部分已統一接到 App 1 的本機 Node bridge，只差把 UNO R4 WiFi 插上、上傳韌體並校準實體動作。

## 共用架構

```text
App 1 前端/Node bridge  http://localhost:3200
App 2 前端              http://localhost:3201
App 3 前端              http://localhost:3202
Arduino command API     http://localhost:3200/api/robot/command
```

App 2 與 App 3 預設送到 `http://localhost:3200`。如果 bridge 改 port，啟動前端時設定：

```zsh
VITE_ARDUINO_BRIDGE_URL=http://localhost:3200 npm run preview -- --host 0.0.0.0 --port 3201
```

## 上傳與啟動

```zsh
cd "/Volumes/Tim aaddtional/Download/115資通訊/tedt"
pio run -t upload

cd "google ai studio/app_1（國小）/AI自動板擦機器人"
BRIDGE_PORT=3200 NODE_ENV=production npm run start
```

如果系統沒有自動抓到連接埠，可指定：

```zsh
ARDUINO_PORT=/dev/cu.usbmodemXXXX BRIDGE_PORT=3200 NODE_ENV=production npm run start
```

## 三隊代表指令

- App 1：`SHOW_ON`、`ERASE_REGION_A`、`ERASE_ALL`、`PAUSE_TASK`
- App 2：`DELIVERY_START`、`DELIVERY_DONE`、`PATROL_START`、`SAFETY_LOCKDOWN`、`ROBOT_PAUSE`
- App 3：`ALERT_SIGNAL`、`CARE_DEPLOYED`、`NODE_RESTART`

沒有插 Arduino 時，bridge 仍會回傳 fallback JSON，App 不會中斷。插上並上傳韌體後，bridge 會把同一個 command 寫入 Serial，firmware 的 `handleCommand()` 會驅動 LED、LED matrix 或伺服示範動作。

## 驗收

```zsh
npm run check --prefix "google ai studio/app_1（國小）/AI自動板擦機器人"
npm run check --prefix "google ai studio/app_2（國小）/校園服務機器人 app"
npm run check --prefix "google ai studio/app_3（國小）/AI校園心靈守護者"
node scripts/verify-command-catalog.mjs
pio run
node scripts/full-demo-smoke.mjs
```

現場快速驗收：

1. App 1 機器人頁按燈光或展示指令。
2. App 2 配送下單，確認首頁指令 log 顯示已送或未連線。
3. App 3 預警中心按佈署關懷，確認硬體提示 toast 與總覽硬體紀錄。
4. 若有實體板，觀察 UNO R4 的 LED、Matrix 或伺服是否依指令反應。
