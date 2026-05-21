#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = path.join(rootDir, 'release');
const packageName = 'App2-Campus-Service-Robot';
const outDir = path.join(outRoot, packageName);

const copyPairs = [
  ['啟動-App2.command', 'start-app2-mac.command'],
  ['啟動-App2.bat', 'start-app2-windows.bat'],
  ['scripts/start-app2.mjs', 'scripts/start-app2.mjs'],
  ['google ai studio/app_2（國小）/robot_app2.jsx', 'robot_app2.jsx'],
  ['google ai studio/app_2（國小）/校園服務機器人 app', 'app2'],
];

function shouldSkip(entryPath) {
  const base = path.basename(entryPath);
  return base === 'node_modules' ||
    base === 'dist' ||
    base === '.DS_Store' ||
    base.endsWith('.log') ||
    (base.startsWith('.env') && base !== '.env.example');
}

function copyRecursive(src, dest) {
  if (shouldSkip(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, {recursive: true});
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  fs.copyFileSync(src, dest);
}

fs.rmSync(outDir, {recursive: true, force: true});
fs.mkdirSync(outDir, {recursive: true});

for (const [from, to] of copyPairs) {
  copyRecursive(path.join(rootDir, from), path.join(outDir, to));
}

fs.chmodSync(path.join(outDir, 'start-app2-mac.command'), 0o755);
fs.chmodSync(path.join(outDir, 'scripts/start-app2.mjs'), 0o755);

const readme = `# App2 校園服務機器人啟動包

## Mac

雙擊 \`start-app2-mac.command\`。

## Windows

雙擊 \`start-app2-windows.bat\`。

## 自動安裝

啟動器會盡量自動檢查並安裝：

- Node.js / npm
- App2 npm dependencies
- Python YOLO dependencies（Python、ultralytics、opencv-python、numpy）

如果系統無法自動安裝 Node.js，啟動器會開啟 Node.js 下載頁。

## 預設網址

- App2 前端：http://localhost:3000
- App2 bridge：http://localhost:3203
`;

fs.writeFileSync(path.join(outDir, 'README-App2.md'), readme, 'utf8');

const zipPath = path.join(outRoot, `${packageName}.zip`);
fs.rmSync(zipPath, {force: true});
try {
  execFileSync('zip', ['-qr', zipPath, packageName], {cwd: outRoot, stdio: 'inherit'});
  console.log(`已輸出：${zipPath}`);
} catch {
  console.log(`已輸出資料夾：${outDir}`);
  console.log('目前系統沒有 zip 指令，因此未建立 zip 檔。');
}
