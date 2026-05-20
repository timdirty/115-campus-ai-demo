#!/usr/bin/env bash
# Pre-competition health check — run this 5 minutes before judging starts.
# Usage: ./scripts/pre-competition-check.sh [--kill-ports]
# Exit 0 = all green. Exit 1 = something needs fixing.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KILL_PORTS=0
for arg in "$@"; do [[ "$arg" == "--kill-ports" ]] && KILL_PORTS=1; done

OK=0; WARN=0; FAIL=0
pass() { echo "  ✅  $1"; OK=$((OK+1)); }
warn() { echo "  ⚠️   $1"; WARN=$((WARN+1)); }
fail() { echo "  ❌  $1"; FAIL=$((FAIL+1)); }

echo ""
echo "=== Pre-Competition Health Check ==="
echo ""

# 1. Free stale bridge ports
echo "--- Bridge Ports (3201/3202/3203) ---"
for port in 3201 3202 3203; do
  pids=$(lsof -ti ":$port" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    if [[ $KILL_PORTS -eq 1 ]]; then
      kill -9 $pids 2>/dev/null || true
      pass "Port :$port  cleared stale pid(s) $pids"
    else
      warn "Port :$port  is occupied by pid(s) $pids — run with --kill-ports to clear"
    fi
  else
    pass "Port :$port  free"
  fi
done

# 2. Node/npm
echo ""
echo "--- Runtime ---"
if command -v node &>/dev/null; then
  pass "node $(node --version)"
else
  fail "node not found"
fi
if command -v npx &>/dev/null; then
  pass "npx available"
else
  fail "npx not found"
fi

# 3. Dependencies installed for all 3 apps
echo ""
echo "--- npm install status ---"
for app_dir in \
  "google ai studio/app_1（國小）/AI自動板擦機器人" \
  "google ai studio/app_2（國小）/校園服務機器人 app" \
  "google ai studio/app_3（國中）/AI校園心靈守護者"; do
  full="$ROOT/$app_dir"
  if [[ -d "$full/node_modules" ]]; then
    pass "$(basename "$app_dir")  node_modules present"
  else
    fail "$(basename "$app_dir")  node_modules MISSING — run: (cd \"$full\" && npm install)"
  fi
done

# 4. Arduino / serial ports
echo ""
echo "--- Serial Ports ---"
serial_ports=$(ls /dev/cu.usbmodem* /dev/cu.usbserial* 2>/dev/null || true)
if [[ -n "$serial_ports" ]]; then
  for p in $serial_ports; do pass "Found: $p"; done
else
  warn "No Arduino-like serial ports detected — plug in Arduino and re-run"
fi

# 5. .env files
echo ""
echo "--- Environment Files ---"
for app_dir in \
  "google ai studio/app_1（國小）/AI自動板擦機器人" \
  "google ai studio/app_2（國小）/校園服務機器人 app" \
  "google ai studio/app_3（國中）/AI校園心靈守護者"; do
  full="$ROOT/$app_dir"
  if [[ -f "$full/.env" || -f "$full/.env.local" ]]; then
    pass "$(basename "$app_dir")  .env present"
  else
    warn "$(basename "$app_dir")  no .env — AI features may fall back to local mode"
  fi
done

# 6. Quick TypeScript check (just tsc, skip build for speed)
echo ""
echo "--- TypeScript (fast check) ---"
for app_dir in \
  "google ai studio/app_1（國小）/AI自動板擦機器人" \
  "google ai studio/app_2（國小）/校園服務機器人 app" \
  "google ai studio/app_3（國中）/AI校園心靈守護者"; do
  full="$ROOT/$app_dir"
  if (cd "$full" && npx tsc --noEmit 2>&1 | grep -q "error TS"); then
    fail "$(basename "$app_dir")  TypeScript errors found"
  else
    pass "$(basename "$app_dir")  TypeScript OK"
  fi
done

# Summary
echo ""
echo "==================================="
echo "  ✅  $OK passed   ⚠️   $WARN warnings   ❌  $FAIL failed"
echo "==================================="
echo ""
if [[ $FAIL -gt 0 ]]; then
  echo "Fix failures before starting the demo."
  exit 1
elif [[ $WARN -gt 0 ]]; then
  echo "Warnings present — demo can proceed but hardware may be limited."
  exit 0
else
  echo "All checks passed. Start bridges with: ./scripts/start-all-bridges.sh"
  exit 0
fi
