// Verifies the Generate Video dialog shows a REAL progress bar + a live
// time-remaining estimate while a render runs (not the old fake spinner).
//
// Flow: open the dialog on a chapter, shrink the render (Overview depth +
// visuals Off so it stays quick and offline), click Generate, then confirm the
// running phase shows a [role=progressbar], a percent, a per-slide/stitch label,
// and a "…left" time estimate — and that the bar is not stuck at 0.
// Run: node tests/video-progress-bar-test.js

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'video-progress-bar');
const SCRATCH_SHOT = '/private/tmp/claude-501/-Users-howardjachter-Developer-IdiamPro/a8db6996-3bce-4aef-8646-4175b8f089c9/scratchpad/video-progress.png';
fs.mkdirSync(OUT_DIR, { recursive: true });

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail: detail || '' });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ` :: ${detail}` : ''}`);
}

async function findMainWindow(app, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    for (const win of app.windows()) {
      try {
        const url = win.url();
        if (url.startsWith('devtools://')) continue;
        if (url.includes('localhost:9002')) return win;
      } catch (_) { /* not ready */ }
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Could not find main app window');
}

(async () => {
  const projectRoot = path.resolve(__dirname, '..');
  const app = await electron.launch({ args: [projectRoot], env: { ...process.env, NODE_ENV: 'development' } });
  let page;
  try {
    page = await findMainWindow(app);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500);
    if (!page.url().includes('/app')) {
      await page.evaluate(() => { window.location.href = '/app'; });
      await page.waitForLoadState('domcontentloaded');
    }

    // Wait for the outline UI to actually finish loading (first /app compile can
    // be slow — the page sits on "Loading…" until React + storage are ready).
    const readySelectors = ['[data-node-id]', '.outline-node', '[role="treeitem"]', 'button:has-text("New Outline")'];
    const readyDeadline = Date.now() + 60000;
    let appReady = false;
    while (Date.now() < readyDeadline && !appReady) {
      for (const sel of readySelectors) {
        if (await page.locator(sel).first().count() > 0) { appReady = true; break; }
      }
      if (!appReady) await page.waitForTimeout(1500);
    }
    record('App reached the outline view', appReady, appReady ? '' : 'still loading after 60s');
    await page.waitForTimeout(1000);

    // Select a chapter node.
    for (const sel of ['[data-node-id]', '.outline-node', '[role="treeitem"]']) {
      const loc = page.locator(sel).first();
      if (await loc.count() > 0) { try { await loc.click({ timeout: 3000 }); break; } catch (_) {} }
    }
    await page.waitForTimeout(500);

    // Open Export menu → Generate Video.
    for (const sel of ['button[aria-label^="Export"]', 'button[aria-label*="Export"]', 'button:has-text("Export")', 'button[title="Export"]']) {
      const loc = page.locator(sel).first();
      if (await loc.count() > 0) { try { await loc.click({ timeout: 3000 }); break; } catch (_) {} }
    }
    await page.waitForTimeout(600);
    const menuItem = page.locator('text=Generate Video').first();
    const opened = await menuItem.count() > 0;
    if (opened) { await menuItem.click(); await page.waitForTimeout(1200); }
    record('Generate Video dialog opens', opened, '');

    // Keep the render offline (visuals Off) but use Standard depth so the chapter
    // yields several slides — that way the bar shows real intermediate percents.
    for (const label of ['Standard', 'Off']) {
      const b = page.locator(`button:has-text("${label}")`).first();
      if (await b.count() > 0) { try { await b.click({ timeout: 2000 }); } catch (_) {} }
    }
    await page.waitForTimeout(400);

    // Scope to the dialog — the background app also has a "Generate" (AI) button,
    // so an unscoped locator would grab the wrong one behind the modal overlay.
    const dialog = page.locator('[role="dialog"]').first();
    // If a large-chapter guard is present, acknowledge it so Generate enables.
    const genBtn = dialog.locator('button:has-text("Generate")').first();
    if (await genBtn.count() > 0 && await genBtn.isDisabled().catch(() => false)) {
      const cb = page.locator('input[type="checkbox"]').first();
      if (await cb.count() > 0) { try { await cb.check({ timeout: 2000 }); } catch (_) {} }
    }
    await page.screenshot({ path: path.join(OUT_DIR, '01-configure.png') });

    // Kick off the render. The dialog can be taller than the window, so scroll
    // the footer Generate button into the dialog's own scroll area, then click
    // normally (a normal click keeps us inside the dialog — never dismiss it).
    let started = false;
    if (await genBtn.count() > 0) {
      try { await genBtn.scrollIntoViewIfNeeded({ timeout: 3000 }); } catch (_) {}
      // A persistent toast can overlap the dialog footer and intercept a real
      // pointer click. Fire the button's own click handler directly instead —
      // this stays inside the dialog (never dismisses it) and isn't blocked by
      // overlays.
      try { await genBtn.evaluate((el) => el.click()); started = true; } catch (_) {}
    }
    record('Clicked Generate', started, '');

    // Poll rapidly for the running state and capture the FIRST frame that shows a
    // progress bar (a tiny render is quick, so don't rely on a fixed delay).
    const bar = page.locator('[role="progressbar"]').first();
    let barVisible = false;
    const runDeadline = Date.now() + 8000;
    while (Date.now() < runDeadline) {
      if (await bar.count() > 0) { barVisible = true; break; }
      // A very fast render might already show the done state — that still proves
      // the running UI mounted and advanced; stop polling in that case too.
      const bt = await page.locator('body').innerText().catch(() => '');
      if (/your video is ready/i.test(bt)) break;
      await page.waitForTimeout(150);
    }
    await page.screenshot({ path: path.join(OUT_DIR, '02-running.png') });
    // Capture the running UI to the scratchpad for visual inspection.
    if (barVisible) { try { await page.screenshot({ path: SCRATCH_SHOT }); } catch (_) {} }
    record('Progress bar (role=progressbar) is visible while running', barVisible, '');

    const runningText1 = await page.locator('body').innerText().catch(() => '');
    record('Shows a live time-remaining estimate', /left|almost done/i.test(runningText1),
      (runningText1.match(/[^\n]*(left|almost done)[^\n]*/i) || [''])[0].trim());
    // Specific phrases only, so the configure-phase "AI voiceover" copy can't be a
    // false positive.
    const labelRe = /Rendering slide \d+ of \d+|Preparing…|Stitching video|Adding voiceover \(|Finishing up|your video is ready/i;
    record('Shows a phase label', labelRe.test(runningText1), (runningText1.match(labelRe) || [''])[0]);
    record('Shows a percent', /\d+%/.test(runningText1), (runningText1.match(/\d+%/) || [''])[0]);

    // Confirm the bar actually advances (not stuck at 0): poll aria-valuenow, or
    // accept the dialog reaching the "video is ready" done state as advancement.
    let maxVal = 0;
    let reachedDone = false;
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      const b = page.locator('[role="progressbar"]').first();
      if (await b.count() > 0) {
        const v = parseFloat(await b.getAttribute('aria-valuenow').catch(() => '0')) || 0;
        if (v > maxVal) {
          maxVal = v;
          if (v > 0 && v < 100) { try { await page.screenshot({ path: SCRATCH_SHOT }); } catch (_) {} }
        }
      }
      const bt = await page.locator('body').innerText().catch(() => '');
      if (/your video is ready/i.test(bt)) { reachedDone = true; break; }
      if (maxVal >= 30) break; // clearly advancing; no need to wait for full render
      await page.waitForTimeout(1000);
    }
    record('Progress bar advances past 0 (not stuck)', maxVal > 0 || reachedDone, `maxValueNow=${maxVal}, reachedDone=${reachedDone}`);

    // Make sure the scratchpad screenshot exists (fall back to a running shot).
    if (!fs.existsSync(SCRATCH_SHOT)) { try { await page.screenshot({ path: SCRATCH_SHOT }); } catch (_) {} }

    const passCount = results.filter(r => r.pass).length;
    const report = {
      suite: 'video-progress-bar', when: new Date().toISOString(),
      total: results.length, passed: passCount, failed: results.length - passCount, results,
    };
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(OUT_DIR, 'report.md'),
      `# Generate Video — live progress bar test\n\n${passCount}/${results.length} passed\n\n` +
      results.map(r => `- ${r.pass ? 'PASS' : 'FAIL'} — ${r.name}${r.detail ? ` (${r.detail})` : ''}`).join('\n') + '\n');
    console.log(`\n${passCount}/${results.length} checks passed`);
  } catch (e) {
    console.error('TEST ERROR:', e && e.message);
    try { if (page) await page.screenshot({ path: path.join(OUT_DIR, 'error.png') }); } catch (_) {}
    record('harness', false, e && e.message);
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify({ suite: 'video-progress-bar', error: String(e && e.message), results }, null, 2));
  } finally {
    await Promise.race([app.close().catch(() => {}), new Promise(r => setTimeout(r, 5000))]);
    const failed = results.filter(r => !r.pass).length;
    process.exit(failed > 0 ? 1 : 0);
  }
})();
