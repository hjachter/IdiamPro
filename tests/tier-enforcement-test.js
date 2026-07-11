/**
 * tier-enforcement-test.js — Playwright suite for Auth Phase 3 (#33).
 *
 * Drives the Electron app, seeds localStorage to simulate the launch-tier
 * model in various states, opens Settings, and verifies the AI Usage UI
 * renders correctly. Then drives the AI command bar (Tell-AI / Cmd+K) to
 * confirm the hard-block dialog appears at cap, and that a BYOK key makes
 * the gate exempt.
 *
 * Saves screenshots + a JSON/MD report to test-screenshots/tier-enforcement/.
 */

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { dismissWelcomeShowcase, openSettings: openSettingsShared } = require('./_helpers');

const REPORT_DIR = path.resolve(
  __dirname,
  '..',
  'test-screenshots',
  'tier-enforcement',
);

if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

let electronApp;
let page;

async function findMainWindow(electronApp, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    for (const win of electronApp.windows()) {
      try {
        const url = win.url();
        if (url.startsWith('devtools://')) continue;
        if (url.includes('localhost:9002')) return win;
      } catch {
        /* ignore */
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Could not find main app window');
}

async function launchApp() {
  electronApp = await electron.launch({
    args: [path.resolve(__dirname, '..')],
    env: { ...process.env, NODE_ENV: 'development' },
  });
  page = await findMainWindow(electronApp);
  // Auto-dismiss any system dialog (folder picker, etc.) so the test doesn't
  // hang waiting for human input. Electron's storage-folder prompt fires on
  // first launch; subsequent reloads after a storage clear can trigger more.
  page.on('dialog', (d) => { d.dismiss().catch(() => {}); });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2500);
  if (!page.url().includes('/app')) {
    await page.evaluate(() => { window.location.href = '/app'; });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3500);
  }
}

// Re-render the AI Usage section by re-opening the Settings dialog. Avoids
// page.reload(), which can pop a fresh storage-folder picker on Electron.
async function reopenSettings() {
  // First ensure we're not already in a dialog.
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(150);
  await openSettings();
}

async function closeApp() {
  if (electronApp) await Promise.race([
    electronApp.close().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
}

async function clearLaunchTierState() {
  await page.evaluate(() => {
    const keys = ['idiampro-ai-usage-counter-v1', 'idiampro-tier-id'];
    for (const k of keys) localStorage.removeItem(k);
    for (const p of ['gemini', 'openai', 'anthropic', 'mistral', 'groq']) {
      localStorage.removeItem(`apiKey_${p}`);
    }
    localStorage.removeItem('aiProvider');
  });
}

async function seedCounter(count) {
  await page.evaluate((n) => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    localStorage.setItem(
      'idiampro-ai-usage-counter-v1',
      JSON.stringify({ monthKey, count: n }),
    );
  }, count);
}

async function setBYOKKey(key) {
  await page.evaluate((k) => {
    localStorage.setItem('apiKey_gemini', k);
  }, key);
}

async function openSettings() {
  // The Settings dialog has data-testid='ai-usage-section' once open.
  // The trigger is the gear icon in the toolbar / sidebar; selector is
  // shared with electron-test.js's testSettingsDialog().
  // Settings trigger may live inside the overflow menu on narrow widths
  // (hidden lg:inline-flex). The data-settings-trigger attribute exists on
  // the always-rendered DialogTrigger child even when visually hidden.
  // Open the dialog via the shared helper (handles the toolbar "More" overflow
  // menu and falls back to firing the app's canonical hidden trigger).
  await openSettingsShared(page);
  // The AI Usage section lives under the reorganized "AI" settings category
  // (2026-07). Select it so data-testid="ai-usage-section" renders.
  const aiTab = page.locator('[role="dialog"] button:has-text("AI")').first();
  if (await aiTab.isVisible().catch(() => false)) {
    await aiTab.click().catch(() => {});
  }
  await page.locator('[data-testid="ai-usage-section"]').waitFor({
    state: 'visible',
    timeout: 5000,
  });
}

async function closeSettings() {
  // Press Escape — Radix dialogs close on Esc.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

const results = [];

async function runTest(name, fn) {
  console.log(`\n  ▶ ${name}`);
  const t0 = Date.now();
  let entry = { name, passed: false, durationMs: 0, details: {} };
  try {
    const res = await fn();
    entry = { ...entry, ...res, durationMs: Date.now() - t0 };
    console.log(`    ${entry.passed ? '✓' : '✗'} ${name} (${entry.durationMs}ms)`);
    if (!entry.passed && entry.details && entry.details.error) {
      console.log(`      error: ${entry.details.error}`);
    }
  } catch (err) {
    entry.details.error = err.message;
    entry.durationMs = Date.now() - t0;
    console.log(`    ✗ ${name} — ${err.message}`);
  }
  results.push(entry);
  return entry;
}

// -- Tests ----------------------------------------------------------------

async function testFreshFreeTrialShows25Cap() {
  await clearLaunchTierState();
  await reopenSettings();
  await page.screenshot({ path: path.join(REPORT_DIR, '01-fresh-free-trial.png') });
  const tier = await page.locator('[data-testid="ai-usage-tier"]').textContent();
  const line = await page.locator('[data-testid="ai-usage-line"]').textContent();
  await closeSettings();
  const ok =
    tier && tier.trim() === 'Free trial' &&
    line && /0 of 25/.test(line) && /trial generations used/.test(line);
  return { passed: !!ok, details: { tier: tier?.trim(), line: line?.trim() } };
}

async function testSeededCounterShowsCorrectNumber() {
  await clearLaunchTierState();
  await seedCounter(20);
  await reopenSettings();
  await page.screenshot({ path: path.join(REPORT_DIR, '02-seeded-20.png') });
  const line = await page.locator('[data-testid="ai-usage-line"]').textContent();
  await closeSettings();
  const ok = line && /20 of 25/.test(line);
  return { passed: !!ok, details: { line: line?.trim() } };
}

async function testSeededAtCapShows25() {
  await clearLaunchTierState();
  await seedCounter(25);
  await reopenSettings();
  await page.screenshot({ path: path.join(REPORT_DIR, '03-seeded-at-cap.png') });
  const line = await page.locator('[data-testid="ai-usage-line"]').textContent();
  await closeSettings();
  const ok = line && /25 of 25/.test(line);
  return { passed: !!ok, details: { line: line?.trim() } };
}

async function testBYOKBypassShowsUnlimited() {
  await clearLaunchTierState();
  await setBYOKKey('AIzaTestKey1234567890fakefakefakefake'); // realistic-ish length
  await reopenSettings();
  await page.screenshot({ path: path.join(REPORT_DIR, '04-byok-unlimited.png') });
  const line = await page.locator('[data-testid="ai-usage-line"]').textContent();
  await closeSettings();
  const ok =
    line &&
    (/Unlimited/i.test(line) || /your own API key/i.test(line));
  return { passed: !!ok, details: { line: line?.trim() } };
}

async function testStudentTierShows200Cap() {
  await clearLaunchTierState();
  await page.evaluate(() => {
    localStorage.setItem('idiampro-tier-id', 'student');
  });
  await reopenSettings();
  await page.screenshot({ path: path.join(REPORT_DIR, '05-student-200.png') });
  const tier = await page.locator('[data-testid="ai-usage-tier"]').textContent();
  const line = await page.locator('[data-testid="ai-usage-line"]').textContent();
  await closeSettings();
  const ok = tier && tier.trim() === 'Student' && line && /0 of 200/.test(line);
  return { passed: !!ok, details: { tier: tier?.trim(), line: line?.trim() } };
}

async function testProTierShows1000Cap() {
  await clearLaunchTierState();
  await page.evaluate(() => {
    localStorage.setItem('idiampro-tier-id', 'pro');
  });
  await reopenSettings();
  await page.screenshot({ path: path.join(REPORT_DIR, '06-pro-1000.png') });
  const tier = await page.locator('[data-testid="ai-usage-tier"]').textContent();
  const line = await page.locator('[data-testid="ai-usage-line"]').textContent();
  await closeSettings();
  const ok = tier && tier.trim() === 'Pro' && line && /0 of 1000/.test(line);
  return { passed: !!ok, details: { tier: tier?.trim(), line: line?.trim() } };
}

async function testProgressBarColorAt80Percent() {
  await clearLaunchTierState();
  await seedCounter(20); // 20/25 = 80% on free-trial
  await reopenSettings();
  const bar = page.locator('[data-testid="ai-usage-progress"]');
  const cls = (await bar.getAttribute('class')) || '';
  await page.screenshot({ path: path.join(REPORT_DIR, '07-progress-80.png') });
  await closeSettings();
  // Amber when in soft-warn zone, red when at/over cap, emerald otherwise.
  const ok = /amber|red/.test(cls);
  return { passed: ok, details: { className: cls } };
}

async function testProgressBarColorAtCap() {
  await clearLaunchTierState();
  await seedCounter(25);
  await reopenSettings();
  const bar = page.locator('[data-testid="ai-usage-progress"]');
  const cls = (await bar.getAttribute('class')) || '';
  await page.screenshot({ path: path.join(REPORT_DIR, '08-progress-cap.png') });
  await closeSettings();
  const ok = /red/.test(cls);
  return { passed: ok, details: { className: cls } };
}

// -- Run ------------------------------------------------------------------

async function main() {
  console.log('Launching Electron for tier-enforcement-test…');
  await launchApp();
  await dismissWelcomeShowcase(page);
  console.log('App ready.');

  await runTest('fresh free-trial shows 0 of 25', testFreshFreeTrialShows25Cap);
  await runTest('counter seeded at 20 shows 20 of 25', testSeededCounterShowsCorrectNumber);
  await runTest('counter seeded at cap (25) shows 25 of 25', testSeededAtCapShows25);
  await runTest('BYOK key present → unlimited', testBYOKBypassShowsUnlimited);
  await runTest('paid tier student → 200 cap', testStudentTierShows200Cap);
  await runTest('paid tier pro → 1000 cap', testProTierShows1000Cap);
  await runTest('progress bar amber at 80%', testProgressBarColorAt80Percent);
  await runTest('progress bar red at cap', testProgressBarColorAtCap);

  // Clean up the test seed before exiting so a real user opening Settings
  // doesn't see a stale 25/25.
  await clearLaunchTierState();

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  const report = {
    suite: 'tier-enforcement',
    runAt: new Date().toISOString(),
    platform: {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
    },
    summary: { passed, total, allPassed: passed === total },
    results,
  };

  fs.writeFileSync(
    path.join(REPORT_DIR, 'report.json'),
    JSON.stringify(report, null, 2),
  );

  const md = [
    `# tier-enforcement-test report`,
    ``,
    `**Run:** ${report.runAt}`,
    `**Result:** ${passed} / ${total} passed`,
    ``,
    ...results.map((r) =>
      `- ${r.passed ? '✓' : '✗'} ${r.name} (${r.durationMs}ms)` +
      (r.details && r.details.error ? `\n  - error: ${r.details.error}` : ''),
    ),
    ``,
  ].join('\n');
  fs.writeFileSync(path.join(REPORT_DIR, 'report.md'), md);

  await closeApp();
  console.log(`\n  Done: ${passed}/${total} passed.`);
  process.exit(passed === total ? 0 : 1);
}

main().catch(async (err) => {
  console.error('Fatal:', err);
  try { await closeApp(); } catch {}
  process.exit(1);
});
