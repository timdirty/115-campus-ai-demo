# App 3 Drive Firmware

For App 3 國中 AI 校園心靈守護者 four-wheel drive base.

- PlatformIO env: `uno_r4_wifi_app3_guardian_drive`
- Main file: `firmware/app3-guardian-drive/main.cpp`
- Board: Arduino UNO R4 WiFi
- Hardware: L293D, M1/M4 left side and M2/M3 right side
- Commands: `FORWARD`, `BACKWARD`, `LEFT`, `RIGHT`, `STOP`, `SPEED:<0-255>`, `PATROL_START`, `ROBOT_RESUME`, `ROBOT_PAUSE`

Build or upload:

```bash
pio run -e uno_r4_wifi_app3_guardian_drive
pio run -e uno_r4_wifi_app3_guardian_drive -t upload
```
