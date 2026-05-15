#include <Arduino.h>
#include <DHT.h>

namespace {
constexpr uint8_t dhtPin = 2;
constexpr uint8_t lightPin = A1;

constexpr uint8_t motorLatchPin = 12;
constexpr uint8_t motorClockPin = 4;
constexpr uint8_t motorEnablePin = 7;
constexpr uint8_t motorDataPin = 8;

constexpr uint8_t motor1PwmPin = 11;
constexpr uint8_t motor2PwmPin = 3;
constexpr uint8_t motor3PwmPin = 6;
constexpr uint8_t motor4PwmPin = 5;

// Per-motor polarity correction. Set to true when a motor's leads are wired
// such that "forward" actually spins the wheel backward. Flipping in firmware
// avoids re-soldering on the shield.
constexpr bool invertMotor1 = true;   // left  (wiring reversed)
constexpr bool invertMotor2 = true;   // right (wiring reversed)
constexpr bool invertMotor3 = false;  // right (wiring correct)
constexpr bool invertMotor4 = true;   // left  (wiring reversed)

DHT dht(dhtPin, DHT11);
uint8_t motorLatchState = 0;
uint8_t driveSpeed = 180;

// Watchdog: auto-STOP drive if no motion command or HEARTBEAT arrives within 3 s.
// Prevents motors from running indefinitely after a USB disconnect / app crash.
constexpr unsigned long watchdogMs = 3000;
bool watchdogArmed = false;
unsigned long watchdogLastMs = 0;

void setStatusLed(bool enabled) {
  digitalWrite(LED_BUILTIN, enabled ? HIGH : LOW);
}

int clampDriveSpeed(int value) {
  if (value < 0) return 0;
  if (value > 255) return 255;
  return value;
}

bool parseSpeedCommand(const String &command, uint8_t &outSpeed) {
  if (!command.startsWith("SPEED:")) {
    return false;
  }
  outSpeed = static_cast<uint8_t>(clampDriveSpeed(command.substring(6).toInt()));
  return true;
}

void writeMotorLatch() {
  digitalWrite(motorLatchPin, LOW);
  shiftOut(motorDataPin, motorClockPin, MSBFIRST, motorLatchState);
  digitalWrite(motorLatchPin, HIGH);
}

uint8_t motorPwmPin(uint8_t motor) {
  switch (motor) {
    case 1: return motor1PwmPin;
    case 2: return motor2PwmPin;
    case 3: return motor3PwmPin;
    case 4: return motor4PwmPin;
    default: return motor1PwmPin;
  }
}

void motorLatchBits(uint8_t motor, uint8_t &forwardBit, uint8_t &backwardBit) {
  switch (motor) {
    case 1:
      forwardBit = 2;
      backwardBit = 3;
      break;
    case 2:
      forwardBit = 1;
      backwardBit = 4;
      break;
    case 3:
      forwardBit = 5;
      backwardBit = 7;
      break;
    case 4:
      forwardBit = 0;
      backwardBit = 6;
      break;
    default:
      forwardBit = 2;
      backwardBit = 3;
      break;
  }
}

bool motorIsInverted(uint8_t motor) {
  switch (motor) {
    case 1: return invertMotor1;
    case 2: return invertMotor2;
    case 3: return invertMotor3;
    case 4: return invertMotor4;
    default: return false;
  }
}

void setMotor(uint8_t motor, int speed) {
  uint8_t forwardBit = 0;
  uint8_t backwardBit = 0;
  motorLatchBits(motor, forwardBit, backwardBit);

  const int adjustedSpeed = motorIsInverted(motor) ? -speed : speed;

  motorLatchState &= ~(1 << forwardBit);
  motorLatchState &= ~(1 << backwardBit);

  if (adjustedSpeed > 0) {
    motorLatchState |= (1 << forwardBit);
  } else if (adjustedSpeed < 0) {
    motorLatchState |= (1 << backwardBit);
  }

  writeMotorLatch();
  analogWrite(motorPwmPin(motor), abs(adjustedSpeed));
}

void setLeftSide(int speed) {
  setMotor(1, speed);
  setMotor(4, speed);
}

void setRightSide(int speed) {
  setMotor(2, speed);
  setMotor(3, speed);
}

void stopDriveMotors() {
  setLeftSide(0);
  setRightSide(0);
}

void tankDrive(int leftSpeed, int rightSpeed) {
  setLeftSide(leftSpeed);
  setRightSide(rightSpeed);
}

void armWatchdog() {
  watchdogArmed = true;
  watchdogLastMs = millis();
}

void disarmWatchdog() {
  watchdogArmed = false;
}

void printDriveStatus(const char *label) {
  Serial.print("DRIVE:");
  Serial.print(label);
  Serial.print(",SPEED:");
  Serial.println(driveSpeed);
}

void readSensors() {
  const float h = dht.readHumidity();
  const float t = dht.readTemperature();
  const int light = analogRead(lightPin);
  if (isnan(h) || isnan(t)) {
    Serial.println("SENSORS:ERR");
    return;
  }
  Serial.print("SENSORS:TEMP:");
  Serial.print(t, 1);
  Serial.print(",HUM:");
  Serial.print(static_cast<int>(h));
  Serial.print(",LIGHT:");
  Serial.println(light);
}

void printReadyMessage() {
  Serial.println("UNO R4 (WiFi/Minima) App 3 L293D drive ready.");
  Serial.println("Drive wiring: M1+M4 left side, M2+M3 right side.");
  Serial.println("Commands: FORWARD, BACKWARD, LEFT, RIGHT, STOP, SPEED:<0-255>, PATROL_START, ROBOT_RESUME, ROBOT_PAUSE, ALERT_SIGNAL, CARE_DEPLOYED, NODE_RESTART, READ_SENSORS");
  Serial.println("Pins: L293D shield uses D3-D8,D11,D12. Optional DHT11 data is D2, light sensor is A1.");
}

void handleCommand(const String &command) {
  uint8_t requestedSpeed = driveSpeed;
  if (command == "FORWARD" || command == "PATROL_START" || command == "ROBOT_RESUME") {
    setStatusLed(true);
    armWatchdog();
    tankDrive(driveSpeed, driveSpeed);
    printDriveStatus(command == "FORWARD" ? "FORWARD" : "PATROL_FORWARD");
  } else if (command == "BACKWARD") {
    setStatusLed(true);
    armWatchdog();
    tankDrive(-driveSpeed, -driveSpeed);
    printDriveStatus("BACKWARD");
  } else if (command == "LEFT") {
    setStatusLed(true);
    armWatchdog();
    tankDrive(-driveSpeed, driveSpeed);
    printDriveStatus("LEFT");
  } else if (command == "RIGHT") {
    setStatusLed(true);
    armWatchdog();
    tankDrive(driveSpeed, -driveSpeed);
    printDriveStatus("RIGHT");
  } else if (command == "STOP" || command == "ROBOT_PAUSE") {
    setStatusLed(false);
    disarmWatchdog();
    stopDriveMotors();
    Serial.println("DRIVE:STOP");
  } else if (command == "HEARTBEAT") {
    if (watchdogArmed) watchdogLastMs = millis();
    Serial.println("HEARTBEAT:OK");
    Serial.println("PONG");
  } else if (parseSpeedCommand(command, requestedSpeed)) {
    driveSpeed = requestedSpeed;
    Serial.print("DRIVE:SPEED_SET,SPEED:");
    Serial.println(driveSpeed);
  } else if (command == "ALERT_SIGNAL") {
    setStatusLed(true);
    Serial.println("Guardian alert signal received.");
  } else if (command == "CARE_DEPLOYED") {
    setStatusLed(true);
    Serial.println("Guardian care workflow deployed.");
  } else if (command == "NODE_RESTART") {
    stopDriveMotors();
    setStatusLed(true);
    Serial.println("Guardian node restart acknowledged.");
  } else if (command == "READ_SENSORS") {
    readSensors();
  } else if (command == "MOTOR_TEST") {
    Serial.println("DIAG:MOTOR_TEST_START");
    for (uint8_t m = 1; m <= 4; ++m) {
      Serial.print("DIAG:RUN_M");
      Serial.println(m);
      setMotor(m, 200);
      delay(700);
      setMotor(m, 0);
      delay(150);
    }
    stopDriveMotors();
    Serial.println("DIAG:MOTOR_TEST_DONE");
  } else if (command.length() >= 5 && command.charAt(0) == 'M' &&
             command.charAt(1) >= '1' && command.charAt(1) <= '4' && command.charAt(2) == '_') {
    const uint8_t motor = command.charAt(1) - '0';
    const String tail = command.substring(3);
    if (tail == "FWD") { setMotor(motor, 200); Serial.print("DIAG:M"); Serial.print(motor); Serial.println(":FWD"); }
    else if (tail == "BACK") { setMotor(motor, -200); Serial.print("DIAG:M"); Serial.print(motor); Serial.println(":BACK"); }
    else if (tail == "OFF") { setMotor(motor, 0); Serial.print("DIAG:M"); Serial.print(motor); Serial.println(":OFF"); }
    else { Serial.print("Unknown M-direct command: "); Serial.println(command); }
  } else if (command == "SENSOR_SNAPSHOT") {
    readSensors();
  } else if (command == "NODE_STATUS") {
    Serial.print("STATUS:NODES:connected,WDT:");
    Serial.println(watchdogArmed ? "armed" : "off");
  } else {
    Serial.print("ERR:UNKNOWN:");
    Serial.println(command);
  }
}
}

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  setStatusLed(false);

  pinMode(motorLatchPin, OUTPUT);
  pinMode(motorClockPin, OUTPUT);
  pinMode(motorEnablePin, OUTPUT);
  pinMode(motorDataPin, OUTPUT);
  pinMode(motor1PwmPin, OUTPUT);
  pinMode(motor2PwmPin, OUTPUT);
  pinMode(motor3PwmPin, OUTPUT);
  pinMode(motor4PwmPin, OUTPUT);
  digitalWrite(motorEnablePin, LOW);
  stopDriveMotors();

  dht.begin();
  Serial.begin(115200);
  const unsigned long serialStartTime = millis();
  while (!Serial && millis() - serialStartTime < 3000) {
  }
  printReadyMessage();
}

void loop() {
  if (watchdogArmed && millis() - watchdogLastMs > watchdogMs) {
    disarmWatchdog();
    stopDriveMotors();
    setStatusLed(false);
    Serial.println("WATCHDOG:TIMEOUT");
  }

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
