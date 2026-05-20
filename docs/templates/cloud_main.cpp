#include <Arduino.h>
#include <ArduinoIoTCloud.h>
#include <Arduino_ConnectionHandler.h>
#include "commands.h"
#include "thingProperties.h"

constexpr unsigned long serialStartupTimeoutMs = 3000;

void setup() {
  setupCommandHardware();

  Serial.begin(115200);
  const unsigned long serialStartTime = millis();
  while (!Serial && millis() - serialStartTime < serialStartupTimeoutMs) {
  }

  initProperties();
  ArduinoCloud.begin(ArduinoIoTPreferredConnection);
  printReadyMessage();
}

void loop() {
  ArduinoCloud.update();

  if (!Serial.available()) {
    return;
  }

  String localCommand = Serial.readStringUntil('\n');
  localCommand.trim();

  if (localCommand.length() == 0) {
    return;
  }

  handleCommand(localCommand);
}
