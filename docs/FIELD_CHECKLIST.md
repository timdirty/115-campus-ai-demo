# Field Checklist

這份是比賽當天放在桌上的最後檢查表。每次出發前、上台前、換場前各跑一次。

## 10 Minutes Before Demo

- [ ] 執行 `npm run demo:ready`，確認最後出現 `Competition readiness check passed`。
- [ ] 打開 `demo-ready-report.json`，確認三隊 app 與 EV3 指令清單都在。
- [ ] 確認三隊學生知道自己的入口：`https://timdirty.github.io/115-campus-ai-demo/app1/`、`https://timdirty.github.io/115-campus-ai-demo/app2/`、`https://timdirty.github.io/115-campus-ai-demo/app3/`。
- [ ] 若 GitHub Pages 已部署，執行 `CHECK_PUBLIC_URLS=1 node scripts/competition-readiness-check.mjs`。
- [ ] 若現場網路不穩，改用本機展示與 Pages artifact。

## Hardware

- [ ] UNO R4 已接 USB，或已決定使用 `DEMO_SIMULATE_HARDWARE=1`。
- [ ] EV3 已開機並確認 `EV3_STOP` 可用。
- [ ] 沒接 EV3 時，學生說法使用「模擬模式保留完整指令流程」。
- [ ] 真機測試順序：`EV3_STATUS` -> `EV3_SAFE_POSE` / `EV3_HOME` -> 單一動作 -> `EV3_STOP`。

## App 1

- [ ] 展示白板拍攝或匯入圖片，確認本機像素辨識產生筆跡結果。
- [ ] 進教師看板，看課堂摘要與區塊建議，先保存再送機器人。
- [ ] 確認硬體指令 log 與任務紀錄同步留下。
- [ ] 送出擦除任務後確認白板圖對應區塊出現 ✓ 覆蓋，頂端橫幅顯示「區塊 X 板擦完成」。

## App 2

- [ ] 首頁看任務鏈、機器人狀態與 UNO R4 指令 log。
- [ ] 配送頁下單，確認庫存、訂單、任務、機器人狀態與指令同步更新。
- [ ] 追蹤頁完成送達：確認任務日誌出現第四步「EV3 手臂收回 → 已到位」，完成時間戳正確顯示。
- [ ] 教學頁點名或處理提醒。
- [ ] 右下角 FAB 召喚虛擬搖桿，測試前後左右與緊急停止（韌體看門狗 3 秒保護）。
- [ ] 報表中心確認任務紀錄，最後重置展示資料。

## App 3

- [ ] 第一屏說明 AI 主動巡查；指出最高風險區的風險、聲量與提醒數。
- [ ] 點選中高風險區，派遣機器人介入，確認機器人任務紀錄產生。
- [ ] 預警抽屜：選一筆提醒，勾選處置清單，佈署關懷。
- [ ] 感知抽屜：按「示範」按鈕，確認折線趨勢圖出現、趨勢箭頭顯示。
- [ ] 感知抽屜：啟用麥克風，等 20 秒以上確認趨勢圖開始累積真實採樣。
- [ ] 底部遙控列展開，測試 D-pad 前後左右與緊急停止。
- [ ] 紀錄抽屜：確認硬體提示有 sent/fallback 狀態留下。

## Recovery Lines

- 網路不穩：使用本機 fallback 與已 build 的 Pages artifact。
- 相機不能開：使用照片上傳或範例資料。
- EV3/Arduino 未連線：切到 `DEMO_SIMULATE_HARDWARE=1`，展示同一套指令流程。
- 評審問「是否真能接硬體」：指出 `docs/EV3_CALIBRATION_TABLE.md`、`docs/EV3_INTEGRATION.md` 與已通過的 PlatformIO/EV3 catalog check。
