#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagesDir = path.join(rootDir, 'pages-dist');

const requiredFiles = [
  'index.html',
  '.nojekyll',
  'app1/index.html',
  'app2/index.html',
  'app3/index.html',
  'app1-guide.html',
  'app2-guide.html',
  'app3-guide.html',
];

const requiredIndexLinks = [
  './app1/',
  './app2/',
  './app3/',
  './app1-guide.html',
  './app2-guide.html',
  './app3-guide.html',
];

const requiredGuidePhrases = {
  'app1-guide.html': ['AI 自動板擦機器人', '後續機器人連動計畫', '公開展示網址'],
  'app2-guide.html': ['校園服務機器人', '後續機器人連動計畫', '公開展示網址'],
  'app3-guide.html': ['AI 校園心靈守護者', '後續機器人連動計畫', '公開展示網址'],
};

const failures = [];

if (!fs.existsSync(pagesDir)) {
  failures.push('pages-dist is missing. Run node scripts/build-github-pages.mjs first.');
} else {
  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(pagesDir, file))) {
      failures.push(`missing Pages artifact: ${file}`);
    }
  }

  const indexPath = path.join(pagesDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    const indexHtml = fs.readFileSync(indexPath, 'utf8');
    for (const link of requiredIndexLinks) {
      if (!indexHtml.includes(`href="${link}"`)) {
        failures.push(`Pages index is missing link: ${link}`);
      }
    }
  }

  for (const [file, phrases] of Object.entries(requiredGuidePhrases)) {
    const guidePath = path.join(pagesDir, file);
    if (!fs.existsSync(guidePath)) continue;
    const guideHtml = fs.readFileSync(guidePath, 'utf8');
    for (const phrase of phrases) {
      if (!guideHtml.includes(phrase)) {
        failures.push(`${file} is missing expected phrase: ${phrase}`);
      }
    }
  }
}

if (failures.length) {
  console.error('Pages artifact check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Pages artifact check passed.');
