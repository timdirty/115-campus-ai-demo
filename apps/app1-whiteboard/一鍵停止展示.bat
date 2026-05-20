@echo off
REM Windows 停止 App1 展示 — 殺掉 bridge port 3201 上的程序

setlocal
set "BRIDGE_PORT=3201"

echo 停止 App1 展示服務...

powershell -NoProfile -Command ^
  "$pids = Get-NetTCPConnection -LocalPort %BRIDGE_PORT% -ErrorAction SilentlyContinue | Where-Object State -eq Listen | Select-Object -ExpandProperty OwningProcess -Unique; if ($pids) { Write-Host ('停掉占用 port %BRIDGE_PORT% 的程序：' + ($pids -join ', ')); $pids | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } } else { Write-Host '沒有展示服務在跑。' }"

pause
