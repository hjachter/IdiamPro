// Verifies the Help chat auto-scrolls to the newest message as the conversation
// grows, and does NOT yank the user down when they've scrolled up to re-read.
//
// CHEAP + ZERO AI SPEND: the /api/help-chat call is intercepted and fulfilled
// with a canned, deliberately TALL response so the chat overflows after a
// couple of turns — no real AI is ever contacted. Browser Playwright against
// the running dev server on :9002 (stub-mode auth => app renders directly).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { dismissWelcomeShowcase, waitForAppReady } = require('./_helpers');

const TALL = Array.from({ length: 18 }, (_, i) =>
  `Canned help line ${i + 1} — placeholder text so the chat overflows.`
).join('\n');

(async () => {
  const outDir = path.join(__dirname, '..', 'test-screenshots', 'help-chat-autoscroll');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  let pass = false, note = '';
  const checks = {};
  try {
    await page.route('**/api/help-chat', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ response: TALL }) });
    });

    await page.goto('http://localhost:9002/app', { waitUntil: 'domcontentloaded', timeout: 30000 });
    let ready = false;
    for (let attempt = 0; attempt < 3 && !ready; attempt++) {
      ready = await waitForAppReady(page, { timeoutMs: 30000 });
      if (!ready) await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    }
    await page.locator('button:has-text("New Outline")').first()
      .waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await dismissWelcomeShowcase(page);
    await page.screenshot({ path: path.join(outDir, '00-app-loaded.png') });

    // Open Help chat.
    const helpBtn = page.locator('[aria-label="Help and support"]:visible').first();
    if (await helpBtn.waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false)) {
      await helpBtn.click();
    } else {
      const overflow = page.locator('[aria-label="More tools"]:visible').first();
      await overflow.click();
      await page.waitForTimeout(400);
      await page.locator('[role="menuitem"]:has-text("Help & Support")').first().click();
    }
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, '01-help-open.png') });

    const inputSel = 'input[placeholder^="Ask about features"]';
    await page.locator(inputSel).waitFor({ state: 'visible', timeout: 8000 });

    const geom = () => page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]');
      if (!dlg) return null;
      const list = dlg.querySelector('.space-y-4');
      const el = list && list.parentElement;
      if (!el) return null;
      return { scrollTop: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, distFromBottom: el.scrollHeight - el.scrollTop - el.clientHeight };
    });

    for (let i = 0; i < 4; i++) {
      await page.fill(inputSel, `Question number ${i + 1}`);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(700);
    }
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, '02-after-sends.png') });

    const g1 = await geom();
    checks.overflowed = !!g1 && g1.scrollHeight > g1.clientHeight + 20;
    checks.pinnedToBottomAfterSend = !!g1 && g1.distFromBottom < 60;

    // Scroll UP to re-read history.
    await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]');
      const list = dlg && dlg.querySelector('.space-y-4');
      const el = list && list.parentElement;
      if (el) { el.scrollTop = 0; el.dispatchEvent(new Event('scroll')); }
    });
    await page.waitForTimeout(300);
    const gUp = await geom();
    await page.screenshot({ path: path.join(outDir, '03-scrolled-up.png') });
    checks.wasTrulyScrolledUp = !!gUp && gUp.distFromBottom > 100;

    // Yank protection: while scrolled up, let time pass. No auto-scroll should
    // fire on its own; the viewport must stay at the top.
    await page.waitForTimeout(700);
    const gYank = await geom();
    checks.stayedPutWhileScrolledUp = !!gYank && gYank.scrollTop < 40;

    pass = checks.overflowed && checks.pinnedToBottomAfterSend && checks.wasTrulyScrolledUp && checks.stayedPutWhileScrolledUp;
    note = JSON.stringify({ g1, gUp, gYank, checks });
  } catch (e) {
    note = 'ERROR: ' + e.message + '\n' + (e.stack || '');
  }
  const report = { pass, checks, note, time: new Date().toISOString() };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, 'report.md'), `# Help chat auto-scroll\n\nPASS: ${pass}\n\nchecks: ${JSON.stringify(checks, null, 2)}\n\n${note}\n`);
  console.log(JSON.stringify(report));
  await browser.close();
  process.exit(pass ? 0 : 1);
})();
