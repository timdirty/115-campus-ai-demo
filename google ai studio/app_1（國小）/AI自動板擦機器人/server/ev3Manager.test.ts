// Must set EV3_HOST before importing ev3Manager (module-level side effects); must be first line
process.env.EV3_HOST = 'ws://127.0.0.1:0'; // placeholder; overwritten after ephemeral listen

import {createServer} from 'node:http';
import {WebSocketServer} from 'ws';
import {strict as assert} from 'node:assert';

const httpServer = createServer();
const wss = new WebSocketServer({server: httpServer});

await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));

const actualPort = (httpServer.address() as {port: number}).port;
process.env.EV3_HOST = `ws://127.0.0.1:${actualPort}`;

// Echo server: responds {id, ok:true, response: "ack:<type>"}
wss.on('connection', (client) => {
  client.on('message', (data) => {
    const msg = JSON.parse(data.toString()) as {id: string; type: string};
    client.send(JSON.stringify({id: msg.id, ok: true, response: `ack:${msg.type}`}));
  });
});

const {startEV3Manager, sendEV3Command, getEV3Status} = await import('./ev3Manager.js');

startEV3Manager();
// Wait for ev3Manager's client-side 'open' by watching for server-side 'connection' first,
// then polling connected flag (open fires after connection on the other end of the socket).
await new Promise<void>((r) => wss.once('connection', r));
await new Promise<void>((resolve, reject) => {
  const deadline = Date.now() + 2000;
  const check = () => {
    if (getEV3Status().connected) { resolve(); return; }
    if (Date.now() >= deadline) { reject(new Error('timed out waiting for ev3Manager open')); return; }
    setTimeout(check, 5);
  };
  check();
});

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
// Poll until ev3Manager detects the disconnect (with a 2s hard timeout)
await new Promise<void>((resolve, reject) => {
  const deadline = Date.now() + 2000;
  const check = () => {
    if (!getEV3Status().connected) { resolve(); return; }
    if (Date.now() >= deadline) { reject(new Error('timed out waiting for disconnect')); return; }
    setTimeout(check, 10);
  };
  check();
});
assert.equal(getEV3Status().connected, false, 'should detect disconnect');

const r4 = await sendEV3Command('EV3_STATUS');
assert.equal(r4.ok, false, 'should fail when disconnected');

await new Promise<void>((resolve) => wss.close(() => httpServer.close(() => resolve())));
console.log('[test] ev3Manager: all 4 assertions passed ✓');
