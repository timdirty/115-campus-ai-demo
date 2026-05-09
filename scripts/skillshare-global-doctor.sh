#!/usr/bin/env bash
set -euo pipefail

if ! command -v skillshare >/dev/null 2>&1; then
  echo "skillshare is not installed. Install it first, then retry." >&2
  exit 1
fi

echo "== skillshare version =="
skillshare --version

echo
echo "== global skillshare status =="
skillshare status -g

echo
echo "== global sync dry run =="
skillshare sync -g --dry-run --json
