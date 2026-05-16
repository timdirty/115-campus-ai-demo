#!/usr/bin/env bash
echo "==> 停止 app2 (bridge :3202 + vite)"

# macOS-portable kill (避免 GNU-only xargs -r)
BRIDGE_PIDS="$(lsof -ti:3202 2>/dev/null || true)"
if [ -n "$BRIDGE_PIDS" ]; then
  for pid in $BRIDGE_PIDS; do
    kill -9 "$pid" 2>/dev/null || true
  done
fi

pkill -f "vite.*app2-campus-service" 2>/dev/null || true
pkill -f "tsx server/serialBridge" 2>/dev/null || true

# verify cleanup
sleep 1
REMAINING="$(lsof -ti:3202 2>/dev/null || true)"
if [ -n "$REMAINING" ]; then
  echo "⚠ port 3202 仍被占用 (pid: $REMAINING) — 可能要手動 kill"
else
  echo "✓ 停止完成"
fi

sleep 2
