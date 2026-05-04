#!/usr/bin/env bash
EV3_USER="robot"
SSH_OPTS="-o ConnectTimeout=5 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

pass() { echo "  ✓ $*"; }
fail() { echo "  ✗ $*"; }
info() { echo "  → $*"; }

echo ""
echo "=== EV3 Diagnostic Report ==="
echo ""

# 1. USB network interface
echo "[1] USB network interface"
if ifconfig 2>/dev/null | grep -q '192.168.0' || ip addr 2>/dev/null | grep -q '192.168.0'; then
  pass "USB network interface found (192.168.0.x)"
else
  fail "No 192.168.0.x interface — is USB cable plugged in?"
fi

# 2. Ping
echo ""
echo "[2] EV3 ping"
EV3_HOST=""
for host in 192.168.0.1 ev3dev.local; do
  if ping -c1 -W2 "$host" &>/dev/null; then
    pass "Ping $host OK"
    EV3_HOST="$host"
    break
  else
    fail "Ping $host failed"
  fi
done

if [[ -z "$EV3_HOST" ]]; then
  echo ""
  echo "Cannot continue — EV3 not reachable."
  exit 1
fi

# 3. SSH
echo ""
echo "[3] SSH connection to $EV3_HOST"
if ssh $SSH_OPTS "${EV3_USER}@${EV3_HOST}" "echo ok" &>/dev/null; then
  pass "SSH OK"
else
  fail "SSH failed"
  exit 1
fi

# 4. systemd service status
echo ""
echo "[4] ev3-bridge.service status"
STATUS=$(ssh $SSH_OPTS "${EV3_USER}@${EV3_HOST}" "systemctl is-active ev3-bridge.service 2>/dev/null || echo inactive")
if [[ "$STATUS" == "active" ]]; then
  pass "Service is active"
else
  fail "Service is $STATUS"
  info "Run: ssh ${EV3_USER}@${EV3_HOST} 'journalctl -u ev3-bridge -n 30'"
fi

# 5. Python websockets import
echo ""
echo "[5] Python websockets"
if ssh $SSH_OPTS "${EV3_USER}@${EV3_HOST}" "python3 -c 'import websockets; print(websockets.__version__)'" 2>/dev/null; then
  pass "websockets importable"
else
  fail "websockets not installed — run scripts/ev3-setup.sh"
fi

# 6. WebSocket port
echo ""
echo "[6] Port 8765 listening"
if ssh $SSH_OPTS "${EV3_USER}@${EV3_HOST}" \
   "ss -tlnp 2>/dev/null | grep -q ':8765' || netstat -tlnp 2>/dev/null | grep -q ':8765'"; then
  pass "Port 8765 is listening"
else
  fail "Port 8765 not listening"
fi

echo ""
echo "=== Done ==="
echo ""
