#!/usr/bin/env node

const targets = [
  {name: 'App 1 AI 白板助教', origin: process.env.APP1_URL ?? 'http://localhost:3200', api: true},
  {name: 'App 2 校園服務機器人', origin: process.env.APP2_URL ?? 'http://localhost:3201'},
  {name: 'App 3 AI 校園心靈守護者', origin: process.env.APP3_URL ?? 'http://localhost:3202'},
];

async function fetchOk(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response;
}

function assetUrls(origin, html) {
  const urls = new Set();
  for (const match of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)) {
    urls.add(new URL(match[1], origin).toString());
  }
  return [...urls];
}

for (const target of targets) {
  const home = await fetchOk(`${target.origin}/`);
  const html = await home.text();
  const assets = assetUrls(target.origin, html);
  if (assets.length === 0) {
    throw new Error(`${target.name} did not expose build assets`);
  }

  await Promise.all(assets.map((url) => fetchOk(url)));
  console.log(`ok ${target.name}: home + ${assets.length} assets`);

  if (target.api) {
    const ready = await fetchOk(`${target.origin}/api/ready`).then((response) => response.json());
    if (!ready.ok || !ready.storage?.writable || !ready.staticBuild?.available) {
      throw new Error(`${target.name} /api/ready is not production-ready`);
    }

    const notes = await fetchOk(`${target.origin}/api/notes`).then((response) => response.json());
    if (!Array.isArray(notes.notes) || notes.notes.length === 0) {
      throw new Error(`${target.name} notes API returned no demo notes`);
    }

    for (const command of ['SHOW_ON', 'DELIVERY_START', 'CARE_DEPLOYED']) {
      const robotResponse = await fetch(`${target.origin}/api/robot/command`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({command, source: 'full-demo-smoke'}),
      });
      if (![200, 503].includes(robotResponse.status)) {
        throw new Error(`${target.name} robot command ${command} returned unexpected ${robotResponse.status}`);
      }
      const robot = await robotResponse.json();
      if (!robot.status || typeof robot.status.connected !== 'boolean' || robot.status.lastCommand !== command) {
        throw new Error(`${target.name} robot command ${command} response is invalid`);
      }
    }
    console.log(`ok ${target.name}: ready + notes + shared robot fallback/serial responses`);
  }
}

console.log('full demo smoke passed');
