import assert from 'node:assert/strict';

process.env.DEMO_SIMULATE_HARDWARE = '1';

const {sendCommand, isConnected, getTelemetry, getActivePath} = await import('./serialPort');
const {startEV3Manager, getEV3Status, sendEV3Command} = await import('./ev3Manager');
const {startSpikeManager, getSpikeStatus, sendSpikeCommand} = await import('./spikeManager');

async function run() {
  // 1. Serial port sim mode — guardian drive commands
  const serial = await sendCommand('BEEP');
  assert.equal(serial.ok, true, 'sim sendCommand BEEP should succeed');
  assert.match(serial.message, /SIM/, 'sim message should mention SIM');

  // 2. EV3 manager (used by some guardian flows)
  startEV3Manager();
  const ev3Status = getEV3Status();
  assert.equal(typeof ev3Status, 'object');
  assert.equal('connected' in ev3Status, true);

  // 3. Spike manager
  startSpikeManager();
  const spikeStatus = getSpikeStatus();
  assert.equal(typeof spikeStatus, 'object');
  assert.equal('connected' in spikeStatus, true);

  const spikeCmd = await sendSpikeCommand('SPIKE_STATUS');
  assert.equal('ok' in spikeCmd, true);

  const ev3Cmd = await sendEV3Command('EV3_STATUS');
  assert.equal('ok' in ev3Cmd, true);

  // 4. Telemetry exists
  const telemetry = getTelemetry();
  assert.equal(typeof telemetry, 'object');

  // 5. Guardian-specific commands all succeed in sim
  for (const cmd of [
    'ROBOT_DISPATCH', 'CARE_DEPLOYED', 'ALERT_SIGNAL',
    'NODE_RESTART', 'READ_SENSORS', 'PATROL_START',
    'ROBOT_RESUME', 'ROBOT_PAUSE', 'LED_CONFIRM',
  ]) {
    const r = await sendCommand(cmd);
    assert.equal(r.ok, true, `sim ${cmd} should succeed`);
  }

  // 6. getActivePath / isConnected in sim mode
  const path = getActivePath();
  assert.equal(path === null || typeof path === 'string', true);
  const connected = isConnected();
  assert.equal(typeof connected, 'boolean');

  console.log('hardwareSimulation.test.ts: all assertions passed (guardian sim mode)');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
