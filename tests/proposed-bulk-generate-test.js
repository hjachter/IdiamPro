// Proposed bulk-content review test — verifies the bulk "Generate content for
// all children/descendants" action is gated behind the UNIFIED approve-before-
// apply review (P1 slice 4):
//   (a) generated content is applied PROVISIONALLY and every touched node is
//       VISIBLY marked (green "New content" badge); ONE review card lists the
//       batch with per-node keep/discard checkboxes + approve-all
//   (b) nothing commits early — "Discard" restores every node's content exactly
//   (c) unticking one node + "Add" commits ONLY the checked nodes
//   (d) after Add, Undo (⌘Z) reverses the whole approved batch
//
// Drives the REAL production provisional path (beginBulkContentSession →
// addProvisionalBulkContent → openBulkContentReview → approve/discard) via a
// dev-only window seam (__ideamProvisionalBulkContent / __ideamSeedTree /
// __ideamNodeContentByName). This deliberately does NOT make an AI call: the
// gate MECHANICS are identical whether the batch came from the AI loop or the
// seam, so we verify the gate without spending AI generations.
//
// NO BACKGROUND TASKS. Foreground synchronous run only.

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { prepareApp } = require('./_helpers');

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'proposed-bulk-generate');
fs.mkdirSync(OUT_DIR, { recursive: true });

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

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

const report = { suite: 'proposed-bulk-generate', started: new Date().toISOString(), steps: [], pass: false };
function step(name, ok, extra) { report.steps.push({ name, ok, ...(extra || {}) }); console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ' ' + JSON.stringify(extra) : ''}`); }

// How many rendered outline rows carry the green "New content" (rewrite) badge.
async function rewriteBadgeCount(page) {
  return page.locator('span:text-is("New content")').count();
}
// Read a node's stored content via the dev seam.
async function nodeContent(page, name) {
  return page.evaluate((n) => (window).__ideamNodeContentByName(n), name);
}
const CARD = '[aria-label="Review generated content"]';

(async () => {
  let app;
  try {
    const projectRoot = path.resolve(__dirname, '..');
    app = await electron.launch({ args: [projectRoot], env: { ...process.env, NODE_ENV: 'development' } });
    const page = await findMainWindow(app);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500);

    if (!page.url().includes('/app')) {
      await page.evaluate(() => { window.location.href = '/app'; });
      await page.waitForLoadState('domcontentloaded');
      try { await page.locator('button:has-text("New Outline")').waitFor({ state: 'visible', timeout: 30000 }); } catch {}
    }
    await prepareApp(page);

    // Seed Fruits > Citrus > Orange. The bulk seam fills every descendant of
    // the root (Citrus + Orange), exactly like Create Content for Descendants.
    await page.waitForFunction(() => !!(window).__ideamSeedTree, null, { timeout: 15000 });
    await page.evaluate(() => (window).__ideamSeedTree());
    await page.waitForTimeout(600);
    const emptyBefore = ((await nodeContent(page, 'Citrus')) || '') === '' && ((await nodeContent(page, 'Orange')) || '') === '';
    step('seeded tree (Citrus + Orange, empty content)', emptyBefore, { emptyBefore });
    await page.screenshot({ path: path.join(OUT_DIR, '1-before.png'), fullPage: true });

    // Run the bulk provisional generation (no AI call).
    await page.waitForFunction(() => !!(window).__ideamProvisionalBulkContent, null, { timeout: 15000 });
    await page.evaluate(() => (window).__ideamProvisionalBulkContent());

    // The single review card must appear with per-node checkboxes; content is
    // applied provisionally (visible in the data) but NOT committed.
    await page.locator(`${CARD} button:has-text("Add")`).first().waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(400);
    const badges = await rewriteBadgeCount(page);
    const citrusProvisional = String(await nodeContent(page, 'Citrus')).includes('Generated details');
    const orangeProvisional = String(await nodeContent(page, 'Orange')).includes('Generated details');
    const headlineShown = await page.locator(CARD).getByText(/Add new content to 2 items/).first().isVisible().catch(() => false);
    const checkboxCitrus = (await page.locator(`${CARD} [aria-label="Keep Citrus"]`).count()) === 1;
    const checkboxOrange = (await page.locator(`${CARD} [aria-label="Keep Orange"]`).count()) === 1;
    const checkboxAll = (await page.locator(`${CARD} [aria-label="Keep all"]`).count()) === 1;
    step('provisional content + marks + per-node checkbox review card',
      badges >= 2 && citrusProvisional && orangeProvisional && headlineShown && checkboxCitrus && checkboxOrange && checkboxAll,
      { badges, citrusProvisional, orangeProvisional, headlineShown, checkboxCitrus, checkboxOrange, checkboxAll });
    await page.screenshot({ path: path.join(OUT_DIR, '2-pending.png'), fullPage: true });

    // Discard → every node's content restored exactly, marks + card cleared.
    await page.locator(`${CARD} button:has-text("Discard")`).first().click();
    await page.waitForTimeout(600);
    const citrusRestored = ((await nodeContent(page, 'Citrus')) || '') === '';
    const orangeRestored = ((await nodeContent(page, 'Orange')) || '') === '';
    const marksGone = (await rewriteBadgeCount(page)) === 0;
    const cardGone = (await page.locator(CARD).count()) === 0;
    step('Discard restored all content, marks + card cleared',
      citrusRestored && orangeRestored && marksGone && cardGone,
      { citrusRestored, orangeRestored, marksGone, cardGone });
    await page.screenshot({ path: path.join(OUT_DIR, '3-discarded.png'), fullPage: true });

    // Run again → untick Orange → Add → ONLY Citrus keeps the new content.
    await page.evaluate(() => (window).__ideamProvisionalBulkContent());
    await page.locator(`${CARD} button:has-text("Add")`).first().waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(300);
    await page.locator(`${CARD} [aria-label="Keep Orange"]`).click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT_DIR, '4-orange-unticked.png'), fullPage: true });
    await page.locator(`${CARD} button:has-text("Add")`).first().click();
    await page.waitForTimeout(700);
    const citrusKept = String(await nodeContent(page, 'Citrus')).includes('Generated details');
    const orangeDropped = !String(await nodeContent(page, 'Orange')).includes('Generated details');
    const committedNoMarks = (await rewriteBadgeCount(page)) === 0;
    const cardClosed = (await page.locator(CARD).count()) === 0;
    step('Add committed ONLY the checked node (per-node keep/discard works)',
      citrusKept && orangeDropped && committedNoMarks && cardClosed,
      { citrusKept, orangeDropped, committedNoMarks, cardClosed });
    await page.screenshot({ path: path.join(OUT_DIR, '5-approved-partial.png'), fullPage: true });

    // Undo → the whole approved batch reverses.
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
    await page.waitForTimeout(800);
    const citrusUndone = !String((await nodeContent(page, 'Citrus')) || '').includes('Generated details');
    step('Undo reversed the approved batch', citrusUndone, { citrusUndone });
    await page.screenshot({ path: path.join(OUT_DIR, '6-undone.png'), fullPage: true });

    report.pass = report.steps.every(s => s.ok);
  } catch (e) {
    report.error = String((e && e.stack) || e);
    console.error(report.error);
  } finally {
    report.finished = new Date().toISOString();
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    if (app) { await Promise.race([app.close().catch(() => {}), new Promise(r => setTimeout(r, 5000))]); }
    console.log(`\n=== proposed-bulk-generate: ${report.pass ? 'ALL PASS' : 'FAILURES'} ===`);
    process.exit(report.pass ? 0 : 1);
  }
})();
