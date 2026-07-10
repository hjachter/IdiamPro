// UI regression test: the "Generate Video" dialog must stay usable on a SHORT
// window. It grew tall (Detail, Slide visuals, Style/branding, voice, large-
// chapter guard) and used to overflow with no way to scroll, hiding the lower
// options and the Generate button. This test forces a short Electron window,
// opens the dialog, and verifies:
//   (a) the options body actually scrolls (scrollHeight > clientHeight),
//   (b) the Generate button (in the pinned footer) is visible WITHOUT scrolling,
//   (c) the dialog does not run off the bottom of the window,
//   (d) after scrolling the body to the bottom, the lower controls (voice /
//       large-chapter guard) are reachable.
// Run: node tests/generate-video-scroll-test.js

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'generate-video-scroll');
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
      } catch (_) { /* window not ready */ }
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
    // Force a SHORT window so the tall dialog would overflow if not scrollable.
    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find(
        (w) => !w.webContents.getURL().startsWith('devtools://')
      );
      if (win) { win.setBounds({ x: 60, y: 40, width: 980, height: 700 }); }
    });

    page = await findMainWindow(app);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500);

    if (!page.url().includes('/app')) {
      await page.evaluate(() => { window.location.href = '/app'; });
      await page.waitForLoadState('domcontentloaded');
      try {
        await page.locator('button:has-text("New Outline")').waitFor({ state: 'visible', timeout: 30000 });
      } catch (_) { await page.waitForTimeout(4000); }
    }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT_DIR, '01-app-loaded.png') });

    // Select a chapter node so the video action enables.
    let selected = false;
    for (const sel of ['[data-node-id]', '.outline-node', '[role="treeitem"]']) {
      const loc = page.locator(sel).first();
      if (await loc.count() > 0) {
        try { await loc.click({ timeout: 3000 }); selected = true; break; } catch (_) { /* next */ }
      }
    }
    if (!selected) {
      const anyRow = page.locator('main span, main div').filter({ hasText: /\w/ }).first();
      try { await anyRow.click({ timeout: 3000 }); selected = true; } catch (_) {}
    }
    record('Select a chapter node', selected, selected ? '' : 'could not click a node');
    await page.waitForTimeout(500);

    // Open Export dropdown.
    let menuOpen = false;
    for (const sel of [
      'button[aria-label^="Export"]', 'button[aria-label*="Export"]',
      'button:has-text("Export")', 'button[title="Export"]', '[data-testid="export-menu"]',
    ]) {
      const loc = page.locator(sel).first();
      if (await loc.count() > 0) {
        try { await loc.click({ timeout: 3000 }); menuOpen = true; break; } catch (_) {}
      }
    }
    await page.waitForTimeout(600);

    const menuItem = page.locator('text=Generate Video').first();
    if (await menuItem.count() === 0) {
      record('Open Generate Video dialog', false, `menuOpen=${menuOpen}, menu item not found`);
      throw new Error('Generate Video menu item not found');
    }
    await menuItem.click();
    await page.waitForTimeout(1200);
    record('Open Generate Video dialog', true, '');
    await page.screenshot({ path: path.join(OUT_DIR, '02-dialog-top.png') });

    // Locate the dialog and its scroll region.
    const dialog = page.locator('[role="dialog"]').first();
    const scrollRegion = dialog.locator('.overflow-y-auto').first();
    const hasScrollRegion = await scrollRegion.count() > 0;
    record('Dialog has a dedicated scroll region', hasScrollRegion, '');

    const innerHeight = await page.evaluate(() => window.innerHeight);

    // (a) The body actually overflows and can scroll.
    let scrollable = false, scrollMetrics = '';
    if (hasScrollRegion) {
      const m = await scrollRegion.evaluate((el) => ({
        scrollHeight: el.scrollHeight, clientHeight: el.clientHeight,
      }));
      scrollable = m.scrollHeight > m.clientHeight + 2;
      scrollMetrics = `scrollHeight=${m.scrollHeight} clientHeight=${m.clientHeight}`;
    }
    record('Options body is scrollable on a short window', scrollable, scrollMetrics);

    // (b) The Generate button is visible WITHOUT scrolling, and within viewport.
    const generateBtn = page.locator('[role="dialog"] button:has-text("Generate")').first();
    const genVisible = await generateBtn.count() > 0 && await generateBtn.isVisible();
    let genInViewport = false, genBox = '';
    if (genVisible) {
      const box = await generateBtn.boundingBox();
      if (box) {
        genInViewport = box.y >= 0 && (box.y + box.height) <= innerHeight + 1;
        genBox = `y=${Math.round(box.y)} bottom=${Math.round(box.y + box.height)} winH=${innerHeight}`;
      }
    }
    record('Generate button visible without scrolling', genVisible, genBox);
    record('Generate button sits inside the window (pinned footer)', genInViewport, genBox);

    // (c) The whole dialog fits within the window height (not running off-screen).
    const dialogBox = await dialog.boundingBox();
    let dialogFits = false, dialogBoxStr = '';
    if (dialogBox) {
      dialogFits = dialogBox.y >= -1 && (dialogBox.y + dialogBox.height) <= innerHeight + 1;
      dialogBoxStr = `top=${Math.round(dialogBox.y)} bottom=${Math.round(dialogBox.y + dialogBox.height)} winH=${innerHeight}`;
    }
    record('Dialog does not run off the bottom of the window', dialogFits, dialogBoxStr);

    // (d) Scroll the body to the bottom and confirm lower controls are reachable.
    if (hasScrollRegion) {
      await scrollRegion.evaluate((el) => { el.scrollTop = el.scrollHeight; });
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: path.join(OUT_DIR, '03-dialog-scrolled-bottom.png') });

    // The "Narrator voice" control lives low in the options — one of the lower
    // controls the fix must keep reachable. After scrolling the body, its first
    // voice radio should sit within the window.
    const voiceRadio = page.locator('[role="dialog"] [id^="vid-voice-"]').first();
    let voiceReached = false, voiceBox = '';
    if (await voiceRadio.count() > 0) {
      const box = await voiceRadio.boundingBox();
      if (box) {
        voiceReached = box.y >= 0 && (box.y + box.height) <= innerHeight + 1;
        voiceBox = `y=${Math.round(box.y)} bottom=${Math.round(box.y + box.height)} winH=${innerHeight}`;
      }
    }
    record('Bottom controls (voice) reachable after scrolling', voiceReached, voiceBox);

    // Footer still pinned/visible after the body scrolled.
    const genStillVisible = await generateBtn.isVisible();
    record('Generate button still visible after scrolling body', genStillVisible, '');

    const passCount = results.filter(r => r.pass).length;
    const report = {
      suite: 'generate-video-scroll',
      when: new Date().toISOString(),
      total: results.length,
      passed: passCount,
      failed: results.length - passCount,
      results,
    };
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(OUT_DIR, 'report.md'),
      `# Generate Video — short-window scroll test\n\n${passCount}/${results.length} passed\n\n` +
      results.map(r => `- ${r.pass ? 'PASS' : 'FAIL'} — ${r.name}${r.detail ? ` (${r.detail})` : ''}`).join('\n') + '\n');

    console.log(`\n${passCount}/${results.length} checks passed`);
  } catch (e) {
    console.error('TEST ERROR:', e && e.message);
    try { if (page) await page.screenshot({ path: path.join(OUT_DIR, 'error.png') }); } catch (_) {}
    record('harness', false, e && e.message);
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify({ suite: 'generate-video-scroll', error: String(e && e.message), results }, null, 2));
  } finally {
    await Promise.race([
      app.close().catch(() => {}),
      new Promise(r => setTimeout(r, 5000)),
    ]);
    const failed = results.filter(r => !r.pass).length;
    process.exit(failed > 0 ? 1 : 0);
  }
})();
