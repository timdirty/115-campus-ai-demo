#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP1_DIR="${ROOT_DIR}/apps/app1-whiteboard"
APP2_DIR="${ROOT_DIR}/apps/app2-campus-service"
APP3_DIR="${ROOT_DIR}/apps/app3-guardian"

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
node scripts/verify-ev3-catalog.mjs
pio run

step "Ready"
cat <<'MSG'
All demo checks passed.

App 1 single-server demo:
  cd "apps/app1-whiteboard"
  npm run build
  BRIDGE_PORT=3200 NODE_ENV=production npm run start
  open http://localhost:3200

App 2 local demo:
  cd "apps/app2-campus-service"
  npm run dev
  open the Vite URL shown in the terminal

App 3 local demo:
  cd "apps/app3-guardian"
  npm run dev
  open the Vite URL shown in the terminal

Arduino upload:
  pio run -t upload
MSG
