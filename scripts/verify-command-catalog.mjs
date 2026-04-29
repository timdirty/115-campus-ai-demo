#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bridgeDefaultsPath = path.join(
  rootDir,
  'google ai studio/app_1（國小）/AI自動板擦機器人/server/defaults.ts',
);
const firmwareCommandsPath = path.join(rootDir, 'src/commands.cpp');

const bridgeDefaults = fs.readFileSync(bridgeDefaultsPath, 'utf8');
const firmwareCommands = fs.readFileSync(firmwareCommandsPath, 'utf8');

const bridgeCommands = [...bridgeDefaults.matchAll(/\{command:\s*'([A-Z0-9_]+)'/g)].map((match) => match[1]);
const handledCommands = [...firmwareCommands.matchAll(/command\s*==\s*"([A-Z0-9_]+)"/g)].map((match) => match[1]);
const readyLineMatch = firmwareCommands.match(/Serial\.println\("Commands:\s*([^"]+)"\);/);
const readyCommands = readyLineMatch ? readyLineMatch[1].split(',').map((item) => item.trim()).filter(Boolean) : [];

const requiredAppCommands = {
  app1: ['SHOW_ON', 'ERASE_REGION_A', 'ERASE_ALL', 'PAUSE_TASK'],
  app2: ['DELIVERY_START', 'DELIVERY_DONE', 'CLEAN_SCHEDULE', 'BROADCAST_START', 'SAFETY_LOCKDOWN', 'ROBOT_PAUSE'],
  app3: ['ALERT_SIGNAL', 'CARE_DEPLOYED', 'NODE_RESTART'],
};

function duplicates(items) {
  const seen = new Set();
  const dupes = new Set();
  for (const item of items) {
    if (seen.has(item)) dupes.add(item);
    seen.add(item);
  }
  return [...dupes].sort();
}

function difference(left, right) {
  const rightSet = new Set(right);
  return [...new Set(left)].filter((item) => !rightSet.has(item)).sort();
}

const failures = [];
const bridgeDuplicates = duplicates(bridgeCommands);
const handlerDuplicates = duplicates(handledCommands);
const readyDuplicates = duplicates(readyCommands);

if (bridgeDuplicates.length) failures.push(`bridge commandCatalog duplicates: ${bridgeDuplicates.join(', ')}`);
if (handlerDuplicates.length) failures.push(`firmware handleCommand duplicates: ${handlerDuplicates.join(', ')}`);
if (readyDuplicates.length) failures.push(`firmware ready message duplicates: ${readyDuplicates.join(', ')}`);

const bridgeMissingHandlers = difference(bridgeCommands, handledCommands);
const handlersMissingBridge = difference(handledCommands, bridgeCommands);
const bridgeMissingReady = difference(bridgeCommands, readyCommands);
const readyMissingBridge = difference(readyCommands, bridgeCommands);

if (bridgeMissingHandlers.length) {
  failures.push(`commands in bridge but not handled by firmware: ${bridgeMissingHandlers.join(', ')}`);
}
if (handlersMissingBridge.length) {
  failures.push(`commands handled by firmware but absent from bridge: ${handlersMissingBridge.join(', ')}`);
}
if (bridgeMissingReady.length) {
  failures.push(`commands in bridge but absent from firmware ready message: ${bridgeMissingReady.join(', ')}`);
}
if (readyMissingBridge.length) {
  failures.push(`commands in firmware ready message but absent from bridge: ${readyMissingBridge.join(', ')}`);
}

for (const [app, commands] of Object.entries(requiredAppCommands)) {
  const missing = commands.filter((command) => !bridgeCommands.includes(command) || !handledCommands.includes(command));
  if (missing.length) failures.push(`${app} required commands missing: ${missing.join(', ')}`);
}

if (failures.length) {
  console.error('Command catalog verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      commandCount: bridgeCommands.length,
      app1: requiredAppCommands.app1,
      app2: requiredAppCommands.app2,
      app3: requiredAppCommands.app3,
    },
    null,
    2,
  ),
);
