// AI Activity menu item + dialog — verification suite (2026-09-12).
//
// Wires the finished AiActivityDialog (private on-device AI usage ledger
// viewer) into the AI menu as "AI Activity" (Receipt icon). This test:
//   1. Opens the AI menu and asserts the "AI Activity" item exists.
//   2. Asserts every pre-existing (non-selection-gated) menu item is still
//      present — the wiring must be strictly additive.
//   3. Clicks AI Activity, asserts the dialog opens (empty state or entries
//      both acceptable), screenshots it, and closes it.
//
// Run: node tests/ai-activity-menu-test.js
// Launches its OWN Electron instance (dev server on :9002 must be running);
// never touches any already-running app instance.

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'ai-activity-menu');
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

async function dismissBlockingNotices(page) {
  for (let i = 0; i < 4; i++) {
    const gotIt = page.locator('button:has-text("Got it")').first();
    if (await gotIt.isVisible().catch(() => false)) {
      await gotIt.click().catch(() => {});
      await page.waitForTimeout(500);
      continue;
    }
    break;
  }
}

async function setWindowSize(app, width, height) {
  await app.evaluate(async ({ BrowserWindow }, size) => {
    const win = BrowserWindow.getAllWindows().find(
      (w) => !w.webContents.getURL().startsWith('devtools://')
    );
    if (win) {
      win.setMinimumSize(Math.min(size.width, 800), Math.min(size.height, 600));
      win.setBounds({ x: 40, y: 40, width: size.width, height: size.height });
    }
  }, { width, height });
}

(async () => {
  const projectRoot = path.resolve(__dirname, '..');
  const app = await electron.launch({ args: [projectRoot], env: { ...process.env, NODE_ENV: 'development' } });
  let page;
  try {
    await setWindowSize(app, 1440, 900);
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
    try {
      const helpers = require('./_helpers');
      if (helpers.waitForAppReady) await helpers.waitForAppReady(page);
      if (helpers.dismissWelcomeShowcase) await helpers.dismissWelcomeShowcase(page);
    } catch (_) { /* helper optional */ }
    // The welcome showcase (and other first-run notices) can mount seconds
    // after hydration. Keep clearing overlays until the screen stays clear.
    const overlaySelector = '[data-testid="welcome-showcase"], [role="dialog"], [role="alertdialog"]';
    for (let i = 0; i < 20; i++) {
      const overlayUp = (await page.locator(overlaySelector).count().catch(() => 0)) > 0;
      if (!overlayUp) {
        // Give a late-mounting overlay one more beat to appear, then re-check.
        await page.waitForTimeout(1000);
        if ((await page.locator(overlaySelector).count().catch(() => 0)) === 0) break;
      }
      let clicked = false;
      for (const sel of [
        '[data-testid="welcome-showcase-dont-show"]',
        'button:has-text("Don’t show this again")',
        "button:has-text(\"Don't show this again\")",
        '[data-testid="welcome-showcase-start"]',
        'button:has-text("Get started")',
        'button:has-text("Got it")',
      ]) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible().catch(() => false)) {
          await btn.click({ timeout: 3000 }).catch(() => {});
          clicked = true;
          break;
        }
      }
      if (!clicked) await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(700);
    }
    await dismissBlockingNotices(page);

    // ── 1. Open the AI menu ──
    // Two AI buttons exist (outline toolbar + content pane); use the first.
    const aiButton = page.locator('button[aria-label="AI menu"]').first();
    const aiButtonVisible = await aiButton.isVisible().catch(() => false);
    record('AI menu button visible in toolbar', aiButtonVisible, '');
    if (!aiButtonVisible) throw new Error('AI menu button not found');
    await aiButton.click();
    await page.waitForTimeout(600);
    const menuOpen = (await page.locator('[role="menu"]').count()) > 0;
    record('AI menu opens', menuOpen, '');
    await page.screenshot({ path: path.join(OUT_DIR, '01-ai-menu-open.png') });

    // ── 2. AI Activity item present, plus every pre-existing item ──
    const activityItem = page.locator('[data-testid="ai-menu-ai-activity"]');
    record('"AI Activity" menu item present', await activityItem.isVisible().catch(() => false), '');

    // Pre-existing items that render regardless of node selection.
    const preExisting = [
      'Wizards',
      'Show Me…',
      'Transform outline with AI…',
      'Summarize outline',
      'Generate Suboutline from Topic',
      'Ask Your Outlines',
    ];
    const menuText = await page.locator('[role="menu"]').innerText().catch(() => '');
    for (const label of preExisting) {
      record(`Pre-existing item still present: "${label}"`, menuText.includes(label), '');
    }

    // ── 3. Click AI Activity → dialog opens ──
    await activityItem.click();
    await page.waitForTimeout(800);
    const dialog = page.locator('[data-testid="ai-activity-dialog"]');
    const dialogVisible = await dialog.isVisible().catch(() => false);
    record('AI Activity dialog opens', dialogVisible, '');
    if (dialogVisible) {
      const dialogText = (await dialog.innerText().catch(() => '')) || '';
      record('Dialog titled "AI Activity"', /AI Activity/.test(dialogText), '');
      const hasEmptyState = /No AI activity recorded/.test(dialogText);
      const hasSummary = (await page.locator('[data-testid="ai-activity-summary"]').count()) > 0;
      record('Dialog shows entries/summary or the empty state', hasEmptyState || hasSummary,
        `emptyState=${hasEmptyState} summary=${hasSummary}`);
      record('Privacy footnote present', /No prompts or content are ever\s+recorded|nothing here ever leaves your machine/i.test(dialogText), '');
    }
    await page.screenshot({ path: path.join(OUT_DIR, '02-ai-activity-dialog.png') });

    // ── 4. Close the dialog ──
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const stillOpen = await dialog.isVisible().catch(() => false);
    record('Dialog closes on Escape', !stillOpen, '');
    await page.screenshot({ path: path.join(OUT_DIR, '03-after-close.png') });
  } catch (err) {
    record('Suite completed without crash', false, String(err && err.message || err));
    if (page) await page.screenshot({ path: path.join(OUT_DIR, '99-crash.png') }).catch(() => {});
  } finally {
    await Promise.race([
      app.close().catch(() => {}),
      new Promise((r) => setTimeout(r, 15000)),
    ]);
  }

  const passCount = results.filter(r => r.pass).length;
  const failCount = results.length - passCount;
  const report = { suite: 'ai-activity-menu', date: new Date().toISOString(), pass: passCount, fail: failCount, results };
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'),
    `# AI Activity Menu + Dialog — ${report.date}\n\n${results.map(r => `- ${r.pass ? 'PASS' : 'FAIL'} — ${r.name}${r.detail ? ` (${r.detail})` : ''}`).join('\n')}\n\nTotal: ${passCount} pass / ${failCount} fail\n`);
  console.log(`\n${passCount} pass / ${failCount} fail`);
  process.exit(failCount > 0 ? 1 : 0);
})();
