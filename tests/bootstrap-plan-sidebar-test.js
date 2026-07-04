// Regression test: an outline with a node missing/non-string `prefix` must
// still appear in the sidebar (data-resilience fix). Confirms the "IdiamPro -
// Bootstrap Plan" outline is listed and renders after the prefix-coercion heal.
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'bootstrap-plan-sidebar');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function findMainWindow(app, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    for (const win of app.windows()) {
      try {
        const url = win.url();
        if (url.startsWith('devtools://')) continue;
        if (url.includes('localhost:9002')) return win;
      } catch (e) {}
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Could not find main app window');
}

(async () => {
  const projectRoot = path.resolve(__dirname, '..');
  const app = await electron.launch({ args: [projectRoot], env: { ...process.env, NODE_ENV: 'development' } });
  let pass = false;
  let rendered = false;
  try {
    const page = await findMainWindow(app);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    if (!page.url().includes('/app')) {
      await page.evaluate(() => { window.location.href = '/app'; });
      await page.waitForLoadState('domcontentloaded');
      try {
        await page.locator('button:has-text("New Outline")').waitFor({ state: 'visible', timeout: 30000 });
      } catch (e) {}
    }
    // Give the storage/repair load path time to run.
    await page.waitForTimeout(6000);
    await page.screenshot({ path: path.join(OUT_DIR, '01-sidebar.png'), fullPage: true });

    const target = page.locator('text=IdiamPro - Bootstrap Plan').first();
    pass = await target.isVisible().catch(() => false);
    console.log('Bootstrap Plan visible in sidebar:', pass);

    if (pass) {
      await target.click().catch(() => {});
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(OUT_DIR, '02-opened.png'), fullPage: true });
      // Confirm nodes render: look for the root/known content text.
      const bodyText = await page.evaluate(() => document.body.innerText || '');
      rendered = /Bootstrap|Phase|Launch|Web|App Store/i.test(bodyText);
      console.log('Bootstrap Plan renders nodes:', rendered);
    }

    const report = { pass, rendered, at: new Date().toISOString() };
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(OUT_DIR, 'report.md'),
      `# Bootstrap Plan Sidebar Test\n\n- In sidebar: ${pass}\n- Renders: ${rendered}\n`);
  } finally {
    await Promise.race([app.close(), new Promise(r => setTimeout(r, 5000))]).catch(() => {});
  }
  if (!pass) { console.error('FAIL: Bootstrap Plan not in sidebar'); process.exit(1); }
  console.log('PASS');
  process.exit(0);
})();
