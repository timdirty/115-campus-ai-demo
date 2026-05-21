import assert from 'node:assert/strict';
import type {ComponentType} from 'react';
import {CelebrationOverlay, type CelebrationOverlayProps} from './CelebrationOverlay';

const Validate: ComponentType<CelebrationOverlayProps> = CelebrationOverlay;
assert.ok(typeof Validate === 'object' || typeof Validate === 'function', 'CelebrationOverlay must be a renderable component');

const requiredProps: CelebrationOverlayProps = {open: false};
assert.ok('open' in requiredProps, 'props must accept open');

const fullProps: CelebrationOverlayProps = {
  open: true,
  message: '擦好了！',
  durationMs: 2600,
  onDone: () => {},
};
assert.equal(typeof fullProps.onDone, 'function');

console.log('CelebrationOverlay shape test passed');
