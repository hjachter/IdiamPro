const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { dismissWelcomeShowcase } = require('./_helpers');

// Swallow the benign teardown JS-dialog race (see electron-test.js).
process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const BASE = 'http://localhost:9002';
const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'feature-switchboard');

let electronApp;
let page;

function ensureOutDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function refocusTerminal() {
  try {
    const { execSync } = require('child_process');
    execSync(`osascript -e 'tell application "Terminal" to activate'`, { stdio: 'ignore' });
  } catch {}
}

async function findMainWindow(app, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    for (const win of app.windows()) {
      try {
        const url = win.url();
        if (url.startsWith('devtools://')) continue;
        if (url.includes('localhost:9002')) return win;
      } catch {}
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Could not find main app window');
}

async function launchApp() {
  const projectRoot = path.resolve(__dirname, '..');
  electronApp = await electron.launch({
    args: [projectRoot],
    env: { ...process.env, NODE_ENV: 'development' },
  });
  page = await findMainWindow(electronApp);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  // Navigate to /app if we landed on the marketing page.
  if (!page.url().includes('/app')) {
    await page.evaluate(() => { window.location.href = '/app'; });
    await page.waitForLoadState('domcontentloaded');
    try {
      await page.locator('button:has-text("New Outline")').waitFor({ state: 'visible', timeout: 30000 });
    } catch {
      await page.waitForTimeout(5000);
    }
  }
  return { electronApp, page };
}

async function closeApp() {
  if (!electronApp) return;
  await Promise.race([
    electronApp.close().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
}

// POST a flag update to the admin API from inside the page (dev = admin passes).
async function setFlag(body) {
  const res = await page.evaluate(async ({ base, payload }) => {
    try {
      const r = await fetch(`${base}/api/admin/feature-flags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = await r.text();
      return { ok: r.ok, status: r.status, text };
    } catch (e) {
      return { ok: false, status: 0, text: String(e) };
    }
  }, { base: BASE, payload: body });
  return res;
}

// Reload the app window and wait for the flags provider fetch to settle.
// Hop through "/" first so the whole React tree (incl. FeatureFlagsProvider)
// unmounts and remounts — a same-URL href assignment does NOT reliably force
// a remount in Electron, so the provider would keep its startup flags and the
// new override would never be re-fetched. (Same technique the onboarding suite
// uses.) This mirrors a real user relaunch/hard-reload, where flags DO refresh.
async function reloadApp() {
  await page.evaluate(() => { window.location.href = '/'; });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { window.location.href = '/app'; });
  await page.waitForLoadState('domcontentloaded');
  try {
    await page.locator('button:has-text("New Outline")').waitFor({ state: 'visible', timeout: 30000 });
  } catch {
    await page.waitForTimeout(4000);
  }
  // Generous settle time for the provider's public /api/feature-flags fetch.
  await page.waitForTimeout(2500);
}

// Close any open dropdown/menu so stale menu content isn't matched.
async function closeMenus() {
  for (let i = 0; i < 4; i++) {
    const open = await page.locator('[role="menu"],[data-state="open"][role="dialog"]').count().catch(() => 0);
    if (open === 0) break;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(200);
  }
}

// Open the Export dropdown and return whether "Generate Video" text is present.
// Presence in the opened Export menu = flag ON; absence = flag OFF.
async function exportMenuHasGenerateVideo(diag) {
  await closeMenus();

  // Find the Export toolbar button. Tooltip/title/aria-label "Export".
  const candidates = [
    'button[aria-label^="Export"]',
    'button[aria-label*="Export"]',
    'button:has(svg.lucide-book-up)',
    'button[title="Export"]',
    '[data-export-trigger]',
  ];

  let opened = false;
  for (const sel of candidates) {
    const btn = page.locator(sel).first();
    if (await btn.count().catch(() => 0)) {
      try {
        if (await btn.isVisible({ timeout: 1500 })) {
          await btn.click({ force: true });
          opened = true;
          diag.push(`Opened Export via ${sel}`);
          break;
        }
      } catch {}
    }
  }

  if (!opened) {
    // Fallback: search buttons whose tooltip content mentions Export.
    // Dump the toolbar DOM to help diagnose selector drift.
    const toolbarHtml = await page.locator('header, [role="toolbar"], .toolbar').first().innerHTML().catch(() => '(no toolbar)');
    diag.push('Export button not found via known selectors; toolbar dumped to report.');
    diag.toolbarHtml = toolbarHtml.slice(0, 4000);
    throw new Error('Could not open Export dropdown');
  }

  await page.waitForTimeout(800);

  // Menu content is rendered in a portal; search the whole page for the menu.
  const menu = page.locator('[role="menu"]');
  await menu.first().waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
  const menuText = await menu.first().innerText().catch(() => '');
  const present = /Generate Video/i.test(menuText);
  diag.push(`Export menu text length ${menuText.length}; Generate Video ${present ? 'PRESENT' : 'ABSENT'}`);
  await closeMenus();
  return present;
}

async function screenshot(name) {
  ensureOutDir();
  const p = path.join(OUT_DIR, `${name}.png`);
  try { await page.screenshot({ path: p, fullPage: true }); } catch (e) {
    console.log(`screenshot ${name} failed: ${e.message}`);
  }
  await refocusTerminal();
  return p;
}

const results = [];
function record(name, passed, info) {
  results.push({ name, passed, info });
  const status = passed ? '\x1b[32m✓ PASS\x1b[0m' : '\x1b[31m✗ FAIL\x1b[0m';
  console.log(`${status}  ${name}`);
  if (info && info.diag) info.diag.forEach(d => console.log(`    • ${d}`));
  if (info && info.error) console.log(`    Error: ${info.error}`);
}

async function run() {
  ensureOutDir();
  console.log('\n=== Feature Switchboard Verification ===\n');

  try {
    await launchApp();
    await dismissWelcomeShowcase(page);

    // STEP 1: Baseline reset — enabled:true, audience:all.
    {
      const diag = [];
      let passed = false, error;
      try {
        const r = await setFlag({ key: 'generate-video', enabled: true, audience: 'all' });
        diag.push(`Baseline POST status ${r.status}`);
        await reloadApp();
        passed = r.ok;
        if (!r.ok) error = `Baseline POST failed: ${r.text}`;
      } catch (e) { error = e.message; }
      await screenshot('01-baseline-reset');
      record('Step 1 — Baseline reset (enabled/all)', passed, { diag, error });
    }

    // STEP 2: DEFAULT ON — Generate Video present.
    {
      const diag = [];
      let passed = false, error;
      try {
        const present = await exportMenuHasGenerateVideo(diag);
        passed = present === true;
        if (!passed) error = 'Generate Video expected PRESENT but was absent';
      } catch (e) { error = e.message; }
      await screenshot('02-default-on');
      record('Step 2 — Default ON: item present', passed, { diag, error });
    }

    // STEP 3: KILL OFF — enabled:false, item absent.
    {
      const diag = [];
      let passed = false, error;
      try {
        const r = await setFlag({ key: 'generate-video', enabled: false, audience: 'all' });
        diag.push(`Kill POST status ${r.status}`);
        await reloadApp();
        const present = await exportMenuHasGenerateVideo(diag);
        passed = present === false;
        if (!passed) error = 'Generate Video expected ABSENT but was present';
      } catch (e) { error = e.message; }
      await screenshot('03-kill-off');
      record('Step 3 — Kill OFF: item absent', passed, { diag, error });
    }

    // STEP 4: BACK ON — item present again.
    {
      const diag = [];
      let passed = false, error;
      try {
        const r = await setFlag({ key: 'generate-video', enabled: true, audience: 'all' });
        diag.push(`Back-on POST status ${r.status}`);
        await reloadApp();
        const present = await exportMenuHasGenerateVideo(diag);
        passed = present === true;
        if (!passed) error = 'Generate Video expected PRESENT again but was absent';
      } catch (e) { error = e.message; }
      await screenshot('04-back-on');
      record('Step 4 — Back ON: item present again', passed, { diag, error });
    }

    // STEP 5: AUDIENCE PRO + SIMULATE FREE — free user excluded, item absent.
    {
      const diag = [];
      let passed = false, error;
      try {
        await page.evaluate(() => localStorage.setItem('idiampro:dev-simulate-free', '1'));
        diag.push('Set dev-simulate-free = 1');
        const r = await setFlag({ key: 'generate-video', enabled: true, audience: 'pro' });
        diag.push(`Pro-audience POST status ${r.status}`);
        await reloadApp();
        // Re-assert simulate-free survives (localStorage persists across reload).
        const sim = await page.evaluate(() => localStorage.getItem('idiampro:dev-simulate-free'));
        diag.push(`dev-simulate-free after reload = ${sim}`);
        const present = await exportMenuHasGenerateVideo(diag);
        passed = present === false;
        if (!passed) error = 'Free user should NOT see Pro-audience item, but it was present';
      } catch (e) { error = e.message; }
      await screenshot('05-audience-pro-simulate-free');
      // Cleanup: remove simulate-free key and restore audience:all.
      try {
        await page.evaluate(() => localStorage.removeItem('idiampro:dev-simulate-free'));
        await setFlag({ key: 'generate-video', enabled: true, audience: 'all' });
        diag.push('Cleanup: removed simulate-free, restored audience:all');
      } catch (e) { diag.push(`Cleanup warn: ${e.message}`); }
      record('Step 5 — Pro audience + simulate free: item absent', passed, { diag, error });
    }

    // STEP 6: FAIL-SAFE — public read unreachable, app survives, item still present.
    {
      const diag = [];
      let passed = false, error;
      try {
        // Ensure clean baseline before breaking the read.
        await setFlag({ key: 'generate-video', enabled: true, audience: 'all' });
        // Intercept the PUBLIC read (GET /api/feature-flags) and fail it.
        await page.route('**/api/feature-flags', route => {
          if (route.request().method() === 'GET') {
            return route.abort('failed');
          }
          return route.continue();
        });
        diag.push('Routed /api/feature-flags GET -> abort (service unreachable)');
        await reloadApp();
        // App must still load (New Outline visible is our liveness proxy).
        const alive = await page.locator('button:has-text("New Outline")').first().isVisible({ timeout: 8000 }).catch(() => false);
        diag.push(`App alive after failed flag fetch: ${alive}`);
        const present = await exportMenuHasGenerateVideo(diag);
        passed = alive && present === true;
        if (!alive) error = 'App did not load after flag service failure';
        else if (!present) error = 'Fail-safe: expected DEFAULT_FLAGS (enabled) but item absent';
      } catch (e) { error = e.message; }
      await screenshot('06-fail-safe');
      try { await page.unroute('**/api/feature-flags'); } catch {}
      record('Step 6 — Fail-safe: app survives unreachable flag service', passed, { diag, error });
    }

  } catch (e) {
    console.error('Test run crashed:', e);
    record('Test harness', false, { error: e.message });
  } finally {
    await closeApp();
  }

  // Reports.
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.length - passedCount;
  const report = {
    timestamp: new Date().toISOString(),
    platform: { platform: os.platform(), arch: os.arch(), node: process.version },
    summary: { total: results.length, passed: passedCount, failed: failedCount },
    results,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));

  const md = [
    '# Feature Switchboard Test Report',
    '',
    `**Generated:** ${new Date(report.timestamp).toLocaleString()}`,
    '',
    `- Total: ${report.summary.total}`,
    `- Passed: ${report.summary.passed}`,
    `- Failed: ${report.summary.failed}`,
    '',
    '## Steps',
    '',
    '| Step | Status |',
    '|------|--------|',
    ...results.map(r => `| ${r.name} | ${r.passed ? '✅ PASS' : '❌ FAIL'} |`),
    '',
    '## Details',
    '',
    ...results.flatMap(r => [
      `### ${r.name}`,
      `**Status:** ${r.passed ? '✅ Passed' : '❌ Failed'}`,
      ...(r.info && r.info.diag ? r.info.diag.map(d => `- ${d}`) : []),
      ...(r.info && r.info.error ? [`- **Error:** ${r.info.error}`] : []),
      '',
    ]),
  ].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), md);

  console.log(`\n=== ${passedCount}/${results.length} passed ===`);
  console.log(`Reports: test-screenshots/feature-switchboard/report.{json,md}\n`);
  await refocusTerminal();
  return failedCount;
}

run().then((failed) => process.exit(failed > 0 ? 1 : 0))
  .catch((err) => { console.error(err); process.exit(1); });
