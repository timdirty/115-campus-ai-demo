#!/bin/zsh
set -euo pipefail

APP_DIR="${STUDENT_APP_DIR:-}"
APP_NAME="${STUDENT_APP_NAME:-展示 App}"
BRIDGE_PORT="${STUDENT_BRIDGE_PORT:-}"

pause_exit() {
  echo ""
  read "reply?按 Enter 關閉"
  exit "${1:-0}"
}

if [[ -z "$APP_DIR" || -z "$BRIDGE_PORT" ]]; then
  echo "停止設定不完整，請確認 .command 有設定 STUDENT_APP_DIR 與 STUDENT_BRIDGE_PORT。"
  pause_exit 1
fi

RUNTIME_DIR="$APP_DIR/.demo-runtime"

clear 2>/dev/null || true
echo "正在關閉 $APP_NAME ..."
echo ""

if [[ -d "$RUNTIME_DIR" ]]; then
  for pid_file in "$RUNTIME_DIR"/*.pid(N); do
    [[ -f "$pid_file" ]] || continue
    old_pid="$(cat "$pid_file")"
    if kill -0 "$old_pid" >/dev/null 2>&1; then
      kill "$old_pid" >/dev/null 2>&1 || true
    fi
    rm -f "$pid_file"
  done
fi

port_pids="$(lsof -tiTCP:"$BRIDGE_PORT" -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "$port_pids" ]]; then
  kill -9 ${(f)port_pids} >/dev/null 2>&1 || true
fi

echo "展示已關閉。"
pause_exit 0
