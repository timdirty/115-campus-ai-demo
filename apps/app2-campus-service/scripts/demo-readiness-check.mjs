import {spawn} from 'node:child_process';
import net from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';

const appDir = process.cwd();
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
// 嚴格 vs 寬鬆狀態：
// - strictOkStatuses: endpoint 必須真的活 + 回 200/202，才算 PASS。任何 fallback (502/503) 是 WARN 不是 PASS。
// - warnStatuses: 已知 graceful fallback（AI 沒 API key / hardware sim mode），不阻塞 demo 但要顯示警告。
const strictOkStatuses = new Set([200, 202]);
const warnStatuses = new Set([502, 503]);

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === 'object' && address?.port) resolve(address.port);
        else reject(new Error('Unable to allocate a local port'));
      });
    });
  });
}

function spawnBridge(port) {
  const env = {
    ...process.env,
    BRIDGE_PORT: String(port),
    DEMO_SIMULATE_HARDWARE: '1',
  };
  return spawn(npmBin, ['run', 'dev:bridge'], {
    cwd: appDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function waitForOk(url, label, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(250);
  }

  throw new Error(`${label} not ready at ${url}: ${lastError}`);
}

async function checkEndpoint(method, url, body, label, options = {}) {
  const allowWarn = options.allowWarn === true;
  const init = {method, headers: {'Content-Type': 'application/json'}};
  if (body !== undefined) init.body = JSON.stringify(body);

  try {
    const response = await fetch(url, init);
    const status = response.status;
    let level;
    if (strictOkStatuses.has(status)) level = 'PASS';
    else if (allowWarn && warnStatuses.has(status)) level = 'WARN';
    else level = 'FAIL';
    return {label, status, level, url};
  } catch (error) {
    return {
      label,
      status: 0,
      level: 'FAIL',
      url,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function stopProcess(child) {
  if (!child || child.killed) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill('SIGINT');
  await Promise.race([
    exited,
    delay(2000).then(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }),
  ]);
}

async function main() {
  const bridgePort = await getFreePort();
  const bridge = spawnBridge(bridgePort);
  const bridgeLogs = [];

  const remember = (chunk) => {
    for (const line of String(chunk).split(/\r?\n/).filter(Boolean)) {
      bridgeLogs.push(`[bridge] ${line}`);
      if (bridgeLogs.length > 80) bridgeLogs.shift();
    }
  };
  bridge.stdout.on('data', remember);
  bridge.stderr.on('data', remember);

  try {
    const base = `http://127.0.0.1:${bridgePort}`;
    await waitForOk(`${base}/api/health`, 'Bridge');

    // 核心 endpoint（demo 必要）：必須 200/202
    // AI/硬體 endpoint：允許 WARN（502/503 = AI 未設定或硬體模擬中）但會清楚標示
    const results = await Promise.all([
      checkEndpoint('GET', `${base}/api/health`, undefined, 'health'),
      checkEndpoint('GET', `${base}/api/ready`, undefined, 'ready'),
      checkEndpoint('POST', `${base}/api/ops/reset`, {}, 'ops/reset'),
      checkEndpoint('GET', `${base}/api/ai/status`, undefined, 'ai/status', {allowWarn: true}),
      checkEndpoint('POST', `${base}/api/ai/vision-classify`, {imageBase64: TINY_PNG}, 'ai/vision-classify', {allowWarn: true}),
      checkEndpoint('POST', `${base}/api/ai/classroom-scan`, {imageBase64: TINY_PNG}, 'ai/classroom-scan', {allowWarn: true}),
      checkEndpoint('POST', `${base}/api/robot/command`, {command: 'BEEP'}, 'robot/command', {allowWarn: true}),
      checkEndpoint('POST', `${base}/api/robot/task`, {taskType: 'PATROL', description: 'demo:check probe'}, 'robot/task'),
      checkEndpoint('GET', `${base}/api/display/info`, undefined, 'display/info'),
      checkEndpoint('GET', `${base}/api/display/status`, undefined, 'display/status'),
    ]);

    let hasFail = false;
    let warnCount = 0;
    for (const result of results) {
      const tag = result.level;
      console.log(`[${tag}] ${result.label.padEnd(20)} ${String(result.status || '---').padEnd(3)} ${result.url}${result.error ? ` ${result.error}` : ''}`);
      if (result.level === 'FAIL') hasFail = true;
      if (result.level === 'WARN') warnCount += 1;
    }

    if (warnCount > 0) {
      console.log('');
      console.log(`⚠ ${warnCount} 個 endpoint WARN — AI 未設定 GEMINI_API_KEY 或硬體 SIM 模式。比賽前確認真實 key 與 Arduino 已上傳對應韌體。`);
    }

    process.exitCode = hasFail ? 1 : 0;
  } catch (error) {
    console.error('[demo:check] crashed:', error instanceof Error ? error.stack : String(error));
    if (bridgeLogs.length) console.error(bridgeLogs.join('\n'));
    process.exitCode = 1;
  } finally {
    await stopProcess(bridge);
  }
}

await main();
