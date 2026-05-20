#!/usr/bin/env node

import {allGuidesUrl, apps, guideUrl} from './app-catalog.mjs';

const baseUrl = process.env.PUBLIC_DEMO_BASE_URL ?? 'https://timdirty.github.io/115-campus-ai-demo/';

const pages = [
  {
    path: '',
    phrases: ['115 資通訊三隊 App 展示入口', '一次看三隊講稿', '開啟操作'],
  },
  {
    path: allGuidesUrl(),
    phrases: ['115 資通訊三隊學生講稿總覽', 'App 1 講稿', 'App 2 講稿', 'App 3 講稿'],
  },
  ...apps.map((app) => ({path: `${app.id}/`, phrases: app.pagePhrases})),
  ...apps.map((app) => ({path: guideUrl(app), phrases: app.guidePhrases})),
];

const failures = [];

function resolveUrl(path) {
  return new URL(path, baseUrl).toString();
}

for (const page of pages) {
  const url = resolveUrl(page.path);
  try {
    const response = await fetch(url, {redirect: 'follow'});
    const text = await response.text();
    console.log(`${response.status} ${url}`);

    if (!response.ok) {
      failures.push(`${url} returned ${response.status}`);
      continue;
    }

    for (const phrase of page.phrases) {
      if (!text.includes(phrase)) {
        failures.push(`${url} is missing expected phrase: ${phrase}`);
      }
    }
  } catch (error) {
    failures.push(`${url} failed to load: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length) {
  console.error('Public URL check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Public URL check passed.');
