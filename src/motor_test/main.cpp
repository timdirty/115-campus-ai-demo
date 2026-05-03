// L293D Motor Shield v1 (74HC595) — M3 / M4 robot movement test
// Board: Arduino UNO R4 Minima
//
// Serial commands (115200):
//   FORWARD   — both motors forward
//   BACKWARD  — both motors backward
//   LEFT      — M3 back / M4 forward  (tank pivot left)
//   RIGHT     — M3 forward / M4 back  (tank pivot right)
//   STOP      — both motors stop
//   SPEED:<0-255>  — set speed (default 200)
//
// Swap M3/M4 direction logic if your left/right is physically reversed.

#include <Arduino.h>

// 74HC595 shift register pins (fixed on the shield)
#define MOTORLATCH  12
#define MOTORCLK     4
#define MOTORENABLE  7
#define MOTORDATA    8

// PWM speed pins
#define M3_PWM  6
#define M4_PWM  5

// 74HC595 bit masks for M3 and M4 direction
#define M3_A  (1 << 5)   // M3 forward bit
#define M3_B  (1 << 7)   // M3 backward bit
#define M4_A  (1 << 0)   // M4 forward bit
#define M4_B  (1 << 6)   // M4 backward bit

static uint8_t motorSpeed = 100;

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

static void forward()  { drive(M3_A, motorSpeed, M4_A, motorSpeed); }
static void backward() { drive(M3_B, motorSpeed, M4_B, motorSpeed); }
static void turnLeft() { drive(M3_B, motorSpeed, M4_A, motorSpeed); }
static void turnRight(){ drive(M3_A, motorSpeed, M4_B, motorSpeed); }
static void stopAll()  { drive(0, 0, 0, 0); }

void setup() {
  pinMode(MOTORLATCH,  OUTPUT);
  pinMode(MOTORCLK,    OUTPUT);
  pinMode(MOTORENABLE, OUTPUT);
  pinMode(MOTORDATA,   OUTPUT);
  pinMode(M3_PWM,      OUTPUT);
  pinMode(M4_PWM,      OUTPUT);

  digitalWrite(MOTORENABLE, LOW);  // enable 74HC595 outputs
  stopAll();

  Serial.begin(115200);
  while (!Serial && millis() < 3000) {}
  Serial.println("Motor test ready.");
  Serial.println("Commands: FORWARD, BACKWARD, LEFT, RIGHT, STOP, SPEED:<0-255>");
}

void loop() {
  if (!Serial.available()) return;

  String cmd = Serial.readStringUntil('\n');
  cmd.trim();
  if (cmd.length() == 0) return;

  if (cmd == "FORWARD") {
    forward();
    Serial.println("FORWARD");
  } else if (cmd == "BACKWARD") {
    backward();
    Serial.println("BACKWARD");
  } else if (cmd == "LEFT") {
    turnLeft();
    Serial.println("LEFT");
  } else if (cmd == "RIGHT") {
    turnRight();
    Serial.println("RIGHT");
  } else if (cmd == "STOP") {
    stopAll();
    Serial.println("STOP");
  } else if (cmd.startsWith("SPEED:")) {
    int v = constrain(cmd.substring(6).toInt(), 50, 255);
    motorSpeed = (uint8_t)v;
    Serial.print("SPEED:");
    Serial.println(v);
  } else {
    Serial.print("Unknown: ");
    Serial.println(cmd);
  }
}
