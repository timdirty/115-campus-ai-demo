# App2 校園服務機器人啟動包

## Mac

雙擊 `start-app2-mac.command`。

## Windows

雙擊 `start-app2-windows.bat`。

## 自動安裝

啟動器會盡量自動檢查並安裝：

- Node.js / npm
- App2 npm dependencies
- Python YOLO dependencies（Python、ultralytics、opencv-python、numpy）

本包已內建 `app2/yolov8n.pt`，Windows 沒網路時也不需要臨時下載 YOLO 模型。

如果系統無法自動安裝 Node.js，啟動器會開啟 Node.js 下載頁。

## Windows Arduino 連接

- UNO R4 插上 USB 後，系統會自動掃描 Arduino / USB Serial / CH340 / CP210x 類型的 COM port。
- 如果現場有多片板子或掃不到，請先在啟動前設定：`set ARDUINO_PORT=COM3`。

## 預設網址

- App2 前端：http://localhost:3000
- App2 bridge：http://localhost:3203
