/**
 * Generate Video — Free-taste gate test (rewritten 2026-07-08)
 *
 * The free "taste" model replaced the hard Pro-gate: non-Pro users get 10
 * LIFETIME free renders (each watermarked), then the render is blocked and the
 * shared upgrade prompt appears. Pro users are unlimited and unmarked.
 *
 * This test verifies, for a NON-PRO user, WITHOUT ever running a real render:
 *   1. With some credits used (seeded 3/10) the dialog shows the
 *      "Free preview — 3 of 10 videos used" counter.
 *   2. With the allowance spent (seeded 10/10) the dialog shows the
 *      "used all 10 free videos" copy, the primary button becomes
 *      "Upgrade to Pro", and clicking it shows the upgrade prompt and does
 *      NOT start a render.
 *
 * Follows the electron-test.js patterns: launch Electron, find the main
 * window, navigate to /app, drive the UI, screenshot every step, write a
 * structured report.json / report.md. Exits non-zero on failure.
 *
 * NON-DESTRUCTIVE: removes only the (non-secret) tier-id / tier-cache keys to
 * force a non-Pro tier and sets the free-video counter. It NEVER touches the
 * user's apiKey_* BYOK keys, and it restores the free-video counter on exit.
 */

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'video-progating');
fs.mkdirSync(OUT_DIR, { recursive: true });

const FREE_KEY = 'idiampro:video-free-used';

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
  try {
    await page.screenshot({ path: file });
  } catch { /* ignore */ }
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
      } catch { /* window not ready */ }
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
  try {
    await ready.first().waitFor({ state: 'visible', timeout: 60000 });
  } catch {
    await page.waitForTimeout(5000);
  }
  await page.waitForTimeout(1500);
}

async function closeApp() {
  if (!electronApp) return;
  await Promise.race([
    electronApp.close().catch(() => {}),
    new Promise((r) => setTimeout(r, 5000)),
  ]);
}

// Seed the lifetime free-video counter (and force non-Pro) via localStorage.
async function seedFreeUsed(n) {
  await page.evaluate(({ key, val }) => {
    try {
      localStorage.removeItem('idiampro-tier-id');
      localStorage.removeItem('idiampro-tier-cache');
      localStorage.setItem(key, String(val));
    } catch { /* ignore */ }
  }, { key: FREE_KEY, val: n });
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
  const dialogTitle = page.locator('text="Generate Video"');
  await dialogTitle.first().waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(600);
}

async function closeVideoDialog() {
  const closeBtn = page.getByRole('button', { name: 'Close', exact: true });
  if (await closeBtn.count() > 0) {
    await closeBtn.first().click({ force: true }).catch(() => {});
  } else {
    await page.keyboard.press('Escape').catch(() => {});
  }
  await page.waitForTimeout(600);
}

async function run() {
  const report = { suite: 'video-free-taste', startedAt: new Date().toISOString(), steps: [], passed: false };
  const step = (msg) => { report.steps.push(msg); console.log('  ' + msg); };

  try {
    await launchApp();
    step('App launched at ' + page.url());
    await shot('app-loaded');

    // Open an outline with content so the chapter yields slides.
    const welcome = page.locator('button:has-text("Welcome Outline"), button:has-text("Welcome")');
    if (await welcome.count() > 0) {
      await welcome.first().click({ force: true });
      await page.waitForTimeout(2000);
      step('Opened Welcome Outline');
    } else {
      step('Welcome Outline not found — using active outline');
    }
    await shot('outline-loaded');

    const sel = await selectChapterWithChildren();
    step('Selected node ' + sel);
    await shot('node-selected');

    // ---- Case 1: 3 of 10 used -> counter shows partial allowance ----
    await seedFreeUsed(3);
    step('Seeded free-video counter to 3/10 (non-Pro forced)');
    await openVideoDialog();
    step('Opened Generate Video dialog (3/10 state)');

    const partialCounter = page.locator('text=/3 of 10 videos used/i');
    const partialVisible = await partialCounter.count() > 0 && await partialCounter.first().isVisible();
    await shot('counter-3-of-10');
    if (!partialVisible) throw new Error('Expected "3 of 10 videos used" counter was not visible');
    step('PASS: "Free preview — 3 of 10 videos used" counter shown');

    // Generate button should be a normal render button here (NOT clicked — we
    // must not run a real render). Just confirm it is present and enabled.
    const genBtn3 = page.getByRole('button', { name: 'Generate', exact: true });
    const gen3Present = await genBtn3.count() > 0 && await genBtn3.first().isVisible();
    step(gen3Present ? 'Generate button present in credits-remaining state (not clicked)' : 'Generate button not visible (empty chapter)');

    await closeVideoDialog();
    step('Closed dialog');

    // ---- Case 2: 10 of 10 used -> exhausted -> upgrade, no render ----
    await seedFreeUsed(10);
    step('Seeded free-video counter to 10/10 (exhausted)');
    await openVideoDialog();
    step('Reopened Generate Video dialog (10/10 state)');

    const exhaustedCopy = page.locator('text=/used all 10 free videos/i');
    const exhaustedVisible = await exhaustedCopy.count() > 0 && await exhaustedCopy.first().isVisible();
    await shot('counter-exhausted');
    if (!exhaustedVisible) throw new Error('Expected "used all 10 free videos" copy was not visible');
    step('PASS: exhausted copy shown');

    // The primary button should now be "Upgrade to Pro".
    const upgradeBtn = page.getByRole('button', { name: 'Upgrade to Pro', exact: true });
    const upgradeBtnVisible = await upgradeBtn.count() > 0 && await upgradeBtn.first().isVisible();
    if (!upgradeBtnVisible) throw new Error('Primary button did not switch to "Upgrade to Pro" when allowance spent');
    step('PASS: primary button is "Upgrade to Pro"');

    // Confirm there is NO plain "Generate" button in the exhausted state.
    const genBtnExhausted = page.getByRole('button', { name: 'Generate', exact: true });
    if (await genBtnExhausted.count() > 0 && await genBtnExhausted.first().isVisible()) {
      throw new Error('A "Generate" button is still shown when the free allowance is spent');
    }

    // Click "Upgrade to Pro" -> upgrade prompt shows, no render starts.
    await upgradeBtn.first().scrollIntoViewIfNeeded().catch(() => {});
    await upgradeBtn.first().evaluate((el) => el.click());
    await page.waitForTimeout(1200);
    await shot('after-upgrade-click');

    const upgradePrompt = page.locator('text=/upgrade to pro for unlimited videos/i');
    const promptVisible = await upgradePrompt.count() > 0 && await upgradePrompt.first().isVisible();

    const renderingLabel = page.locator('text=/Rendering/i');
    const doneLabel = page.locator('text=/Your video is ready/i');
    const renderStarted =
      (await renderingLabel.count() > 0 && await renderingLabel.first().isVisible()) ||
      (await doneLabel.count() > 0 && await doneLabel.first().isVisible());

    if (renderStarted) throw new Error('A render STARTED when the free allowance was spent — gate failed');
    if (!promptVisible) throw new Error('Upgrade prompt did not appear after clicking "Upgrade to Pro"');
    step('PASS: upgrade prompt shown, no render started');

    report.passed = true;
    return report;
  } catch (err) {
    report.error = err.message;
    step('FAILED: ' + err.message);
    try { await shot('failure'); } catch { /* ignore */ }
    return report;
  } finally {
    // Restore the free-video counter to 0 so the test leaves no residue.
    try { await page.evaluate((key) => { try { localStorage.setItem(key, '0'); } catch {} }, FREE_KEY); } catch { /* ignore */ }
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    const md = [
      `# Generate Video — Free-taste gate test`,
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
  console.log(`\n=== video-free-taste: ${r.passed ? 'PASS' : 'FAIL'} ===`);
  process.exit(r.passed ? 0 : 1);
});
