// Verifies the Second Brain menu shows BOTH the AI "Ask Second Brain" (renamed
// from the old "Search Second Brain" AI chat) AND the newer FREE local keyword
// "Search Second Brain" — they are two distinct features that co-exist in the
// menu (the AI one costs a generation; the local one is a free word-match).
// Browser Playwright against the running dev server on :9002.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { dismissWelcomeShowcase } = require('./_helpers');

(async () => {
  const outDir = path.join(__dirname, '..', 'test-screenshots', 'ask-second-brain');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  // Wide viewport so the Second Brain (Brain) menu stays inline in the action
  // toolbar instead of collapsing into the responsive "More" overflow menu.
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  let pass = false, note = '';
  try {
    await page.goto('http://localhost:9002/app', { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Wait past the invite/sign-in gate ("Loading…") until the real toolbar
    // has mounted (the "New Outline" sidebar button is a reliable marker).
    await page.locator('button:has-text("New Outline")').first()
      .waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await dismissWelcomeShowcase(page);
    await page.screenshot({ path: path.join(outDir, '01-loaded.png') });

    // Open the Second Brain (Brain) menu. It's a Tier-2 toolbar action, so it
    // may be inline (visible Brain button) or collapsed into the action-toolbar
    // "More" overflow menu — try the direct button first, then the overflow.
    const brainBtn = page.locator('[aria-label="Second Brain menu"]:visible').first();
    if (await brainBtn.waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false)) {
      await brainBtn.click();
    } else {
      const overflow = page.locator('[data-testid="outline-toolbar-more"]:visible, [aria-label="More tools"]:visible').first();
      await overflow.waitFor({ state: 'visible', timeout: 8000 });
      await overflow.click();
      await page.waitForTimeout(500);
      // If the overflow surfaces a nested Second Brain submenu, open it.
      const nested = page.locator('[role="menuitem"]:has-text("Second Brain")').first();
      if (await nested.isVisible().catch(() => false)) {
        await nested.hover().catch(() => {});
        await nested.click().catch(() => {});
      }
    }
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, '02-brain-menu-open.png') });
    // Both the AI "Ask Second Brain" and the free local "Search Second Brain"
    // should be present — they are distinct, intentionally co-existing items.
    const askVisible = await page.getByText('Ask Second Brain', { exact: false }).count();
    const searchVisible = await page.getByText('Search Second Brain', { exact: false }).count();
    pass = askVisible > 0 && searchVisible > 0;
    note = `askSecondBrain matches=${askVisible}, searchSecondBrain(local) matches=${searchVisible}`;
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
