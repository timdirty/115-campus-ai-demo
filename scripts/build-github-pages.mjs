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

function extractRoles(markdown) {
  const lines = markdown.split(/\r?\n/);
  let inSection = false;
  const roles = [];
  for (const line of lines) {
    if (/^## 上台分工建議/.test(line)) { inSection = true; continue; }
    if (inSection && /^## /.test(line)) break;
    if (inSection && line.startsWith('- ')) roles.push(line.slice(2).trim());
  }
  return roles;
}

function writeGuidePage(app) {
  const markdown = fs.readFileSync(guidePath(app), 'utf8');
  const guideHtml = renderGuideMarkdown(markdown);

  // Cross-guide navigation links (to the other 2 guides)
  const otherGuideLinks = apps
    .filter((a) => a.id !== app.id)
    .map((a) => `<a href="./${a.id}-guide.html">${escapeHtml(a.shortName)} 教學</a>`)
    .join('\n');

  // Role assignment from markdown "上台分工建議" section
  const roles = extractRoles(markdown);
  const roleIcons = ['🎤', '💻', '🤖', '🛡️'];
  const roleLabels = ['說話的人', '操作 App 的人', '說明硬體的人', '回答問題的人'];
  const rolesHtml = roles.length > 0
    ? roles.map((role, i) => `<div class="role-row">
        <div class="role-badge">${roleIcons[i] || '👤'} ${roleLabels[i] || `第 ${i + 1} 位`}</div>
        <div class="role-desc">${escapeHtml(role)}</div>
      </div>`).join('\n')
    : `<p style="color:#64748b;font-size:.9rem">四個人分工：說話的 / 操作 App 的 / 說明硬體的 / 回答問題的</p>`;

  // Use simpleSteps (kid-friendly) if available, fall back to checklistItems
  const demoSteps = app.simpleSteps || app.checklistItems;

  // Time estimate per step
  const totalDemoSec = 150; // ~2.5 min for demo
  const secPerStep = Math.round(totalDemoSec / demoSteps.length);

  // Pre-launch checklist — very simple language for elementary students
  const storageKey = `${app.id}-checklist`;
  const preLaunchItems = [
    `打開 <a href="./${app.id}/" style="color:${app.accent};font-weight:900">這個 App 網址</a>，確認畫面有出來`,
    '把螢幕調亮，讓評審老師看得清楚',
    '先把下面的步驟看一遍，知道等一下要按哪裡',
    '網路斷掉也沒關係，App 可以在瀏覽器裡面跑',
  ];
  const checklistHtml = [
    ...preLaunchItems.map((item, i) => `<label class="check-item"><input type="checkbox" data-key="${storageKey}-pre-${i}"><span>${item}</span></label>`),
    `<div class="check-divider">展示步驟確認（一個一個打勾）</div>`,
    ...demoSteps.map((item, i) => `<label class="check-item"><input type="checkbox" data-key="${storageKey}-step-${i}"><span>${escapeHtml(item)}</span></label>`),
  ].join('\n');

  // Numbered demo steps with screenshot frames, nav hints, and time hints
  const stepsHtml = demoSteps.map((item, i) => {
    const num = String(i + 1).padStart(2, '0');
    const imgSrc = `./screenshots/${app.id}-step${i + 1}.png`;
    const navHintText = (app.stepNavHints || [])[i] || '';
    const navHintHtml = navHintText
      ? `<a class="step-nav-chip" href="./${app.id}/">→ ${escapeHtml(navHintText)}</a>`
      : '';
    return `<div class="step" id="${app.id}-step${i + 1}">
      <div class="step-num">${num}</div>
      <div class="step-body">
        <div class="step-header">
          <p class="step-title">${escapeHtml(item)}</p>
          <span class="step-time">約 ${secPerStep} 秒</span>
        </div>
        ${navHintHtml}
        <div class="screenshot-frame">
          <img src="${imgSrc}" alt="步驟 ${num} 操作畫面截圖" loading="lazy"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <div class="no-img-placeholder">
            <span class="no-img-icon">📷</span>
            <span>步驟 ${num} 的畫面長這樣</span>
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

  // Emergency backup scenarios — simple 3-step SOP for elementary students
  const emergencyItems = [
    ['網路斷掉了，或 AI 沒反應',
      '① 不要停，繼續操作 App → ② App 會自己切換展示模式，功能還是正常的 → ③ 告訴評審老師：「就算沒有網路，我們的 App 還是可以跑完整個流程」'],
    ['機器人或硬體沒反應',
      '① 繼續按 App，送出任務 → ② 讓評審看畫面上的任務紀錄有出來 → ③ 說：「接上機器人之後，這裡就會變成真實的動作」'],
    ['畫面變白了或 App 當掉',
      `① 按重新整理（手機往下拉、電腦按 F5）→ ② 還是壞的話，重新開啟這個網址：timdirty.github.io/115-campus-ai-demo/${app.id}/ → ③ 資料存在瀏覽器裡，重開後還會在`],
    ['評審問了你不知道怎麼回答的問題',
      '① 不要亂猜，說：「謝謝老師，這是很好的問題」→ ② 說：「讓我在 App 上直接示範給您看」→ ③ 打開 App 按一個功能，用畫面來回答'],
    ['時間快到了（3 分鐘快結束）',
      '① 計時的同學在 2 分 30 秒時舉手 → ② 說話的同學說：「最後幫評審看一個最重要的功能」→ ③ 快速點最厲害的那一步，然後說謝謝'],
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
    .topnav .other-guide { border-style: dashed; font-size: 13px; }

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

    /* Role assignment */
    .role-list { display: grid; gap: 8px; }
    .role-row { display: flex; gap: 12px; align-items: flex-start; padding: 10px 14px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; }
    .role-badge { flex-shrink: 0; font-size: .82rem; font-weight: 950; color: white; background: var(--accent); padding: 4px 10px; border-radius: 999px; white-space: nowrap; }
    .role-desc { color: #334155; font-weight: 700; font-size: .93rem; line-height: 1.6; }

    /* Steps */
    .steps { display: grid; gap: 20px; }
    .step { display: flex; gap: 16px; align-items: flex-start; scroll-margin-top: 12px; }
    .step-num { width: 48px; height: 48px; border-radius: 12px; background: var(--accent); color: white; font-size: 1.05rem; font-weight: 950; display: flex; align-items: center; justify-content: center; flex-shrink: 0; letter-spacing: -.02em; }
    .step-body { flex: 1; min-width: 0; }
    .step-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
    .step-title { margin: 0; font-size: 1.05rem; font-weight: 850; color: #1e293b; line-height: 1.65; flex: 1; }
    .step-time { flex-shrink: 0; font-size: .8rem; font-weight: 950; color: white; background: #64748b; padding: 3px 8px; border-radius: 999px; margin-top: 2px; }
    .step-nav-chip { display: inline-flex; align-items: center; margin-bottom: 10px; border: 1px solid color-mix(in srgb, var(--accent), white 55%); border-radius: 999px; padding: 4px 11px; font-size: .8rem; font-weight: 900; color: var(--accent); background: color-mix(in srgb, var(--accent), white 92%); text-decoration: none; }
    .step-nav-chip:hover { background: color-mix(in srgb, var(--accent), white 80%); }
    .screenshot-frame { border-radius: 10px; overflow: hidden; border: 1.5px solid #e2e8f0; background: #f8fafc; }
    .screenshot-frame img { width: 100%; display: block; }
    .no-img-placeholder { display: none; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 20px; color: #cbd5e1; font-size: 13px; font-weight: 700; text-align: center; min-height: 72px; background: #f8fafc; }
    .no-img-icon { font-size: 1.5rem; line-height: 1; }

    /* Must-show self-check */
    .must-list { display: grid; gap: 7px; }
    .must-item { display: flex; gap: 10px; align-items: flex-start; padding: 11px 14px; border-radius: 8px; background: #f0fdf4; border: 1px solid #bbf7d0; cursor: pointer; }
    .must-item input[type=checkbox] { width: 17px; height: 17px; margin-top: 3px; accent-color: #16a34a; flex-shrink: 0; cursor: pointer; }
    .must-item input:checked + .must-text { text-decoration: line-through; color: #86efac; }
    .must-text { color: #14532d; font-weight: 700; line-height: 1.65; font-size: 1rem; }
    .must-text code { background: #dcfce7; border-radius: 4px; padding: 1px 4px; font-size: .88em; font-family: monospace; }

    /* Q&A */
    .qa-card { border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
    .qa-card + .qa-card { margin-top: 8px; }
    .qa-q { padding: 13px 16px; font-weight: 900; color: #1e293b; cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between; gap: 8px; background: #f8fafc; font-size: 1rem; }
    .qa-q::after { content: "▼"; font-size: 11px; color: #94a3b8; flex-shrink: 0; }
    .qa-card[open] .qa-q::after { content: "▲"; }
    .qa-a { padding: 13px 16px; color: #465366; font-weight: 700; line-height: 1.75; border-top: 1px solid #e2e8f0; font-size: 1rem; }
    .qa-a code { background: #eef3f8; border-radius: 4px; padding: 1px 4px; font-size: .9em; font-family: monospace; }

    /* 3-minute timer */
    .timer-row { display: flex; align-items: center; gap: 12px; margin-top: 14px; flex-wrap: wrap; }
    .timer-btn { border: 1.5px solid #e2e8f0; border-radius: 10px; background: white; padding: 10px 16px; font-size: 1rem; font-weight: 900; cursor: pointer; color: #334155; display: flex; align-items: center; gap: 6px; }
    .timer-btn:hover { background: #f1f5f9; border-color: #cbd5e1; }
    .timer-display { font-size: 2rem; font-weight: 950; color: #111827; font-variant-numeric: tabular-nums; letter-spacing: -.04em; display: none; }
    .timer-display.warn { color: #dc2626; }

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

    /* Mobile base font floor — 16px minimum for competition-room readability */
    .role-desc { color: #334155; font-weight: 700; font-size: 1rem; line-height: 1.6; }
    .check-item span { color: #465366; font-weight: 700; line-height: 1.65; font-size: 1rem; }

    @media (max-width: 600px) {
      .hero { padding: 20px; }
      .step { flex-direction: column; gap: 8px; }
      .step-num { width: 40px; height: 40px; font-size: .95rem; border-radius: 10px; }
      .step-title { font-size: 1.05rem; }
      .qa-q, .qa-a { font-size: 1rem; }
      .flow-bar { gap: 6px; }
      .topnav a { font-size: 13px; }
    }
  </style>
</head>
<body>
  <main>
    <nav class="topnav" aria-label="導覽">
      <a href="./">← 返回總入口</a>
      <a class="open-btn" href="./${app.id}/">開啟 App →</a>
      ${otherGuideLinks.replace(/<a /g, '<a class="other-guide" ')}
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
      <div class="timer-row">
        <button class="timer-btn" id="timer-btn-${app.id}" onclick="startTimer('${app.id}')">🕐 練習計時 3 分鐘</button>
        <span class="timer-display" id="timer-display-${app.id}">3:00</span>
        <span id="timer-done-${app.id}" style="display:none;font-weight:900;color:#16a34a">✅ 時間到！講完了嗎？</span>
      </div>
    </div>

    <div class="card">
      <div class="section-title">展示順序</div>
      <div class="flow-bar">
        ${flowHtml}
      </div>
      ${hardwareNote}
    </div>

    <div class="card">
      <div class="section-title">👥 誰負責什麼</div>
      <div class="role-list">
        ${rolesHtml}
      </div>
      <p style="margin:10px 0 0;font-size:.82rem;color:#94a3b8;font-weight:700">計時者：在 2:30 舉手示意，讓主講者知道要收尾</p>
    </div>

    <div class="card">
      <div class="section-title">📋 上台前要確認</div>
      <form onsubmit="return false">
        ${checklistHtml}
      </form>
    </div>

    <div class="card">
      <div class="section-title">🎬 按這個順序做（共 ${demoSteps.length} 步，每步約 ${secPerStep} 秒）</div>
      <div class="steps">
        ${stepsHtml}
      </div>
    </div>

    <div class="card">
      <div class="section-title">✅ 做完了嗎？打勾確認</div>
      <p style="margin:0 0 12px;font-size:.85rem;color:#64748b;font-weight:700">每做完一個步驟就打一個勾，讓評審老師看到全部重點</p>
      <form class="must-list" onsubmit="return false">
        ${mustShowHtml}
      </form>
    </div>

    <div class="card">
      <div class="section-title">❓ 評審問這個怎麼回答</div>
      ${qaHtml}
    </div>

    <div class="card">
      <div class="section-title">🚨 出錯了怎麼辦</div>
      <div class="emergency-list">
        ${emergencyHtml}
      </div>
    </div>

    <details class="script-details">
      <summary class="script-summary">上台說話稿（展開備用）</summary>
      <div class="script-content">${guideHtml}</div>
    </details>
  </main>
  <script>
  // ── 3-minute countdown timer ─────────────────────────────────────────
  function startTimer(appId) {
    let secs = 180;
    const btn = document.getElementById('timer-btn-' + appId);
    const display = document.getElementById('timer-display-' + appId);
    const done = document.getElementById('timer-done-' + appId);
    btn.style.display = 'none';
    display.style.display = 'inline';
    done.style.display = 'none';
    const iv = setInterval(() => {
      secs--;
      const m = Math.floor(secs / 60);
      const s = String(secs % 60).padStart(2, '0');
      display.textContent = m + ':' + s;
      display.classList.toggle('warn', secs < 30);
      if (secs <= 0) {
        clearInterval(iv);
        display.style.display = 'none';
        done.style.display = 'inline';
        btn.textContent = '🔄 再練一次';
        btn.style.display = 'inline-flex';
      }
    }, 1000);
  }

  // ── Checkbox state → localStorage ───────────────────────────────────
  (function () {
    document.querySelectorAll('input[type=checkbox][data-key]').forEach((cb) => {
      const k = cb.dataset.key;
      if (localStorage.getItem(k) === '1') cb.checked = true;
      cb.addEventListener('change', () => localStorage.setItem(k, cb.checked ? '1' : '0'));
    });
  })();
  </script>
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

const quickLinks = apps.flatMap((app) => [
  `<a href="./${app.id}/">${app.name}</a>`,
  `<a href="./${app.id}-guide.html">📋 ${escapeHtml(app.shortName)} 教學</a>`,
]).join('');

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
    .guide-cta-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 20px; padding: 14px 18px; border-radius: 12px; border: 1px solid #dde6f0; background: rgb(255 255 255 / .82); }
    .guide-cta-label { font-size: 14px; font-weight: 950; color: #334155; white-space: nowrap; }
    .guide-cta-link { min-height: 38px; display: inline-flex; align-items: center; padding: 0 14px; border: 1.5px solid; border-radius: 8px; background: white; font-size: 14px; font-weight: 950; text-decoration: none; }
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
      <p class="lead">三個 AI 機器人 App，只要打開網址就能展示！上台前先點「📋 手把手教學」，把步驟看一遍，知道每一步要按哪裡，就可以上場了。</p>
      <div class="quick"><a href="./${allGuidesUrl()}">一次看三隊講稿</a></div>
      <div class="status"><span>📱 手機可操作</span><span>💾 資料存在瀏覽器</span><span>🤖 無硬體也可展示</span></div>
    </header>
    <div class="guide-cta-bar">
      <span class="guide-cta-label">📋 上台前先看教學</span>
      ${apps.map((a) => `<a class="guide-cta-link" href="./${a.id}-guide.html" style="border-color:${a.accent};color:${a.accent}">${escapeHtml(a.shortName)} 手把手教學 →</a>`).join('')}
    </div>
    <section class="grid">${cards}</section>
    <footer>資料存在各自瀏覽器 localStorage。這是比賽展示與學生體驗網址，不是正式雲端多人資料庫。</footer>
  </main>
</body>
</html>
`, 'utf8');

fs.writeFileSync(path.join(pagesDir, '.nojekyll'), '', 'utf8');
console.log(`GitHub Pages bundle ready: ${pagesDir}`);
