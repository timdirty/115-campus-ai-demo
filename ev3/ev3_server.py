#!/usr/bin/env python3
"""EV3 WebSocket command server — runs on the EV3 brick via ev3dev.

Concurrency model:
  - handle() spawns a task per WS message, so STOP/CANCEL can arrive while a
    motion task is running.
  - Motion calls run inside asyncio.to_thread() so the event loop stays
    responsive. The active motion task is tracked at module scope; STOP
    calls stop_all() (which makes wait_while('running') return immediately
    inside the worker thread) and cancels the task.
"""
import asyncio
import json
import time
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'vendor'))

import websockets
from ev3dev2.motor import LargeMotor, MediumMotor, OUTPUT_A, OUTPUT_B, OUTPUT_C
from ev3dev2.motor import SpeedPercent

PORT = 8765
PEN_DOWN_POS = 90   # medium motor degrees: pen pressed to board
PEN_UP_POS   = 0    # medium motor degrees: pen lifted

_start_time = time.time()
_busy = False
_current_motion = None  # asyncio.Task | None — active motion, cancellable by STOP


def make_motors():
    try:
        med = MediumMotor(OUTPUT_C)
        large_a = LargeMotor(OUTPUT_A)
        large_b = LargeMotor(OUTPUT_B)
        return med, large_a, large_b
    except Exception as e:
        print(f"[ev3] motor init error: {e}", flush=True)
        return None, None, None


med_motor, large_a, large_b = make_motors()


def stop_all():
    try:
        if med_motor: med_motor.stop()
        if large_a:   large_a.stop()
        if large_b:   large_b.stop()
    except Exception:
        pass


# ── Blocking motion primitives (run inside asyncio.to_thread) ───────────────
def _pen_to(pos):
    if med_motor:
        med_motor.run_to_abs_pos(position_sp=pos, speed_sp=300, stop_action='hold')
        med_motor.wait_while('running', timeout=2000)


def _arm(speed_pct):
    if large_a and large_b:
        large_a.on_for_seconds(SpeedPercent(speed_pct), 0.5)
        large_b.on_for_seconds(SpeedPercent(speed_pct), 0.5)


def _self_test():
    if med_motor:
        med_motor.run_to_abs_pos(position_sp=PEN_DOWN_POS, speed_sp=300, stop_action='hold')
        med_motor.wait_while('running', timeout=2000)
        time.sleep(0.3)
        med_motor.run_to_abs_pos(position_sp=PEN_UP_POS, speed_sp=300, stop_action='hold')
        med_motor.wait_while('running', timeout=2000)


# ── Motion dispatcher (cancellable) ─────────────────────────────────────────
async def _run_motion(cmd: str) -> dict:
    if cmd == 'EV3_PEN_DOWN':
        await asyncio.to_thread(_pen_to, PEN_DOWN_POS)
        return {'ok': True, 'response': 'pen down'}
    if cmd == 'EV3_PEN_UP':
        await asyncio.to_thread(_pen_to, PEN_UP_POS)
        return {'ok': True, 'response': 'pen up'}
    if cmd == 'EV3_ARM_EXTEND':
        await asyncio.to_thread(_arm, 50)
        return {'ok': True, 'response': 'arm extended'}
    if cmd == 'EV3_ARM_RETRACT':
        await asyncio.to_thread(_arm, -50)
        return {'ok': True, 'response': 'arm retracted'}
    if cmd == 'EV3_TEST':
        await asyncio.to_thread(_self_test)
        return {'ok': True, 'response': 'self-test passed'}
    if cmd == 'EV3_CALIBRATE':
        # Encoder reset is non-blocking, but keep here for the busy-lock semantics
        if med_motor: med_motor.reset()
        if large_a:   large_a.reset()
        if large_b:   large_b.reset()
        return {'ok': True, 'response': 'encoders reset'}
    if cmd in ('EV3_HOME', 'EV3_SAFE_POSE'):
        await asyncio.to_thread(_pen_to, PEN_UP_POS)
        await asyncio.to_thread(_arm, -50)
        return {'ok': True, 'response': 'home'}
    if cmd == 'EV3_DRAW_LINE':
        await asyncio.to_thread(_pen_to, PEN_DOWN_POS)
        await asyncio.to_thread(_arm, 50)
        await asyncio.to_thread(_pen_to, PEN_UP_POS)
        return {'ok': True, 'response': 'line drawn'}
    return {'ok': False, 'response': f'unknown command: {cmd}'}


# ── Top-level dispatch (busy gate, preemptive STOP) ─────────────────────────
async def dispatch(cmd: str) -> dict:
    global _busy, _current_motion

    # Preemptive: STOP / CANCEL — always allowed, cancels in-flight motion
    if cmd in ('EV3_STOP', 'EV3_CANCEL'):
        stop_all()
        if _current_motion and not _current_motion.done():
            _current_motion.cancel()
            try:
                await _current_motion
            except (asyncio.CancelledError, Exception):
                pass
        _busy = False
        _current_motion = None
        return {'ok': True, 'response': 'stopped'}

    # Read-only — never blocked
    if cmd == 'EV3_STATUS':
        return {
            'ok': True,
            'response': json.dumps({
                'connected': True,
                'busy': _busy,
                'uptime': round(time.time() - _start_time),
                'penPos': med_motor.position if med_motor else None,
            })
        }

    # All other motion — reject if busy (enforces DRAW_LINE atomicity AND
    # blocks accidental concurrent PEN/ARM/TEST that would interfere)
    if _busy:
        return {'ok': False, 'response': 'busy'}

    _busy = True
    _current_motion = asyncio.create_task(_run_motion(cmd))
    try:
        return await _current_motion
    except asyncio.CancelledError:
        return {'ok': False, 'response': 'cancelled'}
    except Exception as e:
        return {'ok': False, 'response': str(e)}
    finally:
        _busy = False
        _current_motion = None


# ── WebSocket message handler ───────────────────────────────────────────────
async def _reply(websocket, req_id: str, cmd: str):
    try:
        result = await dispatch(cmd)
    except Exception as e:
        result = {'ok': False, 'response': str(e)}
    try:
        await websocket.send(json.dumps({'id': req_id, **result}))
    except Exception:
        pass


async def handle(websocket):
    print(f"[ev3] client connected: {websocket.remote_address}", flush=True)
    try:
        async for raw in websocket:
            try:
                req = json.loads(raw)
                req_id = req.get('id', '')
                cmd = req.get('type', '')
                # Spawn per-message task so STOP can arrive mid-motion
                asyncio.create_task(_reply(websocket, req_id, cmd))
            except Exception as e:
                try:
                    await websocket.send(json.dumps({'id': '', 'ok': False, 'response': str(e)}))
                except Exception:
                    pass
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        # Failsafe: stop motors and cancel any in-flight motion on disconnect
        stop_all()
        if _current_motion and not _current_motion.done():
            _current_motion.cancel()
        print("[ev3] client disconnected — motors stopped", flush=True)


async def main():
    print(f"[ev3] server starting on port {PORT}", flush=True)
    async with websockets.serve(handle, '0.0.0.0', PORT):
        print(f"[ev3] listening on 0.0.0.0:{PORT}", flush=True)
        await asyncio.Future()  # run forever


if __name__ == '__main__':
    asyncio.run(main())
