const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Benign teardown dialog race (see electron-test.js).
process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'account-deletion');
fs.mkdirSync(OUT_DIR, { recursive: true });

const FOCUS = path.resolve(__dirname, '..', 'scripts', 'focus-claude-terminal.sh');
function refocus() {
  try { require('child_process').execSync(`bash "${FOCUS}"`, { stdio: 'ignore' }); } catch {}
}

let electronApp, page;
const report = { suite: 'account-deletion', startedAt: new Date().toISOString(), steps: [], results: [], pass: 0, fail: 0 };

async function shot(name) {
  const p = path.join(OUT_DIR, `${name}.png`);
  try { await page.screenshot({ path: p, fullPage: false }); } catch {}
  refocus();
  return p;
}

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
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Could not find main app window');
}

async function launch() {
  const projectRoot = path.resolve(__dirname, '..');
  electronApp = await electron.launch({ args: [projectRoot], env: { ...process.env, NODE_ENV: 'development' } });
  page = await findMainWindow(electronApp);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  if (!page.url().includes('/app')) {
    await page.evaluate(() => { window.location.href = '/app'; });
    await page.waitForLoadState('domcontentloaded');
    try {
      await page.locator('button:has-text("New Outline")').waitFor({ state: 'visible', timeout: 30000 });
    } catch { await page.waitForTimeout(5000); }
  }
  report.steps.push('App launched at ' + page.url());
}

async function openSettings() {
  const btn = page.locator('[data-settings-trigger], button:has(.lucide-settings), [aria-label*="Settings"]');
  await btn.first().click({ force: true });
  await page.waitForTimeout(1500);
  report.steps.push('Settings clicked');
}

function record(name, ok, note) {
  report.results.push({ name, ok, note });
  if (ok) report.pass++; else report.fail++;
  report.steps.push(`${ok ? 'PASS' : 'FAIL'} — ${name}${note ? ': ' + note : ''}`);
}

(async () => {
  try {
    await launch();
    await shot('01-app-launched');
    record('App launches', page.url().includes('/app'), page.url());

    await openSettings();
    await shot('02-settings-open');
    const planVisible = await page.locator('text=Subscription Plan').first().isVisible().catch(() => false);
    record('Settings dialog opens', planVisible, 'Subscription Plan header visible');

    // (a) Desktop upgrade path present (Electron !== iOS)
    const seePlans = await page.locator('button:has-text("See plans")').count();
    const manageSub = await page.locator('[data-testid="manage-subscription-btn"]').count();
    const iosCta = await page.locator('[data-testid="ios-byok-cta"]').count();
    record('Desktop upgrade path shown (not iOS BYOK-only)',
      (seePlans > 0 || manageSub > 0) && iosCta === 0,
      `seePlans=${seePlans} manageSub=${manageSub} iosBYOK=${iosCta}`);

    // Delete-account button gated: expected ABSENT in dev (no Clerk / signed out)
    const delAcct = await page.locator('[data-testid="delete-account-btn"]').count();
    record('Delete-account button correctly gated (absent in dev)', delAcct === 0,
      `delete-account-btn count=${delAcct} (0 expected when auth disabled)`);

    // (b) "Delete all my data" exists; open its two-step confirm, then CANCEL
    const delAll = page.locator('button:has-text("Delete all my data")');
    const delAllCount = await delAll.count();
    record('"Delete all my data" action present', delAllCount > 0, `count=${delAllCount}`);

    if (delAllCount > 0) {
      await delAll.first().scrollIntoViewIfNeeded().catch(() => {});
      await delAll.first().click({ force: true });
      await page.waitForTimeout(1200);
      await shot('03-delete-all-warn');
      const warnVisible = await page.locator('text=Delete all your IdiamPro data?').first().isVisible().catch(() => false);
      record('Step-1 warning dialog appears', warnVisible, 'destructive warning wording shown');

      // CANCEL — never proceed
      const cancel = page.locator('button:has-text("Cancel")').last();
      if (await cancel.isVisible().catch(() => false)) {
        await cancel.click({ force: true });
        await page.waitForTimeout(800);
      } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(800);
      }
      await shot('04-after-cancel');
      const gone = !(await page.locator('text=Delete all your IdiamPro data?').first().isVisible().catch(() => false));
      record('Cancel dismisses without deleting', gone, 'no DELETE typed, no confirm');
    }

    report.finishedAt = new Date().toISOString();
  } catch (e) {
    report.error = String(e && e.stack || e);
    report.fail++;
  } finally {
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    const md = [
      `# Account Deletion Test`,
      `Pass: ${report.pass}  Fail: ${report.fail}`,
      ``,
      ...report.results.map(r => `- ${r.ok ? 'PASS' : 'FAIL'} — ${r.name}${r.note ? ` (${r.note})` : ''}`),
      report.error ? `\nERROR:\n${report.error}` : '',
    ].join('\n');
    fs.writeFileSync(path.join(OUT_DIR, 'report.md'), md);
    try {
      if (electronApp) await Promise.race([electronApp.close(), new Promise(r => setTimeout(r, 5000))]);
    } catch {}
    refocus();
    process.exit(report.fail > 0 ? 1 : 0);
  }
})();
