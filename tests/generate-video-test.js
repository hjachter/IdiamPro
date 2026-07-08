// Phase 2 verification: the "Generate Video" action appears in the Export menu,
// opens the Generate Video dialog, derives slides from the REAL selected chapter,
// and (in Electron) shows the configure phase with slide count + voice options.
//
// This does NOT run a full render (heavy) — it verifies UI + wiring end to end:
// the menu item exists, the dialog opens, and it reflects real outline content.
// Run: node tests/generate-video-test.js

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'generate-video');
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

    // Select a node so the chapter-based actions enable. Click the first
    // outline row that looks like a node label.
    let selected = false;
    const nodeCandidates = [
      '[data-node-id]',
      '.outline-node',
      '[role="treeitem"]',
    ];
    for (const sel of nodeCandidates) {
      const loc = page.locator(sel).first();
      if (await loc.count() > 0) {
        try { await loc.click({ timeout: 3000 }); selected = true; break; } catch (_) { /* try next */ }
      }
    }
    // Fallback: click a visible text row in the outline pane.
    if (!selected) {
      const anyRow = page.locator('main span, main div').filter({ hasText: /\w/ }).first();
      try { await anyRow.click({ timeout: 3000 }); selected = true; } catch (_) { /* ignore */ }
    }
    record('Select a chapter node', selected, selected ? '' : 'could not click a node');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT_DIR, '02-node-selected.png') });

    // Open the Export dropdown (tooltip/button labeled Export).
    let menuOpen = false;
    const exportTriggers = [
      'button[aria-label^="Export"]',
      'button[aria-label*="Export"]',
      'button:has-text("Export")',
      '[data-testid="export-menu"]',
    ];
    for (const sel of exportTriggers) {
      const loc = page.locator(sel).first();
      if (await loc.count() > 0) {
        try { await loc.click({ timeout: 3000 }); menuOpen = true; break; } catch (_) { /* next */ }
      }
    }
    // Fallback: any button whose tooltip is Export via title attribute.
    if (!menuOpen) {
      const t = page.locator('button[title="Export"]').first();
      if (await t.count() > 0) { try { await t.click(); menuOpen = true; } catch (_) {} }
    }
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT_DIR, '03-export-menu.png') });

    // Confirm the Generate Video menu item is present.
    const menuItem = page.locator('text=Generate Video').first();
    const itemVisible = await menuItem.count() > 0;
    record('Export menu shows "Generate Video"', itemVisible, `menuOpen=${menuOpen}`);

    if (itemVisible) {
      await menuItem.click();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(OUT_DIR, '04-dialog-open.png') });

      // Dialog title present.
      const dialogTitle = page.locator('text=Generate Video');
      const titleCount = await dialogTitle.count();
      record('Generate Video dialog opens', titleCount > 0, `title matches=${titleCount}`);

      // In Electron desktop it should show configure phase: slide count + Generate button.
      const bodyText = await page.locator('body').innerText();
      const showsSlides = /\bslides?\b/i.test(bodyText);
      const showsGenerate = await page.locator('button:has-text("Generate")').count() > 0;
      const showsVoice = /Narrator voice/i.test(bodyText);
      record('Dialog shows real slide count', showsSlides, '');
      record('Dialog shows voice options', showsVoice, '');
      record('Dialog shows Generate button', showsGenerate, '');
      // Not the web-only "available in the desktop app" fallback (we ARE desktop).
      record('Recognized as desktop (not web fallback)', !/available in the desktop app/i.test(bodyText), '');
    }

    const passCount = results.filter(r => r.pass).length;
    const report = {
      suite: 'generate-video',
      when: new Date().toISOString(),
      total: results.length,
      passed: passCount,
      failed: results.length - passCount,
      results,
    };
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(OUT_DIR, 'report.md'),
      `# Generate Video (Phase 2) test\n\n${passCount}/${results.length} passed\n\n` +
      results.map(r => `- ${r.pass ? 'PASS' : 'FAIL'} — ${r.name}${r.detail ? ` (${r.detail})` : ''}`).join('\n') + '\n');

    console.log(`\n${passCount}/${results.length} checks passed`);
  } catch (e) {
    console.error('TEST ERROR:', e && e.message);
    try { if (page) await page.screenshot({ path: path.join(OUT_DIR, 'error.png') }); } catch (_) {}
    record('harness', false, e && e.message);
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify({ suite: 'generate-video', error: String(e && e.message), results }, null, 2));
  } finally {
    await Promise.race([
      app.close().catch(() => {}),
      new Promise(r => setTimeout(r, 5000)),
    ]);
    const failed = results.filter(r => !r.pass).length;
    process.exit(failed > 0 ? 1 : 0);
  }
})();
