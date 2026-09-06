// Proposed-insertion review test — verifies the AI SUB-OUTLINE INSERTION is
// gated behind a visible approve-before-apply review (P1 slice 2):
//   (a) generated children are inserted PROVISIONALLY and VISIBLY marked pending
//       (green + "Pending" badge); they are NOT yet permanent
//   (b) "Discard" removes them, leaving the outline exactly as before
//   (c) "Add" commits them (marks cleared)
//   (d) After Add, Undo (⌘Z) still reverses the whole insertion
//
// Drives the REAL production provisional-insert path (beginPendingInsertion →
// pending marks → Add/Discard review) via a dev-only window seam
// (__ideamProvisionalInsert / __ideamSeedTree). This deliberately does NOT make
// an AI call: the gate MECHANICS are identical whether the batch of children
// came from the AI or the seam, so we verify the gate without spending AI
// generations. (The AI call itself is covered by the generate-outline flow;
// here we prove the approve-before-apply gate around it.)
//
// NO BACKGROUND TASKS. Foreground synchronous run only.

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { prepareApp } = require('./_helpers');

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'proposed-insert');
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

const report = { suite: 'proposed-insert', started: new Date().toISOString(), steps: [], pass: false };
function step(name, ok, extra) { report.steps.push({ name, ok, ...(extra || {}) }); console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ' ' + JSON.stringify(extra) : ''}`); }

// How many rendered outline rows carry the green "Pending" (added) badge.
async function pendingBadgeCount(page) {
  return page.locator('span:text-is("Pending")').count();
}
// Is a node with this exact visible name present in the tree?
async function nodePresent(page, name) {
  return (await page.locator(`[role="treeitem"] span:text-is("${name}")`).count()) > 0;
}
const CARD = '[aria-label="Confirm added items"]';

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

    // Seed Fruits > Citrus > Orange and select Citrus (the insert parent).
    await page.waitForFunction(() => !!(window).__ideamSeedTree, null, { timeout: 15000 });
    await page.evaluate(() => (window).__ideamSeedTree());
    await page.waitForTimeout(600);
    const beforeCitrus = await nodePresent(page, 'Citrus');
    step('seeded tree (Citrus visible, selected)', beforeCitrus, { beforeCitrus });
    await page.screenshot({ path: path.join(OUT_DIR, '1-before.png'), fullPage: true });

    // Generate a sub-outline under Citrus (provisional insert of Alpha/Beta/Gamma).
    await page.waitForFunction(() => !!(window).__ideamProvisionalInsert, null, { timeout: 15000 });
    await page.evaluate(() => (window).__ideamProvisionalInsert(['Alpha', 'Beta', 'Gamma']));

    // The review card must appear and nothing must be committed silently.
    await page.locator(`${CARD} button:has-text("Add")`).first().waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(400);
    const pendCount = await pendingBadgeCount(page);
    const provAlpha = await nodePresent(page, 'Alpha');
    const provBeta = await nodePresent(page, 'Beta');
    const provGamma = await nodePresent(page, 'Gamma');
    const headlineShown = await page.locator(`${CARD}`).getByText(/Add 3 items under .*Citrus/).first().isVisible().catch(() => false);
    step('provisional items shown, marked pending, review card up',
      pendCount >= 3 && provAlpha && provBeta && provGamma && headlineShown,
      { pendingBadges: pendCount, provAlpha, provBeta, provGamma, headlineShown });
    await page.screenshot({ path: path.join(OUT_DIR, '2-pending.png'), fullPage: true });

    // Discard → provisional items removed, marks cleared, Citrus intact.
    await page.locator(`${CARD} button:has-text("Discard")`).first().click();
    await page.waitForTimeout(600);
    const goneAlpha = !(await nodePresent(page, 'Alpha'));
    const goneBeta = !(await nodePresent(page, 'Beta'));
    const goneGamma = !(await nodePresent(page, 'Gamma'));
    const citrusIntact = await nodePresent(page, 'Citrus');
    const marksGone = (await pendingBadgeCount(page)) === 0;
    step('Discard removed provisional items, outline restored',
      goneAlpha && goneBeta && goneGamma && citrusIntact && marksGone,
      { goneAlpha, goneBeta, goneGamma, citrusIntact, marksGone });
    await page.screenshot({ path: path.join(OUT_DIR, '3-discarded.png'), fullPage: true });

    // Generate again → Add → items become permanent, pending marks cleared.
    await page.evaluate(() => (window).__ideamProvisionalInsert(['Alpha', 'Beta', 'Gamma']));
    await page.locator(`${CARD} button:has-text("Add")`).first().waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT_DIR, '4-pending-again.png'), fullPage: true });
    await page.locator(`${CARD} button:has-text("Add")`).first().click();
    await page.waitForTimeout(700);
    const keptAlpha = await nodePresent(page, 'Alpha');
    const keptBeta = await nodePresent(page, 'Beta');
    const keptGamma = await nodePresent(page, 'Gamma');
    const committedNoMarks = (await pendingBadgeCount(page)) === 0;
    const cardGone = (await page.locator(CARD).count()) === 0;
    step('Add committed items (permanent, marks cleared, card closed)',
      keptAlpha && keptBeta && keptGamma && committedNoMarks && cardGone,
      { keptAlpha, keptBeta, keptGamma, committedNoMarks, cardGone });
    await page.screenshot({ path: path.join(OUT_DIR, '5-added.png'), fullPage: true });

    // Undo → the whole insertion reverses; Citrus/Orange remain.
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
    await page.waitForTimeout(800);
    const undoAlpha = !(await nodePresent(page, 'Alpha'));
    const undoBeta = !(await nodePresent(page, 'Beta'));
    const undoGamma = !(await nodePresent(page, 'Gamma'));
    const stillCitrus = await nodePresent(page, 'Citrus');
    const stillOrange = await nodePresent(page, 'Orange');
    step('Undo reversed the approved insertion',
      undoAlpha && undoBeta && undoGamma && stillCitrus && stillOrange,
      { undoAlpha, undoBeta, undoGamma, stillCitrus, stillOrange });
    await page.screenshot({ path: path.join(OUT_DIR, '6-undone.png'), fullPage: true });

    report.pass = report.steps.every(s => s.ok);
  } catch (e) {
    report.error = String((e && e.stack) || e);
    console.error(report.error);
  } finally {
    report.finished = new Date().toISOString();
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    if (app) { await Promise.race([app.close().catch(() => {}), new Promise(r => setTimeout(r, 5000))]); }
    console.log(`\n=== proposed-insert: ${report.pass ? 'ALL PASS' : 'FAILURES'} ===`);
    process.exit(report.pass ? 0 : 1);
  }
})();
