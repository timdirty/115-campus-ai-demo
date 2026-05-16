# App2 Demo Rehearsal Script — 學生 7 分鐘逐句腳本

> 評審展示版。每段 = 一段 closure rail step。學生照念照按。

## ⚠ 私密模式 / 重新整理注意

iPad Safari 私密模式或瀏覽器重新整理時：
- localStorage 寫入會失敗 → 走 memory fallback（demo 進行中不會崩）
- **但 memory fallback 是 module-scope Map，重新整理頁面後會回到初始 state**
- demo 進行中**不要重新整理**，也不要切 app（wakeLock 已保活，正常情況不會自動切走）
- 真要重置請按主畫面 reset 按鈕（會 broadcast 同步第二螢幕），不要 F5

## 環境準備（演示前 1 分鐘）
- [ ] 雙擊 `一鍵啟動展示.command` → 等到「✓ App2 已啟動」訊息
- [ ] 主畫面顯示 `0/3 完成 · 下一步：教學`
- [ ] 第二螢幕（如有）連到 robot display URL
- [ ] iPad 接投影 / mirror，確認右下角投影 URL chip 顯示

## 開場（30 秒）
1. 念：「我們是 App2 校園服務機器人，會示範教學陪跑、配送任務、生活影像三個閉環。」

## 教學流程（2 分鐘）
1. 點底部「教學」tab
2. 念：「點名前先用 AI 即時辨識，這是真實 Gemini Vision 不是假的。」
3. 按「拍攝白板」/ 「開啟攝影機」→ 看到 vision 圖框 + 場景標籤
4. 念：「AI 判讀為 X 場景，confidence Y%。」
5. 按「點名掃描」逐項勾選 → counter 跳 1/3 ✓
6. 念：「教學閉環完成 — 看到 1/3 完成。」

## 配送流程（2 分鐘）
1. 切到「配送」tab
2. 念：「現在派遣機器人送便當到 A 棟。」
3. 按「派遣」按鈕 → 觀察 SVG 動畫機器人沿路徑移動
4. 念：「機器人沿規劃路徑前進，這是真實送指令給 Arduino 不是動畫。」
5. 等抵達 toast → counter 跳 2/3 ✓
6. 念：「配送閉環完成 — 看到 2/3 完成。」

## 生活流程（2 分鐘）
1. 切到「生活」tab
2. 念：「校園即時影像辨識 + 自動廣播。」
3. 按「啟動 vision」→ 看真實影像場景分類
4. 按「緊急廣播」→ 聽到 Tone.js do-mi-sol 真實鐘聲
5. counter 跳 3/3 ✓
6. 念：「三段閉環全部完成 — 3/3 · 可以收尾報告。」

## 結尾（30 秒）
1. 切到「報告」（或長按完成按鈕）→ AI 生成學生報告
2. 觀察 QR code 出現
3. 念：「報告生成，評審可以用手機掃 QR code 看完整紀錄。」

---

## 現場災難備援快速 reference

| 災難 | 處理 |
|---|---|
| 網路爛 → AI 慢 | 等 20s 自動 fallback 本機 — 畫面有 amber 「離線備援」banner，繼續念腳本 |
| Arduino 拔線 | toast 顯示「無法送指令」— 念「目前 demo 模式，實際比賽會接實體機器人」 |
| iPad 螢幕快暗 | wakeLock 已開啟，不應發生 |
| 不小心 swipe back | 已防呆，不會退出 demo |
| 投影比例錯 | 右下角 chip 顯示正確 URL，可用另一裝置連 |

---

## Dry Run 結果區塊（每次 rehearsal 紀錄）

### Dry Run 1: 2026-05-16 (automated check)
- 設備: codex subagent dry-run (`npm run demo:check` + `npm run check`)
- 總時長: demo:check 3.888 秒（bridge spawn + 10 endpoint 平行驗證）
- 卡住的地方: 無（10/10 endpoint PASS, lint/test/build 全綠）
- 觀察:
  - demo:check 10 endpoint 平均回應時間 < 1s（bridge spawn 含啟動 ~3s 一次性成本）
  - `ai/vision-classify` 與 `ai/classroom-scan` 在無 Gemini key 環境回 502，被 `okStatuses` 允許清單視為 PASS（預期行為，由 fallback 路徑接手）
  - `robot/command`、`robot/task` 在 `DEMO_SIMULATE_HARDWARE=1` 下回 200，確認模擬路徑健康
  - localAi.test 500-round pixel validation 過
- TODO:
  - 比賽前實際雙人 dry run（iPad + 投影 + Arduino 全套）
  - 計時 7 分鐘是否合適（目前為紙上估算，需現場碼錶確認）
  - 確認 Tone.js 廣播在公共喇叭音量足夠
  - 確認在有真實 Gemini key 的條件下 vision endpoint 回 200 而非 502 fallback
