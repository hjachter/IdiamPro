// Toolbar overflow / no-clip verification (updated 2026-07-20).
// Both the outline-pane ACTION toolbar (narrow middle column) and the
// content-pane EDITOR toolbar now measure their OWN width and fold
// lower-priority tools into a single "More" (⋯) menu, so at every width:
//   • outline toolbar = one clean non-wrapping row + at most one overflow
//     (no stray grey box, no orphaned second "...", no wrap to a 2nd line);
//   • editor toolbar = nothing clipped past the right edge.
// This drives the real BrowserWindow to 1100/1280/1440 with a node selected
// (so BOTH toolbars render) and screenshots each toolbar for inspection.
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { dismissWelcomeShowcase, prepareApp } = require('./_helpers');

// Press Escape / click-away until no full-screen modal overlay intercepts clicks.
async function clearOverlays(page) {
  for (let i = 0; i < 6; i++) {
    const overlay = page.locator('div.fixed.inset-0.z-50, [data-state="open"][aria-hidden="true"]');
    if (!(await overlay.count()) || !(await overlay.first().isVisible().catch(() => false))) return;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
    // Also try clicking an explicit close/skip/got-it control.
    const closer = page.locator('button:has-text("Got it"), button:has-text("Skip"), button:has-text("Close"), button[aria-label="Close"]');
    if (await closer.count()) await closer.first().click({ timeout: 500 }).catch(() => {});
    await page.waitForTimeout(300);
  }
}

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT = path.resolve(__dirname, '..', 'test-screenshots', 'toolbar-overflow');
const PUB = path.resolve(__dirname, '..', 'public', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(PUB, { recursive: true });

let electronApp, page;
const results = [];
function record(name, pass, info) {
  results.push({ name, pass, info: info || '' });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${info ? ' :: ' + info : ''}`);
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
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Could not find main app window');
}

async function setWindowSize(w, h) {
  await electronApp.evaluate(({ BrowserWindow }, size) => {
    const win = BrowserWindow.getAllWindows().find((x) => !x.webContents.getURL().startsWith('devtools://')) || BrowserWindow.getAllWindows()[0];
    win.setSize(size.w, size.h);
  }, { w, h });
  await page.waitForTimeout(1200);
}

// Inspect a toolbar: single-row (not wrapped), clipping, overflow count.
async function inspectToolbar(testid, overflowTestid) {
  const toolbar = page.locator(`[data-testid="${testid}"]`).first();
  await toolbar.waitFor({ state: 'visible', timeout: 10000 });
  const box = await toolbar.boundingBox();
  const buttons = toolbar.locator('button');
  const n = await buttons.count();
  let visible = 0, clipped = 0;
  const clippedLabels = [];
  for (let i = 0; i < n; i++) {
    const b = buttons.nth(i);
    if (!(await b.isVisible())) continue;
    const bb = await b.boundingBox();
    if (!bb) continue;
    visible++;
    if (bb.x < box.x - 2 || bb.x + bb.width > box.x + box.width + 2) {
      clipped++;
      const label = (await b.getAttribute('aria-label')) || (await b.textContent()) || '?';
      clippedLabels.push(label.trim().slice(0, 24));
    }
  }
  // Content overflowing horizontally beyond the clipping box.
  const overflowPx = await toolbar.evaluate((el) => el.scrollWidth - el.clientWidth);
  const overflowCount = overflowTestid ? await toolbar.locator(`[data-testid="${overflowTestid}"]`).count() : null;
  return { visible, clipped, clippedLabels, overflowPx, overflowCount, h: Math.round(box.height), w: Math.round(box.width) };
}

(async () => {
  try {
    const projectRoot = path.resolve(__dirname, '..');
    electronApp = await electron.launch({ args: [projectRoot], env: { ...process.env, NODE_ENV: 'development' } });
    page = await findMainWindow(electronApp);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    if (!page.url().includes('/app')) {
      await page.evaluate(() => { window.location.href = '/app'; });
      await page.waitForLoadState('domcontentloaded');
      try {
        await page.locator('button:has-text("New Outline")').waitFor({ state: 'visible', timeout: 30000 });
      } catch (e) { await page.waitForTimeout(5000); }
    }
    await prepareApp(page).catch(() => {});
    await clearOverlays(page);

    // Load the Welcome outline (same content as the diagnostic screenshots).
    const welcome = page.locator('button:has-text("Welcome to IdeaM"), button:has-text("Welcome Outline")').first();
    if (await welcome.count() > 0 && await welcome.isVisible().catch(() => false)) {
      await welcome.click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(1500);
    }
    await clearOverlays(page);

    // Select a node so the content pane renders its editor toolbar.
    const nodeRow = page.locator('[data-testid="outline-pane"] [role="treeitem"]');
    if (await nodeRow.count()) {
      await nodeRow.nth(Math.min(2, (await nodeRow.count()) - 1)).click({ timeout: 4000 }).catch(() => {});
    } else {
      await page.locator('text=/Step 3|Step 2|Step 1/').first().click({ timeout: 4000 }).catch(() => {});
    }
    await page.waitForTimeout(1000);
    await clearOverlays(page);

    // --- Primary check: wide window (default 3-pane), narrow middle column. ---
    for (const width of [1100, 1280, 1440]) {
      await setWindowSize(width, 900);
      await page.screenshot({ path: path.join(PUB, `toolbar-fixed-${width}.png`) });

      const ot = await inspectToolbar('outline-action-toolbar', 'outline-toolbar-more');
      await page.locator('[data-testid="outline-action-toolbar"]').first().screenshot({ path: path.join(PUB, `toolbar-fixed-outline-${width}.png`) }).catch(() => {});
      // Single-row: an icon-button row is ~44-56px tall; a wrapped 2nd row pushes >70px.
      const outlineSingleRow = ot.h < 70;
      record(`@${width}: outline toolbar single row (no wrap)`, outlineSingleRow, `h=${ot.h}px w=${ot.w}px`);
      record(`@${width}: outline toolbar no clipped buttons`, ot.clipped === 0, `${ot.visible} visible, ${ot.clipped} clipped [${ot.clippedLabels.join(', ')}]`);
      record(`@${width}: outline toolbar <=1 overflow button`, ot.overflowCount <= 1, `overflowButtons=${ot.overflowCount}`);

      const et = await inspectToolbar('editor-toolbar', 'editor-toolbar-more');
      await page.locator('[data-testid="editor-toolbar"]').first().screenshot({ path: path.join(PUB, `toolbar-fixed-editor-${width}.png`) }).catch(() => {});
      record(`@${width}: editor toolbar nothing clipped`, et.clipped === 0 && et.overflowPx <= 1, `${et.visible} visible, ${et.clipped} clipped, overflowPx=${et.overflowPx}`);
    }

    const passed = results.filter((r) => r.pass).length;
    const report = { suite: 'toolbar-overflow', passed, total: results.length, results };
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(PUB, 'toolbar-fixed-report.json'), JSON.stringify(report, null, 2));
    console.log(`\n${passed}/${results.length} checks passed`);

    await Promise.race([electronApp.close().catch(() => {}), new Promise((r) => setTimeout(r, 5000))]);
    process.exit(passed === results.length ? 0 : 1);
  } catch (err) {
    console.error('Test crashed:', err && err.message);
    try { await page.screenshot({ path: path.join(OUT, 'crash.png') }); } catch (e) {}
    try { await Promise.race([electronApp.close().catch(() => {}), new Promise((r) => setTimeout(r, 5000))]); } catch (e) {}
    process.exit(1);
  }
})();
