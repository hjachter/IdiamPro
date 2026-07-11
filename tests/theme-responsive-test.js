const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { dismissWelcomeShowcase } = require('./_helpers');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT = path.resolve(__dirname, '..', 'test-screenshots', 'theme-responsive');
fs.mkdirSync(OUT, { recursive: true });
const FOCUS = path.resolve(__dirname, '..', 'scripts', 'focus-claude-terminal.sh');

function refocus() {
  try { execSync(`bash "${FOCUS}"`, { stdio: 'ignore' }); } catch (e) {}
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name) });
  console.log('  shot:', name);
  refocus();
}

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
  throw new Error('main window not found');
}

(async () => {
  const results = [];
  let app, page;
  try {
    refocus();
    const root = path.resolve(__dirname, '..');
    app = await electron.launch({ args: [root], env: { ...process.env, NODE_ENV: 'development' } });
    page = await findMainWindow(app);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(4000);
    if (!page.url().includes('/app')) {
      await page.evaluate(() => { window.location.href = '/app'; });
      await page.waitForLoadState('domcontentloaded');
    }
    // Wait until the app chrome is actually up (past "Loading...").
    for (let t = 0; t < 40; t++) {
      const ready = await page.locator('button:has-text("New Outline")').count();
      const loading = await page.locator('text=Loading...').count();
      if (ready && !loading) break;
      await page.waitForTimeout(1000);
    }
    await page.waitForTimeout(2000);
    await dismissWelcomeShowcase(page);

    // Ensure a content node is open so the content-pane toolbar renders.
    // Click first outline row / first node so content pane shows.
    try {
      // Click a node in the outline to open content pane
      const firstNode = page.locator('[data-testid^="node-"], .outline-node, [role="treeitem"]').first();
      if (await firstNode.count()) { await firstNode.click(); await page.waitForTimeout(800); }
    } catch (e) {}

    // ---- WIDE layout baseline ----
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.waitForTimeout(800);
    await shot(page, '01-wide-app.png');

    // ---- THEME: open Settings ----
    let settingsOpened = false;
    const settingsSelectors = [
      'button[aria-label="Settings"]',
      'button[aria-label*="ettings"]',
      '[data-testid="settings-button"]',
    ];
    for (const sel of settingsSelectors) {
      const b = page.locator(sel).first();
      if (await b.count()) {
        try { await b.click({ timeout: 3000 }); settingsOpened = true; break; } catch (e) {}
      }
    }
    if (!settingsOpened) {
      // try the more-tools overflow then Settings item
      try {
        const more = page.locator('button[aria-label="More tools"]').first();
        if (await more.count()) { await more.click(); await page.waitForTimeout(400); }
        const item = page.locator('text=Settings').first();
        if (await item.count()) { await item.click(); settingsOpened = true; }
      } catch (e) {}
    }
    await page.waitForTimeout(1000);
    await shot(page, '02-settings-open.png');
    results.push({ step: 'settings-open', ok: settingsOpened });

    async function pickTheme(label) {
      // Open the theme Select trigger. It's a shadcn Select near "Appearance".
      // Radix select trigger is a button with role combobox.
      const trigger = page.locator('button[role="combobox"]').filter({ hasText: /Light|Dark|Auto/i }).first();
      let clicked = false;
      if (await trigger.count()) {
        try { await trigger.click({ timeout: 3000 }); clicked = true; } catch (e) {}
      }
      if (!clicked) {
        // fallback: any combobox in dialog
        const anyCombo = page.locator('[role="dialog"] button[role="combobox"]').first();
        if (await anyCombo.count()) { await anyCombo.click(); clicked = true; }
      }
      await page.waitForTimeout(500);
      const opt = page.locator('[role="option"]', { hasText: new RegExp('^' + label + '$', 'i') }).first();
      if (await opt.count()) { await opt.click(); }
      await page.waitForTimeout(1200);
      const htmlClass = await page.evaluate(() => document.documentElement.className);
      return htmlClass;
    }

    let cls;
    cls = await pickTheme('Light');
    await shot(page, '03-theme-light.png');
    results.push({ step: 'theme-light', htmlClass: cls, ok: cls.includes('light') && !cls.includes('dark') });

    cls = await pickTheme('Dark');
    await shot(page, '04-theme-dark.png');
    results.push({ step: 'theme-dark', htmlClass: cls, ok: cls.includes('dark') });

    cls = await pickTheme('Auto');
    await shot(page, '05-theme-auto.png');
    results.push({ step: 'theme-auto', htmlClass: cls, ok: true });

    // Set to Dark for readable screenshots then close settings
    await pickTheme('Dark');
    // close dialog
    try { await page.keyboard.press('Escape'); await page.waitForTimeout(600); } catch (e) {}
    await shot(page, '06-after-settings-close.png');

    // ---- NARROW layout: toolbars overflow ----
    await page.setViewportSize({ width: 760, height: 900 });
    await page.waitForTimeout(1000);
    await shot(page, '07-narrow-app.png');

    // Select a leaf node so the content-pane editor + its toolbar render.
    try {
      const leaf = page.locator('text=ChildA').first();
      if (await leaf.count()) { await leaf.click(); await page.waitForTimeout(1000); }
      else {
        const anyNode = page.locator('[role="treeitem"], .outline-node').nth(2);
        if (await anyNode.count()) { await anyNode.click(); await page.waitForTimeout(1000); }
      }
    } catch (e) {}
    // On narrow layout the content pane is a collapsed bottom drawer; expand it
    // so the editor toolbar renders. Tap the "Tap to expand" peek bar.
    try {
      const expandBar = page.locator('text=Tap to expand').first();
      if (await expandBar.count()) { await expandBar.click(); await page.waitForTimeout(1200); }
    } catch (e) {}
    await shot(page, '07b-narrow-node-open.png');

    // Count More-tools triggers (outline pane + content pane both use aria-label "More tools")
    const moreCount = await page.locator('button[aria-label="More tools"]').count();
    results.push({ step: 'narrow-more-buttons', count: moreCount, ok: moreCount >= 1 });

    // Open the content-pane More menu. Content pane is the right/main area.
    // Grab the LAST More button (content pane toolbar sits after outline pane in DOM order typically).
    const moreBtns = page.locator('button[aria-label="More tools"]');
    let openedMore = false;
    if (moreCount >= 1) {
      const target = moreBtns.nth(moreCount - 1);
      try { await target.click({ timeout: 3000 }); openedMore = true; } catch (e) {}
      await page.waitForTimeout(600);
    }
    await shot(page, '08-narrow-content-more-open.png');
    // Read menu item text to confirm overflow tools present
    let menuText = '';
    try {
      const menu = page.locator('[role="menu"]').last();
      if (await menu.count()) menuText = await menu.innerText();
    } catch (e) {}
    results.push({ step: 'content-more-menu', opened: openedMore, menuText, ok: /list|Bullet|Insert|Import|Numbered|Checklist|Canvas|Drawing/i.test(menuText) });

    try { await page.keyboard.press('Escape'); } catch (e) {}
    await page.waitForTimeout(400);

    // ---- WIDE again: confirm still fine ----
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.waitForTimeout(800);
    await shot(page, '09-wide-again.png');
    const moreCountWide = await page.locator('button[aria-label="More tools"]:visible').count();
    results.push({ step: 'wide-more-hidden', visibleMore: moreCountWide, ok: true });

    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results, null, 2));
    console.log('RESULTS:', JSON.stringify(results, null, 2));
  } catch (e) {
    console.error('TEST ERROR:', e && e.message);
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ error: String(e && e.message), results }, null, 2));
  } finally {
    try { if (app) await app.close(); } catch (e) {}
    refocus();
  }
})();
