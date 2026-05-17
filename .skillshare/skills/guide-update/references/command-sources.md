# Real Command Sources Per App

Use these to verify `hardware: []` entries in app-catalog.mjs.

## App1 — Whiteboard

**Firmware**: `firmware/app1-whiteboard-drive/main.cpp`  
**Bridge catalog**: `apps/app1-whiteboard/server/serialBridge.ts` (command dispatch table)  
**Real commands**: `ERASE_REGION_A`, `ERASE_REGION_B`, `ERASE_REGION_C`, `STOP`, `HEARTBEAT`

## App2 — Campus Service

**Firmware**: `firmware/app2-sweeper-drive/main.cpp`  
**Real motor commands** (from `switch(cmd)` in firmware):
```
FORWARD, BACKWARD, LEFT, RIGHT, STOP
SWEEP_START, SWEEP_STOP, SWEEP_REVERSE, SWEEP_SPEED
DELIVERY_START, DELIVERY_DONE
PATROL_START, BROADCAST_START
HEARTBEAT
```

**Soft/AI commands** (from `appState.ts` action names mapped to bridge):
- `TEACH_SCAN` — SET_ATTENDANCE_SCANNED action → sent when teacher clicks scan
- `TEACH_REPLY` — ADD_TEACHER_REPLY action → sent when AI reply resolves

**Vision dispatch commands** (from `localVision.ts` VISION_DEMO_SCRIPTS):
```
VISION_CROWD_BROADCAST
VISION_SAFETY_PATROL
VISION_CLEANING_PATROL
VISION_DELIVERY_SERVICE
VISION_NORMAL_PATROL
```

**WRONG commands** (do NOT use — never existed in this project):
- ~~TEACH_ATTENDANCE~~ (was EV3 era mistake)
- ~~DISPLAY_EMOTION~~
- ~~EV3_STOP~~
- ~~EV3_ARM_RETRACT~~

## App3 — Guardian

**Firmware (sensor)**: `firmware/app3-guardian-sensor/main.cpp`  
**Firmware (drive)**: `firmware/app3-guardian-drive/main.cpp`  
**Real drive commands**: `FORWARD`, `BACKWARD`, `LEFT`, `RIGHT`, `STOP`, `HEARTBEAT`  
**Sensor reports** (inbound from Arduino → app): check `server/serialBridge.ts` in app3

## Verification workflow

```bash
# Check firmware for real commands
grep -n "cmd ==" firmware/app2-sweeper-drive/main.cpp | head -30

# Check appState actions → bridge calls
grep -n "sendHardwareCommand\|TEACH_" apps/app2-campus-service/src/state/appState.ts

# Check vision scripts
grep -n "command\|VISION_" apps/app2-campus-service/src/services/localVision.ts
```
