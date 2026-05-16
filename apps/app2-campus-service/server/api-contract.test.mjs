import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(appRoot, '..');
const ownsTestServer = !process.env.TEST_BASE_URL;
const testPort = Number(process.env.TEST_BRIDGE_PORT ?? 3222);
const baseUrl = process.env.TEST_BASE_URL ?? `http://127.0.0.1:${testPort}`;
const tinyPngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
const dataDir = path.resolve(appRoot, '../data');
const dataFilesToRestore = ['delivery-log.json', 'task-log.json'].map((file) => path.join(dataDir, file));
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

  const aiStatus = await request('/api/ai/status');
  assertStatus('GET /api/ai/status', aiStatus.response.status, [200, 502, 503]);

  const robotCommand = await request('/api/robot/command', {
    method: 'POST',
    body: JSON.stringify({command: 'BEEP'}),
  });
  assertStatus('POST /api/robot/command', robotCommand.response.status, [200, 502, 503]);

  const robotTask = await request('/api/robot/task', {
    method: 'POST',
    body: JSON.stringify({taskType: 'PATROL', description: 'test'}),
  });
  assertStatus('POST /api/robot/task', robotTask.response.status, [200, 502, 503]);

  const campusAi = await request('/api/ai/campus', {
    method: 'POST',
    body: JSON.stringify({userMessage: '請安排校園巡邏'}),
  });
  assertStatus('POST /api/ai/campus', campusAi.response.status, [200, 502, 503]);

  const visionClassify = await request('/api/ai/vision-classify', {
    method: 'POST',
    body: JSON.stringify({imageBase64: tinyPngDataUrl}),
  });
  assertStatus('POST /api/ai/vision-classify', visionClassify.response.status, [200, 502, 503]);

  const teacherReply = await request('/api/ai/teacher-reply', {
    method: 'POST',
    body: JSON.stringify({question: '測試'}),
  });
  assertStatus('POST /api/ai/teacher-reply', teacherReply.response.status, [200, 502, 503]);

  const dispatchRecommend = await request('/api/ai/dispatch-recommend', {
    method: 'POST',
    body: JSON.stringify({zone: 'A棟', taskType: 'patrol'}),
  });
  assertStatus('POST /api/ai/dispatch-recommend', dispatchRecommend.response.status, [200, 502, 503]);

  const studentReport = await request('/api/ai/student-report', {
    method: 'POST',
    body: JSON.stringify({name: '測試', data: {}}),
  });
  assertStatus('POST /api/ai/student-report', studentReport.response.status, [200, 502, 503]);

  const classroomScan = await request('/api/ai/classroom-scan', {
    method: 'POST',
    body: JSON.stringify({imageBase64: tinyPngDataUrl}),
  });
  assertStatus('POST /api/ai/classroom-scan', classroomScan.response.status, [200, 502, 503]);

  const logs = await request('/api/logs');
  assertStatus('GET /api/logs', logs.response.status, [200]);
  assert.ok(Array.isArray(logs.body.deliveryLogs));
  assert.ok(Array.isArray(logs.body.taskLogs));

  const reset = await request('/api/ops/reset', {method: 'POST'});
  assertStatus('POST /api/ops/reset', reset.response.status, [200]);

  const ev3Status = await request('/api/ev3/status');
  assertStatus('GET /api/ev3/status', ev3Status.response.status, [200]);

  const ev3Command = await request('/api/ev3/command', {
    method: 'POST',
    body: JSON.stringify({command: 'BEEP'}),
  });
  assertStatus('POST /api/ev3/command', ev3Command.response.status, [200, 400, 503]);

  const spikeStatus = await request('/api/spike/status');
  assertStatus('GET /api/spike/status', spikeStatus.response.status, [200]);

  const spikeCommand = await request('/api/spike/command', {
    method: 'POST',
    body: JSON.stringify({command: 'BEEP'}),
  });
  assertStatus('POST /api/spike/command', spikeCommand.response.status, [200, 400, 503]);

  const displayInfo = await request('/api/display/info');
  assertStatus('GET /api/display/info', displayInfo.response.status, [200]);

  const displayEmotion = await request('/api/display/emotion', {
    method: 'POST',
    body: JSON.stringify({emotion: 'calm'}),
  });
  assertStatus('POST /api/display/emotion', displayEmotion.response.status, [200, 400]);

  const displayCue = await request('/api/display/cue', {
    method: 'POST',
    body: JSON.stringify({cue: 'BEEP'}),
  });
  assertStatus('POST /api/display/cue', displayCue.response.status, [200, 400]);

  const displayStatus = await request('/api/display/status');
  assertStatus('GET /api/display/status', displayStatus.response.status, [200]);

  console.log('api-contract ok');
} finally {
  await restoreDataFiles(dataSnapshots);
  await stopTestServer(testServer);
}
