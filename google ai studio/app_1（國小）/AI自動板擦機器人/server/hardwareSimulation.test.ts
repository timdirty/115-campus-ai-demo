import assert from 'node:assert/strict';
import {getEV3Status, sendEV3Command, startEV3Manager} from './ev3Manager';
import {listPorts, readRobotSensors, sendSerialCommand} from './robotService';

process.env.DEMO_SIMULATE_HARDWARE = '1';

async function run() {
  startEV3Manager();
  const ev3Status = getEV3Status();
  assert.equal(ev3Status.connected, true);
  assert.equal(ev3Status.simulated, true);
  assert.equal(ev3Status.activeHost, 'simulated://ev3');

  const ev3 = await sendEV3Command('EV3_STATUS');
  assert.equal(ev3.ok, true);
  assert.match(ev3.response, /SIMULATED_EV3_OK:EV3_STATUS/);

  const ports = await listPorts();
  assert.equal(ports[0].path, 'simulated://arduino-uno-r4');
  assert.equal(ports[0].manufacturer, 'Campus Demo Simulator');

  const serial = await sendSerialCommand('SHOW_ON');
  assert.equal(serial.port, 'simulated://arduino-uno-r4');
  assert.match(serial.response, /SIMULATED_ARDUINO_OK:SHOW_ON/);

  const sensors = await readRobotSensors();
  assert.equal(sensors.connected, true);
  assert.equal(sensors.temp, 25.6);
  assert.equal(sensors.hum, 58);
  assert.equal(sensors.light, 640);

  console.log('hardwareSimulation.test.ts: all assertions passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
