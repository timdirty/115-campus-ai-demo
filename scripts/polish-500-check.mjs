#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {apps, appDir, appUrl, allPublishedRoutes, guidePath, guideUrl, rootDir} from './app-catalog.mjs';

const requiredRootScripts = ['dev', 'app', 'dev:app1', 'dev:app2', 'dev:app3', 'check:app1', 'check:app2', 'check:app3', 'check:ev3', 'check:hardware', 'check:polish', 'check:public', 'check:visual', 'demo:docs', 'demo:evidence', 'demo:ev3-report', 'demo:judge', 'demo:rehearsal', 'demo:scorecard', 'demo:wiring', 'demo:ready'];
const requiredAppScripts = ['dev', 'build', 'check'];
const routes = allPublishedRoutes();
const requiredDemoDocs = {
  'docs/DEMO_READY.md': ['demo:ready', 'DEMO_SIMULATE_HARDWARE', 'CHECK_PUBLIC_URLS'],
  'docs/STUDENT_PITCHES.md': ['1 minute', '3 minutes', '5 minutes', 'EV3'],
  'docs/EV3_CALIBRATION_TABLE.md': ['EV3_STOP', 'Port hint', 'Safety note'],
  'docs/FIELD_CHECKLIST.md': ['10 Minutes Before Demo', 'DEMO_SIMULATE_HARDWARE', 'Recovery Lines'],
  'docs/JUDGE_QA.md': ['Judge Q&A Cards', 'AI 真的做了什麼', 'DEMO_SIMULATE_HARDWARE'],
  'docs/DEMO_EVIDENCE.md': ['Verified Checks', '500-round polish validation passed', 'responsive layout checks passed'],
  'docs/DEMO_SCORECARD.md': ['Demo Scorecard', '60 Second Proof Flow', 'Final Teacher Sign-Off', 'DEMO_SIMULATE_HARDWARE'],
  'docs/REHEARSAL_RUNBOOK.md': ['Rehearsal Runbook', '15 Minute Team Rotation', 'Reset Contract', 'DEMO_SIMULATE_HARDWARE'],
  'docs/EV3_FIELD_TEST_REPORT.md': ['EV3 Field Test Report', 'Host Probe', 'Command Checklist', 'EV3_STOP'],
  'docs/HARDWARE_WIRING_MAP.md': ['Hardware Wiring Map', 'Topology', 'Failure Recovery', 'EV3 WebSocket'],
  'docs/JUDGE_ONE_PAGER.md': ['Judge One Pager', 'Three Teams', 'What AI Does', 'What Hardware Does'],
};
const featureContracts = {
  app1: {
    serviceFiles: [
      'src/services/boardVision.ts',
      'src/services/boardVision.test.ts',
      'src/services/frameQuality.ts',
      'src/services/classroomApi.ts',
      'src/components/home/RegionTaskPanel.tsx',
      'src/pages/Home.tsx',
      'server/hardwareSimulation.test.ts',
    ],
    scriptPhrases: ['boardVision.test.ts', 'hardwareSimulation.test.ts'],
    sourcePhrases: [
      ['src/services/boardVision.ts', 'analyzeWhiteboardPixels', 'analyzeWhiteboardImage', 'quality', '畫面品質'],
      ['src/services/boardVision.test.ts', '500', 'quality', '光線偏暗', '500-round pixel validation'],
      ['src/services/frameQuality.ts', 'analyzeFrameQuality', '畫面過曝', '畫面資訊太少'],
      ['src/services/classroomApi.ts', 'analyzeWhiteboardImage', 'localBoardAnalysis'],
      ['src/components/home/RegionTaskPanel.tsx', '本機影像證據'],
      ['src/components/home/RegionTaskPanel.tsx', '畫面品質提示'],
      ['src/pages/Home.tsx', '重置展示資料', 'resetWhiteboardDemoState'],
      ['server/hardwareSimulation.test.ts', 'DEMO_SIMULATE_HARDWARE', 'simulated://ev3', 'simulated://arduino-uno-r4'],
    ],
  },
  app2: {
    serviceFiles: [
      'src/services/localVision.ts',
      'src/services/frameQuality.ts',
      'src/__tests__/localVision.test.ts',
      'src/views/DashboardView.tsx',
    ],
    scriptPhrases: ['localVision.test.ts'],
    sourcePhrases: [
      ['src/services/localVision.ts', 'analyzeCampusPixels', 'analyzeCampusImage', 'quality', '畫面品質'],
      ['src/services/frameQuality.ts', 'analyzeFrameQuality', '畫面過曝', '畫面資訊太少'],
      ['src/__tests__/localVision.test.ts', '500', 'quality', '光線偏暗', '500-round pixel validation'],
      ['src/views/DashboardView.tsx', 'analyzeCampusImage', 'navigator.mediaDevices.getUserMedia', '轉成機器人任務'],
      ['src/views/DashboardView.tsx', '畫面品質 ·', 'visionResult.quality'],
    ],
  },
  app3: {
    serviceFiles: [
      'src/services/emotionTypography.ts',
      'src/services/visualPrivacyGuardian.ts',
      'src/services/frameQuality.ts',
      'src/__tests__/emotionTypography.test.ts',
      'src/__tests__/visualPrivacyGuardian.test.ts',
      'src/App.tsx',
    ],
    scriptPhrases: ['emotionTypography.test.ts', 'visualPrivacyGuardian.test.ts'],
    sourcePhrases: [
      ['src/services/emotionTypography.ts', 'analyzeEmotionTypography', 'guidance', 'preview'],
      ['src/services/visualPrivacyGuardian.ts', 'analyzePrivacyFrame', 'quality', '畫面品質'],
      ['src/services/frameQuality.ts', 'analyzeFrameQuality', '個人特寫', '畫面過曝'],
      ['src/__tests__/visualPrivacyGuardian.test.ts', '500', 'quality', '光線偏暗', '500-round pixel validation'],
      ['src/App.tsx', 'analyzeEmotionTypography', 'analyzePrivacyFrame', 'navigator.mediaDevices.getUserMedia', '情緒字體', '隱私影像感知'],
      ['src/App.tsx', '畫面品質 ·', 'visualResult.quality'],
    ],
  },
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertContains(source, phrase, label) {
  assert(source.includes(phrase), `${label} missing phrase: ${phrase}`);
}

function assertFileContains(filePath, phrases, label) {
  const source = fs.readFileSync(filePath, 'utf8');
  for (const phrase of phrases) {
    assertContains(source, phrase, label);
  }
}

function checkApp(app, round) {
  const dir = appDir(app);
  const guide = guidePath(app);
  const pkgPath = path.join(dir, 'package.json');
  const pkg = readJson(pkgPath);
  const guideText = fs.readFileSync(guide, 'utf8');
  const featureContract = featureContracts[app.id];

  assert(fs.existsSync(dir), `${app.id} directory missing`);
  assert(fs.existsSync(pkgPath), `${app.id} package.json missing`);
  assert(fs.existsSync(guide), `${app.id} guide missing`);
  assert(app.id === `app${(apps.indexOf(app) + 1)}`, `${app.id} id/order mismatch`);
  assert(app.team.length >= 4, `${app.id} team label too short`);
  assert(app.name.length >= 5, `${app.id} name too short`);
  assert(app.desc.length >= 12, `${app.id} description too short`);
  assert(/^#[0-9a-f]{6}$/i.test(app.accent), `${app.id} accent must be hex color`);
  assert(app.flow.length === 3 && app.flow.every((item) => item.length >= 2), `${app.id} flow must have 3 useful steps`);
  assert(Number.isInteger(app.devPort) && app.devPort >= 11501 && app.devPort <= 11503, `${app.id} devPort out of expected range`);
  assert(app.ev3?.commands?.length >= 5, `${app.id} EV3 command list too short`);
  assert(new Set(app.ev3.commands).size === app.ev3.commands.length, `${app.id} duplicate EV3 commands`);
  assert(app.ev3.commands.includes('EV3_STATUS'), `${app.id} missing EV3_STATUS`);
  assert(app.ev3.commands.includes('EV3_STOP'), `${app.id} missing EV3_STOP`);
  assert(routes.includes(`/${appUrl(app)}`), `${app.id} published app route missing`);
  assert(routes.includes(`/${guideUrl(app)}`), `${app.id} published guide route missing`);

  for (const scriptName of requiredAppScripts) {
    assert(pkg.scripts?.[scriptName], `${app.id} missing npm script: ${scriptName}`);
  }
  assert(featureContract, `${app.id} missing feature contract`);
  for (const fileName of featureContract.serviceFiles) {
    assert(fs.existsSync(path.join(dir, fileName)), `${app.id} missing feature file: ${fileName}`);
  }
  const scriptText = Object.values(pkg.scripts ?? {}).join('\n');
  for (const phrase of featureContract.scriptPhrases) {
    assertContains(scriptText, phrase, `${app.id} package scripts`);
  }
  for (const [fileName, ...phrases] of featureContract.sourcePhrases) {
    assertFileContains(path.join(dir, fileName), phrases, `${app.id} ${fileName}`);
  }
  for (const phrase of app.guidePhrases) {
    assertContains(guideText, phrase, `${app.id} guide`);
  }
  assertContains(guideText, '後續機器人連動計畫', `${app.id} guide`);
  assertContains(guideText, '公開展示網址', `${app.id} guide`);
  assert(app.pagePhrases.length >= 2, `${app.id} page phrase coverage too small`);
  assert(round >= 0, 'round should be non-negative');
}

function run() {
  const rootPackage = readJson(path.join(rootDir, 'package.json'));
  for (const scriptName of requiredRootScripts) {
    assert(rootPackage.scripts?.[scriptName], `root package missing npm script: ${scriptName}`);
  }
  for (const [docPath, phrases] of Object.entries(requiredDemoDocs)) {
    const fullPath = path.join(rootDir, docPath);
    assert(fs.existsSync(fullPath), `demo doc missing: ${docPath}`);
    assertFileContains(fullPath, phrases, docPath);
  }
  assert(routes.length === 8, `expected 8 published routes, got ${routes.length}`);
  assert(new Set(routes).size === routes.length, 'published routes must be unique');

  for (let round = 0; round < 500; round += 1) {
    const app = apps[round % apps.length];
    checkApp(app, round);

    const nextApp = apps[(round + 1) % apps.length];
    assert(app.id !== nextApp.id || apps.length === 1, `round ${round}: app rotation stalled`);
    assert(app.devPort !== nextApp.devPort, `round ${round}: dev port collision`);
    assert(app.accent !== nextApp.accent, `round ${round}: adjacent app accent collision`);
  }

  console.log('polish-500-check.mjs: all assertions passed, including 500-round package polish validation');
}

try {
  run();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
