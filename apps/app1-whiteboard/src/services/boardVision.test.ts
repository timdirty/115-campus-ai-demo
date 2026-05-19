import assert from 'node:assert/strict';
import {
  analyzeWhiteboardPixels,
  detectMotionInRobotZone,
  DEFAULT_MOTION_THRESHOLD,
  DEFAULT_ROBOT_ZONE,
} from './boardVision';
import {detectBoardCalibrationFromPixels} from './whiteboardCalibration';

function makeFrame(width: number, height: number, fill: (x: number, y: number) => number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const v = fill(x, y);
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }
  return data;
}

// 1) Identical frames → no motion.
{
  const a = makeFrame(80, 60, () => 200);
  const b = makeFrame(80, 60, () => 200);
  const r = detectMotionInRobotZone(80, 60, a, b);
  assert.equal(r.triggered, false, 'identical frames should not trigger');
  assert.ok(r.intensity < 1, 'identical frames intensity should be near 0');
  assert.ok(r.samples > 0, 'identical frames should still sample pixels');
}

// 2) Full-frame swing → trigger.
{
  const a = makeFrame(80, 60, () => 0);
  const b = makeFrame(80, 60, () => 255);
  const r = detectMotionInRobotZone(80, 60, a, b);
  assert.equal(r.triggered, true, 'full luma swing must trigger');
  assert.ok(r.intensity >= 90, 'full luma swing should be near max intensity');
}

// 3) Change only OUTSIDE the bottom-band zone → no trigger (zone protects against ceiling noise).
{
  const a = makeFrame(80, 60, () => 200);
  const b = makeFrame(80, 60, (x, y) => (y < 30 ? 10 : 200));  // change only top half
  const r = detectMotionInRobotZone(80, 60, a, b);  // default zone = bottom 30%
  assert.equal(r.triggered, false, 'changes outside path zone must be ignored');
  assert.ok(r.intensity < DEFAULT_MOTION_THRESHOLD, 'intensity below threshold expected');
}

// 4) Change only INSIDE the bottom-band zone → trigger.
{
  const a = makeFrame(80, 60, () => 200);
  const b = makeFrame(80, 60, (x, y) => (y >= 42 ? 10 : 200));  // change only bottom 30%
  const r = detectMotionInRobotZone(80, 60, a, b);
  assert.equal(r.triggered, true, 'changes inside path zone must trigger');
}

// 5) Threshold boundary: small uniform diff → controllable by threshold.
{
  const a = makeFrame(80, 60, () => 100);
  const b = makeFrame(80, 60, () => 120);  // diff = 20/255 → ~7.8 intensity
  const lowThreshold = detectMotionInRobotZone(80, 60, a, b, DEFAULT_ROBOT_ZONE, 5);
  const highThreshold = detectMotionInRobotZone(80, 60, a, b, DEFAULT_ROBOT_ZONE, 50);
  assert.equal(lowThreshold.triggered, true, 'low threshold should detect mild diff');
  assert.equal(highThreshold.triggered, false, 'high threshold should ignore mild diff');
}

// 6) Custom zone + step still samples the right region.
{
  const a = makeFrame(80, 60, () => 200);
  // change only a 10x10 patch top-left (x:0..10, y:0..10)
  const b = makeFrame(80, 60, (x, y) => (x < 10 && y < 10 ? 0 : 200));
  const topLeft = {x: 0, y: 0, width: 0.2, height: 0.2};  // covers the patch
  const elsewhere = {x: 0.5, y: 0.5, width: 0.5, height: 0.5};
  const tlResult = detectMotionInRobotZone(80, 60, a, b, topLeft, 5, 2);
  const elseResult = detectMotionInRobotZone(80, 60, a, b, elsewhere, 5, 2);
  assert.equal(tlResult.triggered, true, 'zone-aligned patch should trigger');
  assert.equal(elseResult.triggered, false, 'zone away from patch should not trigger');
  assert.ok(tlResult.samples > 0 && elseResult.samples > 0, 'both zones should sample');
}

// 7) Degenerate inputs do not crash.
{
  const tiny = makeFrame(2, 2, () => 100);
  const empty = detectMotionInRobotZone(0, 0, tiny, tiny);
  assert.equal(empty.triggered, false);
  assert.equal(empty.samples, 0);
  const outOfRange = detectMotionInRobotZone(2, 2, tiny, tiny, {x: 2, y: 2, width: 1, height: 1});
  assert.equal(outOfRange.triggered, false);
  assert.equal(outOfRange.samples, 0);
}

console.log('boardVision.test.ts: motion detector assertions passed (7 cases)');


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
assert.equal(result.regions.length, 2);
assert.match(result.recommendation, /白板照片判斷/);
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
  assert.equal(sample.regions.length, 2, `round ${round}: expected 2 board regions`);
  assert.ok(sample.metrics.inkDensity >= 0 && sample.metrics.inkDensity <= 100, `round ${round}: inkDensity out of bounds`);
  assert.ok(sample.metrics.edgeDensity >= 0 && sample.metrics.edgeDensity <= 100, `round ${round}: edgeDensity out of bounds`);
  assert.ok(sample.metrics.blankArea >= 0 && sample.metrics.blankArea <= 100, `round ${round}: blankArea out of bounds`);
  assert.ok(sample.quality.metrics.brightness >= 0 && sample.quality.metrics.brightness <= 100, `round ${round}: quality brightness out of bounds`);
  assert.ok(sample.evidence.length >= 5, `round ${round}: missing evidence`);
}

console.log('boardVision.test.ts: all assertions passed, including 500-round pixel validation');
