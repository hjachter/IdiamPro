/**
 * Onboarding discoverability test — verifies the three 2026-07-10 wins:
 *   1. "What you can make here" welcome panel: shows for a new-user state,
 *      is skippable, and does NOT reappear after dismissal.
 *   2. Import/Export toolbar icons carry outcome-based value tooltips.
 *   3. One-time "make something from this" Discovery nudge appears and can
 *      be dismissed.
 *
 * NOTE ON TECHNIQUE: the Next dev server keeps a navigation perpetually
 * "pending" (HMR / long-lived requests), which makes Playwright's locator
 * auto-wait ("waiting for navigation to finish") hang. So this test drives
 * and inspects the DOM directly via page.evaluate, polling with plain
 * timeouts — that bypasses the actionability navigation-wait entirely.
 *
 * Run: node tests/onboarding-test.js
 */
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT = path.resolve(__dirname, '..', 'test-screenshots', 'onboarding');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function record(name, pass, note) {
  results.push({ name, pass, note: note || '' });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${note ? ' :: ' + note : ''}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// DOM-visible check that runs in-page (no Playwright auto-wait).
async function isVisibleDom(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  }, selector).catch(() => false);
}

// Poll until a selector is DOM-visible, or timeout.
async function pollVisible(page, selector, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isVisibleDom(page, selector)) return true;
    await sleep(300);
  }
  return false;
}

// Click an element by dispatching a native click in-page.
async function clickDom(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    el.click();
    return true;
  }, selector).catch(() => false);
}

// Navigate to /app and give the SPA time to hydrate (plain timeout — never
// blocks on navigation state). Hops through "/" first so OutlinePro always
// unmounts and remounts fresh, guaranteeing its first-run effects re-run
// (a same-URL href assignment doesn't reliably force a remount in Electron).
async function gotoApp(page) {
  await page.evaluate(() => { window.location.href = '/'; }).catch(() => {});
  await sleep(1500);
  await page.evaluate(() => { window.location.href = '/app'; }).catch(() => {});
  await sleep(6000);
}

async function findMainWindow(app, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    for (const win of app.windows()) {
      try {
        const url = win.url();
        if (url.startsWith('devtools://')) continue;
        if (url.includes('localhost:9002')) return win;
      } catch { /* ignore */ }
    }
    await sleep(500);
  }
  throw new Error('main window not found');
}

(async () => {
  const projectRoot = path.resolve(__dirname, '..');
  const app = await electron.launch({
    args: [projectRoot],
    env: { ...process.env, NODE_ENV: 'development' },
  });
  const page = await findMainWindow(app);
  page.on('dialog', (d) => { d.accept().catch(() => {}); });
  await sleep(3000);

  // Warm up: reach a fully-rendered /app (handles cold dev compile).
  await gotoApp(page);

  // ── Win 1: welcome showcase shows for new-user state ──────────────────
  await page.evaluate(() => {
    try {
      localStorage.removeItem('onboarding:welcomeShowcaseSeen');
      localStorage.removeItem('discovery:professionalMode');
    } catch { /* ignore */ }
  }).catch(() => {});
  await gotoApp(page);

  const diag = await page.evaluate(() => ({
    seenFlag: (() => { try { return localStorage.getItem('onboarding:welcomeShowcaseSeen'); } catch { return 'ERR'; } })(),
    proFlag: (() => { try { return localStorage.getItem('discovery:professionalMode'); } catch { return 'ERR'; } })(),
    showcaseCount: document.querySelectorAll('[data-testid="welcome-showcase"]').length,
    importBtns: document.querySelectorAll('button[aria-label^="Import"]').length,
    url: location.pathname,
  })).catch((e) => ({ err: String(e) }));
  console.log('DIAG win1:', JSON.stringify(diag));

  const visible = await pollVisible(page, '[data-testid="welcome-showcase"]', 20000);
  await page.screenshot({ path: path.join(OUT, '01-welcome-shown.png') }).catch(() => {});
  record('Welcome showcase appears for new user', visible);

  // Skippable / dismissible via "Get started".
  let dismissed = false;
  if (visible) {
    await clickDom(page, '[data-testid="welcome-showcase-start"]');
    await sleep(1000);
    dismissed = !(await isVisibleDom(page, '[data-testid="welcome-showcase"]'));
  }
  await page.screenshot({ path: path.join(OUT, '02-welcome-dismissed.png') }).catch(() => {});
  record('Welcome showcase dismisses on Get started', dismissed);

  // Does NOT reappear after reload.
  await gotoApp(page);
  const reappeared = await isVisibleDom(page, '[data-testid="welcome-showcase"]');
  await page.screenshot({ path: path.join(OUT, '03-welcome-no-reappear.png') }).catch(() => {});
  record('Welcome showcase does NOT reappear after dismiss', !reappeared);

  // ── Win 2: value tooltips on Import & Export ─────────────────────────
  // Value copy lives in BOTH the tooltip AND the aria-label. Assert the
  // aria-label (reliable) and best-effort hover for a visible-tooltip shot.
  const importLabel = await page.evaluate(() => {
    const el = document.querySelector('button[aria-label^="Import"]');
    return el ? el.getAttribute('aria-label') : null;
  }).catch(() => null);
  const importTip = /bring in content from YouTube, PDFs, web pages, and notes/i.test(importLabel || '');
  try { await page.locator('button[aria-label^="Import"]').first().hover({ timeout: 3500 }); await sleep(700); } catch { /* flaky hover */ }
  await page.screenshot({ path: path.join(OUT, '04-import-tooltip.png') }).catch(() => {});
  record('Import tooltip reads by value', importTip);

  const exportLabel = await page.evaluate(() => {
    const el = document.querySelector('button[aria-label^="Export"]');
    return el ? el.getAttribute('aria-label') : null;
  }).catch(() => null);
  const exportTip = /turn this into a video, podcast, website, or 20\+ formats/i.test(exportLabel || '');
  try { await page.locator('button[aria-label^="Export"]').first().hover({ timeout: 3500 }); await sleep(700); } catch { /* flaky */ }
  await page.screenshot({ path: path.join(OUT, '05-export-tooltip.png') }).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  record('Export tooltip reads by value', exportTip);

  // ── Win 3: one-time make-something nudge ─────────────────────────────
  await page.evaluate(() => {
    const f = window.__fireDiscovery;
    if (f) f('outline-has-content');
  }).catch(() => {});
  const nudgeShown = await pollVisible(page, '[data-testid="discovery-toast-make-something-from-this"]', 8000);
  await page.screenshot({ path: path.join(OUT, '06-make-something-nudge.png') }).catch(() => {});
  record('Make-something nudge appears', nudgeShown);

  let nudgeDismissed = false;
  if (nudgeShown) {
    await clickDom(page, '[data-testid="discovery-toast-dismiss-make-something-from-this"]');
    await sleep(900);
    nudgeDismissed = !(await isVisibleDom(page, '[data-testid="discovery-toast-make-something-from-this"]'));
  }
  await page.screenshot({ path: path.join(OUT, '07-nudge-dismissed.png') }).catch(() => {});
  record('Make-something nudge dismissible', nudgeDismissed);

  await app.close();

  const passCount = results.filter((r) => r.pass).length;
  const report = { suite: 'onboarding', total: results.length, passed: passCount, failed: results.length - passCount, results };
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(OUT, 'report.md'), `# Onboarding test\n\n${passCount}/${results.length} passed\n\n` + results.map((r) => `- ${r.pass ? 'PASS' : 'FAIL'} ${r.name}${r.note ? ' — ' + r.note : ''}`).join('\n'));
  console.log(`\n${passCount}/${results.length} passed`);
  process.exit(passCount === results.length ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
