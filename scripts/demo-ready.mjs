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
run('Validate demo routes', 'node', ['scripts/demo-routes-check.mjs']);
run('Bridge health and robot command smoke', 'node', ['scripts/bridge-smoke-check.mjs']);
run('Competition readiness', 'node', ['scripts/competition-readiness-check.mjs']);
run('Generate demo evidence report', 'node', ['scripts/generate-demo-evidence.mjs']);
run('Generate demo scorecard', 'node', ['scripts/generate-demo-scorecard.mjs']);
run('Generate rehearsal runbook', 'node', ['scripts/generate-rehearsal-runbook.mjs']);
run('Generate EV3 field test report', 'node', ['scripts/generate-ev3-field-report.mjs']);
run('Generate hardware wiring map', 'node', ['scripts/generate-hardware-wiring-map.mjs']);
run('Generate judge one pager', 'node', ['scripts/generate-judge-one-pager.mjs']);

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
    'docs/DEMO_ROUTES.md',
    'docs/STUDENT_PITCHES.md',
    'docs/EV3_CALIBRATION_TABLE.md',
    'docs/FIELD_CHECKLIST.md',
    'docs/JUDGE_QA.md',
    'docs/DEMO_EVIDENCE.md',
    'docs/DEMO_SCORECARD.md',
    'docs/REHEARSAL_RUNBOOK.md',
    'docs/EV3_FIELD_TEST_REPORT.md',
    'docs/HARDWARE_WIRING_MAP.md',
    'docs/JUDGE_ONE_PAGER.md',
  ],
  nextPublicCheck: 'CHECK_PUBLIC_URLS=1 node scripts/competition-readiness-check.mjs',
};

fs.writeFileSync(path.join(rootDir, 'demo-ready-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log('\n== Ready ==');
console.log('Demo ready report written: demo-ready-report.json');
