#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EV3_USER="robot"
EV3_HOSTS=("192.168.0.1" "ev3dev.local")
REMOTE_DIR="/home/robot/ev3-bridge"
SSH_OPTS="-o ConnectTimeout=5 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

log()  { echo "  [ev3-setup] $*"; }
ok()   { echo "  ✓ $*"; }
fail() { echo "  ✗ $*"; exit 1; }

echo ""
echo "=== EV3 One-Time Setup ==="
echo ""

# Step 1: Find EV3
log "Looking for EV3..."
EV3_HOST=""
for host in "${EV3_HOSTS[@]}"; do
  if ping -c1 -W2 "$host" &>/dev/null 2>&1; then
    EV3_HOST="$host"
    ok "Found EV3 at $host"
    break
  fi
done

if [[ -z "$EV3_HOST" ]]; then
  fail "EV3 not found at 192.168.0.1 or ev3dev.local. Is USB plugged in? Is EV3 powered on?"
fi

# Step 2: Clear stale known_hosts entry (handles reflashed SD cards)
ssh-keygen -R "$EV3_HOST" 2>/dev/null || true
ssh-keygen -R "ev3dev.local" 2>/dev/null || true

# Step 3: Test SSH
log "Testing SSH connection..."
if ! ssh $SSH_OPTS "${EV3_USER}@${EV3_HOST}" "echo ok" &>/dev/null; then
  fail "SSH failed. Make sure EV3 is running ev3dev and USB tethering is active."
fi
ok "SSH connection OK"

# Step 4: Deploy files
log "Deploying ev3-bridge files..."
ssh $SSH_OPTS "${EV3_USER}@${EV3_HOST}" "mkdir -p ${REMOTE_DIR}/vendor"
scp $SSH_OPTS "${REPO_ROOT}/ev3/ev3_server.py" "${EV3_USER}@${EV3_HOST}:${REMOTE_DIR}/"
if ls "${REPO_ROOT}/ev3/vendor/"*.whl &>/dev/null 2>&1; then
  scp $SSH_OPTS "${REPO_ROOT}/ev3/vendor/"*.whl "${EV3_USER}@${EV3_HOST}:${REMOTE_DIR}/vendor/"
fi
ok "Files deployed"

# Step 5: Install Python dependencies offline
log "Installing Python dependencies..."
ssh $SSH_OPTS "${EV3_USER}@${EV3_HOST}" "
  set -e
  if ! python3 -c 'import websockets' 2>/dev/null; then
    if ls ${REMOTE_DIR}/vendor/*.whl 2>/dev/null; then
      pip3 install --no-index --find-links=${REMOTE_DIR}/vendor websockets
    else
      pip3 install websockets
    fi
  fi
" && ok "Python dependencies OK" || fail "Failed to install websockets"

# Step 6: Install and enable systemd service
log "Installing systemd service..."
scp $SSH_OPTS "${REPO_ROOT}/ev3/ev3-bridge.service" "${EV3_USER}@${EV3_HOST}:/tmp/"
ssh $SSH_OPTS "${EV3_USER}@${EV3_HOST}" "
  sudo cp /tmp/ev3-bridge.service /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable ev3-bridge.service
  sudo systemctl restart ev3-bridge.service
"
ok "systemd service enabled and started"

# Step 7: Health check — wait for port 8765
log "Waiting for server to start..."
sleep 3
if ssh $SSH_OPTS "${EV3_USER}@${EV3_HOST}" "python3 -c \"
import socket, sys
s = socket.socket()
s.settimeout(3)
try:
  s.connect(('127.0.0.1', 8765))
  sys.exit(0)
except:
  sys.exit(1)
\""; then
  ok "Server is listening on port 8765"
else
  fail "Server not responding on port 8765. Check: ssh ${EV3_USER}@${EV3_HOST} 'journalctl -u ev3-bridge -n 20'"
fi

echo ""
echo "=== Setup complete! ==="
echo ""
echo "  EV3 will now auto-start the bridge on every boot."
echo "  Daily use: power on EV3 → plug USB → npm run dev"
echo ""
