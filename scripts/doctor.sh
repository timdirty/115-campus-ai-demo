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
test -f src/main.cpp
test -f include/commands.h
test -f src/commands.cpp
sed -n '1,80p' platformio.ini

echo
echo "== Build =="
pio run
