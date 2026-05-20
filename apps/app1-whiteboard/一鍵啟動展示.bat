@echo off
REM Windows 學生雙擊啟動 App1 — 透過 PowerShell 執行共用 launch script
REM 對應 macOS 的 一鍵啟動展示.command

setlocal

REM 取得 .bat 所在目錄（去尾巴 backslash）
set "APP_DIR=%~dp0"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"

REM 推算 repo root（apps\app1-whiteboard\.. 的上一層）
for %%I in ("%APP_DIR%\..\..") do set "ROOT_DIR=%%~fI"

set "STUDENT_APP_DIR=%APP_DIR%"
set "STUDENT_APP_NAME=App 1 AI 自動板擦機器人"
set "STUDENT_BRIDGE_PORT=3201"
set "STUDENT_URL_PATH=/#whiteboard"
set "STUDENT_START_SCRIPT=start"

REM 用 ExecutionPolicy Bypass 避免學生因為 PS 政策被擋
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT_DIR%\scripts\student-launch-app.ps1"

REM 即使 PowerShell 結束也不立刻關 cmd 視窗，讓學生看到訊息
pause
