/**
 * proposed-expand-test.js — verifies AI "Generate / Expand content" is gated
 * behind a before/after approve-before-apply review (P1 slice 3):
 *   (a) a before/after preview appears and the node's content is NOT yet changed
 *   (b) "Discard" leaves the node's content exactly as it was
 *   (c) "Approve" applies the generated content, honoring placement
 *       (append keeps the original + adds new; replace swaps it out)
 *   (d) after Approve, Undo (⌘Z) reverses the change
 *
 * Drives the REAL production gate (ProposedExpandReview → approve/discard →
 * applyProcessedContent → Tiptap undo) via a dev-only window seam
 * (__ideamProvisionalExpand) so the gate MECHANICS are verified deterministically
 * WITHOUT making an AI call or spending generations. The seam feeds the exact
 * same state the AI path feeds; only the text source differs.
 *
 * NO BACKGROUND TASKS. Foreground synchronous run only.
 */

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { prepareApp } = require('./_helpers');

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'proposed-expand');
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

const report = { suite: 'proposed-expand', started: new Date().toISOString(), steps: [], pass: false };
function step(name, ok, extra) { report.steps.push({ name, ok, ...(extra || {}) }); console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ' ' + JSON.stringify(extra) : ''}`); }

const DIALOG = '[role="dialog"]:has-text("Review new content")';
const ORIGINAL = 'Original text here.';
const NEWTEXT = 'Fresh AI content.';
const REPLACED = 'Replaced content.';

async function editorText(page) {
  return (await page.locator('.ProseMirror, [contenteditable="true"]').first().innerText().catch(() => '')).trim();
}

async function dismissModals(page) {
  for (let i = 0; i < 6; i++) {
    const overlay = page.locator('div.fixed.inset-0.z-50[data-state="open"]');
    if (!(await overlay.first().isVisible().catch(() => false))) return;
    const btn = page.locator('[role="dialog"] button:has-text("Got it"), [role="dialog"] button:has-text("Continue"), [role="dialog"] button:has-text("I Agree"), [role="dialog"] button:has-text("Close"), [role="dialog"] button:has-text("Dismiss")');
    if ((await btn.count().catch(() => 0)) > 0) await btn.first().click().catch(() => {});
    else await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(700);
  }
}

(async () => {
  let app;
  try {
    const projectRoot = path.resolve(__dirname, '..');
    app = await electron.launch({ args: [projectRoot], env: { ...process.env, NODE_ENV: 'development' } });
    const page = await findMainWindow(app);
    page.on('dialog', (d) => { d.dismiss().catch(() => {}); });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500);

    if (!page.url().includes('/app')) {
      await page.evaluate(() => { window.location.href = '/app'; });
      await page.waitForLoadState('domcontentloaded');
      await page.locator('button:has-text("New Outline")').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    }
    await prepareApp(page);
    await dismissModals(page);

    // Fresh editable outline (User Guide is read-only).
    const newOutlineBtn = page.locator('button:has-text("New Outline")').first();
    await newOutlineBtn.waitFor({ state: 'visible', timeout: 20000 });
    await newOutlineBtn.click();
    await page.waitForTimeout(1800);
    await dismissModals(page);

    // Select the root node so the content pane + editor mount.
    await page.locator('h1:has-text("Untitled Outline")').first().click().catch(() => {});
    await page.waitForTimeout(800);

    // Type ORIGINAL content into the editor.
    const editor = page.locator('.ProseMirror, [contenteditable="true"]').first();
    await editor.click();
    await page.waitForTimeout(300);
    await page.keyboard.type(ORIGINAL);
    await page.waitForTimeout(600);
    const seeded = (await editorText(page)).includes(ORIGINAL);
    step('seeded node with original content', seeded, { seeded });
    await page.screenshot({ path: path.join(OUT_DIR, '1-seeded.png'), fullPage: true });

    // The seam must be registered by the mounted content pane.
    await page.waitForFunction(() => !!(window).__ideamProvisionalExpand, null, { timeout: 15000 });

    // ---- (a) APPEND → preview shown, node NOT yet changed ----
    await page.evaluate((t) => (window).__ideamProvisionalExpand(t, 'append'), NEWTEXT);
    await page.locator(`${DIALOG} button:has-text("Approve")`).first().waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(300);
    const afterHasBoth = await page.locator(DIALOG).getByText(NEWTEXT).first().isVisible().catch(() => false);
    const editorUnchangedDuringPreview = (await editorText(page)) === ORIGINAL;
    step('preview shown; node NOT changed yet', afterHasBoth && editorUnchangedDuringPreview,
      { previewShowsNew: afterHasBoth, editorUnchangedDuringPreview });
    await page.screenshot({ path: path.join(OUT_DIR, '2-preview.png'), fullPage: true });

    // ---- (b) DISCARD → node unchanged ----
    await page.locator(`${DIALOG} button:has-text("Discard")`).first().click();
    await page.waitForTimeout(600);
    const dialogGone = (await page.locator(DIALOG).count()) === 0;
    const unchangedAfterDiscard = (await editorText(page)) === ORIGINAL;
    step('Discard left node exactly as before', dialogGone && unchangedAfterDiscard,
      { dialogGone, unchangedAfterDiscard, editor: await editorText(page) });
    await page.screenshot({ path: path.join(OUT_DIR, '3-discarded.png'), fullPage: true });

    // ---- (c) APPEND → APPROVE → both present (placement honored) ----
    await page.evaluate((t) => (window).__ideamProvisionalExpand(t, 'append'), NEWTEXT);
    await page.locator(`${DIALOG} button:has-text("Approve")`).first().waitFor({ state: 'visible', timeout: 10000 });
    await page.locator(`${DIALOG} button:has-text("Approve")`).first().click();
    await page.waitForTimeout(700);
    const txt = await editorText(page);
    const approvedAppend = txt.includes(ORIGINAL) && txt.includes(NEWTEXT);
    step('Approve applied new content, append kept original', approvedAppend, { editor: txt });
    await page.screenshot({ path: path.join(OUT_DIR, '4-approved-append.png'), fullPage: true });

    // ---- (d) UNDO → reverses the approved change ----
    await editor.click();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
    await page.waitForTimeout(700);
    const afterUndo = await editorText(page);
    const undone = afterUndo.includes(ORIGINAL) && !afterUndo.includes(NEWTEXT);
    step('Undo reversed the approved change', undone, { editor: afterUndo });
    await page.screenshot({ path: path.join(OUT_DIR, '5-undone.png'), fullPage: true });

    // ---- (e) REPLACE placement honored ----
    await page.evaluate((t) => (window).__ideamProvisionalExpand(t, 'replace'), REPLACED);
    await page.locator(`${DIALOG} button:has-text("Approve")`).first().waitFor({ state: 'visible', timeout: 10000 });
    await page.locator(`${DIALOG} button:has-text("Approve")`).first().click();
    await page.waitForTimeout(700);
    const rep = await editorText(page);
    const replaced = rep.includes(REPLACED) && !rep.includes(ORIGINAL);
    step('Replace placement swapped the content', replaced, { editor: rep });
    await page.screenshot({ path: path.join(OUT_DIR, '6-replaced.png'), fullPage: true });

    report.pass = report.steps.every(s => s.ok);
  } catch (e) {
    report.error = String((e && e.stack) || e);
    console.error(report.error);
  } finally {
    report.finished = new Date().toISOString();
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    if (app) { await Promise.race([app.close().catch(() => {}), new Promise(r => setTimeout(r, 5000))]); }
    console.log(`\n=== proposed-expand: ${report.pass ? 'ALL PASS' : 'FAILURES'} ===`);
    process.exit(report.pass ? 0 : 1);
  }
})();
