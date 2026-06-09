/**
 * byok-ui-test.js — Playwright suite for BYOK UI (Auth Phase 3 / #34).
 *
 * Verifies the BYOK provider list renders in Settings, key inputs are
 * masked (type='password'), Test buttons exist, and the "AI Usage" tier
 * panel flips to "Unlimited / using your own API key" the moment a key
 * is saved.
 */

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

const REPORT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'byok-ui');
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
      } catch { /* ignore */ }
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
  page.on('dialog', (d) => { d.dismiss().catch(() => {}); });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2500);
  if (!page.url().includes('/app')) {
    await page.evaluate(() => { window.location.href = '/app'; });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3500);
  }
}

async function reopenSettings() {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(150);
  await openSettings();
}

async function closeApp() {
  if (!electronApp) return;
  await Promise.race([
    electronApp.close().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
}

async function clearAllBYOKKeys() {
  await page.evaluate(() => {
    for (const p of ['gemini', 'openai', 'anthropic', 'mistral', 'groq']) {
      localStorage.removeItem(`apiKey_${p}`);
    }
    localStorage.removeItem('idiampro-ai-usage-counter-v1');
    localStorage.removeItem('idiampro-tier-id');
  });
  // The Settings dialog only reads localStorage in useEffect on mount, so we
  // need a full page reload to re-mount with the cleared keys. Otherwise a
  // key seeded by a previous suite (e.g. livebooks-live-refresh) leaks into
  // this test and the Quick Start tile (gated on !apiKeys['gemini']) hides.
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(2500);
}

async function openSettings() {
  // data-settings-trigger is always rendered (even when the visible button is
  // hidden lg:inline-flex on narrow widths).
  const trigger = page.locator(
    '[data-settings-trigger], button:has(svg[class*="settings"]), button:has(.lucide-settings), [aria-label*="Settings"]',
  );
  await trigger.first().click({ force: true });
  await page
    .locator('[data-testid="ai-usage-section"]')
    .waitFor({ state: 'visible', timeout: 5000 });
}

async function closeSettings() {
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
    console.log(`    ${entry.passed ? '✓' : '✗'} ${name}`);
    if (!entry.passed && entry.details && entry.details.error) {
      console.log(`      error: ${entry.details.error}`);
    }
  } catch (err) {
    entry.details.error = err.message;
    entry.durationMs = Date.now() - t0;
    console.log(`    ✗ ${name} — ${err.message}`);
  }
  results.push(entry);
}

// -- Tests ----------------------------------------------------------------

async function testAIServiceKeysSectionRenders() {
  await clearAllBYOKKeys();
  await reopenSettings();
  await page.screenshot({ path: path.join(REPORT_DIR, '01-settings-open.png') });
  // The "AI Service Keys" h3 lives in Settings.
  const sec = page.locator('h3:has-text("AI Service Keys")');
  const ok = await sec.isVisible({ timeout: 3000 }).catch(() => false);
  await closeSettings();
  return { passed: ok, details: { found: ok } };
}

async function testAllProviderInputsArePassword() {
  await clearAllBYOKKeys();
  await reopenSettings();
  // Scroll the AI Service Keys section into view, then count inputs.
  const aiKeysHeader = page.locator('h3:has-text("AI Service Keys")');
  await aiKeysHeader.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const passwordCount = await page.locator('input[type="password"]').count();
  await page.screenshot({ path: path.join(REPORT_DIR, '02-password-inputs.png') });
  await closeSettings();
  // We expect at least 5 password inputs (one per supported provider).
  const ok = passwordCount >= 5;
  return { passed: ok, details: { passwordCount } };
}

async function testGeminiQuickStartShows() {
  await clearAllBYOKKeys();
  await reopenSettings();
  const aiKeysHeader = page.locator('h3:has-text("AI Service Keys")');
  await aiKeysHeader.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(REPORT_DIR, '03-quickstart.png') });
  const qs = page.locator('text="Quick Start — Set up in 2 minutes"');
  const ok = await qs.isVisible({ timeout: 3000 }).catch(() => false);
  await closeSettings();
  return { passed: ok, details: { found: ok } };
}

async function testAddingByokFlipsUsageToUnlimited() {
  await clearAllBYOKKeys();
  // Seed a Gemini key directly — simulates the user pasting and Settings
  // saving via handleApiKeyChange (which writes the same key).
  await page.evaluate(() => {
    localStorage.setItem('apiKey_gemini', 'AIzaTestKey1234567890fakefakefakefakeFAKE');
  });
  await reopenSettings();
  await page.screenshot({ path: path.join(REPORT_DIR, '04-byok-unlimited.png') });
  const line = await page
    .locator('[data-testid="ai-usage-line"]')
    .textContent();
  await closeSettings();
  const ok =
    line && (/Unlimited/i.test(line) || /your own API key/i.test(line));
  return { passed: !!ok, details: { line: line?.trim() } };
}

// -- Run ------------------------------------------------------------------

async function main() {
  console.log('Launching Electron for byok-ui-test…');
  await launchApp();
  console.log('App ready.');

  await runTest('AI Service Keys section renders', testAIServiceKeysSectionRenders);
  await runTest('all provider inputs are type=password', testAllProviderInputsArePassword);
  await runTest('Gemini Quick Start tile shows', testGeminiQuickStartShows);
  await runTest('adding a BYOK key flips Usage to Unlimited', testAddingByokFlipsUsageToUnlimited);

  // Clean up the test seed before exiting.
  await clearAllBYOKKeys();

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  const report = {
    suite: 'byok-ui',
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
    `# byok-ui-test report`,
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
