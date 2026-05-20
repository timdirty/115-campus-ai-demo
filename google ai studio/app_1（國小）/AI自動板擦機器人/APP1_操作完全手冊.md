# App1「AI 自動板擦機器人」操作完全手冊

> **驗證日期**：2026-05-10　　**環境**：macOS, Node 25, tsx 4.21  
> **通過驗證**：`/api/health ✓` `/api/ready ✓` `npm run check ✓` `competition-readiness-check 6/6 ✓`

---

## 一、快速總覽

| 項目 | 說明 |
|------|------|
| 前端位置 | `google ai studio/app_1（國小）/AI自動板擦機器人/` |
| 本機單體版入口 | `http://localhost:3201`（build 後單 port） |
| 開發版入口 | `http://localhost:3000`（Vite）+ bridge `http://localhost:3201` |
| 比賽 GitHub Pages | `https://timdirty.github.io/115-campus-ai-demo/app1/` |
| Bridge port | **3201**（預設，可用 `.env.local` 改） |
| 無 Arduino | ✅ 保留指令 log，不中斷 |
| 無 Gemini key | ✅ 本機分析模板，不中斷 |
| Demo 計時器 | 右下角 3 分鐘倒計時，點一下開始 |

---

## 二、啟動方式（三選一）

### A：比賽現場——單體 Production 版（推薦）

```bash
cd "google ai studio/app_1（國小）/AI自動板擦機器人"
npm install            # 第一次或有新套件時執行
npm run build          # 大約 5–10 分鐘，建好後不用重建
npm run start          # bridge + 前端同一個 port 3201
```

瀏覽器開啟：`http://localhost:3201`

驗收指令：

```bash
curl http://localhost:3201/api/ready
# 回傳 {"ok":true, ...} 代表 OK
```

> ✅ 用 `npm run start` 不需要同時跑 Vite，前端靜態檔由 bridge 直接提供。

---

### B：跨裝置 LAN 展示（評審從 iPad 看）

```bash
npm run build
BRIDGE_PORT=3201 NODE_ENV=production npx tsx server/serialBridge.ts
```

主機 IP（例如 `192.168.1.50`）查詢方式：

```bash
# macOS
ipconfig getifaddr en0
```

評審平板/手機開啟：`http://192.168.1.50:3201`

> ✅ Bridge URL 自動依 `window.location.hostname` 偵測，**不需要手動改程式**。  
> ⚠️ 若防火牆擋住，macOS「系統設定 → 防火牆」暫時允許即可。

如需手動指定 bridge 主機（例如 bridge 跑在另一台電腦）：  
1. 開啟右上角齒輪⚙️ → 系統設定  
2. 「橋接主機」欄位填入 `192.168.x.x:3201`  
3. 重新整理頁面

---

### C：開發 / 即時修改版

```bash
npm run dev
```

- Vite 前端：`http://localhost:3000`
- Bridge：`http://localhost:3201`（`npm run dev:bridge` 已包含在 `npm run dev`）

---

## 三、連線狀態確認

### 頂部橫幅顏色說明

| 顏色 | 意義 | 說明 |
|------|------|------|
| 🟢 細綠線 | Arduino 已連線 | 硬體連線且最新版 firmware |
| 🟡 黃色橫幅 | Bridge 連線但無 Arduino | 指令會記錄，不送 Serial |
| 🔴 紅色橫幅 | Bridge 未連線 | 前端只用瀏覽器本機資料 |

> **比賽時不管顏色**——黃色和紅色都能完整展示 AI 分析、教師決策、紀錄本，機器人部分說「展示模式」即可。

### 快速排查

```bash
# bridge 是否在跑？
curl http://localhost:3201/api/health

# port 有沒有被占用？
lsof -i :3201

# 殺掉舊的 bridge（如果卡住）
pkill -f "tsx server/serialBridge"
```

---

## 四、Arduino UNO R4 WiFi 連線（有硬體時）

### 1. 燒錄 firmware

```bash
# 從 repo 根目錄
cd /Volumes/Tim\ aaddtional/Download/115資通訊/tedt
pio run -e uno_r4_minima_app1_whiteboard_drive  # 板擦雙馬達版本
```

> Firmware 位置：`src/app1_whiteboard_drive/main.cpp`，L293D M3/M4 馬達。

### 2. 確認連線

燒錄完插上 USB，橋幅應自動變綠。若沒有：

```bash
# 查詢 Serial port
ls /dev/cu.*

# 強制指定 port（修改 .env.local）
ARDUINO_PORT=/dev/cu.usbmodem1101
```

### 3. 校準白板區塊

1. 切到「機器人」分頁
2. 點「校準模式」
3. 先讓機器人走到 A 區中心，按「記錄 A」
4. 重複 B、C 區
5. 按「儲存校準」

> ⚠️ **Gemini 的 Fallback 區塊座標（A/B/C）是預設百分比，不代表你現場白板的實際位置。校準是必要步驟，不要跳過。**

---

## 五、Demo 主流程（3 分鐘）

按右下角計時器開始倒數。

### Step 1：首頁白板分析（60 秒）

| 操作 | 說明 |
|------|------|
| 點「開啟攝影機」| 授權後對準白板；沒攝影機可點「上傳圖片」或直接使用範例 |
| 選科目 | 下拉選單，如「數學、四年級」 |
| 點「拍照分析」| AI 分析白板；沒有 Gemini key 則自動走本機模板 |
| 查看結果 | 右側會出現 A/B/C 三個區塊建議（保留/可擦） |

**口語說法**：「AI 把白板切成幾個區塊，建議哪裡可以擦、哪裡要留給孩子繼續看。」

> 🔑 若 Gemini 分析成功，右上角會有 ✨ 標記；若走本機模板，右上角有 📱 標記——**兩個都能跑完全流程**。

---

### Step 2：教師看板決策（40 秒）

點底部「教師」分頁

| 操作 | 說明 |
|------|------|
| 查看班級狀態 | 專心度 / 需幫忙 / 需休息比例 |
| 點區塊卡片 | 可手動改「保留 → 可擦」或「可擦 → 保留」 |
| 點「套用決策」| 老師確認後儲存決策 |
| 點「送到機器人」| 把可擦區塊任務送出 |

**口語說法**：「AI 只是建議，老師這裡可以改。按確認後，任務才會送給機器人——保留人在迴路的控制。」

---

### Step 3：機器人執行（20 秒）

點底部「機器人」分頁

| 操作 | 說明 |
|------|------|
| 看「任務佇列」| 剛剛送出的任務出現在這裡 |
| 按「放煙火」| LED 矩陣播放動畫（展示亮點！） |
| 看「最近指令」| 無 Arduino 時也有完整 log |

**口語說法**：「現在如果沒接 Arduino，系統會保留指令紀錄；接上後同一個流程立刻生效。」

---

### Step 4：課堂紀錄本（20 秒）

點底部「紀錄本」分頁

| 操作 | 說明 |
|------|------|
| 點搜尋🔍（右上角） | 輸入「數學」即時搜尋 |
| 點剛剛的紀錄 | 開啟詳細內容 |
| 點「產生學習單」| 跳到複習分頁 |

---

### Step 5：AI 小老師 + 學習單（20 秒）

點底部「小老師」分頁，輸入問題如「二分之一怎麼解釋給小學生聽？」  
切到「學習單」分頁，自動產生學習單供評審看。

---

## 六、Tour 導覽功能

首次進入會自動開始導覽。可從右上角齒輪⚙️ → 「重看導覽」重新觸發。

導覽共 8 步，每步都有：
- **說法提示**：告訴你評審時怎麼講
- **評審常問 Q&A**：提前準備回答

| 步驟 | 分頁 | 重點 |
|------|------|------|
| 1. 歡迎 | 全螢幕 | 系統定位說明 |
| 2. 拍照與語音分析 | 白板 | 攝影機操作 |
| 3. 白板區塊決策 | 白板 | AI 建議區塊 |
| 4. 班級學習狀態 | 教師 | 班級數據 |
| 5. 區塊決策 | 教師 | 送機器人 |
| 6. 機器人指令面板 | 機器人 | LED 動畫 |
| 7. 課堂紀錄本 | 紀錄本 | 搜尋功能 |
| 8. 完成 | 全螢幕 | 結語 |

---

## 七、無 Arduino 展示話術

評審問「Arduino 呢？」：

> 「目前軟體端的任務、指令與紀錄都已打通。現場沒有連 Arduino 時，系統進入展示模式，指令記錄完整保存，換上硬體後相同流程立即生效。我們刻意保留這層備援設計，確保比賽現場硬體臨時出問題時，展示不會中斷。」

---

## 八、無 Gemini Key 展示話術

評審問「沒有 AI 分析的話？」：

> 「沒有 Gemini Key 時，系統走本機展示模式——白板整理、A/B/C 區塊建議、課堂筆記、學習單、AI 小老師，全部流程都能完整跑完，不會出錯誤訊息。正式部署給學校用時，由後端接 Gemini API，分析品質就會升級為真正的 AI 分析。」

---

## 九、現場故障備案

| 狀況 | 處理方式 |
|------|---------|
| Port 3201 被占用 | `pkill -f "tsx server/serialBridge"` 再重啟 |
| Bridge 沒起來 | 檢查 `npm run start` 有沒有跑；看 `/api/health` |
| 攝影機沒反應 | 瀏覽器允許攝影機權限；或改用「上傳圖片」模式 |
| 白板分析空白 | 點「使用範例內容」，本機 fallback 立即生效 |
| 機器人沒動作 | 看橫幅顏色；確認 Serial port；說「展示模式」 |
| 課堂資料壞掉 | 右上角⚙️ → 「匯入備份」；或點「重置展示資料」🔄 |
| 評審說「這是假的」| 強調「AI 建議 + 老師確認」的設計是刻意的安全設計 |

---

## 十、賽前清單

- [ ] `npm run build` 建好（看到 `✓ built`）
- [ ] `npm run start` 啟動，瀏覽器開 `http://localhost:3201`
- [ ] 頂部橫幅確認（顏色不影響展示，但要知道狀態）
- [ ] `curl http://localhost:3201/api/ready` 回傳 `ok: true`
- [ ] 點「重置展示資料」🔄，讓資料乾淨
- [ ] 點右上角「重看導覽」，練習一遍
- [ ] 右下角計時器按一下，確認 3 分鐘倒數正常
- [ ] 決定上台分工（建議 4 人各負責 1–2 個 tab）

---

## 十一、評審常問 Q&A

**Q：這套系統解決什麼問題？**  
A：老師每天上課都要花時間手動判斷「哪裡可以擦、哪裡要留到下節課」。我們用 AI 幫老師在 30 秒內做這個判斷，再由老師確認後送機器人執行，節省課堂中斷的時間。

**Q：AI 判斷準確嗎？**  
A：AI 是建議，老師有最終決策權。每個區塊都可以手動改，確保不會誤擦重要內容。這叫「人在迴路」設計。

**Q：沒有固定攝影機和即時定位，這樣完整嗎？**  
A：第一階段先解決最重要的事：白板內容保存、AI 協助判斷、老師確認、機器人依區塊執行。固定攝影機與即時定位是第二階段，會加在白板前方做座標校正。

**Q：這個成本多少？**  
A：硬體約 1,500 元（Arduino + 馬達 + 材料），軟體完全自製。比市售白板清潔設備便宜很多。

**Q：下一步計畫是什麼？**  
A：加入固定攝影機做白板座標校正，讓機器人定位更精準，實現閉環自動控制。

---

## 附錄：重要 API 快查

```bash
# 健康檢查
GET  http://localhost:3201/api/health

# 完整就緒狀態（比賽前確認用）
GET  http://localhost:3201/api/ready

# 匯出課堂資料
GET  http://localhost:3201/api/export

# 建立本機備份
POST http://localhost:3201/api/backup

# 機器人狀態
GET  http://localhost:3201/api/robot/status

# 送機器人指令
POST http://localhost:3201/api/robot/command
     Body: {"command": "ERASE_REGION_A"}
```

---

*最後更新：2026-05-10 | 通過 `npm run check` + competition-readiness-check 6/6 全過*
