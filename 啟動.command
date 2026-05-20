#!/bin/bash
# ╔══════════════════════════════════════════════╗
# ║  115 資通訊競賽 — 一鍵啟動（Mac 版）         ║
# ║  雙擊此檔案即可啟動三組 App                   ║
# ╚══════════════════════════════════════════════╝

# 切到檔案所在目錄（雙擊時 working dir 可能是 Home）
cd "$(dirname "$BASH_SOURCE")" || { echo "❌ 無法切換目錄"; read -r; exit 1; }

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  115 資通訊 — 一鍵啟動三組 App              ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── 檢查 Node.js ──
if ! command -v node &>/dev/null; then
  echo "❌ 找不到 Node.js！"
  echo ""
  echo "請先安裝 Node.js 20+："
  echo "  https://nodejs.org/zh-tw/download/"
  echo ""
  open "https://nodejs.org/zh-tw/download/"
  read -rp "安裝完後按 Enter 重試..."
  if ! command -v node &>/dev/null; then
    echo "仍找不到 node，請重新開啟 Terminal 後再試。"
    read -r; exit 1
  fi
fi

NODE_VER=$(node --version)
echo "✅ Node.js $NODE_VER 已就緒"

# ── 安裝依賴（第一次需要網路，之後幾秒）──
echo ""
echo "📦 安裝依賴中（第一次約需 1-3 分鐘）..."
if ! node scripts/setup-all.mjs; then
  echo "❌ 依賴安裝失敗，請確認網路並重試。"
  read -r; exit 1
fi

# ── 啟動所有 App ──
echo ""
echo "🚀 啟動三組 App（5 秒後自動開啟瀏覽器）..."
echo ""
echo "   App 1 (AI 自動板擦機器人) → http://localhost:11501"
echo "   App 2 (校園服務機器人)     → http://localhost:11502"
echo "   App 3 (AI 校園心靈守護者)  → http://localhost:11503"
echo ""
echo "   關閉此視窗即可停止所有服務。"
echo "══════════════════════════════════════════════"
echo ""

node scripts/dev-all.mjs
