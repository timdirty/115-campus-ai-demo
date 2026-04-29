#include "matrix_show.h"

#include <Arduino.h>
#include <Arduino_LED_Matrix.h>

namespace {
constexpr uint8_t rowCount = 8;
constexpr uint8_t columnCount = 12;
constexpr uint8_t digitWidth = 5;
constexpr uint8_t digitHeight = 7;
constexpr unsigned long countdownFrameMs = 120;
constexpr unsigned long fireworkFrameMs = 150;

ArduinoLEDMatrix matrix;
uint8_t frame[rowCount][columnCount] = {};

enum class ShowPhase {
  Countdown,
  Fireworks
};

ShowPhase phase = ShowPhase::Countdown;
unsigned long lastFrameAt = 0;
int8_t currentDigit = 5;
int8_t digitLeft = columnCount;
uint8_t fireworkFrame = 0;
bool showEnabled = true;

const uint8_t digits[10][digitHeight] = {
  {
      0b01110,
      0b10001,
      0b10011,
      0b10101,
      0b11001,
      0b10001,
      0b01110,
  },
  {
      0b00100,
      0b01100,
      0b00100,
      0b00100,
      0b00100,
      0b00100,
      0b01110,
  },
  {
      0b01110,
      0b10001,
      0b00001,
      0b00010,
      0b00100,
      0b01000,
      0b11111,
  },
  {
      0b11110,
      0b00001,
      0b00001,
      0b01110,
      0b00001,
      0b00001,
      0b11110,
  },
  {
      0b00010,
      0b00110,
      0b01010,
      0b10010,
      0b11111,
      0b00010,
      0b00010,
  },
  {
      0b11111,
      0b10000,
      0b10000,
      0b11110,
      0b00001,
      0b00001,
      0b11110,
  },
  {
      0b00110,
      0b01000,
      0b10000,
      0b11110,
      0b10001,
      0b10001,
      0b01110,
  },
  {
      0b11111,
      0b00001,
      0b00010,
      0b00100,
      0b01000,
      0b01000,
      0b01000,
  },
  {
      0b01110,
      0b10001,
      0b10001,
      0b01110,
      0b10001,
      0b10001,
      0b01110,
  },
  {
      0b01110,
      0b10001,
      0b10001,
      0b01111,
      0b00001,
      0b00010,
      0b01100,
  },
};

void clearFrame() {
  for (uint8_t row = 0; row < rowCount; row++) {
    for (uint8_t col = 0; col < columnCount; col++) {
      frame[row][col] = 0;
    }
  }
}

void setPixel(int8_t x, int8_t y) {
  if (x < 0 || x >= columnCount || y < 0 || y >= rowCount) {
    return;
  }

  frame[y][x] = 1;
}

void render() {
  matrix.renderBitmap(frame, rowCount, columnCount);
}

void drawScrollingDigit(int8_t digit, int8_t left) {
  clearFrame();

  for (uint8_t y = 0; y < digitHeight; y++) {
    for (uint8_t x = 0; x < digitWidth; x++) {
      const bool isOn = (digits[digit][y] & (1 << (digitWidth - 1 - x))) != 0;
      if (isOn) {
        setPixel(left + x, y);
      }
    }
  }

  render();
}

void resetCountdown() {
  phase = ShowPhase::Countdown;
  currentDigit = 5;
  digitLeft = columnCount;
}

void drawFireworkFrame(uint8_t index) {
  clearFrame();

  switch (index) {
    case 0:
      setPixel(5, 4);
      setPixel(6, 4);
      break;
    case 1:
      setPixel(5, 3);
      setPixel(6, 3);
      setPixel(4, 4);
      setPixel(5, 4);
      setPixel(6, 4);
      setPixel(7, 4);
      setPixel(5, 5);
      setPixel(6, 5);
      break;
    case 2:
      setPixel(5, 1);
      setPixel(6, 1);
      setPixel(3, 3);
      setPixel(8, 3);
      setPixel(2, 4);
      setPixel(9, 4);
      setPixel(3, 5);
      setPixel(8, 5);
      setPixel(5, 7);
      setPixel(6, 7);
      break;
    case 3:
      setPixel(0, 0);
      setPixel(3, 1);
      setPixel(8, 1);
      setPixel(11, 0);
      setPixel(1, 3);
      setPixel(10, 3);
      setPixel(0, 7);
      setPixel(3, 6);
      setPixel(8, 6);
      setPixel(11, 7);
      break;
    case 4:
      setPixel(2, 0);
      setPixel(9, 0);
      setPixel(5, 2);
      setPixel(6, 2);
      setPixel(1, 5);
      setPixel(10, 5);
      setPixel(4, 7);
      setPixel(7, 7);
      break;
    case 5:
      setPixel(1, 1);
      setPixel(10, 1);
      setPixel(4, 3);
      setPixel(7, 3);
      setPixel(2, 6);
      setPixel(9, 6);
      break;
    default:
      break;
  }

  render();
}
}

void setupMatrixShow() {
  matrix.begin();
  clearFrame();
  render();
  lastFrameAt = millis();
}

void updateMatrixShow() {
  if (!showEnabled) {
    return;
  }

  const unsigned long now = millis();
  const unsigned long interval =
      phase == ShowPhase::Countdown ? countdownFrameMs : fireworkFrameMs;

  if (now - lastFrameAt < interval) {
    return;
  }

  lastFrameAt = now;

  if (phase == ShowPhase::Countdown) {
    drawScrollingDigit(currentDigit, digitLeft);
    digitLeft--;

    if (digitLeft < -static_cast<int8_t>(digitWidth)) {
      currentDigit--;
      digitLeft = columnCount;

      if (currentDigit < 1) {
        phase = ShowPhase::Fireworks;
        fireworkFrame = 0;
      }
    }

    return;
  }

  drawFireworkFrame(fireworkFrame);
  fireworkFrame++;

  if (fireworkFrame > 7) {
    resetCountdown();
  }
}

void setMatrixShowEnabled(bool enabled) {
  showEnabled = enabled;

  if (!showEnabled) {
    clearFrame();
    render();
  } else {
    lastFrameAt = millis();
  }
}

void resetMatrixShow() {
  showEnabled = true;
  resetCountdown();
  lastFrameAt = millis();
  clearFrame();
  render();
}

void triggerFireworks() {
  showEnabled = true;
  phase = ShowPhase::Fireworks;
  fireworkFrame = 0;
  lastFrameAt = millis();
  drawFireworkFrame(fireworkFrame);
}
