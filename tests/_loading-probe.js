const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = '/tmp/loading-probe';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const app = await electron.launch({
    args: [path.resolve(__dirname, '..')],
    timeout: 30000,
  });
  const logs = [];
  const errs = [];
  app.on('window', win => {
    win.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
    win.on('pageerror', err => errs.push(`[PAGEERROR] ${err.message}\n${err.stack || ''}`));
  });
  let page = null;
  for (let i = 0; i < 60; i++) {
    const wins = app.windows();
    page = wins.find(w => { try { return !w.url().startsWith('devtools://'); } catch { return false; } });
    if (page) break;
    await new Promise(r => setTimeout(r, 500));
  }
  if (!page) {
    fs.writeFileSync(`${OUT}/report.txt`, 'NO WINDOW FOUND');
    await app.close();
    process.exit(2);
  }
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => errs.push(`[PAGEERROR] ${err.message}\n${err.stack || ''}`));
  page.on('requestfailed', req => errs.push(`[REQFAIL] ${req.url()} - ${req.failure()?.errorText}`));

  const url0 = page.url();
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await new Promise(r => setTimeout(r, 6000)); // give it time to render
  await page.screenshot({ path: `${OUT}/loading.png`, fullPage: false }).catch(() => {});

  const url1 = page.url();
  const title = await page.title().catch(() => '?');
  // Look for visible "loading" text and check what the DOM looks like
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500)).catch(() => '?');
  const hasLoadingText = await page.evaluate(() => /loading/i.test(document.body.innerText)).catch(() => false);
  const hasReactRoot = await page.evaluate(() => {
    const root = document.querySelector('main, [class*="layout"], [data-testid]');
    return root ? root.outerHTML.slice(0, 400) : 'no root found';
  }).catch(() => '?');

  const report = [
    `URL at start: ${url0}`,
    `URL after wait: ${url1}`,
    `Title: ${title}`,
    `hasLoadingText: ${hasLoadingText}`,
    ``,
    `--- body text (first 500 chars) ---`,
    bodyText,
    ``,
    `--- root element snippet ---`,
    hasReactRoot,
    ``,
    `--- console logs (last 40) ---`,
    logs.slice(-40).join('\n'),
    ``,
    `--- page errors ---`,
    errs.join('\n') || '(none)',
  ].join('\n');
  fs.writeFileSync(`${OUT}/report.txt`, report);
  console.log(report);
  await app.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
