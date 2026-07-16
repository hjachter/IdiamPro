// Playwright suite for the first-run Data Protection Notice
// (src/components/data-protection-notice.tsx).
//
// Verifies:
//   1. With the first-run flag cleared, the red "Keep your work safe" notice
//      appears immediately on the first /app load.
//   2. Screenshot captured for visual inspection.
//   3. Clicking "Got it" dismisses it.
//   4. Navigating away and back does NOT bring it back (flag persisted).

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const SCREENSHOT_DIR =
  '/private/tmp/claude-501/-Users-howardjachter-Developer-IdiamPro/a8db6996-3bce-4aef-8646-4175b8f089c9/scratchpad';
const REPORT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'data-protection-notice');

const SEEN_KEY = 'onboarding:dataProtectionSeen';
const MUTED_KEY = 'onboarding:dataProtectionMuted';
const WELCOME_SEEN_KEY = 'onboarding:welcomeShowcaseSeen';

async function findMainWindow(app, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    for (const win of app.windows()) {
      try {
        const url = win.url();
        if (url.startsWith('devtools://')) continue;
        if (url.includes('localhost:9002')) return win;
      } catch {}
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Could not find main app window');
}

async function gotoApp(page) {
  await page.evaluate(() => { window.location.href = '/app'; });
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(3500);
}

// Poll for a selector's visibility via evaluate (does NOT auto-wait on
// navigation, which is what wedged locator.waitFor in this Electron shell).
async function pollVisible(page, selector, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const vis = await page
      .evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }, selector)
      .catch(() => false);
    if (vis) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

(async () => {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const results = { name: 'data-protection-notice', steps: [], passed: false };
  let app;
  try {
    app = await electron.launch({
      args: [path.resolve(__dirname, '..')],
      env: { ...process.env, NODE_ENV: 'development' },
    });
    const page = await findMainWindow(app);
    // Accept any beforeunload dialog so window.location navigations proceed
    // instead of being cancelled by Playwright's default (dismiss) handler.
    page.on('dialog', (d) => d.accept().catch(() => {}));
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500);

    // We're on localhost:9002 (marketing). localStorage is shared per-origin,
    // so clear the first-run flags HERE, before ever loading /app. This makes
    // the very first /app render a genuine "brand new user" first run — no
    // reload needed (reload's load-event is flaky in Electron).
    await page.evaluate(([seen, muted, welcome]) => {
      try {
        window.localStorage.removeItem(seen);
        window.localStorage.removeItem(muted);
        // Mark the welcome showcase seen so ONLY the data-protection notice
        // is under test (they are sequenced; welcome would otherwise queue).
        window.localStorage.setItem(welcome, 'true');
      } catch {}
    }, [SEEN_KEY, MUTED_KEY, WELCOME_SEEN_KEY]);

    // First /app load as a brand-new user.
    await gotoApp(page);

    const noticeSel = '[data-testid="data-protection-notice"]';
    const appeared = await pollVisible(page, noticeSel, 25000);
    if (!appeared) throw new Error('Notice did not appear on first /app load');
    results.steps.push('Notice appeared immediately on first run: PASS');

    // Confirm the key title copy is present in the dialog.
    const titleOk = await page
      .evaluate((sel) => {
        const el = document.querySelector(sel);
        return !!el && /Keep your work safe/.test(el.textContent || '');
      }, noticeSel)
      .catch(() => false);
    results.steps.push('Title "Keep your work safe" present: ' + (titleOk ? 'PASS' : 'FAIL'));

    // Capture the polished screenshot for inspection.
    const shotPath = path.join(SCREENSHOT_DIR, 'firstrun-notice.png');
    await page.screenshot({ path: shotPath });
    await page.screenshot({ path: path.join(REPORT_DIR, 'firstrun-notice.png') });
    results.steps.push('Screenshot saved: ' + shotPath);

    // Dismiss via "Got it" (evaluate-click avoids locator navigation waits).
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="data-protection-got-it"]');
      if (btn) btn.click();
    });
    await page.waitForTimeout(1200);
    const stillVisible = await page
      .evaluate((sel) => !!document.querySelector(sel), noticeSel)
      .catch(() => true);
    results.steps.push('Dismissed via Got it: ' + (!stillVisible ? 'PASS' : 'FAIL'));

    // Verify the flag persisted.
    const seenVal = await page.evaluate((k) => window.localStorage.getItem(k), SEEN_KEY);
    results.steps.push('localStorage seen flag persisted: ' + (seenVal === 'true' ? 'PASS' : 'FAIL (' + seenVal + ')'));

    // Navigate away and back — should NOT reappear.
    await page.evaluate(() => { window.location.href = '/'; });
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(1500);
    await gotoApp(page);
    await page.waitForTimeout(2500);
    const reappeared = await page
      .evaluate((sel) => !!document.querySelector(sel), noticeSel)
      .catch(() => false);
    if (reappeared) throw new Error('Notice reappeared after dismissal + re-navigation');
    results.steps.push('Did NOT reappear after re-navigation: PASS');

    results.passed = !results.steps.some((s) => /FAIL/.test(s));
    console.log(results.passed ? 'ALL STEPS PASSED' : 'SOME STEPS FAILED');
    results.steps.forEach((s) => console.log('  ' + s));
  } catch (e) {
    results.error = String((e && e.stack) || e);
    console.error('FAILED:', results.error);
  } finally {
    fs.writeFileSync(path.join(REPORT_DIR, 'report.json'), JSON.stringify(results, null, 2));
    if (app) {
      await Promise.race([
        app.close().catch(() => {}),
        new Promise((r) => setTimeout(r, 5000)),
      ]);
    }
    process.exit(results.passed ? 0 : 1);
  }
})();
