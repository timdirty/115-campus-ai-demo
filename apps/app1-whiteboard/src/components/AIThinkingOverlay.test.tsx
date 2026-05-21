import type React from 'react';
import assert from 'node:assert/strict';
import {AIThinkingOverlay} from './AIThinkingOverlay';

const _validate: React.FC<any> = AIThinkingOverlay;
assert.ok(typeof AIThinkingOverlay === 'function', 'should export function');

console.log('AIThinkingOverlay shape test passed');
