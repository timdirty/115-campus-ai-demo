import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(appRoot, '..');
const ownsTestServer = !process.env.TEST_BASE_URL;
const testPort = Number(process.env.TEST_BRIDGE_PORT ?? 3233);
const baseUrl = process.env.TEST_BASE_URL ?? `http://127.0.0.1:${testPort}`;
const tinyPngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
const dataDir = path.resolve(appRoot, '../data');
const dataFilesToRestore = ['alert-log.json', 'sensor-assignments.json'].map((file) => path.join(dataDir, file));
const shouldRestoreLocalData = /localhost|127\.0\.0\.1/.test(baseUrl);

async function request(pathname, options = {}) {
  const {headers, ...rest} = options;
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...rest,
    headers: {'Content-Type': 'application/json', ...(headers ?? {})},
  });
  const body = await response.json().catch(() => ({}));
  return {response, body};
}

function assertStatus(endpoint, actual, expected) {
  assert.ok(
    expected.includes(actual),
    `${endpoint} returned ${actual}; expected one of ${expected.join(', ')}`
  );
}

async function snapshotDataFiles() {
  if (!shouldRestoreLocalData) {
    return [];
  }

  return Promise.all(dataFilesToRestore.map(async (file) => {
    try {
      return {file, raw: await readFile(file, 'utf8')};
    } catch {
      return {file, raw: null};
    }
  }));
}

async function restoreDataFiles(snapshots) {
  await Promise.all(snapshots.map(async ({file, raw}) => {
    if (raw !== null) {
      await writeFile(file, raw, 'utf8');
    }
  }));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForBridge() {
  let lastError;

  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      const health = await fetch(`${baseUrl}/api/health`);
      if (health.ok) return;
      lastError = new Error(`Health check returned ${health.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }

  throw lastError instanceof Error ? lastError : new Error('Bridge did not become ready');
}

async function startTestServer() {
  if (!ownsTestServer) {
    return null;
  }

  const tsxBin = path.join(projectRoot, 'node_modules/.bin/tsx');
  let output = '';
  const child = spawn(tsxBin, ['server/serialBridge.ts'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      BRIDGE_PORT: String(testPort),
      DEMO_SIMULATE_HARDWARE: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  try {
    await waitForBridge();
  } catch (error) {
    child.kill('SIGTERM');
    throw new Error(`Test bridge failed to start: ${error instanceof Error ? error.message : String(error)}\n${output}`);
  }

  return child;
}

async function stopTestServer(child) {
  if (!child) return;

  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    sleep(2500).then(() => {
      child.kill('SIGKILL');
    }),
  ]);
}

const dataSnapshots = await snapshotDataFiles();
const testServer = await startTestServer();

try {
  const health = await request('/api/health');
  assertStatus('GET /api/health', health.response.status, [200]);
  assert.equal(health.body.ok, true);

  const ready = await request('/api/ready');
  assertStatus('GET /api/ready', ready.response.status, [200]);
  assert.equal(ready.body.ok, true);

  const sensorPorts = await request('/api/sensors/ports');
  assertStatus('GET /api/sensors/ports', sensorPorts.response.status, [200]);
  assert.ok(Array.isArray(sensorPorts.body.ports));

  const sensorAssign = await request('/api/sensors/assign', {
    method: 'POST',
    body: JSON.stringify({portPath: '/dev/null', zoneId: 'zone-test'}),
  });
  assertStatus('POST /api/sensors/assign', sensorAssign.response.status, [200, 400]);

  const sensorLive = await request('/api/sensors/live');
  assertStatus('GET /api/sensors/live', sensorLive.response.status, [200]);

  const robotCommand = await request('/api/robot/command', {
    method: 'POST',
    body: JSON.stringify({command: 'BEEP'}),
  });
  assertStatus('POST /api/robot/command', robotCommand.response.status, [200, 502, 503]);

  const robotDrive = await request('/api/robot/drive', {
    method: 'POST',
    body: JSON.stringify({command: 'STOP'}),
  });
  assertStatus('POST /api/robot/drive', robotDrive.response.status, [200, 400, 502, 503]);

  const robotEmotionScan = await request('/api/robot/emotion-scan', {
    method: 'POST',
    body: JSON.stringify({imageBase64: tinyPngDataUrl}),
  });
  assertStatus('POST /api/robot/emotion-scan', robotEmotionScan.response.status, [200, 502, 503]);

  const guardianAi = await request('/api/ai/guardian', {
    method: 'POST',
    body: JSON.stringify({
      alertType: '國中壓力事件',
      riskLevel: 'medium',
      severity: 'medium',
      message: 'test',
      description: 'test',
    }),
  });
  assertStatus('POST /api/ai/guardian', guardianAi.response.status, [200, 502, 503]);

  const guardianChat = await request('/api/ai/guardian-chat', {
    method: 'POST',
    body: JSON.stringify({text: '測試', mood: 'calm'}),
  });
  assertStatus('POST /api/ai/guardian-chat', guardianChat.response.status, [200, 502, 503]);

  const zoneAdvisor = await request('/api/ai/zone-advisor', {
    method: 'POST',
    body: JSON.stringify({zoneName: '圖書館', recentReadings: []}),
  });
  assertStatus('POST /api/ai/zone-advisor', zoneAdvisor.response.status, [200, 502, 503]);

  const alertLogs = await request('/api/logs/alerts');
  assertStatus('GET /api/logs/alerts', alertLogs.response.status, [200]);
  assert.ok(Array.isArray(alertLogs.body.logs));

  const alertLog = await request('/api/logs/alerts', {
    method: 'POST',
    body: JSON.stringify({zoneId: 'zone-test', type: '測試', riskLevel: 'low', category: 'test'}),
  });
  assertStatus('POST /api/logs/alerts', alertLog.response.status, [200, 400]);

  const reset = await request('/api/ops/reset', {method: 'POST'});
  assertStatus('POST /api/ops/reset', reset.response.status, [200]);

  const ev3Status = await request('/api/ev3/status');
  assertStatus('GET /api/ev3/status', ev3Status.response.status, [200]);

  const ev3Command = await request('/api/ev3/command', {
    method: 'POST',
    body: JSON.stringify({command: 'BEEP'}),
  });
  assertStatus('POST /api/ev3/command', ev3Command.response.status, [200, 400, 502, 503]);

  const spikeStatus = await request('/api/spike/status');
  assertStatus('GET /api/spike/status', spikeStatus.response.status, [200]);

  const spikeCommand = await request('/api/spike/command', {
    method: 'POST',
    body: JSON.stringify({command: 'BEEP'}),
  });
  assertStatus('POST /api/spike/command', spikeCommand.response.status, [200, 400, 502, 503]);

  const guardianSnapshotPost = await request('/api/display/guardian-snapshot', {
    method: 'POST',
    body: JSON.stringify({
      emotion: 'calm',
      stress: 12,
      stability: 90,
      focus: 80,
      fusionScore: 8.6,
      riskScore: 12,
      riskLabel: '低風險',
      moodLabel: '平穩',
      robotActive: false,
      force: true,
    }),
  });
  assertStatus('POST /api/display/guardian-snapshot', guardianSnapshotPost.response.status, [200, 400]);

  const guardianSnapshotGet = await request('/api/display/guardian-snapshot');
  assertStatus('GET /api/display/guardian-snapshot', guardianSnapshotGet.response.status, [200]);

  const robotAssignmentPost = await request('/api/display/robot-assignment', {
    method: 'POST',
    body: JSON.stringify({
      zoneId: 'zone-test',
      zoneName: '圖書館',
      riskLevel: 'low',
      active: true,
      moving: false,
    }),
  });
  assertStatus('POST /api/display/robot-assignment', robotAssignmentPost.response.status, [200, 400]);

  const robotAssignmentGet = await request('/api/display/robot-assignment');
  assertStatus('GET /api/display/robot-assignment', robotAssignmentGet.response.status, [200]);

  const emotionEventPost = await request('/api/display/emotion-event', {
    method: 'POST',
    body: JSON.stringify({
      emotion: 'calm',
      emotionLabel: '平穩',
      zoneId: 'zone-test',
      zoneName: '圖書館',
      riskLevel: 'medium',
      description: 'test',
    }),
  });
  assertStatus('POST /api/display/emotion-event', emotionEventPost.response.status, [200, 400]);

  const emotionEventsGet = await request('/api/display/emotion-events');
  assertStatus('GET /api/display/emotion-events', emotionEventsGet.response.status, [200]);
  assert.ok(Array.isArray(emotionEventsGet.body.events));

  const displayInfo = await request('/api/display/info');
  assertStatus('GET /api/display/info', displayInfo.response.status, [200]);

  const displayEmotion = await request('/api/display/emotion', {
    method: 'POST',
    body: JSON.stringify({emotion: 'calm'}),
  });
  assertStatus('POST /api/display/emotion', displayEmotion.response.status, [200, 400]);

  const displayStatus = await request('/api/display/status');
  assertStatus('GET /api/display/status', displayStatus.response.status, [200]);

  console.log('api-contract ok');
} finally {
  await restoreDataFiles(dataSnapshots);
  await stopTestServer(testServer);
}
