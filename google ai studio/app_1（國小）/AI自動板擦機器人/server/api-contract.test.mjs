import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile, unlink, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(appRoot, '..');
const ownsTestServer = !process.env.TEST_BASE_URL;
const testPort = Number(process.env.TEST_BRIDGE_PORT ?? 3217);
const baseUrl = process.env.TEST_BASE_URL ?? `http://127.0.0.1:${testPort}`;
const tinyPngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
const dataDir = path.resolve(appRoot, '../data');
const dataFilesToRestore = ['notes.json', 'chat.json', 'classroom-session.json', 'robot-status.json', 'task-log.json'].map((file) => path.join(dataDir, file));
const shouldRestoreLocalData = /localhost|127\.0\.0\.1/.test(baseUrl);
const generatedFilesToRemove = [];

async function request(pathname, options = {}) {
  const {headers, ...rest} = options;
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...rest,
    headers: {'Content-Type': 'application/json', ...(headers ?? {})},
  });
  const body = await response.json().catch(() => ({}));
  return {response, body};
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

  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const health = await fetch(`${baseUrl}/api/health`);
      if (health.ok) return;
      lastError = new Error(`Health check returned ${health.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(120);
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
    sleep(1000).then(() => {
      child.kill('SIGKILL');
    }),
  ]);
}

const dataSnapshots = await snapshotDataFiles();
const testServer = await startTestServer();

try {
  const health = await request('/api/health');
  assert.equal(health.response.status, 200);
  assert.equal(health.body.ok, true);

  const ready = await request('/api/ready');
  assert.equal(ready.response.status, 200);
  assert.equal(ready.body.ok, true);
  assert.equal(ready.body.storage.writable, true);
  assert.equal(typeof ready.body.staticBuild.available, 'boolean');

  const session = await request('/api/classroom/session');
  assert.equal(session.response.status, 200);
  assert.equal(typeof session.body.session.focusPercent, 'number');
  assert.ok(Array.isArray(session.body.session.boardRegions));
  assert.ok(session.body.session.boardRegions.length >= 3);

  const updatedSession = await request('/api/classroom/session', {
    method: 'POST',
    body: JSON.stringify({
      focusPercent: 71,
      confusedPercent: 18,
      tiredPercent: 11,
      teacherPace: 'slow_down',
      currentRecommendation: '建議先保留左側圖解區，清空右側練習區。',
    }),
  });
  assert.equal(updatedSession.response.status, 200);
  assert.equal(updatedSession.body.session.focusPercent, 71);
  assert.equal(updatedSession.body.session.teacherPace, 'slow_down');

  const normalizedSession = await request('/api/classroom/session', {
    method: 'POST',
    body: JSON.stringify({
      boardRegions: [
        {id: 'Region A', label: '左側', x: 260, y: 0, width: 550, height: 1080, status: 'keep', reason: '超出百分比的座標應回到安全值'},
        {id: 'Region B', label: '右側', x: 54, y: 20, width: 34, height: 50, status: 'erasable', reason: '有效百分比座標保留'},
        {id: 'Region C', label: '下方', x: 22, y: 78, width: 58, height: 16, status: 'keep', reason: '有效百分比座標保留'},
      ],
    }),
  });
  assert.equal(normalizedSession.response.status, 200);
  assert.deepEqual(normalizedSession.body.session.boardRegions.map((region) => region.id), ['A', 'B', 'C']);
  assert.ok(normalizedSession.body.session.boardRegions.every((region) => region.x >= 0 && region.x <= 100 && region.width > 0 && region.width <= 100));

  const robotStatusBefore = await request('/api/robot/status');
  assert.equal(robotStatusBefore.response.status, 200);
  assert.equal(typeof robotStatusBefore.body.status.connected, 'boolean');
  assert.ok(Array.isArray(robotStatusBefore.body.taskLog));

  const robotCommands = await request('/api/robot/commands');
  assert.equal(robotCommands.response.status, 200);
  assert.ok(Array.isArray(robotCommands.body.commands));
  assert.ok(robotCommands.body.commands.some((item) => item.command === 'ERASE_REGION_B'));
  assert.equal(robotCommands.body.taskActions.erase.B, 'ERASE_REGION_B');

  const elementaryNotes = await request('/api/notes');
  assert.equal(elementaryNotes.response.status, 200);
  assert.ok(Array.isArray(elementaryNotes.body.notes));
  assert.ok(elementaryNotes.body.notes.length >= 2);
  const notesText = elementaryNotes.body.notes.map((note) => `${note.title} ${note.subject} ${note.content} ${note.desc}`).join('\n');
  assert.match(notesText, /國小|分數|自然|國語|生活|校園|水循環|乘法/);
  assert.doesNotMatch(notesText, /烷烴|烯烴|拋體|IUPAC|大亨小傳|碳氫化合物/);

  const createdNote = await request('/api/notes', {
    method: 'POST',
    body: JSON.stringify({
      title: `Contract note ${Date.now()}`,
      subject: '測試',
      content: '這是一筆國小課堂 API contract 測試紀錄，會同步到本機 JSON 資料。',
    }),
  });
  assert.equal(createdNote.response.status, 200);
  assert.equal(createdNote.body.note.subject, '測試');
  assert.ok(Array.isArray(createdNote.body.notes));

  const updatedNote = await request(`/api/notes/${createdNote.body.note.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      title: 'Contract note updated',
      subject: '測試更新',
      content: '這筆課堂紀錄已經被更新，確認紀錄本內容可以真實編修。',
      ocrText: '更新後 OCR',
      transcript: '更新後逐字稿',
    }),
  });
  assert.equal(updatedNote.response.status, 200);
  assert.equal(updatedNote.body.note.title, 'Contract note updated');
  assert.equal(updatedNote.body.note.ocrText, '更新後 OCR');
  assert.ok(updatedNote.body.notes.some((note) => note.id === createdNote.body.note.id && note.subject === '測試更新'));

  const robotCommand = await request('/api/robot/command', {
    method: 'POST',
    body: JSON.stringify({command: 'PAUSE_TASK', source: 'contract-test'}),
  });
  assert.ok([200, 503].includes(robotCommand.response.status));
  assert.equal(robotCommand.body.status.lastCommand, 'PAUSE_TASK');
  assert.ok(Array.isArray(robotCommand.body.taskLog));
  assert.equal(robotCommand.body.taskLog[0].command, 'PAUSE_TASK');

  for (const [regionId, expectedCommand] of [['A', 'ERASE_REGION_A'], ['B', 'ERASE_REGION_B'], ['C', 'ERASE_REGION_C']]) {
    const robotTask = await request('/api/robot/task', {
      method: 'POST',
      body: JSON.stringify({action: 'erase', regionId, source: 'contract-test'}),
    });
    assert.ok([200, 503].includes(robotTask.response.status));
    assert.equal(robotTask.body.command, expectedCommand);
    assert.equal(robotTask.body.status.lastCommand, expectedCommand);
    assert.ok(Array.isArray(robotTask.body.taskLog));
  }

  const robotTaskAll = await request('/api/robot/task', {
    method: 'POST',
    body: JSON.stringify({action: 'erase', source: 'contract-test'}),
  });
  assert.ok([200, 503].includes(robotTaskAll.response.status));
  assert.equal(robotTaskAll.body.command, 'ERASE_ALL');
  assert.equal(robotTaskAll.body.status.lastCommand, 'ERASE_ALL');

  const aiBoard = await request('/api/ai/analyze-board', {
    method: 'POST',
    headers: {'x-ai-fallback': '1'},
    body: JSON.stringify({
      imageBase64: tinyPngDataUrl,
      transcript: '老師用披薩圖說明同分母分數加法，孩子正在練習 1/4 加 2/4。',
      subjectHint: '國小數學',
    }),
  });
  assert.equal(aiBoard.response.status, 200);
  assert.equal(typeof aiBoard.body.noteDraft.title, 'string');
  assert.equal(aiBoard.body.noteDraft.subject, '國小數學');
  assert.ok(Array.isArray(aiBoard.body.boardRegions));
  assert.ok(aiBoard.body.boardRegions.length >= 3);
  assert.equal(typeof aiBoard.body.currentRecommendation, 'string');

  const missingImage = await request('/api/ai/analyze-board', {
    method: 'POST',
    headers: {'x-ai-fallback': '1'},
    body: JSON.stringify({transcript: '缺少圖片'}),
  });
  assert.equal(missingImage.response.status, 400);
  assert.equal(typeof missingImage.body.error, 'string');

  const invalidImageMime = await request('/api/ai/analyze-board', {
    method: 'POST',
    headers: {'x-ai-fallback': '1'},
    body: JSON.stringify({imageBase64: 'data:text/plain;base64,AAAA'}),
  });
  assert.equal(invalidImageMime.response.status, 415);
  assert.equal(typeof invalidImageMime.body.error, 'string');

  const oversizedImage = await request('/api/ai/analyze-board', {
    method: 'POST',
    headers: {'x-ai-fallback': '1'},
    body: JSON.stringify({imageBase64: `data:image/png;base64,${'A'.repeat(11184812)}`}),
  });
  assert.equal(oversizedImage.response.status, 413);
  assert.equal(typeof oversizedImage.body.error, 'string');

  const aiTranscription = await request('/api/ai/transcribe', {
    method: 'POST',
    headers: {'x-ai-fallback': '1'},
    body: JSON.stringify({audioBase64: 'data:audio/webm;base64,AAAA', mimeType: 'audio/webm'}),
  });
  assert.equal(aiTranscription.response.status, 200);
  assert.equal(typeof aiTranscription.body.transcript, 'string');

  const invalidAudioMime = await request('/api/ai/transcribe', {
    method: 'POST',
    headers: {'x-ai-fallback': '1'},
    body: JSON.stringify({audioBase64: 'data:text/plain;base64,AAAA', mimeType: 'text/plain'}),
  });
  assert.equal(invalidAudioMime.response.status, 415);

  const aiChat = await request('/api/ai/chat', {
    method: 'POST',
    headers: {'x-ai-fallback': '1'},
    body: JSON.stringify({message: '請根據第 1 筆課堂紀錄設計國小生提問', noteIds: [1], history: []}),
  });
  assert.equal(aiChat.response.status, 200);
  assert.equal(typeof aiChat.body.reply, 'string');

  const aiReview = await request('/api/ai/review', {
    method: 'POST',
    headers: {'x-ai-fallback': '1'},
    body: JSON.stringify({noteId: 1, mode: 'quiz'}),
  });
  assert.equal(aiReview.response.status, 200);
  assert.ok(Array.isArray(aiReview.body.quiz));
  assert.ok(aiReview.body.quiz.length > 0);

  const deletedNote = await request(`/api/notes/${createdNote.body.note.id}`, {method: 'DELETE'});
  assert.equal(deletedNote.response.status, 200);
  assert.ok(Array.isArray(deletedNote.body.notes));
  assert.ok(!deletedNote.body.notes.some((note) => note.id === createdNote.body.note.id));

  const exportedData = await request('/api/export');
  assert.equal(exportedData.response.status, 200);
  assert.equal(exportedData.body.app, 'ai-whiteboard-assistant');
  assert.ok(Array.isArray(exportedData.body.notes));
  assert.ok(Array.isArray(exportedData.body.chat));

  const invalidImport = await request('/api/import', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  assert.equal(invalidImport.response.status, 400);
  assert.equal(typeof invalidImport.body.error, 'string');

  const importedData = await request('/api/import', {
    method: 'POST',
    body: JSON.stringify({
      notes: [{
        id: 910001,
        title: '匯入測試課堂紀錄',
        subject: '系統測試',
        content: '確認 production 匯入流程能寫入本機 JSON。',
        boardRegions: [{id: 'Region A', label: '測試區', x: 10, y: 12, width: 40, height: 30, status: 'keep', reason: '匯入正規化'}],
      }],
      chat: [{id: 'contract-import-chat', role: 'user', text: '確認匯入聊天紀錄'}],
      classroomSession: {
        focusPercent: 64,
        confusedPercent: 22,
        tiredPercent: 14,
        teacherPace: 'review_needed',
        currentRecommendation: '匯入後保留測試區塊。',
        boardRegions: [{id: 'Region A', label: '測試區', x: 10, y: 12, width: 40, height: 30, status: 'keep', reason: '匯入正規化'}],
      },
    }),
  });
  assert.equal(importedData.response.status, 200);
  assert.equal(importedData.body.ok, true);
  assert.equal(importedData.body.counts.notes, 1);
  assert.ok(importedData.body.updated.includes('classroomSession'));

  const backup = await request('/api/backup', {method: 'POST', body: JSON.stringify({})});
  assert.equal(backup.response.status, 200);
  assert.equal(backup.body.ok, true);
  assert.equal(typeof backup.body.backup.filename, 'string');
  if (backup.body.backup.filePath) {
    generatedFilesToRemove.push(backup.body.backup.filePath);
  }

  console.log('api-contract ok');
} finally {
  await restoreDataFiles(dataSnapshots);
  await Promise.all(generatedFilesToRemove.map((file) => unlink(file).catch(() => undefined)));
  await stopTestServer(testServer);
}
