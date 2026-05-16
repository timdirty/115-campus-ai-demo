import {spawn} from 'node:child_process';
import net from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';

const appDir = process.cwd();
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const okStatuses = new Set([200, 202, 502, 503]);

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

async function checkEndpoint(method, url, body, label) {
  const init = {method, headers: {'Content-Type': 'application/json'}};
  if (body !== undefined) init.body = JSON.stringify(body);

  try {
    const response = await fetch(url, init);
    return {
      label,
      status: response.status,
      ok: okStatuses.has(response.status),
      url,
    };
  } catch (error) {
    return {
      label,
      status: 0,
      ok: false,
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

    const results = await Promise.all([
      checkEndpoint('GET', `${base}/api/health`, undefined, 'health'),
      checkEndpoint('GET', `${base}/api/ready`, undefined, 'ready'),
      checkEndpoint('POST', `${base}/api/ops/reset`, {}, 'ops/reset'),
      checkEndpoint('GET', `${base}/api/ai/status`, undefined, 'ai/status'),
      checkEndpoint('POST', `${base}/api/ai/vision-classify`, {imageBase64: TINY_PNG}, 'ai/vision-classify'),
      checkEndpoint('POST', `${base}/api/ai/classroom-scan`, {imageBase64: TINY_PNG}, 'ai/classroom-scan'),
      checkEndpoint('POST', `${base}/api/robot/command`, {command: 'BEEP'}, 'robot/command'),
      checkEndpoint('POST', `${base}/api/robot/task`, {taskType: 'PATROL', description: 'demo:check probe'}, 'robot/task'),
      checkEndpoint('GET', `${base}/api/display/info`, undefined, 'display/info'),
      checkEndpoint('GET', `${base}/api/display/status`, undefined, 'display/status'),
    ]);

    let allOk = true;
    for (const result of results) {
      const tag = result.ok ? 'PASS' : 'FAIL';
      console.log(`[${tag}] ${result.label.padEnd(20)} ${String(result.status || '---').padEnd(3)} ${result.url}${result.error ? ` ${result.error}` : ''}`);
      if (!result.ok) allOk = false;
    }

    process.exitCode = allOk ? 0 : 1;
  } catch (error) {
    console.error('[demo:check] crashed:', error instanceof Error ? error.stack : String(error));
    if (bridgeLogs.length) console.error(bridgeLogs.join('\n'));
    process.exitCode = 1;
  } finally {
    await stopProcess(bridge);
  }
}

await main();
