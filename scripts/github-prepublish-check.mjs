#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ignoredDirs = new Set([
  '.git',
  '.pio',
  '.playwright-cli',
  '.playwright-mcp',
  '.orchestra',
  '.gitnexus',
  'node_modules',
  'dist',
  'pages-dist',
  'build',
  'coverage',
]);

const requiredFiles = [
  '.gitignore',
  'README.md',
  'scripts/demo-check.sh',
  'scripts/verify-command-catalog.mjs',
  'apps/app1-whiteboard/package-lock.json',
  'apps/app2-campus-service/package-lock.json',
  'apps/app3-guardian/package-lock.json',
  'apps/app3-guardian/firebase-applet-config.json',
];

const failures = [];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(rootDir, file))) failures.push(`missing required publish file: ${file}`);
}

const realSecretsPath = path.join(rootDir, 'include/arduino_secrets.h');
if (fs.existsSync(realSecretsPath)) {
  failures.push('include/arduino_secrets.h exists locally; remove or keep it outside the publish copy before pushing');
}

const firebaseConfigPath = path.join(
  rootDir,
  'apps/app3-guardian/firebase-applet-config.json',
);
if (fs.existsSync(firebaseConfigPath)) {
  const firebaseConfig = fs.readFileSync(firebaseConfigPath, 'utf8');
  if (/AIza[0-9A-Za-z_-]{20,}/.test(firebaseConfig)) {
    failures.push('App 3 firebase-applet-config.json still contains a real-looking Google API key');
  }
  if (!firebaseConfig.includes('local-demo-placeholder')) {
    failures.push('App 3 firebase-applet-config.json should remain a public placeholder in GitHub');
  }
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (ignoredDirs.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else if (entry.isFile()) {
      yield fullPath;
    }
    // skip symlinks, sockets, fifos, etc. — readFileSync would EISDIR on dir-symlinks
  }
}

function isGitTracked(rel) {
  const result = spawnSync('git', ['ls-files', '--error-unmatch', rel], {
    cwd: rootDir,
    stdio: 'ignore',
  });
  return result.status === 0;
}

for (const file of walk(rootDir)) {
  const rel = path.relative(rootDir, file);
  if (rel.endsWith('.png') || rel.endsWith('.jpg') || rel.endsWith('.jpeg') || rel.endsWith('.gif') || rel.endsWith('.ico')) {
    continue;
  }
  if (/(^|\/)\.env(\.|$)/.test(rel) && !rel.endsWith('.env.example')) {
    if (isGitTracked(rel)) {
      failures.push(`tracked env file would publish secrets: ${rel}`);
    }
    continue;
  }
  if (rel.endsWith('.log')) {
    if (isGitTracked(rel)) failures.push(`log file should not be published: ${rel}`);
    continue;
  }
  const text = fs.readFileSync(file, 'utf8');
  if (/AIza[0-9A-Za-z_-]{20,}/.test(text)) failures.push(`real-looking Google API key found in ${rel}`);
  if (/SECRET_DEVICE_KEY\s+"(?!your-arduino-cloud-device-secret)/.test(text)) {
    failures.push(`real-looking Arduino device secret found in ${rel}`);
  }
}

if (failures.length) {
  console.error('GitHub prepublish check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('GitHub prepublish check passed.');
