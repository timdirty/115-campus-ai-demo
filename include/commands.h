#pragma once

#include <Arduino.h>

void setupCommandHardware();
void printReadyMessage();
void handleCommand(const String &command);
