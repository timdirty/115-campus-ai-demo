import assert from 'node:assert/strict';
import {generateSupportReply, summarizeGuardianState} from '../services/localGuardianAi';
import {createInitialGuardianState, guardianReducer, normalizeGuardianState} from './guardianState';

async function run() {
  const initial = createInitialGuardianState();
  assert.equal(initial.privacyMode, true);
  assert.ok(initial.alerts.length >= 3);
  assert.ok(initial.nodes.some((node) => node.status === 'offline'));
  assert.ok(initial.hardwareEvents.some((event) => event.command === 'SYSTEM_READY'));

  const mooded = guardianReducer(initial, {
    type: 'ADD_MOOD',
    payload: {mood: 'worried', label: '有點擔心', note: '考前壓力'},
  });
  assert.equal(mooded.moodLogs[0].mood, 'worried');
  assert.ok(mooded.stabilityScore < initial.stabilityScore);

  const alert = mooded.alerts.find((item) => item.status === 'new');
  assert.ok(alert, 'fixture should include a new alert');
  const checked = guardianReducer(mooded, {
    type: 'TOGGLE_CHECKLIST',
    payload: {alertId: alert.id, itemId: alert.checklist[1].id},
  });
  const checkedAlert = checked.alerts.find((item) => item.id === alert.id);
  assert.equal(checkedAlert?.status, 'processing');
  assert.equal(checkedAlert?.checklist[1].completed, true);

  const deployed = guardianReducer(checked, {
    type: 'DEPLOY_INTERVENTION',
    payload: {area: alert.location},
  });
  assert.equal(deployed.interventions[0].area, alert.location);

  const offlineNode = deployed.nodes.find((node) => node.status === 'offline');
  assert.ok(offlineNode, 'fixture should include an offline node');
  const restarted = guardianReducer(deployed, {
    type: 'RESTART_NODE',
    payload: {id: offlineNode.id},
  });
  assert.equal(restarted.nodes.find((node) => node.id === offlineNode.id)?.status, 'online');

  const hardwareRecorded = guardianReducer(restarted, {
    type: 'RECORD_HARDWARE_EVENT',
    payload: {command: 'NODE_RESTART', source: 'test:node', status: 'fallback', message: 'No board connected'},
  });
  assert.equal(hardwareRecorded.hardwareEvents[0].command, 'NODE_RESTART');
  assert.equal(hardwareRecorded.hardwareEvents[0].status, 'fallback');

  const reply = await generateSupportReply('我最近考試壓力很大', 'worried');
  assert.match(reply, /考試|壓力|小步驟/);
  const urgentReply = await generateSupportReply('我想傷害自己', 'worried');
  assert.match(urgentReply, /可信任的大人|緊急救援/);

  const summary = await summarizeGuardianState(restarted);
  assert.match(summary, /校園穩定度/);

  const recovered = normalizeGuardianState({
    privacyMode: false,
    alerts: 'broken',
    nodes: null,
    supportMessages: undefined,
    stabilityScore: 'bad',
  });
  assert.equal(recovered.privacyMode, false);
  assert.equal(recovered.alerts.length, initial.alerts.length);
  assert.equal(recovered.nodes.length, initial.nodes.length);
  assert.equal(recovered.stabilityScore, initial.stabilityScore);

  const partiallyRecovered = normalizeGuardianState({
    stabilityScore: 500,
    alerts: [
      null,
      {
        id: 'custom-alert',
        studentAlias: '',
        checklist: [null, {id: 'custom-check', text: '', completed: 'yes'}],
        riskLevel: 'critical',
        status: 'stuck',
      },
    ],
    nodes: [null, {id: 'node-x', name: '臨時節點', status: 'lost', latencyMs: -10}],
    supportMessages: [null, {role: 'student', content: '需要幫忙'}],
    hardwareEvents: [null, {command: 'CARE_DEPLOYED', source: 'test', status: 'bad', message: 'ok'}],
  });
  assert.equal(partiallyRecovered.stabilityScore, 100);
  assert.equal(partiallyRecovered.alerts.length, 1);
  assert.equal(partiallyRecovered.alerts[0].id, 'custom-alert');
  assert.equal(partiallyRecovered.alerts[0].riskLevel, initial.alerts[1].riskLevel);
  assert.equal(partiallyRecovered.alerts[0].checklist[0].id, 'custom-check');
  assert.equal(partiallyRecovered.nodes.length, 1);
  assert.equal(partiallyRecovered.nodes[0].status, initial.nodes[1].status);
  assert.equal(partiallyRecovered.nodes[0].latencyMs, 0);
  assert.equal(partiallyRecovered.supportMessages[0].content, '需要幫忙');
  assert.equal(partiallyRecovered.hardwareEvents[0].command, 'CARE_DEPLOYED');
  assert.equal(partiallyRecovered.hardwareEvents[0].status, initial.hardwareEvents[0].status);

  const restored = guardianReducer(initial, {
    type: 'RESTORE_DEMO_STATE',
    payload: {state: partiallyRecovered},
  });
  assert.equal(restored.alerts[0].id, 'custom-alert');
  assert.equal(restored.supportMessages[0].content, '需要幫忙');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
