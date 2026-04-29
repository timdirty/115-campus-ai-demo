#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const steps = [
  {
    name: 'Publish safety check',
    command: 'node',
    args: ['scripts/github-prepublish-check.mjs'],
  },
  {
    name: 'Three-app demo check and firmware build',
    command: 'zsh',
    args: ['scripts/demo-check.sh'],
  },
  {
    name: 'Build GitHub Pages student bundle',
    command: 'node',
    args: ['scripts/build-github-pages.mjs'],
  },
  {
    name: 'Verify GitHub Pages artifact',
    command: 'node',
    args: ['scripts/pages-artifact-check.mjs'],
  },
  {
    name: 'Mobile layout check',
    command: 'node',
    args: ['scripts/mobile-layout-check.mjs'],
  },
];

for (const [index, step] of steps.entries()) {
  console.log(`\n== ${index + 1}/${steps.length} ${step.name} ==`);
  const result = spawnSync(step.command, step.args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    console.error(`\nCompetition readiness check failed at: ${step.name}`);
    process.exit(result.status ?? 1);
  }
}

console.log(`
== Ready ==
Competition readiness check passed.

Public URLs:
  https://timdirty.github.io/115-campus-ai-demo/
  https://timdirty.github.io/115-campus-ai-demo/app1/
  https://timdirty.github.io/115-campus-ai-demo/app2/
  https://timdirty.github.io/115-campus-ai-demo/app3/
  https://timdirty.github.io/115-campus-ai-demo/app1-guide.html
  https://timdirty.github.io/115-campus-ai-demo/app2-guide.html
  https://timdirty.github.io/115-campus-ai-demo/app3-guide.html
`);
