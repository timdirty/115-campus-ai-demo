#!/bin/zsh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$APP_DIR/../.." && pwd)"

export STUDENT_APP_DIR="$APP_DIR"
export STUDENT_APP_NAME="App 1 AI 自動板擦機器人"
export STUDENT_BRIDGE_PORT="3201"
export STUDENT_URL_PATH="/#whiteboard"
export STUDENT_START_SCRIPT="start"

exec "$ROOT_DIR/scripts/student-launch-app.sh"
