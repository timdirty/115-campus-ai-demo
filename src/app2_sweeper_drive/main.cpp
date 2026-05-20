// App 2 校園服務機器人 — 掃地機器人 firmware
// Hardware: Arduino UNO R4 (WiFi or Minima) + L293D Motor Shield v1
// Wiring:
//   M1 + M2  → 後方雙輪驅動底盤（M1=左後輪，M2=右後輪）
//   M3 + M4  → 前方兩個掃地葉片 / 滾筒
// Serial: 115200 baud, UPPER_SNAKE_CASE 指令
//
// Primitive commands (相機/手把直接控制底盤):
//   FORWARD / BACKWARD / LEFT / RIGHT / STOP
//   SPEED:<0-255> or WHEEL_SPEED:<0-255>
//                              設定後輪底盤速度
//   SWEEP_START / SWEEP_STOP or BLADES_START / BLADES_STOP
//                              前方掃地葉片啟停
//   SWEEP_REVERSE or BLADES_REVERSE
//                              葉片方向切換（吸入 ↔ 推出）
//   SWEEP_SPEED:<0-255> or BLADE_SPEED:<0-255>
//                              前方掃地葉片轉速
//   CHASSIS_TEST              後輪短暫前進測試
//   BLADES_TEST               前方兩個掃地葉片滿速短測
//   READ_SENSORS             兼容查詢，無感測器時回 SENSORS:NONE
//
// High-level commands (App 2 前端會送):
//   DELIVERY_START / DELIVERY_DONE
//   PATROL_START / BROADCAST_START / BROADCAST_SCHEDULE / CLEAN_SCHEDULE
//   ROBOT_RESUME / ROBOT_PAUSE
//   SPEED_SET / SYSTEM_READY

#include <Arduino.h>

namespace {
constexpr uint8_t motorLatchPin = 12;
constexpr uint8_t motorClockPin = 4;
constexpr uint8_t motorEnablePin = 7;
constexpr uint8_t motorDataPin = 8;

constexpr uint8_t motor1PwmPin = 11;
constexpr uint8_t motor2PwmPin = 3;
constexpr uint8_t motor3PwmPin = 6;
constexpr uint8_t motor4PwmPin = 5;

// 各馬達實際接線方向修正。如果某顆馬達指令「正轉」但實際上反轉，
// 把對應 invertMotorN 改成 true，不用拆下重接。
constexpr bool invertMotor1 = false;  // M1 左後輪
constexpr bool invertMotor2 = false;  // M2 右後輪
constexpr bool invertMotor3 = false;  // M3 滾筒
constexpr bool invertMotor4 = false;  // M4 滾筒

uint8_t motorLatchState = 0;
uint8_t driveSpeed = 90;    // 底盤預設速度。低 PWM 靠 kick-start 起步
uint8_t sweepSpeed = 255;

// Kick-start：靜止 → 移動的瞬間用高 PWM 突破靜摩擦力，再降到目標速度。
// 否則 PWM 低於約 100 時 L293D 上的小馬達會卡住不轉只嗡嗡叫。
constexpr uint8_t kickPwm = 220;       // 啟動瞬間 PWM
constexpr uint16_t kickMs = 120;        // 維持時間 (ms)
constexpr uint8_t kickThreshold = 150;  // 目標速度低於此值才需要 kick
constexpr uint8_t bladeKickPwm = 255;   // 葉片啟動瞬間滿速，避免小馬達卡住
constexpr uint16_t bladeKickMs = 300;
bool sweepRunning = false;
bool sweepReversed = false;
bool drivePaused = false;
const char *lastDriveMode = "STOP";

// Watchdog: auto-STOP drive if no motion command or HEARTBEAT arrives within 3 s.
constexpr unsigned long watchdogMs = 3000;
bool watchdogArmed = false;
unsigned long watchdogLastMs = 0;

void armWatchdog() {
  watchdogArmed = true;
  watchdogLastMs = millis();
}

void disarmWatchdog() {
  watchdogArmed = false;
}

void setStatusLed(bool enabled) {
  digitalWrite(LED_BUILTIN, enabled ? HIGH : LOW);
}

int clampByte(int value) {
  if (value < 0) return 0;
  if (value > 255) return 255;
  return value;
}

bool parsePrefixedSpeed(const String &command, const char *prefix, uint8_t &outSpeed) {
  String head = String(prefix);
  if (!command.startsWith(head)) return false;
  outSpeed = static_cast<uint8_t>(clampByte(command.substring(head.length()).toInt()));
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
    case 1: forwardBit = 2; backwardBit = 3; break;
    case 2: forwardBit = 1; backwardBit = 4; break;
    case 3: forwardBit = 5; backwardBit = 7; break;
    case 4: forwardBit = 0; backwardBit = 6; break;
    default: forwardBit = 2; backwardBit = 3; break;
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

// ── 底盤（M1+M2）────────────────────────────────────────────────────────────
void setDriveSides(int leftSpeed, int rightSpeed) {
  setMotor(1, leftSpeed);
  setMotor(2, rightSpeed);
}

void stopDrive() {
  setDriveSides(0, 0);
  lastDriveMode = "STOP";
}

bool wasStopped() {
  return strcmp(lastDriveMode, "STOP") == 0;
}

// 起步前如目標速度太低，先用 kickPwm 衝一下突破靜摩擦
void kickIfNeeded(int leftDir, int rightDir) {
  if (driveSpeed >= kickThreshold) return;
  if (!wasStopped()) return;
  setDriveSides(leftDir * kickPwm, rightDir * kickPwm);
  delay(kickMs);
}

void driveForward() {
  kickIfNeeded(1, 1);
  setDriveSides(driveSpeed, driveSpeed);
  lastDriveMode = "FORWARD";
}

void driveBackward() {
  kickIfNeeded(-1, -1);
  setDriveSides(-driveSpeed, -driveSpeed);
  lastDriveMode = "BACKWARD";
}

void driveLeft() {
  kickIfNeeded(-1, 1);
  setDriveSides(-driveSpeed, driveSpeed);
  lastDriveMode = "LEFT";
}

void driveRight() {
  kickIfNeeded(1, -1);
  setDriveSides(driveSpeed, -driveSpeed);
  lastDriveMode = "RIGHT";
}

void resumeLastDrive() {
  if (strcmp(lastDriveMode, "FORWARD") == 0) driveForward();
  else if (strcmp(lastDriveMode, "BACKWARD") == 0) driveBackward();
  else if (strcmp(lastDriveMode, "LEFT") == 0) driveLeft();
  else if (strcmp(lastDriveMode, "RIGHT") == 0) driveRight();
  else stopDrive();
}

// ── 滾筒（M3+M4）────────────────────────────────────────────────────────────
// 兩顆滾筒預設「反向相對」轉，把碎屑往機體中央集中。
// 如果你的物理裝法是相同方向比較好，把其中一顆 invertMotor 改 true 即可。
void applySweep() {
  if (!sweepRunning) {
    setMotor(3, 0);
    setMotor(4, 0);
    return;
  }
  const int direction = sweepReversed ? -1 : 1;
  setMotor(3, direction * sweepSpeed);
  setMotor(4, -direction * sweepSpeed);
}

void sweepStart() {
  const bool wasRunning = sweepRunning;
  sweepRunning = true;
  if (!wasRunning) {
    const int direction = sweepReversed ? -1 : 1;
    setMotor(3, direction * bladeKickPwm);
    setMotor(4, -direction * bladeKickPwm);
    delay(bladeKickMs);
  }
  applySweep();
}

void sweepStop() {
  sweepRunning = false;
  applySweep();
}

void sweepToggleDirection() {
  sweepReversed = !sweepReversed;
  applySweep();
}

// ── Status / responses ─────────────────────────────────────────────────────
void printState(const char *label) {
  Serial.print("STATE:");
  Serial.print(label);
  Serial.print(",DRIVE:");
  Serial.print(lastDriveMode);
  Serial.print(",DRIVE_SPEED:");
  Serial.print(driveSpeed);
  Serial.print(",SWEEP:");
  Serial.print(sweepRunning ? "ON" : "OFF");
  Serial.print(",SWEEP_DIR:");
  Serial.print(sweepReversed ? "REVERSE" : "FORWARD");
  Serial.print(",SWEEP_SPEED:");
  Serial.print(sweepSpeed);
  Serial.print(",PAUSED:");
  Serial.println(drivePaused ? "1" : "0");
}

void printReadyMessage() {
  Serial.println("UNO R4 (WiFi/Minima) App 2 sweeper drive ready.");
  Serial.println("Wiring: M1=rear-left wheel, M2=rear-right wheel, M3+M4=front sweeper blades.");
  Serial.println("Drive: FORWARD/BACKWARD/LEFT/RIGHT/STOP, SPEED:<0-255> or WHEEL_SPEED:<0-255>");
  Serial.println("Blades: BLADES_START/BLADES_STOP/BLADES_REVERSE, BLADE_SPEED:<0-255>");
  Serial.println("Legacy sweep aliases: SWEEP_START/SWEEP_STOP/SWEEP_REVERSE, SWEEP_SPEED:<0-255>");
  Serial.println("Diagnostics: CHASSIS_TEST, BLADES_TEST, MOTOR_TEST, M1_FWD/M1_BACK/M1_OFF ... M4_OFF");
  Serial.println("Tasks: PATROL_START, BROADCAST_START, DELIVERY_START/DONE, ROBOT_RESUME/PAUSE, SPEED_SET");
}

void handleCommand(const String &command) {
  uint8_t requestedSpeed = driveSpeed;

  // ── Drive primitives ─────────────────────────────────────────────────────
  if (command == "HEARTBEAT") {
    if (watchdogArmed) watchdogLastMs = millis();
    Serial.println("HEARTBEAT:OK");
    Serial.println("PONG");
    return;
  }
  if (command == "FORWARD") {
    drivePaused = false;
    setStatusLed(true);
    armWatchdog();
    driveForward();
    printState("FORWARD");
    return;
  }
  if (command == "BACKWARD") {
    drivePaused = false;
    setStatusLed(true);
    armWatchdog();
    driveBackward();
    printState("BACKWARD");
    return;
  }
  if (command == "LEFT") {
    drivePaused = false;
    setStatusLed(true);
    armWatchdog();
    driveLeft();
    printState("LEFT");
    return;
  }
  if (command == "RIGHT") {
    drivePaused = false;
    setStatusLed(true);
    armWatchdog();
    driveRight();
    printState("RIGHT");
    return;
  }
  if (command == "STOP") {
    setStatusLed(false);
    disarmWatchdog();
    stopDrive();
    printState("STOP");
    return;
  }
  if (parsePrefixedSpeed(command, "SPEED:", requestedSpeed) ||
      parsePrefixedSpeed(command, "WHEEL_SPEED:", requestedSpeed)) {
    driveSpeed = requestedSpeed;
    if (!drivePaused && strcmp(lastDriveMode, "STOP") != 0) resumeLastDrive();
    printState("SPEED_SET");
    return;
  }

  // ── Sweep primitives ─────────────────────────────────────────────────────
  if (command == "SWEEP_START" || command == "BLADES_START") {
    sweepStart();
    printState("BLADES_START");
    return;
  }
  if (command == "SWEEP_STOP" || command == "BLADES_STOP") {
    sweepStop();
    printState("BLADES_STOP");
    return;
  }
  if (command == "SWEEP_REVERSE" || command == "BLADES_REVERSE") {
    sweepToggleDirection();
    printState("BLADES_REVERSE");
    return;
  }
  if (parsePrefixedSpeed(command, "SWEEP_SPEED:", requestedSpeed) ||
      parsePrefixedSpeed(command, "BLADE_SPEED:", requestedSpeed)) {
    sweepSpeed = requestedSpeed;
    if (sweepRunning) applySweep();
    printState("BLADE_SPEED_SET");
    return;
  }

  // ── High-level mission commands from App 2 frontend ──────────────────────
  if (command == "PATROL_START") {
    drivePaused = false;
    setStatusLed(true);
    armWatchdog();
    sweepStart();
    driveForward();
    printState("PATROL_START");
    return;
  }
  if (command == "BROADCAST_START") {
    drivePaused = false;
    setStatusLed(true);
    armWatchdog();
    sweepStop();   // 廣播時不需要掃地，避免額外噪音
    driveForward();
    printState("BROADCAST_START");
    return;
  }
  if (command == "DELIVERY_START") {
    drivePaused = false;
    setStatusLed(true);
    armWatchdog();
    sweepStop();
    driveForward();
    printState("DELIVERY_START");
    return;
  }
  if (command == "DELIVERY_DONE") {
    setStatusLed(false);
    disarmWatchdog();
    sweepStop();
    stopDrive();
    printState("DELIVERY_DONE");
    return;
  }
  if (command == "ROBOT_PAUSE") {
    drivePaused = true;
    setStatusLed(false);
    disarmWatchdog();
    sweepStop();
    stopDrive();
    printState("PAUSE");
    return;
  }
  if (command == "ROBOT_RESUME") {
    drivePaused = false;
    setStatusLed(true);
    armWatchdog();
    resumeLastDrive();
    if (sweepRunning) applySweep();
    printState("RESUME");
    return;
  }

  // ── Acknowledge-only commands ────────────────────────────────────────────
  if (command == "CLEAN_SCHEDULE" || command == "BROADCAST_SCHEDULE" ||
      command == "SPEED_SET" || command == "SYSTEM_READY") {
    printState(command.c_str());
    return;
  }

  if (command == "READ_SENSORS") {
    Serial.println("SENSORS:NONE");
    return;
  }

  // ── Diagnostics ──────────────────────────────────────────────────────────
  // CHASSIS_TEST: 只測後面兩顆輪子，短暫前進後停止。
  if (command == "CHASSIS_TEST") {
    Serial.println("DIAG:CHASSIS_TEST_START");
    const uint8_t previousSpeed = driveSpeed;
    if (driveSpeed < 110) driveSpeed = 110;
    drivePaused = false;
    setStatusLed(true);
    driveForward();
    delay(650);
    stopDrive();
    driveSpeed = previousSpeed;
    setStatusLed(false);
    disarmWatchdog();
    Serial.println("DIAG:CHASSIS_TEST_DONE");
    printState("CHASSIS_TEST");
    return;
  }

  // BLADES_TEST: 只測前方兩個掃地葉片，滿速短暫旋轉後停止。
  if (command == "BLADES_TEST") {
    Serial.println("DIAG:BLADES_TEST_START");
    const uint8_t previousSpeed = sweepSpeed;
    const bool previousRunning = sweepRunning;
    Serial.println("DIAG:RUN_M3_M4_FWD");
    setMotor(3, 255);
    setMotor(4, 255);
    delay(800);
    Serial.println("DIAG:RUN_M3_M4_BACK");
    setMotor(3, -255);
    setMotor(4, -255);
    delay(800);
    setMotor(3, 0);
    setMotor(4, 0);
    sweepRunning = previousRunning;
    sweepSpeed = previousSpeed;
    applySweep();
    Serial.println("DIAG:BLADES_TEST_DONE");
    printState("BLADES_TEST");
    return;
  }

  // MOTOR_TEST: 逐顆 M1→M4 各正轉 700ms 再停，便於確認哪顆沒反應
  if (command == "MOTOR_TEST") {
    Serial.println("DIAG:MOTOR_TEST_START");
    for (uint8_t m = 1; m <= 4; ++m) {
      Serial.print("DIAG:RUN_M");
      Serial.println(m);
      setMotor(m, 200);
      delay(700);
      setMotor(m, 0);
      delay(150);
    }
    stopDrive();
    sweepStop();
    Serial.println("DIAG:MOTOR_TEST_DONE");
    return;
  }
  // 個別馬達直驅：M1_FWD / M1_BACK / M1_OFF（M2/M3/M4 同理）
  if (command.length() >= 5 && command.charAt(0) == 'M' &&
      command.charAt(1) >= '1' && command.charAt(1) <= '4' && command.charAt(2) == '_') {
    const uint8_t motor = command.charAt(1) - '0';
    const String tail = command.substring(3);
    if (tail == "FWD") { setMotor(motor, 200); Serial.print("DIAG:M"); Serial.print(motor); Serial.println(":FWD"); return; }
    if (tail == "BACK") { setMotor(motor, -200); Serial.print("DIAG:M"); Serial.print(motor); Serial.println(":BACK"); return; }
    if (tail == "OFF") { setMotor(motor, 0); Serial.print("DIAG:M"); Serial.print(motor); Serial.println(":OFF"); return; }
  }

  if (command == "SWEEP_STATUS") {
    Serial.print("STATUS:SWEEP:");
    if (!sweepRunning) {
      Serial.print("off");
    } else if (sweepReversed) {
      Serial.print("reversed");
    } else {
      Serial.print("on");
    }
    Serial.print(",SPEED:");
    Serial.println(sweepSpeed);
    return;
  }

  Serial.print("ERR:UNKNOWN:");
  Serial.println(command);
}
}  // namespace

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

  stopDrive();
  sweepStop();

  Serial.begin(115200);
  const unsigned long serialStartTime = millis();
  while (!Serial && millis() - serialStartTime < 3000) {
  }
  printReadyMessage();
}

void loop() {
  if (watchdogArmed && millis() - watchdogLastMs > watchdogMs) {
    disarmWatchdog();
    stopDrive();
    setStatusLed(false);
    Serial.println("WATCHDOG:TIMEOUT");
  }

  if (!Serial.available()) return;
  String command = Serial.readStringUntil('\n');
  command.trim();
  if (command.length() == 0) return;
  handleCommand(command);
}
