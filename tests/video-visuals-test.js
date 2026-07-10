// ============================================================================
// Generate Video — "Slide visuals" control test (multi-select checkboxes).
// Verifies the Slide visuals control renders THREE independent, combinable
// checkboxes (Mind maps, Photos, Video clips), defaults to Mind maps + Photos
// ON and Video clips OFF, and that they toggle independently (multi-select, not
// mutually-exclusive radios). Follows the launch/window patterns in
// video-depth-test.js.
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
    // Fresh default: clear any previously-persisted selection so we test the
    // real out-of-box default (Mind maps + Photos).
    await page.evaluate(() => { try { localStorage.removeItem('idiampro:video-visuals-set'); } catch (_) {} });
    await page.reload().catch(() => {});
    await page.waitForTimeout(2500);
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
    ok(await page.getByText('Slide visuals', { exact: true }).first().isVisible().catch(() => false),
      '"Slide visuals" label renders');

    // Three checkbox options (multi-select). Radix Checkbox exposes role=checkbox.
    const mindMaps = page.getByRole('checkbox', { name: 'Mind maps' }).first();
    const photos = page.getByRole('checkbox', { name: 'Photos' }).first();
    const videoClips = page.getByRole('checkbox', { name: 'Video clips' }).first();
    ok(await mindMaps.isVisible().catch(() => false), 'Slide visuals CHECKBOX "Mind maps" renders');
    ok(await photos.isVisible().catch(() => false), 'Slide visuals CHECKBOX "Photos" renders');
    ok(await videoClips.isVisible().catch(() => false), 'Slide visuals CHECKBOX "Video clips" renders');

    // Default: Mind maps + Photos ON, Video clips OFF.
    const mmChecked = await mindMaps.getAttribute('aria-checked').catch(() => null);
    const phChecked = await photos.getAttribute('aria-checked').catch(() => null);
    const vcChecked = await videoClips.getAttribute('aria-checked').catch(() => null);
    ok(mmChecked === 'true', `Default: Mind maps ON (aria-checked=${mmChecked})`);
    ok(phChecked === 'true', `Default: Photos ON (aria-checked=${phChecked})`);
    ok(vcChecked === 'false', `Default: Video clips OFF (aria-checked=${vcChecked})`);

    // Multi-select: turning Video clips on leaves Mind maps + Photos on (NOT radios).
    await videoClips.click();
    await page.waitForTimeout(300);
    await shot(page, '03-videoclips-added.png');
    const vcAfter = await videoClips.getAttribute('aria-checked').catch(() => null);
    const mmStill = await mindMaps.getAttribute('aria-checked').catch(() => null);
    const phStill = await photos.getAttribute('aria-checked').catch(() => null);
    ok(vcAfter === 'true', `Video clips toggles ON (aria-checked=${vcAfter})`);
    ok(mmStill === 'true' && phStill === 'true',
      `Multi-select: Mind maps + Photos STAY on after adding Video clips (mm=${mmStill}, ph=${phStill})`);

    // Independently uncheck Mind maps; the others are unaffected.
    await mindMaps.click();
    await page.waitForTimeout(300);
    await shot(page, '04-mindmaps-off.png');
    const mmOff = await mindMaps.getAttribute('aria-checked').catch(() => null);
    const phStill2 = await photos.getAttribute('aria-checked').catch(() => null);
    ok(mmOff === 'false', `Mind maps toggles OFF independently (aria-checked=${mmOff})`);
    ok(phStill2 === 'true', `Photos unaffected by Mind maps toggle (aria-checked=${phStill2})`);
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
