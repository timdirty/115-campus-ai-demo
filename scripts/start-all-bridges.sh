#!/usr/bin/env bash
# Start all three Arduino bridges. Ctrl+C stops all.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
A1="$ROOT/google ai studio/app_1（國小）/AI自動板擦機器人"
A2="$ROOT/google ai studio/app_2（國小）/校園服務機器人 app"
A3="$ROOT/google ai studio/app_3（國中）/AI校園心靈守護者"

PIDS=()
cleanup() {
  echo ""
  echo "Stopping all bridges..."
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
  exit 0
}
trap cleanup INT TERM

echo "🚀 Starting App 1 bridge on :3201..."
(cd "$A1" && BRIDGE_PORT=3201 NODE_ENV=production npx tsx server/serialBridge.ts 2>&1 | sed 's/^/[A1] /') &
PIDS+=($!)

echo "🚀 Starting App 2 bridge on :3202..."
(cd "$A2" && BRIDGE_PORT=3202 npx tsx server/serialBridge.ts 2>&1 | sed 's/^/[A2] /') &
PIDS+=($!)

echo "🚀 Starting App 3 bridge on :3203..."
(cd "$A3" && BRIDGE_PORT=3203 npx tsx server/serialBridge.ts 2>&1 | sed 's/^/[A3] /') &
PIDS+=($!)

echo "Waiting for bridges to start..."
sleep 3

echo ""
for port in 3201 3202 3203; do
  if curl -sf "http://localhost:$port/api/health" &>/dev/null; then
    echo "✅ Bridge :$port ready"
  else
    echo "❌ Bridge :$port not responding"
  fi
done

echo ""
echo "Press Ctrl+C to stop all bridges"
wait
