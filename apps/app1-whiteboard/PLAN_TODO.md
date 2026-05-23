# AI 自動板擦機器人 PLAN_TODO

## 作品定位

國小課堂白板 AI 助教：拍下白板、整理老師講解、保存筆記、產生複習問答，並用 UNO R4 WiFi 示範老師可控的板擦機器人動作（AI 建議 + 老師確認 + 來回擦動 + 標準測試樣本自我驗證）。

## 現況

- v4（2026-05-23）最後一輪 polish：TeacherDashboard fallback 修不誤標完成、JudgePreflightChip 三燈、eraseVerifier「標準測試樣本」narrative 統一、Q13-Q16 答題訓練
- v3（2026-05-23 PR #5）：教師看板從 1039 → 631 行、firmware 加「走進區 + 來回 ×3 + 回原點 + ERASE_PROGRESS:N/3 + ERASE_DONE:REGION_X」對齊說明書 P7 圖 9「來回擦拭」、AI 加 contentType 4 類護欄敘事
- v2（2026-05-21）4 大亮點：TTS 語音（robotVoice.ts）、AI 思考動畫 overlay（AIThinkingOverlay.tsx）、擦完撒花（CelebrationOverlay.tsx）、AI 自我驗證閉環（eraseVerifier.ts 用標準測試樣本）
- 已完成本機 Node bridge、JSON 資料儲存、Gemini 4 層 fallback、備份/還原、筆記庫、AI 小老師、學習單、教師看板
- 機器人控制接入 App 導覽，可從 App 內測試 Serial 指令
- 各 App 有獨立 bridge：App 1 用 localhost:3201、App 2 用 localhost:3202、App 3 用 localhost:3203
- 教師看板先保存決策，再可選擇送到 UNO R4 WiFi；無硬體時顯示 fallback，不誤標完成
- 首頁加入 3 分鐘評審展示模式，串起拍白板、教師決策、機器人選配送出
- 全域搜尋可直接開啟對應課堂紀錄；Gemini/Serial fallback 文案為正式展示狀態
- 白板紀錄 localStorage 逐筆正規化，壞資料自動補齊安全欄位；`npm run check` 含恢復測試
- 紀錄本 filter 維持正式 TypeScript 型別
- 行動版底部導覽 3x2 操作區，清楚文字 + 安全點擊高度
- 根目錄 `scripts/mobile-layout-check.mjs` 可用 390px 手機 viewport 量測水平溢出
- `STUDENT_DEMO_GUIDE.md` 提供學生操作入口、上台分工、3 分鐘講稿、評審 Q&A 16 題、Arduino 連動後續計畫
- 對外說法收斂為「AI 建議 + 老師確認 + 機器人來回擦動 + 標準測試樣本驗證」

## Demo 腳本

學生講解版請看 `STUDENT_DEMO_GUIDE.md`。

1. 首頁拍白板或使用範例內容產生筆記
2. 教師看板檢查保留/可擦區塊
3. 先按「套用決策」保存，再按「送到機器人」展示硬體支線，明確說明老師保有最後決策權
4. 紀錄本搜尋剛剛保存的課堂筆記
5. AI 小老師提問，學習單產生複習題
6. 設定面板展示 bridge、Gemini fallback、匯出、備份、還原

## Arduino R4 WiFi 對接

- 使用 `/api/robot/task` 與 `/api/robot/command` 透過 USB Serial 呼叫 firmware `handleCommand()`
- 對應指令：`ERASE_REGION_A/B/C`、`KEEP_REGION_A/B/C`、`ERASE_ALL`、`PAUSE_TASK`、`SHOW_ON`、`FIREWORK`、`CELEBRATE`，以及 App 2/App 3 共用的 `DELIVERY_START`、`DELIVERY_DONE`、`CLEAN_SCHEDULE`、`BROADCAST_SCHEDULE`、`TEACH_SCAN`、`FOCUS_NUDGE`、`QUESTION_ACK`、`TEACH_REPLY`、`SAFETY_LOCKDOWN`、`SAFETY_CLEAR`、`BELL_REMIND_ON`、`BELL_REMIND_OFF`、`BROADCAST_START`、`PATROL_START`、`ROBOT_RESUME`、`ROBOT_PAUSE`、`SPEED_SET`、`NODE_HEARTBEAT`、`ALERT_SIGNAL`、`CARE_DEPLOYED`、`NODE_RESTART`
- 下一階段若接 Arduino Cloud，仍維持 Serial fallback，Cloud callback 轉呼叫同一套 `handleCommand()`

## 待辦

- 用現場白板與攝影機測一次拍照、OCR fallback 與教師決策流程
- 在白板前方加固定攝影機，建立白板座標校正與區塊映射；學生主流程仍保持左區 / 右區
- 規劃機器人位置確認或限位回報，讓後續版本能接 Gemini Vision 真拍對比（替換現階段標準測試樣本）
- 若有正式網路，再設定 Gemini key；沒有 key 仍使用本機 fallback
- 比賽前用手機與平板各跑一次首頁、教師看板、紀錄本、機器人控制，確認文字不重疊
- 手機 UI/UX 後續優先級：以 360px 寬度可讀、可點、不遮住內容為準

## 十輪展示驗收

1. 首頁展示流程與系統狀態可在 10 秒內說清楚
2. Gemini 未設定時仍走本機 fallback 且不顯示阻斷錯誤
3. 白板紀錄壞資料會恢復為可開啟筆記
4. 搜尋結果可直接定位到紀錄本細節
5. 教師看板先保存決策，再選擇送出機器人支線
6. 學生能清楚說明「AI 建議 + 老師確認 + 機器人來回擦動 + 標準測試樣本驗證」narrative
7. Arduino 未連線時保留任務紀錄，不中斷展示，不誤標完成
8. 設定面板可看 `/api/ready`、匯出、備份與還原
9. 手機與平板版主要按鈕文字不爆版
10. `npm run check` 通過 TypeScript、build、API contract 與白板紀錄恢復測試
11. production bridge 可用 `BRIDGE_PORT=3201 NODE_ENV=production npm run start` 啟動

## 驗收

```zsh
npm run check
BRIDGE_PORT=3201 NODE_ENV=production npm run start
pio run
```
