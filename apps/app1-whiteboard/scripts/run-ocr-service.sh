#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VENV_PY="$APP_DIR/.demo-runtime/ocr-venv/bin/python"

if [[ "${APP1_SKIP_OCR_INSTALL:-0}" != "1" ]]; then
  "$APP_DIR/scripts/setup-ocr-env.sh"
fi

if [[ -x "$VENV_PY" ]]; then
  exec "$VENV_PY" "$APP_DIR/server/ocr_service.py"
fi

exec python3 "$APP_DIR/server/ocr_service.py"
