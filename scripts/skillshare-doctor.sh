#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "== skillshare version =="
skillshare --version

echo
echo "== skillshare project status =="
skillshare status -p

echo
echo "== sync dry run =="
skillshare sync -p --dry-run --json

echo
echo "== hooks path =="
git config --get core.hooksPath || echo "(default .git/hooks)"
