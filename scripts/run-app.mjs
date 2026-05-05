#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {appDir, apps} from './app-catalog.mjs';

const [appId, script = 'check', ...args] = process.argv.slice(2);
const app = apps.find((item) => item.id === appId);

if (!app) {
  console.error(`Unknown app id: ${appId ?? '(missing)'}`);
  console.error(`Available app ids: ${apps.map((item) => item.id).join(', ')}`);
  process.exit(1);
}

const result = spawnSync('npm', ['run', script, ...args], {
  cwd: appDir(app),
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
