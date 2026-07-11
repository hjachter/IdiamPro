// Second Brain FREE local keyword search test.
//
// Verifies the free, instant, local keyword search added to the Second Brain
// Dashboard: it filters saved entries by title + full content with NO AI and
// NO network request. Distinct from the paid "Ask Second Brain" (AI answer).
//
// DATA SAFETY: this test is READ-ONLY over existing Second Brain data. It ONLY
// ADDS a couple of clearly-labeled "ZZ TEST" entries via Quick Capture and then
// searches them. It never edits or deletes anything. The ZZ TEST entries are
// left in place for the user to clean up.

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { dismissWelcomeShowcase, setElectronWindowSize } = require('./_helpers');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

let electronApp;
let page;

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'second-brain-search');

// Unique keywords that cannot collide with real user content.
const KW_BANANA = 'ZZTESTBANANA';
const KW_KIWI = 'ZZTESTKIWI';

async function shot(name) {
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const p = path.join(OUT_DIR, `${name}.png`);
    await page.screenshot({ path: p, fullPage: true });
    return p;
  } catch (e) {
    console.log(`screenshot ${name} failed: ${e.message}`);
    return null;
  }
}

async function findMainWindow(app, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    for (const win of app.windows()) {
      try {
        const url = win.url();
        if (url.startsWith('devtools://')) continue;
        if (url.includes('localhost:9002')) return win;
      } catch (e) { /* not ready */ }
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
  if (!page.url().includes('/app')) {
    await page.evaluate(() => { window.location.href = '/app'; });
    await page.waitForLoadState('domcontentloaded');
    try {
      await page.locator('button:has-text("New Outline")').waitFor({ state: 'visible', timeout: 30000 });
    } catch (e) {
      await page.waitForTimeout(5000);
    }
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

// Add a labeled ZZ TEST entry via Quick Capture (Cmd+Shift+I).
async function quickCapture(text) {
  await page.keyboard.press('Meta+Shift+i');
  await page.waitForTimeout(800);
  const box = page.locator('textarea[placeholder*="Capture a thought"]');
  await box.waitFor({ state: 'visible', timeout: 5000 });
  await box.fill(text);
  await page.waitForTimeout(200);
  // Click "Save to Inbox" (Enter also works but the button is unambiguous).
  const saveBtn = page.locator('button:has-text("Save to Inbox")');
  await saveBtn.first().click();
  // Wait for the dialog to close.
  await page.waitForTimeout(1200);
  // Make sure no dialog is lingering.
  for (let i = 0; i < 4; i++) {
    const c = await page.locator('[role="dialog"]').count().catch(() => 0);
    if (c === 0) break;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
  }
}

async function run() {
  const result = { steps: [], passed: false };
  const started = Date.now();

  await launchApp();
  // Widen the window so the Second Brain (Brain) menu stays inline in the
  // action toolbar instead of collapsing into the "More" overflow.
  await setElectronWindowSize(electronApp, 1500, 950);
  await page.waitForTimeout(800);
  await dismissWelcomeShowcase(page);
  result.steps.push('App launched');
  await shot('01-app');

  // ---- Seed two clearly-labeled ZZ TEST entries -------------------------
  await quickCapture(`ZZ TEST ${KW_BANANA} a unique fruit note for search testing`);
  result.steps.push(`Captured ZZ TEST entry containing ${KW_BANANA}`);
  await quickCapture(`ZZ TEST ${KW_KIWI} a different note that must be filtered out`);
  result.steps.push(`Captured ZZ TEST entry containing ${KW_KIWI}`);
  await shot('02-after-capture');

  // ---- Open the Brain menu and confirm both items are present ----------
  const brainBtn = page.locator('[aria-label="Second Brain menu"]');
  await brainBtn.first().click({ force: true });
  await page.waitForTimeout(700);
  await shot('03-brain-menu');

  const searchItem = page.locator('[role="menuitem"]:has-text("Search Second Brain")');
  const askItem = page.locator('[role="menuitem"]:has-text("Ask Second Brain")');
  const searchCount = await searchItem.count();
  const askCount = await askItem.count();
  result.searchItemPresent = searchCount > 0;
  result.askItemPresent = askCount > 0;
  result.steps.push(`Brain menu: "Search Second Brain" present=${searchCount > 0}, "Ask Second Brain" present=${askCount > 0}`);
  if (searchCount === 0) throw new Error('"Search Second Brain" menu item not found');
  if (askCount === 0) throw new Error('"Ask Second Brain" menu item not found');

  // ---- Click the FREE Search item; Dashboard opens with search focused --
  // Start counting network requests to any /api/ endpoint from HERE, so we
  // can prove the keyword filter itself fires no AI/network call.
  const apiRequests = [];
  const onReq = (req) => {
    const u = req.url();
    if (u.includes('/api/') || u.includes('genkit') || u.includes('googleapis') || u.includes('generativelanguage')) {
      apiRequests.push(u);
    }
  };

  await searchItem.first().click();
  await page.waitForTimeout(900);
  await shot('04-dashboard-open');

  // The search box should be present (and focused).
  const searchBox = page.locator('input[placeholder*="Search your saved entries"]');
  await searchBox.waitFor({ state: 'visible', timeout: 5000 });
  result.steps.push('Dashboard opened with free local search box visible');

  // Begin monitoring network right before typing the query.
  page.on('request', onReq);

  // ---- Type the unique keyword; list must filter to JUST that entry -----
  await searchBox.click();
  await searchBox.fill(KW_BANANA);
  await page.waitForTimeout(900);
  await shot('05-filtered-banana');

  // Results region: the matching entry visible, the other hidden.
  const bodyText = await page.locator('[role="dialog"]').innerText().catch(() => '');
  const hasBanana = bodyText.includes(KW_BANANA) || /banana/i.test(bodyText);
  // The KIWI entry must NOT appear among the results.
  const kiwiVisible = /ZZTESTKIWI/i.test(bodyText);
  // Results count label like "Results (1)".
  const resultsLabel = await page.locator('[role="dialog"] :text("Results (")').first().innerText().catch(() => '');

  result.steps.push(`After typing "${KW_BANANA}": results label="${resultsLabel}", banana-visible=${hasBanana}, kiwi-visible=${kiwiVisible}`);

  // Give any (unexpected) network call a moment to fire, then stop watching.
  await page.waitForTimeout(500);
  page.off('request', onReq);
  result.apiRequestsDuringSearch = apiRequests;
  result.steps.push(`Network calls during search: ${apiRequests.length}`);

  // ---- Assertions ------------------------------------------------------
  const filteredToMatch = hasBanana && !kiwiVisible;
  const noNetwork = apiRequests.length === 0;
  const labelIsOne = /Results\s*\(\s*1\s*\)/.test(resultsLabel);

  result.filteredToMatch = filteredToMatch;
  result.noNetwork = noNetwork;
  result.labelIsOne = labelIsOne;

  await shot('06-final');

  result.passed = filteredToMatch && noNetwork && result.searchItemPresent && result.askItemPresent;
  result.durationMs = Date.now() - started;

  if (!filteredToMatch) result.error = 'Search did not filter to just the matching ZZ TEST entry';
  else if (!noNetwork) result.error = `Search fired ${apiRequests.length} network call(s) — should be zero`;

  return result;
}

(async () => {
  let report;
  try {
    report = await run();
  } catch (e) {
    report = { passed: false, error: e.message, steps: (report && report.steps) || [] };
  } finally {
    await closeApp();
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  const md = [
    '# Second Brain Free Local Search — Test Report',
    '',
    `**Result:** ${report.passed ? 'PASS ✅' : 'FAIL ❌'}`,
    report.error ? `**Error:** ${report.error}` : '',
    '',
    '## Steps',
    ...(report.steps || []).map(s => `- ${s}`),
    '',
    `- Filtered to just the match: ${report.filteredToMatch}`,
    `- No network calls during search: ${report.noNetwork}`,
    `- "Search Second Brain" menu item present: ${report.searchItemPresent}`,
    `- "Ask Second Brain" menu item present: ${report.askItemPresent}`,
  ].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), md);

  console.log(`\n=== Second Brain Search Test: ${report.passed ? 'PASS' : 'FAIL'} ===`);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.passed ? 0 : 1);
})();
