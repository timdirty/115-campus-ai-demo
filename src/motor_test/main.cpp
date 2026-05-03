// HY-M302 Sensor Node — AI校園心靈守護者 (App 3)
// Board : Arduino UNO R4 Minima
// Shield: 今華電子 HY-M302 9-in-1 expansion board
//
// Sensors used:
//   DHT11       D4   — temperature (°C) + humidity (%)
//   Photoresist A1   — ambient light 0-1023 (higher = brighter)
//
// RGB LED mood indicator:
//   D9 R / D10 G / D11 B  (common-cathode, PWM)
//   green  = calm   | amber = attention | red = stressed | blue = dim/quiet
//
// Button D2: manual sensor read trigger (active-LOW, internal pull-up)
//
// Serial protocol (115200 baud):
//   HOST → ARDUINO : READ_SENSORS\n
//   ARDUINO → HOST : SENSORS:TEMP:XX.X,HUM:XX,LIGHT:XXXX\n
//   on failure     : SENSOR_ERROR:DHT_WARMING_UP\n
//
// Auto-broadcasts every 10 s so standalone Serial Monitor shows live data.
// Bridge (sensorManager.ts) sends READ_SENSORS and parses the first matching
// SENSORS:... line — auto-broadcasts are compatible with that flow.

#include <Arduino.h>
#include <DHT.h>

// ── pin map ──────────────────────────────────────────────────────────────────
#define DHT_PIN    4
#define LIGHT_PIN  A1
#define LED_R      9
#define LED_G      10
#define LED_B      11
#define BTN_A      2

// ── constants ─────────────────────────────────────────────────────────────────
static const unsigned long BROADCAST_MS = 10000UL;  // auto-broadcast interval

// ── globals ───────────────────────────────────────────────────────────────────
static DHT dht(DHT_PIN, DHT11);

static float cachedTemp = NAN;
static float cachedHum  = NAN;
static int   cachedLight = -1;
static bool  primed = false;

static unsigned long lastBroadcastMs = 0;
static bool btnWasDown = false;

// ── helpers ───────────────────────────────────────────────────────────────────
static void setRgb(uint8_t r, uint8_t g, uint8_t b) {
  analogWrite(LED_R, r);
  analogWrite(LED_G, g);
  analogWrite(LED_B, b);
}

// Maps sensor values to an emotion colour on the RGB LED.
// Stress score: temp too high (+pts), humidity extreme (+pts), light too low (+pts).
static void applyMoodLed(float t, float h, int l) {
  int score = 0;
  if      (t > 32.0f)            score += 3;
  else if (t > 29.0f)            score += 1;
  if      (h < 30.0f || h > 80.0f) score += 2;
  else if (h < 40.0f || h > 70.0f) score += 1;
  if      (l < 150)              score += 2;
  else if (l < 350)              score += 1;

  if      (score >= 5) setRgb(255,   0,   0);  // red   — stressed environment
  else if (score >= 3) setRgb(220, 110,   0);  // amber — needs attention
  else if (l < 200)    setRgb(  0,  20, 220);  // blue  — dim / quiet zone
  else                 setRgb(  0, 200,  40);  // green — calm / healthy
}

// Reads sensors, updates cache, prints one SENSORS: line, refreshes LED.
static void doRead() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  int   l = analogRead(LIGHT_PIN);

  if (!isnan(t) && !isnan(h) && h >= 0.0f && h <= 100.0f) {
    cachedTemp  = t;
    cachedHum   = h;
    cachedLight = l;
    primed = true;
  } else if (!primed) {
    // DHT11 hasn't warmed up yet; bridge will retry after 5 s
    Serial.println("SENSOR_ERROR:DHT_WARMING_UP");
    return;
  }
  // If DHT returned NaN but we have a prior reading, fall back to cached values.
  // Light is always fresh regardless.
  if (primed && l >= 0) cachedLight = l;

  Serial.print("SENSORS:TEMP:");
  Serial.print(cachedTemp, 1);
  Serial.print(",HUM:");
  Serial.print(static_cast<int>(cachedHum + 0.5f));
  Serial.print(",LIGHT:");
  Serial.println(cachedLight);

  applyMoodLed(cachedTemp, cachedHum, cachedLight);
}

// ── Arduino entry points ──────────────────────────────────────────────────────
void setup() {
  pinMode(LED_R, OUTPUT);
  pinMode(LED_G, OUTPUT);
  pinMode(LED_B, OUTPUT);
  pinMode(BTN_A, INPUT_PULLUP);

  setRgb(0, 0, 60);  // dim blue during startup

  dht.begin();
  delay(2000);  // DHT11 requires ≥ 1 s after power-on before first read

  Serial.begin(115200);
  while (!Serial && millis() < 4000) {}

  Serial.println("SENSOR_NODE_READY");
  Serial.println("Commands: READ_SENSORS | auto-broadcast every 10s");
  Serial.print("Pins: DHT11=D"); Serial.print(DHT_PIN);
  Serial.print(" LIGHT=A"); Serial.print(LIGHT_PIN - A0);
  Serial.print(" RGB=D"); Serial.print(LED_R);
  Serial.print("/D"); Serial.print(LED_G);
  Serial.print("/D"); Serial.println(LED_B);

  doRead();  // prime cache and set LED on boot
  lastBroadcastMs = millis();
}

void loop() {
  // ── serial command handler ─────────────────────────────────────────────────
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd == "READ_SENSORS") doRead();
  }

  // ── button A — edge-triggered manual read ─────────────────────────────────
  bool btnDown = (digitalRead(BTN_A) == LOW);
  if (btnDown && !btnWasDown) doRead();
  btnWasDown = btnDown;

  // ── auto-broadcast ─────────────────────────────────────────────────────────
  if (millis() - lastBroadcastMs >= BROADCAST_MS) {
    lastBroadcastMs = millis();
    doRead();
  }
}
