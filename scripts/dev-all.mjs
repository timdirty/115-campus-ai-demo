#!/usr/bin/env node
// 一鍵啟動三組獨立的開發環境（vite + 自家 bridge）。
// 每組互不依賴，bridge port 各自獨立（3201 / 3202 / 3203）。
import concurrently from 'concurrently';
import {execSync} from 'node:child_process';
import {appDir, apps} from './app-catalog.mjs';

// Clear any leftover processes holding any of our dev / bridge ports
const portsToClear = new Set();
for (const app of apps) {
  portsToClear.add(app.devPort);
  portsToClear.add(app.bridgePort);
}

for (const port of portsToClear) {
  try {
    const pids = execSync(`lsof -ti :${port} 2>/dev/null`, {encoding: 'utf8'}).trim();
    if (pids) {
      execSync(`kill -9 ${pids.split('\n').join(' ')} 2>/dev/null || true`);
      console.log(`[dev] cleared port ${port}`);
    }
  } catch {
    // port already free
  }
}

const tasks = [];
for (const app of apps) {
  tasks.push({
    command: `npm run dev:web -- --port ${app.devPort}`,
    cwd: appDir(app),
    name: `${app.shortName.replace(/\s+/g, '')}-Web`,
    prefixColor: app.devColor,
  });
  tasks.push({
    command: 'npm run dev:bridge',
    cwd: appDir(app),
    name: `${app.shortName.replace(/\s+/g, '')}-Bridge`,
    prefixColor: 'cyan',
    env: {BRIDGE_PORT: String(app.bridgePort)},
  });
}

const {result} = concurrently(tasks, {
  killOthers: ['failure'],
  prefix: 'name',
  timestampFormat: 'HH:mm:ss',
});

result.then(() => process.exit(0)).catch(() => process.exit(1));
