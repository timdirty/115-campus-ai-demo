import assert from 'node:assert/strict';
import {analyzeWhiteboardPixels} from './boardVision';

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
assert.equal(result.regions.length, 3);
assert.match(result.recommendation, /本機像素辨識/);
assert.ok(result.evidence.some((item) => item.includes('筆跡密度')));

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
  assert.ok(sample.evidence.length >= 4, `round ${round}: missing evidence`);
}

console.log('boardVision.test.ts: all assertions passed, including 500-round pixel validation');
