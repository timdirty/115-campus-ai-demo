import {spawn} from 'node:child_process';
import net from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';

const appDir = process.cwd();
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const demoProgress = {
  whiteboard: true,
  teacher: true,
  robot: true,
  library: true,
  chat: true,
  review: true,
};

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === 'object' && address?.port) resolve(address.port);
        else reject(new Error('Unable to allocate a local port'));
      });
    });
  });
}

function spawnLogged(label, command, args, env) {
  const child = spawn(command, args, {
    cwd: appDir,
    env: {...process.env, ...env},
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const lines = [];
  const remember = (chunk) => {
    for (const line of String(chunk).split(/\r?\n/).filter(Boolean)) {
      lines.push(`[${label}] ${line}`);
      if (lines.length > 80) lines.shift();
    }
  };
  child.stdout.on('data', remember);
  child.stderr.on('data', remember);
  child.on('exit', (code, signal) => {
    if (code !== 0 && signal !== 'SIGINT') remember(`exited with code=${code} signal=${signal ?? ''}`);
  });
  return {child, lines};
}

async function waitForOk(url, label, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(250);
  }
  throw new Error(`${label} did not become ready at ${url}: ${lastError}`);
}

async function resetBridgeData(bridgeUrl) {
  const response = await fetch(`${bridgeUrl}/api/ops/reset`, {method: 'POST'});
  if (!response.ok) {
    throw new Error(`Unable to reset demo data: ${response.status} ${response.statusText}`);
  }
}

async function stopProcess(child) {
  if (!child || child.killed) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill('SIGINT');
  await Promise.race([
    exited,
    delay(2000).then(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }),
  ]);
}

async function runDesktopFlow(baseUrl) {
  const browser = await chromium.launch({headless: true});
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const log = [];
  const step = async (name, fn) => {
    await fn();
    log.push(name);
  };

  try {
    await page.addInitScript(() => {
      localStorage.setItem('tour-app1:v1', 'done');
      localStorage.setItem('app1:practiceCardCollapsed', 'false');
      localStorage.removeItem('app1:teacherTools');
      sessionStorage.clear();
    });

    await step('open whiteboard', async () => {
      await page.goto(`${baseUrl}#whiteboard`, {waitUntil: 'networkidle'});
      await page.getByRole('button', {name: /一鍵示範/}).first().waitFor({state: 'visible', timeout: 15000});
      await page.locator('[data-demo-flow-primary="true"]').waitFor({state: 'visible', timeout: 15000});
    });

    await step('desktop side nav stays clear', async () => {
      const clearance = await page.evaluate(() => {
        const sideNav = document.querySelector('[data-demo-side-nav="true"]');
        const stageCard = document.querySelector('[data-demo-stage-card="true"]');
        if (!sideNav || !stageCard) return null;
        const nav = sideNav.getBoundingClientRect();
        const card = stageCard.getBoundingClientRect();
        const verticallyOverlaps = nav.bottom > card.top && nav.top < card.bottom;
        const horizontallyOverlaps = nav.right > card.left && nav.left < card.right;
        return {
          navRight: Math.round(nav.right),
          cardLeft: Math.round(card.left),
          overlaps: verticallyOverlaps && horizontallyOverlaps,
        };
      });
      if (!clearance) throw new Error('Desktop side navigation clearance targets are missing');
      if (clearance.overlaps) {
        throw new Error(`Desktop side navigation overlaps student card: ${JSON.stringify(clearance)}`);
      }
    });

    await step('run one-click demo from top rail', async () => {
      await page.locator('[data-demo-flow-primary="true"]').click();
      await page.getByText('示範白板已建立並保存').waitFor({timeout: 20000});
    });

    await step('single reset tap is harmless', async () => {
      await page.locator('[data-demo-reset-button="true"]').click();
      await page.getByText('再按一次重置，才會清空展示資料').waitFor({timeout: 5000});
      const stillHasWhiteboard = await page.evaluate(() => {
        const raw = sessionStorage.getItem('app1:demo-progress:v1');
        return raw ? JSON.parse(raw).whiteboard === true : false;
      });
      if (!stillHasWhiteboard) throw new Error('Single reset tap cleared demo progress');
    });

    await step('teacher sends robot task from top rail', async () => {
      await page.locator('[data-demo-flow-primary="true"]').click();
      await page.locator('button[data-demo-primary="teacher"]').waitFor({state: 'visible', timeout: 15000});
      await page.waitForFunction(() => {
        const button = document.querySelector('button[data-demo-primary="teacher"]');
        return button && !button.disabled;
      }, null, {timeout: 15000});
      await page.locator('[data-demo-flow-primary="true"]').click();
      await page.getByText(/機器人任務已送出|展示模式已完成/).first().waitFor({timeout: 20000});
    });

    await step('robot tab visible from top rail', async () => {
      await page.locator('[data-demo-flow-primary="true"]').click();
      await page.getByText('板擦任務台').waitFor({timeout: 15000});
    });

    await step('library closes evidence loop from top rail', async () => {
      await page.locator('[data-demo-flow-primary="true"]').click();
      await page.getByRole('heading', {name: '課堂紀錄本'}).waitFor({timeout: 15000});
      await page.getByText('最新紀錄已保存').waitFor({timeout: 15000});
      await page.locator('button[data-demo-primary="library"]').waitFor({state: 'visible', timeout: 15000});
    });

    await step('chat answers student prompt from top rail', async () => {
      await page.locator('[data-demo-flow-primary="true"]').click();
      await page.getByRole('heading', {name: 'AI 小老師'}).waitFor({timeout: 15000});
      await page.locator('button[data-demo-primary="chat"]').waitFor({state: 'visible', timeout: 15000});
      await page.locator('[data-demo-flow-primary="true"]').click();
      await page.waitForFunction(() => {
        const raw = sessionStorage.getItem('app1:demo-progress:v1');
        return raw && JSON.parse(raw).chat === true;
      }, null, {timeout: 20000});
    });

    await step('review generates quiz from top rail', async () => {
      await page.locator('[data-demo-flow-primary="true"]').click();
      await page.locator('button[data-demo-primary="review"]').waitFor({state: 'visible', timeout: 15000});
      await page.waitForFunction(() => {
        const button = document.querySelector('button[data-demo-primary="review"]');
        return button && !button.disabled;
      }, null, {timeout: 15000});
      await page.locator('[data-demo-flow-primary="true"]').click();
      await page.waitForFunction(() => {
        const raw = sessionStorage.getItem('app1:demo-progress:v1');
        return raw && JSON.parse(raw).review === true;
      }, null, {timeout: 20000});
    });

    const result = await page.evaluate(() => {
      const progressRaw = sessionStorage.getItem('app1:demo-progress:v1');
      const progress = progressRaw ? JSON.parse(progressRaw) : null;
      return {
        hash: location.hash,
        progress,
        allProgressDone: Boolean(progress) && Object.values(progress).every(Boolean),
        bodyHasNaN: document.body.innerText.includes('NaN'),
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        banner: document.querySelector('[role="status"]')?.textContent?.trim() ?? '',
        teacherToolVisible: Boolean(document.querySelector('[data-teacher-tool="issue-reporter"]')),
        settingsVisible: Boolean(document.querySelector('[data-teacher-tool="settings-button"]')),
      };
    });

    if (pageErrors.length) throw new Error(`Page error: ${pageErrors.join(' | ')}`);
    if (!result.allProgressDone) throw new Error(`Demo progress incomplete: ${JSON.stringify(result.progress)}`);
    if (result.bodyHasNaN) throw new Error('Page rendered NaN text');
    if (result.scrollWidth > result.clientWidth + 8) {
      throw new Error(`Horizontal overflow: ${result.scrollWidth} > ${result.clientWidth}`);
    }
    if (/重新連線中|請稍候/.test(result.banner)) {
      throw new Error(`Student-facing hardware banner still sounds blocked: ${result.banner}`);
    }
    if (result.teacherToolVisible) {
      throw new Error('Teacher-only issue reporter is visible in student demo mode');
    }
    if (result.settingsVisible) {
      throw new Error('Teacher-only settings button is visible in student demo mode');
    }

    return {log, result};
  } finally {
    await browser.close();
  }
}

async function runMobileSweep(baseUrl) {
  const browser = await chromium.launch({headless: true});
  const page = await browser.newPage({viewport: {width: 390, height: 844}, isMobile: true});
  const tabs = ['whiteboard', 'teacher', 'robot', 'library', 'chat', 'review'];
  const checks = [];

  try {
    await page.addInitScript((progress) => {
      localStorage.setItem('tour-app1:v1', 'done');
      localStorage.setItem('app1:practiceCardCollapsed', 'false');
      localStorage.removeItem('app1:teacherTools');
      sessionStorage.setItem('app1:demo-progress:v1', JSON.stringify(progress));
    }, demoProgress);

    for (const tab of tabs) {
      await page.goto(`${baseUrl}#${tab}`, {waitUntil: 'networkidle'});
      await page.waitForTimeout(300);
      const result = await page.evaluate((tabName) => {
        const overflowItems = [...document.querySelectorAll('body *')]
          .map((el) => {
            const rect = el.getBoundingClientRect();
            return {
              text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50),
              left: rect.left,
              right: rect.right,
              width: rect.width,
            };
          })
          .filter((item) => item.width > 0 && (item.left < -8 || item.right > document.documentElement.clientWidth + 8))
          .slice(0, 5);

        return {
          tab: tabName,
          hash: location.hash,
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasNaN: document.body.innerText.includes('NaN'),
          teacherToolVisible: Boolean(document.querySelector('[data-teacher-tool="issue-reporter"]')),
          settingsVisible: Boolean(document.querySelector('[data-teacher-tool="settings-button"]')),
          overflowItems,
        };
      }, tab);

      if (result.hasNaN || result.teacherToolVisible || result.settingsVisible || result.scrollWidth > result.clientWidth + 8 || result.overflowItems.length > 0) {
        throw new Error(`Mobile layout issue on ${tab}: ${JSON.stringify(result)}`);
      }
      checks.push(result);
    }

    return checks;
  } finally {
    await browser.close();
  }
}

async function runColdStartRecovery(baseUrl) {
  const browser = await chromium.launch({headless: true});
  const page = await browser.newPage({viewport: {width: 1280, height: 860}});
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  try {
    await page.addInitScript(() => {
      localStorage.setItem('tour-app1:v1', 'done');
      localStorage.removeItem('app1:teacherTools');
      sessionStorage.clear();
    });

    await page.goto(`${baseUrl}#teacher`, {waitUntil: 'domcontentloaded'});
    await page.locator('[data-demo-flow-primary="true"]').waitFor({state: 'visible', timeout: 15000});
    await page.locator('[data-demo-flow-primary="true"]').click();
    await page.waitForFunction(() => {
      const raw = sessionStorage.getItem('app1:demo-progress:v1');
      if (!raw) return false;
      const progress = JSON.parse(raw);
      return progress.teacher === true && progress.robot === true;
    }, null, {timeout: 20000});

    const result = await page.evaluate(() => ({
      hash: location.hash,
      text: document.body.innerText.slice(0, 300),
      progress: JSON.parse(sessionStorage.getItem('app1:demo-progress:v1') ?? '{}'),
      hasNaN: document.body.innerText.includes('NaN'),
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      teacherToolVisible: Boolean(document.querySelector('[data-teacher-tool="issue-reporter"]')),
      settingsVisible: Boolean(document.querySelector('[data-teacher-tool="settings-button"]')),
    }));

    if (pageErrors.length) throw new Error(`Page error during cold-start recovery: ${pageErrors.join(' | ')}`);
    if (result.hasNaN || result.teacherToolVisible || result.settingsVisible || result.scrollWidth > result.clientWidth + 8) {
      throw new Error(`Cold-start recovery UI issue: ${JSON.stringify(result)}`);
    }
    return result;
  } finally {
    await browser.close();
  }
}

async function main() {
  const bridgePort = await getFreePort();
  const webPort = await getFreePort();
  const bridge = spawnLogged('bridge', npmBin, ['run', 'dev:bridge'], {
    BRIDGE_PORT: String(bridgePort),
    DEMO_SIMULATE_HARDWARE: '1',
    GOOGLE_API_KEY: '',
    GEMINI_API_KEY: '',
  });
  const web = spawnLogged('web', npxBin, ['vite', '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'], {
    BRIDGE_PORT: String(bridgePort),
    GOOGLE_API_KEY: '',
    GEMINI_API_KEY: '',
  });

  try {
    const bridgeUrl = `http://127.0.0.1:${bridgePort}`;
    await waitForOk(`${bridgeUrl}/api/health`, 'bridge');
    await resetBridgeData(bridgeUrl);
    await waitForOk(`http://127.0.0.1:${webPort}/`, 'web');
    const baseUrl = `http://127.0.0.1:${webPort}/`;
    const desktop = await runDesktopFlow(baseUrl);
    const mobile = await runMobileSweep(baseUrl);
    await resetBridgeData(bridgeUrl);
    const coldStartRecovery = await runColdStartRecovery(baseUrl);
    console.log(JSON.stringify({
      ok: true,
      url: baseUrl,
      bridgePort,
      webPort,
      desktop,
      mobileTabsChecked: mobile.map((item) => item.tab),
      coldStartRecovery,
    }, null, 2));
  } catch (error) {
    console.error('App1 demo readiness check failed.');
    console.error(error instanceof Error ? error.stack : String(error));
    console.error([...bridge.lines, ...web.lines].slice(-120).join('\n'));
    process.exitCode = 1;
  } finally {
    await Promise.all([stopProcess(web.child), stopProcess(bridge.child)]);
  }
}

await main();
