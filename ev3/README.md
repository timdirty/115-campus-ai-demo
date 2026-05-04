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
