import assert from 'node:assert/strict';
import {analyzeWhiteboardPixels} from './boardVision';
import {detectBoardCalibrationFromPixels} from './whiteboardCalibration';

const frame = new Uint8ClampedArray(40 * 24 * 4);
for (let i = 0; i < frame.length; i += 4) {
  const pixel = i / 4;
  const hasInk = pixel % 5 === 0 || pixel % 11 === 0;
  frame[i] = hasInk ? 40 : 245;
  frame[i + 1] = hasInk ? 42 : 246;
  frame[i + 2] = hasInk ? 44 : 248;
  frame[i + 3] = 255;
}

const result = analyzeWhiteboardPixels(40, 24, frame);
assert.ok(result.metrics.inkDensity > 0);
assert.ok(result.metrics.blankArea > 0);
assert.notEqual(result.quality.level, 'poor');
assert.equal(result.regions.length, 3);
assert.match(result.recommendation, /本機像素辨識/);
assert.ok(result.evidence.some((item) => item.includes('畫面品質')));
assert.ok(result.evidence.some((item) => item.includes('筆跡密度')));

const darkFrame = new Uint8ClampedArray(24 * 24 * 4).fill(18);
for (let i = 3; i < darkFrame.length; i += 4) darkFrame[i] = 255;
const darkResult = analyzeWhiteboardPixels(24, 24, darkFrame);
assert.notEqual(darkResult.quality.level, 'good');
assert.ok(darkResult.quality.hints.some((item) => item.includes('光線偏暗')));

const boardFrame = new Uint8ClampedArray(80 * 60 * 4);
for (let i = 0; i < boardFrame.length; i += 4) {
  const pixel = i / 4;
  const x = pixel % 80;
  const y = Math.floor(pixel / 80);
  const insideBoard = x >= 10 && x <= 70 && y >= 8 && y <= 52;
  const shade = insideBoard ? 242 : 78;
  boardFrame[i] = shade;
  boardFrame[i + 1] = shade;
  boardFrame[i + 2] = shade;
  boardFrame[i + 3] = 255;
}
const detection = detectBoardCalibrationFromPixels(80, 60, boardFrame);
assert.ok(detection.confidence > 40);
assert.ok(detection.calibration.topLeft.x >= 10 && detection.calibration.topLeft.x <= 20);
assert.ok(detection.calibration.topLeft.y >= 8 && detection.calibration.topLeft.y <= 18);
assert.ok(detection.calibration.bottomRight.x >= 80 && detection.calibration.bottomRight.x <= 92);
assert.ok(detection.calibration.bottomRight.y >= 78 && detection.calibration.bottomRight.y <= 92);

for (let round = 0; round < 500; round += 1) {
  const width = 32 + (round % 9);
  const height = 24 + (round % 7);
  const synthetic = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < synthetic.length; i += 4) {
    const pixel = i / 4;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    const ink = (x * 7 + y * 11 + round * 13) % (5 + (round % 6)) === 0;
    const shade = ink ? 35 + (round % 45) : 218 + ((x + y + round) % 32);
    synthetic[i] = shade;
    synthetic[i + 1] = Math.min(255, shade + 1);
    synthetic[i + 2] = Math.min(255, shade + 2);
    synthetic[i + 3] = 255;
  }
  const sample = analyzeWhiteboardPixels(width, height, synthetic);
  assert.equal(sample.regions.length, 3, `round ${round}: expected 3 board regions`);
  assert.ok(sample.metrics.inkDensity >= 0 && sample.metrics.inkDensity <= 100, `round ${round}: inkDensity out of bounds`);
  assert.ok(sample.metrics.edgeDensity >= 0 && sample.metrics.edgeDensity <= 100, `round ${round}: edgeDensity out of bounds`);
  assert.ok(sample.metrics.blankArea >= 0 && sample.metrics.blankArea <= 100, `round ${round}: blankArea out of bounds`);
  assert.ok(sample.quality.metrics.brightness >= 0 && sample.quality.metrics.brightness <= 100, `round ${round}: quality brightness out of bounds`);
  assert.ok(sample.evidence.length >= 5, `round ${round}: missing evidence`);
}

console.log('boardVision.test.ts: all assertions passed, including 500-round pixel validation');
