#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

BRIDGE_PORT=3202

echo "==> 清理舊的 App2 bridge (:${BRIDGE_PORT})"
lsof -ti:$BRIDGE_PORT 2>/dev/null | while read -r pid; do
  ps -p "$pid" -o command= | grep -q 'tsx server/serialBridge' && kill -9 "$pid"
done

VITE_PORT=3000
while lsof -ti:$VITE_PORT >/dev/null 2>&1; do
  VITE_PORT=$((VITE_PORT+1))
done

echo "==> 啟動 App2 bridge + Vite"
BRIDGE_PORT=$BRIDGE_PORT npm run dev -- --port $VITE_PORT &
DEV_PID=$!

sleep 5

MAIN_URL="http://localhost:$VITE_PORT"
BRIDGE_URL="http://localhost:$BRIDGE_PORT/api/health"
DISPLAY_URL="http://localhost:$VITE_PORT/robot-display.html?bridge=localhost:$BRIDGE_PORT"

echo "✓ App2 已啟動"
echo "主畫面: $MAIN_URL"
echo "Bridge API: $BRIDGE_URL"
echo "第二螢幕: $DISPLAY_URL"

open "$MAIN_URL"

wait $DEV_PID
