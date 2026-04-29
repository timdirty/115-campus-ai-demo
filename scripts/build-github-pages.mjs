#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(rootDir, 'pages-dist');

const apps = [
  {
    id: 'app1',
    name: 'AI 自動板擦機器人',
    path: 'google ai studio/app_1（國小）/AI自動板擦機器人',
    desc: '白板 AI 助教、教師決策、課堂紀錄與機器人指令展示。',
  },
  {
    id: 'app2',
    name: '校園服務機器人',
    path: 'google ai studio/app_2（國小）/校園服務機器人 app',
    desc: '配送、清潔、教學、生活服務與派遣中控台。',
  },
  {
    id: 'app3',
    name: 'AI 校園心靈守護者',
    path: 'google ai studio/app_3（國小）/AI校園心靈守護者',
    desc: '匿名關懷、預警處理、自我照護、聊天與節點監控。',
  },
];

function run(command, args, cwd) {
  const result = spawnSync(command, args, {cwd, stdio: 'inherit', shell: process.platform === 'win32'});
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed in ${cwd}`);
  }
}

function copyDir(src, dest) {
  fs.rmSync(dest, {recursive: true, force: true});
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  fs.cpSync(src, dest, {recursive: true});
}

fs.rmSync(outDir, {recursive: true, force: true});
fs.mkdirSync(outDir, {recursive: true});

for (const app of apps) {
  const appDir = path.join(rootDir, app.path);
  run('npm', ['ci'], appDir);
  run('npm', ['run', 'build'], appDir);
  copyDir(path.join(appDir, 'dist'), path.join(outDir, app.id));
}

const cards = apps.map((app) => `
  <a class="card" href="./${app.id}/">
    <span class="tag">${app.id.toUpperCase()}</span>
    <h2>${app.name}</h2>
    <p>${app.desc}</p>
    <strong>開啟 App</strong>
  </a>
`).join('');

fs.writeFileSync(path.join(outDir, 'index.html'), `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>115 資通訊三隊 App 展示入口</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; background: #f6f7fb; color: #15171d; }
    main { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 48px 0; }
    header { margin-bottom: 28px; }
    h1 { margin: 0; font-size: clamp(2rem, 4vw, 4rem); letter-spacing: 0; }
    .lead { max-width: 760px; margin: 14px 0 0; color: #5d6472; font-weight: 650; line-height: 1.7; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
    .card { display: flex; min-height: 220px; flex-direction: column; justify-content: space-between; gap: 18px; border: 1px solid #dde1ea; border-radius: 8px; padding: 24px; color: inherit; text-decoration: none; background: white; box-shadow: 0 20px 60px rgb(27 35 52 / 0.08); }
    .card:hover { transform: translateY(-2px); border-color: #6b7cff; transition: 160ms ease; }
    .tag { width: fit-content; border-radius: 999px; background: #eef1ff; color: #4455d9; padding: 7px 10px; font-size: 12px; font-weight: 900; }
    h2 { margin: 0; font-size: 1.45rem; }
    p { margin: 0; color: #606879; line-height: 1.6; font-weight: 650; }
    strong { color: #2434c8; }
    footer { margin-top: 22px; color: #747b88; font-size: 13px; font-weight: 650; line-height: 1.6; }
    @media (max-width: 820px) { .grid { grid-template-columns: 1fr; } main { padding: 28px 0; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>115 資通訊三隊 App 展示入口</h1>
      <p class="lead">學生可以直接點選下方作品操作。App 1 在 GitHub Pages 會使用瀏覽器展示模式保存資料與模擬硬體指令；接上本機 bridge 後再走 Arduino UNO R4 Serial。</p>
    </header>
    <section class="grid">${cards}</section>
    <footer>資料存在各自瀏覽器 localStorage。這是比賽展示與學生體驗網址，不是正式雲端多人資料庫。</footer>
  </main>
</body>
</html>
`, 'utf8');

fs.writeFileSync(path.join(outDir, '.nojekyll'), '', 'utf8');
console.log(`GitHub Pages bundle ready: ${outDir}`);
