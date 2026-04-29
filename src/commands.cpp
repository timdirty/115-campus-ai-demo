#include "commands.h"

#include "matrix_show.h"

#include <Servo.h>

namespace {
Servo servoD9;

void setStatusLed(bool enabled) {
  digitalWrite(LED_BUILTIN, enabled ? HIGH : LOW);
}
}

void setupCommandHardware() {
  pinMode(LED_BUILTIN, OUTPUT);
  setStatusLed(false);

  servoD9.attach(9);
  servoD9.write(90);
}

void printReadyMessage() {
  Serial.println("UNO R4 WiFi command test ready.");
  Serial.println("Commands: LED_ON, LED_OFF, SERVO_0, SERVO_90, SERVO_180, STOP, SHOW_ON, SHOW_OFF, FIREWORK, RESET, CLEAN_START, CLEAN_STOP, ERASE_ALL, ERASE_REGION_A, ERASE_REGION_B, ERASE_REGION_C, KEEP_REGION_A, KEEP_REGION_B, KEEP_REGION_C, PAUSE_TASK, DELIVERY_START, DELIVERY_DONE, CLEAN_SCHEDULE, BROADCAST_SCHEDULE, TEACH_SCAN, FOCUS_NUDGE, QUESTION_ACK, TEACH_REPLY, SAFETY_LOCKDOWN, SAFETY_CLEAR, BELL_REMIND_ON, BELL_REMIND_OFF, BROADCAST_START, PATROL_START, ROBOT_RESUME, ROBOT_PAUSE, SPEED_SET, NODE_HEARTBEAT, ALERT_SIGNAL, CARE_DEPLOYED, NODE_RESTART");
}

void handleCommand(const String &command) {
  if (command == "LED_ON") {
    setStatusLed(true);
    Serial.println("LED is ON.");
  } else if (command == "LED_OFF") {
    setStatusLed(false);
    Serial.println("LED is OFF.");
  } else if (command == "SERVO_0") {
    servoD9.write(0);
    Serial.println("Servo on D9 moved to 0 degrees.");
  } else if (command == "SERVO_90") {
    servoD9.write(90);
    Serial.println("Servo on D9 moved to 90 degrees.");
  } else if (command == "SERVO_180") {
    servoD9.write(180);
    Serial.println("Servo on D9 moved to 180 degrees.");
  } else if (command == "STOP") {
    setStatusLed(false);
    setMatrixShowEnabled(false);
    Serial.println("Stop command received. LED is OFF.");
  } else if (command == "SHOW_ON") {
    setMatrixShowEnabled(true);
    Serial.println("Matrix show is ON.");
  } else if (command == "SHOW_OFF") {
    setMatrixShowEnabled(false);
    Serial.println("Matrix show is OFF.");
  } else if (command == "FIREWORK") {
    triggerFireworks();
    Serial.println("Fireworks triggered.");
  } else if (command == "RESET") {
    resetMatrixShow();
    Serial.println("Matrix show reset.");
  } else if (command == "CLEAN_START") {
    setStatusLed(true);
    resetMatrixShow();
    Serial.println("Cleaning task started.");
  } else if (command == "CLEAN_STOP") {
    setStatusLed(false);
    triggerFireworks();
    Serial.println("Cleaning task finished.");
  } else if (command == "ERASE_ALL") {
    setStatusLed(true);
    setMatrixShowEnabled(false);
    servoD9.write(180);
    Serial.println("Erase all command received. Servo moved to 180 degrees.");
  } else if (command == "ERASE_REGION_A") {
    setStatusLed(true);
    triggerFireworks();
    servoD9.write(0);
    Serial.println("Erase region A command received. Servo moved to 0 degrees.");
  } else if (command == "ERASE_REGION_B") {
    setStatusLed(true);
    setMatrixShowEnabled(true);
    servoD9.write(90);
    Serial.println("Erase region B command received. Servo moved to 90 degrees.");
  } else if (command == "ERASE_REGION_C") {
    setStatusLed(true);
    triggerFireworks();
    servoD9.write(180);
    Serial.println("Erase region C command received. Servo moved to 180 degrees.");
  } else if (command == "KEEP_REGION_A") {
    setStatusLed(false);
    resetMatrixShow();
    servoD9.write(90);
    Serial.println("Keep region A command received. Matrix show reset.");
  } else if (command == "KEEP_REGION_B") {
    setStatusLed(false);
    setMatrixShowEnabled(false);
    servoD9.write(90);
    Serial.println("Keep region B command received. Servo returned to 90 degrees.");
  } else if (command == "KEEP_REGION_C") {
    setStatusLed(false);
    resetMatrixShow();
    servoD9.write(180);
    Serial.println("Keep region C command received. Servo moved to 180 degrees.");
  } else if (command == "PAUSE_TASK") {
    setStatusLed(false);
    setMatrixShowEnabled(false);
    servoD9.write(90);
    Serial.println("Robot task paused.");
  } else if (command == "DELIVERY_START") {
    setStatusLed(true);
    setMatrixShowEnabled(true);
    servoD9.write(45);
    Serial.println("Campus delivery task started.");
  } else if (command == "DELIVERY_DONE") {
    triggerFireworks();
    servoD9.write(90);
    Serial.println("Campus delivery task completed.");
  } else if (command == "CLEAN_SCHEDULE") {
    setStatusLed(true);
    servoD9.write(135);
    Serial.println("Cleaning schedule queued.");
  } else if (command == "BROADCAST_SCHEDULE") {
    setMatrixShowEnabled(true);
    Serial.println("Broadcast schedule queued.");
  } else if (command == "TEACH_SCAN") {
    setStatusLed(true);
    Serial.println("Teaching scan acknowledged.");
  } else if (command == "FOCUS_NUDGE") {
    triggerFireworks();
    Serial.println("Focus nudge signal sent.");
  } else if (command == "QUESTION_ACK") {
    setMatrixShowEnabled(true);
    Serial.println("Student question acknowledged.");
  } else if (command == "TEACH_REPLY") {
    setMatrixShowEnabled(true);
    Serial.println("Teacher reply delivered.");
  } else if (command == "SAFETY_LOCKDOWN") {
    setStatusLed(true);
    setMatrixShowEnabled(false);
    servoD9.write(0);
    Serial.println("Safety lockdown mode enabled.");
  } else if (command == "SAFETY_CLEAR") {
    setStatusLed(false);
    servoD9.write(90);
    Serial.println("Safety lockdown cleared.");
  } else if (command == "BELL_REMIND_ON") {
    setStatusLed(true);
    Serial.println("Bell reminder enabled.");
  } else if (command == "BELL_REMIND_OFF") {
    setStatusLed(false);
    Serial.println("Bell reminder disabled.");
  } else if (command == "BROADCAST_START") {
    setMatrixShowEnabled(true);
    Serial.println("Campus broadcast started.");
  } else if (command == "PATROL_START") {
    setStatusLed(true);
    servoD9.write(180);
    Serial.println("Campus patrol started.");
  } else if (command == "ROBOT_RESUME") {
    setStatusLed(true);
    Serial.println("Robot resumed.");
  } else if (command == "ROBOT_PAUSE") {
    setStatusLed(false);
    servoD9.write(90);
    Serial.println("Robot paused.");
  } else if (command == "SPEED_SET") {
    Serial.println("Speed setting received. Use app value for motor controller mapping.");
  } else if (command == "NODE_HEARTBEAT") {
    setStatusLed(true);
    Serial.println("Guardian node heartbeat received.");
  } else if (command == "ALERT_SIGNAL") {
    triggerFireworks();
    Serial.println("Guardian alert signal received.");
  } else if (command == "CARE_DEPLOYED") {
    setMatrixShowEnabled(true);
    Serial.println("Guardian care workflow deployed.");
  } else if (command == "NODE_RESTART") {
    setStatusLed(true);
    resetMatrixShow();
    Serial.println("Guardian node restart acknowledged.");
  } else {
    Serial.print("Unknown command: ");
    Serial.println(command);
    Serial.println("Use a supported Google AI Studio demo command from the app command catalog.");
  }
}
