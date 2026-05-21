# App3 AI 校園心靈守護者啟動包

## Mac

雙擊 `start-app3-mac.command`。

## Windows

雙擊 `start-app3-windows.bat`。

## 自動安裝

啟動器會盡量自動檢查並安裝：

- Node.js / npm
- App3 npm dependencies
- Python 視覺 dependencies（Python、ultralytics、opencv-python、numpy、websockets、openai）

本包已內建 `app3/yolov8n.pt` 與 `robot-app/yolov8n.pt`，Windows 沒網路時也不需要臨時下載 YOLO 模型。

## Windows Arduino 連接

- UNO R4 插上 USB 後，系統會自動掃描 Arduino / USB Serial / CH340 / CP210x 類型的 COM port。
- 如果現場有多片板子或掃不到，請先在啟動前設定：`set ARDUINO_PORT=COM3`。
- App3 底盤板可另外指定：`set DRIVE_ARDUINO_PORT=COM4`。

## 預設網址

- App3 前端：http://localhost:11503
- App3 bridge：http://localhost:3203
- 機器人顯示：http://localhost:11503/robot-display.html
