#!/usr/bin/env bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
A1="$ROOT/google ai studio/app_1（國小）/AI自動板擦機器人"
A2="$ROOT/google ai studio/app_2（國小）/校園服務機器人 app"
A3="$ROOT/google ai studio/app_3（國中）/AI校園心靈守護者"

reset_via_api() {
  local port=$1 name=$2
  if curl -sf -X POST "http://localhost:$port/api/ops/reset" &>/dev/null; then
    echo "✅ $name reset via API"
    return 0
  fi
  return 1
}

reset_via_files() {
  local dir=$1 name=$2
  rm -f "$dir/data/"*.json 2>/dev/null || true
  echo "✅ $name data files cleared"
}

echo "🔄 Resetting all demo data..."
reset_via_api 3201 "App1" || reset_via_files "$A1" "App1"
reset_via_api 3202 "App2" || reset_via_files "$A2" "App2"
reset_via_api 3203 "App3" || reset_via_files "$A3" "App3"
echo "✅ All demo data reset"
