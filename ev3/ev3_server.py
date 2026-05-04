#!/usr/bin/env python3
"""EV3 WebSocket command server — runs on the EV3 brick via ev3dev."""
import asyncio
import json
import time
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'vendor'))

import websockets
from ev3dev2.motor import LargeMotor, MediumMotor, OUTPUT_A, OUTPUT_B, OUTPUT_C
from ev3dev2.motor import SpeedPercent, MoveTank

PORT = 8765
PEN_DOWN_POS = 90   # medium motor degrees: pen pressed to board
PEN_UP_POS   = 0    # medium motor degrees: pen lifted

_start_time = time.time()
_busy = False


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


async def dispatch(cmd: str) -> dict:
    global _busy

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

    if cmd == 'EV3_TEST':
        try:
            if med_motor:
                med_motor.run_to_abs_pos(position_sp=PEN_DOWN_POS, speed_sp=300, stop_action='hold')
                med_motor.wait_while('running', timeout=2000)
                await asyncio.sleep(0.3)
                med_motor.run_to_abs_pos(position_sp=PEN_UP_POS, speed_sp=300, stop_action='hold')
                med_motor.wait_while('running', timeout=2000)
            return {'ok': True, 'response': 'self-test passed'}
        except Exception as e:
            return {'ok': False, 'response': f'self-test failed: {e}'}

    if cmd == 'EV3_CALIBRATE':
        try:
            if med_motor: med_motor.reset()
            if large_a:   large_a.reset()
            if large_b:   large_b.reset()
            return {'ok': True, 'response': 'encoders reset'}
        except Exception as e:
            return {'ok': False, 'response': str(e)}

    if cmd == 'EV3_PEN_DOWN':
        try:
            if med_motor:
                med_motor.run_to_abs_pos(position_sp=PEN_DOWN_POS, speed_sp=300, stop_action='hold')
                med_motor.wait_while('running', timeout=2000)
            return {'ok': True, 'response': 'pen down'}
        except Exception as e:
            return {'ok': False, 'response': str(e)}

    if cmd == 'EV3_PEN_UP':
        try:
            if med_motor:
                med_motor.run_to_abs_pos(position_sp=PEN_UP_POS, speed_sp=300, stop_action='hold')
                med_motor.wait_while('running', timeout=2000)
            return {'ok': True, 'response': 'pen up'}
        except Exception as e:
            return {'ok': False, 'response': str(e)}

    if cmd == 'EV3_ARM_EXTEND':
        try:
            if large_a and large_b:
                large_a.on_for_seconds(SpeedPercent(50), 0.5)
                large_b.on_for_seconds(SpeedPercent(50), 0.5)
            return {'ok': True, 'response': 'arm extended'}
        except Exception as e:
            return {'ok': False, 'response': str(e)}

    if cmd == 'EV3_ARM_RETRACT':
        try:
            if large_a and large_b:
                large_a.on_for_seconds(SpeedPercent(-50), 0.5)
                large_b.on_for_seconds(SpeedPercent(-50), 0.5)
            return {'ok': True, 'response': 'arm retracted'}
        except Exception as e:
            return {'ok': False, 'response': str(e)}

    if cmd in ('EV3_STOP', 'EV3_CANCEL'):
        _busy = False
        stop_all()
        return {'ok': True, 'response': 'stopped'}

    if cmd in ('EV3_HOME', 'EV3_SAFE_POSE'):
        result = await dispatch('EV3_PEN_UP')
        if result['ok']:
            result = await dispatch('EV3_ARM_RETRACT')
        return {'ok': result['ok'], 'response': 'home' if result['ok'] else result['response']}

    if cmd == 'EV3_DRAW_LINE':
        if _busy:
            return {'ok': False, 'response': 'busy'}
        _busy = True
        try:
            for step in ('EV3_PEN_DOWN', 'EV3_ARM_EXTEND', 'EV3_PEN_UP'):
                r = await dispatch(step)
                if not r['ok']:
                    _busy = False
                    return {'ok': False, 'response': f'draw_line failed at {step}: {r["response"]}'}
            _busy = False
            return {'ok': True, 'response': 'line drawn'}
        except Exception as e:
            _busy = False
            return {'ok': False, 'response': str(e)}

    return {'ok': False, 'response': f'unknown command: {cmd}'}


async def handle(websocket):
    print(f"[ev3] client connected: {websocket.remote_address}", flush=True)
    try:
        async for raw in websocket:
            try:
                req = json.loads(raw)
                req_id = req.get('id', '')
                cmd = req.get('type', '')
                result = await dispatch(cmd)
                await websocket.send(json.dumps({'id': req_id, **result}))
            except Exception as e:
                await websocket.send(json.dumps({'id': '', 'ok': False, 'response': str(e)}))
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        stop_all()
        print("[ev3] client disconnected — motors stopped", flush=True)


async def main():
    print(f"[ev3] server starting on port {PORT}", flush=True)
    async with websockets.serve(handle, '0.0.0.0', PORT):
        print(f"[ev3] listening on 0.0.0.0:{PORT}", flush=True)
        await asyncio.Future()  # run forever


if __name__ == '__main__':
    asyncio.run(main())
