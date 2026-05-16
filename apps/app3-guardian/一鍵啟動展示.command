#!/bin/zsh
set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"
RUNTIME_DIR="$APP_DIR/.demo-runtime"
mkdir -p "$RUNTIME_DIR"
APP_PID=""
BRIDGE_PID=""

cleanup() {
  if [ -n "$APP_PID" ] && kill -0 "$APP_PID" >/dev/null 2>&1; then
    kill "$APP_PID" >/dev/null 2>&1 || true
  fi
  if [ -n "$BRIDGE_PID" ] && kill -0 "$BRIDGE_PID" >/dev/null 2>&1; then
    kill "$BRIDGE_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

clear 2>/dev/null || true
echo "AI 校園心靈守護者展示啟動中..."
echo ""

if ! command -v npm >/dev/null 2>&1; then
  echo "這台電腦還沒有 npm，請先請老師安裝 Node.js。"
  echo ""
  read "reply?按 Enter 關閉"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "第一次啟動需要準備套件，請稍等。"
  npm install
fi

VITE_BIN="$APP_DIR/node_modules/.bin/vite"
if [ ! -x "$VITE_BIN" ]; then
  echo "展示工具還沒準備好，正在補齊套件，請稍等。"
  npm install
fi

for pid_file in "$RUNTIME_DIR"/*.pid(N); do
  [ -f "$pid_file" ] || continue
  old_pid="$(cat "$pid_file")"
  if kill -0 "$old_pid" >/dev/null 2>&1; then
    kill "$old_pid" >/dev/null 2>&1 || true
  fi
  rm -f "$pid_file"
done

PORT=""
for candidate in 3000 3001 3002 3003 3004 3005; do
  if ! lsof -iTCP:"$candidate" -sTCP:LISTEN -t >/dev/null 2>&1; then
    PORT="$candidate"
    break
  fi
done

if [ -z "$PORT" ]; then
  echo "目前展示網址都被占用，請先關掉其他展示視窗後再試一次。"
  echo ""
  read "reply?按 Enter 關閉"
  exit 1
fi

npm run dev:bridge > "$RUNTIME_DIR/bridge.log" 2>&1 &
BRIDGE_PID=$!
echo "$BRIDGE_PID" > "$RUNTIME_DIR/bridge.pid"

"$VITE_BIN" --port="$PORT" --host=0.0.0.0 --strictPort > "$RUNTIME_DIR/app.log" 2>&1 &
APP_PID=$!
echo "$APP_PID" > "$RUNTIME_DIR/app.pid"

APP_READY="false"
for _ in {1..60}; do
  if curl -fsS "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then
    APP_READY="true"
    break
  fi
  sleep 0.25
done

if [ "$APP_READY" != "true" ]; then
  echo "展示頁啟動失敗，請把下面這段給老師或工程同學看："
  echo ""
  tail -40 "$RUNTIME_DIR/app.log" 2>/dev/null || true
  echo ""
  read "reply?按 Enter 關閉"
  exit 1
fi

BRIDGE_READY="false"
for _ in {1..120}; do
  if curl -fsS "http://127.0.0.1:3203/api/health" >/dev/null 2>&1; then
    BRIDGE_READY="true"
    break
  fi
  sleep 0.25
done

# Fail-fast: bridge 必須 ready，否則 cleanup + exit 1（per codex-adv round 4）
if [ "$BRIDGE_READY" != "true" ]; then
  echo ""
  echo "❌ Bridge (:3203) 健康檢查超時 — 不開啟 demo 避免現場假啟動。"
  echo "Bridge log (最後 30 行):"
  tail -30 "$RUNTIME_DIR/bridge.log" 2>/dev/null || true
  echo ""
  echo "可能原因：3203 port 被占、tsx 找不到、.env 缺 GEMINI_API_KEY、firmware 未上傳。"
  echo "排除後重跑 一鍵啟動展示.command"
  # cleanup trap 會 kill web/bridge
  exit 1
fi

curl -fsS -X POST "http://127.0.0.1:3203/api/ops/reset" >/dev/null 2>&1 || true

DEMO_URL="http://127.0.0.1:$PORT/"
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
ROBOT_URL=""
if [ -n "$LAN_IP" ]; then
  ROBOT_URL="http://$LAN_IP:$PORT/robot-display.html?bridge=$LAN_IP:3203"
fi

open "$DEMO_URL"

osascript >/dev/null 2>&1 <<'APPLESCRIPT' || true
tell application "Google Chrome"
  if it is running and (count of windows) > 0 then
    set bounds of front window to {80, 40, 1380, 920}
  end if
end tell
tell application "Safari"
  if it is running and (count of windows) > 0 then
    set bounds of front window to {80, 40, 1380, 920}
  end if
end tell
APPLESCRIPT

echo "主控台已開啟：$DEMO_URL"
if [ -n "$ROBOT_URL" ]; then
  echo "iPad 第二螢幕網址：$ROBOT_URL"
else
  echo "iPad 第二螢幕：主控台按「機器人幕」即可開啟或掃 QR。"
fi
echo ""
echo "✓ Bridge 已啟動，舞台資料已重置。"
echo ""
echo "學生上台只做四件事："
echo "1. 先按「重置舞台」"
echo "2. 需要備援時按「開圖卡」或「機器人幕」"
echo "3. 按「開始示範」"
echo "4. 等閉環從 0/5 到 5/5"
echo ""
echo "展示中請不要關閉這個視窗。"
echo "展示結束後，回到這個視窗按 Enter 就會關閉展示。"
echo ""
read "reply?按 Enter 關閉展示"
