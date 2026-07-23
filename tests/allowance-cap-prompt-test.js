/**
 * allowance-cap-prompt-test.js — Playwright check for the three-door AI
 * allowance cap prompt (src/components/allowance-cap-prompt.tsx).
 *
 * Launches Electron, raises the prompt via its window event, screenshots it,
 * and asserts all THREE doors are present and pleasant:
 *   (a) Use your own key (BYOK)
 *   (b) Add an overage pack (coming-soon placeholder)
 *   (c) Keep going on-device
 * Exits non-zero on failure.
 */
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

const REPORT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'allowance-cap-prompt');
if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

let electronApp;
let page;

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
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Could not find main app window');
}

async function main() {
  const results = [];
  const record = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail });

  electronApp = await electron.launch({
    args: [path.resolve(__dirname, '..')],
    env: { ...process.env, NODE_ENV: 'development' },
  });
  page = await findMainWindow(electronApp);
  page.on('dialog', (d) => { d.dismiss().catch(() => {}); });
  await page.waitForLoadState('domcontentloaded');
  // The three-door provider is mounted in the ROOT layout, so it works even
  // behind the dev invite gate — no need to clear the gate. Navigate to /app
  // and give React time to hydrate + attach the window-event listener.
  await page.evaluate(() => { window.location.href = '/app'; });
  await page.waitForTimeout(6000);

  // Raise the three-door prompt exactly the way a real over-allowance response
  // would (the provider listens for this window event).
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('open-allowance-cap-prompt', {
      detail: { reason: "You've used this month's included AI generations." },
    }));
  });
  await page.waitForTimeout(1500);

  // Match the SPECIFIC cap dialog by its headline (other dialogs may exist).
  const capDialog = page.locator('[role="dialog"]', {
    hasText: /reached this month/i,
  });
  const dialogVisible = await capDialog.first().isVisible().catch(() => false);
  record('prompt_opens', dialogVisible);

  const bodyText = (await capDialog.first().innerText().catch(() => '')) || '';
  record('door_byok', /use your own key/i.test(bodyText), 'BYOK door');
  record('door_overage', /overage pack/i.test(bodyText) && /coming soon/i.test(bodyText), 'overage placeholder');
  record('door_ondevice', /on-device|keep going on-device/i.test(bodyText), 'on-device door');
  record('is_dismissible', /maybe later/i.test(bodyText), 'non-blocking / dismissible');
  record('reached_allowance_headline', /reached this month/i.test(bodyText), 'friendly headline');

  await page.screenshot({ path: path.join(REPORT_DIR, 'three-door-prompt.png') });

  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  fs.writeFileSync(path.join(REPORT_DIR, 'report.json'),
    JSON.stringify({ passed, failed, total: results.length, results }, null, 2));
  console.log(JSON.stringify({ passed, failed, results }, null, 2));

  await electronApp.close().catch(() => {});
  if (failed > 0) {
    console.log(`ALLOWANCE CAP PROMPT: FAIL — ${failed} check(s) failed.`);
    process.exit(1);
  }
  console.log('ALLOWANCE CAP PROMPT: PASS — three-door prompt renders with all doors.');
  process.exit(0);
}

main().catch(async (e) => {
  console.error('Test crashed:', e);
  try { await electronApp?.close(); } catch { /* ignore */ }
  process.exit(1);
});
