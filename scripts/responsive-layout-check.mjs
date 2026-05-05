#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {rootDir} from './app-catalog.mjs';

const viewports = [
  {name: 'phone', width: 390, height: 844},
  {name: 'tablet', width: 768, height: 1024},
  {name: 'desktop', width: 1280, height: 900},
];

for (const viewport of viewports) {
  console.log(`\n== Responsive layout: ${viewport.name} ${viewport.width}x${viewport.height} ==`);
  const result = spawnSync('node', ['scripts/mobile-layout-check.mjs'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      MOBILE_CHECK_WIDTH: String(viewport.width),
      MOBILE_CHECK_HEIGHT: String(viewport.height),
      MOBILE_CHECK_PORT: String(4180 + viewports.indexOf(viewport)),
    },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('Responsive layout check passed.');
