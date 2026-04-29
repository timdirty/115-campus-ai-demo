# AI 校園心靈守護者

本專案是「AI 學校情緒檢測裝置」的本機完整 Demo。Firebase 與 Gemini 都是未來可接選項；目前不用登入、不用 API key，也能展示總覽、預警處理、自我照護、匿名心情牆、聊天與節點監控。

硬體提示路徑已接到 App 1 的本機 Arduino bridge。預設會送到 `http://localhost:3200/api/robot/command`，可用 `VITE_ARDUINO_BRIDGE_URL` 改成其他 bridge URL；預警處理、佈署關懷與節點重新連線都會發出對應 UNO R4 指令。沒有插 Arduino 時只顯示展示 fallback，插上並上傳韌體後同一批指令會走 Serial。

總覽頁會保留最近硬體提示紀錄，評審可以看到 `sent` 或 `fallback` 狀態，不必只依賴瞬間 toast。

## Run Locally

```zsh
npm install
npm run dev
```

開啟 Vite 顯示的網址。

## Verification

```zsh
npm run check
```

`check` 會執行本機狀態/AI 測試、TypeScript 檢查與 production build。

## Demo Data

資料保存在瀏覽器：

```text
mindful-guardian:v1
```

App 右上角「匯出」可下載目前示範資料 JSON，「匯入」可載入另一台電腦或前一輪展示資料並先做安全修復，「重置」可回到初始示範資料。所有學生資料都是匿名示範代號，不存放真學生個資。

## 3 分鐘評審 Demo

1. 總覽先說明「匿名關懷、非診斷、可持續追蹤」。
2. 預警中心選一筆關懷提醒，勾選處置清單並佈署關懷，回總覽確認硬體提示紀錄增加。
3. 自我照護頁完成心情簽到，新增一片匿名心情牆葉子。
4. 安全空間聊天輸入考試壓力，展示本機 AI 支持回覆。
5. 節點頁重新連線離線節點，最後匯出 demo JSON 或重置。

## 現場故障備案

- localStorage 壞資料或空資料：app 會恢復初始匿名示範資料。
- 無 Firebase/Gemini：維持 local-first 與本機回覆，不影響展示。
- 無 Arduino：關懷流程照常完成，硬體提示會以 bridge fallback toast 和總覽紀錄告知；插上 UNO R4 後同一操作會改送 Serial。
- 不使用真學生資料：所有欄位維持匿名代號，說法只限「關懷提醒」與「輔導建議」。
- 隱私、匯出、匯入、重置與匿名投稿都有即時回饋，方便評審確認操作成功。

## 評分亮點

- 預警處理、自我照護、聊天支持與節點監控形成完整關懷閉環。
- 硬體提示紀錄會保存在 localStorage 與匯出 JSON 中，可證明關懷/節點指令有送到 bridge。
- 語氣聚焦匿名、非診斷、支持與轉介，不宣稱醫療或心理診斷能力。
- 主要 UI 元件已拆到 `src/components/guardianUi.tsx`，狀態恢復集中在 `src/state/guardianState.ts`。

## 後續正式整合

- Firebase：可作為正式雲端同步層，但必須保留本機 fallback。
- Gemini：建議未來改由後端 proxy 呼叫，不在前端暴露 key。
- Arduino UNO R4 WiFi：目前已可送並記錄 `ALERT_SIGNAL`、`CARE_DEPLOYED`、`NODE_RESTART` 到本機 bridge；下一步只需要上傳韌體並驗證實體 LED、Matrix 或伺服動作。
