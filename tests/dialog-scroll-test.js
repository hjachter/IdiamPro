// UI regression test: EVERY dialog built on the shared DialogContent
// (src/components/ui/dialog.tsx) must cap itself to the viewport and scroll
// its own content when taller than the window — no dialog should run off
// the top/bottom, and no dialog should carry a *second*, nested scroll
// region (double-scroll) fighting the outer one.
//
// This test forces a short Electron window (1200x680) and checks three
// dialogs:
//   1. Generate Video — tall, and until this fix used its own internal
//      flex+pinned-footer scroll region. Confirms it is now ONE scroll
//      region (the DialogContent itself), not clipped, and the Generate
//      button becomes reachable after scrolling to the bottom.
//   2. Settings — tall, a second real-world tall dialog. Confirms it
//      scrolls and a control near the bottom is reachable.
//   3. Quick Capture — short. Confirms it is NOT clipped and NOT
//      stretched to the max-height cap (i.e. it sizes to its content).
//
// Run: node tests/dialog-scroll-test.js

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'dialog-scroll-test');
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

async function closeAnyOpenDialog(page) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const count = await page.locator('[role="dialog"]').count().catch(() => 0);
    if (count === 0) break;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
  }
}

(async () => {
  const projectRoot = path.resolve(__dirname, '..');
  const app = await electron.launch({ args: [projectRoot], env: { ...process.env, NODE_ENV: 'development' } });
  let page;
  try {
    // Force a SHORT window so tall dialogs must scroll to reveal their full content.
    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find(
        (w) => !w.webContents.getURL().startsWith('devtools://')
      );
      if (win) { win.setBounds({ x: 60, y: 40, width: 1200, height: 680 }); }
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
    const innerHeight = await page.evaluate(() => window.innerHeight);
    await page.screenshot({ path: path.join(OUT_DIR, '00-app-loaded.png') });

    // ── 1. GENERATE VIDEO (tall dialog, reconciled to a single scroll region) ──
    let selected = false;
    for (const sel of ['[data-node-id]', '.outline-node', '[role="treeitem"]']) {
      const loc = page.locator(sel).first();
      if (await loc.count() > 0) {
        try { await loc.click({ timeout: 3000 }); selected = true; break; } catch (_) {}
      }
    }
    if (!selected) {
      const anyRow = page.locator('main span, main div').filter({ hasText: /\w/ }).first();
      try { await anyRow.click({ timeout: 3000 }); selected = true; } catch (_) {}
    }
    record('Select a chapter node (enables Generate Video)', selected, selected ? '' : 'could not click a node');
    await page.waitForTimeout(500);

    let exportMenuOpened = false;
    for (const sel of [
      'button[aria-label^="Export"]', 'button[aria-label*="Export"]',
      'button:has-text("Export")', 'button[title="Export"]',
    ]) {
      const loc = page.locator(sel).first();
      if (await loc.count() > 0) {
        try { await loc.click({ timeout: 3000 }); exportMenuOpened = true; break; } catch (_) {}
      }
    }
    await page.waitForTimeout(600);

    const genVideoItem = page.locator('text=Generate Video').first();
    if (exportMenuOpened && await genVideoItem.count() > 0) {
      await genVideoItem.click();
      await page.waitForTimeout(1200);
      record('Open Generate Video dialog', true, '');
      await page.screenshot({ path: path.join(OUT_DIR, '01-generate-video-top.png') });

      const dialog = page.locator('[role="dialog"]').first();
      const dialogBoxTop = await dialog.boundingBox();
      let notClippedTop = false, topStr = '';
      if (dialogBoxTop) {
        notClippedTop = dialogBoxTop.y >= -1 && (dialogBoxTop.y + dialogBoxTop.height) <= innerHeight + 2;
        topStr = `top=${Math.round(dialogBoxTop.y)} bottom=${Math.round(dialogBoxTop.y + dialogBoxTop.height)} winH=${innerHeight}`;
      }
      record('Generate Video dialog fits within window (not clipped top/bottom)', notClippedTop, topStr);

      // The dialog element (role=dialog) IS the scroll region now — no nested wrapper.
      const metrics = await dialog.evaluate((el) => ({
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        overflowY: getComputedStyle(el).overflowY,
      }));
      const isScrollable = metrics.scrollHeight > metrics.clientHeight + 2 && metrics.overflowY === 'auto';
      record('Generate Video dialog is one scrollable region (no inner wrapper)', isScrollable,
        `scrollHeight=${metrics.scrollHeight} clientHeight=${metrics.clientHeight} overflowY=${metrics.overflowY}`);

      // No leftover inner "flex-1 min-h-0 overflow-y-auto" wrapper (the old double-scroll div).
      const innerWrapperCount = await dialog.locator('.overflow-y-auto').count();
      record('No nested overflow-y-auto wrapper remains inside Generate Video dialog', innerWrapperCount === 0,
        `nested overflow-y-auto elements found: ${innerWrapperCount}`);

      await dialog.evaluate((el) => { el.scrollTop = el.scrollHeight; });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT_DIR, '02-generate-video-scrolled-bottom.png') });

      const generateBtn = page.locator('[role="dialog"] button:has-text("Generate")').first();
      let genReachable = false, genBoxStr = '';
      if (await generateBtn.count() > 0) {
        const box = await generateBtn.boundingBox();
        if (box) {
          genReachable = box.y >= 0 && (box.y + box.height) <= innerHeight + 1;
          genBoxStr = `y=${Math.round(box.y)} bottom=${Math.round(box.y + box.height)} winH=${innerHeight}`;
        }
      }
      record('Generate button reachable after scrolling to bottom', genReachable, genBoxStr);
    } else {
      record('Open Generate Video dialog', false, `exportMenuOpened=${exportMenuOpened}, menu item found=${await genVideoItem.count() > 0}`);
    }
    await closeAnyOpenDialog(page);

    // ── 2. SETTINGS (second tall dialog) ──
    let settingsOpened = false;
    const settingsBtn = page.locator('[data-settings-trigger], button:has(.lucide-settings), [aria-label*="Settings"]').first();
    if (await settingsBtn.count() > 0) {
      try { await settingsBtn.click({ force: true, timeout: 3000 }); settingsOpened = true; } catch (_) {}
    }
    await page.waitForTimeout(1000);
    record('Open Settings dialog', settingsOpened, '');

    if (settingsOpened && await page.locator('[role="dialog"]').count() > 0) {
      // The default "General" tab is short at this window height — switch to
      // a content-heavy tab (AI / Account) so there is actually something to
      // scroll, matching the "second tall dialog" intent of this check.
      for (const tabSel of ['[role="dialog"] :text("AI")', '[role="dialog"] :text("Account")']) {
        const tab = page.locator(tabSel).first();
        if (await tab.count() > 0) {
          try { await tab.click({ timeout: 2000 }); await page.waitForTimeout(500); break; } catch (_) {}
        }
      }
      await page.screenshot({ path: path.join(OUT_DIR, '03-settings-top.png') });
      const settingsDialog = page.locator('[role="dialog"]').first();
      const sBoxTop = await settingsDialog.boundingBox();
      let sNotClipped = false, sTopStr = '';
      if (sBoxTop) {
        sNotClipped = sBoxTop.y >= -1 && (sBoxTop.y + sBoxTop.height) <= innerHeight + 2;
        sTopStr = `top=${Math.round(sBoxTop.y)} bottom=${Math.round(sBoxTop.y + sBoxTop.height)} winH=${innerHeight}`;
      }
      record('Settings dialog fits within window (not clipped)', sNotClipped, sTopStr);

      const sMetrics = await settingsDialog.evaluate((el) => ({
        scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, overflowY: getComputedStyle(el).overflowY,
      }));
      const sScrollable = sMetrics.scrollHeight > sMetrics.clientHeight + 2;
      record('Settings dialog scrolls on a short window', sScrollable,
        `scrollHeight=${sMetrics.scrollHeight} clientHeight=${sMetrics.clientHeight} overflowY=${sMetrics.overflowY}`);

      await settingsDialog.evaluate((el) => { el.scrollTop = el.scrollHeight; });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT_DIR, '04-settings-scrolled-bottom.png') });

      // "Close" button in the Settings footer is a stand-in primary/anchor action.
      const closeBtn = page.locator('[role="dialog"] button:has-text("Close")').first();
      let closeReachable = false, closeBoxStr = '';
      if (await closeBtn.count() > 0) {
        const box = await closeBtn.boundingBox();
        if (box) {
          closeReachable = box.y >= 0 && (box.y + box.height) <= innerHeight + 1;
          closeBoxStr = `y=${Math.round(box.y)} bottom=${Math.round(box.y + box.height)} winH=${innerHeight}`;
        }
      }
      record('Settings footer action reachable after scrolling to bottom', closeReachable, closeBoxStr);
    }
    await closeAnyOpenDialog(page);

    // ── 3. QUICK CAPTURE (short dialog — must size to content, not stretch) ──
    let quickCaptureOpened = false;
    const brainMenuBtn = page.locator('[aria-label="Second Brain menu"], button:has-text("Second Brain")').first();
    if (await brainMenuBtn.count() > 0) {
      try { await brainMenuBtn.click({ timeout: 3000 }); quickCaptureOpened = true; } catch (_) {}
    }
    await page.waitForTimeout(500);
    if (quickCaptureOpened) {
      const qcItem = page.locator('text=Quick Capture').first();
      if (await qcItem.count() > 0) {
        try { await qcItem.click({ timeout: 3000 }); } catch (_) { quickCaptureOpened = false; }
      } else {
        quickCaptureOpened = false;
      }
    }
    await page.waitForTimeout(800);
    record('Open Quick Capture dialog', quickCaptureOpened, '');

    if (quickCaptureOpened && await page.locator('[role="dialog"]').count() > 0) {
      await page.screenshot({ path: path.join(OUT_DIR, '05-quick-capture.png') });
      const qcDialog = page.locator('[role="dialog"]').first();
      const qcBox = await qcDialog.boundingBox();
      const qcMetrics = await qcDialog.evaluate((el) => ({
        scrollHeight: el.scrollHeight, clientHeight: el.clientHeight,
      }));
      let qcNotClipped = false, qcNotStretched = false, qcStr = '';
      if (qcBox) {
        qcNotClipped = qcBox.y >= -1 && (qcBox.y + qcBox.height) <= innerHeight + 2;
        // "Not stretched to max-height" — a short dialog's rendered box should be
        // noticeably smaller than the ~90dvh cap, and its content should not
        // need to scroll (scrollHeight ~= clientHeight).
        const capPx = innerHeight * 0.9;
        qcNotStretched = qcBox.height < capPx - 20 && qcMetrics.scrollHeight <= qcMetrics.clientHeight + 2;
        qcStr = `boxH=${Math.round(qcBox.height)} capPx=${Math.round(capPx)} scrollHeight=${qcMetrics.scrollHeight} clientHeight=${qcMetrics.clientHeight}`;
      }
      record('Quick Capture dialog is not clipped', qcNotClipped, qcStr);
      record('Quick Capture dialog sizes to content (not stretched to max-height)', qcNotStretched, qcStr);
    }
    await closeAnyOpenDialog(page);

    const passCount = results.filter(r => r.pass).length;
    const report = {
      suite: 'dialog-scroll-test',
      when: new Date().toISOString(),
      total: results.length,
      passed: passCount,
      failed: results.length - passCount,
      results,
    };
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(OUT_DIR, 'report.md'),
      `# Dialog scroll test — shared DialogContent cap+scroll\n\n${passCount}/${results.length} passed\n\n` +
      results.map(r => `- ${r.pass ? 'PASS' : 'FAIL'} — ${r.name}${r.detail ? ` (${r.detail})` : ''}`).join('\n') + '\n');

    console.log(`\n${passCount}/${results.length} checks passed`);
  } catch (e) {
    console.error('TEST ERROR:', e && e.message);
    try { if (page) await page.screenshot({ path: path.join(OUT_DIR, 'error.png') }); } catch (_) {}
    record('harness', false, e && e.message);
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify({ suite: 'dialog-scroll-test', error: String(e && e.message), results }, null, 2));
  } finally {
    await Promise.race([
      app.close().catch(() => {}),
      new Promise(r => setTimeout(r, 5000)),
    ]);
    const failed = results.filter(r => !r.pass).length;
    process.exit(failed > 0 ? 1 : 0);
  }
})();
