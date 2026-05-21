#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = path.join(rootDir, 'release');
const packageName = 'App3-Mindful-Guardian';
const outDir = path.join(outRoot, packageName);

const copyPairs = [
  ['啟動-App3.command', 'start-app3-mac.command'],
  ['啟動-App3.bat', 'start-app3-windows.bat'],
  ['scripts/start-app3.mjs', 'scripts/start-app3.mjs'],
  ['google ai studio/app_3（國中）/AI校園心靈守護者', 'app3'],
  ['google ai studio/app_3（國中）/robot-app', 'robot-app'],
  ['yolov8n.pt', 'app3/yolov8n.pt'],
  ['yolov8n.pt', 'robot-app/yolov8n.pt'],
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

fs.chmodSync(path.join(outDir, 'start-app3-mac.command'), 0o755);
fs.chmodSync(path.join(outDir, 'scripts/start-app3.mjs'), 0o755);

const readme = `# App3 AI 校園心靈守護者啟動包

## Mac

雙擊 \`start-app3-mac.command\`。

## Windows

雙擊 \`start-app3-windows.bat\`。

## 自動安裝

啟動器會盡量自動檢查並安裝：

- Node.js / npm
- App3 npm dependencies
- Python 視覺 dependencies（Python、ultralytics、opencv-python、numpy、websockets、openai）

本包已內建 \`app3/yolov8n.pt\` 與 \`robot-app/yolov8n.pt\`，Windows 沒網路時也不需要臨時下載 YOLO 模型。

## Windows Arduino 連接

- UNO R4 插上 USB 後，系統會自動掃描 Arduino / USB Serial / CH340 / CP210x 類型的 COM port。
- 如果現場有多片板子或掃不到，請先在啟動前設定：\`set ARDUINO_PORT=COM3\`。
- App3 底盤板可另外指定：\`set DRIVE_ARDUINO_PORT=COM4\`。

## 預設網址

- App3 前端：http://localhost:11503
- App3 bridge：http://localhost:3203
- 機器人顯示：http://localhost:11503/robot-display.html
`;

fs.writeFileSync(path.join(outDir, 'README-App3.md'), readme, 'utf8');

const zipPath = path.join(outRoot, `${packageName}.zip`);
fs.rmSync(zipPath, {force: true});
try {
  execFileSync('zip', ['-qr', zipPath, packageName], {cwd: outRoot, stdio: 'inherit'});
  console.log(`已輸出：${zipPath}`);
} catch {
  console.log(`已輸出資料夾：${outDir}`);
  console.log('目前系統沒有 zip 指令，因此未建立 zip 檔。');
}
