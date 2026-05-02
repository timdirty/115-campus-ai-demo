# 三隊學生操作與報告包

這份文件給老師或隊輔快速分配學生任務。每一隊都有自己的操作講稿，正式上台前請先讓學生照「操作步驟卡」完整跑一次。

## 公開操作網址

```text
總入口：https://timdirty.github.io/115-campus-ai-demo/
App 1：https://timdirty.github.io/115-campus-ai-demo/app1/
App 2：https://timdirty.github.io/115-campus-ai-demo/app2/
App 3：https://timdirty.github.io/115-campus-ai-demo/app3/
App 1 講稿：https://timdirty.github.io/115-campus-ai-demo/app1-guide.html
App 2 講稿：https://timdirty.github.io/115-campus-ai-demo/app2-guide.html
App 3 講稿：https://timdirty.github.io/115-campus-ai-demo/app3-guide.html
```

## 三隊個別講稿

- App 1：`../google ai studio/app_1（國小）/AI自動板擦機器人/STUDENT_DEMO_GUIDE.md`
- App 2：`../google ai studio/app_2（國小）/校園服務機器人 app/STUDENT_DEMO_GUIDE.md`
- App 3：`../google ai studio/app_3（國中）/AI校園心靈守護者/STUDENT_DEMO_GUIDE.md`

## 共用開場說法

我們這次做了三個不同的校園 AI App。三個作品都可以直接用網頁操作，而且沒有接 Arduino 時也能先完成軟體展示。軟體端會把任務、資料、狀態和指令紀錄先保存起來；下一階段接上 Arduino UNO R4 WiFi 後，同一套流程就可以變成實體機器人的動作。

## App 1 報告重點：AI 自動板擦機器人

作品主軸：白板內容整理、教師決策、板擦機器人任務。

學生要講清楚三件事：

- AI 先幫老師整理白板，不是直接取代老師。
- 老師最後確認哪些區塊要擦，機器人才執行。
- 沒有 Arduino 時會保留指令紀錄，接上後同一任務可變成實體擦除。

最重要操作：

1. 首頁產生白板分析。
2. 教師看板保存決策。
3. 送到機器人任務。
4. 紀錄本搜尋剛剛的課堂筆記。

## App 2 報告重點：校園服務機器人

作品主軸：校園任務中控台，整合配送、教學、生活服務、巡邏與報表。

學生要講清楚三件事：

- 每個操作會同步影響庫存、訂單、任務、機器人狀態和 log。
- 庫存不足或錯誤操作不會誤派機器人。
- Arduino 之後負責把配送、廣播、巡邏、安全任務轉成實體動作。

最重要操作：

1. 配送下單。
2. 追蹤送達。
3. 教學或生活服務任務。
4. 派遣巡邏並回首頁看指令 log。

## App 3 報告重點：AI 校園心靈守護者

作品主軸：匿名、非診斷、關懷支援。

學生要講清楚三件事：

- 系統不是心理診斷工具，只做關懷提醒和支持建議。
- 展示資料使用匿名代號，不收集真學生個資。
- Arduino 之後只做柔和提示、節點狀態或關懷已佈署提醒，不顯示敏感內容。

最重要操作：

1. 總覽說明匿名與穩定度。
2. 預警中心勾選處置並佈署關懷。
3. 自我照護簽到與匿名心情牆。
4. 聊天支持與節點重新連線。

## 評審問到 Arduino 時的統一回答

目前三個 App 的軟體流程都已經打通。沒有插 Arduino 時，系統會用 fallback 顯示任務和指令紀錄，確保展示不中斷。下一階段接上 UNO R4 WiFi 並上傳 firmware 後，App 1 會控制板擦區塊，App 2 會控制服務任務提示或移動，App 3 會控制關懷提示與節點燈號。

## 比賽前彩排清單

1. 每組學生先照自己的 `STUDENT_DEMO_GUIDE.md` 唸一次。
2. 每組用手機實際開公開網址操作一次。
3. 每組練習 3 分鐘內講完，不要現場臨時找按鈕。
4. 老師或隊輔先跑 `zsh scripts/demo-check.sh` 確認三個專案都通過。
5. 如果 Arduino 還沒接好，統一說「軟體指令流已完成，硬體是下一階段實機連動」。
