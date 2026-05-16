#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"
APP_DIR="$(pwd)"
RUNTIME_DIR="$APP_DIR/.demo-runtime"
mkdir -p "$RUNTIME_DIR"

BRIDGE_PORT=3202
BRIDGE_PID=""
WEB_PID=""

cleanup() {
  if [ -n "$WEB_PID" ] && kill -0 "$WEB_PID" >/dev/null 2>&1; then
    kill "$WEB_PID" >/dev/null 2>&1 || true
  fi
  if [ -n "$BRIDGE_PID" ] && kill -0 "$BRIDGE_PID" >/dev/null 2>&1; then
    kill "$BRIDGE_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

echo "==> 清理舊的 App2 bridge (:${BRIDGE_PORT})"
# macOS-portable kill (沒用 GNU xargs -r)
OLD_BRIDGE_PIDS="$(lsof -ti:$BRIDGE_PORT 2>/dev/null || true)"
if [ -n "$OLD_BRIDGE_PIDS" ]; then
  for pid in $OLD_BRIDGE_PIDS; do
    if ps -p "$pid" -o command= 2>/dev/null | grep -q 'tsx server/serialBridge'; then
      kill -9 "$pid" 2>/dev/null || true
      echo "  killed pid $pid"
    fi
  done
fi

echo "==> 找 vite 可用 port"
VITE_PORT=3000
while lsof -ti:$VITE_PORT >/dev/null 2>&1; do
  VITE_PORT=$((VITE_PORT+1))
  if [ $VITE_PORT -gt 3010 ]; then
    echo "❌ 3000-3010 都被占用，請手動關閉佔用程式後再試"
    exit 1
  fi
done
echo "   vite will use :$VITE_PORT"

# 分別啟動 bridge 跟 vite（不走 npm run dev，因為 dev:web 寫死 --port=3000）
echo "==> 啟動 bridge"
npm run dev:bridge > "$RUNTIME_DIR/bridge.log" 2>&1 &
BRIDGE_PID=$!

echo "==> 啟動 vite (port=$VITE_PORT --strictPort)"
VITE_BIN="$APP_DIR/node_modules/.bin/vite"
if [ ! -x "$VITE_BIN" ]; then
  echo "vite 套件未安裝，跑 npm install 中..."
  npm install
fi
"$VITE_BIN" --port="$VITE_PORT" --host=0.0.0.0 --strictPort > "$RUNTIME_DIR/web.log" 2>&1 &
WEB_PID=$!

# 等 web 真的起來
echo "==> 等 web ready..."
WEB_READY="false"
for _ in {1..60}; do
  if curl -fsS "http://127.0.0.1:$VITE_PORT/" >/dev/null 2>&1; then
    WEB_READY="true"
    break
  fi
  sleep 0.25
done
if [ "$WEB_READY" != "true" ]; then
  echo "❌ Web ($VITE_PORT) 啟動失敗。Log:"
  tail -30 "$RUNTIME_DIR/web.log" 2>/dev/null || true
  exit 1
fi

# 等 bridge 真的起來（fail-fast — bridge 未 ready 不宣告成功）
echo "==> 等 bridge ready..."
BRIDGE_READY="false"
for _ in {1..60}; do
  if curl -fsS "http://127.0.0.1:$BRIDGE_PORT/api/health" >/dev/null 2>&1; then
    BRIDGE_READY="true"
    break
  fi
  sleep 0.25
done

if [ "$BRIDGE_READY" != "true" ]; then
  echo ""
  echo "❌ Bridge ($BRIDGE_PORT) 啟動失敗 — 不啟動 demo 避免現場崩潰。"
  echo "Bridge log (最後 30 行):"
  tail -30 "$RUNTIME_DIR/bridge.log" 2>/dev/null || true
  echo ""
  echo "可能原因：3202 port 被占、tsx 找不到、.env 缺 GEMINI_API_KEY 等。"
  echo "請排除後重跑 一鍵啟動展示.command"
  # cleanup 會自動 trap 觸發 kill web + bridge
  exit 1
fi

MAIN_URL="http://localhost:$VITE_PORT/?reset=1"
BRIDGE_URL="http://localhost:$BRIDGE_PORT/api/health"
DISPLAY_URL="http://localhost:$VITE_PORT/robot-display.html?bridge=localhost:$BRIDGE_PORT"

echo ""
echo "✓ App2 已啟動（web + bridge 都已通過 health check）"
echo "✓ 主畫面     : $MAIN_URL"
echo "✓ Bridge API : $BRIDGE_URL"
echo "✓ 第二螢幕   : $DISPLAY_URL"
echo ""
echo "按 Ctrl+C 停止，或執行 一鍵停止展示.command"

open "$MAIN_URL" 2>/dev/null || true

wait $WEB_PID
