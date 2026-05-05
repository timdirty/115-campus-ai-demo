#!/usr/bin/env node
import concurrently from 'concurrently';
import {execSync} from 'node:child_process';
import {appDir, apps, sharedBridgePort} from './app-catalog.mjs';

// Kill any leftover processes holding dev ports so restarts don't accumulate zombies
for (const port of [sharedBridgePort, 3201, ...apps.map((app) => app.devPort)]) {
  try {
    const pids = execSync(`lsof -ti :${port} 2>/dev/null`, {encoding: 'utf8'}).trim();
    if (pids) {
      execSync(`kill -9 ${pids.split('\n').join(' ')} 2>/dev/null || true`);
      console.log(`[dev] cleared port ${port}`);
    }
  } catch {
    // port already free, nothing to do
  }
}

const [app1, ...staticApps] = apps;

const {result} = concurrently(
  [
    {command: `npm run dev:web -- --port ${app1.devPort}`, cwd: appDir(app1), name: app1.devName, prefixColor: app1.devColor},
    {command: 'npm run dev:bridge', cwd: appDir(app1), name: 'App1-Bridge', prefixColor: 'cyan'},
    ...staticApps.map((app) => ({
      command: `npm run dev -- --port ${app.devPort}`,
      cwd: appDir(app),
      name: app.devName,
      prefixColor: app.devColor,
    })),
  ],
  {
    killOthers: ['failure'],
    prefix: 'name',
    timestampFormat: 'HH:mm:ss',
  },
);

result.then(() => process.exit(0)).catch(() => process.exit(1));
