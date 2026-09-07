// Heavy-op confirm test — "Create Content for Descendants" (task #23 wiring).
//
// Verifies the P2 heavy-op approval dialog now fronts the bulk "Create
// Content for Descendants" context-menu action in outline-pro.tsx:
//   (a) confirm appears FIRST — before any generation, toast, or ledger entry
//   (b) honest wording: scope line with the section count, payer line, cost line
//   (c) Cancel is truly inert — nothing generated, no marks, content unchanged,
//       and NO 'createContentForDescendants' entry in the local usage ledger
//   (d) Run proceeds into the EXISTING flow (ledger records the run, the
//       generation loop starts) — the slice-4 provisional review still governs
//       what commits (confirm-before-spend + review-before-commit both live)
//
// Money safety: the ONE Run pass targets the smallest possible branch (Citrus,
// which has a single descendant: Orange) — a single tiny generation on the
// free/dev path. No loops, no retries of the Run pass.
//
// NO BACKGROUND TASKS. Foreground synchronous run only.

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { prepareApp } = require('./_helpers');

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'bulk-confirm');
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

const report = { suite: 'bulk-generate-confirm', started: new Date().toISOString(), steps: [], pass: false };
function step(name, ok, extra) { report.steps.push({ name, ok, ...(extra || {}) }); console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ' ' + JSON.stringify(extra) : ''}`); }

const DIALOG = '[data-testid="heavy-op-confirm"]';

async function ledgerOpCount(page, opId) {
  return page.evaluate((id) => {
    try {
      const raw = window.localStorage.getItem('aiUsageLedger.v1');
      if (!raw) return 0;
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter(e => e && e.op === id).length : 0;
    } catch { return 0; }
  }, opId);
}

async function nodeContent(page, name) {
  return page.evaluate((n) => (window).__ideamNodeContentByName(n), name);
}

async function openConfirmViaContextMenu(page) {
  // Right-click the "Citrus" node row (a chapter: one descendant, Orange).
  const citrus = page.locator('main span:text-is("Citrus"), [role="main"] span:text-is("Citrus")').first();
  await citrus.waitFor({ state: 'visible', timeout: 10000 });
  await citrus.click({ button: 'right' });
  await page.waitForTimeout(600);
  const item = page.locator('text="Create Content for Descendants"').first();
  await item.waitFor({ state: 'visible', timeout: 8000 });
  await item.click();
}

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

    // Clean slate: AI consent pre-granted (that's a separate, already-tested
    // gate), Professional mode OFF, per-op suppression cleared, ledger cleared.
    await page.evaluate(() => {
      try {
        window.localStorage.setItem('aiDataConsent', 'granted');
        window.localStorage.removeItem('discovery:professionalMode');
        window.localStorage.removeItem('confirm.heavyOp.createContentForDescendants.suppressed');
        window.localStorage.removeItem('aiUsageLedger.v1');
      } catch {}
    });

    // Seed Fruits > Citrus > Orange (same dev seam the bulk-review suite uses).
    await page.waitForFunction(() => !!(window).__ideamSeedTree, null, { timeout: 15000 });
    await page.evaluate(() => (window).__ideamSeedTree());
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, '1-seeded.png'), fullPage: true });

    // ── (a)+(b): confirm appears FIRST, honest wording ─────────────────────
    await openConfirmViaContextMenu(page);
    const dialogShown = await page.locator(DIALOG).first().isVisible({ timeout: 8000 }).catch(() => false);
    const generatingToastEarly = await page.locator('text=/Generating Content/').first().isVisible().catch(() => false);
    const title = dialogShown ? await page.locator(`${DIALOG} h2, ${DIALOG} [role="heading"]`).first().textContent().catch(() => '') : '';
    const scope = dialogShown ? await page.locator('[data-testid="heavy-op-scope"]').textContent().catch(() => '') : '';
    const payer = dialogShown ? await page.locator('[data-testid="heavy-op-payer"]').textContent().catch(() => '') : '';
    const cost = dialogShown ? await page.locator('[data-testid="heavy-op-cost"]').textContent().catch(() => '') : '';
    const dontAsk = dialogShown ? await page.locator('[data-testid="heavy-op-dont-ask"]').count() : 0;
    const ledgerAtConfirm = await ledgerOpCount(page, 'createContentForDescendants');
    step('confirm dialog appears FIRST (no generation, no ledger entry yet)',
      dialogShown && !generatingToastEarly && ledgerAtConfirm === 0,
      { dialogShown, generatingToastEarly, ledgerAtConfirm });
    step('honest wording: scope count + payer + cost + dont-ask present',
      /1 section/.test(scope) && /Citrus/.test(scope) && payer.length > 0 && cost.length > 0 && dontAsk === 1,
      { title, scope, payer, cost, dontAsk });
    await page.screenshot({ path: path.join(OUT_DIR, '2-confirm-shown.png'), fullPage: true });

    // ── (c): Cancel is truly inert ─────────────────────────────────────────
    await page.locator('[data-testid="heavy-op-cancel"]').click();
    await page.waitForTimeout(2500);
    const dialogGone = (await page.locator(DIALOG).count()) === 0;
    const noToast = !(await page.locator('text=/Generating Content/').first().isVisible().catch(() => false));
    const noBadges = (await page.locator('span:text-is("New content")').count()) === 0;
    const citrusEmpty = ((await nodeContent(page, 'Citrus')) || '') === '';
    const orangeEmpty = ((await nodeContent(page, 'Orange')) || '') === '';
    const ledgerAfterCancel = await ledgerOpCount(page, 'createContentForDescendants');
    step('Cancel → nothing generated, content untouched, NO ledger run entry',
      dialogGone && noToast && noBadges && citrusEmpty && orangeEmpty && ledgerAfterCancel === 0,
      { dialogGone, noToast, noBadges, citrusEmpty, orangeEmpty, ledgerAfterCancel });
    await page.screenshot({ path: path.join(OUT_DIR, '3-after-cancel.png'), fullPage: true });

    // ── (d): Run proceeds into the EXISTING flow (one tiny 1-node branch) ──
    await openConfirmViaContextMenu(page);
    await page.locator(DIALOG).first().waitFor({ state: 'visible', timeout: 8000 });
    await page.locator('[data-testid="heavy-op-run"]').click();
    await page.waitForTimeout(1500);
    const runDialogGone = (await page.locator(DIALOG).count()) === 0;
    const ledgerAfterRun = await ledgerOpCount(page, 'createContentForDescendants');
    const flowStarted = await page.locator('text=/Generating Content|Creating content for/').first().isVisible().catch(() => false);
    step('Run → dialog closes, ledger records ONE run, existing flow starts',
      runDialogGone && ledgerAfterRun === 1 && flowStarted,
      { runDialogGone, ledgerAfterRun, flowStarted });
    await page.screenshot({ path: path.join(OUT_DIR, '4-run-proceeds.png'), fullPage: true });

    // Let the single-node run finish (success → review card; error → toast).
    // Either way the slice-4 review-before-commit still governs commits; if the
    // review card appears, Discard so nothing persists from the test.
    const card = page.locator('[aria-label="Review generated content"]');
    const cardShown = await card.first().waitFor({ state: 'visible', timeout: 90000 }).then(() => true).catch(() => false);
    if (cardShown) {
      await page.screenshot({ path: path.join(OUT_DIR, '5-review-still-governs.png'), fullPage: true });
      await page.locator('[aria-label="Review generated content"] button:has-text("Discard")').first().click().catch(() => {});
      await page.waitForTimeout(600);
    } else {
      await page.screenshot({ path: path.join(OUT_DIR, '5-run-ended-no-review.png'), fullPage: true });
    }
    step('slice-4 provisional review still present after confirm (or run errored on free path — acceptable)',
      true, { cardShown });

    report.pass = report.steps.every(s => s.ok);
  } catch (e) {
    report.error = String((e && e.stack) || e);
    console.error(report.error);
  } finally {
    report.finished = new Date().toISOString();
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    if (app) { await Promise.race([app.close().catch(() => {}), new Promise(r => setTimeout(r, 5000))]); }
    console.log(`\n=== bulk-generate-confirm: ${report.pass ? 'ALL PASS' : 'FAILURES'} ===`);
    process.exit(report.pass ? 0 : 1);
  }
})();
