// Focused Playwright check: the bulk Research & Import action button now reads
// "Digest N Source(s)" (renamed from "Synthesize"). Adds one text source to
// enable the button, screenshots, and asserts the label. Does NOT run a real
// synthesis/AI call.
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { prepareApp } = require('./_helpers');

const OUT = path.resolve(__dirname, '..', 'test-screenshots', 'digest-label');
fs.mkdirSync(OUT, { recursive: true });

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

async function findMainWindow(app, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    for (const win of app.windows()) {
      try {
        const url = win.url();
        if (url.startsWith('devtools://')) continue;
        if (url.includes('localhost:9002')) return win;
      } catch {}
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Could not find main app window');
}

(async () => {
  const projectRoot = path.resolve(__dirname, '..');
  const app = await electron.launch({
    args: [projectRoot],
    env: { ...process.env, NODE_ENV: 'development' },
  });

  let result = { pass: false, buttonText: null, notes: [] };
  try {
    const page = await findMainWindow(app);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    if (!page.url().includes('/app')) {
      await page.evaluate(() => { window.location.href = '/app'; });
      await page.waitForLoadState('domcontentloaded');
      await page.locator('button:has-text("New Outline")').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    }
    await prepareApp(page);
    // Cost safety + suppress first-run notices that overlay the UI.
    await page.evaluate(() => {
      try {
        window.localStorage.setItem('aiProvider', 'local');
        window.localStorage.setItem('onboarding:dataProtectionSeen', 'true');
        window.localStorage.setItem('onboarding:dataProtectionMuted', 'true');
      } catch {}
    }).catch(() => {});
    await page.waitForTimeout(500);

    // Dismiss the data-protection notice if it is currently open.
    const gotIt = page.locator('[data-testid="data-protection-got-it"]');
    if ((await gotIt.count().catch(() => 0)) > 0 && (await gotIt.first().isVisible().catch(() => false))) {
      await gotIt.first().click().catch(() => {});
      await page.locator('[data-testid="data-protection-notice"]').first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    }
    // Dismiss the welcome showcase if it is (re)open.
    await page.evaluate(() => { try { window.localStorage.setItem('onboarding:welcomeShowcaseSeen', 'true'); } catch {} }).catch(() => {});
    const wsClose = page.locator('[data-testid="welcome-showcase-dont-show"], [data-testid="welcome-showcase-skip"]');
    for (let i = 0; i < 3; i++) {
      const ws = page.locator('[data-testid="welcome-showcase"]');
      if (!(await ws.first().isVisible().catch(() => false))) break;
      if ((await wsClose.count().catch(() => 0)) > 0) {
        await wsClose.first().click().catch(() => {});
      } else {
        await page.keyboard.press('Escape').catch(() => {});
      }
      await ws.first().waitFor({ state: 'hidden', timeout: 4000 }).catch(() => {});
    }
    await page.waitForTimeout(500);

    // Open the "Bring In" (Import) menu, then pick "Research & Import".
    // On narrow windows the button folds into the "More tools" (⋯) overflow.
    async function openBringInMenu() {
      const bringIn = page.locator('[aria-label="Bring In"]');
      if ((await bringIn.count().catch(() => 0)) > 0 && (await bringIn.first().isVisible().catch(() => false))) {
        await bringIn.first().click().catch(() => {});
        return true;
      }
      const more = page.locator('[aria-label="More tools"]');
      if ((await more.count().catch(() => 0)) > 0 && (await more.first().isVisible().catch(() => false))) {
        await more.first().click().catch(() => {});
        await page.waitForTimeout(400);
        // Some overflow layouts nest "Bring In" as a submenu; open it if present.
        const nestedBringIn = page.locator('[role="menuitem"]:has-text("Bring In")');
        if ((await nestedBringIn.count().catch(() => 0)) > 0) {
          await nestedBringIn.first().click().catch(() => {});
        }
        return true;
      }
      return false;
    }
    await openBringInMenu();
    await page.waitForTimeout(500);
    const rItem = page.locator('[role="menuitem"]:has-text("Research & Import")');
    await rItem.first().click({ timeout: 8000 });
    await page.waitForTimeout(1200);

    // Confirm dialog open (dialog title, not the outline tree node).
    await page.locator('[role="dialog"] >> text=Research & Import').first().waitFor({ state: 'visible', timeout: 8000 });
    await page.screenshot({ path: path.join(OUT, '01-dialog-open.png') }).catch(() => {});

    // Pick source type "Text / Notes" from the Radix select.
    const trigger = page.locator('button:has-text("Choose source type")');
    await trigger.first().click({ timeout: 8000 });
    await page.waitForTimeout(600);
    const textOpt = page.locator('[role="option"]:has-text("Text"), [role="option"]:has-text("Notes")');
    await textOpt.first().click({ timeout: 8000 });
    await page.waitForTimeout(800);

    // Fill content so the source becomes valid.
    const ta = page.locator('textarea[placeholder="Paste or type your content..."]');
    await ta.first().fill('The quick brown fox jumps over the lazy dog. This is a test source with enough content to be considered valid for the digest action.');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: path.join(OUT, '02-source-added.png') }).catch(() => {});

    // Read the action button label. It is the submit button at the dialog footer.
    const submitBtn = page.locator('button:has-text("Digest"), button:has-text("Synthesize")');
    const btnText = (await submitBtn.first().innerText().catch(() => '')).trim();
    result.buttonText = btnText;

    // Full-dialog screenshot for visual confirmation of the label.
    await page.screenshot({ path: path.join(OUT, '03-button-label.png') }).catch(() => {});

    result.pass = /Digest\s+1\s+Source/i.test(btnText) && !/Synthesize/i.test(btnText);
    if (!result.pass) result.notes.push(`Unexpected button text: "${btnText}"`);
  } catch (e) {
    result.notes.push('ERROR: ' + String((e && e.message) || e));
  } finally {
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(result, null, 2));
    console.log('RESULT ' + JSON.stringify(result));
    await Promise.race([app.close().catch(() => {}), new Promise((r) => setTimeout(r, 5000))]);
  }
  process.exit(result.pass ? 0 : 1);
})();
