import {createServer} from 'node:http';
import {WebSocketServer} from 'ws';
import {strict as assert} from 'node:assert';

// Must set EV3_HOST before importing ev3Manager (module-level side effects)
process.env.EV3_HOST = 'ws://127.0.0.1:19876';

const httpServer = createServer();
const wss = new WebSocketServer({server: httpServer});

await new Promise<void>((resolve) => httpServer.listen(19876, '127.0.0.1', resolve));

// Echo server: responds {id, ok:true, response: "ack:<type>"}
wss.on('connection', (client) => {
  client.on('message', (data) => {
    const msg = JSON.parse(data.toString()) as {id: string; type: string};
    client.send(JSON.stringify({id: msg.id, ok: true, response: `ack:${msg.type}`}));
  });
});

const {startEV3Manager, sendEV3Command, getEV3Status} = await import('./ev3Manager.js');

startEV3Manager();
await new Promise((r) => setTimeout(r, 150)); // wait for connection

// Test 1: connects
assert.equal(getEV3Status().connected, true, 'should connect to local test server');

// Test 2: command round-trip with request-id
const r1 = await sendEV3Command('EV3_STATUS');
assert.equal(r1.ok, true, 'command should succeed');
assert.equal(r1.response, 'ack:EV3_STATUS', 'response should match command');

// Test 3: two concurrent commands receive correct responses
const [r2, r3] = await Promise.all([
  sendEV3Command('EV3_PEN_DOWN'),
  sendEV3Command('EV3_PEN_UP'),
]);
assert.equal(r2.response, 'ack:EV3_PEN_DOWN');
assert.equal(r3.response, 'ack:EV3_PEN_UP');

// Test 4: disconnect → fail fast
wss.clients.forEach((c) => c.terminate());
await new Promise((r) => setTimeout(r, 50));
assert.equal(getEV3Status().connected, false, 'should detect disconnect');

const r4 = await sendEV3Command('EV3_STATUS');
assert.equal(r4.ok, false, 'should fail when disconnected');

httpServer.close();
console.log('[test] ev3Manager: all 4 assertions passed ✓');
