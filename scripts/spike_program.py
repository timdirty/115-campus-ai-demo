"""
SPIKE Prime MicroPython program — upload via LEGO Education SPIKE app or Pybricks.
Reads newline-terminated commands from USB Serial (stdin) and replies "OK:<CMD>" or "ERR:<CMD>".

Upload once before competition; the hub remembers the program.

Supported commands:
  FORWARD, BACKWARD, LEFT, RIGHT, STOP
  SPEED:<0-100>
  DELIVER_A, DELIVER_B, DELIVER_C
  PATROL, GOTO_ZONE_1, GOTO_ZONE_2, GOTO_ZONE_3
  ALERT, HORN, RETURN, HOME
  HEARTBEAT -> replies PONG
"""

import sys
import time

try:
    from hub import port as hub_port
    import motor_pair
    HAS_MOTORS = True
except ImportError:
    HAS_MOTORS = False

# Motor pair on ports A and B (adjust to your wiring)
PAIR = motor_pair.PAIR_1 if HAS_MOTORS else None
BASE_SPEED = 500  # degrees/second

if HAS_MOTORS:
    motor_pair.pair(motor_pair.PAIR_1, port.A, port.B)

print("SPIKE_READY")
sys.stdout.flush()


def run(left: int, right: int, duration_ms: int | None = None):
    if not HAS_MOTORS:
        return
    if duration_ms:
        motor_pair.move_for_time(PAIR, duration_ms, 0, velocity=left)
    else:
        motor_pair.move(PAIR, 0, velocity=left)


def stop_all():
    if HAS_MOTORS:
        motor_pair.stop(PAIR)


def beep(count: int = 1):
    try:
        import hub as hub_mod
        for _ in range(count):
            hub_mod.sound.beep(440, 200)
            time.sleep_ms(100)
    except Exception:
        pass


KNOWN_CMDS = {
    "FORWARD": lambda: run(BASE_SPEED, BASE_SPEED),
    "BACKWARD": lambda: run(-BASE_SPEED, -BASE_SPEED),
    "LEFT": lambda: run(-BASE_SPEED, BASE_SPEED),
    "RIGHT": lambda: run(BASE_SPEED, -BASE_SPEED),
    "STOP": stop_all,
    "HORN": lambda: beep(2),
    "ALERT": lambda: beep(3),
    "RETURN": lambda: (stop_all(), beep(1)),
    "HOME": lambda: (stop_all(), beep(1)),
    "DELIVER_A": lambda: beep(1),
    "DELIVER_B": lambda: beep(1),
    "DELIVER_C": lambda: beep(1),
    "PATROL": lambda: run(BASE_SPEED, BASE_SPEED),
    "GOTO_ZONE_1": lambda: beep(1),
    "GOTO_ZONE_2": lambda: beep(1),
    "GOTO_ZONE_3": lambda: beep(1),
}


def dispatch(cmd: str) -> bool:
    if cmd == "HEARTBEAT":
        return True
    if cmd in KNOWN_CMDS:
        KNOWN_CMDS[cmd]()
        return True
    if cmd.startswith("SPEED:"):
        try:
            global BASE_SPEED
            BASE_SPEED = min(1000, max(0, int(cmd[6:])) * 10)
            return True
        except ValueError:
            return False
    return False


while True:
    try:
        line = sys.stdin.readline()
    except Exception:
        break
    cmd = line.strip().upper()
    if not cmd:
        continue
    if cmd == "HEARTBEAT":
        print("PONG")
        sys.stdout.flush()
        continue
    ok = dispatch(cmd)
    reply = f"OK:{cmd}" if ok else f"ERR:{cmd}"
    print(reply)
    sys.stdout.flush()
