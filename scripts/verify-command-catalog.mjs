#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bridgeDefaultsPath = path.join(
  rootDir,
  'apps/app1-whiteboard/server/defaults.ts',
);
const firmwareCommandsPath = path.join(rootDir, 'firmware/shared-command-demo/commands.cpp');

const bridgeDefaults = fs.readFileSync(bridgeDefaultsPath, 'utf8');
const firmwareCommands = fs.readFileSync(firmwareCommandsPath, 'utf8');

const allBridgeCommands = [...bridgeDefaults.matchAll(/\{command:\s*'([A-Z0-9_]+)'/g)].map((match) => match[1]);
// EV3_* commands target the EV3 brick over WebSocket, not the Arduino firmware,
// so they are excluded from the firmware/handler/ready-line consistency checks.
const isEV3Command = (cmd) => cmd.startsWith('EV3_');
const bridgeCommands = allBridgeCommands.filter((cmd) => !isEV3Command(cmd));
const handledCommands = [
  // Direct equality checks: command == "NAME"
  ...[...firmwareCommands.matchAll(/command\s*==\s*"([A-Z0-9_]+)"/g)].map((m) => m[1]),
  // Prefix-parse helpers: parseAngleCommand(command, "NAME:", ...) / parsePrefixedSpeed(command, "NAME:", ...)
  ...[...firmwareCommands.matchAll(/parse\w+\s*\(\s*command\s*,\s*"([A-Z0-9_]+):/g)].map((m) => m[1]),
];
const readyLineMatch = firmwareCommands.match(/Serial\.println\("Commands:\s*([^"]+)"\);/);
// Strip parameter annotations like ":<0-180>" so "SERVO_SET:<0-180>" matches "SERVO_SET" in bridge catalog
const readyCommands = readyLineMatch
  ? readyLineMatch[1]
      .split(',')
      .map((item) => item.trim().replace(/:.*$/, ''))
      .filter(Boolean)
  : [];

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

// app-specific firmware (firmware/app1-whiteboard-drive/main.cpp:205-213, v2 commit 6de6098) 有，shared 沒
const BRIDGE_ONLY_APP_SPECIFIC = ['CELEBRATE', 'STANDBY'];
// engineer mode 從 bridge 移除 (PR #5 trim)，shared firmware handler/ready line 殘留
const READY_ONLY_LEGACY = [
  'SERVO_0',
  'SERVO_90',
  'SERVO_180',
  'SERVO_SET',
  'SET_REGION_A',
  'SET_REGION_B',
  'SET_REGION_C',
  'SET_ERASE_ALL',
  'SET_STANDBY',
  'CALIBRATION_STATUS',
];

const failures = [];
const bridgeDuplicates = duplicates(allBridgeCommands);
const handlerDuplicates = duplicates(handledCommands);
const readyDuplicates = duplicates(readyCommands);

if (bridgeDuplicates.length) failures.push(`bridge commandCatalog duplicates: ${bridgeDuplicates.join(', ')}`);
if (handlerDuplicates.length) failures.push(`firmware handleCommand duplicates: ${handlerDuplicates.join(', ')}`);
if (readyDuplicates.length) failures.push(`firmware ready message duplicates: ${readyDuplicates.join(', ')}`);

const bridgeCommandsSharedFirmware = bridgeCommands.filter((command) => !BRIDGE_ONLY_APP_SPECIFIC.includes(command));
const handledCommandsBridgeCatalog = handledCommands.filter((command) => !READY_ONLY_LEGACY.includes(command));
const readyCommandsBridgeCatalog = readyCommands.filter((command) => !READY_ONLY_LEGACY.includes(command));

const bridgeMissingHandlers = difference(bridgeCommandsSharedFirmware, handledCommands);
const handlersMissingBridge = difference(handledCommandsBridgeCatalog, bridgeCommands);
const bridgeMissingReady = difference(bridgeCommandsSharedFirmware, readyCommands);
const readyMissingBridge = difference(readyCommandsBridgeCatalog, bridgeCommands);

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
