# App 1 比賽完整打磨設計

**日期**：2026-05-10  
**目標**：App 1「AI 自動板擦機器人」達到比賽水準，學生今天即可練習  
**範圍**：軟體修復 + AI 品質升級 + 學生練習材料，不動 firmware / server 架構

---

## 背景與問題

- `npm run check` 全過，build 正常，tour / DemoTimer 已有
- Gemini 挑戰找出 4 個崩點（切頁狀態丟失、AI 回答品質差、機器人無感、跨裝置連線）
- 學生等等就要練習，需要今天可用

---

## 設計方案（8 個 Chunk）

### Chunk 1 — Home 切頁狀態保留

**問題**：`Home.tsx` 的 `previewImage` / `analysis` / `ocrResult` / `transcript` 是 component local state。`App.tsx` 用 `AnimatePresence` + `lazy`，切頁時 Home unmount，全部清空。

**修法**：
- 在 `Home.tsx` 進入時從 `sessionStorage` 還原四個欄位
- 每次 state 更新時寫入 `sessionStorage`
- key：`app1:home:previewImage`、`app1:home:analysis`、`app1:home:ocrResult`、`app1:home:transcript`
- analysis 是 JSON，用 `JSON.stringify/parse`；previewImage 是 base64（可能大，若超過 quota 則靜默跳過）
- 不改 App.tsx，不用 global store，最小破壞

**驗收**：拍照分析 → 切到教師看板 → 切回首頁 → 圖片與分析結果仍在

---

### Chunk 2 — Demo 重置一鍵按鈕

**問題**：學生多輪練習時需要手動清 localStorage，流程破碎。

**修法**：
- `SystemSettingsPanel.tsx` 新增「重置練習資料」按鈕（放在設定面板底部，用 error 色警示）
- 點擊後：confirm 確認 → 清除以下資料：
  - `sessionStorage` 全部（app1:home:\*）
  - `localStorage` 中的 whiteboard-notes、classroom-session、whiteboard-chat、tour key
  - 呼叫 `/api/reset`（若 endpoint 存在）或靜默跳過
- 清除完成後 `window.location.reload()`，tour 重新啟動

**驗收**：按重置 → confirm → 頁面重整 → tour 重新出現 → 首頁空白

---

### Chunk 3 — AI 小老師本機品質升級

**問題**：`geminiService.ts` 的 `chatWithAI` fallback 只有 3 個 regex，回答品質差，學生問超出範圍的問題得到罐頭「AI 橋接無法連線」。

**修法**：
- 新建 `src/services/localChatTemplates.ts`，內含 60 組 `{keywords: string[], answer: string}` 模板
- 四大類：白板管理（15 組）、課堂節奏（15 組）、機器人操作（15 組）、系統說明（15 組）
- 實作 `matchTemplate(query: string): string`：
  - 將 query tokenize（中文字元切割 + 英文詞）
  - 對每個模板計算詞彙重疊分數（簡單 Jaccard，不用向量庫）
  - 分數 > 0 取最高分，=0 用通用回答
- `chatWithAI` catch block 改呼叫 `matchTemplate`
- 通用回答（無匹配時）：「你問的是關於「{query前10字}」。這套系統的核心是：AI 辨識白板 → 老師確認區塊 → 機器人執行擦除。有 Gemini API Key 時我能給更深入的解答。」

**驗收**：bridge 離線時問「機器人怎麼知道要擦哪裡」→ 得到有意義的完整回答（非罐頭）

---

### Chunk 4 — 機器人虛擬執行動畫

**問題**：無 Arduino 時按「送到機器人」，畫面沒有明顯的虛擬執行視覺，學生不知道有沒有成功。

**修法**：
- `TeacherDashboard.tsx`：送出機器人任務後，若 `result.ok === false`（展示備援），對應 region card 播放：
  1. 閃爍動畫（CSS keyframe，border 由 amber → green，2 次）
  2. 區塊右上角出現「⚡ 虛擬執行」badge，3 秒後消失
  3. 頂部橫幅顯示「虛擬機器人已完成 區塊 X 擦除（展示模式）」
- `RobotControl.tsx`：`activeFeedback` 在 `ok: false` 時加一段 3 秒 CSS 進度條動畫，模擬「機器人移動中」

**驗收**：無 Arduino 按「擦除 B 區」→ B 區卡片閃爍 → badge 出現 → 3 秒後消失

---

### Chunk 5 — 跨裝置 Bridge URL 設定

**問題**：Vite dev proxy 把 `/api` 導向 `localhost:3200`，平板連老師電腦時無法使用。

**修法**：
- `SystemSettingsPanel.tsx` 新增「橋接主機」輸入欄（預設空白 = 使用 Vite proxy）
- 儲存至 `localStorage` key `app1:bridgeHost`（例如 `192.168.1.5:3200`）
- `apiClient.ts` 新增 `getBridgeBase()` 函式：若有 bridgeHost，前綴 `http://bridgeHost`；否則使用相對路徑
- 所有 `apiRequest` 呼叫改透過 `getBridgeBase() + path`
- 設定面板顯示目前 bridge 狀態（online/offline ping）

**驗收**：設定橋接主機 `192.168.1.5:3200` → API 請求改打該 IP → bridge 狀態顯示 online

---

### Chunk 6 — 學生練習卡（App 內）

**問題**：學生靠 STUDENT_DEMO_GUIDE.md 練習，但要另開文件，不夠直覺。

**修法**：
- `Home.tsx` 底部新增可折疊的「📋 練習卡」區塊（預設展開，localStorage 記憶折疊狀態）
- 5 步驟 checklist（每步可打勾）：
  1. ✦ 拍下白板或使用範例內容，產生 AI 分析
  2. ✦ 到教師看板確認保留 / 可擦區塊
  3. ✦ 按「套用決策」保存
  4. ✦ 按「送到機器人」展示硬體（有無 Arduino 都可）
  5. ✦ 到紀錄本找到剛才的課堂筆記
- 全部打勾後顯示「🎉 你已完成完整流程！準備好上台了。」
- 勾選狀態存 sessionStorage（每次 Demo 重置會清除）

**驗收**：走完 5 步全打勾 → 出現完成訊息

---

### Chunk 7 — Tour 評審問答補強

**問題**：現有 tour demoTip 是操作說明，但學生需要的是「評審可能問什麼」的應對。

**修法**：
- `tourSteps.ts` 每個步驟的 `demoTip` 改為雙欄格式：「操作說明」+「評審問答快答」
- 新增 `reviewerQ?: string` 欄位，例：
  - welcome：「評審常問：這套系統解決什麼問題？→ 老師每天浪費課堂時間手動決定擦白板，我們用 AI 幫老師做這個判斷。」
  - robot-commands：「評審常問：沒有 Arduino 怎麼展示？→ 系統有展示模式，所有指令都會記錄，換上 Arduino 後同樣流程立即生效。」
- `TourOverlay.tsx` 顯示 `reviewerQ` 時用不同底色（amber）區隔

**驗收**：tour 每步都有評審問答提示，學生一邊走導覽一邊記答法

---

### Chunk 8 — npm run check 全過確認

所有修改完成後跑 `npm run check`（TypeScript + build + API contract + 測試），確保無回歸。

---

## 技術邊界

- 不動 `server/` 任何檔案（除非 Chunk 5 bridgeHost 需要 CORS header）
- 不新增 npm 套件（純 JS 實作 Jaccard）
- 不動 firmware / PlatformIO
- sessionStorage quota：previewImage 可能是大 base64，寫入前 try/catch，失敗靜默跳過

---

## 驗收清單

1. 切頁後回首頁，白板圖片和分析結果仍在
2. 設定面板一鍵重置，tour 重新啟動
3. bridge 離線時 AI 小老師給有意義回答（60 組模板）
4. 無 Arduino 送機器人任務，區塊閃爍 + 虛擬執行 badge
5. 設定橋接主機後 API 打指定 IP
6. 首頁練習卡 5 步驟打勾流程完整
7. Tour 每步有評審問答提示
8. `npm run check` 全過
