#include "sensor.h"

#include <Arduino.h>
#include <DHT.h>

// HY-M302 9-in-1 expansion board pin map for App 3 guardian sensor node.
// Adjust these constants if your HY-M302 jumper wires are connected differently.
static constexpr uint8_t DHT_PIN = 4;
static constexpr uint8_t DHT_TYPE = DHT11;
static constexpr uint8_t LIGHT_PIN = A1;
static constexpr uint8_t LED_R_PIN = 9;
static constexpr uint8_t LED_G_PIN = 10;
static constexpr uint8_t LED_B_PIN = 11;
static constexpr uint8_t BUTTON_PIN = 2;

static constexpr unsigned long DHT_WARMUP_MS = 2000UL;
static constexpr unsigned long AUTO_READ_MS = 10000UL;

static DHT dht(DHT_PIN, DHT_TYPE);

static float cachedTempC = NAN;
static float cachedHumidity = NAN;
static int cachedLight = -1;
static bool hasCachedReading = false;
static bool buttonWasDown = false;
static unsigned long lastReadMs = 0;

enum class LedStatus : uint8_t {
  Auto,
  Low,
  Medium,
  High,
  Off,
};

static LedStatus ledStatus = LedStatus::Auto;

static void setRgb(uint8_t red, uint8_t green, uint8_t blue) {
  analogWrite(LED_R_PIN, red);
  analogWrite(LED_G_PIN, green);
  analogWrite(LED_B_PIN, blue);
}

static void applyMoodLed(float tempC, float humidity, int light) {
  int score = 0;

  if (tempC > 32.0f) {
    score += 3;
  } else if (tempC > 29.0f) {
    score += 1;
  }

  if (humidity < 30.0f || humidity > 80.0f) {
    score += 2;
  } else if (humidity < 40.0f || humidity > 70.0f) {
    score += 1;
  }

  if (light < 150) {
    score += 2;
  } else if (light < 350) {
    score += 1;
  }

  if (score >= 5) {
    setRgb(255, 0, 0);      // red: high attention
  } else if (score >= 3) {
    setRgb(220, 110, 0);    // amber: needs attention
  } else if (light < 200) {
    setRgb(0, 20, 220);     // blue: dim or quiet
  } else {
    setRgb(0, 200, 40);     // green: calm
  }
}

static void applyStatusLed(LedStatus status) {
  switch (status) {
    case LedStatus::Low:
      setRgb(0, 200, 40);
      break;
    case LedStatus::Medium:
      setRgb(220, 110, 0);
      break;
    case LedStatus::High:
      setRgb(255, 0, 0);
      break;
    case LedStatus::Off:
      setRgb(0, 0, 0);
      break;
    case LedStatus::Auto:
      if (hasCachedReading) {
        applyMoodLed(cachedTempC, cachedHumidity, cachedLight);
      } else {
        setRgb(0, 0, 60);
      }
      break;
  }
}

static void setLedStatus(LedStatus status, const char *label) {
  ledStatus = status;
  applyStatusLed(status);
  Serial.print("LED_STATUS:");
  Serial.println(label);
}

static bool handleLedStatusCommand(const String &command) {
  if (command == "STATUS_LOW" || command == "ZONE_SAFE" || command == "LED_GREEN") {
    setLedStatus(LedStatus::Low, "LOW");
    return true;
  }
  if (command == "STATUS_MEDIUM" || command == "ZONE_ATTENTION" || command == "LED_AMBER" || command == "LED_YELLOW") {
    setLedStatus(LedStatus::Medium, "MEDIUM");
    return true;
  }
  if (command == "STATUS_HIGH" || command == "ZONE_HIGH" || command == "LED_RED") {
    setLedStatus(LedStatus::High, "HIGH");
    return true;
  }
  if (command == "LED_AUTO") {
    setLedStatus(LedStatus::Auto, "AUTO");
    return true;
  }
  if (command == "LED_OFF") {
    setLedStatus(LedStatus::Off, "OFF");
    return true;
  }
  return false;
}

static void printReading(float tempC, float humidity, int light) {
  Serial.print("SENSORS:TEMP:");
  Serial.print(tempC, 1);
  Serial.print(",HUM:");
  Serial.print(static_cast<int>(humidity + 0.5f));
  Serial.print(",LIGHT:");
  Serial.println(light);
}

static void readAndReportSensors() {
  const float tempC = dht.readTemperature();
  const float humidity = dht.readHumidity();
  const int light = analogRead(LIGHT_PIN);

  if (!isnan(tempC) && !isnan(humidity) && humidity >= 0.0f && humidity <= 100.0f) {
    cachedTempC = tempC;
    cachedHumidity = humidity;
    cachedLight = light;
    hasCachedReading = true;
  } else if (!hasCachedReading) {
    Serial.println("SENSOR_ERROR:DHT_WARMING_UP");
    if (ledStatus == LedStatus::Auto) {
      setRgb(0, 0, 80);
    }
    return;
  } else {
    cachedLight = light;
  }

  printReading(cachedTempC, cachedHumidity, cachedLight);
  if (ledStatus == LedStatus::Auto) {
    applyMoodLed(cachedTempC, cachedHumidity, cachedLight);
  }
}

static void handleSerialCommand(const String &command) {
  if (command == "READ_SENSORS") {
    readAndReportSensors();
  } else if (handleLedStatusCommand(command)) {
    return;
  } else if (command == "LED_TEST") {
    setRgb(255, 0, 0);
    delay(250);
    setRgb(0, 255, 0);
    delay(250);
    setRgb(0, 0, 255);
    delay(250);
    setRgb(0, 0, 0);
    applyStatusLed(ledStatus);
    Serial.println("LED_TEST_DONE");
  } else if (command.length() > 0) {
    Serial.print("UNKNOWN_COMMAND:");
    Serial.println(command);
  }
}

void setupGuardianSensorNode() {
  pinMode(LED_R_PIN, OUTPUT);
  pinMode(LED_G_PIN, OUTPUT);
  pinMode(LED_B_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  setRgb(0, 0, 60);

  Serial.begin(115200);
  while (!Serial && millis() < 4000UL) {}

  dht.begin();
  delay(DHT_WARMUP_MS);

  Serial.println("SENSOR_NODE_READY");
  Serial.println("Commands: READ_SENSORS | STATUS_LOW | STATUS_MEDIUM | STATUS_HIGH | LED_AUTO | LED_TEST");
  Serial.println("Output: SENSORS:TEMP:XX.X,HUM:XX,LIGHT:XXXX");
  Serial.print("Pins: DHT11=D");
  Serial.print(DHT_PIN);
  Serial.print(" LIGHT=A");
  Serial.print(LIGHT_PIN - A0);
  Serial.print(" RGB=D");
  Serial.print(LED_R_PIN);
  Serial.print("/D");
  Serial.print(LED_G_PIN);
  Serial.print("/D");
  Serial.println(LED_B_PIN);

  readAndReportSensors();
  lastReadMs = millis();
}

void loopGuardianSensorNode() {
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    command.trim();
    handleSerialCommand(command);
  }

  const bool buttonDown = digitalRead(BUTTON_PIN) == LOW;
  if (buttonDown && !buttonWasDown) {
    readAndReportSensors();
    lastReadMs = millis();
  }
  buttonWasDown = buttonDown;

  if (millis() - lastReadMs >= AUTO_READ_MS) {
    readAndReportSensors();
    lastReadMs = millis();
  }
}
