#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {apps, rootDir} from './app-catalog.mjs';

function run(name, command, args, env = {}) {
  console.log(`\n== ${name} ==`);
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: {...process.env, ...env},
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    console.error(`demo-ready failed at: ${name}`);
    process.exit(result.status ?? 1);
  }
}

run('Generate student demo docs', 'node', ['scripts/generate-demo-docs.mjs']);
run('Competition readiness', 'node', ['scripts/competition-readiness-check.mjs']);

const report = {
  ok: true,
  generatedAt: new Date().toISOString(),
  apps: apps.map((app) => ({
    id: app.id,
    team: app.team,
    name: app.name,
    ev3Role: app.ev3.role,
    ev3Commands: app.ev3.commands,
  })),
  docs: [
    'docs/DEMO_READY.md',
    'docs/STUDENT_PITCHES.md',
    'docs/EV3_CALIBRATION_TABLE.md',
  ],
  nextPublicCheck: 'CHECK_PUBLIC_URLS=1 node scripts/competition-readiness-check.mjs',
};

fs.writeFileSync(path.join(rootDir, 'demo-ready-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log('\n== Ready ==');
console.log('Demo ready report written: demo-ready-report.json');
