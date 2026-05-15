#!/usr/bin/env zsh
set -euo pipefail

echo "== Location =="
pwd

echo
echo "== Tools =="
which code || true
which pio || true
pio --version
python3 --version || true
brew --version | head -n 1 || true

echo
echo "== Board =="
pio boards uno_r4

echo
echo "== Project =="
test -f platformio.ini
test -f firmware/shared-command-demo/main.cpp
test -f include/commands.h
test -f firmware/shared-command-demo/commands.cpp
sed -n '1,80p' platformio.ini

echo
echo "== Build =="
pio run
