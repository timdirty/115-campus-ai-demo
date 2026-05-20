#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v skillshare >/dev/null 2>&1; then
  echo "skillshare is not installed. Install it first, then retry." >&2
  exit 1
fi

if [ ! -f ".skillshare/config.yaml" ]; then
  echo "No .skillshare/config.yaml found in $ROOT_DIR" >&2
  exit 1
fi

skillshare sync -p "$@"
