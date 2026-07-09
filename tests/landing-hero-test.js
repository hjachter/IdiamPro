/**
 * Landing hero + idea-development band visual + copy verification.
 * Loads the marketing landing page (web route) at desktop (1440) and mobile
 * (390) widths, screenshots the hero and the new band at both, and asserts the
 * approved copy is present. No Electron needed — this is a plain web route.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.LANDING_URL || 'http://localhost:9002/';
const OUT = path.join(__dirname, '..', 'test-screenshots', 'landing-hero');
const SCRATCH = process.env.SCRATCH_DIR || '';

const EXPECTED = [
  'Develop it. Publish everywhere.',
  'The Premier',
  'Idea Developer.',
  'Capture, consolidate, and develop your ideas with AI',
  'consolidate many sources into coherent, developed thinking',
  'Research papers',
  '21 languages',
  "A great idea isn't a single prompt.",
  'Many inputs',
  'Merge & consolidate',
  'Publish everywhere',
  "That's idea development, not a one-shot answer.",
];

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = { pass: 0, fail: 0, notes: [] };

  for (const [name, width, height] of [['desktop', 1440, 1024], ['mobile', 390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(1500);

    // Hero screenshot (top of page).
    const heroPath = path.join(OUT, `${name}-hero.png`);
    await page.screenshot({ path: heroPath });

    // Scroll to the band ("A great idea isn't a single prompt.") and shoot it.
    const band = page.getByText("A great idea isn't a single prompt.");
    await band.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    const bandPath = path.join(OUT, `${name}-band.png`);
    await page.screenshot({ path: bandPath });

    // Copy assertions.
    const body = await page.evaluate(() => document.body.innerText);
    for (const phrase of EXPECTED) {
      if (body.includes(phrase)) { results.pass++; }
      else { results.fail++; results.notes.push(`[${name}] MISSING: ${phrase}`); }
    }

    // Horizontal-overflow guard.
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 2) { results.fail++; results.notes.push(`[${name}] H-OVERFLOW: ${overflow}px`); }
    else { results.pass++; }

    // Copy the four key shots into the scratchpad if requested.
    if (SCRATCH) {
      fs.copyFileSync(heroPath, path.join(SCRATCH, `landing-${name}-hero.png`));
      fs.copyFileSync(bandPath, path.join(SCRATCH, `landing-${name}-band.png`));
    }
    await ctx.close();
  }

  await browser.close();
  const report = { when: new Date().toISOString(), url: URL, ...results };
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(OUT, 'report.md'),
    `# Landing hero test\n\nPASS ${results.pass} / FAIL ${results.fail}\n\n` +
    (results.notes.length ? results.notes.map((n) => `- ${n}`).join('\n') : 'No issues.') + '\n');

  console.log(`PASS ${results.pass} FAIL ${results.fail}`);
  results.notes.forEach((n) => console.log(n));
  process.exit(results.fail > 0 ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
