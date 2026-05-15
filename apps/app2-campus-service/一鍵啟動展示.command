#!/bin/zsh
set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"
RUNTIME_DIR="$APP_DIR/.demo-runtime"
mkdir -p "$RUNTIME_DIR"
APP_PID=""
ROBOT_PID=""

cleanup() {
  if [ -n "$APP_PID" ] && kill -0 "$APP_PID" >/dev/null 2>&1; then
    kill "$APP_PID" >/dev/null 2>&1 || true
  fi
  if [ -n "$ROBOT_PID" ] && kill -0 "$ROBOT_PID" >/dev/null 2>&1; then
    kill "$ROBOT_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

clear 2>/dev/null || true
echo "校園服務機器人展示啟動中..."
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
for candidate in 3000 3001 3002 3003; do
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

npm run dev:bridge > "$RUNTIME_DIR/robot.log" 2>&1 &
ROBOT_PID=$!
echo "$ROBOT_PID" > "$RUNTIME_DIR/robot.pid"

"$VITE_BIN" --port="$PORT" --host=127.0.0.1 --strictPort > "$RUNTIME_DIR/app.log" 2>&1 &
APP_PID=$!
echo "$APP_PID" > "$RUNTIME_DIR/app.pid"

APP_READY="false"
for _ in {1..40}; do
  if curl -fsS "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then
    APP_READY="true"
    break
  fi
  sleep 0.25
done

if [ "$APP_READY" != "true" ]; then
  echo "展示頁啟動失敗，請把下面這段給老師或工程同學看："
  echo ""
  tail -30 "$RUNTIME_DIR/app.log" 2>/dev/null || true
  echo ""
  read "reply?按 Enter 關閉"
  exit 1
fi

DEMO_URL="http://127.0.0.1:$PORT/#student"
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

echo "等瀏覽器自動開啟後，學生只要照畫面操作："
echo "1. 點智慧影像監控"
echo "2. 對準場景"
echo "3. 按下派遣"
echo ""
echo "展示網址：$DEMO_URL"
echo ""
echo "展示中請不要關閉這個視窗。"
echo "展示結束後，回到這個視窗按 Enter 就會關閉展示。"
echo ""
read "reply?按 Enter 關閉展示"
