/**
 * Developer "Simulate free (non-Pro) user" toggle — end-to-end test.
 *
 * Verifies, in the dev build, that:
 *   1. As a (seeded) Pro user the Generate Video dialog shows NO free counter.
 *   2. Settings shows an amber "Developer" section (owner-only) with the
 *      "Simulate free (non-Pro) user" toggle.
 *   3. Flipping the toggle ON makes the always-visible "Simulating: Free user"
 *      indicator chip appear.
 *   4. Reopening Generate Video now shows the FREE experience — the
 *      "0 of 10 videos used" free-preview counter — where before it didn't.
 *
 * Follows tests/video-progating-test.js patterns: launch Electron, find the
 * main window, drive the UI, screenshot every step, write report.json/md.
 *
 * NON-DESTRUCTIVE: only touches the non-secret tier-id / tier-cache /
 * video-free / dev-simulate-free localStorage keys, and clears them on exit.
 * Never touches the user's apiKey_* BYOK keys.
 */

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'dev-simulate-free');
fs.mkdirSync(OUT_DIR, { recursive: true });

const SIM_KEY = 'idiampro:dev-simulate-free';
const FREE_KEY = 'idiampro:video-free-used';
const TIER_KEY = 'idiampro-tier-id';
const TIER_CACHE_KEY = 'idiampro-tier-cache';

let electronApp;
let page;
let shotN = 0;

async function refocusTerminal() {
  try {
    require('child_process').execSync(
      `osascript -e 'tell application "Terminal" to activate'`,
      { stdio: 'ignore' },
    );
  } catch { /* cosmetic only */ }
}

async function shot(name) {
  shotN += 1;
  const file = path.join(OUT_DIR, `${String(shotN).padStart(2, '0')}-${name}.png`);
  try { await page.screenshot({ path: file }); } catch { /* ignore */ }
  await refocusTerminal();
  return file;
}

async function findMainWindow(app, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    for (const win of app.windows()) {
      try {
        const url = win.url();
        if (url.startsWith('devtools://')) continue;
        if (url.includes('localhost:9002')) return win;
      } catch { /* not ready */ }
    }
    await new Promise((r) => setTimeout(r, 1000));
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
  try {
    await electronApp.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      if (w) { w.setSize(1400, 1200); w.center(); }
    });
  } catch { /* best-effort */ }
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  if (!page.url().includes('/app')) {
    await page.evaluate(() => { window.location.href = '/app'; });
    await page.waitForLoadState('domcontentloaded');
  }
  const ready = page.locator('button:has-text("New Outline"), li[role="treeitem"]');
  try { await ready.first().waitFor({ state: 'visible', timeout: 60000 }); }
  catch { await page.waitForTimeout(5000); }
  await page.waitForTimeout(1500);
}

async function closeApp() {
  if (!electronApp) return;
  await Promise.race([
    electronApp.close().catch(() => {}),
    new Promise((r) => setTimeout(r, 5000)),
  ]);
}

// Seed a clean starting state: Pro tier, 0 free videos used, simulation OFF.
async function seedProUser() {
  await page.evaluate(({ tierKey, cacheKey, freeKey, simKey }) => {
    try {
      localStorage.setItem(tierKey, 'pro');
      localStorage.removeItem(cacheKey);
      localStorage.setItem(freeKey, '0');
      localStorage.removeItem(simKey);
    } catch { /* ignore */ }
  }, { tierKey: TIER_KEY, cacheKey: TIER_CACHE_KEY, freeKey: FREE_KEY, simKey: SIM_KEY });
}

async function selectChapterWithChildren() {
  const treeitems = page.locator('li[role="treeitem"]');
  const itemCount = await treeitems.count();
  if (itemCount === 0) throw new Error('No outline nodes to select');
  for (let i = 0; i < Math.min(itemCount, 8); i++) {
    const item = treeitems.nth(i);
    const expanded = await item.getAttribute('aria-expanded');
    if (expanded !== null) {
      await item.locator('div').first().click({ force: true });
      await page.waitForTimeout(800);
      return `#${i} (has children)`;
    }
  }
  await treeitems.first().locator('div').first().click({ force: true });
  await page.waitForTimeout(800);
  return 'first (fallback)';
}

async function openVideoDialog() {
  const exportBtn = page.locator('[aria-label="Export — send your outline data out"]');
  await exportBtn.first().click({ force: true });
  await page.waitForTimeout(600);
  const genVideoItem = page.locator('[role="menuitem"]:has-text("Generate Video")');
  await genVideoItem.first().waitFor({ state: 'visible', timeout: 5000 });
  await genVideoItem.first().click({ force: true });
  await page.locator('text="Generate Video"').first().waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(600);
}

async function closeDialog() {
  const closeBtn = page.getByRole('button', { name: 'Close', exact: true });
  if (await closeBtn.count() > 0) await closeBtn.first().click({ force: true }).catch(() => {});
  else await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(600);
}

async function run() {
  const report = { suite: 'dev-simulate-free', startedAt: new Date().toISOString(), steps: [], passed: false };
  const step = (m) => { report.steps.push(m); console.log('  ' + m); };

  try {
    await launchApp();
    step('App launched at ' + page.url());

    const welcome = page.locator('button:has-text("Welcome Outline"), button:has-text("Welcome")');
    if (await welcome.count() > 0) {
      await welcome.first().click({ force: true });
      await page.waitForTimeout(2000);
      step('Opened Welcome Outline');
    }
    const sel = await selectChapterWithChildren();
    step('Selected node ' + sel);

    // ---- Baseline: Pro user, no free counter ----
    await seedProUser();
    step('Seeded Pro tier, simulation OFF');
    await openVideoDialog();
    const counterBefore = page.locator('text=/of 10 videos used/i');
    const shownBefore = await counterBefore.count() > 0 && await counterBefore.first().isVisible();
    await shot('01-video-pro-no-counter');
    if (shownBefore) throw new Error('Free counter unexpectedly visible as a Pro user (before simulation)');
    step('PASS: as Pro, no free counter shown');
    await closeDialog();

    // ---- Open Settings -> Developer section ----
    const settingsTrigger = page.locator('[data-settings-trigger], [aria-label="Settings"]');
    await settingsTrigger.first().click({ force: true });
    await page.waitForTimeout(800);
    await shot('02-settings-open');

    const devNav = page.locator('[data-testid="settings-nav-developer"]');
    const devNavVisible = await devNav.count() > 0 && await devNav.first().isVisible();
    if (!devNavVisible) throw new Error('Developer nav entry not visible in Settings (dev build)');
    await devNav.first().click({ force: true });
    await page.waitForTimeout(500);
    await shot('03-developer-section');

    const toggle = page.locator('[data-testid="dev-simulate-free-toggle"]');
    if (await toggle.count() === 0) throw new Error('Simulate-free toggle not found');
    step('PASS: amber Developer section + toggle present');

    // ---- Flip simulation ON ----
    await toggle.first().click({ force: true });
    await page.waitForTimeout(700);
    await shot('04-toggle-on');

    const indicator = page.locator('[data-testid="dev-simulate-free-indicator"]');
    const indicatorVisible = await indicator.count() > 0 && await indicator.first().isVisible();
    if (!indicatorVisible) throw new Error('"Simulating: Free user" indicator chip did not appear');
    step('PASS: active-simulation indicator chip visible');

    await closeDialog();

    // ---- Reopen video: free experience now shows ----
    await openVideoDialog();
    const counterAfter = page.locator('text=/0 of 10 videos used/i');
    const shownAfter = await counterAfter.count() > 0 && await counterAfter.first().isVisible();
    await shot('05-video-free-counter');
    if (!shownAfter) throw new Error('Free "0 of 10 videos used" counter did NOT appear after simulating free');
    step('PASS: free experience now shows (0 of 10 videos used)');
    await closeDialog();

    report.passed = true;
    return report;
  } catch (err) {
    report.error = err.message;
    step('FAILED: ' + err.message);
    try { await shot('failure'); } catch { /* ignore */ }
    return report;
  } finally {
    // Clean up all non-secret keys we touched.
    try {
      await page.evaluate(({ simKey, tierKey, cacheKey, freeKey }) => {
        try {
          localStorage.removeItem(simKey);
          localStorage.removeItem(tierKey);
          localStorage.removeItem(cacheKey);
          localStorage.setItem(freeKey, '0');
        } catch { /* ignore */ }
      }, { simKey: SIM_KEY, tierKey: TIER_KEY, cacheKey: TIER_CACHE_KEY, freeKey: FREE_KEY });
    } catch { /* ignore */ }
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    const md = [
      `# Developer "Simulate free user" toggle test`,
      ``,
      `**Result:** ${report.passed ? 'PASS' : 'FAIL'}`,
      report.error ? `**Error:** ${report.error}` : '',
      ``,
      `## Steps`,
      ...report.steps.map((s) => `- ${s}`),
    ].filter(Boolean).join('\n');
    fs.writeFileSync(path.join(OUT_DIR, 'report.md'), md);
    await closeApp();
    await refocusTerminal();
  }
}

run().then((r) => {
  console.log(`\n=== dev-simulate-free: ${r.passed ? 'PASS' : 'FAIL'} ===`);
  process.exit(r.passed ? 0 : 1);
});
