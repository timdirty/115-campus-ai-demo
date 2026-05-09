#!/usr/bin/env python3
"""
EV3 WebSocket command server — runs ON the EV3 brick (ev3dev Linux).
Deploy: scp scripts/ev3_server.py robot@ev3dev.local:~/
Run:    python3 ~/ev3_server.py

Listens on ws://0.0.0.0:8765
Accepts newline-terminated command strings, replies "OK:<CMD>" or "ERR:<CMD>".

Supported commands (case-insensitive, reply is upper-cased):
  EV3_FORWARD, EV3_BACKWARD, EV3_LEFT, EV3_RIGHT, EV3_STOP
  EV3_SPEED:<0-100>
  EV3_DELIVER_A, EV3_DELIVER_B, EV3_DELIVER_C
  EV3_PATROL, EV3_GOTO_ZONE_1, EV3_GOTO_ZONE_2, EV3_GOTO_ZONE_3
  EV3_ALERT, EV3_HORN, EV3_RETURN, EV3_HOME
  HEARTBEAT  -> replies PONG
"""

import asyncio
import json
import re
import sys

try:
    import websockets
except ImportError:
    print("[ev3] websockets not found — pip3 install websockets", file=sys.stderr)
    sys.exit(1)

try:
    import ev3dev2.motor as motor_mod
    import ev3dev2.sound as sound_mod
    HAS_EV3 = True
except ImportError:
    HAS_EV3 = False
    print("[ev3] ev3dev2 not found — running in stub mode (replies OK but does nothing)")

PORT = 8765
BASE_SPEED = 50  # percent

# ---------------------------------------------------------------------------
# Motor helpers (no-op when ev3dev2 is absent)
# ---------------------------------------------------------------------------

def _make_tank():
    if not HAS_EV3:
        return None
    try:
        return motor_mod.MoveTank(motor_mod.OUTPUT_B, motor_mod.OUTPUT_C)
    except Exception as exc:
        print(f"[ev3] tank init failed: {exc}", file=sys.stderr)
        return None

_tank = _make_tank()


def _run(left_pct: float, right_pct: float, duration_ms: int | None = None):
    if not _tank:
        return
    if duration_ms:
        _tank.on_for_milliseconds(left_pct, right_pct, duration_ms)
    else:
        _tank.on(left_pct, right_pct)


def _stop():
    if _tank:
        _tank.off()


def _beep(count: int = 1):
    if not HAS_EV3:
        return
    try:
        spkr = sound_mod.Sound()
        for _ in range(count):
            spkr.beep()
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Command dispatch
# ---------------------------------------------------------------------------

def dispatch(cmd: str) -> bool:
    """Return True if command recognised, False otherwise."""
    if cmd == "HEARTBEAT":
        return True  # caller sends PONG
    if cmd == "EV3_FORWARD":
        _run(BASE_SPEED, BASE_SPEED)
    elif cmd == "EV3_BACKWARD":
        _run(-BASE_SPEED, -BASE_SPEED)
    elif cmd == "EV3_LEFT":
        _run(-BASE_SPEED, BASE_SPEED)
    elif cmd == "EV3_RIGHT":
        _run(BASE_SPEED, -BASE_SPEED)
    elif cmd == "EV3_STOP":
        _stop()
    elif cmd == "EV3_HORN":
        _beep(2)
    elif cmd in ("EV3_RETURN", "EV3_HOME"):
        _stop()
        _beep(1)
    elif cmd in ("EV3_DELIVER_A", "EV3_DELIVER_B", "EV3_DELIVER_C"):
        # Teams customise delivery sequences here
        _beep(1)
    elif cmd == "EV3_PATROL":
        _run(BASE_SPEED, BASE_SPEED)
    elif re.match(r"^EV3_GOTO_ZONE_\d+$", cmd):
        _beep(1)
    elif cmd == "EV3_ALERT":
        _beep(3)
    elif re.match(r"^EV3_SPEED:(\d+)$", cmd):
        m = re.match(r"^EV3_SPEED:(\d+)$", cmd)
        pct = min(100, max(0, int(m.group(1))))
        global BASE_SPEED
        BASE_SPEED = pct
    else:
        return False
    return True


# ---------------------------------------------------------------------------
# WebSocket handler
# ---------------------------------------------------------------------------

async def handler(websocket):
    remote = websocket.remote_address
    print(f"[ev3] client connected: {remote}")
    try:
        async for message in websocket:
            # ev3Manager sends JSON {id, type}; fall back to plain text for manual testing
            msg_id = None
            try:
                data = json.loads(message)
                msg_id = data.get("id")
                cmd = str(data.get("type", "")).strip().upper()
            except (json.JSONDecodeError, AttributeError):
                cmd = message.strip().upper()

            if not cmd:
                continue
            if cmd == "HEARTBEAT":
                await websocket.send(json.dumps({"id": msg_id, "ok": True, "response": "PONG"}))
                continue
            ok = dispatch(cmd)
            response = f"OK:{cmd}" if ok else f"ERR:UNKNOWN:{cmd}"
            print(f"[ev3] {cmd} -> {response}")
            await websocket.send(json.dumps({"id": msg_id, "ok": ok, "response": response}))
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        print(f"[ev3] client disconnected: {remote}")


async def main():
    print(f"[ev3] WebSocket server starting on ws://0.0.0.0:{PORT}")
    print(f"[ev3] ev3dev2 available: {HAS_EV3}")
    async with websockets.serve(handler, "0.0.0.0", PORT):
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    asyncio.run(main())
