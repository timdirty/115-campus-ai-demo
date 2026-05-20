# App 3 Sensor Firmware

For App 3 國中 AI 校園心靈守護者 sensor node.

- PlatformIO envs: `uno_r4_wifi_sensor`, `uno_r4_minima`
- Main file: `src/app3_guardian_sensor/main.cpp`
- Hardware: HY-M302 / DHT11 / photoresistor / RGB LED
- Serial command: `READ_SENSORS`
- Serial output: `SENSORS:TEMP:XX.X,HUM:XX,LIGHT:XXXX`

Build or upload:

```bash
pio run -e uno_r4_wifi_sensor
pio run -e uno_r4_wifi_sensor -t upload
```
