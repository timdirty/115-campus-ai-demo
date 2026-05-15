#!/bin/zsh
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNTIME_DIR="$APP_DIR/.demo-runtime"

clear 2>/dev/null || true
echo "正在關閉校園服務機器人展示..."
echo ""

if [ -d "$RUNTIME_DIR" ]; then
  for pid_file in "$RUNTIME_DIR"/*.pid(N); do
    [ -f "$pid_file" ] || continue
    old_pid="$(cat "$pid_file")"
    if kill -0 "$old_pid" >/dev/null 2>&1; then
      kill "$old_pid" >/dev/null 2>&1 || true
    fi
    rm -f "$pid_file"
  done
fi

echo "展示已關閉。"
echo ""
read "reply?按 Enter 關閉"
