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
  const hardwareExtra = app.hardwarePitchNote ? `${app.hardwarePitchNote}` : '';
  const hardwareLine = hardwareExtra
    ? `硬體連動部分，我們預留 LEGO EV3 角色：「${app.ev3.role}」。沒有接硬體時也能用模擬模式完整展示；接上 EV3 後，會使用 ${commandLine(app)} 等指令。${hardwareExtra}`
    : `硬體連動部分，我們預留 LEGO EV3 角色：「${app.ev3.role}」。沒有接硬體時也能用模擬模式完整展示；接上 EV3 後，會使用 ${commandLine(app)} 等指令。`;
  return `## ${app.team} - ${app.name}

### 1 minute

大家好，我們是${app.team}。我們的作品是「${app.name}」，它要解決的是：${app.desc}

展示時我們會照著三步驟：${steps}。第一步讓系統取得現場資料，第二步由 AI 或本機辨識做判斷，第三步把結果轉成機器人可以執行的指令。

${hardwareLine}

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

function buildFieldChecklist() {
  return `# Field Checklist

這份是比賽當天放在桌上的最後檢查表。每次出發前、上台前、換場前各跑一次。

## 10 Minutes Before Demo

- [ ] 執行 \`npm run demo:ready\`，確認最後出現 \`Competition readiness check passed\`。
- [ ] 打開 \`demo-ready-report.json\`，確認三隊 app 與 EV3 指令清單都在。
- [ ] 確認三隊學生知道自己的入口：\`${publicBase}/app1/\`、\`${publicBase}/app2/\`、\`${publicBase}/app3/\`。
- [ ] 若 GitHub Pages 已部署，執行 \`CHECK_PUBLIC_URLS=1 node scripts/competition-readiness-check.mjs\`。
- [ ] 若現場網路不穩，改用本機展示與 Pages artifact。

## Hardware

- [ ] UNO R4 已接 USB，或已決定使用 \`DEMO_SIMULATE_HARDWARE=1\`。
- [ ] EV3 已開機並確認 \`EV3_STOP\` 可用。
- [ ] 沒接 EV3 時，學生說法使用「模擬模式保留完整指令流程」。
- [ ] 真機測試順序：\`EV3_STATUS\` -> \`EV3_SAFE_POSE\` / \`EV3_HOME\` -> 單一動作 -> \`EV3_STOP\`。

${apps.map((app) => {
  const items = (app.checklistItems ?? []).map((item) => `- [ ] ${item}`).join('\n');
  return `## ${app.shortName}\n\n${items}`;
}).join('\n\n')}

## Recovery Lines

- 網路不穩：使用本機 fallback 與已 build 的 Pages artifact。
- 相機不能開：使用照片上傳或範例資料。
- EV3/Arduino 未連線：切到 \`DEMO_SIMULATE_HARDWARE=1\`，展示同一套指令流程。
- 評審問「是否真能接硬體」：指出 \`docs/EV3_CALIBRATION_TABLE.md\`、\`docs/EV3_INTEGRATION.md\` 與已通過的 PlatformIO/EV3 catalog check。`;
}

function buildJudgeQa() {
  const appSections = apps.map((app) => {
    const extraQa = (app.judgeQaExtra ?? []).map(({q, a}) => `### Q: ${q}\n\nA: ${a}\n`).join('\n');
    return `## ${app.team} - ${app.name}

### Q: 這跟一般展示網頁差在哪？

A: 這不是只放圖片的網頁，而是可以操作的作品。它有自己的資料流程、任務狀態、展示備援，並且可透過 bridge 接 Arduino UNO R4 與 LEGO EV3。

### Q: AI 真的做了什麼？

A: ${app.name} 會把輸入資料整理成可執行的建議。若雲端 AI 不可用，作品仍有本機 fallback；影像功能也會回傳像素證據與畫面品質提示，不只是固定文字。

### Q: 沒網路或沒有 Gemini key 怎麼辦？

A: 三隊都保留本機展示模式。沒有 key 時仍可操作主要流程、保存紀錄、產生任務與說明備援狀態。

### Q: EV3 怎麼接？

A: ${app.team} 的 EV3 角色是「${app.ev3.role}」。app 送出 \`${app.ev3.commands.join('`, `')}\` 等指令，App 1 bridge 再轉到 EV3 brick 的 WebSocket server。

### Q: 如果硬體當場故障呢？

A: 使用 \`DEMO_SIMULATE_HARDWARE=1\`，畫面會保留同一套任務流程；接回真機時移除環境變數即可。

${extraQa}`;
  }).join('\n');

  return `# Judge Q&A Cards

這份給學生準備評審追問。回答原則：先講作品目的，再講真實可用的流程，最後講備援。

${appSections}

## Common Closing Line

我們的重點不是只做出一個畫面，而是讓三隊作品在沒有網路、沒有硬體、或現場環境不穩時，仍能完整展示核心流程；接上硬體後，同一套指令會變成實體動作。`;
}

ensureDocsDir();
writeDoc('STUDENT_PITCHES.md', buildPitches());
writeDoc('EV3_CALIBRATION_TABLE.md', buildCalibration());
writeDoc('DEMO_READY.md', buildReadyGuide());
writeDoc('FIELD_CHECKLIST.md', buildFieldChecklist());
writeDoc('JUDGE_QA.md', buildJudgeQa());

console.log('Demo docs generated: docs/STUDENT_PITCHES.md, docs/EV3_CALIBRATION_TABLE.md, docs/DEMO_READY.md, docs/FIELD_CHECKLIST.md, docs/JUDGE_QA.md');
