# 比賽 Demo 展示手冊

這份手冊把 `google ai studio` 內三隊作品拆成三條展示線。三隊共用本機工具鏈與 Arduino UNO R4 WiFi firmware，但作品主題、App 資料與 Demo 腳本彼此獨立。

## 共同驗收

十輪巡檢清單請看 `docs/TEN_ROUND_ACCEPTANCE.md`。

比賽前先在根目錄執行：

```zsh
zsh scripts/demo-check.sh
```

這會一次檢查：

- App 1：AI 自動板擦機器人的 TypeScript、前端 build、Node bridge API contract
- App 2：校園服務機器人的狀態測試、TypeScript、前端 build
- App 3：AI 校園心靈守護者的本機狀態/AI 測試、TypeScript 與前端 build
- Arduino UNO R4 firmware：PlatformIO 編譯

全部通過後，作品才算可以帶到現場展示。

三個展示服務都開好後，再執行：

```zsh
node scripts/full-demo-smoke.mjs
```

這會確認三個首頁、前端 build assets、App 1 `/api/ready`、課堂紀錄 API 與三隊共用機器人指令 fallback/serial response 都可用。

三隊共用硬體路徑：

```text
App 1 Node bridge: http://localhost:3200/api/robot/command
App 2 default bridge URL: http://localhost:3200
App 3 default bridge URL: http://localhost:3200
```

App 2 與 App 3 可用 `VITE_ARDUINO_BRIDGE_URL` 指到其他 bridge。未插 Arduino 時，bridge 會回傳可理解的 fallback；插上 UNO R4 並上傳韌體後，同一批 App 操作會送到 Serial。

## App 1：AI 自動板擦機器人

定位：白板拍照、語音逐字稿、AI 摘要、教師決策、筆記複習、Arduino 板擦控制的本機展示系統。

啟動：

```zsh
cd "google ai studio/app_1（國小）/AI自動板擦機器人"
npm install
npm run build
BRIDGE_PORT=3200 NODE_ENV=production npm run start
```

開啟：

```text
http://localhost:3200
```

硬體展示：

```zsh
pio run -t upload
```

上傳後接上 UNO R4 WiFi，進入 App 的「機器人」頁面，按「重新偵測」後測試 LED、伺服、LED matrix、擦除區塊、保留區塊與暫停。教師看板也可以先保存白板決策，再選擇送到機器人；沒有硬體時會保留 fallback 訊息，不會中斷 App。

建議展示順序：

1. 首頁拍白板或使用範例內容產生筆記。
2. 進教師看板看課堂摘要與區塊建議。
3. 先保存區塊決策，再按「送到機器人」展示 bridge fallback 或 Serial 控制。
4. 進紀錄本確認筆記保存。
5. 進 AI 小老師與學習單，展示同一份課堂資料可被問答與出題。
6. 開設定面板，展示 bridge、Gemini fallback、資料備份與匯出狀態。

## App 2：校園服務機器人 App

定位：校園服務機器人的手機現場操作 app 與平板中控台。這版是本機狀態真串聯，不接真雲端、不接商用帳號。

啟動：

```zsh
cd "google ai studio/app_2（國小）/校園服務機器人 app"
npm install
npm run dev
```

建議展示順序：

1. 首頁看校園狀態、機隊與「UNO R4 bridge 指令」。
2. 配送下單，確認庫存下降、訂單建立、機器人變成配送中，且硬體指令 log 顯示待送、已送或未連線。
3. 進追蹤頁完成送達，確認訂單與機器人狀態回寫首頁。
4. 教學頁點名，回覆學生提問，處理分心提醒。
5. 開學生報告與可列印報表，展示處理紀錄與時間戳。
6. 生活頁修改清潔或廣播排程，進派遣地圖建立巡邏或疏導任務。
7. 切安全封鎖，確認感測器卡片、校園狀態、日誌與 bridge 硬體指令同步。
8. 使用設定中的「匯出展示資料」保存證據；需要換機或多人接手時可「匯入展示資料」，最後用側邊欄或設定中的「重置展示資料」回到乾淨 demo 狀態。

資料保存在瀏覽器 localStorage：

```text
campus-service-robot:v1
```

## App 3：AI 校園心靈守護者

定位：校園情緒關懷與預警系統。本機版不用 Firebase 登入，也不用 Gemini key；所有預警、心情簽到、匿名心情牆、節點狀態與聊天回覆都可離線展示。

啟動：

```zsh
cd "google ai studio/app_3（國小）/AI校園心靈守護者"
npm install
npm run dev
```

建議展示順序：

1. 總覽頁說明校園穩定度、匿名展示模式與待關懷提醒。
2. 進預警中心選一筆提醒，勾選處置流程，按「佈署關懷」，確認硬體提示 toast 與總覽硬體紀錄出現。
3. 回總覽確認進行中的支持方案增加。
4. 進自我照護做心情簽到，發表匿名心情牆，使用安全空間聊天。
5. 進節點頁查看圖書館、穿堂、隱蔽區與體育館節點；離線節點可重新連線。
6. 按匯出下載目前示範資料 JSON；需要換機時按匯入載入 JSON，最後按重置回到初始示範資料。

資料保存在瀏覽器 localStorage：

```text
mindful-guardian:v1
```

## 現場備援

- 先跑 `zsh scripts/demo-check.sh`，再開三個 app。
- App 1 production bridge 建議固定用 `http://localhost:3200`，App 2 用 `http://localhost:3201`，App 3 用 `http://localhost:3202`。
- Arduino 沒偵測到時，先確認 USB 線、連接埠、`pio device monitor -b 115200`。
- Gemini key、Firebase 或網路不穩時，不要現場除錯；三個 app 都有本機 fallback 或 local-first 流程。
- 現場資料亂掉時，App 2 與 App 3 會先嘗試修復 localStorage；仍不理想時再直接重置展示資料。
