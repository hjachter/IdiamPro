// Outline-list sort test (2026-07-23).
//
// Verifies the new "Recent / Name" sort control on the outline list (the
// desktop sidebar — which IS the outline list/manager on desktop):
//   1. Default sort mode is "Recent" (most-recently-modified first).
//   2. Editing an outline floats it to the TOP under "Recent".
//   3. Switching to "Name" orders the list A–Z.
//   4. The chosen mode persists across a full reload.
//
// Follows the launch/report pattern in electron-test.js.

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { prepareApp } = require('./_helpers');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT_DIR = path.join(__dirname, '..', 'test-screenshots', 'outline-sort');
fs.mkdirSync(OUT_DIR, { recursive: true });

let electronApp;
let page;
const steps = [];
function log(m) { console.log(m); steps.push(m); }

async function shot(name) {
  try { await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`) }); } catch {}
}

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
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Could not find main app window');
}

// Read the visible outline-row names, in DOM order, filtered to our test rows.
async function testRowOrder() {
  return page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('[data-testid="sidebar-outline-name"]'));
    return els
      .map(e => e.getAttribute('data-outline-name') || '')
      .filter(n => n.includes('SortTest'));
  });
}

async function currentSortMode() {
  return page.evaluate(() => {
    const c = document.querySelector('[data-testid="outline-sort-control"]');
    return c ? c.getAttribute('data-sort-mode') : null;
  });
}

async function createAndRename(newName) {
  await page.locator('button:has-text("New Outline")').first().click();
  await page.waitForTimeout(800);
  // Exactly one freshly-created "Untitled Outline" row exists at this moment.
  const actions = page.locator('[aria-label="Actions for Untitled Outline"]').first();
  await actions.click();
  await page.waitForTimeout(250);
  await page.locator('[role="menuitem"]:has-text("Rename")').first().click();
  await page.waitForTimeout(250);
  const input = page.locator('[data-testid="outline-rename-input"]');
  await input.waitFor({ state: 'visible', timeout: 10000 });
  await input.click();
  await input.fill(newName);
  await input.press('Enter');
  await page.waitForTimeout(600);
  log(`Created + renamed outline to "${newName}"`);
}

// Re-touch an existing outline (rename to same name) so it becomes the
// most-recently-modified — the "edit one" step.
async function touch(name) {
  const actions = page.locator(`[aria-label="Actions for ${name}"]`).first();
  await actions.click();
  await page.waitForTimeout(250);
  await page.locator('[role="menuitem"]:has-text("Rename")').first().click();
  await page.waitForTimeout(250);
  const input = page.locator('[data-testid="outline-rename-input"]');
  await input.waitFor({ state: 'visible', timeout: 10000 });
  await input.click();
  await input.fill(name + ' EDITED');
  await input.press('Enter');
  await page.waitForTimeout(400);
  // rename back so the name stays stable for later assertions
  const actions2 = page.locator(`[aria-label="Actions for ${name} EDITED"]`).first();
  await actions2.click();
  await page.waitForTimeout(250);
  await page.locator('[role="menuitem"]:has-text("Rename")').first().click();
  await page.waitForTimeout(250);
  const input2 = page.locator('[data-testid="outline-rename-input"]');
  await input2.waitFor({ state: 'visible', timeout: 10000 });
  await input2.click();
  await input2.fill(name);
  await input2.press('Enter');
  await page.waitForTimeout(600);
  log(`Edited (touched) "${name}" so it is now the most-recently-modified`);
}

async function run() {
  const projectRoot = path.resolve(__dirname, '..');
  electronApp = await electron.launch({
    args: [projectRoot],
    env: { ...process.env, NODE_ENV: 'development' },
  });
  page = await findMainWindow(electronApp);
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  if (!page.url().includes('/app')) {
    await page.evaluate(() => { window.location.href = '/app'; });
    await page.waitForLoadState('domcontentloaded');
    await page.locator('button:has-text("New Outline")').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  }
  await prepareApp(page);
  await page.evaluate(() => { try { window.localStorage.setItem('aiProvider', 'local'); } catch {} });
  await page.waitForTimeout(1000);

  const failures = [];
  const check = (cond, msg) => { if (cond) { log('PASS: ' + msg); } else { failures.push(msg); log('FAIL: ' + msg); } };

  // 0) Default sort mode is Recent.
  const defaultMode = await currentSortMode();
  check(defaultMode === 'recent', `Default sort mode is "Recent" (got "${defaultMode}")`);
  await shot('00-default-recent');

  // 1) Create three outlines whose creation order differs from alphabetical.
  //    Creation (recency) order newest->oldest: Bravo, Alpha, Charlie.
  //    Alphabetical: Alpha, Bravo, Charlie.
  await createAndRename('Charlie SortTest');
  await createAndRename('Alpha SortTest');
  await createAndRename('Bravo SortTest');

  // 2) Edit Charlie last so it becomes the most-recently-modified.
  await touch('Charlie SortTest');
  await page.waitForTimeout(500);

  // 3) Recent mode: Charlie (just edited) must be the FIRST of our test rows.
  await page.locator('[data-testid="outline-sort-recent"]').click();
  await page.waitForTimeout(500);
  const recentOrder = await testRowOrder();
  log('Recent order: ' + JSON.stringify(recentOrder));
  check(recentOrder[0] === 'Charlie SortTest', `Recent puts the just-edited outline on top (got "${recentOrder[0]}")`);
  await shot('01-recent-order');

  // 4) Name mode: alphabetical -> Alpha, Bravo, Charlie.
  await page.locator('[data-testid="outline-sort-name"]').click();
  await page.waitForTimeout(500);
  const nameOrder = await testRowOrder();
  log('Name order: ' + JSON.stringify(nameOrder));
  check(
    nameOrder.join('|') === 'Alpha SortTest|Bravo SortTest|Charlie SortTest',
    `Name sorts A–Z (got ${JSON.stringify(nameOrder)})`
  );
  await shot('02-name-order');

  // 5) Persistence: reload with Name selected; it must still be Name.
  await page.waitForTimeout(1200); // let autosave settle before reload
  await page.evaluate(() => { window.location.href = '/app'; });
  await page.waitForLoadState('domcontentloaded');
  await page.locator('[data-testid="outline-sort-control"]').first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  await prepareApp(page);
  await page.waitForTimeout(1000);
  const afterReload = await currentSortMode();
  check(afterReload === 'name', `Sort choice persists across reload (got "${afterReload}")`);
  await shot('03-after-reload-name');

  // 6) Confirm A–Z order survived the reload too (sidebar reflects the mode).
  const nameOrderReload = await testRowOrder();
  log('Name order after reload: ' + JSON.stringify(nameOrderReload));
  check(
    nameOrderReload.join('|') === 'Alpha SortTest|Bravo SortTest|Charlie SortTest',
    `Sidebar list still A–Z after reload (got ${JSON.stringify(nameOrderReload)})`
  );

  // Cleanup: restore default Recent for a clean app state.
  await page.locator('[data-testid="outline-sort-recent"]').click().catch(() => {});
  await page.waitForTimeout(300);

  const report = {
    passed: failures.length === 0,
    failures,
    steps,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(OUT_DIR, 'report.md'),
    `# Outline Sort Test\n\n${report.passed ? 'ALL PASSED' : 'FAILURES: ' + failures.join('; ')}\n\n## Steps\n\n` +
      steps.map(s => `- ${s}`).join('\n') + '\n'
  );
  return report;
}

run()
  .then(async (report) => {
    try { await electronApp.close(); } catch {}
    console.log(report.passed ? '\nOUTLINE SORT TEST: ALL PASSED' : '\nOUTLINE SORT TEST: FAILED -> ' + report.failures.join('; '));
    process.exit(report.passed ? 0 : 1);
  })
  .catch(async (err) => {
    console.error(err);
    try { await shot('99-error'); } catch {}
    try { await electronApp.close(); } catch {}
    process.exit(1);
  });
