# App3 Demo Rehearsal Script — 學生 7 分鐘逐句腳本

> 評審展示版。每段 = 一段 closure rail step。學生照念照按。

## ⚠ 私密模式 / 重新整理注意

iPad Safari 私密模式或瀏覽器重新整理時：
- localStorage 寫入會失敗 → 走 memory fallback（demo 進行中不會崩）
- **但 memory fallback 是 module-scope Map，重新整理後 5/5 counter 會歸零**
- demo 進行中**不要重新整理**，也不要切 app（wakeLock 已保活，正常情況不會自動切走）
- 真要重置請按「重置舞台」按鈕（會 broadcast 同步第二螢幕 robot-app），不要 F5

## 環境準備（演示前 1 分鐘）

- [ ] 雙擊 `一鍵啟動展示.command` → 等到「主控台已開啟」訊息
- [ ] 主畫面顯示 0/5 closure counter、第二螢幕 robot-app 顯示 calm 表情
- [ ] iPad 接投影 / mirror，確認右下角投影 chip 顯示第二螢幕 URL
- [ ] （可選）接上 UNO R4 Arduino，跑 `npm run demo:check` 確認 14/14 PASS

## 開場（30 秒）

1. 念：「我們是 App3 校園心靈守護者，會示範五段閉環從訊號融合到結案。」
2. 念：「整套系統用真實的麥克風聲量、Gemini Vision 影像辨識、跟機器人指令，現場可以實作不是假的動畫。」

## 訊號融合（90 秒）

1. 點底部「感知中心」tab → 啟動麥克風（允許瀏覽器權限）
2. 念：「啟動聲量感知，這是真實麥克風。我們只算音量指標跟波動，不存原音、不轉文字、不上傳雲端。」
3. 觀察 SoundSparkline 即時波形 + 風險指數
4. 念：「閾值跨越時系統會把匿名訊號送進判讀。」
5. counter 跳 1/5 ✓
6. 念：「訊號融合完成 — 1/5。」

## 預警成案（90 秒）

1. 點主畫面「判讀＋派遣」按鈕（或「開圖卡」展示影像備援）
2. 念：「Gemini Vision 判讀情緒並建立預警，這是真實 AI 不是樣板。」
3. 等預警卡飛入 → 觀察校園 2.5D 地圖紅點脈衝動畫
4. 念：「校園地圖即時標記，紅點脈衝對應風險區。」
5. counter 跳 2/5 ✓

## 派遣處置（90 秒）

1. 點「派遣機器人」按鈕 → 主畫面顯示派遣狀態 + 機器人 ETA
2. 切回 / 看第二螢幕 robot-app → 觀察情緒臉切換動畫（600ms cubic-bezier）
3. 念：「機器人收到指令，第二螢幕情緒切換是 emotion-event WS 即時同步，從派遣到換臉 < 3 秒。」
4. 等老師確認 → counter 跳 3/5 ✓

## 學生支持（90 秒）

1. 切到「照護」tab → 輸入學生訊息（例如「我最近壓力很大」）
2. 點送出 → AI 回覆出現
3. 念：「真實 Gemini 回覆 — 走 `/api/ai/guardian-chat` endpoint，不是模板。」
4. 觀察回應內容溫暖、不評判、有具體建議
5. counter 跳 4/5 ✓

## 回報結案（60 秒）

1. 在預警卡標記為「已處理」（或完成關懷流程）
2. （若接 Arduino）觀察 RGB LED 收尾動作
3. 念：「結案紀錄保留追蹤證據，整套五段閉環完成。」
4. counter 跳 5/5 ✓ — 「5/5 完成 · 閉環收尾」

## 結尾（30 秒）

1. 念：「整套 demo 涵蓋感知 / 判讀 / 派遣 / 支持 / 結案五段，請評審看右下角投影 URL 連到第二螢幕。」
2. 念：「所有資料都是匿名示範代號，沒存放真學生個資。」

---

## 現場災難備援快速 reference

| 災難 | 處理 |
|---|---|
| Wi-Fi 整網壞 | 上方 amber「離線備援模式」banner 出現 → 念腳本繼續，AI 走本機 fallback |
| Arduino 拔線 | 機器人指令回 503 + 韌體上傳提示 → 念「目前 demo 模式，實際比賽會接實體機器人」|
| iPad 螢幕快暗 | wakeLock 已開，不應發生。萬一發生：點一下螢幕喚醒 |
| 不小心 swipe back | 已防呆，popstate 自動 push 回來，不會退出 demo |
| 投影比例錯 | 右下角 chip 顯示第二螢幕 URL，可用 iPad / 其他裝置連 |
| Gemini API 超時 | withAiTimeout 20s 後自動 fallback 本機分析，畫面有 fallback 標籤 |
| localStorage 滿 | trim → memory fallback 自動接，state 不丟（iOS 私密模式也適用）|
| Bridge 重啟 | WS auto-reconnect，前端自動恢復，不用 F5 |

---

## Dry Run 1: 2026-05-16 (automated check)

- 設備：自動驗證（demo:check + npm run check + robot-app build）
- 總時長：約 4-5 秒（自動）
- 卡住的地方：無（14/14 endpoint PASS，lint/test/build/robot-app build 全綠）
- 觀察：
  - demo:check 14 個 endpoint 平均回應時間 < 1s
  - guardianState 4 個 test 全綠（含 500-round pixel validation）
  - robot-app build 95ms
- TODO（待人工執行）：
  - 比賽前實際雙人 dry run（iPad + 投影 + 接 Arduino 全套）
  - 計時 7 分鐘是否合適（紙上估算，需現場碼錶）
  - 確認 robot-app 第二螢幕在 30 min 連續 demo 後 emotion 切換仍流暢
  - 確認麥克風授權對話流程在 iPad Safari 順暢
  - 確認 Gemini API key 有設定時 ai/guardian-chat 真實回 200（不是 fallback 503）
  - 確認 RGB LED 在 UPDATE_ALERT_STATUS=resolved 時觸發（依韌體支援度）

---

## 後續可加（per adversarial review）

這些不在 MUST 範圍，比賽前若有餘裕可加：
- streaming chat reply（Gemini 串流回應 typing 效果）
- 五段 closure 完成時 confetti / celebration 動畫
- LED_CONFIRM 韌體 ACK echo（需改 firmware）
- robot-app 第二螢幕 emotion event log（顯示最近 10 次切換）
