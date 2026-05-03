/**
 * 競賽學習歷程簡報生成器
 * 執行：node docs/competition/generate-ppt.mjs
 * 輸出：docs/competition/競賽學習歷程簡報.pptx
 *
 * 依賴：pptxgenjs（npm install pptxgenjs）
 */

import PptxGenJS from '/tmp/pptgen/node_modules/pptxgenjs/dist/pptxgen.cjs.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── 色票 ──────────────────────────────────────────────────────────────────
const C = {
  bg:       'F8F9FB',   // 淺灰背景
  dark:     '1A1D23',   // 深色文字
  mid:      '5A6072',   // 中灰文字
  light:    'C8CDD8',   // 分隔線
  white:    'FFFFFF',
  app1:     'FF7A00',   // App1 橘色（板擦機器人）
  app1lt:   'FFF0E0',
  app2:     '2ECC71',   // App2 綠色（服務機器人）
  app2lt:   'E8FBF2',
  app3:     '7C3AED',   // App3 紫色（心靈守護者）
  app3lt:   'F3EEFF',
  accent:   '2563EB',   // 主品牌藍
  accentlt: 'EFF6FF',
};

// ── 工具函式 ─────────────────────────────────────────────────────────────
function hex(c) { return c; }

function slideBase(prs, opts = {}) {
  const s = prs.addSlide();
  // 白底
  s.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: opts.bg || C.bg }, line: { color: opts.bg || C.bg } });
  // 左側色條
  if (opts.accent) {
    s.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: '100%', fill: { color: opts.accent }, line: { color: opts.accent } });
  }
  return s;
}

function tag(s, text, x, y, color, bgColor) {
  s.addShape(s._slideLayout ? s._slideLayout._presentation.ShapeType?.rect : 'rect',
    { x, y, w: text.length * 0.18 + 0.3, h: 0.3, fill: { color: bgColor }, line: { color: bgColor }, rx: 4 });
  s.addText(text, { x, y, w: text.length * 0.18 + 0.3, h: 0.3, fontSize: 9, bold: true, color, align: 'center' });
}

// ── 投影片 1：封面 ────────────────────────────────────────────────────────
function addCover(prs) {
  const s = prs.addSlide();
  // 深色全頁底
  s.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: C.dark }, line: { color: C.dark } });
  // 品牌藍橫條
  s.addShape(prs.ShapeType.rect, { x: 0, y: 3.2, w: '100%', h: 0.06, fill: { color: C.accent }, line: { color: C.accent } });

  s.addText('115學年度\n資通訊科技實作競賽', {
    x: 0.6, y: 0.4, w: 9, h: 0.9,
    fontSize: 14, color: '8899CC', bold: false,
  });
  s.addText('三合一校園\nAI 機器人系統', {
    x: 0.6, y: 1.1, w: 9, h: 1.8,
    fontSize: 44, bold: true, color: C.white,
  });
  s.addText('App 1 自動板擦機器人  ·  App 2 校園服務機器人  ·  App 3 心靈守護者', {
    x: 0.6, y: 3.4, w: 9, h: 0.4,
    fontSize: 12, color: 'AABBDD',
  });

  // 三色塊
  const apps = [
    { label: 'App 1\n板擦機器人', color: C.app1, lc: C.app1lt, x: 0.6 },
    { label: 'App 2\n服務機器人', color: C.app2, lc: C.app2lt, x: 4.0 },
    { label: 'App 3\n心靈守護者', color: C.app3, lc: C.app3lt, x: 7.4 },
  ];
  apps.forEach(({ label, color, x }) => {
    s.addShape(prs.ShapeType.rect, { x, y: 4.0, w: 2.8, h: 1.4, fill: { color }, line: { color }, rx: 8 });
    s.addText(label, { x, y: 4.0, w: 2.8, h: 1.4, fontSize: 14, bold: true, color: C.white, align: 'center', valign: 'middle' });
  });

  s.addText('Arduino UNO R4 WiFi  ·  React  ·  Node.js  ·  Firebase  ·  Google Gemini AI', {
    x: 0.6, y: 5.55, w: 9, h: 0.3,
    fontSize: 9, color: '667788', align: 'center',
  });
}

// ── 投影片 2：整體系統架構 ─────────────────────────────────────────────────
function addSystemArch(prs) {
  const s = slideBase(prs, { accent: C.accent });

  s.addText('整體系統架構', { x: 0.4, y: 0.25, w: 9, h: 0.5, fontSize: 22, bold: true, color: C.dark });
  s.addText('三個 App 共用同一套 Arduino 硬體，透過 App 1 的 Node.js 橋接層統一管理', {
    x: 0.4, y: 0.75, w: 9, h: 0.35, fontSize: 11, color: C.mid,
  });

  // 硬體層
  s.addShape(prs.ShapeType.rect, { x: 3.5, y: 1.3, w: 3.2, h: 0.7, fill: { color: '1A1D23' }, line: { color: '1A1D23' }, rx: 6 });
  s.addText('⚙  Arduino UNO R4 WiFi\n（伺服機、LED矩陣、感測器）', {
    x: 3.5, y: 1.3, w: 3.2, h: 0.7, fontSize: 9, color: C.white, align: 'center', valign: 'middle',
  });

  // 橋接層
  s.addShape(prs.ShapeType.rect, { x: 3.5, y: 2.3, w: 3.2, h: 0.6, fill: { color: C.accentlt }, line: { color: C.accent }, rx: 6 });
  s.addText('Node.js Serial 橋接層（App 1 專屬）', {
    x: 3.5, y: 2.3, w: 3.2, h: 0.6, fontSize: 9, bold: true, color: C.accent, align: 'center', valign: 'middle',
  });

  // 箭頭文字
  s.addText('↑ USB Serial 指令', { x: 3.5, y: 2.0, w: 3.2, h: 0.3, fontSize: 8, color: C.mid, align: 'center' });

  // 三個 App
  const apps = [
    { label: 'App 1\nAI 自動板擦機器人', color: C.app1, bglt: C.app1lt, x: 0.4, y: 3.2 },
    { label: 'App 2\n校園服務機器人', color: C.app2, bglt: C.app2lt, x: 3.8, y: 3.2 },
    { label: 'App 3\nAI 心靈守護者', color: C.app3, bglt: C.app3lt, x: 7.2, y: 3.2 },
  ];
  apps.forEach(({ label, color, bglt, x, y }) => {
    s.addShape(prs.ShapeType.rect, { x, y, w: 2.7, h: 1.1, fill: { color: bglt }, line: { color }, rx: 8 });
    s.addText(label, { x, y, w: 2.7, h: 1.1, fontSize: 12, bold: true, color, align: 'center', valign: 'middle' });
  });

  s.addText('↓ REST API / WebSocket', { x: 3.5, y: 3.0, w: 3.2, h: 0.25, fontSize: 8, color: C.mid, align: 'center' });

  // 底部
  s.addText('所有 Serial 指令（CLEAN_START / ERASE_ALL / ALERT_SIGNAL…）都透過同一個 handleCommand() 分發', {
    x: 0.4, y: 5.4, w: 9.5, h: 0.4, fontSize: 9, color: C.mid, align: 'center',
  });
}

// ── 投影片 3：App 1 概覽 ───────────────────────────────────────────────────
function addApp1Overview(prs) {
  const s = slideBase(prs, { accent: C.app1 });
  s.addText('App 1', { x: 0.3, y: 0.2, w: 1.2, h: 0.4, fontSize: 11, bold: true, color: C.app1 });
  s.addText('AI 自動板擦機器人', { x: 0.3, y: 0.55, w: 8, h: 0.55, fontSize: 26, bold: true, color: C.dark });
  s.addText('老師一鍵下令，機器人自動辨識黑板區域並精準擦除', {
    x: 0.3, y: 1.1, w: 8, h: 0.35, fontSize: 12, color: C.mid,
  });

  // 問題 + 解法
  [
    { title: '解決的問題', items: ['老師擦黑板費時費力', '粉筆灰影響健康', '區域擦除不精準'], y: 1.6 },
    { title: '我們的解法', items: ['App 選區域 → 送指令給 Arduino', '伺服機帶動板擦臂來回移動', 'AI 偵測黑板確認擦淨'], y: 1.6 },
  ].forEach(({ title, items, y }, i) => {
    const x = i === 0 ? 0.3 : 5.3;
    s.addShape(prs.ShapeType.rect, { x, y, w: 4.6, h: 2.0, fill: { color: i === 0 ? 'FFF5F0' : C.app1lt }, line: { color: i === 0 ? 'FFCCAA' : C.app1 }, rx: 8 });
    s.addText(title, { x: x + 0.2, y: y + 0.1, w: 4.2, h: 0.35, fontSize: 11, bold: true, color: C.app1 });
    items.forEach((item, j) => {
      s.addText(`• ${item}`, { x: x + 0.2, y: y + 0.5 + j * 0.42, w: 4.2, h: 0.38, fontSize: 10.5, color: C.dark });
    });
  });

  // 指令清單
  s.addText('核心 Serial 指令', { x: 0.3, y: 3.75, w: 4, h: 0.3, fontSize: 11, bold: true, color: C.dark });
  const cmds = ['CLEAN_START', 'ERASE_ALL', 'ERASE_REGION_A/B/C', 'KEEP_REGION_A/B', 'PAUSE_TASK', 'FIREWORK'];
  cmds.forEach((cmd, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    s.addShape(prs.ShapeType.rect, { x: 0.3 + col * 3.1, y: 4.1 + row * 0.5, w: 2.8, h: 0.38, fill: { color: '1A1D23' }, line: { color: '1A1D23' }, rx: 4 });
    s.addText(cmd, { x: 0.3 + col * 3.1, y: 4.1 + row * 0.5, w: 2.8, h: 0.38, fontSize: 9, bold: true, color: C.app1, align: 'center', valign: 'middle' });
  });
}

// ── 投影片 4：App 1 狀態圖（文字版） ─────────────────────────────────────
function addApp1StateDiagram(prs) {
  const s = slideBase(prs, { accent: C.app1 });
  s.addText('App 1｜系統狀態圖', { x: 0.3, y: 0.25, w: 9, h: 0.45, fontSize: 20, bold: true, color: C.dark });
  s.addText('機器人在不同指令下的狀態轉移（完整 Draw.io 圖檔：docs/competition/app1-板擦機器人/state-diagram.drawio）', {
    x: 0.3, y: 0.7, w: 9.5, h: 0.3, fontSize: 9, color: C.mid,
  });

  const states = [
    { id: 'S1', label: '⏸ 待命中', color: 'FFF2CC', border: 'D6B656', x: 4.2, y: 1.2 },
    { id: 'S2', label: '🔗 連線中', color: 'DAE8FC', border: '6C8EBF', x: 4.2, y: 2.1 },
    { id: 'S3', label: '✅ 已連線', color: 'D5E8D4', border: '82B366', x: 4.2, y: 3.0 },
    { id: 'S4', label: '🚗 移動中', color: 'FFE6CC', border: 'D79B00', x: 1.5, y: 3.9 },
    { id: 'S5', label: '🧹 清潔中', color: 'F8CECC', border: 'B85450', x: 4.2, y: 3.9 },
    { id: 'S6', label: '⏸ 暫停', color: 'E8E8E8', border: '999999', x: 6.9, y: 3.9 },
    { id: 'S7', label: '🎆 任務完成', color: 'D5E8D4', border: '82B366', x: 4.2, y: 4.9 },
  ];

  states.forEach(({ label, color, border, x, y }) => {
    s.addShape(prs.ShapeType.ellipse, { x, y, w: 2.2, h: 0.65, fill: { color }, line: { color: border, width: 1.5 } });
    s.addText(label, { x, y, w: 2.2, h: 0.65, fontSize: 10, bold: true, color: C.dark, align: 'center', valign: 'middle' });
  });

  const arrows = [
    { text: '按下連線', x: 5.0, y: 1.85 },
    { text: '連線成功', x: 5.0, y: 2.75 },
    { text: 'CLEAN_START', x: 5.0, y: 3.55, toLeft: true },
    { text: 'PAUSE_TASK', x: 5.6, y: 3.55 },
    { text: '清潔完成', x: 5.0, y: 4.6 },
  ];
  arrows.forEach(({ text, x, y }) => {
    s.addText(`↓ ${text}`, { x, y, w: 2.2, h: 0.3, fontSize: 8, color: C.mid, align: 'center' });
  });
  s.addText('← CLEAN_START', { x: 2.3, y: 3.55, w: 2.0, h: 0.3, fontSize: 8, color: C.mid });
}

// ── 投影片 5：App 1 Scratch 藍圖 ─────────────────────────────────────────
function addApp1Scratch(prs) {
  const s = slideBase(prs, { accent: C.app1 });
  s.addText('App 1｜Scratch 積木藍圖', { x: 0.3, y: 0.25, w: 9, h: 0.45, fontSize: 20, bold: true, color: C.dark });
  s.addText('用 Scratch 重現板擦機器人的核心邏輯，幫助理解程式流程', {
    x: 0.3, y: 0.7, w: 9, h: 0.3, fontSize: 11, color: C.mid,
  });

  // 角色列表
  s.addShape(prs.ShapeType.rect, { x: 0.3, y: 1.1, w: 3.2, h: 2.0, fill: { color: C.app1lt }, line: { color: C.app1 }, rx: 8 });
  s.addText('角色（Sprites）', { x: 0.5, y: 1.15, w: 2.8, h: 0.35, fontSize: 11, bold: true, color: C.app1 });
  ['🤖 板擦機器人（4造型）', '🖊 黑板（5造型）', '🤖 AI 助手（說話泡泡）', '🔘 控制按鈕（3個）'].forEach((item, i) => {
    s.addText(item, { x: 0.5, y: 1.55 + i * 0.37, w: 2.8, h: 0.33, fontSize: 9.5, color: C.dark });
  });

  // 積木範例
  s.addShape(prs.ShapeType.rect, { x: 3.8, y: 1.1, w: 6.0, h: 4.3, fill: { color: '1A1D23' }, line: { color: '333A4A' }, rx: 8 });
  s.addText('積木腳本範例（板擦機器人）', { x: 4.0, y: 1.2, w: 5.6, h: 0.3, fontSize: 9, bold: true, color: C.app1 });

  const blocks = [
    { text: '🟡 當 ▶ 被點擊', color: 'FFD700' },
    { text: '   移到 x:-150 y:0', color: 'AAAAFF' },
    { text: '   切換造型為「待命」', color: 'AAAAFF' },
    { text: '   說「等待指令...」2秒', color: 'AAAAFF' },
    { text: '', color: C.dark },
    { text: '🟢 當接收到「開始清潔」', color: '88FF88' },
    { text: '   切換造型為「移動中」', color: 'AAAAFF' },
    { text: '   重複直到 碰到「黑板」', color: 'FFAA44' },
    { text: '      移動 10 步', color: 'AAAAFF' },
    { text: '   切換造型為「擦拭中」', color: 'AAAAFF' },
    { text: '   重複 5 次', color: 'FFAA44' },
    { text: '      移動20步 → 移動-20步', color: 'AAAAFF' },
    { text: '   廣播「清潔完成」', color: '88FF88' },
  ];

  blocks.forEach(({ text, color }, i) => {
    s.addText(text, { x: 4.0, y: 1.55 + i * 0.28, w: 5.6, h: 0.26, fontSize: 8.5, color, fontFace: 'Courier New' });
  });

  s.addText('完整藍圖：docs/competition/app1-板擦機器人/scratch-blueprint.md', {
    x: 0.3, y: 5.5, w: 9.5, h: 0.25, fontSize: 8, color: C.mid, align: 'center',
  });
}

// ── 投影片 6：App 2 概覽 ───────────────────────────────────────────────────
function addApp2Overview(prs) {
  const s = slideBase(prs, { accent: C.app2 });
  s.addText('App 2', { x: 0.3, y: 0.2, w: 1.2, h: 0.4, fontSize: 11, bold: true, color: C.app2 });
  s.addText('校園服務機器人', { x: 0.3, y: 0.55, w: 8, h: 0.55, fontSize: 26, bold: true, color: C.dark });
  s.addText('多台機器人同時在校園執勤，一個畫面看全局', {
    x: 0.3, y: 1.1, w: 8, h: 0.35, fontSize: 12, color: C.mid,
  });

  const features = [
    { icon: '🗺', title: '派遣地圖', desc: '校園地圖上點選目的地，機器人自動規劃路徑' },
    { icon: '📦', title: '送貨追蹤', desc: '即時顯示機器人位置與任務進度' },
    { icon: '📊', title: '儀表板', desc: '電量、速度、完成率一眼看清' },
    { icon: '📋', title: '學生回報', desc: '任務完成後自動生成報告' },
  ];

  features.forEach(({ icon, title, desc }, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.3 + col * 5.0;
    const y = 1.6 + row * 1.5;
    s.addShape(prs.ShapeType.rect, { x, y, w: 4.6, h: 1.25, fill: { color: C.app2lt }, line: { color: C.app2 }, rx: 8 });
    s.addText(`${icon}  ${title}`, { x: x + 0.2, y: y + 0.1, w: 4.2, h: 0.38, fontSize: 12, bold: true, color: C.app2 });
    s.addText(desc, { x: x + 0.2, y: y + 0.5, w: 4.2, h: 0.6, fontSize: 10, color: C.dark });
  });

  // 任務流程橫條
  const steps = ['建立任務', '指定機器人', '設定目的地', '出發追蹤', '完成回報'];
  s.addText('任務5步驟', { x: 0.3, y: 4.7, w: 2, h: 0.3, fontSize: 10, bold: true, color: C.dark });
  steps.forEach((step, i) => {
    s.addShape(prs.ShapeType.rect, { x: 0.3 + i * 1.95, y: 5.05, w: 1.7, h: 0.55, fill: { color: C.app2 }, line: { color: C.app2 }, rx: 6 });
    s.addText(`${i + 1}. ${step}`, { x: 0.3 + i * 1.95, y: 5.05, w: 1.7, h: 0.55, fontSize: 9, bold: true, color: C.white, align: 'center', valign: 'middle' });
    if (i < 4) s.addText('→', { x: 2.0 + i * 1.95, y: 5.15, w: 0.25, h: 0.35, fontSize: 12, color: C.mid });
  });
}

// ── 投影片 7：App 2 Scratch 藍圖 ─────────────────────────────────────────
function addApp2Scratch(prs) {
  const s = slideBase(prs, { accent: C.app2 });
  s.addText('App 2｜Scratch 積木藍圖', { x: 0.3, y: 0.25, w: 9, h: 0.45, fontSize: 20, bold: true, color: C.dark });
  s.addText('用 Scratch 模擬機器人接到任務、移動、到達、回報的完整流程', {
    x: 0.3, y: 0.7, w: 9, h: 0.3, fontSize: 11, color: C.mid,
  });

  s.addShape(prs.ShapeType.rect, { x: 0.3, y: 1.1, w: 3.2, h: 1.8, fill: { color: C.app2lt }, line: { color: C.app2 }, rx: 8 });
  s.addText('角色（Sprites）', { x: 0.5, y: 1.15, w: 2.8, h: 0.35, fontSize: 11, bold: true, color: C.app2 });
  ['🤖 服務機器人（4台造型）', '🗺 校園地圖（背景）', '📋 任務卡片', '✅ 完成標誌'].forEach((item, i) => {
    s.addText(item, { x: 0.5, y: 1.55 + i * 0.37, w: 2.8, h: 0.33, fontSize: 9.5, color: C.dark });
  });

  s.addShape(prs.ShapeType.rect, { x: 3.8, y: 1.1, w: 6.0, h: 4.3, fill: { color: '1A1D23' }, line: { color: '333A4A' }, rx: 8 });
  s.addText('積木腳本範例（服務機器人）', { x: 4.0, y: 1.2, w: 5.6, h: 0.3, fontSize: 9, bold: true, color: C.app2 });

  const blocks = [
    { text: '🟡 當 ▶ 被點擊', color: 'FFD700' },
    { text: '   移到 起點位置', color: 'AAAAFF' },
    { text: '   說「等待派遣...」', color: 'AAAAFF' },
    { text: '', color: C.dark },
    { text: '🟢 當接收到「派遣任務」', color: '88FF88' },
    { text: '   顯示 任務卡片', color: 'AAAAFF' },
    { text: '   說「收到！前往目的地」2秒', color: 'AAAAFF' },
    { text: '   重複直到 到達目的地', color: 'FFAA44' },
    { text: '      面向 目標方向', color: 'AAAAFF' },
    { text: '      移動 5 步', color: 'AAAAFF' },
    { text: '   說「任務完成！」3秒', color: 'AAAAFF' },
    { text: '   廣播「回傳報告」', color: '88FF88' },
    { text: '', color: C.dark },
    { text: '🔵 當接收到「回傳報告」', color: '88AAFF' },
    { text: '   顯示 完成標誌', color: 'AAAAFF' },
  ];

  blocks.forEach(({ text, color }, i) => {
    s.addText(text, { x: 4.0, y: 1.55 + i * 0.28, w: 5.6, h: 0.26, fontSize: 8.5, color, fontFace: 'Courier New' });
  });

  s.addText('完整藍圖：docs/competition/app2-校園服務機器人/scratch-blueprint.md', {
    x: 0.3, y: 5.5, w: 9.5, h: 0.25, fontSize: 8, color: C.mid, align: 'center',
  });
}

// ── 投影片 8：App 3 概覽 ───────────────────────────────────────────────────
function addApp3Overview(prs) {
  const s = slideBase(prs, { accent: C.app3 });
  s.addText('App 3', { x: 0.3, y: 0.2, w: 1.2, h: 0.4, fontSize: 11, bold: true, color: C.app3 });
  s.addText('AI 校園心靈守護者', { x: 0.3, y: 0.55, w: 8, h: 0.55, fontSize: 26, bold: true, color: C.dark });
  s.addText('感測器 + AI 分析，及早發現需要關懷的同學', {
    x: 0.3, y: 1.1, w: 8, h: 0.35, fontSize: 12, color: C.mid,
  });

  // 三層架構
  s.addText('系統三層架構', { x: 0.3, y: 1.6, w: 5, h: 0.35, fontSize: 12, bold: true, color: C.dark });
  const layers = [
    { label: '感測層', desc: '校園各點感測節點持續偵測', color: 'EDE9FE', bc: C.app3 },
    { label: 'AI 分析層', desc: '判斷風險等級（高/中/低）並生成關懷建議', color: 'F3EEFF', bc: C.app3 },
    { label: '行動層', desc: '通知老師 → 部署關懷 → 結案追蹤', color: 'FAF5FF', bc: C.app3 },
  ];
  layers.forEach(({ label, desc, color, bc }, i) => {
    s.addShape(prs.ShapeType.rect, { x: 0.3, y: 2.05 + i * 0.85, w: 9.5, h: 0.72, fill: { color }, line: { color: bc }, rx: 6 });
    s.addText(`${i + 1}. ${label}`, { x: 0.5, y: 2.1 + i * 0.85, w: 1.8, h: 0.35, fontSize: 11, bold: true, color: C.app3 });
    s.addText(desc, { x: 2.4, y: 2.15 + i * 0.85, w: 7.0, h: 0.5, fontSize: 10, color: C.dark, valign: 'middle' });
  });

  // 隱私保護亮點
  s.addShape(prs.ShapeType.rect, { x: 0.3, y: 4.65, w: 4.6, h: 0.9, fill: { color: 'FFF0F3' }, line: { color: 'FF6B6B' }, rx: 8 });
  s.addText('🔒 隱私保護設計', { x: 0.5, y: 4.7, w: 4.2, h: 0.35, fontSize: 11, bold: true, color: 'CC0000' });
  s.addText('學生使用別名（小明、小花），真實姓名不進入系統', { x: 0.5, y: 5.05, w: 4.2, h: 0.35, fontSize: 9.5, color: C.dark });

  s.addShape(prs.ShapeType.rect, { x: 5.2, y: 4.65, w: 4.6, h: 0.9, fill: { color: C.app3lt }, line: { color: C.app3 }, rx: 8 });
  s.addText('🤖 AI 關懷建議', { x: 5.4, y: 4.7, w: 4.2, h: 0.35, fontSize: 11, bold: true, color: C.app3 });
  s.addText('根據警示類型自動推薦關懷策略，減輕老師負擔', { x: 5.4, y: 5.05, w: 4.2, h: 0.35, fontSize: 9.5, color: C.dark });
}

// ── 投影片 9：App 3 Scratch 藍圖 ─────────────────────────────────────────
function addApp3Scratch(prs) {
  const s = slideBase(prs, { accent: C.app3 });
  s.addText('App 3｜Scratch 積木藍圖', { x: 0.3, y: 0.25, w: 9, h: 0.45, fontSize: 20, bold: true, color: C.dark });
  s.addText('用 Scratch 模擬 AI 偵測→警示→老師關懷的完整流程', {
    x: 0.3, y: 0.7, w: 9, h: 0.3, fontSize: 11, color: C.mid,
  });

  s.addShape(prs.ShapeType.rect, { x: 0.3, y: 1.1, w: 3.2, h: 2.1, fill: { color: C.app3lt }, line: { color: C.app3 }, rx: 8 });
  s.addText('角色（Sprites）', { x: 0.5, y: 1.15, w: 2.8, h: 0.35, fontSize: 11, bold: true, color: C.app3 });
  ['🤖 守護者AI機器人', '👦 學生（3造型）', '🚨 警示燈（紅/黃/綠）', '💌 關懷卡片', '👩‍🏫 老師角色'].forEach((item, i) => {
    s.addText(item, { x: 0.5, y: 1.55 + i * 0.37, w: 2.8, h: 0.33, fontSize: 9.5, color: C.dark });
  });

  s.addShape(prs.ShapeType.rect, { x: 3.8, y: 1.1, w: 6.0, h: 4.3, fill: { color: '1A1D23' }, line: { color: '333A4A' }, rx: 8 });
  s.addText('積木腳本範例（守護者 AI）', { x: 4.0, y: 1.2, w: 5.6, h: 0.3, fontSize: 9, bold: true, color: C.app3 });

  const blocks = [
    { text: '🟡 當 ▶ 被點擊', color: 'FFD700' },
    { text: '   永遠重複', color: 'FFAA44' },
    { text: '      如果 學生造型 = 難過 那麼', color: 'FFAA44' },
    { text: '         廣播「觸發警示」', color: 'FF8888' },
    { text: '      等待 1 秒', color: 'AAAAFF' },
    { text: '', color: C.dark },
    { text: '🔴 當接收到「觸發警示」', color: 'FF8888' },
    { text: '   警示燈 切換造型「紅色」', color: 'AAAAFF' },
    { text: '   說「偵測到異常！AI分析中...」', color: 'AAAAFF' },
    { text: '   等待 2 秒', color: 'AAAAFF' },
    { text: '   廣播「AI建議出爐」', color: 'CC88FF' },
    { text: '', color: C.dark },
    { text: '🟣 當接收到「AI建議出爐」', color: 'CC88FF' },
    { text: '   關懷卡片 顯示', color: 'AAAAFF' },
    { text: '   說「建議：給同學溫暖問候」', color: 'AAAAFF' },
  ];

  blocks.forEach(({ text, color }, i) => {
    s.addText(text, { x: 4.0, y: 1.55 + i * 0.28, w: 5.6, h: 0.26, fontSize: 8.5, color, fontFace: 'Courier New' });
  });

  s.addText('完整藍圖：docs/competition/app3-心靈守護者/scratch-blueprint.md', {
    x: 0.3, y: 5.5, w: 9.5, h: 0.25, fontSize: 8, color: C.mid, align: 'center',
  });
}

// ── 投影片 10：學習歷程總結 ───────────────────────────────────────────────
function addLearning(prs) {
  const s = slideBase(prs, { accent: C.accent });
  s.addText('我們的學習歷程', { x: 0.3, y: 0.25, w: 9, h: 0.5, fontSize: 24, bold: true, color: C.dark });
  s.addText('從想法到實作，每一步都是學習', { x: 0.3, y: 0.75, w: 9, h: 0.3, fontSize: 11, color: C.mid });

  const steps = [
    { n: '01', title: '發現問題', desc: '觀察學校環境，發現老師擦黑板費力、機器人跑腿不方便、同學心理健康需要關注', color: C.app1 },
    { n: '02', title: '查資料', desc: '學習 Arduino 控制、了解 Serial 通訊原理、研究 AI 推薦系統', color: C.app2 },
    { n: '03', title: '用 Scratch 試想法', desc: '先在 Scratch 上模擬機器人動作，確認邏輯對了再進入實際開發', color: C.app3 },
    { n: '04', title: '畫流程圖', desc: '用 Draw.io 畫出每個 App 的狀態圖和使用者流程，讓分工更清楚', color: C.accent },
    { n: '05', title: '組裝 & 測試', desc: '把三個 App 接上同一個 Arduino，反覆測試指令有沒有正確執行', color: 'FF4444' },
    { n: '06', title: '改進 & 完成', desc: '根據老師試用回饋調整介面，加上導覽教學和問題回報功能', color: '888888' },
  ];

  steps.forEach(({ n, title, desc, color }, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.3 + col * 5.0;
    const y = 1.15 + row * 1.45;
    s.addShape(prs.ShapeType.rect, { x, y, w: 4.6, h: 1.25, fill: { color: C.bg }, line: { color: C.light }, rx: 8 });
    s.addShape(prs.ShapeType.rect, { x, y, w: 0.55, h: 1.25, fill: { color }, line: { color }, rx: 8 });
    s.addText(n, { x, y, w: 0.55, h: 1.25, fontSize: 13, bold: true, color: C.white, align: 'center', valign: 'middle' });
    s.addText(title, { x: x + 0.65, y: y + 0.1, w: 3.8, h: 0.38, fontSize: 11, bold: true, color: C.dark });
    s.addText(desc, { x: x + 0.65, y: y + 0.5, w: 3.8, h: 0.65, fontSize: 9, color: C.mid });
  });
}

// ── 投影片 11：結語 ───────────────────────────────────────────────────────
function addClosing(prs) {
  const s = prs.addSlide();
  s.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: C.dark }, line: { color: C.dark } });
  s.addShape(prs.ShapeType.rect, { x: 0, y: 2.8, w: '100%', h: 0.06, fill: { color: C.accent }, line: { color: C.accent } });

  s.addText('謝謝評審老師', { x: 1, y: 0.6, w: 8, h: 1.2, fontSize: 48, bold: true, color: C.white, align: 'center' });
  s.addText('🤖  🏫  💚', { x: 1, y: 1.8, w: 8, h: 0.6, fontSize: 28, align: 'center', color: C.white });

  s.addText('三個 App 共同解決校園三大問題：清潔效率、服務配送、心理關懷', {
    x: 1, y: 3.0, w: 8, h: 0.4, fontSize: 12, color: 'AABBDD', align: 'center',
  });

  const links = ['App 1：板擦機器人', 'App 2：服務機器人', 'App 3：心靈守護者'];
  links.forEach((label, i) => {
    s.addShape(prs.ShapeType.rect, { x: 1 + i * 2.8, y: 3.7, w: 2.4, h: 0.6, fill: { color: [C.app1, C.app2, C.app3][i] }, line: { color: [C.app1, C.app2, C.app3][i] }, rx: 6 });
    s.addText(label, { x: 1 + i * 2.8, y: 3.7, w: 2.4, h: 0.6, fontSize: 10, bold: true, color: C.white, align: 'center', valign: 'middle' });
  });

  s.addText('佐證素材（Draw.io / Scratch 藍圖）：docs/competition/', {
    x: 1, y: 5.3, w: 8, h: 0.3, fontSize: 9, color: '667788', align: 'center',
  });
}

// ── 主程式 ────────────────────────────────────────────────────────────────
async function main() {
  const prs = new PptxGenJS();
  prs.layout = 'LAYOUT_WIDE';  // 16:9

  addCover(prs);
  addSystemArch(prs);
  addApp1Overview(prs);
  addApp1StateDiagram(prs);
  addApp1Scratch(prs);
  addApp2Overview(prs);
  addApp2Scratch(prs);
  addApp3Overview(prs);
  addApp3Scratch(prs);
  addLearning(prs);
  addClosing(prs);

  const outPath = path.join(__dirname, '競賽學習歷程簡報.pptx');
  await prs.writeFile({ fileName: outPath });
  console.log(`✅ PPT 生成完成：${outPath}`);
  console.log(`   共 11 張投影片`);
}

main().catch(console.error);
