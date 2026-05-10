#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {allGuidesUrl, appDir, apps, guidePath, guideUrl, opsGuidePath, opsGuideUrl, pagesDir, rootDir} from './app-catalog.mjs';

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

function copyScreenshots() {
  const src = path.join(rootDir, 'assets', 'screenshots');
  if (!fs.existsSync(src)) return;
  const dest = path.join(pagesDir, 'screenshots');
  fs.mkdirSync(dest, {recursive: true});
  fs.cpSync(src, dest, {recursive: true});
  console.log('Screenshots copied to pages-dist/screenshots/');
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

  // Pre-launch generic checklist items
  const preLaunchItems = [
    `開啟 <a href="./${app.id}/" style="color:${app.accent};font-weight:900">App 網址</a>，確認畫面正常載入`,
    '確認螢幕夠亮、評審可以清楚看到畫面',
    '把下方展示步驟看一遍，知道每步要點哪裡',
    '網路斷線也沒關係：資料存在瀏覽器本機，可以離線展示',
  ];
  const checklistHtml = [
    ...preLaunchItems.map((item) => `<label class="check-item"><input type="checkbox"><span>${item}</span></label>`),
    `<div class="check-divider">展示步驟確認</div>`,
    ...app.checklistItems.map((item) => `<label class="check-item"><input type="checkbox"><span>${escapeHtml(item)}</span></label>`),
  ].join('\n');

  // Numbered demo steps with screenshot frames
  const stepsHtml = app.checklistItems.map((item, i) => {
    const num = String(i + 1).padStart(2, '0');
    const imgSrc = `./screenshots/${app.id}-step${i + 1}.png`;
    return `<div class="step">
      <div class="step-num">${num}</div>
      <div class="step-body">
        <p class="step-title">${escapeHtml(item)}</p>
        <div class="screenshot-frame">
          <img src="${imgSrc}" alt="步驟 ${num} 操作畫面" loading="lazy"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <div class="no-img-placeholder">
            <span class="no-img-icon">📷</span>
            <span>步驟 ${num} 截圖</span>
          </div>
        </div>
      </div>
    </div>`;
  }).join('\n');

  // Flow visualization
  const flowHtml = app.flow.map((label, i) => `<div class="flow-step">
      <div class="flow-circle">${i + 1}</div>
      <div class="flow-label">${escapeHtml(label)}</div>
    </div>${i < app.flow.length - 1 ? '<div class="flow-arrow">→</div>' : ''}`).join('\n');

  // Must-show self-check list
  const mustShowHtml = app.scorecardMustShow.map((item) => `<label class="must-item">
      <input type="checkbox">
      <div class="must-text">${renderInline(item)}</div>
    </label>`).join('\n');

  // Q&A from structured catalog data
  const qaHtml = app.judgeQaExtra.map((qa) => `<details class="qa-card">
      <summary class="qa-q">${escapeHtml(qa.q)}</summary>
      <div class="qa-a">${renderInline(qa.a)}</div>
    </details>`).join('\n');

  // Emergency backup scenarios
  const emergencyItems = [
    ['網路斷線 / 無 API key', '沒關係。系統有 Demo 模式，全流程可以在瀏覽器本機完成，告訴評審「這是我們刻意設計的 fallback」。'],
    ['Arduino / 硬體沒反應', '指令會保存在 log 紀錄中，繼續展示軟體流程，最後說「接上 UNO R4 後這裡會變成實體動作」。'],
    [`App 白畫面 / 閃退`, `直接重新開啟網址：timdirty.github.io/115-campus-ai-demo/${app.id}/`],
    ['評審問到不知道怎麼回的問題', '說「這是很好的問題，我們有設計 fallback 確保即使 X 失敗也能繼續展示，讓我在 App 裡示範給您看」。'],
  ];
  const emergencyHtml = emergencyItems.map(([scenario, solution]) => `<div class="emergency-item">
      <div class="emergency-scenario">🚨 ${escapeHtml(scenario)}</div>
      <div class="emergency-solution">✓ ${escapeHtml(solution)}</div>
    </div>`).join('\n');

  const hardwareNote = app.hardwarePitchNote
    ? `<div class="hardware-note">🤖 硬體亮點：${escapeHtml(app.hardwarePitchNote)}</div>`
    : '';

  fs.writeFileSync(path.join(pagesDir, guideUrl(app)), `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(app.name)} — 手把手操作教學</title>
  <style>
    :root { --accent: ${app.accent}; color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", sans-serif; }
    * { box-sizing: border-box; min-width: 0; }
    body { margin: 0; background: #f3f6fb; color: #172033; }
    main { width: min(900px, calc(100% - 24px)); margin: 0 auto; padding: 20px 0 56px; display: grid; gap: 16px; }
    a { color: var(--accent); }

    /* Top nav */
    .topnav { display: flex; flex-wrap: wrap; gap: 8px; }
    .topnav a { min-height: 40px; display: inline-flex; align-items: center; border: 1px solid #d7e0ec; border-radius: 8px; background: white; padding: 0 14px; text-decoration: none; color: #334155; font-weight: 900; font-size: 14px; }
    .topnav .open-btn { background: var(--accent); color: white; border-color: var(--accent); }

    /* Hero */
    .hero { border-radius: 16px; padding: 28px 28px 24px; background: color-mix(in srgb, var(--accent), white 88%); border: 1px solid color-mix(in srgb, var(--accent), white 62%); position: relative; overflow: hidden; }
    .hero::after { content: ""; position: absolute; inset: auto -8% -20% auto; width: 240px; aspect-ratio: 1; border-radius: 999px; background: color-mix(in srgb, var(--accent), white 55%); opacity: .45; pointer-events: none; }
    .hero-tag { display: inline-block; border-radius: 999px; background: var(--accent); color: white; padding: 6px 12px; font-size: 11px; font-weight: 950; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 12px; }
    .hero h1 { margin: 0 0 4px; font-size: clamp(1.75rem, 6vw, 3rem); line-height: 1.08; color: #111827; }
    .hero-sub { display: block; font-size: clamp(.95rem, 3vw, 1.35rem); font-weight: 700; color: color-mix(in srgb, var(--accent), #334155 40%); margin-top: 4px; }
    .hero-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; align-items: center; }
    .hero-btn { min-height: 48px; display: inline-flex; align-items: center; padding: 0 22px; border-radius: 10px; background: var(--accent); color: white; text-decoration: none; font-weight: 950; font-size: 1rem; position: relative; z-index: 1; }
    .hero-badges { display: flex; flex-wrap: wrap; gap: 6px; }
    .badge { border: 1px solid color-mix(in srgb, var(--accent), white 50%); border-radius: 999px; padding: 5px 10px; font-size: 12px; font-weight: 900; color: color-mix(in srgb, var(--accent), #334155 30%); background: white; }

    /* Section card */
    .card { background: white; border: 1px solid #dde4ef; border-radius: 12px; padding: clamp(16px, 3vw, 26px); box-shadow: 0 4px 20px rgb(27 35 52 / .05); }
    .section-title { margin: 0 0 14px; font-size: 1.05rem; font-weight: 950; color: #111827; }

    /* Flow */
    .flow-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
    .flow-step { display: flex; align-items: center; gap: 10px; }
    .flow-circle { width: 36px; height: 36px; border-radius: 50%; background: var(--accent); color: white; font-weight: 950; font-size: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .flow-label { font-weight: 900; color: #334155; font-size: 15px; }
    .flow-arrow { font-size: 18px; color: #94a3b8; font-weight: 900; }

    /* Hardware note */
    .hardware-note { margin-top: 12px; padding: 10px 14px; border-radius: 8px; background: color-mix(in srgb, var(--accent), white 90%); border: 1px solid color-mix(in srgb, var(--accent), white 62%); color: color-mix(in srgb, var(--accent), #1e293b 25%); font-weight: 800; font-size: .93rem; }

    /* Checklist */
    .check-item { display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f1f5f9; cursor: pointer; }
    .check-item:last-child { border-bottom: none; }
    .check-item input[type=checkbox] { width: 18px; height: 18px; margin-top: 3px; accent-color: var(--accent); flex-shrink: 0; cursor: pointer; }
    .check-item span { color: #465366; font-weight: 700; line-height: 1.65; }
    .check-item input:checked + span { text-decoration: line-through; color: #94a3b8; }
    .check-divider { margin: 14px 0 6px; font-size: 11px; font-weight: 950; color: #94a3b8; letter-spacing: .1em; text-transform: uppercase; border-top: 1px solid #f1f5f9; padding-top: 14px; }

    /* Steps */
    .steps { display: grid; gap: 20px; }
    .step { display: flex; gap: 16px; align-items: flex-start; }
    .step-num { width: 48px; height: 48px; border-radius: 12px; background: var(--accent); color: white; font-size: 1.05rem; font-weight: 950; display: flex; align-items: center; justify-content: center; flex-shrink: 0; letter-spacing: -.02em; }
    .step-body { flex: 1; min-width: 0; }
    .step-title { margin: 0 0 12px; font-size: 1rem; font-weight: 850; color: #1e293b; line-height: 1.65; }
    .screenshot-frame { border-radius: 10px; overflow: hidden; border: 1.5px solid #e2e8f0; background: #f8fafc; }
    .screenshot-frame img { width: 100%; display: block; }
    .no-img-placeholder { display: none; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 28px 20px; color: #94a3b8; font-size: 13px; font-weight: 700; text-align: center; min-height: 120px; }
    .no-img-icon { font-size: 2rem; line-height: 1; }

    /* Must-show self-check */
    .must-list { display: grid; gap: 7px; }
    .must-item { display: flex; gap: 10px; align-items: flex-start; padding: 11px 14px; border-radius: 8px; background: #f0fdf4; border: 1px solid #bbf7d0; cursor: pointer; }
    .must-item input[type=checkbox] { width: 17px; height: 17px; margin-top: 3px; accent-color: #16a34a; flex-shrink: 0; cursor: pointer; }
    .must-item input:checked + .must-text { text-decoration: line-through; color: #86efac; }
    .must-text { color: #14532d; font-weight: 700; line-height: 1.65; font-size: .92rem; }
    .must-text code { background: #dcfce7; border-radius: 4px; padding: 1px 4px; font-size: .88em; font-family: monospace; }

    /* Q&A */
    .qa-card { border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
    .qa-card + .qa-card { margin-top: 8px; }
    .qa-q { padding: 13px 16px; font-weight: 900; color: #1e293b; cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between; gap: 8px; background: #f8fafc; font-size: .95rem; }
    .qa-q::after { content: "▼"; font-size: 11px; color: #94a3b8; flex-shrink: 0; }
    .qa-card[open] .qa-q::after { content: "▲"; }
    .qa-a { padding: 13px 16px; color: #465366; font-weight: 700; line-height: 1.75; border-top: 1px solid #e2e8f0; font-size: .93rem; }
    .qa-a code { background: #eef3f8; border-radius: 4px; padding: 1px 4px; font-size: .9em; font-family: monospace; }

    /* Emergency */
    .emergency-list { display: grid; gap: 10px; }
    .emergency-item { border-radius: 10px; overflow: hidden; border: 1px solid #fecaca; }
    .emergency-scenario { padding: 10px 14px; background: #fff1f2; font-weight: 900; font-size: .93rem; color: #991b1b; }
    .emergency-solution { padding: 10px 14px; background: #f0fdf4; font-weight: 700; font-size: .9rem; color: #14532d; border-top: 1px solid #fecaca; line-height: 1.6; }

    /* Detailed script collapsible */
    .script-details { border: 1px solid #dde4ef; border-radius: 12px; overflow: hidden; background: white; }
    .script-summary { padding: 15px 20px; cursor: pointer; font-weight: 950; color: #334155; background: #f8fafc; list-style: none; display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: .95rem; }
    .script-summary::after { content: "展開 ▼"; font-size: 12px; color: #94a3b8; font-weight: 700; }
    .script-details[open] .script-summary::after { content: "收起 ▲"; }
    .script-content { padding: clamp(16px, 3vw, 28px); border-top: 1px solid #e2e8f0; }
    .script-content h1 { margin: 0 0 18px; font-size: clamp(1.4rem, 5vw, 2.2rem); color: #111827; }
    .script-content h2 { margin: 26px 0 10px; padding-top: 18px; border-top: 1px solid #e3e9f2; font-size: 1.12rem; }
    .script-content h3 { margin: 16px 0 6px; font-size: .98rem; color: #334155; }
    .script-content p, .script-content li { color: #465366; font-weight: 650; line-height: 1.78; }
    .script-content ul, .script-content ol { padding-left: 1.35rem; }
    .script-content code { border-radius: 6px; background: #eef3f8; padding: 2px 5px; font-size: .92em; font-family: monospace; }

    @media (max-width: 600px) {
      .hero { padding: 20px; }
      .step { flex-direction: column; gap: 8px; }
      .step-num { width: 40px; height: 40px; font-size: .95rem; border-radius: 10px; }
      .flow-bar { gap: 6px; }
    }
  </style>
</head>
<body>
  <main>
    <nav class="topnav" aria-label="導覽">
      <a href="./">← 返回總入口</a>
      <a class="open-btn" href="./${app.id}/">開啟 ${escapeHtml(app.name)} →</a>
    </nav>

    <div class="hero">
      <div class="hero-tag">${app.id.toUpperCase()} — ${escapeHtml(app.team)}</div>
      <h1>${escapeHtml(app.name)}<span class="hero-sub">手把手操作教學</span></h1>
      <div class="hero-row">
        <a class="hero-btn" href="./${app.id}/">開啟 App 開始展示 →</a>
        <div class="hero-badges">
          <span class="badge">手機可操作</span>
          <span class="badge">無硬體也可展示</span>
          <span class="badge">資料存在瀏覽器</span>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="section-title">展示流程</div>
      <div class="flow-bar">
        ${flowHtml}
      </div>
      ${hardwareNote}
    </div>

    <div class="card">
      <div class="section-title">📋 上台前確認清單</div>
      <form onsubmit="return false">
        ${checklistHtml}
      </form>
    </div>

    <div class="card">
      <div class="section-title">🎬 照這個順序操作（共 ${app.checklistItems.length} 步）</div>
      <div class="steps">
        ${stepsHtml}
      </div>
    </div>

    <div class="card">
      <div class="section-title">✅ 展示自我確認清單（每點做完打勾）</div>
      <form class="must-list" onsubmit="return false">
        ${mustShowHtml}
      </form>
    </div>

    <div class="card">
      <div class="section-title">❓ 評審可能會問（點開看回答）</div>
      ${qaHtml}
    </div>

    <div class="card">
      <div class="section-title">🚨 緊急備案</div>
      <div class="emergency-list">
        ${emergencyHtml}
      </div>
    </div>

    <details class="script-details">
      <summary class="script-summary">完整 3 分鐘講解稿（上台前展開備用）</summary>
      <div class="script-content">${guideHtml}</div>
    </details>
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
            <a class="secondary" href="./${guideUrl(app)}">手把手教學</a>
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
copyScreenshots();

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
      <a class="secondary" href="./${app.id}-guide.html">手把手教學</a>
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
