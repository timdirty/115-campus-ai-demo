# App2 Demo Soak Checklist

> 30 分鐘 / 比賽前一晚做。確認沒有累積性 bug。

## 環境

- [ ] Chrome / Safari devtools 開 Performance + Memory tab
- [ ] iPad mirror 投影機 / 外接螢幕
- [ ] Arduino UNO R4 接線（可選，有更好）
- [ ] `.env` 設好 `GEMINI_API_KEY`（否則 AI endpoint 走 fallback）

## 30 分鐘流程（跑 6 輪、每 5 min 一輪）

每輪 = 完整跑一次 3-step closure (教學 → 配送 → 生活)，並做以下變化：

| 輪次 | 變化 | 觀察 |
|---|---|---|
| 1 | 走完整 3/3 | counter 0→3/3，閉環順暢 |
| 2 | 中途切 tab（教學→配送→教學）| busy state 不卡，AbortController 取消舊 fetch |
| 3 | 拔網路（offline）走 1 圈 | amber banner 出現，AI 走 fallback 不卡 |
| 4 | 接回網路 + reset 走 1 圈 | banner 消失，state 重置乾淨 |
| 5 | 開 iOS Safari 私密模式跑 | localStorage 失敗走 memory fallback |
| 6 | reset + 用 `?reset=1` URL 起步 | counter 確認從 0/3 開始 |

## 驗收指標

- [ ] JS heap (Chrome devtool Memory) 30 min 後不持續增長（GC 後回到初始 ±10 MB 內）
- [ ] WebSocket 重連次數 < 5 次（看 console）
- [ ] localStorage 大小 < 1 MB（`JSON.stringify(localStorage).length` < 1_000_000）
- [ ] Tone.js 第 6 輪廣播仍能正常播放
- [ ] iPad mirror 1080p 投影機 layout 不破版
- [ ] 第二螢幕 RobotDisplaySync 在 6 輪後仍 sync 即時
- [ ] 拔線時 robot/command 回 503 顯示韌體上傳提示
- [ ] swipe-back 防呆持續有效（30 分鐘不退出 demo）

## 結果紀錄

### Dry run YYYY-MM-DD (執行人: ___)

- 總時長: ___
- 卡住的地方: ___
- JS heap 最終: ___ MB
- WS 重連次數: ___
- TODO: ___
