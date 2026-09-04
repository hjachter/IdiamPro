// Proposed-deletion review test — verifies the "Tell AI" natural-language
// DELETE is gated behind a visible approve-before-apply review:
//   (a) target + descendants are VISIBLY marked pending; delete does NOT happen
//   (b) "Keep" leaves everything intact
//   (c) "Delete" removes them
//   (d) Undo restores them
//
// Drives the REAL production code path (handleAICommand → destructive-delete
// gate) via a dev-only window seam (__ideamTellAI / __ideamSeedTree), using
// Howard's personal BYOK Gemini key for the one-shot parse (permitted).
//
// NO BACKGROUND TASKS. Foreground synchronous run only.

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { prepareApp } = require('./_helpers');

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'proposed-delete');
fs.mkdirSync(OUT_DIR, { recursive: true });

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

function readGeminiKey() {
  try {
    const env = fs.readFileSync(path.resolve(__dirname, '..', '.env.local'), 'utf8');
    const m = env.match(/^GEMINI_API_KEY=(.+)$/m);
    return m ? m[1].trim() : null;
  } catch { return null; }
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

const report = { suite: 'proposed-delete', started: new Date().toISOString(), steps: [], pass: false };
function step(name, ok, extra) { report.steps.push({ name, ok, ...(extra || {}) }); console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ' ' + JSON.stringify(extra) : ''}`); }

// Count how many rendered outline rows carry the "Will delete" pending badge.
async function pendingBadgeCount(page) {
  return page.locator('span:has-text("Will delete")').count();
}
// Is a node with this exact visible name present in the tree?
async function nodePresent(page, name) {
  return (await page.locator(`[role="treeitem"] span:text-is("${name}")`).count()) > 0;
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

    // BYOK: inject the Gemini key so the usage gate is exempt and the parse uses
    // the user's own key (never a company key).
    const key = readGeminiKey();
    if (!key) { step('found Gemini BYOK key in .env.local', false); throw new Error('no key'); }
    await page.evaluate((k) => {
      try {
        window.localStorage.setItem('apiKey_gemini', k);
        window.localStorage.setItem('textProvider', 'gemini');
        window.localStorage.setItem('requireDestructiveConfirmation', 'true');
      } catch {}
    }, key);
    step('injected BYOK Gemini key + destructive-confirm on', true);

    // Seed Fruits > Citrus > Orange and select Citrus.
    await page.waitForFunction(() => !!(window).__ideamSeedTree, null, { timeout: 15000 });
    await page.evaluate(() => (window).__ideamSeedTree());
    await page.waitForTimeout(600);
    const beforeCitrus = await nodePresent(page, 'Citrus');
    const beforeOrange = await nodePresent(page, 'Orange');
    step('seeded tree (Citrus + Orange visible)', beforeCitrus && beforeOrange, { beforeCitrus, beforeOrange });
    await page.screenshot({ path: path.join(OUT_DIR, '1-before.png'), fullPage: true });

    // Issue the NL delete — real parse via the production handler.
    await page.evaluate(() => (window).__ideamTellAI('delete the item called Citrus'));

    // Wait for the pending review to appear (the gate must NOT delete yet).
    await page.locator('text=Keep').first().waitFor({ state: 'visible', timeout: 25000 });
    await page.waitForTimeout(400);
    const pendCount = await pendingBadgeCount(page);
    const stillCitrus = await nodePresent(page, 'Citrus');
    const stillOrange = await nodePresent(page, 'Orange');
    const reviewShown = await page.locator('text=/Delete .*Citrus/').first().isVisible().catch(() => false);
    step('pending marks shown, nothing deleted yet', pendCount >= 2 && stillCitrus && stillOrange && reviewShown,
      { pendingBadges: pendCount, stillCitrus, stillOrange, reviewShown });
    await page.screenshot({ path: path.join(OUT_DIR, '2-pending.png'), fullPage: true });

    // Reject → nothing deleted, marks cleared.
    await page.locator('button:has-text("Keep")').first().click();
    await page.waitForTimeout(600);
    const keptCitrus = await nodePresent(page, 'Citrus');
    const keptOrange = await nodePresent(page, 'Orange');
    const marksGone = (await pendingBadgeCount(page)) === 0;
    step('Keep left everything intact, marks cleared', keptCitrus && keptOrange && marksGone,
      { keptCitrus, keptOrange, marksGone });
    await page.screenshot({ path: path.join(OUT_DIR, '3-kept.png'), fullPage: true });

    // Issue again → Approve → deleted.
    await page.evaluate(() => (window).__ideamTellAI('delete the item called Citrus'));
    await page.locator('button:has-text("Delete")').first().waitFor({ state: 'visible', timeout: 25000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT_DIR, '4-pending-again.png'), fullPage: true });
    await page.locator('button:has-text("Delete")').first().click();
    await page.waitForTimeout(700);
    const goneCitrus = !(await nodePresent(page, 'Citrus'));
    const goneOrange = !(await nodePresent(page, 'Orange'));
    step('Approve deleted target + descendant', goneCitrus && goneOrange, { goneCitrus, goneOrange });
    await page.screenshot({ path: path.join(OUT_DIR, '5-deleted.png'), fullPage: true });

    // Undo → restored.
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
    await page.waitForTimeout(800);
    const backCitrus = await nodePresent(page, 'Citrus');
    const backOrange = await nodePresent(page, 'Orange');
    step('Undo restored target + descendant', backCitrus && backOrange, { backCitrus, backOrange });
    await page.screenshot({ path: path.join(OUT_DIR, '6-undone.png'), fullPage: true });

    report.pass = report.steps.every(s => s.ok);
  } catch (e) {
    report.error = String((e && e.stack) || e);
    console.error(report.error);
  } finally {
    report.finished = new Date().toISOString();
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    if (app) { await Promise.race([app.close().catch(() => {}), new Promise(r => setTimeout(r, 5000))]); }
    console.log(`\n=== proposed-delete: ${report.pass ? 'ALL PASS' : 'FAILURES'} ===`);
    process.exit(report.pass ? 0 : 1);
  }
})();
