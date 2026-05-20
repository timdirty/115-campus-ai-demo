# 115 資通訊比賽作品工作區

這個工作區整理三個隊伍的獨立作品：兩隊國小組、一隊國中組，以及同一套 Arduino UNO R4 WiFi firmware。三個 App 是三件分開評分、分開展示、分開維護的作品；放在同一個 workspace 是為了共用開發工具、比賽驗收、GitHub Pages 發布與硬體展示路徑。

目標是比賽現場可穩定展示的本機完整 Demo：每隊功能要能自己跑、資料要能自己重置、學生講稿要能自己打開；沒有真硬體、真雲端或 Gemini key 時也要能順順講完。插上 UNO R4 並上傳韌體後，三個 App 才共用同一個本機 bridge 送 Serial 指令；接上 LEGO EV3 後，三隊也會透過同一個 bridge 送 `EV3_*` WebSocket 指令。

## 三隊作品

- `google ai studio/app_1（國小）/AI自動板擦機器人`：白板拍照、語音逐字稿、AI 摘要、教師決策、筆記複習與 UNO R4 Serial 控制。
- `google ai studio/app_2（國小）/校園服務機器人 app`：福利社配送、清潔排程、教學輔助、放學引導、鐘聲廣播與校園中控台。
- `google ai studio/app_3（國中）/AI校園心靈守護者`：校園情緒關懷、預警處理、自我照護、匿名心情牆與節點監控。

每隊 app 根目錄都有自己的 `README.md`、`PLAN_TODO.md`、`STUDENT_DEMO_GUIDE.md`、`package.json`、`package-lock.json` 與 `localStorage`/資料命名空間。除共用 Arduino bridge 之外，不把三隊的 UI、狀態、測試或展示資料混在一起。

Workspace 層共用的三隊 catalog 在：

```text
scripts/app-catalog.mjs
```

新增隊伍資訊、改公開路徑、改手機檢查路由或 Pages 入口卡片時，優先改這份 catalog，再跑完整驗收。

## Demo Readiness

比賽前最推薦只跑一個指令：

```zsh
npm run demo:ready
```

它會自動產生現場文件、跑 500-round polish、檢查三個 app、EV3 catalog、UNO R4 firmware、GitHub Pages artifact，以及 phone/tablet/desktop 三種版面。完成後會產生 `demo-ready-report.json`；這是本機驗收報告，會隨每次執行更新，不需要提交。

沒有接 Arduino 或 LEGO EV3 時，可以用硬體模擬模式保住完整展示流程：

```zsh
DEMO_SIMULATE_HARDWARE=1 npm run dev
```

模擬模式會讓 Arduino 與 EV3 指令回傳可展示的成功結果；接真機時拿掉這個環境變數即可。

## Student URLs

學生操作入口會由 GitHub Pages 自動部署：

```text
https://timdirty.github.io/115-campus-ai-demo/
```

三個 App 會分別出現在：

```text
https://timdirty.github.io/115-campus-ai-demo/app1/
https://timdirty.github.io/115-campus-ai-demo/app2/
https://timdirty.github.io/115-campus-ai-demo/app3/
```

學生講稿與操作卡也會一起部署：

```text
https://timdirty.github.io/115-campus-ai-demo/all-guides.html
https://timdirty.github.io/115-campus-ai-demo/app1-guide.html
https://timdirty.github.io/115-campus-ai-demo/app2-guide.html
https://timdirty.github.io/115-campus-ai-demo/app3-guide.html
```

App 2、App 3 是完整 local-first 前端。App 1 在 GitHub Pages 會使用瀏覽器展示模式，仍可操作白板分析、課堂紀錄、教師決策、匯出與模擬機器人指令；需要真 Arduino Serial 時再啟動本機 App 1 bridge。

比賽前在根目錄執行：

```zsh
npm run demo:ready
```

需要拆開檢查時，也可以分別執行：

```zsh
npm run check:polish
npm run check:app1
npm run check:app2
npm run check:app3
npm run check:ev3
npm run check:hardware
npm run check:visual
zsh scripts/demo-check.sh
node scripts/build-github-pages.mjs
node scripts/pages-artifact-check.mjs
```

GitHub Pages 部署完成後，再跑公開網址驗收：

```zsh
CHECK_PUBLIC_URLS=1 node scripts/competition-readiness-check.mjs
```

這會一次跑完：

- App 1 `npm run check`
- App 2 `npm run check`
- App 3 `npm run check`
- bridge/firmware 指令表一致性檢查
- 三隊 LEGO EV3 指令規格與 EV3 bridge server 檢查
- Arduino UNO R4 `pio run`

完整展示流程請看：

```text
docs/DEMO_READY.md
docs/FIELD_CHECKLIST.md
docs/STUDENT_PITCHES.md
docs/JUDGE_QA.md
docs/DEMO_EVIDENCE.md
docs/DEMO_SCORECARD.md
docs/REHEARSAL_RUNBOOK.md
docs/EV3_FIELD_TEST_REPORT.md
docs/HARDWARE_WIRING_MAP.md
docs/JUDGE_ONE_PAGER.md
docs/EV3_CALIBRATION_TABLE.md
docs/DEMO_RUNBOOK.md
docs/STUDENT_PRESENTATION_PACK.md
docs/HUNDRED_ROUND_READINESS.md
docs/ARDUINO_CONNECTION_READY.md
docs/GITHUB_STUDENT_PUBLISH.md
docs/EV3_INTEGRATION.md
```

推上 GitHub 或交給學生操作前，先執行安全預檢：

```zsh
node scripts/github-prepublish-check.mjs
```

這會確認 lockfile、公開 placeholder 設定、敏感檔案與 API key 風險。真實 `.env`、Firebase 設定、Arduino secret 與 App 1 現場資料不要提交。repo 也已加入 `.github/workflows/demo-check.yml`，推上 GitHub 後會自動跑三個 App 檢查、bridge/firmware 指令表一致性與 UNO R4 firmware 編譯。

## Arduino UNO R4 WiFi

Firmware 已依作品分開放，先看 `docs/FIRMWARE_ENV_MAP.md`。人眼找檔案時，直接看 `src/` 底下這三個清楚命名的資料夾：

```text
src/app1_whiteboard_drive/       App 1 白板機器人雙馬達 M3/M4
src/app3_guardian_sensor/        App 3 心靈守護者感測器
src/app3_guardian_drive/         App 3 心靈守護者四輪底盤
```

共用展示 firmware 留在：

```text
src/main.cpp
src/commands.cpp
src/matrix_show.cpp
```

常用燒錄指令：

```zsh
# App 1 白板機器人雙馬達
pio run -e uno_r4_minima_app1_whiteboard_drive -t upload

# App 3 心靈守護者感測器
pio run -e uno_r4_wifi_sensor -t upload

# App 2 掃地機器人底盤
pio run -e uno_r4_wifi_app2_sweeper -t upload

# App 3 心靈守護者四輪底盤
pio run -e uno_r4_wifi_app3_guardian_drive -t upload

# 三隊共用展示 firmware
pio run -e uno_r4_wifi -t upload
```

常用指令：

```zsh
pio run
pio run -t upload
pio device monitor -b 115200
zsh scripts/doctor.sh
```

目前 firmware 保留本機 Serial 指令，App 1 的 Node bridge 是三隊共用的硬體 gateway。後續接 Arduino Cloud 時仍要共用 `handleCommand()`，不要破壞現場 USB 測試路徑。

## LEGO EV3

三隊未來都會接 LEGO EV3。EV3 使用 ev3dev 跑 `ev3/ev3_server.py`，App 1 bridge 會連到 `ws://192.168.0.1:8765` 或 `ws://ev3dev.local:8765`，三隊 App 透過 `/api/robot/command` 送 `EV3_*` 指令。

常用指令：

```zsh
bash scripts/ev3-setup.sh
bash scripts/ev3-diagnose.sh
npm run check:ev3
```

完整規劃與每隊 EV3 指令清單請看：

```text
docs/EV3_INTEGRATION.md
```

## App Run Commands

三隊同時開發，從根目錄執行：

```zsh
npm run dev
```

固定本機網址（每組都有自己獨立的 bridge，互不依賴）：

```text
App 1 frontend: http://localhost:11501/   App 1 bridge: http://localhost:3201/
App 2 frontend: http://localhost:11502/   App 2 bridge: http://localhost:3202/
App 3 frontend: http://localhost:11503/   App 3 bridge: http://localhost:3203/
```

單一隊伍開發或驗收，從根目錄執行：

```zsh
npm run dev:app1
npm run dev:app2
npm run dev:app3
npm run check:app1
npm run check:app2
npm run check:app3
```

App 1 production bridge：

```zsh
cd "google ai studio/app_1（國小）/AI自動板擦機器人"
npm run build
BRIDGE_PORT=3201 NODE_ENV=production npm run start
```

App 2 local demo：

```zsh
cd "google ai studio/app_2（國小）/校園服務機器人 app"
npm run dev
```

App 3 local demo：

```zsh
cd "google ai studio/app_3（國中）/AI校園心靈守護者"
npm run dev
```

## Project Helpers

- `src/commands.cpp`：UNO R4 WiFi 共用 Serial 指令處理。
- `docs/ARDUINO_CLOUD.md`：未來 Arduino Cloud 對接計畫。
- `docs/ARDUINO_CONNECTION_READY.md`：三隊共用 bridge 與實機驗收步驟。
- `docs/GITHUB_STUDENT_PUBLISH.md`：GitHub 發布、安全預檢與學生操作說明。
- `docs/STUDENT_PRESENTATION_PACK.md`：三隊學生操作網址、分組講稿索引、評審問答與 Arduino 連動說法。
- `docs/DEMO_READY.md`：一鍵 readiness、硬體模擬、公開網址與現場啟動說明。
- `docs/FIELD_CHECKLIST.md`：比賽當天可直接勾選的最後檢查表。
- `docs/STUDENT_PITCHES.md`：三隊 1 分鐘、3 分鐘、5 分鐘講稿。
- `docs/JUDGE_QA.md`：三隊評審問答卡，涵蓋 AI、離線備援、EV3 與硬體故障說法。
- `docs/DEMO_EVIDENCE.md`：最近一次 `demo:ready` 產生的驗收證據摘要，可放入學習歷程或作品說明。
- `docs/DEMO_SCORECARD.md`：三隊 60 秒展示驗收表，逐項確認 AI、影像品質、EV3、備援與評審追問。
- `docs/REHEARSAL_RUNBOOK.md`：三隊輪流練習、重置展示資料、故障備援與評審追問的計時演練表。
- `docs/EV3_FIELD_TEST_REPORT.md`：EV3 host 探測、指令清單與真機測試流程，可在接上 EV3 後重產生作為實測證據。
- `docs/HARDWARE_WIRING_MAP.md`：三隊 app、App 1 bridge、Arduino UNO R4、LEGO EV3、port 與備援模式拓樸圖。
- `docs/JUDGE_ONE_PAGER.md`：給評審/老師快速掌握三隊作品、AI、硬體與驗收證據的一頁總表。
- `docs/EV3_CALIBRATION_TABLE.md`：三隊 EV3 指令、port hint、時間/角度與安全備註。
- `docs/HUNDRED_ROUND_READINESS.md`：百項展示巡檢表，涵蓋自動檢查、三隊操作、手機、講稿與硬體銜接。
- `docs/templates/`：Cloud 模式起始範本。
- `scripts/demo-check.sh`：三個 app 加 firmware 的總驗收。
- `scripts/demo-ready.mjs`：比賽前最高層一鍵驗收，會產生現場文件、跑完整 readiness，並輸出本機 report。
- `scripts/generate-demo-docs.mjs`：依三隊 catalog 產生展示講稿、EV3 校準表、demo runbook 與 field checklist。
- `scripts/generate-demo-evidence.mjs`：在完整 readiness 通過後產生 demo evidence 報告。
- `scripts/generate-demo-scorecard.mjs`：產生三隊 60 秒展示驗收表，讓現場演練可直接勾選。
- `scripts/generate-rehearsal-runbook.mjs`：產生三隊 15 分鐘輪練、重置資料與評審追問流程。
- `scripts/generate-ev3-field-report.mjs`：產生 EV3 host 探測與真機指令測試報告。
- `scripts/generate-hardware-wiring-map.mjs`：產生三隊硬體拓樸、port、啟動與故障備援圖。
- `scripts/generate-judge-one-pager.mjs`：產生評審一頁總表。
- `scripts/hardware-doctor.mjs`：真機現場診斷，檢查 command catalog、PlatformIO、Arduino USB 候選、EV3 WebSocket 與關鍵環境變數。
- `scripts/competition-readiness-check.mjs`：比賽前核心驗收，串起安全掃描、500-round polish、三 App 檢查、Pages build、artifact 檢查與 responsive 檢查。
- `scripts/github-prepublish-check.mjs`：發布前檢查 secret、placeholder 與必要檔案。
- `scripts/pages-artifact-check.mjs`：確認 GitHub Pages bundle 內有三個 App、三個學生講稿頁與入口連結。
- `scripts/public-url-check.mjs`：部署後確認公開總入口、三個 App 與三個學生講稿頁都回傳 200 且含有預期內容。
- `scripts/mobile-layout-check.mjs`：用指定 viewport 檢查 Pages 入口、三個 app 與三個學生講稿頁是否水平爆版、截字或出現過小按鈕。
- `scripts/responsive-layout-check.mjs`：連續跑 phone/tablet/desktop 三種 viewport 的 layout check。
- `scripts/verify-command-catalog.mjs`：確認 App 1 bridge 指令表與 UNO R4 firmware 指令一致。
- `scripts/verify-ev3-catalog.mjs`：確認三隊 EV3 指令規格、App 1 bridge 與 EV3 brick server 一致。
- `.codex/skills/arduino-uno-r4-vibecoding/SKILL.md`：專案本地 AI 協作規範。
