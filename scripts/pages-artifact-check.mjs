#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {allGuidesUrl, apps, guideUrl, pagesDir} from './app-catalog.mjs';

const requiredFiles = [
  'index.html',
  '.nojekyll',
  allGuidesUrl(),
  ...apps.flatMap((app) => [`${app.id}/index.html`, guideUrl(app)]),
];

const requiredIndexLinks = [
  `./${allGuidesUrl()}`,
  ...apps.flatMap((app) => [`./${app.id}/`, `./${guideUrl(app)}`]),
];

const requiredGuidePhrases = Object.fromEntries(apps.map((app) => [
  guideUrl(app),
  [
    ...app.guidePhrases,
    ...(app.demoRoutes ?? []).flatMap((route) => [route.title, route.studentLine]),
  ],
]));

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

  const allGuidesPath = path.join(pagesDir, allGuidesUrl());
  if (fs.existsSync(allGuidesPath)) {
    const allGuidesHtml = fs.readFileSync(allGuidesPath, 'utf8');
    for (const app of apps) {
      if (!allGuidesHtml.includes(app.name)) {
        failures.push(`${allGuidesUrl()} is missing app name: ${app.name}`);
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
