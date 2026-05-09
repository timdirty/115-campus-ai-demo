#!/usr/bin/env node
/**
 * setup-all.mjs — 一鍵安裝三個 App 的 npm 依賴（跨平台 Mac / Windows / Linux）
 * 首次 clone 後執行一次；之後只在 package.json 有變動時重跑。
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apps, appDir } from './app-catalog.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const npm = isWin ? 'npm.cmd' : 'npm';

function install(label, cwd) {
  console.log(`\n📦  ${label}`);
  execSync(`${npm} install --prefer-offline --no-audit --no-fund`, {
    cwd,
    stdio: 'inherit',
    shell: isWin,
  });
  console.log(`    ✅ 完成`);
}

console.log('🚀  安裝所有依賴（首次約需 1-3 分鐘，之後幾秒）\n');

install('根目錄  (concurrently 等工具)', rootDir);
for (const app of apps) {
  install(`${app.name}  (${app.path})`, appDir(app));
}

console.log('\n✅  全部安裝完成！');
console.log('    Mac   → 雙擊 啟動.command');
console.log('    Win   → 雙擊 啟動.bat\n');
