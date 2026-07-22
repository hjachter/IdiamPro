// Local AI graceful-notice test.
//
// Verifies that when the user is on the "Local" AI provider and the on-device
// engine (Ollama) is DOWN, a local-AI action shows the calm "Local AI isn't
// running" notice with a one-click "Start Local AI" button — instead of a dead
// error — and that clicking Start invokes the launch path (transitions to a
// "Starting Local AI…" state).
//
// The engine is simulated as down WITHOUT touching the user's real Ollama: we
// set a client-side `localStorage.ollamaBaseUrl` override to a dead port
// (11999). The real Ollama on 11434 is never contacted or disturbed.
//
// This drives the REAL production helper (window.__idmGuardLocalAI, a dev-only
// hook that calls the same guardLocalAIReady() used by the app's local-AI
// entry points) and the REAL toast component.

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { prepareApp } = require('./_helpers');

const OUT_DIR = path.join(__dirname, '..', 'test-screenshots', 'local-ai-notice');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

function ensureOutDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function findMainWindow(electronApp, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    for (const win of electronApp.windows()) {
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

(async () => {
  ensureOutDir();
  const results = [];
  let electronApp;
  let page;
  let failed = false;

  try {
    const projectRoot = path.resolve(__dirname, '..');
    console.log('Launching Electron…');
    electronApp = await electron.launch({
      args: [projectRoot],
      env: { ...process.env, NODE_ENV: 'development' },
    });

    page = await findMainWindow(electronApp);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500);
    await prepareApp(page);

    // 1) Put the app in "Local" provider mode and simulate the engine as DOWN
    //    via a dead-port override (real Ollama on 11434 is left alone).
    const prior = await page.evaluate(() => {
      const priorProvider = localStorage.getItem('aiProvider');
      const priorBase = localStorage.getItem('ollamaBaseUrl');
      localStorage.setItem('aiProvider', 'local');
      localStorage.setItem('ollamaBaseUrl', 'http://localhost:11999');
      return { priorProvider, priorBase };
    });
    console.log('Set provider=local, ollamaBaseUrl=dead-port 11999');

    // Wait for the dev-only guard hook to be present.
    await page.waitForFunction(() => typeof (window).__idmGuardLocalAI === 'function', null, {
      timeout: 15000,
    });

    // 2) Invoke the REAL guard the app uses at its local-AI entry points.
    const proceeded = await page.evaluate(async () => {
      // Returns false when it blocks (engine down) and shows the notice.
      return await (window).__idmGuardLocalAI();
    });
    results.push({
      name: 'guard blocks when local engine down',
      pass: proceeded === false,
      detail: `guard returned ${proceeded} (expected false)`,
    });

    // 3) The calm notice with a Start button should now be visible.
    const notice = page.locator('[role="status"]:has-text("Local AI isn"), li:has-text("Local AI isn"), div:has-text("Local AI isn")').first();
    await notice.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    const startBtn = page.locator('button:has-text("Start Local AI")').first();
    const startVisible = await startBtn.isVisible().catch(() => false);
    const titleVisible = await page
      .locator(':has-text("Local AI isn")')
      .first()
      .isVisible()
      .catch(() => false);

    await page.screenshot({ path: path.join(OUT_DIR, '01-notice-shown.png') });

    results.push({
      name: 'calm "Local AI isn\'t running" notice appears',
      pass: titleVisible,
      detail: `notice title visible: ${titleVisible}`,
    });
    results.push({
      name: '"Start Local AI" button present',
      pass: startVisible,
      detail: `start button visible: ${startVisible}`,
    });

    // 4) Clicking Start should invoke the launch path → "Starting Local AI…".
    if (startVisible) {
      await startBtn.click().catch(() => {});
      const starting = page.locator(':has-text("Starting Local AI")').first();
      const startingVisible = await starting
        .waitFor({ state: 'visible', timeout: 6000 })
        .then(() => true)
        .catch(() => false);
      await page.screenshot({ path: path.join(OUT_DIR, '02-starting.png') });
      results.push({
        name: 'clicking Start invokes launch path (transitions to Starting…)',
        pass: startingVisible,
        detail: `"Starting Local AI…" visible: ${startingVisible}`,
      });
    }

    // 5) Restore the user's settings — never leave the override behind.
    await page.evaluate((p) => {
      if (p.priorProvider === null) localStorage.removeItem('aiProvider');
      else localStorage.setItem('aiProvider', p.priorProvider);
      if (p.priorBase === null) localStorage.removeItem('ollamaBaseUrl');
      else localStorage.setItem('ollamaBaseUrl', p.priorBase);
    }, prior);
    console.log('Restored provider + endpoint settings.');
  } catch (err) {
    failed = true;
    console.error('Test error:', err);
    results.push({ name: 'suite ran without throwing', pass: false, detail: String(err && err.message || err) });
    try { if (page) await page.screenshot({ path: path.join(OUT_DIR, 'error.png') }); } catch {}
  } finally {
    // electronApp.close() can hang if the app raises a teardown dialog, so
    // race it against a short timeout — the assertions are already done.
    if (electronApp) {
      await Promise.race([
        electronApp.close().catch(() => {}),
        new Promise((r) => setTimeout(r, 5000)),
      ]);
    }
  }

  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  const allPass = !failed && passed === total && total > 0;

  const report = {
    suite: 'local-ai-notice',
    when: new Date().toISOString(),
    passed,
    total,
    allPass,
    results,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  const md = [
    `# Local AI Notice — ${allPass ? 'PASS' : 'FAIL'} (${passed}/${total})`,
    '',
    ...results.map((r) => `- ${r.pass ? '✅' : '❌'} ${r.name} — ${r.detail}`),
  ].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), md);

  console.log('\n' + md + '\n');
  process.exit(allPass ? 0 : 1);
})();
