#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {allGuidesUrl, appDir, apps, guidePath, guideUrl, opsGuidePath, opsGuideUrl, pagesDir} from './app-catalog.mjs';

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

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderInline(value) {
  return escapeHtml(value).replaceAll(/`([^`]+)`/g, '<code>$1</code>');
}

function renderGuideMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let inList = false;
  let inOrderedList = false;

  const closeLists = () => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
    if (inOrderedList) {
      html.push('</ol>');
      inOrderedList = false;
    }
  };

  for (const line of lines) {
    if (line.startsWith('# ')) {
      closeLists();
      html.push(`<h1>${renderInline(line.slice(2))}</h1>`);
    } else if (line.startsWith('## ')) {
      closeLists();
      html.push(`<h2>${renderInline(line.slice(3))}</h2>`);
    } else if (line.startsWith('### ')) {
      closeLists();
      html.push(`<h3>${renderInline(line.slice(4))}</h3>`);
    } else if (line.startsWith('- ')) {
      if (inOrderedList) {
        html.push('</ol>');
        inOrderedList = false;
      }
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${renderInline(line.slice(2))}</li>`);
    } else if (/^\d+\. /.test(line)) {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      if (!inOrderedList) {
        html.push('<ol>');
        inOrderedList = true;
      }
      html.push(`<li>${renderInline(line.replace(/^\d+\. /, ''))}</li>`);
    } else if (line.trim() === '') {
      closeLists();
    } else {
      closeLists();
      html.push(`<p>${renderInline(line)}</p>`);
    }
  }

  closeLists();
  return html.join('\n');
}

function writeGuidePage(app) {
  const markdown = fs.readFileSync(guidePath(app), 'utf8');
  const guideHtml = renderGuideMarkdown(markdown);
  fs.writeFileSync(path.join(pagesDir, guideUrl(app)), `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${app.name} 學生操作講稿</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", sans-serif; }
    * { box-sizing: border-box; min-width: 0; }
    body { margin: 0; background: #f5f7fb; color: #172033; }
    main { width: min(900px, calc(100% - 28px)); margin: 0 auto; padding: 22px 0 44px; }
    nav { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; }
    a { color: ${app.accent}; font-weight: 900; }
    nav a { min-height: 42px; display: inline-flex; align-items: center; border: 1px solid #d7e0ec; border-radius: 8px; background: white; padding: 0 12px; text-decoration: none; }
    article { border: 1px solid #d9e2ee; border-radius: 8px; background: white; padding: clamp(18px, 4vw, 34px); box-shadow: 0 22px 70px rgb(27 35 52 / 0.08); }
    h1 { margin: 0 0 18px; font-size: clamp(1.9rem, 8vw, 3.4rem); line-height: 1.02; letter-spacing: 0; color: #111827; }
    h2 { margin: 30px 0 12px; padding-top: 20px; border-top: 1px solid #e3e9f2; font-size: 1.35rem; }
    h3 { margin: 22px 0 8px; font-size: 1.04rem; color: #334155; }
    p, li { color: #465366; font-weight: 650; line-height: 1.78; }
    ul, ol { padding-left: 1.35rem; }
    code { border-radius: 6px; background: #eef3f8; padding: 2px 5px; font-size: .92em; }
  </style>
</head>
<body>
  <main>
    <nav aria-label="返回">
      <a href="./">返回總入口</a>
      <a href="./${app.id}/">開啟 ${app.name}</a>
    </nav>
    <article>${guideHtml}</article>
  </main>
</body>
</html>
`, 'utf8');
}

function writeOpsGuidePage(app) {
  const filePath = opsGuidePath(app);
  const url = opsGuideUrl(app);
  if (!filePath || !url || !fs.existsSync(filePath)) return;
  const markdown = fs.readFileSync(filePath, 'utf8');
  const guideHtml = renderGuideMarkdown(markdown);
  fs.writeFileSync(path.join(pagesDir, url), `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${app.name} 操作完全手冊</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", sans-serif; }
    * { box-sizing: border-box; min-width: 0; }
    body { margin: 0; background: #f5f7fb; color: #172033; }
    main { width: min(960px, calc(100% - 28px)); margin: 0 auto; padding: 22px 0 44px; }
    nav { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; }
    a { color: ${app.accent}; font-weight: 900; }
    nav a { min-height: 42px; display: inline-flex; align-items: center; border: 1px solid #d7e0ec; border-radius: 8px; background: white; padding: 0 12px; text-decoration: none; }
    article { border: 1px solid #d9e2ee; border-radius: 8px; background: white; padding: clamp(18px, 4vw, 34px); box-shadow: 0 22px 70px rgb(27 35 52 / 0.08); }
    h1 { margin: 0 0 18px; font-size: clamp(1.9rem, 8vw, 3.4rem); line-height: 1.02; letter-spacing: 0; color: #111827; }
    h2 { margin: 30px 0 12px; padding-top: 20px; border-top: 1px solid #e3e9f2; font-size: 1.35rem; }
    h3 { margin: 22px 0 8px; font-size: 1.04rem; color: #334155; }
    p, li { color: #465366; font-weight: 650; line-height: 1.78; }
    ul, ol { padding-left: 1.35rem; }
    code { border-radius: 6px; background: #eef3f8; padding: 2px 5px; font-size: .92em; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: .9rem; }
    th, td { border: 1px solid #d1dae8; padding: 8px 12px; text-align: left; }
    th { background: #f1f5f9; font-weight: 900; }
  </style>
</head>
<body>
  <main>
    <nav aria-label="返回">
      <a href="./">返回總入口</a>
      <a href="./${app.id}/">開啟 ${app.name}</a>
      <a href="./${guideUrl(app)}">學生講稿</a>
    </nav>
    <article>${guideHtml}</article>
  </main>
</body>
</html>
`, 'utf8');
}

function writeAllGuidesPage() {
  const tabs = apps.map((app, index) => `
      <a class="tab${index === 0 ? ' current' : ''}" href="#${app.id}">${app.shortName} 講稿</a>
  `).join('');
  const sections = apps.map((app) => {
    const markdown = fs.readFileSync(guidePath(app), 'utf8');
    const guideHtml = renderGuideMarkdown(markdown);
    return `
      <section id="${app.id}" class="guide-card" style="--accent:${app.accent}">
        <div class="card-top">
          <div>
            <span class="tag">${app.team}</span>
            <h2>${app.name}</h2>
            <p>${app.desc}</p>
          </div>
          <div class="actions">
            <a class="primary" href="./${app.id}/">開啟 ${app.shortName}</a>
            <a class="secondary" href="./${guideUrl(app)}">獨立講稿頁</a>
          </div>
        </div>
        <article>${guideHtml}</article>
      </section>
    `;
  }).join('');

  fs.writeFileSync(path.join(pagesDir, allGuidesUrl()), `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>115 資通訊三隊學生講稿總覽</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", sans-serif; }
    * { box-sizing: border-box; min-width: 0; }
    html { scroll-behavior: smooth; }
    body { margin: 0; background: linear-gradient(180deg, #f7fafc 0%, #edf4fb 100%); color: #172033; }
    main { width: min(1080px, calc(100% - 24px)); margin: 0 auto; padding: 24px 0 42px; }
    .topbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
    .nav-links { display: flex; flex-wrap: wrap; gap: 10px; }
    a { color: #0f4c81; font-weight: 900; }
    .nav-links a, .tab { min-height: 42px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid #d6e2f0; border-radius: 999px; background: rgb(255 255 255 / .82); padding: 0 14px; text-decoration: none; }
    header { display: grid; gap: 12px; margin-bottom: 18px; }
    .eyebrow { width: fit-content; border-radius: 999px; background: #dbeafe; color: #1d4ed8; padding: 8px 12px; font-size: 12px; font-weight: 950; letter-spacing: .14em; text-transform: uppercase; }
    h1 { margin: 0; font-size: clamp(2rem, 5vw, 4rem); line-height: 1.02; }
    .lead { max-width: 880px; margin: 0; color: #4f5c70; font-weight: 750; line-height: 1.75; }
    .tab-row { position: sticky; top: 0; z-index: 4; display: flex; flex-wrap: wrap; gap: 10px; margin: 18px 0; padding: 12px 0; backdrop-filter: blur(10px); }
    .tab.current { background: #111827; color: #fff; border-color: #111827; }
    .guide-list { display: grid; gap: 18px; }
    .guide-card { border: 1px solid #d7e1ee; border-radius: 18px; background: rgb(255 255 255 / .88); padding: clamp(18px, 3vw, 28px); box-shadow: 0 22px 64px rgb(27 35 52 / .08); }
    .card-top { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 18px; }
    .tag { display: inline-flex; margin-bottom: 10px; border-radius: 999px; background: color-mix(in srgb, var(--accent), white 86%); color: var(--accent); padding: 7px 10px; font-size: 12px; font-weight: 950; }
    h2 { margin: 0 0 8px; font-size: clamp(1.4rem, 3vw, 2rem); }
    p, li { color: #465366; font-weight: 650; line-height: 1.78; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; }
    .actions a { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; border-radius: 10px; padding: 0 14px; text-decoration: none; }
    .primary { background: #111827; color: #fff; }
    .secondary { border: 1px solid #cbd5e1; background: #fff; color: #334155; }
    article { border-top: 1px solid #e2e8f0; padding-top: 18px; }
    article h1 { font-size: clamp(1.6rem, 4vw, 2.6rem); margin-bottom: 14px; }
    article h2 { margin: 30px 0 12px; padding-top: 20px; border-top: 1px solid #e3e9f2; font-size: 1.28rem; }
    article h3 { margin: 22px 0 8px; font-size: 1.04rem; color: #334155; }
    article ul, article ol { padding-left: 1.35rem; }
    article code { border-radius: 6px; background: #eef3f8; padding: 2px 5px; font-size: .92em; }
    @media (max-width: 820px) {
      main { width: min(100% - 20px, 680px); padding: 18px 0 32px; }
      .topbar { align-items: flex-start; }
      .tab-row { top: 0; margin: 14px 0; padding: 10px 0; }
      .tab, .nav-links a { width: 100%; justify-content: flex-start; border-radius: 12px; }
      .actions a { width: 100%; }
    }
  </style>
</head>
<body>
  <main>
    <nav class="topbar" aria-label="快速切換">
      <div class="nav-links">
        <a href="./">返回總入口</a>
        <a href="./app1/">App 1</a>
        <a href="./app2/">App 2</a>
        <a href="./app3/">App 3</a>
      </div>
    </nav>
    <header>
      <span class="eyebrow">All Student Guides</span>
      <h1>115 資通訊三隊學生講稿總覽</h1>
      <p class="lead">這一頁把三隊作品操作入口和學生講稿放在同一個地方。可以先在這裡挑隊伍看講稿，也可以直接跳去對應 App 做現場展示。</p>
    </header>
    <nav class="tab-row" aria-label="講稿導覽">${tabs}
    </nav>
    <section class="guide-list">${sections}
    </section>
  </main>
</body>
</html>
`, 'utf8');
}

fs.rmSync(pagesDir, {recursive: true, force: true});
fs.mkdirSync(pagesDir, {recursive: true});

for (const app of apps) {
  const sourceDir = appDir(app);
  run('npm', ['ci'], sourceDir);
  run('npm', ['run', 'build'], sourceDir);
  copyDir(path.join(sourceDir, 'dist'), path.join(pagesDir, app.id));
  writeGuidePage(app);
  writeOpsGuidePage(app);
}

writeAllGuidesPage();

const cards = apps.map((app) => {
  const opsUrl = opsGuideUrl(app);
  const extraLink = opsUrl ? `<a class="secondary" href="./${opsUrl}">操作手冊</a>` : '';
  return `
  <article class="card" style="--accent:${app.accent}">
    <span class="tag">${app.id.toUpperCase()}</span>
    <span class="shine"></span>
    <h2>${app.name}</h2>
    <p>${app.desc}</p>
    <div class="flow">${app.flow.map((item) => `<span>${item}</span>`).join('')}</div>
    <div class="actions">
      <a class="primary" href="./${app.id}/">開啟操作 <span>→</span></a>
      <a class="secondary" href="./${app.id}-guide.html">學生講稿</a>
      ${extraLink}
    </div>
  </article>
`;
}).join('');

const quickLinks = apps.map((app) => `<a href="./${app.id}/">${app.name}</a>`).join('');

fs.writeFileSync(path.join(pagesDir, 'index.html'), `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>115 資通訊三隊 App 展示入口</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", sans-serif; }
    * { box-sizing: border-box; min-width: 0; }
    body { margin: 0; min-height: 100vh; overflow-x: hidden; background: #f4f7fb; color: #15171d; }
    body::before { content: ""; position: fixed; inset: 0; pointer-events: none; background: radial-gradient(circle at 10% 10%, rgb(0 91 179 / .12), transparent 32rem), radial-gradient(circle at 92% 14%, rgb(15 118 110 / .12), transparent 28rem); }
    main { position: relative; width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 34px 0; }
    .topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 28px; }
    .brand { display: flex; align-items: center; gap: 12px; font-weight: 950; }
    .mark { display: grid; width: 44px; height: 44px; place-items: center; border-radius: 14px; background: #111827; color: white; box-shadow: 0 14px 30px rgb(17 24 39 / .18); }
    .quick { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
    .quick a { min-height: 40px; display: inline-flex; align-items: center; border: 1px solid #dbe3ef; border-radius: 999px; padding: 0 12px; color: #445066; background: rgb(255 255 255 / .72); text-decoration: none; font-size: 12px; font-weight: 850; }
    header { margin-bottom: 22px; display: grid; gap: 16px; }
    .eyebrow { width: fit-content; border: 1px solid #cfddf0; border-radius: 999px; background: rgb(255 255 255 / .76); padding: 8px 12px; color: #2563eb; font-size: 12px; font-weight: 950; letter-spacing: .14em; text-transform: uppercase; }
    h1 { max-width: 880px; margin: 0; font-size: clamp(2.05rem, 5vw, 4.6rem); line-height: .98; letter-spacing: 0; }
    .lead { max-width: 780px; margin: 0; color: #4f5c70; font-weight: 750; line-height: 1.75; }
    .status { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; max-width: 760px; }
    .status span { min-height: 48px; display: flex; align-items: center; border: 1px solid #dce4ef; border-radius: 8px; background: rgb(255 255 255 / .78); padding: 10px 12px; color: #334155; font-size: 13px; font-weight: 900; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 24px; }
    .card { position: relative; isolation: isolate; display: flex; min-height: 272px; flex-direction: column; justify-content: space-between; gap: 18px; overflow: hidden; border: 1px solid #d9e2ee; border-radius: 8px; padding: 24px; color: inherit; text-decoration: none; background: rgb(255 255 255 / .86); box-shadow: 0 22px 70px rgb(27 35 52 / 0.10); transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease; }
    .card:hover { transform: translateY(-3px); border-color: var(--accent); box-shadow: 0 30px 86px rgb(27 35 52 / .16); }
    .shine { position: absolute; inset: auto -20% -34% auto; z-index: -1; width: 220px; aspect-ratio: 1; border-radius: 999px; background: color-mix(in srgb, var(--accent), white 72%); opacity: .5; }
    .tag { width: fit-content; border-radius: 999px; background: color-mix(in srgb, var(--accent), white 88%); color: var(--accent); padding: 7px 10px; font-size: 12px; font-weight: 950; }
    h2 { margin: 0; font-size: 1.45rem; line-height: 1.18; }
    p { margin: 0; color: #5d6879; line-height: 1.65; font-weight: 700; }
    .flow { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
    .flow span { min-height: 34px; display: grid; place-items: center; border-radius: 8px; background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 900; text-align: center; }
    .actions { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: stretch; }
    .actions a { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; padding: 0 12px; text-decoration: none; font-weight: 950; }
    .primary { justify-content: space-between !important; background: #111827; color: white; }
    .secondary { border: 1px solid #cdd8e7; background: #fff; color: #334155; }
    footer { margin-top: 22px; color: #6d7787; font-size: 13px; font-weight: 750; line-height: 1.6; }
    @media (max-width: 820px) {
      main { width: min(100% - 24px, 560px); padding: 18px 0 28px; }
      .topbar { align-items: flex-start; flex-direction: column; margin-bottom: 24px; }
      .quick { justify-content: flex-start; }
      h1 { font-size: clamp(2rem, 12vw, 3.5rem); }
      .status { grid-template-columns: 1fr; }
      .grid { grid-template-columns: 1fr; }
      .card { min-height: 232px; padding: 20px; }
      .actions { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <nav class="topbar" aria-label="快速開啟">
      <div class="brand"><span class="mark">115</span><span>三隊 App 操作台</span></div>
      <div class="quick">${quickLinks}</div>
    </nav>
    <header>
      <span class="eyebrow">Student Live Demo</span>
      <h1>115 資通訊三隊 App 展示入口</h1>
      <p class="lead">學生可以直接點選下方作品操作。App 1 在 GitHub Pages 會使用瀏覽器展示模式保存資料與模擬硬體指令；接上本機 bridge 後再走 Arduino UNO R4 Serial。</p>
      <div class="quick"><a href="./${allGuidesUrl()}">一次看三隊講稿</a></div>
      <div class="status"><span>手機可操作</span><span>資料存在本機瀏覽器</span><span>無硬體也可展示</span></div>
    </header>
    <section class="grid">${cards}</section>
    <footer>資料存在各自瀏覽器 localStorage。這是比賽展示與學生體驗網址，不是正式雲端多人資料庫。</footer>
  </main>
</body>
</html>
`, 'utf8');

fs.writeFileSync(path.join(pagesDir, '.nojekyll'), '', 'utf8');
console.log(`GitHub Pages bundle ready: ${pagesDir}`);
