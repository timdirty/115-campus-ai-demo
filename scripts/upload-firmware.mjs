#!/usr/bin/env node
/**
 * Firmware upload web UI + Serial Monitor.
 * Run: npm run upload
 * A browser window opens automatically. Click a button to upload.
 */

import {createServer} from 'node:http';
import {spawn, execSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const PORT    = 3998;
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── Firmware targets ──────────────────────────────────────────────────────────
const TARGETS = [
  {
    id:    'app1-minima',
    group: 'App 1  白板板擦機器人',
    label: '底盤驅動  L293D M3/M4',
    board: 'UNO R4 Minima',
    env:   'uno_r4_minima_app1_whiteboard_drive',
    dfu:   true,
    color: '#246b5b',
  },
  {
    id:    'app2-wifi',
    group: 'App 2  校園服務機器人',
    label: '底盤驅動  L293D M1+M2 輪 / M3+M4 滾筒',
    board: 'UNO R4 WiFi',
    env:   'uno_r4_wifi_app2_sweeper',
    dfu:   false,
    color: '#005bb3',
  },
  {
    id:    'app2-minima',
    group: 'App 2  校園服務機器人',
    label: '底盤驅動  L293D M1+M2 輪 / M3+M4 滾筒',
    board: 'UNO R4 Minima',
    env:   'uno_r4_minima_app2_sweeper',
    dfu:   true,
    color: '#005bb3',
  },
  {
    id:    'app3-drive-wifi',
    group: 'App 3  AI 校園心靈守護者',
    label: '巡邏底盤  L293D M1+M4 左 / M2+M3 右',
    board: 'UNO R4 WiFi',
    env:   'uno_r4_wifi_app3_guardian_drive',
    dfu:   false,
    color: '#0f766e',
  },
  {
    id:    'app3-drive-minima',
    group: 'App 3  AI 校園心靈守護者',
    label: '巡邏底盤  L293D M1+M4 左 / M2+M3 右',
    board: 'UNO R4 Minima',
    env:   'uno_r4_minima_app3_guardian_drive',
    dfu:   true,
    color: '#0f766e',
  },
  {
    id:    'app3-sensor-wifi',
    group: 'App 3  AI 校園心靈守護者',
    label: '感測器  HY-M302 / DHT11 / 光敏電阻',
    board: 'UNO R4 WiFi',
    env:   'uno_r4_wifi_sensor',
    dfu:   false,
    color: '#0f766e',
  },
  {
    id:    'app3-sensor-minima',
    group: 'App 3  AI 校園心靈守護者',
    label: '感測器  HY-M302 / DHT11 / 光敏電阻',
    board: 'UNO R4 Minima',
    env:   'uno_r4_minima',
    dfu:   true,
    color: '#0f766e',
  },
  {
    id:    'shared-wifi',
    group: '主示範  三 App 共用指令展示',
    label: 'LED 矩陣 + Servo + 全指令集',
    board: 'UNO R4 WiFi',
    env:   'uno_r4_wifi',
    dfu:   false,
    color: '#6b3a8f',
  },
];

// ── Board detection ───────────────────────────────────────────────────────────
function getBoards() {
  try {
    const raw = execSync('pio device list --serial 2>/dev/null', {
      encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000,
    });
    const ports = [...new Set(raw.match(/\/dev\/[^\s]+/g) ?? [])]
      .filter((p) => !/Bluetooth|debug/i.test(p));
    return {connected: ports.length > 0, ports};
  } catch {
    return {connected: false, ports: []};
  }
}

// ── SSE streams registry (upload/build) ───────────────────────────────────────
const streams = new Map();

function broadcast(env, data) {
  const clients = streams.get(env);
  if (!clients) return;
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try {res.write(msg);} catch {clients.delete(res);}
  }
}

// ── Running upload/build jobs ─────────────────────────────────────────────────
const jobs = new Map();

function startJob(env, uploadMode) {
  if (jobs.has(env)) return false;
  const args = uploadMode
    ? ['run', '-e', env, '-t', 'upload']
    : ['run'];

  broadcast(env, {type: 'start', cmd: 'pio ' + args.join(' ')});

  const proc = spawn('pio', args, {cwd: rootDir, stdio: ['ignore', 'pipe', 'pipe']});
  jobs.set(env, {proc, startedAt: Date.now()});

  proc.stdout.on('data', (chunk) =>
    broadcast(env, {type: 'line', text: chunk.toString()}),
  );
  proc.stderr.on('data', (chunk) =>
    broadcast(env, {type: 'line', text: chunk.toString()}),
  );
  proc.on('close', (code) => {
    jobs.delete(env);
    broadcast(env, {type: 'done', code, ok: code === 0});
  });
  return true;
}

// ── Serial Monitor state ──────────────────────────────────────────────────────
let monitorProc    = null;
let monitorPort    = '';
let monitorBaud    = '9600';
const monitorClients = new Set();

function broadcastMonitor(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of monitorClients) {
    try {res.write(msg);} catch {monitorClients.delete(res);}
  }
}

function startMonitor(port, baud) {
  if (monitorProc) return {ok: false, error: 'already running'};
  monitorPort = port;
  monitorBaud = baud;
  const proc = spawn('pio', ['device', 'monitor', '-p', port, '-b', baud], {
    cwd: rootDir, stdio: ['pipe', 'pipe', 'pipe'],
  });
  monitorProc = proc;
  broadcastMonitor({type: 'open', port, baud});
  proc.stdout.on('data', (chunk) =>
    broadcastMonitor({type: 'line', text: chunk.toString()}),
  );
  proc.stderr.on('data', (chunk) =>
    broadcastMonitor({type: 'line', text: chunk.toString()}),
  );
  proc.on('close', (code) => {
    monitorProc = null;
    broadcastMonitor({type: 'closed', code});
  });
  return {ok: true};
}

function stopMonitor() {
  if (!monitorProc) return {ok: false, error: 'not running'};
  monitorProc.kill('SIGTERM');
  return {ok: true};
}

function sendToMonitor(text) {
  if (!monitorProc) return {ok: false, error: 'not connected'};
  monitorProc.stdin.write(text + '\n');
  return {ok: true};
}

// ── Read request body helper ──────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {resolve(JSON.parse(body));} catch {resolve({});}
    });
  });
}

// ── HTML ──────────────────────────────────────────────────────────────────────
function buildHtml() {
  const groups = [...new Set(TARGETS.map((t) => t.group))];

  const sections = groups.map((group) => {
    const cards = TARGETS.filter((t) => t.group === group).map((t) => `
      <div class="card" id="card-${t.id}" data-env="${t.env}" style="--accent:${t.color}">
        <div class="card-header">
          <span class="board-badge">${t.board}</span>
          ${t.dfu ? '<span class="dfu-badge" title="燒錄前先按住 BOOT 鍵再插 USB">⚑ DFU</span>' : ''}
        </div>
        <div class="card-label">${t.label}</div>
        <button class="upload-btn" onclick="upload('${t.env}','${t.id}')">
          <span class="btn-text">上傳</span>
        </button>
        <div class="progress-bar"><div class="progress-fill" id="bar-${t.id}"></div></div>
        <pre class="log" id="log-${t.id}"></pre>
      </div>
    `).join('');
    return `
      <section>
        <h2>${group}</h2>
        <div class="cards">${cards}</div>
      </section>`;
  }).join('');

  return /* html */`<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Arduino 工具箱</title>
<style>
  :root {
    --bg: #0f1117;
    --surface: #1a1d27;
    --border: #2a2d3a;
    --text: #e4e6ef;
    --muted: #7a7f9a;
    --green: #22c55e;
    --red: #ef4444;
    --yellow: #f59e0b;
    --cyan: #06b6d4;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: system-ui, sans-serif; min-height: 100vh; }

  /* ── Header ── */
  header {
    position: sticky; top: 0; z-index: 10;
    background: var(--surface); border-bottom: 1px solid var(--border);
    padding: 12px 24px; display: flex; align-items: center; gap: 16px;
  }
  header h1 { font-size: 1.1rem; font-weight: 700; white-space: nowrap; }
  .tabs { display: flex; gap: 4px; }
  .tab-btn {
    padding: 6px 16px; border: 1px solid var(--border); border-radius: 6px;
    background: transparent; color: var(--muted); cursor: pointer; font-size: .85rem;
    transition: background .15s, color .15s;
  }
  .tab-btn.active { background: var(--border); color: var(--text); }
  .tab-btn:hover:not(.active) { background: #1f2230; }
  #board-status { margin-left: auto; font-size: .85rem; display: flex; align-items: center; gap: 8px; white-space: nowrap; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--red); flex-shrink: 0; }
  .dot.on { background: var(--green); animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }

  /* ── Tabs ── */
  .tab-pane { display: none; }
  .tab-pane.active { display: block; }

  /* ── Upload pane ── */
  main { padding: 24px; max-width: 1100px; margin: 0 auto; }
  section { margin-bottom: 32px; }
  section h2 {
    font-size: .8rem; text-transform: uppercase; letter-spacing: .08em;
    color: var(--muted); margin-bottom: 12px; padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }

  .card {
    background: var(--surface); border: 1px solid var(--border);
    border-top: 3px solid var(--accent, #444); border-radius: 8px;
    padding: 16px; display: flex; flex-direction: column; gap: 10px;
    transition: box-shadow .15s;
  }
  .card:hover { box-shadow: 0 0 0 1px var(--accent, #444); }

  .card-header { display: flex; gap: 6px; align-items: center; }
  .board-badge {
    font-size: .72rem; font-weight: 600; padding: 2px 8px;
    border-radius: 99px; background: var(--border); color: var(--text);
  }
  .dfu-badge {
    font-size: .72rem; padding: 2px 8px; border-radius: 99px;
    background: #3b2a00; color: var(--yellow); cursor: help;
  }
  .card-label { font-size: .88rem; line-height: 1.4; flex: 1; }

  .upload-btn {
    padding: 9px 0; border: none; border-radius: 6px; cursor: pointer;
    font-size: .9rem; font-weight: 600; background: var(--accent, #444);
    color: #fff; width: 100%; transition: opacity .15s, transform .1s;
  }
  .upload-btn:hover:not(:disabled) { opacity: .85; }
  .upload-btn:active:not(:disabled) { transform: scale(.97); }
  .upload-btn:disabled { opacity: .4; cursor: not-allowed; }

  .progress-bar { height: 3px; background: var(--border); border-radius: 2px; overflow: hidden; display: none; }
  .progress-fill { height: 100%; width: 0; background: var(--accent, #444); transition: width .2s; }

  .log {
    font-size: .72rem; line-height: 1.5; max-height: 200px; overflow-y: auto;
    background: #0a0c12; border-radius: 4px; padding: 8px;
    white-space: pre-wrap; word-break: break-all; display: none;
    color: #aaa; font-family: 'SF Mono', 'Cascadia Code', monospace;
  }
  .log.show { display: block; }
  .log .ok  { color: var(--green); }
  .log .err { color: var(--red); }

  .build-all-row { margin-bottom: 32px; }
  .build-all-btn {
    padding: 10px 24px; background: var(--surface); border: 1px solid var(--border);
    color: var(--text); border-radius: 6px; cursor: pointer; font-size: .9rem;
    transition: background .15s;
  }
  .build-all-btn:hover { background: var(--border); }

  #global-log {
    margin-top: 16px; font-size: .72rem; max-height: 160px; overflow-y: auto;
    background: #0a0c12; border-radius: 4px; padding: 8px; display: none;
    white-space: pre-wrap; word-break: break-all; color: #aaa;
    font-family: 'SF Mono', 'Cascadia Code', monospace;
  }
  #global-log.show { display: block; }

  /* ── Monitor pane ── */
  #monitor-pane { padding: 24px; max-width: 1100px; margin: 0 auto; }
  .monitor-toolbar {
    display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
    margin-bottom: 16px;
  }
  .monitor-toolbar label { font-size: .85rem; color: var(--muted); }
  .monitor-toolbar select, .monitor-toolbar input[type=text] {
    background: var(--surface); border: 1px solid var(--border); color: var(--text);
    border-radius: 6px; padding: 7px 12px; font-size: .88rem; outline: none;
    transition: border-color .15s;
  }
  .monitor-toolbar select:focus, .monitor-toolbar input:focus { border-color: var(--cyan); }
  #monitor-connect-btn {
    padding: 8px 20px; border: none; border-radius: 6px; cursor: pointer;
    font-size: .9rem; font-weight: 600; background: var(--cyan); color: #0a0c12;
    transition: opacity .15s;
  }
  #monitor-connect-btn:hover { opacity: .85; }
  #monitor-connect-btn.connected { background: var(--red); color: #fff; }
  #monitor-clear-btn {
    padding: 8px 14px; border: 1px solid var(--border); border-radius: 6px;
    background: transparent; color: var(--muted); cursor: pointer; font-size: .85rem;
    transition: background .15s;
  }
  #monitor-clear-btn:hover { background: var(--border); }
  .monitor-status { font-size: .8rem; color: var(--muted); margin-left: auto; }
  .monitor-status.on { color: var(--green); }

  #monitor-output {
    background: #0a0c12; border: 1px solid var(--border); border-radius: 8px;
    padding: 12px; height: calc(100vh - 260px); min-height: 320px;
    overflow-y: auto; font-family: 'SF Mono', 'Cascadia Code', monospace;
    font-size: .78rem; line-height: 1.6; white-space: pre-wrap; word-break: break-all;
    color: #c8d0e0;
  }
  #monitor-output .sys  { color: var(--muted); font-style: italic; }
  #monitor-output .recv { color: #c8d0e0; }
  #monitor-output .sent { color: var(--cyan); }
  #monitor-output .err  { color: var(--red); }

  .monitor-input-row {
    display: flex; gap: 8px; margin-top: 12px;
  }
  #monitor-input {
    flex: 1; background: var(--surface); border: 1px solid var(--border);
    color: var(--text); border-radius: 6px; padding: 9px 12px; font-size: .88rem;
    font-family: 'SF Mono', 'Cascadia Code', monospace; outline: none;
    transition: border-color .15s;
  }
  #monitor-input:focus { border-color: var(--cyan); }
  #monitor-input:disabled { opacity: .4; }
  #monitor-send-btn {
    padding: 9px 20px; border: none; border-radius: 6px; cursor: pointer;
    font-size: .88rem; font-weight: 600; background: var(--border); color: var(--text);
    transition: background .15s;
  }
  #monitor-send-btn:hover:not(:disabled) { background: #3a3d4e; }
  #monitor-send-btn:disabled { opacity: .4; cursor: not-allowed; }

  /* common commands bar */
  .quick-cmds {
    display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px;
  }
  .qcmd {
    padding: 4px 10px; background: var(--surface); border: 1px solid var(--border);
    border-radius: 99px; font-size: .75rem; cursor: pointer; color: var(--muted);
    transition: background .15s, color .15s;
    font-family: 'SF Mono', 'Cascadia Code', monospace;
  }
  .qcmd:hover { background: var(--border); color: var(--text); }
  .qcmd:disabled { opacity: .35; cursor: not-allowed; }
</style>
</head>
<body>
<header>
  <h1>🤖 Arduino 工具箱</h1>
  <div class="tabs">
    <button class="tab-btn active" onclick="switchTab('upload')">上傳韌體</button>
    <button class="tab-btn" onclick="switchTab('monitor')">串口監視器</button>
  </div>
  <div id="board-status">
    <span class="dot" id="dot"></span>
    <span id="board-label">偵測板子中…</span>
  </div>
</header>

<!-- ── Upload pane ── -->
<div id="upload-pane" class="tab-pane active">
<main>
  <div class="build-all-row">
    <button class="build-all-btn" onclick="buildAll()">🔨 全部編譯（不上傳）</button>
    <pre id="global-log"></pre>
  </div>
  ${sections}
</main>
</div>

<!-- ── Monitor pane ── -->
<div id="monitor-pane" class="tab-pane">
  <div class="monitor-toolbar">
    <label>連接埠</label>
    <select id="monitor-port">
      <option value="">— 請選擇 —</option>
    </select>
    <label>鮑率</label>
    <select id="monitor-baud">
      <option value="9600" selected>9600</option>
      <option value="19200">19200</option>
      <option value="38400">38400</option>
      <option value="57600">57600</option>
      <option value="115200">115200</option>
    </select>
    <button id="monitor-connect-btn" onclick="toggleMonitor()">連線</button>
    <button id="monitor-clear-btn" onclick="clearMonitor()">清除</button>
    <span class="monitor-status" id="monitor-status">未連線</span>
  </div>
  <pre id="monitor-output"><span class="sys">-- 選擇串口並按「連線」，輸出會顯示在這裡 --\n</span></pre>
  <div class="monitor-input-row">
    <input type="text" id="monitor-input" placeholder="輸入指令（Enter 送出）" disabled
           onkeydown="if(event.key==='Enter')sendMonitorCmd()">
    <button id="monitor-send-btn" onclick="sendMonitorCmd()" disabled>送出</button>
  </div>
  <div class="quick-cmds" id="quick-cmds">
    <span style="font-size:.75rem;color:var(--muted);align-self:center">常用指令：</span>
    ${['STATUS','HEARTBEAT','STOP','EV3_STATUS','EV3_STOP','EV3_HOME','EV3_SAFE_POSE',
       'EV3_ARM_EXTEND','EV3_ARM_RETRACT','EV3_PEN_DOWN','EV3_PEN_UP'].map(
      (cmd) => `<button class="qcmd" id="qcmd-${cmd}" disabled onclick="quickSend('${cmd}')">${cmd}</button>`
    ).join('')}
  </div>
</div>

<script>
const targets = ${JSON.stringify(TARGETS)};
let monitorConnected = false;
let monitorEs = null;
let autoScroll = true;

// ── Tab switching ──────────────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(name + '-pane').classList.add('active');
  event.target.classList.add('active');
}

// ── Board polling ──────────────────────────────────────────────────────────────
let lastPorts = [];
async function pollBoards() {
  try {
    const r = await fetch('/api/boards');
    const {connected, ports} = await r.json();
    document.getElementById('dot').className = 'dot' + (connected ? ' on' : '');
    document.getElementById('board-label').textContent = connected
      ? '已連線：' + ports.join('  ')
      : '未偵測到板子（插好後自動更新）';

    // Update port selector if list changed
    const joined = ports.join(',');
    if (joined !== lastPorts.join(',')) {
      lastPorts = ports;
      const sel = document.getElementById('monitor-port');
      const cur = sel.value;
      sel.innerHTML = '<option value="">— 請選擇 —</option>';
      ports.forEach(p => {
        const opt = document.createElement('option');
        opt.value = opt.textContent = p;
        if (p === cur) opt.selected = true;
        sel.appendChild(opt);
      });
      // Auto-select if only one port
      if (ports.length === 1 && !cur) sel.value = ports[0];
    }
  } catch {}
}
pollBoards();
setInterval(pollBoards, 3000);

// ── Upload ─────────────────────────────────────────────────────────────────────
function upload(env, id) {
  const card = document.getElementById('card-' + id);
  const btn  = card.querySelector('.upload-btn');
  const log  = document.getElementById('log-' + id);
  const bar  = document.getElementById('bar-' + id);
  const fill = bar.parentElement;

  btn.disabled = true;
  btn.querySelector('.btn-text').textContent = '上傳中…';
  log.textContent = '';
  log.className = 'log show';
  fill.style.display = 'block';
  bar.style.width = '5%';

  const es = new EventSource('/api/stream/' + encodeURIComponent(env));
  let pct = 5;

  es.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if (d.type === 'line') {
      const span = document.createElement('span');
      const text = d.text;
      span.className = /error|fail|Error/i.test(text) ? 'err'
                     : /success|done|OK|complete/i.test(text) ? 'ok' : '';
      span.textContent = text;
      log.appendChild(span);
      log.scrollTop = log.scrollHeight;
      pct = Math.min(90, pct + 2);
      bar.style.width = pct + '%';
    }
    if (d.type === 'done') {
      es.close();
      bar.style.width = '100%';
      if (d.ok) {
        btn.querySelector('.btn-text').textContent = '✅ 完成！';
        card.style.boxShadow = '0 0 0 2px #22c55e';
        setTimeout(() => {
          btn.querySelector('.btn-text').textContent = '上傳';
          btn.disabled = false;
          card.style.boxShadow = '';
          fill.style.display = 'none';
        }, 3000);
      } else {
        btn.querySelector('.btn-text').textContent = '❌ 失敗';
        card.style.boxShadow = '0 0 0 2px #ef4444';
        setTimeout(() => {
          btn.querySelector('.btn-text').textContent = '重試';
          btn.disabled = false;
          card.style.boxShadow = '';
        }, 2000);
      }
    }
  };

  es.onerror = () => {
    es.close();
    btn.querySelector('.btn-text').textContent = '重試';
    btn.disabled = false;
  };
}

// ── Build all ──────────────────────────────────────────────────────────────────
function buildAll() {
  const log = document.getElementById('global-log');
  log.textContent = '';
  log.className = 'show';
  const btn = document.querySelector('.build-all-btn');
  btn.disabled = true;
  btn.textContent = '🔨 編譯中…';

  const es = new EventSource('/api/stream/__build__');
  es.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if (d.type === 'line') {
      log.textContent += d.text;
      log.scrollTop = log.scrollHeight;
    }
    if (d.type === 'done') {
      es.close();
      btn.textContent = d.ok ? '✅ 全部編譯完成' : '❌ 編譯失敗，看上面 log';
      btn.disabled = false;
      setTimeout(() => { btn.textContent = '🔨 全部編譯（不上傳）'; }, 4000);
    }
  };
  es.onerror = () => { es.close(); btn.disabled = false; };
}

// ── Serial Monitor ─────────────────────────────────────────────────────────────
function appendMonitor(text, cls) {
  const out = document.getElementById('monitor-output');
  const span = document.createElement('span');
  span.className = cls || 'recv';
  span.textContent = text;
  out.appendChild(span);
  if (autoScroll) out.scrollTop = out.scrollHeight;
}

function setMonitorConnected(on) {
  monitorConnected = on;
  const btn = document.getElementById('monitor-connect-btn');
  const status = document.getElementById('monitor-status');
  btn.textContent = on ? '中斷' : '連線';
  btn.className = on ? 'connected' : '';
  status.textContent = on ? ('● 已連線  ' + document.getElementById('monitor-port').value) : '未連線';
  status.className = 'monitor-status' + (on ? ' on' : '');
  document.getElementById('monitor-input').disabled = !on;
  document.getElementById('monitor-send-btn').disabled = !on;
  document.querySelectorAll('.qcmd').forEach(b => b.disabled = !on);
}

async function toggleMonitor() {
  if (monitorConnected) {
    await fetch('/api/monitor/stop', {method: 'POST'});
    if (monitorEs) { monitorEs.close(); monitorEs = null; }
    setMonitorConnected(false);
    appendMonitor('\\n-- 已中斷連線 --\\n', 'sys');
    return;
  }

  const port = document.getElementById('monitor-port').value;
  const baud = document.getElementById('monitor-baud').value;
  if (!port) { alert('請先選擇串口'); return; }

  const r = await fetch('/api/monitor/start', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({port, baud}),
  });
  const result = await r.json();
  if (!result.ok) {
    appendMonitor('錯誤：' + result.error + '\\n', 'err');
    return;
  }

  monitorEs = new EventSource('/api/monitor/stream');
  monitorEs.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if (d.type === 'open') {
      setMonitorConnected(true);
      appendMonitor('-- 已連線  ' + d.port + '  ' + d.baud + ' baud --\\n', 'sys');
    }
    if (d.type === 'line') appendMonitor(d.text, 'recv');
    if (d.type === 'closed') {
      setMonitorConnected(false);
      appendMonitor('\\n-- 連線已關閉 (exit ' + d.code + ') --\\n', 'sys');
      if (monitorEs) { monitorEs.close(); monitorEs = null; }
    }
  };
  monitorEs.onerror = () => {
    if (monitorConnected) {
      setMonitorConnected(false);
      appendMonitor('\\n-- SSE 連線中斷 --\\n', 'err');
    }
    if (monitorEs) { monitorEs.close(); monitorEs = null; }
  };
}

async function sendMonitorCmd() {
  const input = document.getElementById('monitor-input');
  const text = input.value.trim();
  if (!text || !monitorConnected) return;
  input.value = '';
  appendMonitor('> ' + text + '\\n', 'sent');
  await fetch('/api/monitor/send', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({text}),
  });
}

function quickSend(cmd) {
  document.getElementById('monitor-input').value = cmd;
  sendMonitorCmd();
}

function clearMonitor() {
  document.getElementById('monitor-output').innerHTML =
    '<span class="sys">-- 已清除 --\\n</span>';
}

// Keep auto-scroll off when user scrolls up
document.getElementById('monitor-output')?.addEventListener('scroll', (e) => {
  const el = e.target;
  autoScroll = el.scrollTop + el.clientHeight >= el.scrollHeight - 20;
});
</script>
</body>
</html>`;
}

// ── HTTP server ───────────────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Static HTML
  if (url.pathname === '/') {
    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
    res.end(buildHtml());
    return;
  }

  // Board status
  if (url.pathname === '/api/boards') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(getBoards()));
    return;
  }

  // SSE stream for upload / build
  if (url.pathname.startsWith('/api/stream/')) {
    const envRaw  = decodeURIComponent(url.pathname.slice('/api/stream/'.length));
    const buildOnly = envRaw === '__build__';
    const env = buildOnly ? '__build__' : envRaw;

    res.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    });
    res.write('retry: 1000\n\n');

    if (!streams.has(env)) streams.set(env, new Set());
    streams.get(env).add(res);
    req.on('close', () => streams.get(env)?.delete(res));

    startJob(env, !buildOnly);
    return;
  }

  // ── Monitor endpoints ──────────────────────────────────────────────────────

  // POST /api/monitor/start
  if (url.pathname === '/api/monitor/start' && req.method === 'POST') {
    const body = await readBody(req);
    const result = startMonitor(body.port || '', String(body.baud || '9600'));
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(result));
    return;
  }

  // GET /api/monitor/stream  (SSE)
  if (url.pathname === '/api/monitor/stream') {
    res.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    });
    res.write('retry: 1000\n\n');
    monitorClients.add(res);
    req.on('close', () => monitorClients.delete(res));
    return;
  }

  // POST /api/monitor/send
  if (url.pathname === '/api/monitor/send' && req.method === 'POST') {
    const body = await readBody(req);
    const result = sendToMonitor(body.text || '');
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(result));
    return;
  }

  // POST /api/monitor/stop
  if (url.pathname === '/api/monitor/stop' && req.method === 'POST') {
    const result = stopMonitor();
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(result));
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n🤖  Arduino 工具箱已啟動`);
  console.log(`   上傳韌體 + 串口監視器：${url}`);
  console.log(`   停止：Ctrl-C\n`);

  try {
    const open = process.platform === 'darwin' ? 'open'
               : process.platform === 'win32'  ? 'start'
               : 'xdg-open';
    spawn(open, [url], {stdio: 'ignore', detached: true}).unref();
  } catch {}
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} 已被佔用，試試關掉其他 npm run upload 視窗。`);
  } else {
    console.error(e.message);
  }
  process.exit(1);
});
