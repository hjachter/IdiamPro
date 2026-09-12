// Settings "Data" section + Settings search — verification suite (2026-09-12).
//
// Founder-mandated Settings improvements (live iMac field test):
//   1. A top-level "Data" section directly after General, holding the
//      relocated outlines-storage block: the CURRENT folder path always
//      visible (middle-truncated, full path in tooltip) with a
//      "Choose Folder…" button beside it, plus the iCloud Drive tip.
//      Privacy & Data keeps everything else it had (nothing deleted).
//   2. A search box pinned at the top of the dialog (both wide and narrow
//      layouts). Typing shows a FLAT list of matching settings from every
//      section (static label+description index, case-insensitive); clicking
//      a result jumps to its section. Gibberish shows the empty state;
//      clear/Esc restores normal browsing.
//
// Run: node tests/settings-data-section-test.js
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

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'settings-data-section');
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

async function dismissBlockingNotices(page) {
  // "Keep your work safe" data-protection notice (and any similar one-off
  // notice with a Got it button) can cover the app on a fresh profile.
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

async function openSettings(page) {
  // The [data-settings-trigger] button is intentionally hidden (display:none) —
  // the App menu opens Settings by DOM-clicking it — so a physical Playwright
  // click cannot land on it. Dispatch the same DOM click the app uses.
  const clicked = await page.evaluate(() => {
    const el = document.querySelector('[data-settings-trigger]');
    if (el) { el.click(); return true; }
    const fallback = document.querySelector('button [class*="lucide-settings"]');
    if (fallback) { fallback.closest('button').click(); return true; }
    return false;
  }).catch(() => false);
  if (!clicked) return false;
  await page.waitForTimeout(800);
  return (await page.locator('[role="dialog"]').count()) > 0;
}

async function setWindowSize(app, width, height) {
  await app.evaluate(async ({ BrowserWindow }, size) => {
    const win = BrowserWindow.getAllWindows().find(
      (w) => !w.webContents.getURL().startsWith('devtools://')
    );
    if (win) {
      // The app enforces minWidth 800 / minHeight 600; lift it for the test so
      // narrow (phone/tablet-width) layouts can actually engage.
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
    // Dismiss the welcome showcase if it's up (fresh profile).
    try {
      const { dismissWelcomeShowcase } = require('./_helpers');
      await dismissWelcomeShowcase(page);
    } catch (_) { /* helper optional */ }
    await dismissBlockingNotices(page);

    // ── 1. Open Settings; Data section sits directly after General ──
    const opened = await openSettings(page);
    record('Open Settings dialog', opened, '');
    if (!opened) throw new Error('Settings dialog did not open');

    const navIds = await page.locator('[data-testid^="settings-nav-"]:not([data-testid="settings-nav-select"])').evaluateAll(
      (els) => els.map((el) => el.getAttribute('data-testid'))
    );
    const gi = navIds.indexOf('settings-nav-general');
    const di = navIds.indexOf('settings-nav-data');
    record('Data section in nav directly after General', gi >= 0 && di === gi + 1, `order=${navIds.join(',')}`);

    // ── 2. Data section: current path prominent + Choose Folder beside it ──
    await page.locator('[data-testid="settings-nav-data"]').click();
    await page.waitForTimeout(500);
    const pathChip = page.locator('[data-testid="data-folder-path"]');
    const pathVisible = await pathChip.isVisible().catch(() => false);
    const pathText = pathVisible ? (await pathChip.innerText()).trim() : '';
    const pathTitle = pathVisible ? (await pathChip.getAttribute('title')) || '' : '';
    record('Current folder path visible in Data section', pathVisible && pathText.length > 0, `text="${pathText}"`);
    record('Full path preserved in tooltip (title attr)', pathTitle.length > 0, `title="${pathTitle}"`);
    const chooseBtn = page.locator('[data-testid="choose-folder-btn"]');
    record('Choose Folder button present beside path', await chooseBtn.isVisible().catch(() => false), '');
    const heading = await page.locator('text=Where your outlines are stored').count();
    record('Value-based heading "Where your outlines are stored"', heading > 0, '');
    const tip = await page.locator('text=iCloud Drive').count();
    record('iCloud Drive tip shown', tip > 0, '');
    await page.screenshot({ path: path.join(OUT_DIR, '01-data-section-light.png') });

    // ── 3. Privacy & Data no longer has the storage block, keeps the rest ──
    await page.locator('[data-testid="settings-nav-privacy"]').click();
    await page.waitForTimeout(500);
    const oldStorage = await page.locator('[role="dialog"] >> text=User Data Folder').count();
    record('Privacy & Data: storage block relocated (no "User Data Folder")', oldStorage === 0, `count=${oldStorage}`);
    const keepConsent = await page.locator('#ai-consent').count();
    const keepExport = await page.locator('[role="dialog"] >> text=Export my data').count();
    const keepDelete = await page.locator('[role="dialog"] >> text=Delete all my data').count();
    record('Privacy & Data keeps AI consent + export + delete', keepConsent > 0 && keepExport > 0 && keepDelete > 0,
      `consent=${keepConsent} export=${keepExport} delete=${keepDelete}`);
    await page.screenshot({ path: path.join(OUT_DIR, '02-privacy-section.png') });

    // ── 4. Search: "folder" finds the storage row from anywhere ──
    const searchInput = page.locator('[data-testid="settings-search-input"]');
    record('Search input pinned at top', await searchInput.isVisible().catch(() => false), '');
    await searchInput.fill('folder');
    await page.waitForTimeout(400);
    const resultData = page.locator('[data-testid="settings-search-result-data"]');
    record('Typing "folder" surfaces the storage setting (Data)', await resultData.count() > 0, '');
    const navHidden = await page.locator('[data-testid="settings-nav-general"]').isVisible().catch(() => false);
    record('Nav replaced by flat results while searching', !navHidden, '');
    await page.screenshot({ path: path.join(OUT_DIR, '03-search-folder.png') });
    await resultData.first().click();
    await page.waitForTimeout(500);
    const jumped = await pathChip.isVisible().catch(() => false);
    const cleared = (await searchInput.inputValue()) === '';
    record('Clicking result jumps to Data section and clears search', jumped && cleared, `jumped=${jumped} cleared=${cleared}`);

    // ── 5. Search: gibberish → empty state; clear restores ──
    await searchInput.fill('zzqxgibberish');
    await page.waitForTimeout(400);
    const emptyState = page.locator('[data-testid="settings-search-empty"]');
    const emptyVisible = await emptyState.isVisible().catch(() => false);
    const emptyText = emptyVisible ? (await emptyState.innerText()).trim() : '';
    record('Gibberish shows empty state', emptyVisible && /No settings match/.test(emptyText), `text="${emptyText}"`);
    await page.screenshot({ path: path.join(OUT_DIR, '04-search-empty.png') });
    await page.locator('[data-testid="settings-search-clear"]').click();
    await page.waitForTimeout(400);
    const navBack = await page.locator('[data-testid="settings-nav-general"]').isVisible().catch(() => false);
    record('Clear button restores normal browsing', navBack, '');

    // ── 6. Esc clears an active search but keeps the dialog open ──
    await searchInput.fill('backup');
    await page.waitForTimeout(300);
    await searchInput.press('Escape');
    await page.waitForTimeout(400);
    const stillOpen = (await page.locator('[role="dialog"]').count()) > 0;
    const escCleared = (await searchInput.inputValue().catch(() => 'x')) === '';
    record('Esc clears search without closing dialog', stillOpen && escCleared, `open=${stillOpen} cleared=${escCleared}`);

    // ── 7. Dark mode screenshot of the Data section ──
    await page.locator('[data-testid="settings-nav-general"]').click();
    await page.waitForTimeout(400);
    await page.locator('#theme-select').click();
    await page.waitForTimeout(300);
    await page.locator('[role="option"]:has-text("Dark")').click();
    await page.waitForTimeout(600);
    await page.locator('[data-testid="settings-nav-data"]').click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT_DIR, '05-data-section-dark.png') });
    const darkPathVisible = await pathChip.isVisible().catch(() => false);
    record('Data section renders in dark mode', darkPathVisible, '');
    // Restore light/auto theme.
    await page.locator('[data-testid="settings-nav-general"]').click();
    await page.waitForTimeout(300);
    await page.locator('#theme-select').click();
    await page.waitForTimeout(300);
    await page.locator('[role="option"]:has-text("Auto")').click();
    await page.waitForTimeout(500);

    // ── 8. Narrow layout (500px): dropdown selector + search above it ──
    await setWindowSize(app, 500, 800);
    await page.waitForTimeout(800);
    // Crossing into the narrow layout remounts the toolbar, which closes the
    // Settings dialog — reopen it the same way the app does.
    if ((await page.locator('[role="dialog"]').count()) === 0) {
      const reopened = await openSettings(page);
      record('Settings reopens in narrow layout', reopened, '');
    }
    const narrowSelect = page.locator('[data-testid="settings-nav-select"]');
    const narrowSelectVisible = await narrowSelect.isVisible().catch(() => false);
    const narrowSearchVisible = await searchInput.isVisible().catch(() => false);
    record('Narrow layout: dropdown selector present', narrowSelectVisible, '');
    record('Narrow layout: search box present above dropdown', narrowSearchVisible, '');
    if (narrowSelectVisible && narrowSearchVisible) {
      const above = await page.evaluate(() => {
        const s = document.querySelector('[data-testid="settings-search-input"]').getBoundingClientRect();
        const d = document.querySelector('[data-testid="settings-nav-select"]').getBoundingClientRect();
        return s.top < d.top;
      });
      record('Narrow layout: search sits above the dropdown', above, '');
    }
    await searchInput.fill('folder');
    await page.waitForTimeout(400);
    record('Narrow layout: search filters too', await resultData.count() > 0, '');
    await page.screenshot({ path: path.join(OUT_DIR, '06-narrow-search.png') });
    await page.locator('[data-testid="settings-search-clear"]').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT_DIR, '07-narrow-data.png') });

    await closeAnyOpenDialog(page);
  } catch (err) {
    record('Suite completed without crash', false, String(err && err.message || err));
    if (page) await page.screenshot({ path: path.join(OUT_DIR, '99-crash.png') }).catch(() => {});
  } finally {
    // app.close() can hang if Electron refuses to quit; never let it stall the suite.
    await Promise.race([
      app.close().catch(() => {}),
      new Promise((r) => setTimeout(r, 15000)),
    ]);
  }

  const passCount = results.filter(r => r.pass).length;
  const failCount = results.length - passCount;
  const report = { suite: 'settings-data-section', date: new Date().toISOString(), pass: passCount, fail: failCount, results };
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'),
    `# Settings Data Section + Search — ${report.date}\n\n${results.map(r => `- ${r.pass ? 'PASS' : 'FAIL'} — ${r.name}${r.detail ? ` (${r.detail})` : ''}`).join('\n')}\n\nTotal: ${passCount} pass / ${failCount} fail\n`);
  console.log(`\n${passCount} pass / ${failCount} fail`);
  process.exit(failCount > 0 ? 1 : 0);
})();
