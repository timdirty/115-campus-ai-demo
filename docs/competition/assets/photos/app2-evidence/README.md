# App 2 — 校園服務機器人 ｜ 現場照片與佐證

來源：Notion「🚗 App 2｜校園服務機器人｜Scratch + 流程圖」頁的「📸 現場照片與實作佐證整理區」。
這個資料夾把照片從 Notion S3 simply 簽署 URL 落地到 repo，讓 Notion Q&A 講稿頁可以用穩定的 GitHub raw URL 引用。

## 命名

| 檔案 | 來源 / 用途 |
|---|---|
| `00-handwritten-storyboard.png` | 手繪「四格操作故事」：① 建立任務 → ② 檢查電量 → ③ 安全配送 → ④ 收件確認 |
| `05-msg-1776843332287.jpg` | Arduino 雙馬達底盤 3D 設計（俯視，前方馬達） |
| `06-msg-1777450908508.jpg` | Arduino 雙馬達底盤 3D 設計（不同角度） |
| `07-msg-1777451588679.jpg` | 機器人收納箱體 3D 設計（含上蓋與螢幕區） |
| `08-msg-1777539233991.jpg` | 完整四輪 + 雙清掃滾筒底盤 3D 設計 |
| `09-S__76374032.jpg` | 3D 列印中：曲面托盤本體（Creality 印表機列印過程） |
| `10-S__77193223.jpg` | 3D 列印中：收納箱主體（夜間燈光照） |
| `11-screenshot-b2c32556.png` | 機器人組裝完成圖：底盤 + 收納櫃 + 螢幕 + 雙清掃滾輪（含右側單輪設計） |
| `12-screenshot-795e70b9.png` | 機器人組裝完成圖：箱體開門版本（無螢幕角度） |
| `13-IMG_8597.jpeg` | 比賽桌面陳設：Arduino + 馬達 + 列印件 + iPad + 平板，旁邊放校園服務機器人 App |
| `14-IMG_8598.jpeg` | 學生實際使用筆電操作校園服務機器人 App（戴口罩、側面） |
| `15-demo-app2-classroom-tab.png` | Demo 站截圖：`/app2/` 教學閉環首頁（101 教室 / 歷史課、AI 掃描、教室即時影像） |
| `16-demo-app2-manual-control.png` | Demo 站截圖：手動遙控中心彈窗（前後左右停止、底盤速度、掃地滾筒） |
| `17-demo-app2-robot-display.png` | Demo 站截圖：`/app2/robot-display.html` 機器人臉部第二螢幕（HAPPY 表情、表情快捷鍵） |

## 不公開的照片

`PRIVATE-*` 開頭的檔案含學生臉部可辨識的訓練照片，已加進 `.gitignore`、不會 push 到公開 repo。
若 Q&A 頁要參照這幾張，請用 Notion 內部連結指向 Scratch 頁的原始上傳，而不是 GitHub raw URL。

## 引用方式

Notion 頁直接用 `![](https://raw.githubusercontent.com/timdirty/115-campus-ai-demo/main/docs/competition/assets/photos/app2-evidence/<filename>)`。
照片若需更換、新增、刪除，先改檔案 + 更新本表，再去 Notion 更新引用。
