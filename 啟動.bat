@echo off
chcp 65001 >nul
:: ╔══════════════════════════════════════════════╗
:: ║  115 資通訊競賽 — 一鍵啟動（Windows 版）     ║
:: ║  雙擊此檔案即可啟動三組 App                   ║
:: ╚══════════════════════════════════════════════╝

cd /d "%~dp0"

echo.
echo ╔══════════════════════════════════════════════╗
echo ║  115 資通訊 — 一鍵啟動三組 App              ║
echo ╚══════════════════════════════════════════════╝
echo.

:: ── 檢查 Node.js ──
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo ❌ 找不到 Node.js！
  echo.
  echo 請先安裝 Node.js 20+：
  echo   https://nodejs.org/zh-tw/download/
  echo.
  start https://nodejs.org/zh-tw/download/
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node --version') do set NODE_VER=%%v
echo ✅ Node.js %NODE_VER% 已就緒

:: ── 安裝依賴 ──
echo.
echo 📦 安裝依賴中（第一次約需 1-3 分鐘）...
node scripts\setup-all.mjs
if %errorlevel% neq 0 (
  echo ❌ 依賴安裝失敗，請確認網路並重試。
  pause
  exit /b 1
)

:: ── 啟動所有 App ──
echo.
echo 🚀 啟動三組 App（5 秒後自動開啟瀏覽器）...
echo.
echo    App 1 (AI 自動板擦機器人) -^> http://localhost:11501
echo    App 2 (校園服務機器人)     -^> http://localhost:11502
echo    App 3 (AI 校園心靈守護者)  -^> http://localhost:11503
echo.
echo    關閉此視窗即可停止所有服務。
echo ══════════════════════════════════════════════
echo.

node scripts\dev-all.mjs
pause
