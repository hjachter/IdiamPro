// ============================================================================
// Generate Video — "Slide visuals" control test.
// Verifies the Slide visuals control renders with all FOUR options (Off, Mind
// maps, Photos, Auto — Phase B added Photos + Auto), defaults to Auto, and that
// clicking between them toggles the pressed state. Follows the launch/window
// patterns in video-depth-test.js.
// ============================================================================
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'video-visuals');
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

    // Load the User Guide outline and select its root node as the chapter.
    await page.getByText('IdiamPro User Guide', { exact: true }).first().click().catch(() => {});
    await page.waitForTimeout(1200);
    const firstNode = page.locator('li.list-none').first();
    await firstNode.waitFor({ timeout: 15000 });
    await firstNode.click({ position: { x: 60, y: 12 } }).catch(() => {});
    await page.waitForTimeout(500);

    // Open the Export menu, then Generate Video.
    await page.locator('[aria-label^="Export"]').first().click();
    await page.waitForTimeout(400);
    await page.getByText('Generate Video', { exact: true }).first().click();
    await page.waitForTimeout(1200);
    await shot(page, '02-dialog.png');

    ok(await page.getByText('Generate Video').first().isVisible(), 'Generate Video dialog is open');

    // Slide visuals label present.
    ok(await page.getByText('Slide visuals', { exact: true }).first().isVisible().catch(() => false),
      '"Slide visuals" label renders');

    // All four options present.
    const offBtn = page.getByRole('button', { name: /^Off\b/ }).first();
    const mindMapsBtn = page.getByRole('button', { name: /^Mind maps/ }).first();
    const photosBtn = page.getByRole('button', { name: /^Photos/ }).first();
    const autoBtn = page.getByRole('button', { name: /^Auto/ }).first();
    ok(await offBtn.isVisible().catch(() => false), 'Slide visuals option "Off" renders');
    ok(await mindMapsBtn.isVisible().catch(() => false), 'Slide visuals option "Mind maps" renders');
    ok(await photosBtn.isVisible().catch(() => false), 'Slide visuals option "Photos" renders');
    ok(await autoBtn.isVisible().catch(() => false), 'Slide visuals option "Auto" renders');

    // Default is Auto (aria-pressed true on Auto).
    const defaultPressed = await autoBtn.getAttribute('aria-pressed').catch(() => null);
    ok(defaultPressed === 'true', `Default selection is Auto (aria-pressed=${defaultPressed})`);

    // Toggle to Photos, then to Off, then back to Auto.
    await photosBtn.click();
    await page.waitForTimeout(300);
    const photosPressed = await photosBtn.getAttribute('aria-pressed').catch(() => null);
    await shot(page, '03-photos-selected.png');
    ok(photosPressed === 'true', `Photos becomes selected after click (aria-pressed=${photosPressed})`);

    await offBtn.click();
    await page.waitForTimeout(300);
    const offPressed = await offBtn.getAttribute('aria-pressed').catch(() => null);
    await shot(page, '04-off-selected.png');
    ok(offPressed === 'true', `Off becomes selected after click (aria-pressed=${offPressed})`);

    await autoBtn.click();
    await page.waitForTimeout(300);
    const backPressed = await autoBtn.getAttribute('aria-pressed').catch(() => null);
    await shot(page, '05-auto-selected.png');
    ok(backPressed === 'true', `Auto re-selectable (aria-pressed=${backPressed})`);
  } catch (e) {
    report.fail++;
    report.steps.push({ ok: false, msg: 'EXCEPTION: ' + (e && e.message) });
    console.log('EXCEPTION:', e && e.stack);
  }

  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`\nRESULT: ${report.pass} passed, ${report.fail} failed`);

  await Promise.race([
    app ? app.close().catch(() => {}) : Promise.resolve(),
    new Promise((r) => setTimeout(r, 4000)),
  ]);
  process.exit(report.fail > 0 ? 1 : 0);
})();
