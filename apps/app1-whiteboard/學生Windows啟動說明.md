# App 1 學生 Windows 啟動說明

## 第一次使用（每台電腦只需做 1 次）

### 1. 安裝 Node.js 20 LTS 以上
- 雙擊 `一鍵啟動展示.bat`，如果電腦沒有 Node.js，會自動開啟下載頁。
- 下載 LTS 版本、一路按下一步安裝完成。
- 重新雙擊 `一鍵啟動展示.bat`。

### 2. 第一次啟動會自動裝套件
- 視窗會看到「第一次啟動需要安裝展示套件，請保持網路連線。」
- 需要 3-5 分鐘，請耐心等。完成後會自動開啟瀏覽器。

### 3.（老師端） Arduino 韌體預先燒好
- 學生 Windows 上**不**自動燒韌體（Windows 上要用 Zadig 裝 DFU driver 太複雜）。
- **老師請在自己的 Mac 上預先用 `pio run -e uno_r4_minima_app1_whiteboard_drive --target upload` 燒一次**，再把 Arduino 給學生。
- Windows 偵測到已燒好的 Arduino 後會直接連硬體模式。

---

## 每次展示

1. 接上 Arduino USB（**資料線、不是充電線**！）。
2. 雙擊 `一鍵啟動展示.bat`。
3. 等視窗出現「展示已開啟：http://127.0.0.1:3201/#whiteboard」，瀏覽器會自動跳。
4. 學生照畫面按鈕走流程。
5. 展示結束後，回到啟動視窗按 Enter，或雙擊 `一鍵停止展示.bat`。

---

## 上方狀態列要看哪裡

| Banner 樣式 | 意思 |
|------|------|
| 細細的 **綠色線條** | Arduino 已連上，硬體模式 |
| 紫色「**示範模式 · 所有功能均可完整體驗**」 | 沒接到 Arduino，所有按鈕都還能按，但機器人不會真的動 |

---

## Arduino 沒抓到怎麼辦？

腳本會在啟動時顯示三個檢查項：

1. **確認用「資料線」而非充電線** — 很多 USB 線只能充電不能傳資料
2. **確認 Windows 已安裝 Arduino UNO R4 USB driver**
   - 通常插上去 Windows 會自動裝
   - 沒有的話：[Arduino 官方驅動](https://www.arduino.cc/en/Guide/UnoR4WiFi)
3. **確認 firmware 已預先燒入**（找老師確認）

如果上面三個都做了還是沒抓到：
- 開「裝置管理員」→「連接埠 (COM 和 LPT)」→ 應該看到 `Arduino UNO R4 Minima (COM5)` 之類
- 沒看到代表 USB 連線/驅動有問題，不是程式問題

---

## 沒網路 / Gemini key 沒設定 → 還是能跑

App 內建本機 fallback：
- 看不到 Gemini 回應時會自動切到「本機備援解析」
- 不會跳錯誤訊息，demo 不中斷

---

## 老師端 demo 前一週 checklist

- [ ] 把整個 repo 解壓縮到學生電腦的「桌面 / Documents」（不要放有中文/空白特殊字元的路徑）
- [ ] 學生電腦上跑 `node -v` 確認有 Node.js 20+；沒有就裝
- [ ] 老師用 Mac 預先燒 firmware 到 Arduino
- [ ] 雙擊 `一鍵啟動展示.bat` 跑一次完整流程確認 OK
- [ ] 把 Arduino + 資料線 + 板擦機構放進展示包
- [ ] 教學生：插線 → 雙擊 .bat → 等綠燈 → 開始 demo
