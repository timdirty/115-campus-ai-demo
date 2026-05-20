# Arduino Cloud Integration Notes

This project is currently in local Serial Monitor mode. Keep this mode working while adding Arduino Cloud so hardware behavior can be tested without Wi-Fi or cloud credentials.

## Current Status

- Board id: `uno_r4_wifi`
- Local command entry point: `handleCommand(const String &command)` in `src/commands.cpp`
- Serial test entry point: `src/main.cpp`
- Secrets template: `include/arduino_secrets.example.h`
- Real secrets file, ignored by git: `include/arduino_secrets.h`

## Official References

- UNO R4 WiFi is supported by Arduino Cloud.
- PlatformIO board id is `uno_r4_wifi`.
- Arduino Cloud firmware commonly uses `ArduinoIoTCloud` and `Arduino_ConnectionHandler`.

Check current docs before implementation:

- https://support.arduino.cc/hc/en-us/articles/9398545261468-Use-UNO-R4-WiFi-with-Arduino-Cloud
- https://docs.arduino.cc/hardware/uno-r4-wifi/
- https://github.com/arduino-libraries/ArduinoIoTCloud
- https://docs.platformio.org/en/latest/boards/renesas-ra/uno_r4_wifi.html

## Planned Cloud Shape

Start with one Arduino Cloud variable:

```text
command: String, Read & Write, On change
```

The Cloud callback should call the same command handler used by Serial:

```cpp
void onCommandChange() {
  handleCommand(command);
}
```

This keeps local and cloud behavior aligned.

## PlatformIO Libraries To Add Later

Do not add these until you are ready to configure the Arduino Cloud Thing and credentials:

```ini
lib_deps =
    arduino-libraries/Servo@^1.3.0
    arduino-libraries/ArduinoIoTCloud@^2.9.0
    arduino-libraries/Arduino_ConnectionHandler@^1.2.0
```

Run this before choosing versions:

```zsh
pio pkg search "ArduinoIoTCloud"
pio pkg search "Arduino_ConnectionHandler"
```

## Implementation Checklist

1. Create a Thing in Arduino Cloud for Arduino UNO R4 WiFi.
2. Add a `command` variable in Arduino Cloud.
3. Save Device ID and Secret Key when Arduino Cloud provides them.
4. Copy `include/arduino_secrets.example.h` to `include/arduino_secrets.h`.
5. Fill Wi-Fi SSID, Wi-Fi password, and device secret.
6. Add Arduino Cloud libraries to `platformio.ini`.
7. Add `thingProperties.h` from Arduino Cloud generated code, then adapt it for PlatformIO.
8. Update `src/main.cpp` to call:
   - `initProperties()`
   - `ArduinoCloud.begin(ArduinoIoTPreferredConnection)`
   - `ArduinoCloud.update()` inside `loop()`
9. Keep Serial command input available as a fallback.
10. Run `pio run`, then upload and test both Serial and Cloud.

## Troubleshooting

- If Wi-Fi does not connect, verify SSID/password and update UNO R4 WiFi connectivity firmware with Arduino's official guide.
- If Cloud build fails, check library versions with `pio pkg search`.
- If callbacks do not fire, verify the Cloud variable permission is Read & Write and the update policy is On change.
