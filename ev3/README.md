# EV3 Bridge — Teacher Setup Guide

## One-Time Setup

1. Download ev3dev image: https://www.ev3dev.org/downloads/
2. Flash to microSD with Balena Etcher
3. Insert microSD into EV3, power on
4. Connect USB cable from EV3 to Mac (USB Tethering mode — NOT Internet Sharing)
5. Run:
   ```bash
   bash scripts/ev3-setup.sh
   ```
6. Done. EV3 will auto-run the bridge server on every boot.

## Troubleshooting

```bash
bash scripts/ev3-diagnose.sh
```

## Daily Use

1. Power on EV3
2. Plug USB cable into Mac
3. `npm run dev` (App 1)
4. App shows "EV3 已連線 ✓"

## Cross-App Usage (App 2 / App 3)

The bridge auto-routes `EV3_*` commands. App 2 and App 3 can send EV3 commands
through their existing `sendHardwareCommand()` helper without any code change:

```ts
// App 2 example — drop a flag for delivery confirmation
await sendHardwareCommand('EV3_PEN_DOWN', 'delivery');

// App 3 example — physical alert (raise pen arm as visible signal)
await sendHardwareCommand('EV3_ARM_EXTEND', 'guardian-alert');
```

`STOP` is dual-sent to both Arduino and EV3 by the bridge — safety stops do
the right thing regardless of which app calls it.

## Future Extensions (preserved hooks, not yet implemented)

These are intentionally left as TODOs so the path stays open:

- **Sensor input** — EV3 ultrasonic / colour / gyro values can be added by
  extending `dispatch()` in `ev3_server.py` with new `EV3_READ_*` commands and
  registering them in `server/defaults.ts`.
- **Parameterised commands** — Use `command:value` syntax (e.g.
  `EV3_DRAW_STROKE:800` for an 800 ms stroke). `dispatch()` already receives
  the raw command string, so add a `cmd.split(':', 1)` branch.
- **Multi-EV3** — `ev3Manager.ts` is single-instance today. To support multiple
  bricks, change `ws` to a `Map<string, WebSocket>` keyed by host and add a
  `targetHost` arg to `sendEV3Command`.
- **EV3 sensor in App 3 guardian alerts** — App 3 already imports
  `hardwareBridge.ts`; sensor-driven alerts can call EV3 commands directly.
