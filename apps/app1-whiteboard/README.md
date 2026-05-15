# 國小 AI 白板助教

本專案是「國小組課堂白板 AI 助教」的本機 production 版：React/Vite 前端由同一個 Node bridge 提供，資料寫入本機 JSON，Gemini API key 只在 server 端讀取。主要工作流聚焦國小課堂：白板快照、老師講解逐字稿、課堂紀錄本、AI 小老師、國小學習單、教師決策、備份與還原都能在現場真實使用；沒有 API key 時也保留清楚的本機 fallback 狀態。機器人控制定位為老師可控的半自動支線，現階段以 A/B/C 區塊任務展示為主，不宣稱已完成全自動視覺定位。

## Local Production Run

```zsh
npm install
cp .env.example .env.local
npm run build
npm run start
```

Open:

```text
http://localhost:3200
```

`GEMINI_API_KEY` 是選填。沒有 key 時 `/api/ai/*` 會使用本機 fallback，介面會清楚顯示 fallback 狀態。

## Development Run

```zsh
npm run dev
```

Vite 預設在 `http://localhost:3000`，bridge 在 `http://localhost:3200`。如果 3000 被占用，Vite 會自動提示下一個可用 port。

## Production Operations

資料存在：

```text
data/notes.json
data/chat.json
data/classroom-session.json
data/task-log.json
```

App 右上角設定面板提供：

- bridge / Gemini / build / storage ready 狀態
- 完整 JSON 匯出
- 寫入 `data/backups` 的本機備份
- 從匯出 JSON 還原課堂紀錄、聊天與課堂狀態

相關 API：

```text
GET  /api/health
GET  /api/ready
GET  /api/export
POST /api/backup
POST /api/import
```

## Classroom APIs

```text
POST /api/ai/analyze-board
POST /api/ai/transcribe
POST /api/ai/chat
POST /api/ai/review
GET  /api/notes
POST /api/notes
PUT  /api/notes/:id
DELETE /api/notes/:id
GET  /api/chat
PUT  /api/chat
GET  /api/classroom/session
POST /api/classroom/session
```

Robot APIs are production bridge endpoints for App 1 and the shared Arduino gateway used by App 2/App 3. The classroom UI can store teacher decisions first, then explicitly send selected commands to the robot branch:

```text
GET  /api/robot/status
GET  /api/robot/commands
POST /api/robot/command
POST /api/robot/task
```

## Verification

```zsh
npm run check
npm run demo:check
```

For single-server smoke testing:

```zsh
BRIDGE_PORT=3200 NODE_ENV=production npm run start
```

Then open `http://localhost:3200` and check `/api/ready`.

`npm run demo:check` 會自動啟動展示用 bridge 與前端，先重置展示資料，再用上方藍色主按鈕跑完「一鍵示範 → 教師看板 → 機器人 → 紀錄本 → 小老師 → 學習單」桌面流程；接著確認單按一次重置不會清空資料、手機寬度六個頁籤沒有水平溢出、學生畫面不顯示老師設定與回報工具，最後再測一次直接從教師看板冷啟動也能靠主按鈕承接任務。

## 3 分鐘評審 Demo

學生可直接照著操作與報告的版本請看 `STUDENT_DEMO_GUIDE.md`。

1. 首頁說明「白板內容進來，教師決策出去，機器人支線可選配」。
2. 使用攝影機或範例內容產生白板分析，確認 Gemini 未設定時會顯示本機展示模式。
3. 到教師看板標記保留/可清空區塊，先保存課堂決策，強調老師保有最後決定權。
4. 送出一筆 UNO R4 WiFi 任務；無硬體時說明指令已保留為展示紀錄，目前是區塊式半自動控制。
5. 用搜尋開啟剛剛保存的課堂紀錄，再切到 AI 小老師或學習單收尾。

學生忘記下一步時可以只按上方藍色主按鈕：本頁還沒完成就先執行本頁主要動作，完成後才前往下一頁。

## 現場故障備案

- Gemini key 不可用：系統會走本機 fallback，仍可完整展示。
- Arduino 未連線：教師決策與任務紀錄不中斷，只把硬體送出視為選配支線。
- Bridge 未啟動：前端仍可用瀏覽器本機紀錄展示；正式驗收再啟動 `npm run start`。
- 白板紀錄資料格式壞掉：讀取時會自動正規化，必要欄位用安全示範資料補齊。

## 評分亮點

- 首頁、教師看板、機器人控制與搜尋紀錄串成同一條可講解流程。
- 把 AI 定位成老師決策輔助，不讓機器人直接自動亂擦，符合真實教學現場的安全需求。
- Gemini 與 Serial 都是可選配能力；未連線時呈現「展示模式」而不是錯誤。
- 重要資料可匯出、備份、還原，production bridge 可用 `/api/ready` 快速驗收。
- `STUDENT_DEMO_GUIDE.md` 已整理學生上台分工、逐字講稿、操作步驟卡與後續機器人連動說法。

## 對評審的完整說法

- 第一階段先完成可用版：白板內容擷取、AI 協助整理、老師確認、區塊式板擦任務。
- 目前不是宣稱全自動視覺導航，而是先做老師可控的半自動板擦流程。
- 下一階段會在白板前方加入固定攝影機，補上白板座標校正、機器人位置確認與閉環控制。
- 這樣的切法比較符合比賽現場需求：先確保流程穩定、可驗收、可備援，再逐步升級硬體自動化。

The full three-app competition flow is documented in `../../../docs/DEMO_RUNBOOK.md`.
