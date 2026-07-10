// Toolbar overflow test (2026-07-10)
// Verifies the middle outline-column action toolbar never clips its buttons:
// when the window (and therefore the outline column) is narrow, lower-priority
// tools collapse into the "More" (⋯) menu instead of being cut off, and the
// More menu is clickable and surfaces those actions.
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT = path.resolve(__dirname, '..', 'test-screenshots', 'toolbar-overflow');
fs.mkdirSync(OUT, { recursive: true });

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
  await page.waitForTimeout(1000);
}

// Returns { count, clipped } for the visible buttons inside the action toolbar.
async function inspectToolbar() {
  const toolbar = page.locator('[data-testid="outline-action-toolbar"]');
  await toolbar.waitFor({ state: 'visible', timeout: 10000 });
  const box = await toolbar.boundingBox();
  const buttons = toolbar.locator('button');
  const n = await buttons.count();
  let visible = 0;
  const clippedLabels = [];
  let clipped = 0;
  for (let i = 0; i < n; i++) {
    const b = buttons.nth(i);
    if (!(await b.isVisible())) continue;
    const bb = await b.boundingBox();
    if (!bb) continue;
    visible++;
    // A button is clipped if it pokes past the toolbar's own edges (2px tol).
    if (bb.x < box.x - 2 || bb.x + bb.width > box.x + box.width + 2) {
      clipped++;
      const label = (await b.getAttribute('aria-label')) || (await b.textContent()) || '?';
      clippedLabels.push(label.trim().slice(0, 24));
    }
  }
  return { visible, clipped, box, toolbarW: Math.round(box.width), clippedLabels };
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

    // Load an outline so the action toolbar is present/active.
    const welcome = page.locator('button:has-text("Welcome Outline"), button:has-text("Welcome")').first();
    if (await welcome.count() > 0 && await welcome.isVisible().catch(() => false)) {
      await welcome.click();
      await page.waitForTimeout(1500);
    }

    // --- WIDE: everything inline, no clipping ---
    await setWindowSize(1400, 900);
    let wide = await inspectToolbar();
    await page.screenshot({ path: path.join(OUT, '1-wide.png') });
    record('Wide layout: no clipped toolbar buttons', wide.clipped === 0, `toolbarW=${wide.toolbarW}px, ${wide.visible} visible, ${wide.clipped} clipped [${wide.clippedLabels.join(", ")}]`);

    // --- NARROW: overflow into More, still no clipping ---
    await setWindowSize(560, 900);
    let narrow = await inspectToolbar();
    await page.screenshot({ path: path.join(OUT, '2-narrow.png') });
    record('Narrow layout: no clipped toolbar buttons', narrow.clipped === 0, `toolbarW=${narrow.toolbarW}px, ${narrow.visible} visible, ${narrow.clipped} clipped`);

    const more = page.locator('[data-testid="outline-toolbar-more"]');
    const moreVisible = await more.isVisible().catch(() => false);
    record('Narrow layout: More (⋯) button appears', moreVisible, `visible=${moreVisible}`);

    // --- VERY NARROW ---
    await setWindowSize(430, 900);
    let vnarrow = await inspectToolbar();
    await page.screenshot({ path: path.join(OUT, '3-very-narrow.png') });
    record('Very narrow layout: no clipped toolbar buttons', vnarrow.clipped === 0, `toolbarW=${vnarrow.toolbarW}px, ${vnarrow.visible} visible, ${vnarrow.clipped} clipped`);

    // More menu opens and surfaces a collapsed action (Settings/Help).
    let menuOk = false;
    if (await more.isVisible().catch(() => false)) {
      await more.click();
      await page.waitForTimeout(400);
      const item = page.locator('[role="menuitem"]:has-text("Settings"), [role="menuitem"]:has-text("Help")');
      menuOk = (await item.count()) > 0 && await item.first().isVisible().catch(() => false);
      await page.screenshot({ path: path.join(OUT, '4-more-open.png') });
      await page.keyboard.press('Escape').catch(() => {});
    }
    record('More menu opens and lists collapsed actions', menuOk, `menuHasItems=${menuOk}`);

    const passed = results.filter((r) => r.pass).length;
    const report = { suite: 'toolbar-overflow', passed, total: results.length, results };
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
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
