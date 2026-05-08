// L293D Motor Shield v1 (74HC595) - App 1 M3 / M4 robot movement test
// Board: Arduino UNO R4 Minima
//
// Serial commands (115200):
//   FORWARD       both motors forward
//   BACKWARD      both motors backward
//   LEFT          M3 back / M4 forward  (tank pivot left)
//   RIGHT         M3 forward / M4 back  (tank pivot right)
//   STOP          both motors stop
//   SPEED:<0-255> set speed (default 100)
//   MOTOR_TEST    diagnostic: spin M3 then M4 forward 700ms each
//   M3_FWD / M3_BACK / M3_OFF  individual motor (M4_* same)
//
// This is the restored App 1 drive firmware from commit ecc339e, isolated so
// the App 3 HY-M302 sensor firmware in src/app3_guardian_sensor/ is not overwritten.

#include <Arduino.h>

#define MOTORLATCH  12
#define MOTORCLK     4
#define MOTORENABLE  7
#define MOTORDATA    8

#define M3_PWM  6
#define M4_PWM  5

#define M3_A  (1 << 5)
#define M3_B  (1 << 7)
#define M4_A  (1 << 0)
#define M4_B  (1 << 6)

static uint8_t motorSpeed = 100;

// 接線方向修正：如某顆馬達指令「正轉」實際反轉，改 true 即可（不用拆排線）。
static constexpr bool invertM3 = false;
static constexpr bool invertM4 = false;

// Watchdog: auto-STOP if no HEARTBEAT within 3 s after a motion command
static constexpr unsigned long watchdogMs = 3000;
static bool watchdogArmed = false;
static unsigned long watchdogLastMs = 0;

static void armWatchdog()  { watchdogArmed = true;  watchdogLastMs = millis(); }
static void disarmWatchdog() { watchdogArmed = false; }

static void latch(uint8_t bits) {
  digitalWrite(MOTORLATCH, LOW);
  shiftOut(MOTORDATA, MOTORCLK, MSBFIRST, bits);
  digitalWrite(MOTORLATCH, HIGH);
}

static void drive(uint8_t m3bits, uint8_t m3pwm, uint8_t m4bits, uint8_t m4pwm) {
  latch(m3bits | m4bits);
  analogWrite(M3_PWM, m3pwm);
  analogWrite(M4_PWM, m4pwm);
}

// Apply invert by swapping forward/backward bit for each motor as needed
static inline uint8_t m3FwdBits() { return invertM3 ? M3_B : M3_A; }
static inline uint8_t m3BackBits() { return invertM3 ? M3_A : M3_B; }
static inline uint8_t m4FwdBits() { return invertM4 ? M4_B : M4_A; }
static inline uint8_t m4BackBits() { return invertM4 ? M4_A : M4_B; }

static void forward() {
  drive(m3FwdBits(), motorSpeed, m4FwdBits(), motorSpeed);
}

static void backward() {
  drive(m3BackBits(), motorSpeed, m4BackBits(), motorSpeed);
}

static void turnLeft() {
  drive(m3BackBits(), motorSpeed, m4FwdBits(), motorSpeed);
}

static void turnRight() {
  drive(m3FwdBits(), motorSpeed, m4BackBits(), motorSpeed);
}

static void stopAll() {
  drive(0, 0, 0, 0);
}

// Diagnostic helpers — drive only one motor while the other is stopped
static void runM3(int signedSpeed) {
  const uint8_t pwm = static_cast<uint8_t>(min(255, abs(signedSpeed)));
  const uint8_t bits = signedSpeed >= 0 ? m3FwdBits() : m3BackBits();
  drive(bits, pwm, 0, 0);
}

static void runM4(int signedSpeed) {
  const uint8_t pwm = static_cast<uint8_t>(min(255, abs(signedSpeed)));
  const uint8_t bits = signedSpeed >= 0 ? m4FwdBits() : m4BackBits();
  drive(0, 0, bits, pwm);
}

void setup() {
  pinMode(MOTORLATCH, OUTPUT);
  pinMode(MOTORCLK, OUTPUT);
  pinMode(MOTORENABLE, OUTPUT);
  pinMode(MOTORDATA, OUTPUT);
  pinMode(M3_PWM, OUTPUT);
  pinMode(M4_PWM, OUTPUT);

  digitalWrite(MOTORENABLE, LOW);
  stopAll();

  Serial.begin(115200);
  while (!Serial && millis() < 3000) {
  }
  Serial.println("App 1 M3/M4 motor test ready.");
  Serial.println("Commands: FORWARD, BACKWARD, LEFT, RIGHT, STOP, SPEED:<0-255>, HEARTBEAT, MOTOR_TEST");
}

void loop() {
  if (watchdogArmed && millis() - watchdogLastMs > watchdogMs) {
    disarmWatchdog();
    stopAll();
    Serial.println("WATCHDOG:TIMEOUT");
  }

  if (!Serial.available()) {
    return;
  }

  String cmd = Serial.readStringUntil('\n');
  cmd.trim();
  if (cmd.length() == 0) {
    return;
  }

  if (cmd == "FORWARD") {
    forward();
    armWatchdog();
    Serial.println("FORWARD");
  } else if (cmd == "BACKWARD") {
    backward();
    armWatchdog();
    Serial.println("BACKWARD");
  } else if (cmd == "LEFT") {
    turnLeft();
    armWatchdog();
    Serial.println("LEFT");
  } else if (cmd == "RIGHT") {
    turnRight();
    armWatchdog();
    Serial.println("RIGHT");
  } else if (cmd == "HEARTBEAT") {
    if (watchdogArmed) watchdogLastMs = millis();
    Serial.println("HEARTBEAT:OK");
    Serial.println("PONG");
  } else if (cmd == "STOP") {
    disarmWatchdog();
    stopAll();
    Serial.println("STOP");
  } else if (cmd.startsWith("SPEED:")) {
    const int value = constrain(cmd.substring(6).toInt(), 50, 255);
    motorSpeed = static_cast<uint8_t>(value);
    Serial.print("SPEED:");
    Serial.println(value);
  } else if (cmd == "MOTOR_TEST") {
    Serial.println("DIAG:MOTOR_TEST_START");
    Serial.println("DIAG:RUN_M3"); runM3(200); delay(700); runM3(0); delay(150);
    Serial.println("DIAG:RUN_M4"); runM4(200); delay(700); runM4(0);
    stopAll();
    Serial.println("DIAG:MOTOR_TEST_DONE");
  } else if (cmd == "M3_FWD") { runM3(200); Serial.println("DIAG:M3:FWD");
  } else if (cmd == "M3_BACK") { runM3(-200); Serial.println("DIAG:M3:BACK");
  } else if (cmd == "M3_OFF") { runM3(0); Serial.println("DIAG:M3:OFF");
  } else if (cmd == "M4_FWD") { runM4(200); Serial.println("DIAG:M4:FWD");
  } else if (cmd == "M4_BACK") { runM4(-200); Serial.println("DIAG:M4:BACK");
  } else if (cmd == "M4_OFF") { runM4(0); Serial.println("DIAG:M4:OFF");
  } else if (cmd == "STATUS") {
    Serial.print("STATUS:SPEED:");
    Serial.print(motorSpeed);
    Serial.print(",WDT:");
    Serial.println(watchdogArmed ? "armed" : "off");
  } else {
    Serial.print("ERR:UNKNOWN:");
    Serial.println(cmd);
  }
}
