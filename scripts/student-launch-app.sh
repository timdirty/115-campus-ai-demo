#!/bin/zsh
set -euo pipefail

# Reusable macOS student launcher.
# The per-app .command file supplies:
#   STUDENT_APP_DIR, STUDENT_APP_NAME, STUDENT_BRIDGE_PORT, STUDENT_URL_PATH

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="${STUDENT_APP_DIR:-}"
APP_NAME="${STUDENT_APP_NAME:-展示 App}"
BRIDGE_PORT="${STUDENT_BRIDGE_PORT:-}"
URL_PATH="${STUDENT_URL_PATH:-/}"
START_SCRIPT="${STUDENT_START_SCRIPT:-start}"
NODE_MAJOR_REQUIRED="${STUDENT_NODE_MAJOR_REQUIRED:-20}"
RUNTIME_DIR=""
APP_PID=""

pause_exit() {
  echo ""
  read "reply?按 Enter 關閉"
  exit "${1:-0}"
}

open_url() {
  if [[ "${STUDENT_NO_OPEN:-0}" == "1" ]]; then
    return 0
  fi
  open "$1" >/dev/null 2>&1 || true
}

cleanup() {
  if [[ -n "$APP_PID" ]] && kill -0 "$APP_PID" >/dev/null 2>&1; then
    kill "$APP_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

if [[ -z "$APP_DIR" || -z "$BRIDGE_PORT" ]]; then
  echo "啟動設定不完整，請確認 .command 有設定 STUDENT_APP_DIR 與 STUDENT_BRIDGE_PORT。"
  pause_exit 1
fi

cd "$APP_DIR"
RUNTIME_DIR="$APP_DIR/.demo-runtime"
mkdir -p "$RUNTIME_DIR"

clear 2>/dev/null || true
echo "=============================================="
echo "  $APP_NAME"
echo "  一鍵啟動展示"
echo "=============================================="
echo ""

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "這台電腦還沒有 Node.js / npm。"
  echo ""
  echo "請先安裝 Node.js ${NODE_MAJOR_REQUIRED} LTS 以上版本。"
  echo "我已幫你開啟下載頁，安裝完成後重新雙擊這個檔案即可。"
  echo ""
  open_url "https://nodejs.org/zh-tw/download/"
  pause_exit 1
fi

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || echo 0)"
if (( NODE_MAJOR < NODE_MAJOR_REQUIRED )); then
  echo "目前 Node.js 版本是 $(node --version)，需要 ${NODE_MAJOR_REQUIRED} 以上。"
  echo ""
  echo "請先更新 Node.js。安裝完成後重新雙擊這個檔案即可。"
  open_url "https://nodejs.org/zh-tw/download/"
  pause_exit 1
fi

echo "Node.js $(node --version) 已就緒"
echo "npm $(npm --version) 已就緒"

if [[ ! -f ".env.local" && -f ".env.example" ]]; then
  cp ".env.example" ".env.local"
  echo "已建立 .env.local"
fi

if [[ ! -d "node_modules" || "package-lock.json" -nt "node_modules/.package-lock.json" ]]; then
  echo ""
  echo "第一次啟動需要安裝展示套件，請保持網路連線。"
  npm install --prefer-offline --no-audit --no-fund
fi

echo ""
echo "準備展示頁面..."
npm run build

for pid_file in "$RUNTIME_DIR"/*.pid(N); do
  [[ -f "$pid_file" ]] || continue
  old_pid="$(cat "$pid_file")"
  if kill -0 "$old_pid" >/dev/null 2>&1; then
    kill "$old_pid" >/dev/null 2>&1 || true
  fi
  rm -f "$pid_file"
done

port_pids="$(lsof -tiTCP:"$BRIDGE_PORT" -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "$port_pids" ]]; then
  kill -9 ${(f)port_pids} >/dev/null 2>&1 || true
fi

echo ""
echo "啟動本機展示服務：http://127.0.0.1:$BRIDGE_PORT$URL_PATH"
BRIDGE_PORT="$BRIDGE_PORT" \
NODE_ENV=production \
DEMO_SIMULATE_HARDWARE="${DEMO_SIMULATE_HARDWARE:-1}" \
npm run "$START_SCRIPT" > "$RUNTIME_DIR/app.log" 2>&1 &
APP_PID=$!
echo "$APP_PID" > "$RUNTIME_DIR/app.pid"

READY="false"
for _ in {1..80}; do
  if curl -fsS "http://127.0.0.1:$BRIDGE_PORT/api/ready" >/dev/null 2>&1; then
    READY="true"
    break
  fi
  sleep 0.25
done

if [[ "$READY" != "true" ]]; then
  echo ""
  echo "展示服務啟動失敗，請把下面這段給老師或工程同學看："
  echo ""
  tail -60 "$RUNTIME_DIR/app.log" 2>/dev/null || true
  pause_exit 1
fi

DEMO_URL="http://127.0.0.1:$BRIDGE_PORT$URL_PATH"
open_url "$DEMO_URL"

echo ""
echo "展示已開啟：$DEMO_URL"
echo ""
echo "學生只需要照畫面操作；沒有接硬體時會自動使用展示模式。"
echo "展示中請不要關閉這個視窗。"
echo ""

if [[ "${STUDENT_AUTO_EXIT_AFTER_READY:-0}" == "1" ]]; then
  exit 0
fi

echo "展示結束後，回到這個視窗按 Enter 就會關閉展示。"
pause_exit 0
