#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import net from 'node:net';
import {apps, rootDir} from './app-catalog.mjs';

function ok(name, detail = '') {
  console.log(`OK   ${name}${detail ? ` - ${detail}` : ''}`);
}

function warn(name, detail = '') {
  console.log(`WARN ${name}${detail ? ` - ${detail}` : ''}`);
}

function fail(name, detail = '') {
  console.log(`FAIL ${name}${detail ? ` - ${detail}` : ''}`);
}

function runNode(name, args) {
  const result = spawnSync('node', args, {cwd: rootDir, encoding: 'utf8'});
  if (result.status === 0) ok(name);
  else fail(name, (result.stderr || result.stdout).trim().split('\n')[0] ?? 'failed');
  return result.status === 0;
}

function commandExists(command) {
  const result = spawnSync('zsh', ['-lc', `command -v ${command}`], {encoding: 'utf8'});
  return result.status === 0;
}

async function tcpProbe(host, port, timeoutMs = 900) {
  return new Promise((resolve) => {
    const socket = net.createConnection({host, port});
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeoutMs);
    socket.once('connect', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

function envStatus(name) {
  return process.env[name] ? 'set' : 'not set';
}

async function main() {
  console.log('Campus AI hardware doctor\n');

  ok('App catalog', `${apps.length} apps / ${apps.flatMap((app) => app.ev3.commands).length} EV3 command references`);
  runNode('EV3 catalog verification', ['scripts/verify-ev3-catalog.mjs']);
  runNode('Arduino command catalog verification', ['scripts/verify-command-catalog.mjs']);

  if (commandExists('pio')) {
    const pio = spawnSync('pio', ['--version'], {encoding: 'utf8'});
    ok('PlatformIO', pio.stdout.trim());
  } else {
    warn('PlatformIO', 'pio not found; firmware build/upload cannot run here');
  }

  const usbProbe = spawnSync('zsh', ['-lc', 'ls /dev/cu.usbmodem* /dev/tty.usbmodem* 2>/dev/null | head -5'], {encoding: 'utf8'});
  if (usbProbe.stdout.trim()) ok('Arduino USB port candidate', usbProbe.stdout.trim().replace(/\n/g, ', '));
  else warn('Arduino USB port candidate', 'none detected; use DEMO_SIMULATE_HARDWARE=1 for no-hardware demo');

  const ev3Hosts = [
    ...(process.env.EV3_HOSTS ?? '').split(',').filter(Boolean),
    process.env.EV3_HOST || '192.168.0.1',
    'ev3dev.local',
  ].map((host) => host.replace(/^wss?:\/\//, '').replace(/:\d+\/?$/, ''));
  const uniqueHosts = [...new Set(ev3Hosts)];
  let ev3Reachable = false;
  for (const host of uniqueHosts) {
    const reachable = await tcpProbe(host, 8765);
    if (reachable) {
      ok('EV3 WebSocket port', `${host}:8765 reachable`);
      ev3Reachable = true;
      break;
    }
  }
  if (!ev3Reachable) warn('EV3 WebSocket port', 'not reachable now; catalog and simulation are still ready');

  console.log('\nBrowser permissions to verify manually: camera, microphone, serial.');
  console.log(`Environment: GEMINI_API_KEY ${envStatus('GEMINI_API_KEY')}, VITE_GEMINI_API_KEY ${envStatus('VITE_GEMINI_API_KEY')}, DEMO_SIMULATE_HARDWARE ${envStatus('DEMO_SIMULATE_HARDWARE')}`);
  console.log('\nNext field command: npm run demo:ready');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
