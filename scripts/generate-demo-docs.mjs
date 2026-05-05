#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {apps, appUrl, guideUrl, rootDir} from './app-catalog.mjs';

const publicBase = 'https://timdirty.github.io/115-campus-ai-demo';
const docsDir = path.join(rootDir, 'docs');

function ensureDocsDir() {
  fs.mkdirSync(docsDir, {recursive: true});
}

function writeDoc(fileName, text) {
  fs.writeFileSync(path.join(docsDir, fileName), `${text.trim()}\n`, 'utf8');
}

function commandLine(app) {
  return app.ev3.commands.map((command) => `\`${command}\``).join(', ');
}

function pitchFor(app) {
  const steps = app.flow.join(' -> ');
  return `## ${app.team} - ${app.name}

### 1 minute

大家好，我們是${app.team}。我們的作品是「${app.name}」，它要解決的是：${app.desc}

展示時我們會照著三步驟：${steps}。第一步讓系統取得現場資料，第二步由 AI 或本機辨識做判斷，第三步把結果轉成機器人可以執行的指令。

硬體連動部分，我們預留 LEGO EV3 角色：「${app.ev3.role}」。沒有接硬體時也能用模擬模式完整展示；接上 EV3 後，會使用 ${commandLine(app)} 等指令。

### 3 minutes

我們選這個題目，是因為校園裡有很多重複、即時、需要安全判斷的工作。${app.name} 把畫面、資料或感測訊號整理成學生和老師看得懂的任務流程。

這個作品的技術重點有三個。第一，前端是完整可操作的 app，不是只有簡報畫面。第二，系統有本機備援邏輯，AI 或網路不穩時仍能展示主要流程。第三，機器人指令已經整理成 catalog，未來接 EV3 時不用重寫作品。

我們現場會展示：${steps}。如果評審想看硬體，我們會說明 EV3 的角色是「${app.ev3.role}」，並展示指令如何從 app 送到 bridge，再到 EV3 或 Arduino。若沒有硬體，系統會啟用模擬模式，留下任務紀錄，證明流程仍然完整。

### 5 minutes

完整展示可以分成問題、解法、AI、硬體、備援五段。

問題：${app.desc}

解法：我們不是只做一頁展示，而是做成一個可以操作的校園工具。使用者從首頁進入後，可以依序完成 ${steps}。

AI：作品會把輸入資料轉成可理解的建議。可以使用雲端 AI，也保留本機分析或 fallback，避免現場網路造成展示中斷。

硬體：EV3 指令已先規劃成 ${commandLine(app)}。這代表 app 端、bridge 端、EV3 server 端可以用同一份指令語言溝通。

備援：如果相機、AI、EV3 或 Arduino 其中一個現場不穩，作品仍能開啟、操作、記錄任務，並用模擬模式說明接上硬體後的真實動作。`;
}

function buildPitches() {
  return `# Student Demo Pitches

這份講稿給三隊上台前練習用。每隊都有 1 分鐘、3 分鐘、5 分鐘版本，可以依比賽時間縮放。

${apps.map(pitchFor).join('\n\n')}`;
}

function buildCalibration() {
  const rows = apps.flatMap((app) => app.ev3.commands.map((command) => {
    const portHint = command.includes('ARM') || command.includes('DRAW') || command.includes('PEN') ? 'Motor A/B' : command.includes('STATUS') ? 'N/A' : 'Motor/LED by build';
    const durationHint = command.includes('STOP') || command.includes('STATUS') ? 'instant' : command.includes('CALIBRATE') ? '3-5s' : '0.5-2s';
    const safety = command.includes('STOP') || command.includes('SAFE') || command.includes('CANCEL') ? 'safety command' : 'stop with EV3_STOP before touching mechanism';
    return `| ${app.team} | ${command} | ${app.ev3.role} | ${portHint} | ${durationHint} | ${safety} |`;
  }));

  return `# EV3 Calibration Table

接真機前先用這張表逐項校準。所有隊伍都必須先確認 \`EV3_STOP\` 可以立即停止，再測其他動作。

| Team | Command | Intended action | Port hint | Time/angle hint | Safety note |
| --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

## Field Notes

- 馬達方向如果相反，優先改 EV3 brick 端的 motor polarity，不要改 app 指令名稱。
- 每次調整角度後，先跑 \`EV3_SAFE_POSE\` 或 \`EV3_HOME\`，再跑下一個動作。
- 多隊共用一台 EV3 時，用 \`EV3_HOST\` 固定目標；多台 EV3 時，用 \`EV3_HOSTS\` 列出候選。`;
}

function buildReadyGuide() {
  const routes = [
    '/',
    ...apps.map((app) => `/${appUrl(app)}`),
    ...apps.map((app) => `/${guideUrl(app)}`),
  ];
  return `# Demo Ready Runbook

## One Command

\`\`\`zsh
npm run demo:ready
\`\`\`

這個指令會用硬體模擬模式跑完整 readiness，並重新產生展示講稿與 EV3 校準表。

## Hardware Simulation

\`\`\`zsh
DEMO_SIMULATE_HARDWARE=1 npm run dev
\`\`\`

模擬模式會讓 Arduino 與 EV3 回傳可展示的成功結果。沒有接硬體時可用它保住現場流程；接真機時拿掉這個環境變數。

## Public Routes

${routes.map((route) => `- ${publicBase}${route}`).join('\n')}

## Final Public Check

GitHub Pages 部署完成後再跑：

\`\`\`zsh
CHECK_PUBLIC_URLS=1 node scripts/competition-readiness-check.mjs
\`\`\``;
}

ensureDocsDir();
writeDoc('STUDENT_PITCHES.md', buildPitches());
writeDoc('EV3_CALIBRATION_TABLE.md', buildCalibration());
writeDoc('DEMO_READY.md', buildReadyGuide());

console.log('Demo docs generated: docs/STUDENT_PITCHES.md, docs/EV3_CALIBRATION_TABLE.md, docs/DEMO_READY.md');
