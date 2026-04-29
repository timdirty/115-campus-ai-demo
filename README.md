# 115 資通訊比賽作品工作區

這個工作區整理三隊國小組作品與同一套 Arduino UNO R4 WiFi firmware。目標是比賽現場可穩定展示的本機完整 Demo：功能要能點、狀態要能串、資料要能重置，沒有真硬體、真雲端或 Gemini key 時也要能順順講完；插上 UNO R4 並上傳韌體後，三個 App 會共用同一個本機 bridge 送 Serial 指令。

## 三隊作品

- `google ai studio/app_1（國小）/AI自動板擦機器人`：白板拍照、語音逐字稿、AI 摘要、教師決策、筆記複習與 UNO R4 Serial 控制。
- `google ai studio/app_2（國小）/校園服務機器人 app`：福利社配送、清潔排程、教學輔助、放學引導、鐘聲廣播與校園中控台。
- `google ai studio/app_3（國小）/AI校園心靈守護者`：校園情緒關懷、預警處理、自我照護、匿名心情牆與節點監控。

每隊 app 根目錄都有 `PLAN_TODO.md`，記錄作品定位、展示腳本、Arduino R4 WiFi 對接方向與驗收指令。

## Demo Readiness

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

App 2、App 3 是完整 local-first 前端。App 1 在 GitHub Pages 會使用瀏覽器展示模式，仍可操作白板分析、課堂紀錄、教師決策、匯出與模擬機器人指令；需要真 Arduino Serial 時再啟動本機 App 1 bridge。

比賽前在根目錄執行：

```zsh
zsh scripts/demo-check.sh
```

這會一次跑完：

- App 1 `npm run check`
- App 2 `npm run check`
- App 3 `npm run check`
- bridge/firmware 指令表一致性檢查
- Arduino UNO R4 `pio run`

完整展示流程請看：

```text
docs/DEMO_RUNBOOK.md
docs/ARDUINO_CONNECTION_READY.md
docs/GITHUB_STUDENT_PUBLISH.md
```

推上 GitHub 或交給學生操作前，先執行安全預檢：

```zsh
node scripts/github-prepublish-check.mjs
```

這會確認 lockfile、公開 placeholder 設定、敏感檔案與 API key 風險。真實 `.env`、Firebase 設定、Arduino secret 與 App 1 現場資料不要提交。repo 也已加入 `.github/workflows/demo-check.yml`，推上 GitHub 後會自動跑三個 App 檢查、bridge/firmware 指令表一致性與 UNO R4 firmware 編譯。

## Arduino UNO R4 WiFi

- Board: Arduino UNO R4 WiFi
- PlatformIO board id: `uno_r4_wifi`
- Framework: Arduino
- Serial monitor speed: `115200`

常用指令：

```zsh
pio run
pio run -t upload
pio device monitor -b 115200
zsh scripts/doctor.sh
```

目前 firmware 保留本機 Serial 指令，App 1 的 Node bridge 是三隊共用的硬體 gateway。後續接 Arduino Cloud 時仍要共用 `handleCommand()`，不要破壞現場 USB 測試路徑。

## App Run Commands

App 1 production bridge：

```zsh
cd "google ai studio/app_1（國小）/AI自動板擦機器人"
npm run build
BRIDGE_PORT=3200 NODE_ENV=production npm run start
```

App 2 local demo：

```zsh
cd "google ai studio/app_2（國小）/校園服務機器人 app"
npm run dev
```

App 3 local demo：

```zsh
cd "google ai studio/app_3（國小）/AI校園心靈守護者"
npm run dev
```

## Project Helpers

- `src/commands.cpp`：UNO R4 WiFi 共用 Serial 指令處理。
- `docs/ARDUINO_CLOUD.md`：未來 Arduino Cloud 對接計畫。
- `docs/ARDUINO_CONNECTION_READY.md`：三隊共用 bridge 與實機驗收步驟。
- `docs/GITHUB_STUDENT_PUBLISH.md`：GitHub 發布、安全預檢與學生操作說明。
- `docs/templates/`：Cloud 模式起始範本。
- `scripts/demo-check.sh`：三個 app 加 firmware 的總驗收。
- `scripts/github-prepublish-check.mjs`：發布前檢查 secret、placeholder 與必要檔案。
- `scripts/verify-command-catalog.mjs`：確認 App 1 bridge 指令表與 UNO R4 firmware 指令一致。
- `.codex/skills/arduino-uno-r4-vibecoding/SKILL.md`：專案本地 AI 協作規範。
