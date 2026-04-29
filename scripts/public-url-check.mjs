#!/usr/bin/env node

const baseUrl = process.env.PUBLIC_DEMO_BASE_URL ?? 'https://timdirty.github.io/115-campus-ai-demo/';

const pages = [
  {
    path: '',
    phrases: ['115 資通訊三隊 App 展示入口', '學生講稿', '開啟操作'],
  },
  {
    path: 'app1/',
    phrases: ['AI', '白板'],
  },
  {
    path: 'app2/',
    phrases: ['校園', '服務'],
  },
  {
    path: 'app3/',
    phrases: ['校園', '心靈'],
  },
  {
    path: 'app1-guide.html',
    phrases: ['AI 自動板擦機器人', '後續機器人連動計畫', '公開展示網址'],
  },
  {
    path: 'app2-guide.html',
    phrases: ['校園服務機器人', '後續機器人連動計畫', '公開展示網址'],
  },
  {
    path: 'app3-guide.html',
    phrases: ['AI 校園心靈守護者', '後續機器人連動計畫', '公開展示網址'],
  },
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
