#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
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

async function writeGuidePage(app) {
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
    const navHintUrl = (app.stepNavUrls || [])[i] || `./${app.id}/`;
    const navHintHtml = navHintText
      ? `<a class="step-nav-chip" href="${navHintUrl}">→ ${escapeHtml(navHintText)}</a>`
      : '';
    return `<div class="step" id="${app.id}-step${i + 1}">
      <div class="step-num">${num}</div>
      <div class="step-body">
        <div class="step-header">
          <p class="step-title">${escapeHtml(item)}</p>
          <span class="step-time">約 ${secPerStep} 秒</span>
        </div>
        ${navHintHtml}
        <a class="screenshot-frame js-lightbox" href="${imgSrc}" title="點我放大看截圖">
          <img src="${imgSrc}" alt="步驟 ${num} 操作畫面截圖" loading="lazy"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <div class="no-img-placeholder">
            <span class="no-img-icon">📷</span>
            <span>步驟 ${num} 的畫面長這樣</span>
          </div>
          <div class="screenshot-hint">🔍 點我放大</div>
        </a>
      </div>
    </div>`;
  }).join('\n');

  // Flow visualization
  const flowHtml = app.flow.map((label, i) => `<div class="flow-step">
      <div class="flow-circle">${i + 1}</div>
      <div class="flow-label">${escapeHtml(label)}</div>
    </div>${i < app.flow.length - 1 ? '<div class="flow-arrow">→</div>' : ''}`).join('\n');

  // Must-show self-check list — use Chinese studentMustShow if available, fall back to scorecardMustShow
  const mustShowItems = app.studentMustShow || app.scorecardMustShow;
  const mustShowHtml = mustShowItems.map((item) => `<label class="must-item">
      <input type="checkbox">
      <div class="must-text">${renderInline(item)}</div>
    </label>`).join('\n');

  // Q&A from structured catalog data — first item open by default
  const qaHtml = app.judgeQaExtra.map((qa, qi) => `<details class="qa-card"${qi === 0 ? ' open' : ''}>
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
  const emergencyHtml = emergencyItems.map(([scenario, solution]) => {
    const steps = solution.split('→').map((s, i) => {
      const text = escapeHtml(s.trim());
      return i === 0
        ? `<span style="display:block;font-size:1.1rem;font-weight:950;color:#7f1d1d;margin-bottom:5px">👉 ${text}</span>`
        : `<span style="display:block;color:#14532d;font-weight:700;font-size:.92rem;margin-top:3px">→ ${text}</span>`;
    }).join('');
    return `<div class="emergency-item">
      <div class="emergency-scenario">🚨 ${escapeHtml(scenario)}</div>
      <div class="emergency-solution">${steps}</div>
    </div>`;
  }).join('\n');

  const hardwareNote = app.hardwarePitchNote
    ? `<div class="hardware-note">🤖 硬體亮點：${escapeHtml(app.hardwarePitchNote)}</div>`
    : '';

  const baseUrl = 'https://timdirty.github.io/115-campus-ai-demo/';
  const guidePageUrl = `${baseUrl}${app.id}-guide.html`;
  const qrSvgRaw = await QRCode.toString(guidePageUrl, {
    type: 'svg',
    margin: 1,
    color: {dark: '#0f172a', light: '#ffffff'},
  });
  // Strip the XML declaration so the SVG embeds cleanly in HTML
  const qrSvg = qrSvgRaw.replace(/<\?xml[^?]*\?>\s*/g, '');

  fs.writeFileSync(path.join(pagesDir, guideUrl(app)), `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="${app.accent}" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta property="og:title" content="${escapeHtml(app.name)} 手把手操作教學" />
  <meta property="og:description" content="${escapeHtml(app.desc)} 共 ${(app.simpleSteps || app.checklistItems).length} 步，有截圖、有計時、有緊急備案。" />
  <meta property="og:type" content="website" />
  <link rel="manifest" href="./manifest.json" />
  <title>${escapeHtml(app.name)} — 手把手操作教學</title>
  <script>if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});</script>
  <style>
    :root { --accent: ${app.accent}; color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", sans-serif; }
    * { box-sizing: border-box; min-width: 0; }
    body { margin: 0; background: #f3f6fb; color: #172033; }
    main { width: min(900px, calc(100% - 24px)); margin: 0 auto; padding: 20px 0 calc(96px + env(safe-area-inset-bottom, 0px)); display: grid; gap: 16px; }
    /* Celebration modal */
    .cel-overlay { display: none; position: fixed; inset: 0; z-index: 500; background: rgb(0 0 0 / .55); backdrop-filter: blur(4px); align-items: center; justify-content: center; padding: 20px; }
    .cel-overlay.show { display: flex; }
    .cel-box { background: white; border-radius: 20px; padding: 36px 28px 28px; max-width: 360px; width: 100%; text-align: center; box-shadow: 0 32px 80px rgb(0 0 0 / .22); }
    .cel-emoji { font-size: 3.5rem; line-height: 1; margin-bottom: 12px; }
    .cel-title { margin: 0 0 8px; font-size: 1.55rem; font-weight: 950; color: #111827; }
    .cel-sub { margin: 0 0 24px; color: #64748b; font-weight: 700; font-size: 1rem; line-height: 1.6; }
    .cel-close { width: 100%; min-height: 48px; border: none; border-radius: 12px; background: var(--accent); color: white; font-size: 1rem; font-weight: 950; cursor: pointer; }
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

    /* Quick review cheat sheet */
    .quick-review { border-radius: 12px; border: 2px dashed color-mix(in srgb, var(--accent), white 50%); background: color-mix(in srgb, var(--accent), white 94%); padding: 14px 18px; }
    .quick-review summary { cursor: pointer; font-size: .88rem; font-weight: 950; color: color-mix(in srgb, var(--accent), #1e293b 30%); letter-spacing: .04em; list-style: none; display: flex; align-items: center; justify-content: space-between; }
    .quick-review summary::after { content: "展開 ▼"; font-size: 11px; font-weight: 700; }
    .quick-review[open] summary::after { content: "收起 ▲"; }
    .quick-review ol { margin: 10px 0 0; padding-left: 1.4rem; display: grid; gap: 4px; }
    .quick-review li { font-size: .9rem; font-weight: 800; color: #334155; line-height: 1.55; }
    .quick-review .must-ref { margin-top: 10px; padding: 8px 10px; border-radius: 8px; background: #f0fdf4; border: 1px solid #bbf7d0; font-size: .82rem; font-weight: 800; color: #14532d; line-height: 1.55; }
    .quick-review .kbd-hint { margin-top: 10px; font-size: .78rem; font-weight: 700; color: #94a3b8; }
    .quick-review .kbd-hint kbd { display: inline-block; border: 1px solid #e2e8f0; border-radius: 4px; background: white; padding: 1px 5px; font-size: .78rem; font-family: monospace; color: #334155; }

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
    .step { display: flex; gap: 16px; align-items: flex-start; scroll-margin-top: 60px; }
    .step-num { width: 48px; height: 48px; border-radius: 12px; background: var(--accent); color: white; font-size: 1.05rem; font-weight: 950; display: flex; align-items: center; justify-content: center; flex-shrink: 0; letter-spacing: -.02em; }
    .step-body { flex: 1; min-width: 0; }
    .step-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
    .step-title { margin: 0; font-size: 1.05rem; font-weight: 850; color: #1e293b; line-height: 1.65; flex: 1; }
    .step-time { flex-shrink: 0; font-size: .8rem; font-weight: 950; color: white; background: #64748b; padding: 3px 8px; border-radius: 999px; margin-top: 2px; }
    .step-nav-chip { display: inline-flex; align-items: center; gap: 4px; margin-bottom: 10px; border: 1.5px solid color-mix(in srgb, var(--accent), white 45%); border-radius: 999px; padding: 6px 14px; min-height: 36px; font-size: .83rem; font-weight: 950; color: var(--accent); background: color-mix(in srgb, var(--accent), white 90%); text-decoration: none; transition: background .15s, box-shadow .15s; }
    .step-nav-chip:hover { background: color-mix(in srgb, var(--accent), white 78%); box-shadow: 0 2px 8px color-mix(in srgb, var(--accent), transparent 65%); }
    .screenshot-frame { display: block; border-radius: 10px; overflow: hidden; border: 1.5px solid #e2e8f0; background: #f8fafc; text-decoration: none; position: relative; }
    .screenshot-frame:hover { border-color: var(--accent); }
    .screenshot-frame img { width: 100%; display: block; }
    .screenshot-hint { position: absolute; bottom: 0; right: 0; background: rgb(0 0 0 / .55); color: white; font-size: 11px; font-weight: 900; padding: 4px 8px; border-top-left-radius: 8px; pointer-events: none; }
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

    /* QR code block */
    .qr-block { max-width: 96px; border-radius: 10px; border: 1px solid #e2e8f0; padding: 6px; background: white; display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .qr-block svg { width: 84px; height: 84px; display: block; }
    .qr-label { font-size: 10px; font-weight: 900; color: #64748b; text-align: center; line-height: 1.3; }

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

    /* Floating open-app button — respects iOS home bar safe area */
    .fab-open { position: fixed; bottom: calc(20px + env(safe-area-inset-bottom, 0px)); right: 18px; z-index: 200; display: inline-flex; align-items: center; gap: 8px; padding: 0 18px; height: 52px; border-radius: 999px; background: var(--accent); color: white; font-size: .92rem; font-weight: 950; text-decoration: none; box-shadow: 0 6px 24px color-mix(in srgb, var(--accent), transparent 50%); border: none; cursor: pointer; transition: transform .15s, box-shadow .15s; }
    .fab-open:hover { transform: translateY(-2px); box-shadow: 0 10px 32px color-mix(in srgb, var(--accent), transparent 40%); }
    @media print { .fab-open { display: none !important; } }

    /* Offline banner */
    .offline-banner { display: none; position: fixed; top: 0; left: 0; right: 0; z-index: 9000; background: #f59e0b; color: #1c1917; font-weight: 950; font-size: .88rem; padding: 8px 16px; text-align: center; letter-spacing: .02em; }
    .offline-banner.show { display: block; }

    /* Font size toggle */
    .font-toggle { display: inline-flex; align-items: center; gap: 4px; border: 1px solid #e2e8f0; border-radius: 8px; background: white; padding: 6px 10px; font-size: .9rem; font-weight: 900; cursor: pointer; color: #334155; }
    .font-toggle:hover { background: #f1f5f9; }
    body.font-large { font-size: 1.12rem; }
    body.font-large .step-title { font-size: 1.18rem; }
    body.font-large .qa-q, body.font-large .qa-a { font-size: 1.1rem; }
    body.font-large .must-text { font-size: 1.1rem; }
    /* Inline lightbox for screenshots */
    .lightbox-ov { position: fixed; inset: 0; z-index: 9999; background: rgb(0 0 0 / .88); display: flex; align-items: center; justify-content: center; padding: 16px; cursor: zoom-out; }
    .lightbox-ov img { max-width: 100%; max-height: 100%; border-radius: 10px; object-fit: contain; cursor: default; }
    .lightbox-hint { position: absolute; bottom: max(20px, env(safe-area-inset-bottom, 0px)); color: white; font-size: 1rem; font-weight: 900; text-align: center; width: 100%; pointer-events: none; }

    /* Wake lock indicator */
    .wake-active { background: #16a34a !important; color: white !important; border-color: #16a34a !important; }

    /* Two-column step grid on wider screens */
    @media (min-width: 700px) {
      .steps { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 699px) {
      .steps { grid-template-columns: 1fr; }
    }

    /* Sticky step progress bar */
    .prog-bar { position: sticky; top: 0; z-index: 50; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 6px 16px; background: rgb(255 255 255 / .96); backdrop-filter: blur(10px); border-bottom: 1px solid #e2e8f0; overflow: hidden; max-height: 0; transition: max-height .25s ease, padding .25s ease; pointer-events: none; }
    .prog-bar.active { max-height: 50px; pointer-events: auto; }
    .prog-pill { background: var(--accent); color: white; border-radius: 999px; padding: 4px 14px; font-size: .82rem; font-weight: 950; white-space: nowrap; }
    .prog-dots { display: flex; gap: 5px; align-items: center; }
    .prog-dot { width: 9px; height: 9px; border-radius: 50%; background: #e2e8f0; transition: background .2s; }
    .prog-dot.done { background: var(--accent); }
    /* Must-show completion celebration */
    .must-card-done { border-color: #16a34a !important; box-shadow: 0 0 0 2px #bbf7d0, 0 4px 20px rgb(27 35 52 / .05) !important; }
    /* Confetti pieces */
    @keyframes confetti-fall { 0% { transform: translateY(-60px) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }
    .confetti-piece { position: fixed; width: 10px; height: 16px; border-radius: 3px; pointer-events: none; z-index: 9999; animation: confetti-fall linear forwards; }
    /* Step done — number badge turns green when step checkbox is checked */
    .step.done .step-num { background: #16a34a !important; }
    @media (max-width: 600px) {
      .hero { padding: 20px; }
      .step { flex-direction: column; gap: 8px; }
      .step-num { width: 40px; height: 40px; font-size: .95rem; border-radius: 10px; }
      .step-title { font-size: 1.05rem; }
      .qa-q, .qa-a { font-size: 1rem; }
      .flow-bar { gap: 6px; }
      .topnav a { font-size: 13px; }
    }
    @media print {
      body { background: white; }
      .topnav, .timer-row, .qr-block, .script-details { display: none !important; }
      .hero { border-radius: 0; box-shadow: none; padding: 12px 0; background: white !important; }
      .hero::after { display: none; }
      .card { box-shadow: none; border: 1px solid #ccc; page-break-inside: avoid; }
      .step { page-break-inside: avoid; }
      .screenshot-frame img { max-height: 180px; width: auto; }
      .screenshot-hint { display: none; }
      main { padding: 8px 0; gap: 10px; }
      a[href]::after { content: none; }
    }
  </style>
</head>
<body>
  <div class="offline-banner" id="offline-banner" role="status">📵 目前離線 — 已快取的頁面可以正常瀏覽，App 功能仍可展示</div>
  <main>
    <nav class="topnav" aria-label="導覽">
      <a href="./">← 返回總入口</a>
      <a class="open-btn" href="./${app.id}/">開啟 App →</a>
      ${otherGuideLinks.replace(/<a /g, '<a class="other-guide" ')}
      <a class="other-guide" href="./${allGuidesUrl()}">📋 三隊講稿</a>
    </nav>
    <div class="prog-bar" id="prog-${app.id}" role="status" aria-label="步驟進度"></div>

    <div class="hero">
      <div class="hero-tag">${app.id.toUpperCase()} — ${escapeHtml(app.team)}</div>
      <h1>${escapeHtml(app.name)}<span class="hero-sub">手把手操作教學</span></h1>
      <div class="hero-row">
        <a class="hero-btn" href="./${app.id}/">開啟 App 開始展示 →</a>
        <a class="hero-btn" href="#${app.id}-step1" style="background:white;color:var(--accent);border:2px solid var(--accent)">👉 從步驟一開始做</a>
        <button class="hero-btn" onclick="resetAndStart('${app.id}')" style="background:#f1f5f9;color:#334155;border:2px solid #e2e8f0" title="清除所有打勾，重新從第一步開始練習">🔄 重新練習</button>
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
        <button class="timer-btn" onclick="shareGuide()" title="分享這個教學頁面">📤 分享</button>
        <button class="timer-btn" onclick="window.print()" title="列印教學備用">🖨️ 列印</button>
        <button class="font-toggle" id="font-toggle-${app.id}" onclick="toggleFont('${app.id}')" title="放大/縮小字體">🔡 字</button>
        <button class="timer-btn" id="wake-btn-${app.id}" onclick="toggleWake('${app.id}')" title="防止螢幕自動關閉">💡 防熄屏</button>
        <div class="qr-block">
          ${qrSvg}
          <span class="qr-label">掃我開始展示</span>
        </div>
      </div>
    </div>

    <details class="quick-review">
      <summary>⚡ 上台前快速複習（展開看全部步驟）</summary>
      <ol>
        ${demoSteps.map((s, i) => `<li><strong>${i + 1}.</strong> ${escapeHtml(s)}</li>`).join('\n        ')}
      </ol>
      <div class="must-ref">✅ 必做確認：${mustShowItems.slice(0, 3).map((s) => escapeHtml(s.replace(/^Student (performs|points|shows|demonstrates|explains|opens) /, '').replace(/ without assistance\.?$/, ''))).join(' → ')}</div>
      <div class="kbd-hint">快捷鍵：<kbd>1</kbd>–<kbd>9</kbd> 跳到對應步驟 · <kbd>c</kbd> 清除所有打勾</div>
    </details>

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
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div class="section-title" style="margin:0">📋 上台前要確認</div>
        <button onclick="clearAllChecks()" style="border:1px solid #e2e8f0;border-radius:8px;background:white;padding:6px 12px;font-size:.82rem;font-weight:900;cursor:pointer;color:#64748b;line-height:1.3">🗑️ 清除打勾</button>
      </div>
      <form onsubmit="return false">
        ${checklistHtml}
      </form>
    </div>

    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:14px">
        <div class="section-title" style="margin:0">🎬 按這個順序做（共 ${demoSteps.length} 步，每步約 ${secPerStep} 秒）</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${demoSteps.map((_, i) => `<a href="#${app.id}-step${i + 1}" style="width:44px;height:44px;min-width:44px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;border:1px solid color-mix(in srgb,var(--accent),white 60%);background:color-mix(in srgb,var(--accent),white 90%);color:var(--accent);font-size:.9rem;font-weight:950;text-decoration:none">${i + 1}</a>`).join('')}</div>
      </div>
      <div class="steps">
        ${stepsHtml}
      </div>
    </div>

    <div class="card" id="must-card-${app.id}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div class="section-title" style="margin:0">✅ 做完了嗎？打勾確認</div>
        <span id="must-count-${app.id}" style="font-size:.95rem;font-weight:950;color:#64748b;transition:color .3s">0 / ${mustShowItems.length}</span>
      </div>
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

    <p style="text-align:center;color:#94a3b8;font-size:.78rem;font-weight:700;margin:8px 0 0">
      教學頁建立時間：${new Date().toLocaleString('zh-TW', {timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}
      · <a href="./">返回首頁</a>
    </p>
  </main>

  <div class="cel-overlay" id="cel-overlay-${app.id}" role="dialog" aria-modal="true">
    <div class="cel-box">
      <div class="cel-emoji">🎉</div>
      <h2 class="cel-title">準備完成！</h2>
      <p class="cel-sub">所有重點都確認過了。<br>深呼吸一下，去上台展示吧！</p>
      <button class="cel-close" onclick="document.getElementById('cel-overlay-${app.id}').classList.remove('show')">我準備好了，去上台！ 💪</button>
    </div>
  </div>
  <a class="fab-open" href="./${app.id}/" title="開啟 ${escapeHtml(app.shortName)} App">🚀 開啟 App</a>
  <script>
  // ── Inline lightbox for screenshots (no new tab on mobile) ───────────
  document.querySelectorAll('.js-lightbox').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const img = a.querySelector('img');
      if (!img || !img.src || img.style.display === 'none') return;
      const ov = document.createElement('div');
      ov.className = 'lightbox-ov';
      ov.innerHTML = '<img src="' + img.src + '" alt="' + (img.alt || '截圖') + '"><div class="lightbox-hint">點任何地方關閉</div>';
      ov.addEventListener('click', () => ov.remove());
      ov.querySelector('img').addEventListener('click', (ev) => ev.stopPropagation());
      document.body.appendChild(ov);
    });
  });

  // ── Share & Print helpers ─────────────────────────────────────────────
  function shareGuide() {
    const url = location.href;
    const title = document.title;
    if (navigator.share) {
      navigator.share({title, url}).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        const btn = event.currentTarget;
        const orig = btn.textContent;
        btn.textContent = '✅ 連結已複製！';
        setTimeout(() => { btn.textContent = orig; }, 2000);
      }).catch(() => { prompt('複製此連結：', url); });
    }
  }

  // ── Sticky step progress bar ─────────────────────────────────────────
  (function () {
    const bar = document.getElementById('prog-${app.id}');
    const steps = document.querySelectorAll('.step');
    if (!bar || !steps.length) return;
    const total = steps.length;
    // Build pill + dot indicators
    const dots = Array.from({length: total}, (_, i) =>
      '<div class="prog-dot" id="pdot-${app.id}-' + i + '"></div>'
    ).join('');
    bar.innerHTML = '<span class="prog-pill" id="plabel-${app.id}">步驟 1 / ' + total + '</span><div class="prog-dots">' + dots + '</div>';
    const label = document.getElementById('plabel-${app.id}');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const idx = [...steps].indexOf(entry.target);
        if (label) label.textContent = '步驟 ' + (idx + 1) + ' / ' + total;
        bar.classList.add('active');
        document.querySelectorAll('.prog-dot').forEach((d, i) => d.classList.toggle('done', i <= idx));
      });
    }, {threshold: 0.3, rootMargin: '-5% 0px -55% 0px'});
    steps.forEach((s) => observer.observe(s));
    // Hide bar when scrolled back above all steps
    const stepsEl = document.querySelector('.steps');
    if (stepsEl) {
      new IntersectionObserver((e) => { if (!e[0].isIntersecting) bar.classList.remove('active'); }, {threshold: 0}).observe(stepsEl);
    }
  })();

  // ── Clear all checkboxes ─────────────────────────────────────────────
  function clearAllChecks() {
    document.querySelectorAll('input[type=checkbox][data-key]').forEach((cb) => {
      cb.checked = false;
      localStorage.setItem(cb.dataset.key, '0');
    });
    updateMustCount();
  }

  // ── Must-show counter ────────────────────────────────────────────────
  function updateMustCount() {
    const items = [...document.querySelectorAll('.must-item input[type=checkbox]')];
    const done = items.filter((i) => i.checked).length;
    const counter = document.getElementById('must-count-${app.id}');
    const card = document.getElementById('must-card-${app.id}');
    const allDone = done === items.length && items.length > 0;
    if (counter) {
      counter.textContent = done + ' / ' + items.length;
      counter.style.color = allDone ? '#16a34a' : '#64748b';
    }
    if (card) {
      card.classList.toggle('must-card-done', allDone);
    }
    if (allDone) {
      setTimeout(() => {
        document.getElementById('cel-overlay-${app.id}')?.classList.add('show');
        launchConfetti();
      }, 400);
    }
  }
  document.querySelectorAll('.must-item input[type=checkbox]').forEach((cb) => {
    cb.addEventListener('change', updateMustCount);
  });
  updateMustCount();

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
      display.classList.toggle('warn', secs < 50);
      if (secs === 50) {
        const toast = document.createElement('div');
        toast.textContent = '⏰ 剩 50 秒！計時者請舉手';
        toast.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#f59e0b;color:white;font-weight:950;padding:12px 24px;border-radius:999px;z-index:9999;font-size:1.05rem;box-shadow:0 4px 24px rgb(0 0 0/.2);animation:fadein .3s';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 7000);
      }
      if (secs <= 0) {
        clearInterval(iv);
        display.style.display = 'none';
        done.style.display = 'inline';
        btn.textContent = '🔄 再練一次';
        btn.style.display = 'inline-flex';
      }
    }, 1000);
  }

  // ── Reset + Scroll to step 1 for re-practice ─────────────────────────
  function resetAndStart(appId) {
    clearAllChecks();
    setTimeout(() => {
      const step1 = document.getElementById(appId + '-step1');
      if (step1) step1.scrollIntoView({behavior: 'smooth', block: 'start'});
    }, 80);
  }

  // ── Wake Lock: prevent screen from sleeping during presentation ───────
  let wakeLock = null;
  async function toggleWake(appId) {
    const btn = document.getElementById('wake-btn-' + appId);
    if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
      if (btn) { btn.textContent = '💡 防熄屏'; btn.classList.remove('wake-active'); }
    } else {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        if (btn) { btn.textContent = '🟢 防熄屏中'; btn.classList.add('wake-active'); }
        wakeLock.addEventListener('release', () => {
          wakeLock = null;
          if (btn) { btn.textContent = '💡 防熄屏'; btn.classList.remove('wake-active'); }
        });
      } catch (e) {
        if (btn) { btn.textContent = '❌ 不支援'; setTimeout(() => { btn.textContent = '💡 防熄屏'; }, 2000); }
      }
    }
  }
  // Re-acquire wake lock after tab becomes visible again
  document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
      try { wakeLock = await navigator.wakeLock.request('screen'); } catch(_) {}
    }
  });

  // ── Confetti celebration ─────────────────────────────────────────────
  function launchConfetti() {
    const colors = ['#${app.accent.slice(1)}','#fbbf24','#34d399','#60a5fa','#f472b6','#a78bfa'];
    for (let i = 0; i < 60; i++) {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.cssText = [
        'left:' + (5 + Math.random() * 90) + 'vw',
        'top:-20px',
        'background:' + colors[Math.floor(Math.random() * colors.length)],
        'animation-duration:' + (1.2 + Math.random() * 1.8) + 's',
        'animation-delay:' + (Math.random() * 0.6) + 's',
        'width:' + (8 + Math.random() * 8) + 'px',
        'height:' + (10 + Math.random() * 10) + 'px',
        'border-radius:' + (Math.random() > 0.5 ? '50%' : '3px'),
        'opacity:1',
      ].join(';');
      document.body.appendChild(el);
      el.addEventListener('animationend', () => el.remove());
    }
  }

  // ── Keyboard shortcuts: 1-9 jumps to step, c clears checkboxes ───────
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9) {
      const el = document.getElementById('${app.id}-step' + n);
      if (el) { el.scrollIntoView({behavior: 'smooth', block: 'center'}); }
    }
    if (e.key === 'c' || e.key === 'C') { clearAllChecks(); }
  });

  // ── Offline / online status banner ───────────────────────────────────
  (function () {
    const banner = document.getElementById('offline-banner');
    function update() { if (banner) banner.classList.toggle('show', !navigator.onLine); }
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  })();

  // ── Font size toggle ─────────────────────────────────────────────────
  function toggleFont(appId) {
    const large = document.body.classList.toggle('font-large');
    const btn = document.getElementById('font-toggle-' + appId);
    if (btn) btn.textContent = large ? '🔠 字' : '🔡 字';
    try { localStorage.setItem('guide-font-large', large ? '1' : '0'); } catch(_) {}
  }
  (function () {
    try {
      if (localStorage.getItem('guide-font-large') === '1') {
        document.body.classList.add('font-large');
        const btn = document.getElementById('font-toggle-${app.id}');
        if (btn) btn.textContent = '🔠 字';
      }
    } catch(_) {}
  })();

  // ── Checkbox state → localStorage + step-done green badge ───────────
  (function () {
    function markStepDone(cb) {
      // Find if this checkbox is inside a .step and if it's a step-level checkbox (data-key has 'step-')
      const k = cb.dataset.key || '';
      if (k.includes('-step-')) {
        const idx = parseInt(k.split('-step-')[1], 10);
        const stepEl = document.getElementById('${app.id}-step' + (idx + 1));
        if (stepEl) stepEl.classList.toggle('done', cb.checked);
      }
    }
    document.querySelectorAll('input[type=checkbox][data-key]').forEach((cb) => {
      const k = cb.dataset.key;
      if (localStorage.getItem(k) === '1') { cb.checked = true; markStepDone(cb); }
      cb.addEventListener('change', () => {
        localStorage.setItem(k, cb.checked ? '1' : '0');
        markStepDone(cb);
        // Haptic feedback on mobile (short pulse when checked)
        if (cb.checked && navigator.vibrate) navigator.vibrate(30);
        // Auto-scroll to next unchecked step checkbox when one is checked
        if (cb.checked && k.includes('-step-')) {
          const allStepCbs = [...document.querySelectorAll('input[type=checkbox][data-key*="-step-"]')];
          const idx = allStepCbs.indexOf(cb);
          const nextUnchecked = allStepCbs.slice(idx + 1).find((c) => !c.checked);
          if (nextUnchecked) {
            const label = nextUnchecked.closest('label');
            if (label) { setTimeout(() => label.scrollIntoView({behavior: 'smooth', block: 'center'}), 250); }
          }
        }
      });
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
  <link rel="manifest" href="./manifest.json" />
  <script>if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});</script>
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
    .fab { position: fixed; bottom: calc(20px + env(safe-area-inset-bottom, 0px)); right: 18px; z-index: 50; display: flex; flex-direction: column; gap: 10px; }
    .fab button, .fab a { display: flex; align-items: center; justify-content: center; min-width: 48px; min-height: 48px; border-radius: 999px; border: none; cursor: pointer; font-size: 20px; box-shadow: 0 4px 18px rgb(0 0 0/.18); transition: transform .15s, opacity .2s; }
    .fab-top { background: #111827; color: white; opacity: 0; pointer-events: none; text-decoration: none; }
    .fab-top.vis { opacity: 1; pointer-events: auto; }
    .fab-print { background: ${app.accent}; color: white; }
    @media print { .fab { display: none; } nav { display: none; } }
  </style>
</head>
<body>
  <main style="padding: 20px 0 calc(96px + env(safe-area-inset-bottom, 0px))">
    <nav aria-label="返回">
      <a href="./">返回總入口</a>
      <a href="./${app.id}/">開啟 ${app.name}</a>
      <a href="./${guideUrl(app)}">學生講稿</a>
    </nav>
    <article>${guideHtml}</article>
  </main>
  <div class="fab">
    <button class="fab-print" title="列印手冊" onclick="window.print()">🖨️</button>
    <a class="fab-top" id="fab-top" href="#" title="回到頂端" onclick="window.scrollTo({top:0,behavior:'smooth'});return false">↑</a>
  </div>
  <script>
  (function(){
    const btn = document.getElementById('fab-top');
    const onScroll = () => { btn.classList.toggle('vis', window.scrollY > 300); };
    window.addEventListener('scroll', onScroll, {passive: true});
  })();
  </script>
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
  <link rel="manifest" href="./manifest.json" />
  <script>if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});</script>
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
    .fab-all { position: fixed; bottom: calc(20px + env(safe-area-inset-bottom, 0px)); right: 18px; z-index: 50; display: flex; flex-direction: column; gap: 10px; }
    .fab-all button, .fab-all a { display: flex; align-items: center; justify-content: center; min-width: 48px; min-height: 48px; border-radius: 999px; border: none; cursor: pointer; font-size: 20px; box-shadow: 0 4px 18px rgb(0 0 0/.18); transition: transform .15s, opacity .2s; text-decoration: none; }
    .fab-top2 { background: #111827; color: white; opacity: 0; pointer-events: none; }
    .fab-top2.vis { opacity: 1; pointer-events: auto; }
    .fab-print2 { background: #1d4ed8; color: white; }
    @media print { .fab-all { display: none; } .topbar { display: none; } .tab-row { position: static; } }
  </style>
</head>
<body>
  <main style="padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px))">
    <nav class="topbar" aria-label="快速切換">
      <div class="nav-links">
        <a href="./">← 返回首頁</a>
        ${apps.map((a) => `<a href="./${a.id}/">${escapeHtml(a.shortName)} App</a><a href="./${guideUrl(a)}">📋 ${escapeHtml(a.shortName)} 教學</a>`).join('')}
      </div>
    </nav>
    <header>
      <span class="eyebrow">三隊學生教學總覽</span>
      <h1>三隊上台操作稿</h1>
      <p class="lead">這裡可以看三隊的完整講稿。點「📋 教學」進手把手步驟教學，點「App」直接開展示。</p>
    </header>
    <nav class="tab-row" aria-label="講稿導覽">${tabs}
    </nav>
    <section class="guide-list">${sections}
    </section>
  </main>
  <div class="fab-all">
    <button class="fab-print2" title="列印講稿" onclick="window.print()">🖨️</button>
    <a class="fab-top2" id="fab-top2" href="#" title="回到頂端" onclick="window.scrollTo({top:0,behavior:'smooth'});return false">↑</a>
  </div>
  <script>
  (function () {
    const tabs = document.querySelectorAll('.tab');
    const sections = document.querySelectorAll('.guide-card');
    const tabMap = {};
    tabs.forEach((t) => { const href = t.getAttribute('href'); if (href) tabMap[href.slice(1)] = t; });
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        tabs.forEach((t) => t.classList.remove('current'));
        if (tabMap[id]) tabMap[id].classList.add('current');
      });
    }, {threshold: 0.3});
    sections.forEach((s) => observer.observe(s));
    tabs.forEach((t) => t.addEventListener('click', () => {
      tabs.forEach((x) => x.classList.remove('current'));
      t.classList.add('current');
    }));
    // Back-to-top visibility
    const btn = document.getElementById('fab-top2');
    window.addEventListener('scroll', () => { btn.classList.toggle('vis', window.scrollY > 300); }, {passive: true});
  })();
  </script>
</body>
</html>
`, 'utf8');
}

fs.rmSync(pagesDir, {recursive: true, force: true});
fs.mkdirSync(pagesDir, {recursive: true});
copyScreenshots();

(async () => {
for (const app of apps) {
  const sourceDir = appDir(app);
  run('npm', ['ci'], sourceDir);
  run('npm', ['run', 'build'], sourceDir);
  copyDir(path.join(sourceDir, 'dist'), path.join(pagesDir, app.id));
  await writeGuidePage(app);
  writeOpsGuidePage(app);
}

writeAllGuidesPage();

// Generate QR code for index page URL so teachers can share easily
const indexUrl = 'https://timdirty.github.io/115-campus-ai-demo/';
const indexQrRaw = await QRCode.toString(indexUrl, {type: 'svg', margin: 1, color: {dark: '#0f172a', light: '#ffffff'}});
const indexQrSvg = indexQrRaw.replace(/<\?xml[^?]*\?>\s*/g, '');

const cards = apps.map((app) => {
  const opsUrl = opsGuideUrl(app);
  const extraLink = opsUrl ? `<a class="secondary" href="./${opsUrl}">操作手冊</a>` : '';
  const stepCount = (app.simpleSteps || app.checklistItems).length;
  const approxSec = Math.round(stepCount * 25);
  const approxMin = Math.floor(approxSec / 60);
  const timeLabel = `約 ${approxMin} 分 ${approxSec % 60} 秒`;
  return `
  <article class="card" style="--accent:${app.accent}">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <span class="tag">${app.id.toUpperCase()}</span>
      <span style="border-radius:999px;background:#f1f5f9;color:#475569;padding:5px 10px;font-size:11px;font-weight:950">${stepCount} 步 · ${timeLabel}</span>
    </div>
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
  <meta name="theme-color" content="#111827" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta property="og:title" content="115 資通訊三隊 App 展示入口" />
  <meta property="og:description" content="三個 AI 機器人 App 展示。上台前點「手把手教學」看步驟、截圖、計時、緊急備案，全都有。" />
  <link rel="manifest" href="./manifest.json" />
  <title>115 資通訊三隊 App 展示入口</title>
  <script>if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});</script>
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
    .guide-cta-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 20px; padding: 16px 20px; border-radius: 14px; border: 1.5px solid #fde68a; background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); box-shadow: 0 4px 16px rgb(251 191 36 / .12); }
    .guide-cta-label { font-size: 15px; font-weight: 950; color: #92400e; white-space: nowrap; }
    .guide-cta-link { min-height: 42px; display: inline-flex; align-items: center; padding: 0 16px; border: 2px solid; border-radius: 10px; background: white; font-size: 14px; font-weight: 950; text-decoration: none; box-shadow: 0 2px 8px rgb(0 0 0 / .06); }
    footer { margin-top: 22px; color: #6d7787; font-size: 13px; font-weight: 750; line-height: 1.6; }
    .install-bar { display: none; align-items: center; gap: 10px; margin-top: 14px; padding: 12px 16px; border-radius: 12px; border: 1.5px solid #bfdbfe; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); }
    .install-bar.show { display: flex; }
    .install-bar p { margin: 0; font-size: 13px; font-weight: 850; color: #1e40af; flex: 1; }
    .install-bar button { min-height: 38px; padding: 0 14px; border-radius: 8px; border: none; background: #1d4ed8; color: white; font-weight: 950; font-size: 13px; cursor: pointer; white-space: nowrap; }
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
    <div id="install-bar" class="install-bar">
      <p>📲 加到主畫面，比賽當天離線也能開！</p>
      <button id="install-btn">安裝 App</button>
      <button onclick="document.getElementById('install-bar').classList.remove('show')" style="background:transparent;border:none;color:#1e40af;font-size:20px;cursor:pointer;padding:0 4px">✕</button>
    </div>
    <div class="guide-cta-bar">
      <span class="guide-cta-label">⚡ 上台前必看！</span>
      ${apps.map((a) => {
        const steps = (a.simpleSteps || a.checklistItems).length;
        return `<a class="guide-cta-link" href="./${a.id}-guide.html" style="border-color:${a.accent};color:${a.accent}">${escapeHtml(a.shortName)} 教學（${steps}步）→</a>`;
      }).join('')}
    </div>
    <section class="grid">${cards}</section>
    <footer style="display:flex;flex-wrap:wrap;align-items:flex-start;gap:16px">
      <p style="margin:0;flex:1">資料存在各自瀏覽器 localStorage。這是比賽展示與學生體驗網址，不是正式雲端多人資料庫。</p>
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;border:1px solid #dde4ef;border-radius:10px;background:white;padding:8px">
        ${indexQrSvg.replace(/width="\d+"/, 'width="80"').replace(/height="\d+"/, 'height="80"')}
        <span style="font-size:10px;font-weight:900;color:#64748b;text-align:center">掃我分享給同學</span>
      </div>
    </footer>
  </main>
  <script>
  (function(){
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      document.getElementById('install-bar').classList.add('show');
    });
    document.getElementById('install-btn').addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      document.getElementById('install-bar').classList.remove('show');
    });
    window.addEventListener('appinstalled', () => {
      document.getElementById('install-bar').classList.remove('show');
    });
  })();
  </script>
</body>
</html>
`, 'utf8');

// ── PWA Manifest ────────────────────────────────────────────────────────
const iconSvgEncoded = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="80" fill="#111827"/><text x="256" y="340" font-family="Arial,sans-serif" font-size="220" font-weight="bold" fill="white" text-anchor="middle">115</text></svg>');
const iconDataUri = `data:image/svg+xml,${iconSvgEncoded}`;
fs.writeFileSync(path.join(pagesDir, 'manifest.json'), JSON.stringify({
  name: '115三隊 AI 機器人展示',
  short_name: '115展示',
  description: '三隊 AI 機器人展示教學入口，手把手步驟、計時、截圖、離線可用',
  lang: 'zh-TW',
  start_url: './',
  scope: '/115-campus-ai-demo/',
  display: 'standalone',
  orientation: 'any',
  theme_color: '#111827',
  background_color: '#f4f7fb',
  categories: ['education', 'productivity'],
  icons: [
    {src: iconDataUri, sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable'},
    {src: iconDataUri, sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable'},
  ],
}, null, 2), 'utf8');

// ── Service Worker: cache guide pages + screenshots for offline use ──
const screenshotUrls = apps.flatMap((a) =>
  (a.simpleSteps || a.checklistItems).map((_, i) => `./screenshots/${a.id}-step${i + 1}.png`)
);
const guidePageUrls = apps.map((a) => `./${guideUrl(a)}`);
const opsGuidePageUrls = apps.map((a) => opsGuideUrl(a)).filter(Boolean).map((u) => `./${u}`);
const cacheManifest = [
  './',
  './index.html',
  './manifest.json',
  `./${allGuidesUrl()}`,
  ...guidePageUrls,
  ...opsGuidePageUrls,
  ...screenshotUrls,
].map((u) => JSON.stringify(u)).join(',\n  ');

fs.writeFileSync(path.join(pagesDir, 'sw.js'), `// 115 guide offline cache – auto-generated
const CACHE = '115-guide-v${Date.now()}';
const URLS = [
  ${cacheManifest}
];
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(URLS.filter((u) => !u.endsWith('.png') || true)))
  );
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
      }
      return res;
    }).catch(() => cached))
  );
});
`, 'utf8');

fs.writeFileSync(path.join(pagesDir, '.nojekyll'), '', 'utf8');
console.log(`GitHub Pages bundle ready: ${pagesDir}`);
})();
