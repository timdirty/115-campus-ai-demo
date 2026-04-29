#include <Arduino.h>
#include "commands.h"
#include "matrix_show.h"

constexpr unsigned long serialStartupTimeoutMs = 3000;

void setup() {
  setupCommandHardware();
  setupMatrixShow();

  Serial.begin(115200);
  const unsigned long serialStartTime = millis();
  while (!Serial && millis() - serialStartTime < serialStartupTimeoutMs) {
  }

  printReadyMessage();
}

void loop() {
  updateMatrixShow();

  if (!Serial.available()) {
    return;
  }

  String command = Serial.readStringUntil('\n');
  command.trim();

  if (command.length() == 0) {
    return;
  }

  handleCommand(command);
}
