#!/usr/bin/env bash
# Competition launcher: start all 3 Arduino bridges + optional simulation mode.
# Usage: ./scripts/start-all-bridges.sh [--sim]
# Ctrl+C stops everything cleanly.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
A1="$ROOT/apps/app1-whiteboard"
A2="$ROOT/apps/app2-campus-service"
A3="$ROOT/apps/app3-guardian"

SIM_MODE=0
for arg in "$@"; do
  [[ "$arg" == "--sim" ]] && SIM_MODE=1
done

if [[ $SIM_MODE -eq 1 ]]; then
  echo "🟡  Simulation mode — no real hardware needed"
  export DEMO_SIMULATE_HARDWARE=1
  export EV3_SIMULATE=1
  export SPIKE_SIMULATE=1
fi

PIDS=()
cleanup() {
  echo ""
  echo "Stopping all bridges..."
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
  exit 0
}
trap cleanup INT TERM

# Free any stale processes on our ports first
for port in 3201 3202 3203; do
  pids=$(lsof -ti ":$port" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    kill -9 $pids 2>/dev/null || true
    echo "  cleared stale process on :$port"
  fi
done

echo ""
echo "Starting App 1 bridge :3201  (白板機器人)..."
(cd "$A1" && BRIDGE_PORT=3201 NODE_ENV=production npx tsx server/serialBridge.ts 2>&1 | sed 's/^/[A1] /') &
PIDS+=($!)

echo "Starting App 2 bridge :3202  (配送機器人)..."
(cd "$A2" && BRIDGE_PORT=3202 npx tsx server/serialBridge.ts 2>&1 | sed 's/^/[A2] /') &
PIDS+=($!)

echo "Starting App 3 bridge :3203  (心靈守護者)..."
(cd "$A3" && BRIDGE_PORT=3203 npx tsx server/serialBridge.ts 2>&1 | sed 's/^/[A3] /') &
PIDS+=($!)

echo ""
echo "Waiting for bridges to initialise..."
# Poll until all 3 respond or 15s timeout
TIMEOUT=15
for port in 3201 3202 3203; do
  elapsed=0
  while ! curl -sf "http://localhost:$port/api/health" &>/dev/null; do
    sleep 1
    elapsed=$((elapsed+1))
    if [[ $elapsed -ge $TIMEOUT ]]; then
      echo "⚠  Bridge :$port did not respond within ${TIMEOUT}s"
      break
    fi
  done
done

echo ""
ALLOK=1
for port in 3201 3202 3203; do
  if curl -sf "http://localhost:$port/api/health" &>/dev/null; then
    ARDUINO=$(curl -sf "http://localhost:$port/api/health" | python3 -c "import sys,json; d=json.load(sys.stdin); print('arduino='+str(d.get('arduinoConnected',False)))" 2>/dev/null || echo "")
    echo "  ✅  :$port ready   $ARDUINO"
  else
    echo "  ❌  :$port not responding"
    ALLOK=0
  fi
done

echo ""
if [[ $ALLOK -eq 1 ]]; then
  echo "All bridges ready! Opening App 1 in browser..."
  open "http://localhost:5173" 2>/dev/null || xdg-open "http://localhost:5173" 2>/dev/null || true
  echo ""
  echo "App URLs (open with 'npm run dev' per app or use 'npm run dev:all'):"
  echo "  App1 (白板):  http://localhost:5173"
  echo "  App2 (配送):  http://localhost:5174"
  echo "  App3 (守護):  http://localhost:5175"
else
  echo "Some bridges failed. Check logs above."
fi

echo ""
echo "Press Ctrl+C to stop all bridges"
wait
