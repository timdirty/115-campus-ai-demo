# App 1 Drive Firmware

For App 1 白板機器人雙馬達控制.

- PlatformIO env: `uno_r4_minima_app1_whiteboard_drive`
- Main file: `firmware/app1-whiteboard-drive/main.cpp`
- Board: Arduino UNO R4 Minima
- Hardware: L293D Motor Shield v1, M3/M4 dual-motor drive
- Commands: `FORWARD`, `BACKWARD`, `LEFT`, `RIGHT`, `STOP`, `SPEED:<0-255>`

Build or upload:

```bash
pio run -e uno_r4_minima_app1_whiteboard_drive
pio run -e uno_r4_minima_app1_whiteboard_drive -t upload
```
