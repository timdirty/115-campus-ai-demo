#!/usr/bin/env node

import {spawn} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagesDir = path.join(rootDir, 'pages-dist');
const port = Number(process.env.MOBILE_CHECK_PORT ?? 4180);
const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const viewportWidth = Number(process.env.MOBILE_CHECK_WIDTH ?? 390);
const viewportHeight = Number(process.env.MOBILE_CHECK_HEIGHT ?? 844);

if (!fs.existsSync(pagesDir)) {
  console.error('pages-dist is missing. Run node scripts/build-github-pages.mjs first.');
  process.exit(1);
}

if (!fs.existsSync(chromePath)) {
  console.warn(`Chrome not found at ${chromePath}; skipping mobile layout check.`);
  process.exit(0);
}

const contentTypes = {
  '.css': 'text/css',
  '.html': 'text/html;charset=utf-8',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent((request.url ?? '/').split('?')[0]);
  let filePath = path.join(pagesDir, pathname);
  if (!filePath.startsWith(pagesDir)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
  if (!fs.existsSync(filePath)) filePath = path.join(pagesDir, 'index.html');
  response.writeHead(200, {'content-type': contentTypes[path.extname(filePath)] ?? 'application/octet-stream'});
  fs.createReadStream(filePath).pipe(response);
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

const userDataDir = path.join('/tmp', `campus-mobile-check-${Date.now()}`);
const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  `--remote-debugging-port=${port + 1}`,
  `--user-data-dir=${userDataDir}`,
  'about:blank',
], {stdio: ['ignore', 'ignore', 'pipe']});

async function waitForBrowser() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port + 1}/json/version`);
      if (response.ok) return response.json();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error('Chrome DevTools endpoint did not start.');
}

const browser = await waitForBrowser();
const socket = new WebSocket(browser.webSocketDebuggerUrl);
let nextId = 1;
const pending = new Map();

socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
};

await new Promise((resolve) => {
  socket.onopen = resolve;
});

function send(method, params = {}, sessionId) {
  const id = nextId;
  nextId += 1;
  const payload = {id, method, params};
  if (sessionId) payload.sessionId = sessionId;
  socket.send(JSON.stringify(payload));
  return new Promise((resolve) => pending.set(id, resolve));
}

const targetId = (await send('Target.createTarget', {url: 'about:blank'})).result.targetId;
const sessionId = (await send('Target.attachToTarget', {targetId, flatten: true})).result.sessionId;
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Emulation.setDeviceMetricsOverride', {
  width: viewportWidth,
  height: viewportHeight,
  deviceScaleFactor: 1,
  mobile: true,
}, sessionId);

const routes = ['/', '/app1/', '/app2/', '/app3/'];
const failures = [];

for (const route of routes) {
  await send('Page.navigate', {url: `http://127.0.0.1:${port}${route}`}, sessionId);
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const expression = `(() => {
    const clipped = [...document.querySelectorAll('button:not(.card),a:not(.card),h1,h2,h3,p,span,strong')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({
        text: (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80),
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        className: String(el.className).slice(0, 120),
      }))
      .filter((item) => item.text && !item.className.includes('line-clamp') && (item.scrollWidth > item.clientWidth + 2 || item.scrollHeight > item.clientHeight + 8))
      .slice(0, 10);
    const smallButtons = [...document.querySelectorAll('button,a')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {text: (el.innerText || el.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 50), width: Math.round(rect.width), height: Math.round(rect.height)};
      })
      .filter((item) => item.width > 0 && item.height > 0 && (item.width < 40 || item.height < 40))
      .slice(0, 10);
    return {
      route: location.pathname,
      bodyScrollWidth: document.body.scrollWidth,
      docScrollWidth: document.documentElement.scrollWidth,
      clipped,
      smallButtons,
    };
  })()`;
  const data = (await send('Runtime.evaluate', {expression, returnByValue: true}, sessionId)).result.result.value;
  console.log(JSON.stringify(data));
  if (data.bodyScrollWidth > viewportWidth || data.docScrollWidth > viewportWidth || data.clipped.length || data.smallButtons.length) {
    failures.push(data);
  }
}

await send('Browser.close');
server.close();
chrome.kill('SIGTERM');

if (failures.length) {
  console.error('Mobile layout check failed.');
  process.exit(1);
}

console.log('Mobile layout check passed.');
