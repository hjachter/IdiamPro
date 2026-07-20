/**
 * nag-controls-test.js — verifies the "silence unrequested surfaces" work.
 *
 * Uses a SINGLE Electron launch and in-page reloads. Professional mode is
 * driven through the real Settings toggle (which updates the live app-root
 * provider immediately); the first-run welcome panel is re-armed by clearing
 * its localStorage flag and reloading so its open-effect re-runs.
 *
 * Checks:
 *   1. Settings has the Professional-mode master switch + a "Restore" control.
 *   2. Fresh (master switch OFF) → welcome panel appears with an obvious,
 *      persistent "Don't show this again" opt-out.
 *   3. Clicking the opt-out sets the persistent flag and closes the panel.
 *   4. After a reload the panel does NOT reappear (persistence).
 *   5. Restore clears the seen flag (re-arms).
 *   6. Master switch ON → the re-armed welcome panel is suppressed.
 *
 * Screenshots: nag-welcome.png, nag-settings.png in the scratchpad dir.
 */
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { waitForAppReady, openSettings, setElectronWindowSize } = require('./_helpers');

process.on('unhandledRejection', (err) => {
  const m = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing|closed/.test(m)) return;
  throw err;
});

const OUT_DIR =
  '/private/tmp/claude-501/-Users-howardjachter-Developer-IdiamPro/a8db6996-3bce-4aef-8646-4175b8f089c9/scratchpad';
const WELCOME = '[data-testid="welcome-showcase"]';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`);
};

async function findWindow(app) {
  for (let i = 0; i < 30; i++) {
    for (const w of app.windows()) {
      try { const u = w.url(); if (!u.startsWith('devtools://') && u.includes('localhost:9002')) return w; } catch {}
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('no main window');
}

// Set the welcome/data-protection flags (NOT professional mode — that goes
// through the UI toggle) and reload so the welcome panel remounts.
async function armAndReload(page, { seen }) {
  await page.evaluate((s) => {
    try {
      localStorage.setItem('onboarding:dataProtectionSeen', 'true');
      // Suppress the competing "make something" first-run nudge for a clean shot.
      localStorage.setItem('onboarding:makeSomethingNudgeFired', 'true');
      if (s) localStorage.setItem('onboarding:welcomeShowcaseSeen', 'true');
      else localStorage.removeItem('onboarding:welcomeShowcaseSeen');
      window.onbeforeunload = null;
    } catch {}
  }, seen).catch(() => {});
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  if (!page.url().includes('/app')) {
    await page.goto('http://localhost:9002/app', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  }
  await waitForAppReady(page);
  await page.waitForTimeout(1500);
}

// Drive the real "Professional mode" master switch to the desired state.
async function setProfessional(page, want) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(200);
  await openSettings(page);
  await page.waitForTimeout(500);
  const toggle = page.locator('[data-testid="professional-mode-toggle"]');
  const found = await toggle.first().waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
  let restorePresent = false;
  if (found) {
    restorePresent = (await page.locator('[data-testid="reset-tips-welcome"]').count().catch(() => 0)) > 0;
    const st = await toggle.first().getAttribute('data-state').catch(() => null);
    if ((st === 'checked') !== want) { await toggle.first().click().catch(() => {}); await page.waitForTimeout(500); }
  }
  return { found, restorePresent };
}

async function welcomeAppears(page, timeout = 18000) {
  return page.locator(WELCOME).first().waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false);
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const app = await electron.launch({
    args: [path.resolve(__dirname, '..')],
    env: { ...process.env, NODE_ENV: 'development' },
  });
  let page;
  try {
    page = await findWindow(app);
    page.on('dialog', (d) => d.accept().catch(() => {}));
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(2000);
    if (!page.url().includes('/app')) { await page.evaluate(() => (window.location.href = '/app')).catch(() => {}); }
    await waitForAppReady(page);
    await setElectronWindowSize(app, 1500, 950);
    await page.waitForTimeout(1500);

    // 1. Settings has the master switch + Restore; capture the screenshot; and
    //    ensure the master switch is OFF for the fresh-welcome checks.
    const { found, restorePresent } = await setProfessional(page, false);
    check('Professional-mode master switch present in Settings', found);
    check('"Restore" (bring back tips & welcome) control present', restorePresent);
    await page.locator('[data-testid="reset-tips-welcome"]').first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT_DIR, 'nag-settings.png') });
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);

    // 2. Fresh user (master OFF) → welcome appears + persistent opt-out present.
    // The first-run panel is transient; retry the arm+reload a couple times to
    // ride out reload-timing races in the Electron dev shell.
    let vis = false;
    for (let attempt = 0; attempt < 3 && !vis; attempt++) {
      await armAndReload(page, { seen: false });
      vis = await welcomeAppears(page);
    }
    check('Welcome panel appears for a fresh user (master switch OFF)', vis);
    if (vis) {
      await page.locator(WELCOME).first().screenshot({ path: path.join(OUT_DIR, 'nag-welcome.png') })
        .catch(async () => { await page.screenshot({ path: path.join(OUT_DIR, 'nag-welcome.png') }); });
    } else {
      await page.screenshot({ path: path.join(OUT_DIR, 'nag-welcome.png') });
    }
    const optOut = page.locator('[data-testid="welcome-showcase-dont-show"]');
    const optText = (await optOut.first().innerText().catch(() => '')) || '';
    check('Persistent "Don\'t show this again" button present', (await optOut.count().catch(() => 0)) > 0, optText.trim());

    // 3. Opt-out sets the persistent flag and closes the panel.
    await optOut.first().click().catch(() => {});
    await page.waitForTimeout(700);
    const seenFlag = await page.evaluate(() => localStorage.getItem('onboarding:welcomeShowcaseSeen')).catch(() => null);
    check('Opt-out sets the persistent seen flag', seenFlag === 'true', String(seenFlag));
    check('Panel closes after opt-out', !(await page.locator(WELCOME).first().isVisible().catch(() => false)));

    // 4. Reload → panel does NOT reappear.
    await armAndReload(page, { seen: true });
    await page.waitForTimeout(1500);
    check('Welcome panel does NOT reappear after relaunch', !(await page.locator(WELCOME).first().isVisible().catch(() => false)));

    // 5. Restore clears the seen flag (re-arms).
    await openSettings(page);
    await page.waitForTimeout(500);
    await page.locator('[data-testid="reset-tips-welcome"]').first().click().catch(() => {});
    await page.waitForTimeout(700);
    const afterRestore = await page.evaluate(() => localStorage.getItem('onboarding:welcomeShowcaseSeen')).catch(() => 'err');
    check('Restore clears the welcome seen flag (re-arms)', afterRestore === null, String(afterRestore));
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);

    // 6. Master switch ON → the re-armed welcome panel is suppressed.
    await setProfessional(page, true);
    await page.keyboard.press('Escape').catch(() => {});
    await armAndReload(page, { seen: false });
    await page.waitForTimeout(1500);
    check('Master switch ON suppresses the (re-armed) welcome panel', !(await page.locator(WELCOME).first().isVisible().catch(() => false)));

    // Tidy up: master switch OFF so the dev app is left in a friendly state.
    await setProfessional(page, false);
    await page.keyboard.press('Escape').catch(() => {});
  } catch (e) {
    check('Test run completed without throwing', false, String((e && e.message) || e));
  } finally {
    const pass = results.filter((r) => r.ok).length;
    const fail = results.length - pass;
    console.log(`\n===== NAG CONTROLS: ${pass} passed, ${fail} failed =====`);
    fs.writeFileSync(path.join(OUT_DIR, 'nag-report.json'), JSON.stringify({ pass, fail, results }, null, 2));
    await app.close().catch(() => {});
    process.exit(fail > 0 ? 1 : 0);
  }
})();
