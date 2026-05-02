#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP1_DIR="${ROOT_DIR}/google ai studio/app_1（國小）/AI自動板擦機器人"
APP2_DIR="${ROOT_DIR}/google ai studio/app_2（國小）/校園服務機器人 app"
APP3_DIR="${ROOT_DIR}/google ai studio/app_3（國中）/AI校園心靈守護者"

step() {
  printf '\n== %s ==\n' "$1"
}

require_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required tool: $1" >&2
    exit 1
  fi
}

ensure_node_modules() {
  if [[ ! -d node_modules ]]; then
    npm install
  fi
}

step "Demo toolchain"
require_tool npm
require_tool pio
npm --version
pio --version

step "App 1: AI auto eraser robot"
cd "$APP1_DIR"
ensure_node_modules
npm run check

step "App 2: campus service robot"
cd "$APP2_DIR"
ensure_node_modules
npm run check

step "App 3: AI campus guardian"
cd "$APP3_DIR"
ensure_node_modules
npm run check

step "Arduino UNO R4 firmware"
cd "$ROOT_DIR"
node scripts/verify-command-catalog.mjs
pio run

step "Ready"
cat <<'MSG'
All demo checks passed.

App 1 single-server demo:
  cd "google ai studio/app_1（國小）/AI自動板擦機器人"
  npm run build
  BRIDGE_PORT=3200 NODE_ENV=production npm run start
  open http://localhost:3200

App 2 local demo:
  cd "google ai studio/app_2（國小）/校園服務機器人 app"
  npm run dev
  open the Vite URL shown in the terminal

App 3 local demo:
  cd "google ai studio/app_3（國中）/AI校園心靈守護者"
  npm run dev
  open the Vite URL shown in the terminal

Arduino upload:
  pio run -t upload
MSG
