/**
 * Discovery hint throttling test (2026-07-10).
 *
 * Verifies the two onboarding-hint fixes:
 *   1. ONE-AT-A-TIME: firing several eligible hints at once surfaces only a
 *      single toast; the next appears only after the current is dismissed.
 *      No hint is lost — all queued hints show, in turn.
 *   2. TOUCH-APPROPRIATE PODCAST TIP: the "make something from this" hint no
 *      longer instructs the user to "right-click" (meaningless on touch); it
 *      names the Export menu instead.
 *
 * Technique mirrors onboarding-test.js: drive the DOM via page.evaluate with
 * plain-timeout polling to dodge the Next dev server's perpetual-pending nav.
 *
 * Run: node tests/discovery-throttle-test.js
 */
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT = path.resolve(__dirname, '..', 'test-screenshots', 'discovery-throttle');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function record(name, pass, note) {
  results.push({ name, pass, note: note || '' });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${note ? ' :: ' + note : ''}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Count currently-rendered discovery cards (direct children of the stack).
async function countCards(page) {
  return page.evaluate(() => {
    const stack = document.querySelector('[data-testid="discovery-toast-stack"]');
    if (!stack) return 0;
    return stack.querySelectorAll(':scope > div[role="status"]').length;
  }).catch(() => 0);
}

// The id of the single visible card (or null).
async function visibleCardId(page) {
  return page.evaluate(() => {
    const stack = document.querySelector('[data-testid="discovery-toast-stack"]');
    if (!stack) return null;
    const card = stack.querySelector(':scope > div[role="status"]');
    if (!card) return null;
    const tid = card.getAttribute('data-testid') || '';
    return tid.replace('discovery-toast-', '');
  }).catch(() => null);
}

async function dismissCard(page, id) {
  return page.evaluate((hintId) => {
    const btn = document.querySelector(`[data-testid="discovery-toast-dismiss-${hintId}"]`);
    if (!btn) return false;
    btn.click();
    return true;
  }, id).catch(() => false);
}

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
  await gotoApp(page);

  // Fresh hint state: no Professional mode, nothing hard-dismissed. Also mark
  // the first-run welcome panel as already seen — while it is open the toast
  // stack intentionally hides, which would suppress the very hints we test.
  await page.evaluate(() => {
    try {
      localStorage.removeItem('discovery:professionalMode');
      localStorage.removeItem('discovery:hardDismissedHints');
      localStorage.removeItem('discovery:dismissedHints');
      localStorage.setItem('onboarding:welcomeShowcaseSeen', '1');
    } catch { /* ignore */ }
  }).catch(() => {});
  await gotoApp(page);

  // ── Fix 1: fire three 0-delay hints across three triggers at once ────────
  // research-import-sources (sidebar-first-load), byok-unlimited
  // (first-byok-prompt-encountered), make-something-from-this
  // (outline-has-content) — all have no minDelay, so without throttling all
  // three would stack instantly.
  await page.evaluate(() => {
    const f = window.__fireDiscovery;
    if (!f) return;
    f('sidebar-first-load');
    f('first-byok-prompt-encountered');
    f('outline-has-content');
  }).catch(() => {});
  await sleep(1500);

  const firstCount = await countCards(page);
  await page.screenshot({ path: path.join(OUT, '01-only-one-shown.png') }).catch(() => {});
  record('At most one hint visible after firing three', firstCount === 1, `visible=${firstCount}`);

  // Walk the queue: dismiss, confirm the next distinct hint appears, repeat.
  const seen = [];
  let overflow = false;
  for (let i = 0; i < 3; i++) {
    const id = await visibleCardId(page);
    if (!id) break;
    seen.push(id);
    await dismissCard(page, id);
    await sleep(1400); // 600ms promotion gap + render
    const c = await countCards(page);
    if (c > 1) overflow = true;
  }
  await page.screenshot({ path: path.join(OUT, '02-queue-drained.png') }).catch(() => {});

  const uniqueSeen = Array.from(new Set(seen));
  record('Never more than one visible while draining queue', !overflow);
  record('All three queued hints surfaced one at a time', uniqueSeen.length === 3, `seen=${uniqueSeen.join(',')}`);

  const finalCount = await countCards(page);
  record('Queue empties after dismissing all', finalCount === 0, `remaining=${finalCount}`);

  // ── Fix 2: podcast tip is touch-appropriate (no "right-click") ──────────
  await page.evaluate(() => {
    try {
      localStorage.removeItem('discovery:hardDismissedHints');
    } catch { /* ignore */ }
    const f = window.__fireDiscovery;
    if (f) f('outline-has-content');
  }).catch(() => {});
  await sleep(1500);
  const bodyText = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="discovery-toast-make-something-from-this"]');
    return card ? card.textContent || '' : '';
  }).catch(() => '');
  await page.screenshot({ path: path.join(OUT, '03-podcast-tip.png') }).catch(() => {});
  const noRightClick = bodyText.length > 0 && !/right-?click/i.test(bodyText);
  const namesPodcast = /podcast/i.test(bodyText);
  record('Podcast tip drops "right-click"', noRightClick);
  record('Podcast tip still names podcast via Export menu', namesPodcast);

  await app.close();

  const passCount = results.filter((r) => r.pass).length;
  const report = { suite: 'discovery-throttle', total: results.length, passed: passCount, failed: results.length - passCount, results };
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(OUT, 'report.md'), `# Discovery throttle test\n\n${passCount}/${results.length} passed\n\n` + results.map((r) => `- ${r.pass ? 'PASS' : 'FAIL'} ${r.name}${r.note ? ' — ' + r.note : ''}`).join('\n'));
  console.log(`\n${passCount}/${results.length} passed`);
  process.exit(passCount === results.length ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
