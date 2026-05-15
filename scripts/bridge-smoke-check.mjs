#!/usr/bin/env node

import {execFileSync, spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const bridges = [
  {
    id: 'app1',
    name: 'AI 自動板擦機器人',
    port: 3201,
    cwd: 'apps/app1-whiteboard',
    command: 'SHOW_ON',
    env: {NODE_ENV: 'production', EV3_SIMULATE: '1', SPIKE_SIMULATE: '1'},
  },
  {
    id: 'app2',
    name: '校園服務機器人',
    port: 3202,
    cwd: 'apps/app2-campus-service',
    command: 'DELIVERY_START',
    env: {},
  },
  {
    id: 'app3',
    name: 'AI 校園心靈守護者',
    port: 3203,
    cwd: 'apps/app3-guardian',
    command: 'CARE_DEPLOYED',
    env: {SPIKE_SIMULATE: '1'},
  },
];

const children = [];
const logs = new Map();

function rememberLog(id, chunk) {
  const lines = String(chunk).split(/\r?\n/).filter(Boolean);
  const next = [...(logs.get(id) ?? []), ...lines].slice(-18);
  logs.set(id, next);
}

function startBridge(bridge) {
  const child = spawn('npx', ['tsx', 'server/serialBridge.ts'], {
    cwd: path.join(rootDir, bridge.cwd),
    env: {
      ...process.env,
      ...bridge.env,
      BRIDGE_PORT: String(bridge.port),
      DEMO_SIMULATE_HARDWARE: '1',
      ARDUINO_SIMULATE: '1',
      BRIDGE_LOG_THROTTLE_MS: '1000',
    },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => rememberLog(bridge.id, chunk));
  child.stderr.on('data', (chunk) => rememberLog(bridge.id, chunk));
  children.push(child);
  return child;
}

function clearPort(port) {
  try {
    const output = execFileSync('lsof', ['-ti', `:${port}`], {encoding: 'utf8'}).trim();
    if (!output) return;
    for (const pid of output.split(/\s+/)) {
      try {
        process.kill(Number(pid), 'SIGKILL');
      } catch {
        // Already gone.
      }
    }
  } catch {
    // lsof exits non-zero when nothing is listening.
  }
}

async function fetchJson(url, init) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(4000),
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return {response, body};
}

async function waitForHealth(bridge) {
  const url = `http://127.0.0.1:${bridge.port}/api/health`;
  const deadline = Date.now() + 15000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const {response, body} = await fetchJson(url);
      if (response.ok && body?.ok === true) return body;
      lastError = new Error(`${response.status} ${JSON.stringify(body)}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error(`health timeout: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function postCommand(bridge) {
  const {response, body} = await fetchJson(`http://127.0.0.1:${bridge.port}/api/robot/command`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({command: bridge.command, source: 'bridge-smoke'}),
  });
  if (!response.ok || body?.ok !== true) {
    throw new Error(`command ${bridge.command} returned ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function stopChildren() {
  for (const child of children) {
    if (child.exitCode === null) {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        child.kill('SIGTERM');
      }
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
  for (const child of children) {
    if (child.exitCode === null) {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
    }
  }
}

try {
  for (const bridge of bridges) clearPort(bridge.port);
  for (const bridge of bridges) startBridge(bridge);

  for (const bridge of bridges) {
    const health = await waitForHealth(bridge);
    const command = await postCommand(bridge);
    console.log(`ok ${bridge.id} :${bridge.port} ${bridge.name} health + ${bridge.command}`);
    console.log(`   simulation=${health.hardwareSimulation ?? health.arduinoConnected === false} response=${command.response ?? command.status?.lastResponse ?? 'ok'}`);
  }
  console.log('Bridge smoke check passed.');
} catch (error) {
  console.error(`Bridge smoke check failed: ${error instanceof Error ? error.message : String(error)}`);
  for (const bridge of bridges) {
    const tail = logs.get(bridge.id);
    if (tail?.length) {
      console.error(`\n[${bridge.id} log tail]`);
      for (const line of tail) console.error(line);
    }
  }
  process.exitCode = 1;
} finally {
  await stopChildren();
}
