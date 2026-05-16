# App3 Demo Soak Checklist

> 30 分鐘 / 比賽前一晚做。確認沒有累積性 bug。

## 環境

- [ ] Chrome / Safari devtools 開 Performance + Memory tab
- [ ] iPad mirror 投影機 + 第二螢幕（另一台裝置開 robot-app）
- [ ] Arduino UNO R4 (app3-guardian-drive 或 app3-guardian-sensor 韌體)（可選）
- [ ] `.env` 設好 `GEMINI_API_KEY`

## 30 分鐘流程（跑 5 輪、每 5-6 min 一輪）

每輪 = 完整跑一次 5-段閉環（訊號融合 → 預警成案 → 派遣處置 → 學生支持 → 回報結案）：

| 輪次 | 變化 | 觀察 |
|---|---|---|
| 1 | 點「開始示範」一鍵走完 | 5/5 完成 + robot-app 第二螢幕情緒切換 |
| 2 | 手動跑：開麥克風 + 點預警 + 派遣 + 對話 + 結案 | 每步觸發對應 demoClosureFlags |
| 3 | 拔網（offline） | amber banner 顯示「守護判讀走本機分析」，AI 走 fallback |
| 4 | 接回網 + 重置舞台 | banner 消失，counter 歸 0/5，第二螢幕 standby（無移動動畫）|
| 5 | 用 `?reset=1` URL 起步 + 立即派遣 | 確認 localStorage handshake + emotion lock 已清，不卡 |

## 驗收指標

- [ ] JS heap 30 min 後不持續增長
- [ ] WebSocket 重連次數 < 5 次（含 robot-app 第二螢幕）
- [ ] localStorage 大小 < 1 MB
- [ ] 第二螢幕 emotion 切換在 6 輪後仍 < 3 秒
- [ ] 第二螢幕 reset 後**立即**進 standby，無 5 秒移動動畫殘留（per Round 7 fix）
- [ ] iPad mirror 1080p 投影機 layout 不破版
- [ ] swipe-back 防呆持續有效
- [ ] iOS 私密模式跑可走完 5/5（memory fallback 接住）
- [ ] 學生發文沒回覆時 closure step 4 不被誤標完成（per Round 8 fix）
- [ ] AI 失敗 fallback 訊息 isFallback flag 生效，閉環不假完成
- [ ] guardian-chat AI 真實回 200（如有 GEMINI_API_KEY；無 key 接受 502 fallback）

## 結果紀錄

### Dry run YYYY-MM-DD (執行人: ___)

- 總時長: ___
- 5/5 跑滿 _ 輪 / 5 輪
- JS heap 最終: ___ MB
- WS 重連次數: ___
- 第二螢幕 emotion 切換平均延遲: ___ 秒
- TODO: ___
