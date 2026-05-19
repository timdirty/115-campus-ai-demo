import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appDir, '../..');
const outputDir = path.join(repoRoot, 'docs/competition/assets/notion-app1');
const appUrl = process.env.APP1_CAPTURE_URL ?? 'http://127.0.0.1:3201';
const captureFiles = new Set((process.env.APP1_CAPTURE_FILES ?? '').split(',').map((file) => file.trim()).filter(Boolean));
const skipAppScreens = process.env.APP1_CAPTURE_SKIP_APP === '1';

const shell = (title, kicker, body) => `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: 1024px;
      height: 1024px;
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", Arial, sans-serif;
      color: #10211c;
      background: radial-gradient(circle at 18% 18%, #e7f4f1 0 16%, transparent 34%),
        linear-gradient(135deg, #f7fbfa 0%, #ffffff 58%, #eef7f5 100%);
    }
    .canvas {
      width: 1024px;
      height: 1024px;
      padding: 56px;
      display: flex;
      flex-direction: column;
      gap: 30px;
    }
    .kicker {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      width: fit-content;
      padding: 10px 16px;
      border-radius: 999px;
      background: #dff3ee;
      color: #1a725f;
      font-weight: 800;
      font-size: 24px;
    }
    h1 {
      margin: 12px 0 0;
      max-width: 820px;
      font-size: 54px;
      line-height: 1.12;
      letter-spacing: 0;
    }
    .sub {
      margin-top: 12px;
      max-width: 840px;
      font-size: 24px;
      line-height: 1.55;
      color: #48635b;
      font-weight: 600;
    }
    .grid { display: grid; gap: 20px; }
    .card {
      border: 2px solid rgba(22, 93, 76, 0.16);
      border-radius: 28px;
      background: rgba(255,255,255,0.82);
      box-shadow: 0 18px 46px rgba(27, 58, 51, 0.12);
      padding: 24px;
    }
    .soft {
      background: linear-gradient(180deg, #ffffff 0%, #edf8f5 100%);
    }
    .dark {
      background: linear-gradient(135deg, #0f6b57 0%, #1f8c76 100%);
      color: white;
      border-color: transparent;
      box-shadow: 0 20px 50px rgba(15, 107, 87, 0.28);
    }
    .label {
      color: #1f7a67;
      font-size: 20px;
      font-weight: 900;
    }
    .card h2, .card h3 {
      margin: 8px 0 10px;
      font-size: 30px;
      line-height: 1.22;
      letter-spacing: 0;
    }
    .card p, .card li {
      margin: 0;
      font-size: 21px;
      line-height: 1.45;
      color: #4f665f;
      font-weight: 650;
    }
    .dark p, .dark .label { color: rgba(255,255,255,0.86); }
    .pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 48px;
      padding: 8px 18px;
      border-radius: 999px;
      background: #e6f4f0;
      color: #166f5c;
      font-size: 21px;
      font-weight: 900;
      border: 1.5px solid rgba(22, 111, 92, .18);
      white-space: nowrap;
    }
    .arrow {
      align-self: center;
      color: #1d7f68;
      font-weight: 900;
      font-size: 42px;
      line-height: 1;
    }
    .node {
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      min-height: 116px;
      padding: 22px;
      border-radius: 28px;
      background: #fff;
      border: 2px solid rgba(22, 93, 76, 0.18);
      box-shadow: 0 14px 38px rgba(27, 58, 51, 0.12);
      font-size: 25px;
      line-height: 1.28;
      font-weight: 900;
      color: #143b32;
    }
    .small { font-size: 18px; color: #5f766f; font-weight: 760; }
    .stamp {
      position: absolute;
      right: 58px;
      bottom: 48px;
      color: #7a8f88;
      font-size: 17px;
      font-weight: 800;
    }
  </style>
</head>
<body>
  <main class="canvas">
    <header>
      <div class="kicker">${kicker}</div>
      <h1>${title}</h1>
    </header>
    ${body}
  </main>
</body>
</html>`;

const diagrams = {
  '01_hook.png': shell('不是只會擦白板，而是把時間與筆記都救回來', '開場痛點', `
    <section class="grid" style="grid-template-columns: 1fr 96px 1.08fr; align-items: center; flex: 1;">
      <div class="grid" style="gap: 24px;">
        <div class="card">
          <div class="label">痛點 1</div>
          <h2>擦白板吃掉上課時間</h2>
          <p>每節課 2-3 分鐘，一學期會累積成好幾節課。</p>
        </div>
        <div class="card">
          <div class="label">痛點 2</div>
          <h2>被擦掉的筆記回不來</h2>
          <p>缺課、沒抄完、需要複習的學生都失去上下文。</p>
        </div>
      </div>
      <div class="arrow">→</div>
      <div class="card dark" style="min-height: 500px; display: flex; flex-direction: column; justify-content: center;">
        <div class="label">三句價值主張</div>
        <h2 style="font-size: 36px;">AI 智慧型白板機器人</h2>
        <div class="grid" style="grid-template-columns: repeat(3, 1fr); margin-top: 20px;">
          <div class="pill" style="background: rgba(255,255,255,.16); color: #fff;">會擦</div>
          <div class="pill" style="background: rgba(255,255,255,.16); color: #fff;">會記</div>
          <div class="pill" style="background: rgba(255,255,255,.16); color: #fff;">會判斷不該擦</div>
        </div>
        <p style="margin-top: 28px;">AI 先提出建議，老師最後確認，擦除前先保存課堂紀錄。</p>
      </div>
    </section>
  `),
  '02_hardware.png': shell('硬體架構：一顆固定攝影機 + UNO R4 WiFi + 白板板擦機器人', '硬體路徑', `
    <section class="grid" style="grid-template-columns: 1fr 80px 1fr 80px 1fr; align-items: center; margin-top: 12px;">
      <div class="node">教室後方<br/>固定攝影機<br/><span class="small">拍整面白板 / 監看位置</span></div>
      <div class="arrow">→</div>
      <div class="node">Web App + AI<br/><span class="small">分析區塊 / 老師確認</span></div>
      <div class="arrow">→</div>
      <div class="node">Serial Bridge<br/>UNO R4 WiFi<br/><span class="small">轉成控制指令</span></div>
    </section>
    <section class="grid" style="grid-template-columns: 1fr 80px 1fr; align-items: center; margin-top: 8px;">
      <div></div><div class="arrow" style="transform: rotate(90deg);">→</div><div></div>
      <div class="card soft">
        <div class="label">定位原則</div>
        <h2>白板只切左區 / 右區</h2>
        <p>現場展示優先穩定，不宣稱全自動高精度視覺定位。</p>
      </div>
      <div class="arrow">→</div>
      <div class="card dark">
        <div class="label">實體端</div>
        <h2>圓形吸附式板擦機器人</h2>
        <p>接收擦除任務，在白板表面執行指定區塊。</p>
      </div>
    </section>
    <section class="card" style="margin-top: 8px;">
      <div class="label">三層保護</div>
      <div class="grid" style="grid-template-columns: repeat(3, 1fr); margin-top: 12px;">
        <div class="pill">APP 暫停</div>
        <div class="pill">Watchdog 斷電</div>
        <div class="pill">R4 RESET 急停</div>
      </div>
    </section>
  `),
  '03_software_thinking.png': shell('軟體決策：AI 只提案，老師按下確認才會擦', '人在迴路', `
    <section class="grid" style="grid-template-columns: 1fr 70px 1.05fr; align-items: center; margin-top: 10px;">
      <div class="card soft" style="min-height: 545px;">
        <div class="label">擦除前先問三件事</div>
        <div class="grid" style="gap: 18px; margin-top: 20px;">
          <div class="node" style="min-height: 96px;">1. 學生大多抄完了嗎？</div>
          <div class="node" style="min-height: 96px;">2. 清掉會打斷老師思路嗎？</div>
          <div class="node" style="min-height: 96px;">3. 老師已經確認了嗎？</div>
        </div>
      </div>
      <div class="arrow">→</div>
      <div class="grid" style="gap: 20px;">
        <div class="card">
          <div class="label">AI 建議</div>
          <h2>保留左區，優先清理右區</h2>
          <p>建議來自白板內容與課堂狀態，不直接控制機器人。</p>
        </div>
        <div class="card dark">
          <div class="label">老師確認</div>
          <h2>保存決策後才送出任務</h2>
          <p>老師可以一鍵改掉 AI 判斷，避免誤擦重要板書。</p>
        </div>
        <div class="card">
          <div class="label">機器人執行</div>
          <h2>接收明確區塊任務</h2>
          <p>展示模式也會保留 log，真機接上後走同一路徑。</p>
        </div>
      </div>
    </section>
  `),
  '08_loop_closure.png': shell('教學閉環：擦掉之前，先把學習內容留下來', '完整閉環', `
    <section style="position: relative; flex: 1;">
      <div class="node" style="position:absolute; left:24px; top:72px; width:270px; flex-direction:column; gap:8px;"><div>1 上課</div><span class="small">拍白板 + 老師講解</span></div>
      <div class="node" style="position:absolute; left:377px; top:26px; width:270px; flex-direction:column; gap:8px;"><div>2 AI 整理</div><span class="small">孩子看得懂的筆記</span></div>
      <div class="node" style="position:absolute; right:24px; top:72px; width:270px; flex-direction:column; gap:8px;"><div>3 老師審核</div><span class="small">保留 / 可擦</span></div>
      <div class="node" style="position:absolute; right:42px; bottom:112px; width:280px; flex-direction:column; gap:8px;"><div>4 機器人動作</div><span class="small">只擦確認區</span></div>
      <div class="node" style="position:absolute; left:377px; bottom:58px; width:270px; flex-direction:column; gap:8px;"><div>5 紀錄本</div><span class="small">小老師 / 學習單</span></div>
      <div class="node" style="position:absolute; left:24px; bottom:112px; width:270px; flex-direction:column; gap:8px;"><div>6 學生複習</div><span class="small">缺課也能補回脈絡</span></div>
      <div style="position:absolute; inset:175px 245px; border: 14px solid #d9f0eb; border-radius: 999px;"></div>
      <div class="card dark" style="position:absolute; left:312px; top:260px; width:400px; text-align:center;">
        <div class="label">核心規則</div>
        <h2>先保存，再擦除</h2>
        <p>作品價值不是讓板擦變快，而是把教學脈絡保存下來。</p>
      </div>
    </section>
  `),
  '09_sop_overview.png': shell('攤位 SOP：三人分工、平板操作、白板展示一次到位', '現場配置', `
    <section class="card soft" style="height: 570px; position: relative; margin-top: 4px;">
      <div style="position:absolute; left:130px; top:36px; right:130px; height:128px; border:4px solid #1f7a67; border-radius:24px; background:#fff;">
        <div style="text-align:center; font-size:30px; font-weight:900; padding-top:42px;">白板：左區保留 / 右區可擦</div>
        <div class="pill" style="position:absolute; left:32px; top:34px;">板擦機器人起點</div>
      </div>
      <div style="position:absolute; right:34px; top:210px; width:170px; height:112px; border:3px solid #9ccfc4; border-radius:24px; display:flex; align-items:center; justify-content:center; text-align:center; font-weight:900; color:#1f7a67; font-size:22px; background:#fff;">後方固定<br/>攝影機</div>
      <div class="grid" style="position:absolute; left:92px; right:92px; bottom:130px; grid-template-columns: repeat(3, 1fr);">
        <div class="node" style="flex-direction:column; gap:8px;"><div>家齊</div><span class="small">白板 / 機器人</span></div>
        <div class="node dark" style="flex-direction:column; gap:8px;"><div>光希</div><span class="small" style="color:rgba(255,255,255,.82);">主講 / 轉場</span></div>
        <div class="node" style="flex-direction:column; gap:8px;"><div>靖傑</div><span class="small">平板 / APP</span></div>
      </div>
      <div style="position:absolute; left:280px; right:280px; bottom:36px; height:64px; border-radius:22px; background:#dcefe9; color:#176b59; display:flex; align-items:center; justify-content:center; font-size:25px; font-weight:900;">評審座位前方 1.5m</div>
    </section>
    <section class="grid" style="grid-template-columns: repeat(4, 1fr);">
      <div class="pill">09:47 開 APP</div>
      <div class="pill">09:50 寫示範題</div>
      <div class="pill">09:52 dry-run</div>
      <div class="pill">09:55 就定位</div>
    </section>
  `),
};

async function captureDiagram(browser, fileName, html) {
  const page = await browser.newPage({viewport: {width: 1024, height: 1024}, deviceScaleFactor: 1});
  await page.setContent(html, {waitUntil: 'load'});
  await page.screenshot({path: path.join(outputDir, fileName)});
  await page.close();
}

async function prepareAppPage(browser) {
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}, deviceScaleFactor: 1});
  await page.addInitScript(() => {
    localStorage.setItem('tour-app1:v1', 'done');
    localStorage.removeItem('app1:teacherTools');
    sessionStorage.clear();
  });
  return page;
}

async function resetServerData() {
  try {
    await fetch(`${appUrl}/api/ops/reset`, {method: 'POST'});
  } catch {
    // Public/static captures do not expose the bridge reset endpoint.
  }
}

async function captureAppScreens(browser) {
  await resetServerData();
  const page = await prepareAppPage(browser);

  await page.goto(`${appUrl}/#whiteboard`, {waitUntil: 'networkidle'});
  await page.getByRole('button', {name: /一鍵示範/}).first().click();
  await page.getByText('示範白板已建立並保存').waitFor({timeout: 12000});
  await page.screenshot({path: path.join(outputDir, '04_demo_homepage.png')});

  await page.getByRole('button', {name: /到教師看板|教師/}).first().click();
  await page.getByRole('heading', {name: /國小教師看板/}).waitFor({timeout: 12000});
  await page.screenshot({path: path.join(outputDir, '05_demo_teacher_review.png')});

  await page.locator('button[data-demo-primary="teacher"]').first().click();
  await page.getByText(/機器人任務已送出|板擦完成/).first().waitFor({timeout: 12000});
  await page.goto(`${appUrl}/#robot`, {waitUntil: 'networkidle'});
  await page.getByRole('heading', {name: /板擦任務台/}).waitFor({timeout: 12000});
  await page.locator('button[data-demo-primary="robot"]').click();
  await page.waitForTimeout(900);
  await page.screenshot({path: path.join(outputDir, '06_demo_robot_action.png')});

  await page.goto(`${appUrl}/#library`, {waitUntil: 'networkidle'});
  await page.getByRole('heading', {name: /課堂紀錄本/}).waitFor({timeout: 12000});
  await page.screenshot({path: path.join(outputDir, '07_demo_notebook.png')});

  await page.close();
}

async function main() {
  await fs.mkdir(outputDir, {recursive: true});
  const browser = await chromium.launch({headless: true});
  try {
    for (const [fileName, html] of Object.entries(diagrams)) {
      if (captureFiles.size > 0 && !captureFiles.has(fileName)) continue;
      await captureDiagram(browser, fileName, html);
    }
    if (!skipAppScreens && captureFiles.size === 0) {
      await captureAppScreens(browser);
    }
  } finally {
    await browser.close();
  }
}

await main();
