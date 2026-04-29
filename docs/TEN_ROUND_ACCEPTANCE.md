# Google AI Studio 三隊十輪驗收清單

這份清單用來做比賽前最後巡檢。三個 app 都採 local-first / fallback 設計，不要求 Firebase、Gemini 或 Arduino 真連線才能展示主流程；硬體指令已統一送到 App 1 的本機 bridge，插上 UNO R4 並上傳韌體後即可走 Serial。

## 十輪共同驗收

1. 第一眼定位：首頁 10 秒內能說清楚作品解決什麼問題。
2. 三分鐘腳本：從首頁開始能順著主要任務鏈走完。
3. 狀態同步：每個主要操作都能看到資料、任務或 log 改變；失敗操作不可誤送硬體指令。
4. 壞資料恢復：localStorage 空白、破損或半壞陣列不會讓 app 當場崩潰。
5. Fallback 語氣：無 Gemini、無 Firebase、無 Arduino 時顯示展示模式或本機模式，不把它說成阻斷錯誤。
6. 匯出/匯入證據：需要交付或換機展示時能下載 JSON、報表或備份，App 2 與 App 3 可安全匯入 JSON。
7. 重置回復：現場操作亂掉時可回到初始 demo 資料。
8. 響應式：手機、平板、桌面導覽與主要按鈕不重疊、不爆字。
9. 測試通過：各 app 的 `npm run check` 必須全部通過，`node scripts/verify-command-catalog.mjs` 必須確認 bridge/firmware 指令一致。
10. 展示網址：三個服務啟動後執行 `node scripts/full-demo-smoke.mjs`，確認首頁、build assets、App 1 bridge API，以及 App 1/App 2/App 3 代表指令 `SHOW_ON`、`DELIVERY_START`、`CARE_DEPLOYED` 的 fallback/serial response 都可用。

## 現場啟動建議

```zsh
cd "/Volumes/Tim aaddtional/Download/115資通訊/tedt/google ai studio/app_1（國小）/AI自動板擦機器人"
BRIDGE_PORT=3200 NODE_ENV=production npm run start

cd "/Volumes/Tim aaddtional/Download/115資通訊/tedt/google ai studio/app_2（國小）/校園服務機器人 app"
npm run preview -- --host 0.0.0.0 --port 3201

cd "/Volumes/Tim aaddtional/Download/115資通訊/tedt/google ai studio/app_3（國小）/AI校園心靈守護者"
npm run preview -- --host 0.0.0.0 --port 3202
```

展示網址：

```text
App 1: http://localhost:3200
App 2: http://localhost:3201
App 3: http://localhost:3202
```
