#!/usr/bin/env node
// 一鍵啟動三組獨立的開發環境（vite + 自家 bridge）。
// 每組互不依賴，bridge port 各自獨立（依 app-catalog.mjs 設定）。
import concurrently from 'concurrently';
import { exec, execSync } from 'node:child_process';
import { appDir, apps } from './app-catalog.mjs';

const isWin = process.platform === 'win32';

// ── 跨平台 port 清理 ──
function freePort(port) {
  try {
    if (isWin) {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      const pids = [...new Set(
        out.split('\n')
          .map(l => l.trim().split(/\s+/).pop())
          .filter(p => /^\d+$/.test(p) && p !== '0')
      )];
      for (const pid of pids) {
        try { execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' }); } catch { /* ok */ }
      }
    } else {
      const pids = execSync(`lsof -ti :${port} 2>/dev/null`, { encoding: 'utf8' }).trim();
      if (pids) execSync(`kill -9 ${pids.split('\n').join(' ')} 2>/dev/null || true`);
    }
  } catch { /* port already free */ }
}

const portsToClear = new Set();
for (const app of apps) {
  portsToClear.add(app.devPort);
  portsToClear.add(app.bridgePort);
}
for (const port of portsToClear) {
  freePort(port);
  console.log(`[dev] port ${port} cleared`);
}

// ── 自動開瀏覽器（伺服器啟動後約 5 秒）──
function openUrl(url) {
  const cmd = isWin ? `start "" "${url}"` :
    process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

setTimeout(() => {
  for (const app of apps) {
    const url = `http://localhost:${app.devPort}/`;
    console.log(`[dev] 開啟瀏覽器 → ${url}`);
    openUrl(url);
  }
}, 5000);

// ── 啟動所有服務 ──
const tasks = [];
const npm = isWin ? 'npm.cmd' : 'npm';

for (const app of apps) {
  tasks.push({
    command: `${npm} run dev:web -- --port ${app.devPort}`,
    cwd: appDir(app),
    name: `${app.shortName.replace(/\s+/g, '')}-Web`,
    prefixColor: app.devColor,
    env: { ...process.env },
  });
  tasks.push({
    command: `${npm} run dev:bridge`,
    cwd: appDir(app),
    name: `${app.shortName.replace(/\s+/g, '')}-Bridge`,
    prefixColor: 'cyan',
    env: { ...process.env, BRIDGE_PORT: String(app.bridgePort) },
  });
}

const { result } = concurrently(tasks, {
  killOthers: ['failure'],
  prefix: 'name',
  timestampFormat: 'HH:mm:ss',
});

result.then(() => process.exit(0)).catch(() => process.exit(1));
