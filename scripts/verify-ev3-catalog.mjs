#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {appDir, apps, rootDir} from './app-catalog.mjs';

const bridgeDefaultsPath = path.join(appDir(apps[0]), 'server/defaults.ts');
const ev3ServerPath = path.join(rootDir, 'ev3/ev3_server.py');

const bridgeDefaults = fs.readFileSync(bridgeDefaultsPath, 'utf8');
const ev3Server = fs.readFileSync(ev3ServerPath, 'utf8');

const bridgeCommands = [...bridgeDefaults.matchAll(/\{command:\s*'((?:EV3_)[A-Z0-9_]+)'/g)].map((match) => match[1]);
const ev3ServerCommands = [
  ...ev3Server.matchAll(/cmd\s*(?:==|in)\s*(?:'((?:EV3_)[A-Z0-9_]+)'|\(([^)]*)\))/g),
].flatMap((match) => {
  if (match[1]) return [match[1]];
  return [...match[2].matchAll(/'((?:EV3_)[A-Z0-9_]+)'/g)].map((item) => item[1]);
});
const requiredByApps = Object.fromEntries(apps.map((app) => [app.id, app.ev3.commands]));

function difference(left, right) {
  const rightSet = new Set(right);
  return [...new Set(left)].filter((item) => !rightSet.has(item)).sort();
}

const failures = [];
const requiredCommands = [...new Set(apps.flatMap((app) => app.ev3.commands))].sort();
const missingBridge = difference(requiredCommands, bridgeCommands);
const missingServer = difference(requiredCommands, ev3ServerCommands);

if (missingBridge.length) failures.push(`EV3 commands required by app catalog but missing from bridge commandCatalog: ${missingBridge.join(', ')}`);
if (missingServer.length) failures.push(`EV3 commands required by app catalog but missing from ev3_server.py dispatch: ${missingServer.join(', ')}`);

for (const app of apps) {
  if (!app.ev3.role.trim()) failures.push(`${app.id} EV3 role is empty`);
  if (!app.ev3.commands.includes('EV3_STOP')) failures.push(`${app.id} EV3 command list must include EV3_STOP`);
}

if (failures.length) {
  console.error('EV3 catalog verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  commandCount: requiredCommands.length,
  requiredByApps,
}, null, 2));
