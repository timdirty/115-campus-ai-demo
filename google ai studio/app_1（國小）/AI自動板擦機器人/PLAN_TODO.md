# AI 自動板擦機器人 PLAN_TODO

## 作品定位

國小課堂白板 AI 助教：拍下白板、整理老師講解、保存筆記、產生複習問答，並用 UNO R4 WiFi 示範板擦機器人動作。

## 現況

- 已完成本機 Node bridge、JSON 資料儲存、Gemini fallback、備份/還原、筆記庫、AI 小老師、學習單與教師看板。
- 已把「機器人控制」接入 App 導覽，可從 App 內測試 Serial 指令。
- Node bridge 已作為三個 App 共用 Arduino gateway；App 2 與 App 3 會從 localhost POST 到同一個 `/api/robot/command`。
- 教師看板預設先保存決策，再可選擇送到 UNO R4 WiFi；無硬體時會顯示 fallback，不中斷展示。
- 首頁已加入 3 分鐘評審展示模式，清楚串起拍白板、教師決策、機器人選配送出。
- 全域搜尋可直接開啟對應課堂紀錄；Gemini/Serial fallback 文案改成正式展示狀態。
- 白板紀錄 localStorage 會逐筆正規化，壞資料會補齊安全欄位；`npm run check` 已納入恢復測試。
- 已清掉紀錄本 filter 的型別繞過，搜尋/篩選/開啟筆記流程維持正式 TypeScript 型別。
- 行動版不再硬塞原本單列 6 tab；手機底部導覽改為 3x2 操作區，保留清楚文字與安全點擊高度。
- 已新增根目錄 `scripts/mobile-layout-check.mjs`，可用 390px 手機 viewport 量測水平溢出、截字與過小按鈕。
- 已新增 `STUDENT_DEMO_GUIDE.md`，提供學生操作入口、上台分工、3 分鐘講稿、評審問答與 Arduino 連動後續計畫。

## Demo 腳本

學生講解版請看 `STUDENT_DEMO_GUIDE.md`。

1. 首頁拍白板或使用範例內容產生筆記。
2. 教師看板檢查保留/可擦區塊。
3. 先按「套用決策」保存，再按「送到機器人」展示硬體支線。
4. 紀錄本搜尋剛剛保存的課堂筆記。
5. AI 小老師提問，學習單產生複習題。
6. 設定面板展示 bridge、Gemini fallback、匯出、備份、還原。

## Arduino R4 WiFi 對接

- 目前使用 `/api/robot/task` 與 `/api/robot/command` 透過 USB Serial 呼叫 firmware `handleCommand()`。
- 對應指令：`ERASE_REGION_A/B/C`、`KEEP_REGION_A/B/C`、`ERASE_ALL`、`PAUSE_TASK`、`SHOW_ON`、`FIREWORK`，以及 App 2/App 3 共用的 `DELIVERY_START`、`DELIVERY_DONE`、`CLEAN_SCHEDULE`、`BROADCAST_SCHEDULE`、`TEACH_SCAN`、`FOCUS_NUDGE`、`QUESTION_ACK`、`TEACH_REPLY`、`SAFETY_LOCKDOWN`、`SAFETY_CLEAR`、`BELL_REMIND_ON`、`BELL_REMIND_OFF`、`BROADCAST_START`、`PATROL_START`、`ROBOT_RESUME`、`ROBOT_PAUSE`、`SPEED_SET`、`NODE_HEARTBEAT`、`ALERT_SIGNAL`、`CARE_DEPLOYED`、`NODE_RESTART`。
- 下一階段若接 Arduino Cloud，仍維持 Serial fallback，Cloud callback 只轉呼叫同一套 `handleCommand()`。

## 待辦

- 實機上確認伺服角度與板擦機構區塊 A/B/C 的物理位置。
- 用現場白板與攝影機測一次拍照、OCR fallback 與教師決策流程。
- 若有正式網路，再設定 Gemini key；沒有 key 仍使用本機 fallback。
- 比賽前用手機與平板各跑一次首頁、教師看板、紀錄本、機器人控制，確認文字不重疊。
- 手機 UI/UX 後續優先級：可以改版就改版，不必死守原始佈局；以 360px 寬度可讀、可點、不遮住內容為準。

## 十輪展示驗收

1. 首頁展示流程與系統狀態可在 10 秒內說清楚。
2. Gemini 未設定時仍走本機 fallback 且不顯示阻斷錯誤。
3. 白板紀錄壞資料會恢復為可開啟筆記。
4. 搜尋結果可直接定位到紀錄本細節。
5. 教師看板先保存決策，再選擇送出機器人支線。
6. Arduino 未連線時保留任務紀錄，不中斷展示。
7. 設定面板可看 `/api/ready`、匯出、備份與還原。
8. 手機與平板版主要按鈕文字不爆版。
9. `npm run check` 通過 TypeScript、build、API contract 與白板紀錄恢復測試。
10. production bridge 可用 `BRIDGE_PORT=3200 NODE_ENV=production npm run start` 啟動。

## 驗收

```zsh
npm run check
BRIDGE_PORT=3200 NODE_ENV=production npm run start
pio run
```
