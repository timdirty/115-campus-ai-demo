#pragma once

#include <ArduinoIoTCloud.h>
#include <Arduino_ConnectionHandler.h>
#include "arduino_secrets.h"
#include "commands.h"

const char DEVICE_LOGIN_NAME[] = "paste-device-id-here";

String command;

void onCommandChange();

WiFiConnectionHandler ArduinoIoTPreferredConnection(SECRET_SSID, SECRET_OPTIONAL_PASS);

void initProperties() {
  ArduinoCloud.setBoardId(DEVICE_LOGIN_NAME);
  ArduinoCloud.setSecretDeviceKey(SECRET_DEVICE_KEY);
  ArduinoCloud.addProperty(command, READWRITE, ON_CHANGE, onCommandChange);
}

void onCommandChange() {
  command.trim();
  if (command.length() > 0) {
    handleCommand(command);
  }
}
