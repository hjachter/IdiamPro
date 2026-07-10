// Marketing site audit: app-name consistency + mobile/responsive.
// Drives landing (/) and marketing (/marketing) at desktop + phone widths.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'test-screenshots', 'marketing-audit');
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  { name: 'landing', url: 'http://localhost:9002/' },
  { name: 'marketing', url: 'http://localhost:9002/marketing' },
];
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'phone', width: 390, height: 844 },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const report = { results: [], consoleErrors: [] };
  let failed = false;

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    page.on('console', (msg) => { if (msg.type() === 'error') report.consoleErrors.push(`[${vp.name}] ${msg.text()}`); });
    page.on('pageerror', (e) => report.consoleErrors.push(`[${vp.name}] pageerror: ${e.message}`));

    for (const p of PAGES) {
      await page.goto(p.url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(1200);
      const shot = path.join(OUT, `${p.name}-${vp.name}.png`);
      await page.screenshot({ path: shot, fullPage: true });

      // horizontal overflow check
      const overflow = await page.evaluate(() => {
        const de = document.documentElement;
        return { scrollW: de.scrollWidth, clientW: de.clientWidth, overflow: de.scrollWidth - de.clientWidth };
      });
      // app-name check: any visible "SecondBrainWare" text nodes and where
      const nameAudit = await page.evaluate(() => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const hits = [];
        let n;
        while ((n = walker.nextNode())) {
          if (n.nodeValue && n.nodeValue.includes('SecondBrainWare')) {
            hits.push(n.nodeValue.trim().slice(0, 60));
          }
        }
        const idiam = document.body.innerText.split('IdiamPro').length - 1;
        return { secondBrainWareVisible: hits, idiamProCount: idiam };
      });
      const overflowBad = overflow.overflow > 2;
      if (overflowBad) failed = true;
      report.results.push({ page: p.name, viewport: vp.name, ...overflow, overflowBad, ...nameAudit });
    }
    await context.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(failed || report.consoleErrors.length > 0 ? 1 : 0);
})();
