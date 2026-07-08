// Admin auth + UI verification test.
// Confirms the server-gated admin console renders in dev (stub mode):
//   (a) the amber "ADMIN CONSOLE" top bar is visible on /admin/metrics
//   (b) the Launch Metrics page content renders
//   (c) the OLD client-side localStorage bypass card is GONE
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

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
      } catch (e) { /* window not ready */ }
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Could not find main app window');
}

async function run() {
  const projectRoot = path.resolve(__dirname, '..');
  const outDir = path.join(projectRoot, 'test-screenshots', 'admin-auth');
  fs.mkdirSync(outDir, { recursive: true });

  const report = { passed: false, checks: {}, notes: [] };

  console.log('Launching Electron...');
  electronApp = await electron.launch({
    args: [projectRoot],
    env: { ...process.env, NODE_ENV: 'development' },
  });

  page = await findMainWindow(electronApp);
  console.log('Main window:', page.url());
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  console.log('Navigating to /admin/metrics...');
  await page.goto('http://localhost:9002/admin/metrics', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const shotPath = path.join(outDir, 'metrics.png');
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log('Screenshot saved:', shotPath);

  // Grab full page text for DOM assertions.
  const bodyText = await page.evaluate(() => document.body ? document.body.innerText : '');

  // (a) Amber ADMIN CONSOLE bar present
  const consoleBar = page.locator('text=ADMIN CONSOLE');
  report.checks.adminConsoleBar = (await consoleBar.count()) > 0
    && await consoleBar.first().isVisible({ timeout: 5000 }).catch(() => false);

  // (b) Launch Metrics content rendered
  report.checks.metricsContent = /Launch Metrics/i.test(bodyText);

  // (c) OLD localStorage bypass card GONE
  report.checks.noLocalStorageBypass = !/localStorage\.setItem/i.test(bodyText);
  report.checks.noAdminAccessRequired = !/Admin access required/i.test(bodyText);

  report.bodyTextSample = bodyText.slice(0, 400);

  report.passed = report.checks.adminConsoleBar
    && report.checks.metricsContent
    && report.checks.noLocalStorageBypass
    && report.checks.noAdminAccessRequired;

  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log('CHECKS:', JSON.stringify(report.checks, null, 2));
  console.log('RESULT:', report.passed ? 'PASS' : 'FAIL');

  // Refocus user's terminal.
  try { require('child_process').execSync(`osascript -e 'tell application "Terminal" to activate'`); } catch (e) {}

  // Close Electron (race against a deadline).
  await Promise.race([
    electronApp.close().catch(() => {}),
    new Promise(r => setTimeout(r, 5000)),
  ]);

  process.exit(report.passed ? 0 : 1);
}

run().catch(async (err) => {
  console.error('TEST ERROR:', err.message);
  try { if (electronApp) await Promise.race([electronApp.close().catch(() => {}), new Promise(r => setTimeout(r, 5000))]); } catch (e) {}
  process.exit(1);
});
