#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

git config core.hooksPath .githooks
chmod +x .githooks/post-checkout .githooks/post-merge .githooks/post-rewrite .githooks/pre-commit

echo "Installed repo-local git hooks via core.hooksPath=.githooks"
echo "Hooks:"
echo "  - pre-commit"
echo "  - post-checkout"
echo "  - post-merge"
echo "  - post-rewrite"
