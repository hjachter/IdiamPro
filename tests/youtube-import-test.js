/**
 * youtube-import-test.js — Regression test for the iOS YouTube-import
 * silent-failure bug.
 *
 * Bug: user pasted a YouTube URL into Research & Import on iPhone 16 Pro Max,
 * clicked Synthesize, the dialog closed and nothing happened. Toast (which
 * is the only failure surface today) was clipped behind the iOS Safari URL
 * bar / not noticed.
 *
 * Fix: on failure, the dialog must STAY OPEN and render an inline
 * conversational error so the user can see what happened and retry without
 * losing their input.
 *
 * This test drives the Electron build (same React code as web/iOS), forces
 * the synthesis network call to fail, and asserts:
 *   - The Research & Import dialog is still open after the failure.
 *   - An inline error is visible inside the dialog.
 *   - The error copy is conversational, NOT CLI-speak.
 *   - The user's YouTube URL is still in the form (input not reset).
 *
 * Saves screenshots + a JSON/MD report to test-screenshots/youtube-import/.
 */

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

const REPORT_DIR = path.resolve(
  __dirname,
  '..',
  'test-screenshots',
  'youtube-import',
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
  page.on('dialog', (d) => { d.dismiss().catch(() => {}); });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2500);
  if (!page.url().includes('/app')) {
    await page.evaluate(() => { window.location.href = '/app'; });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3500);
  }
  // Make sure AI consent is granted so we don't get bounced into the
  // consent dialog instead of the actual synthesis call.
  await page.evaluate(() => {
    localStorage.setItem('aiDataConsent', 'granted');
    // Seed a BYOK key so the launch-tier gate is exempt — we want to test
    // the synthesis failure path, not the tier hard-block path (separately
    // covered by tier-enforcement-test.js).
    localStorage.setItem('apiKey_gemini', 'AIzaTestKey1234567890fakefakefake');
    // Suppress discovery toasts that can intercept clicks on dialog buttons.
    localStorage.setItem('discovery:professionalMode', 'true');
  });
}

async function closeApp() {
  if (electronApp) await Promise.race([
    electronApp.close().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
}

async function openBulkResearchDialog() {
  // Click the toolbar Quick Command button rather than relying on Cmd+K —
  // the keyboard shortcut needs the document to have focus, which isn't
  // reliable right after launch. The toolbar button always works.
  const quickCommandBtn = page.locator('button[aria-label^="Quick Command"]').first();
  if (await quickCommandBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await quickCommandBtn.click();
  } else {
    // Fallback to keyboard shortcut.
    await page.locator('body').click({ position: { x: 100, y: 100 } }).catch(() => {});
    await page.waitForTimeout(200);
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
  }
  await page.waitForTimeout(700);

  const paletteInput = page.locator('[cmdk-input], input[placeholder*="command" i], input[placeholder*="Type" i]').first();
  await paletteInput.waitFor({ state: 'visible', timeout: 5000 });
  await paletteInput.click();
  await paletteInput.fill('Research');
  await page.waitForTimeout(700);
  // Click the matching command item.
  const item = page.locator('[role="option"], [cmdk-item]').filter({
    hasText: /Research/i,
  }).first();
  await item.click({ timeout: 8000 });
  // Dialog should appear with the Research & Import title.
  await page
    .locator('text=Research & Import')
    .first()
    .waitFor({ state: 'visible', timeout: 5000 });
}

async function enterYoutubeUrl(url) {
  // The dialog's source picker defaults to no input method selected. Pick
  // "Enter a URL" from the type dropdown, then fill the input.
  const select = page.locator('[role="combobox"]').filter({ hasText: /Choose source type/i }).first();
  await select.click();
  await page.waitForTimeout(200);
  await page.locator('[role="option"]').filter({ hasText: /Enter a URL/i }).first().click();
  await page.waitForTimeout(200);
  const input = page.locator('input[placeholder="https://example.com"]').first();
  await input.fill(url);
  // Trigger detection by pressing Enter.
  await input.press('Enter');
  await page.waitForTimeout(500);
}

async function clickSynthesize() {
  const btn = page.locator('button').filter({ hasText: /^Synthesize\s+\d+\s+Source/i }).first();
  await btn.waitFor({ state: 'visible', timeout: 5000 });
  await btn.click();
}

const results = [];

async function runTest(name, fn) {
  console.log(`\n  > ${name}`);
  const t0 = Date.now();
  let entry = { name, passed: false, durationMs: 0, details: {} };
  try {
    const res = await fn();
    entry = { ...entry, ...res, durationMs: Date.now() - t0 };
    console.log(`    ${entry.passed ? 'PASS' : 'FAIL'} ${name} (${entry.durationMs}ms)`);
    if (!entry.passed && entry.details && entry.details.error) {
      console.log(`      error: ${entry.details.error}`);
    }
  } catch (err) {
    entry.details.error = err.message;
    entry.durationMs = Date.now() - t0;
    console.log(`    FAIL ${name} -- ${err.message}`);
  }
  results.push(entry);
  return entry;
}

// -- The bug regression test ----------------------------------------------

async function testDialogStaysOpenOnSynthesisFailure() {
  const youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

  // Force the synthesis network call to fail. Next.js server actions POST to
  // the same /app route with a special header. We intercept everything that
  // could be the synthesis call and reject it. The dialog should react by
  // showing the inline error, NOT by closing.
  await page.route('**/app', async (route) => {
    const req = route.request();
    const isAction = req.method() === 'POST' && req.headers()['next-action'];
    if (isAction) {
      // Simulate a network failure mid-call.
      await route.abort('failed');
    } else {
      await route.continue();
    }
  });

  await openBulkResearchDialog();
  await page.screenshot({ path: path.join(REPORT_DIR, '01-dialog-open.png') });

  await enterYoutubeUrl(youtubeUrl);
  await page.screenshot({ path: path.join(REPORT_DIR, '02-url-entered.png') });

  await clickSynthesize();
  // Give the failed action a moment to propagate.
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(REPORT_DIR, '03-after-synthesize.png') });

  // ASSERTION 1: dialog is still open.
  const dialogStillOpen = await page
    .locator('text=Research & Import')
    .first()
    .isVisible()
    .catch(() => false);

  // ASSERTION 2: the inline error block is visible.
  const errorBox = page.locator('[data-testid="bulk-research-error"]');
  const errorVisible = await errorBox.isVisible().catch(() => false);
  const errorText = errorVisible
    ? (await errorBox.textContent())?.trim() || ''
    : '';

  // ASSERTION 3: error copy is conversational (matches one of the friendly
  // phrasings in the dialog OR isn't pure CLI-speak).
  const conversational =
    /couldn.?t|sorry|give it|try|check|too long/i.test(errorText) &&
    !/^\s*error:?\s*$/i.test(errorText);

  // ASSERTION 4: user's URL is still in the form (input not reset).
  const urlStillPresent = await page
    .locator(`text=${youtubeUrl}`)
    .first()
    .isVisible()
    .catch(() => false);

  // Clean up the route handler for subsequent tests.
  await page.unroute('**/app');

  const passed = dialogStillOpen && errorVisible && conversational && urlStillPresent;
  return {
    passed,
    details: {
      dialogStillOpen,
      errorVisible,
      conversational,
      urlStillPresent,
      errorText: errorText.slice(0, 200),
    },
  };
}

// -- Run ------------------------------------------------------------------

async function main() {
  console.log('Launching Electron for youtube-import-test...');
  await launchApp();
  console.log('App ready.');

  await runTest(
    'Research & Import dialog stays open and shows inline error on synthesis failure',
    testDialogStaysOpenOnSynthesisFailure,
  );

  await closeApp();

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const summary = {
    suite: 'youtube-import-test',
    passed,
    total,
    results,
    runAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(REPORT_DIR, 'report.json'),
    JSON.stringify(summary, null, 2),
  );
  const md = [
    `# youtube-import-test`,
    ``,
    `${passed}/${total} passed`,
    ``,
    ...results.map(
      (r) =>
        `- ${r.passed ? 'PASS' : 'FAIL'} ${r.name}${r.details && Object.keys(r.details).length ? ` -- ${JSON.stringify(r.details)}` : ''}`,
    ),
  ].join('\n');
  fs.writeFileSync(path.join(REPORT_DIR, 'report.md'), md);

  console.log(`\n${passed}/${total} passed.`);
  if (passed !== total) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  if (electronApp) electronApp.close().catch(() => {});
  process.exit(1);
});
