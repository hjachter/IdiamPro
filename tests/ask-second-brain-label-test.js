// Verifies the Second Brain menu shows "Ask Second Brain" (renamed from "Search Second Brain").
// Browser Playwright against the running dev server on :9002.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const outDir = path.join(__dirname, '..', 'test-screenshots', 'ask-second-brain');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  let pass = false, note = '';
  try {
    await page.goto('http://localhost:9002/app', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(6000);
    await page.screenshot({ path: path.join(outDir, '01-loaded.png') });
    const trigger = page.locator('[aria-label="Second Brain menu"]').first();
    await trigger.waitFor({ state: 'visible', timeout: 15000 });
    await trigger.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, '02-brain-menu-open.png') });
    const askVisible = await page.getByText('Ask Second Brain', { exact: false }).count();
    const oldVisible = await page.getByText('Search Second Brain', { exact: false }).count();
    pass = askVisible > 0 && oldVisible === 0;
    note = `askSecondBrain matches=${askVisible}, oldSearchSecondBrain matches=${oldVisible}`;
  } catch (e) {
    note = 'ERROR: ' + e.message;
  }
  const report = { pass, note, time: new Date().toISOString() };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, 'report.md'), `# Ask Second Brain label\n\nPASS: ${pass}\n\n${note}\n`);
  console.log(JSON.stringify(report));
  await browser.close();
  process.exit(pass ? 0 : 1);
})();
