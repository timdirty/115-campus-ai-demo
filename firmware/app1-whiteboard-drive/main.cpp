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
// the App 3 HY-M302 sensor firmware in firmware/app3-guardian-sensor/ is not overwritten.

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

// 可中斷的等待：每 20ms 檢查 serial，遇到 STOP/PAUSE_TASK 立即停馬達並回 false
// 收到的指令直接 ack 回去（保持與正常 handler 一致的 response 格式）
// true = 走完整段時間沒被打斷；false = 中途被打斷，馬達已停
static bool waitInterruptible(uint32_t ms) {
  const uint32_t start = millis();
  while (millis() - start < ms) {
    if (Serial.available()) {
      String peek = Serial.readStringUntil('\n');
      peek.trim();
      if (peek == "STOP" || peek == "PAUSE_TASK") {
        stopAll();
        Serial.println(peek);  // STOP/PAUSE_TASK 的標準 ack
        return false;
      }
      // 其他指令（含重複 ERASE_*）讀掉後丟棄，避免污染 serial buffer
    }
    delay(20);
  }
  return true;
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
  // Emit a machine-parseable boot banner so the bridge can broadcast a
  // robot_reset event whenever the R4 RESET button is pressed (physical
  // emergency stop — see Notion Q5 narrative alignment, FUN-340).
  Serial.println("READY:RESET");
  Serial.println("Commands: FORWARD, BACKWARD, LEFT, RIGHT, STOP, SPEED:<0-255>, HEARTBEAT, MOTOR_TEST, ERASE_REGION_A, ERASE_REGION_B, ERASE_REGION_C");
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
  } else if (cmd == "ERASE_ALL") {
    forward();
    if (waitInterruptible(1500)) { stopAll(); Serial.println("ERASE_ALL"); }
  } else if (cmd == "ERASE_REGION_A") {
    bool ok = true;
    turnLeft();
    if (!waitInterruptible(400)) {
      ok = false;
    }
    for (int pass = 1; pass <= 3 && ok; pass++) {
      forward();
      if (!waitInterruptible(500)) { ok = false; break; }
      Serial.println("ERASE_PROGRESS:" + String(pass) + "/3");
      backward();
      if (!waitInterruptible(500)) { ok = false; break; }
    }
    if (ok) {
      turnRight();
      if (waitInterruptible(400)) {
        stopAll();
        Serial.println("ERASE_DONE:REGION_A");
      }
    }
  } else if (cmd == "ERASE_REGION_B") {
    bool ok = true;
    turnRight();
    if (!waitInterruptible(400)) {
      ok = false;
    }
    for (int pass = 1; pass <= 3 && ok; pass++) {
      forward();
      if (!waitInterruptible(500)) { ok = false; break; }
      Serial.println("ERASE_PROGRESS:" + String(pass) + "/3");
      backward();
      if (!waitInterruptible(500)) { ok = false; break; }
    }
    if (ok) {
      turnLeft();
      if (waitInterruptible(400)) {
        stopAll();
        Serial.println("ERASE_DONE:REGION_B");
      }
    }
  } else if (cmd == "ERASE_REGION_C") {
    bool ok = true;
    for (int pass = 1; pass <= 3 && ok; pass++) {
      forward();
      if (!waitInterruptible(500)) { ok = false; break; }
      Serial.println("ERASE_PROGRESS:" + String(pass) + "/3");
      backward();
      if (!waitInterruptible(500)) { ok = false; break; }
    }
    if (ok) {
      stopAll();
      Serial.println("ERASE_DONE:REGION_C");
    }
  } else if (cmd == "CELEBRATE") {
    // 慶祝動作：左右搖擺 3 次，每次 200ms 顯露成功感
    bool ok = true;
    for (int i = 0; i < 3 && ok; i++) {
      turnLeft();
      if (!waitInterruptible(200)) { ok = false; break; }
      turnRight();
      if (!waitInterruptible(200)) { ok = false; break; }
    }
    stopAll();
    Serial.println(ok ? "CELEBRATE" : "CELEBRATE:ABORTED");
  } else if (cmd == "KEEP_REGION_A" || cmd == "KEEP_REGION_B" || cmd == "KEEP_REGION_C") {
    Serial.println(cmd);  // 保留指令：機器人不動作，回 ack 給 App
  } else if (cmd == "PAUSE_TASK") {
    stopAll();
    Serial.println("PAUSE_TASK");
  } else if (cmd == "CLEAN_START" || cmd == "CLEAN_STOP") {
    Serial.println(cmd);  // 清潔流程：先 ack，不做動作
  } else if (cmd.startsWith("SET_") || cmd == "CALIBRATION_STATUS") {
    Serial.println(cmd);  // 校正類指令：暫時 ack，後續可加實作
  } else if (cmd == "SHOW_ON" || cmd == "SHOW_OFF" || cmd == "FIREWORK" ||
             cmd == "RESET" || cmd == "LED_ON" || cmd == "LED_OFF" ||
             cmd.startsWith("SERVO_")) {
    Serial.println(cmd);  // 顯示/伺服指令：暫時 ack（無實體 LED Matrix/Servo）
  } else {
    Serial.print("ERR:UNKNOWN:");
    Serial.println(cmd);
  }
}
