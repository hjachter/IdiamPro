const { _electron: electron } = require('playwright');
const path = require('path');
(async () => {
  const app = await electron.launch({ args: [path.resolve('/Users/howardjachter/Developer/IdiamPro')] });
  const logs = [];
  app.on('window', win => {
    win.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
    win.on('pageerror', err => logs.push(`[PAGEERROR] ${err.message}`));
  });
  // wait for main window to render
  let page;
  for (let i = 0; i < 30; i++) {
    const wins = app.windows();
    page = wins.find(w => { try { return w.url().includes('localhost:9002'); } catch { return false; } });
    if (page) break;
    await new Promise(r => setTimeout(r, 500));
  }
  if (page) {
    page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', err => logs.push(`[PAGEERROR] ${err.message}`));
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await new Promise(r => setTimeout(r, 4000));
    // Try clicking the wrench
    const wrench = await page.$('button[aria-label="Outline Files"]');
    logs.push(`Wrench button found: ${!!wrench}`);
    if (wrench) {
      try { await wrench.click({ timeout: 2000 }); logs.push('Wrench click ok'); } catch (e) { logs.push(`Wrench click FAIL: ${e.message}`); }
    }
    await new Promise(r => setTimeout(r, 1000));
  } else {
    logs.push('NO MAIN WINDOW FOUND');
  }
  console.log(logs.slice(-40).join('\n'));
  await app.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
