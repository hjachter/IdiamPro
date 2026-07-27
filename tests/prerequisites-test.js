// Prerequisites (task dependencies) — browser test against the running dev
// server on localhost:9002. Verifies: creating task nodes, setting a
// prerequisite via the Project submenu + picker, the "Depends on" chip in the
// content pane, the computed "Blocked by" indicator, and inline removal.
//
// Deterministic UI test — run once. Drives the real web app (not Electron) so
// it can't disturb Howard's running Electron instance.

const path = require('path');
const { chromium } = require('/Users/howardjachter/Developer/IdiamPro/node_modules/playwright');

const OUT = '/private/tmp/claude-501/-Users-howardjachter/dc1a4cb9-7949-4c86-a6ad-521f02bacb84/scratchpad';
const BASE = 'http://localhost:9002/app';

async function dismissOverlays(page) {
  await page.evaluate(() => {
    try {
      localStorage.setItem('onboarding:welcomeShowcaseSeen', '1');
      localStorage.setItem('idiampro-data-protection-dismissed', '1');
    } catch (e) {}
  });
  // Loop until no modal backdrop remains (dialogs can mount a moment apart).
  for (let i = 0; i < 6; i++) {
    for (const sel of [
      '[data-testid="welcome-showcase-dont-show"]',
      '[data-testid="welcome-showcase-skip"]',
      '[data-testid="data-protection-got-it"]',
    ]) {
      const l = page.locator(sel);
      if (await l.count().catch(() => 0)) await l.first().click({ timeout: 1500 }).catch(() => {});
    }
    const backdrop = page.locator('div.fixed.inset-0.z-50').filter({ hasText: '' });
    const hasBackdrop = await page
      .locator('[data-state="open"][aria-hidden="true"]')
      .count()
      .catch(() => 0);
    if (!hasBackdrop) break;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(400);
}

// Create a child node under the currently-selected node with the given name.
async function addChild(page, name) {
  // Enter creates a sibling; to reliably build a flat task list we add siblings
  // under the root. Press Enter, then type into the inline editor.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const input = page.locator('input[type="text"]').first();
  if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
    await input.fill(name);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
  }
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const results = [];
  const fail = (m) => { console.error('FAIL:', m); results.push(['FAIL', m]); };
  const ok = (m) => { console.log('OK:', m); results.push(['OK', m]); };

  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    await dismissOverlays(page);

    // 1. New outline
    await page.locator('button:has-text("New Outline")').first().click();
    await page.waitForTimeout(1500);
    await dismissOverlays(page);
    ok('Created new outline');

    // 2. Select root node in the tree, then add two task siblings.
    const root = page.locator('[data-testid="outline-pane"] span:has-text("Untitled Outline")').first();
    await root.click();
    await page.waitForTimeout(400);

    await addChild(page, 'Design mockups');
    // After creating "Design mockups" it is selected; Enter adds a sibling.
    await addChild(page, 'Build feature');
    ok('Added two task nodes');

    // Dump node names for diagnostics
    const names = await page.locator('[data-testid="outline-pane"] li span').allInnerTexts().catch(() => []);
    console.log('NODE NAMES:', JSON.stringify(names.filter(Boolean).slice(0, 20)));

    // 3. Right-click "Build feature" to open the context menu.
    const build = page.locator('[data-testid="outline-pane"] span:has-text("Build feature")').first();
    await build.click();
    await page.waitForTimeout(300);
    await build.click({ button: 'right' });
    await page.waitForTimeout(600);

    // 4. Project submenu → Set Prerequisite…
    const projectItem = page.locator('[role="menuitem"]:has-text("Project")').first();
    if (!(await projectItem.isVisible({ timeout: 2000 }).catch(() => false))) {
      fail('Project submenu not found in context menu');
      const items = await page.locator('[role="menuitem"]').allInnerTexts().catch(() => []);
      console.log('MENU ITEMS:', JSON.stringify(items));
    } else {
      ok('Project submenu present');
      await projectItem.hover();
      await page.waitForTimeout(500);
      const setPrereq = page.locator('[role="menuitem"]:has-text("Set Prerequisite")').first();
      await setPrereq.hover().catch(() => {});
      await setPrereq.click();
      await page.waitForTimeout(800);
    }

    // 5. Picker dialog — pick "Design mockups".
    const dialog = page.locator('[role="dialog"]:has-text("Set Prerequisite")').first();
    if (await dialog.isVisible({ timeout: 2000 }).catch(() => false)) {
      ok('Prerequisite picker opened');
      const opt = dialog.locator('button:has-text("Design mockups")').first();
      await opt.click();
      await page.waitForTimeout(400);
      await dialog.locator('button:has-text("Done")').first().click();
      await page.waitForTimeout(600);
      ok('Picked "Design mockups" as prerequisite');
    } else {
      fail('Prerequisite picker did not open');
    }

    // 6. Select "Build feature" and check the content pane for the chip + blocked banner.
    await page.locator('[data-testid="outline-pane"] span:has-text("Build feature")').first().click();
    await page.waitForTimeout(700);

    const cp = page.locator('[data-testid="content-pane"]');
    const cpText = await cp.innerText().catch(() => '');
    console.log('CONTENT PANE TEXT (head):', JSON.stringify(cpText.slice(0, 400)));

    if (/Depends on/.test(cpText) && /Design mockups/.test(cpText)) {
      ok('Content pane shows "Depends on: Design mockups" link');
    } else {
      fail('Content pane missing Depends-on chip');
    }
    if (/Blocked by:\s*Design mockups/.test(cpText)) {
      ok('Blocked-by indicator shows (prerequisite not Done)');
    } else {
      fail('Blocked-by indicator not shown');
    }

    await page.screenshot({ path: path.join(OUT, 'prerequisites.png'), fullPage: false });
    console.log('Screenshot saved');

    // 7. Remove the prerequisite via the × on the chip; blocked banner should clear.
    const removeBtn = cp.locator('button[title="Remove prerequisite"]').first();
    if (await removeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await removeBtn.click();
      await page.waitForTimeout(600);
      const after = await cp.innerText().catch(() => '');
      if (!/Blocked by:/.test(after) && !/Design mockups/.test(after)) {
        ok('Prerequisite removed inline; blocked banner cleared');
      } else {
        fail('Prerequisite not fully removed');
      }
    } else {
      fail('Remove (×) button not found on chip');
    }

  } catch (e) {
    fail('Exception: ' + e.message);
    console.error(e.stack);
    await page.screenshot({ path: path.join(OUT, 'prerequisites-error.png') }).catch(() => {});
  } finally {
    await browser.close();
    const failed = results.filter((r) => r[0] === 'FAIL');
    console.log(`\n=== RESULT: ${results.length - failed.length} ok / ${failed.length} failed ===`);
    process.exit(failed.length ? 1 : 0);
  }
})();
