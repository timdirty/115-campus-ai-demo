#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VENV_DIR="$APP_DIR/.demo-runtime/ocr-venv"
REQ_FILE="$APP_DIR/requirements-ocr.txt"
STAMP_FILE="$VENV_DIR/.requirements-installed"

PYTHON_BIN=""
for candidate in python3.12 python3.11 python3.10 python3; do
  if ! command -v "$candidate" >/dev/null 2>&1; then
    continue
  fi
  if "$candidate" - <<'PY' >/dev/null 2>&1
import sys
raise SystemExit(0 if (3, 10) <= sys.version_info[:2] <= (3, 12) else 1)
PY
  then
    PYTHON_BIN="$candidate"
    break
  fi
done

if [[ -z "$PYTHON_BIN" ]]; then
  echo "找不到可用的 Python 3.10-3.12，白板文字辨識需要穩定 Python 版本。"
  exit 1
fi

mkdir -p "$(dirname "$VENV_DIR")"

if [[ ! -x "$VENV_DIR/bin/python" ]]; then
  echo "建立 App 1 白板 OCR 專用 Python 環境..."
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

if ! "$VENV_DIR/bin/python" -m pip --version >/dev/null 2>&1; then
  echo "重建 App 1 白板 OCR Python 環境..."
  rm -rf "$VENV_DIR"
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

if [[ ! -f "$STAMP_FILE" || "$REQ_FILE" -nt "$STAMP_FILE" ]]; then
  echo "安裝白板文字辨識套件，第一次會比較久..."
  "$VENV_DIR/bin/python" -m pip install --upgrade pip
  "$VENV_DIR/bin/python" -m pip install -r "$REQ_FILE"
  date -u +"%Y-%m-%dT%H:%M:%SZ" > "$STAMP_FILE"
fi

echo "白板 OCR Python 環境已就緒。"
