// ============================================================================
// Generate Video — "Detail" (depth) control test.
// Verifies the Detail control renders with its four options and that switching
// from Overview to Full outline changes the displayed slide count live.
// Follows the launch/window patterns in electron-test.js.
// ============================================================================
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'video-depth');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function findMainWindow(app, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    for (const win of app.windows()) {
      try {
        const url = win.url();
        if (url.startsWith('devtools://')) continue;
        if (url.includes('localhost:9002')) return win;
      } catch (_) {}
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Could not find main app window');
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, name) }).catch(() => {});
}

function readCount(text) {
  const m = String(text || '').match(/(\d+)\s+slides/);
  return m ? parseInt(m[1], 10) : null;
}

(async () => {
  const report = { pass: 0, fail: 0, steps: [] };
  const ok = (cond, msg) => {
    report.steps.push({ ok: !!cond, msg });
    if (cond) { report.pass++; console.log('ok:', msg); }
    else { report.fail++; console.log('FAIL:', msg); }
  };

  let app;
  try {
    app = await electron.launch({
      args: [path.resolve(__dirname, '..')],
      env: { ...process.env, NODE_ENV: 'development' },
    });
    const page = await findMainWindow(app);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3500);
    await shot(page, '01-loaded.png');

    // Load a DEEPLY nested outline (the User Guide) so changing depth changes
    // the slide count, then select its root node as the chapter.
    await page.getByText('IdiamPro User Guide', { exact: true }).first().click().catch(() => {});
    await page.waitForTimeout(1200);
    // Select the first (root) node row in the main outline pane.
    const firstNode = page.locator('li.list-none').first();
    await firstNode.waitFor({ timeout: 15000 });
    await firstNode.click({ position: { x: 60, y: 12 } }).catch(() => {});
    await page.waitForTimeout(500);
    await shot(page, '02-node-selected.png');

    // Open the Export menu, then Generate Video.
    await page.locator('[aria-label^="Export"]').first().click();
    await page.waitForTimeout(400);
    await shot(page, '03-export-menu.png');
    await page.getByText('Generate Video', { exact: true }).first().click();
    await page.waitForTimeout(1200);
    await shot(page, '04-dialog.png');

    // Dialog opened.
    ok(await page.getByText('Generate Video').first().isVisible(), 'Generate Video dialog is open');

    // Detail control: all four options present.
    for (const label of ['Overview', 'Standard', 'Deep', 'Full outline']) {
      const visible = await page.getByRole('button', { name: new RegExp('^' + label) }).first().isVisible().catch(() => false);
      ok(visible, `Detail option "${label}" renders`);
    }

    // Count at Overview (depth 1).
    await page.getByRole('button', { name: /^Overview/ }).first().click();
    await page.waitForTimeout(600);
    const overviewText = await page.locator('text=/\\d+ slides/').first().textContent().catch(() => '');
    const overviewCount = readCount(overviewText);
    await shot(page, '05-overview.png');
    ok(overviewCount !== null, `Overview shows a slide count (${overviewCount})`);

    // Count at Full outline (depth 99).
    await page.getByRole('button', { name: /^Full outline/ }).first().click();
    await page.waitForTimeout(600);
    const fullText = await page.locator('text=/\\d+ slides/').first().textContent().catch(() => '');
    const fullCount = readCount(fullText);
    await shot(page, '06-full.png');
    ok(fullCount !== null, `Full outline shows a slide count (${fullCount})`);

    report.overviewCount = overviewCount;
    report.fullCount = fullCount;
    ok(
      overviewCount !== null && fullCount !== null && fullCount > overviewCount,
      `Full outline count (${fullCount}) > Overview count (${overviewCount})`
    );
  } catch (e) {
    report.fail++;
    report.steps.push({ ok: false, msg: 'EXCEPTION: ' + (e && e.message) });
    console.log('EXCEPTION:', e && e.stack);
  }

  // Write the report BEFORE teardown so a hung app.close() can't lose it.
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`\nRESULT: ${report.pass} passed, ${report.fail} failed`);

  // Teardown with a hard deadline — Electron close occasionally hangs on a
  // beforeunload race; don't let it wedge the process.
  await Promise.race([
    app ? app.close().catch(() => {}) : Promise.resolve(),
    new Promise((r) => setTimeout(r, 4000)),
  ]);
  process.exit(report.fail > 0 ? 1 : 0);
})();
