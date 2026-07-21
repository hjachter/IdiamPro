const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT = path.resolve(__dirname, '..', 'test-screenshots', 'wizards');
fs.mkdirSync(OUT, { recursive: true });

let prepareApp;
try { ({ prepareApp } = require('./_helpers')); } catch (e) { prepareApp = null; }

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
  const page = await findMainWindow(app);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  if (!page.url().includes('/app')) {
    await page.evaluate(() => { window.location.href = '/app'; });
    await page.waitForLoadState('domcontentloaded');
    try {
      await page.locator('button:has-text("New Outline")').waitFor({ state: 'visible', timeout: 30000 });
    } catch (e) { await page.waitForTimeout(5000); }
  }
  if (prepareApp) { try { await prepareApp(page); } catch (e) { console.log('prepareApp err', e.message); } }
  await page.waitForTimeout(2000);

  // Make the window large so toolbar buttons aren't collapsed into overflow.
  try { await page.setViewportSize({ width: 1600, height: 1000 }); } catch (e) {}
  await page.waitForTimeout(800);

  // Dismiss any blocking dialogs (backup disclosure, welcome panel, etc.).
  for (const label of ['Got it', 'Continue', 'Close', 'Dismiss']) {
    const b = page.locator(`button:has-text("${label}")`).first();
    if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await page.waitForTimeout(400); }
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(500);

  // Select an outline node so the content-pane toolbar (with Smart Tools) shows.
  const node = page.locator('text=Getting Started').first();
  if (await node.isVisible().catch(() => false)) { await node.click().catch(() => {}); await page.waitForTimeout(800); }
  await page.screenshot({ path: path.join(OUT, '00-app-loaded.png') });

  // Open the Wizards gallery. Prefer the inline Smart Tools button; if it's
  // collapsed (narrow outline pane), go through the "More tools" overflow →
  // Smart Tools submenu → Wizards.
  const wizItem = page.getByRole('menuitem', { name: 'Wizards' });
  const smart = page.locator('button[aria-label="Smart Tools menu"]');
  let opened = false;
  if (await smart.isVisible().catch(() => false)) {
    await smart.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, '01-smart-tools-menu.png') });
    await wizItem.first().click();
    opened = true;
  } else {
    const overflows = page.locator('button[aria-label="More tools"]');
    const n = await overflows.count();
    for (let i = n - 1; i >= 0 && !opened; i--) {
      await overflows.nth(i).click().catch(() => {});
      await page.waitForTimeout(400);
      const st = page.getByRole('menuitem', { name: 'Smart Tools' });
      if (await st.first().isVisible().catch(() => false)) {
        await page.screenshot({ path: path.join(OUT, '01-smart-tools-menu.png') });
        await st.first().hover().catch(() => {});
        await page.waitForTimeout(500);
        if (await wizItem.first().isVisible().catch(() => false)) { await wizItem.first().click(); opened = true; break; }
      }
      await page.keyboard.press('Escape').catch(() => {});
    }
  }
  if (!opened) throw new Error('Could not reach the Wizards menu item');

  // Wait for the gallery DIALOG specifically.
  const dialog = page.getByRole('dialog');
  await dialog.getByText('Wizards', { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, '02-wizards-gallery.png') });

  // Count badges INSIDE the dialog only.
  const liveCount = await dialog.getByText('Live', { exact: true }).count();
  const soonCount = await dialog.getByText('Coming Soon', { exact: true }).count();
  const cardCount = await dialog.locator('button:has-text("Coming Soon"), button:has-text("Live")').count();
  console.log('LIVE badges:', liveCount, 'COMING SOON badges:', soonCount, 'CARD COUNT:', cardCount);

  // Click a Coming-Soon card (Podcast) inside the dialog.
  await dialog.locator('button:has-text("Podcast")').first().click({ force: true });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, '03-podcast-clicked.png') });

  // Verify still in gallery (no config view): the config topic input must NOT appear.
  const inConfig = await page.locator('#app-topic').count();
  const noteVisible = await dialog.getByText(/Coming soon/i).count();
  console.log('CONFIG_INPUT_PRESENT(should be 0):', inConfig);
  console.log('COMING_SOON_NOTE_COUNT:', noteVisible);

  const report = { liveCount, soonCount, cardCount, inConfig, noteVisible };
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log('REPORT', JSON.stringify(report));

  await app.close();
  process.exit(0);
})().catch(e => { console.error('TEST FAILED', e); process.exit(1); });
