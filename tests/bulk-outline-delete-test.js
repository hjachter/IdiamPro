// Bulk multi-select outline delete — sidebar context-menu path.
//
// Regression test for the bug where multi-selecting several outlines in the
// sidebar, right-clicking the highlighted set, and choosing Delete did NOT
// delete the whole selection (the row context/⋯ menu ignored the selection
// and only ever targeted the single right-clicked outline).
//
// This suite:
//   1. Creates 3 fresh "Untitled Outline" outlines.
//   2. Cmd/Meta+Clicks all 3 in the sidebar to build a multi-selection.
//   3. Verifies the "3 selected" bar appears.
//   4. Right-clicks a selected row and clicks the "Delete 3 Outlines" item.
//   5. Confirms the destructive AlertDialog (if it appears).
//   6. Asserts all 3 disappeared from the sidebar.
//
// Screenshots are written to test-screenshots/bulk-outline-delete/ and a
// report.{json,md} summarises pass/fail.

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { prepareApp } = require('./_helpers');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'bulk-outline-delete');
fs.mkdirSync(OUT_DIR, { recursive: true });

let electronApp;
let page;
let shot = 0;
async function snap(name) {
  shot += 1;
  const file = path.join(OUT_DIR, `${String(shot).padStart(2, '0')}-${name}.png`);
  try { await page.screenshot({ path: file, fullPage: false }); } catch {}
  return file;
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
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Could not find main app window');
}

async function launch() {
  const projectRoot = path.resolve(__dirname, '..');
  electronApp = await electron.launch({
    args: [projectRoot],
    env: { ...process.env, NODE_ENV: 'development' },
  });
  page = await findMainWindow(electronApp);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  if (!page.url().includes('/app')) {
    await page.evaluate(() => { window.location.href = '/app'; });
    await page.waitForLoadState('domcontentloaded');
    try {
      await page.locator('button:has-text("New Outline")').waitFor({ state: 'visible', timeout: 30000 });
    } catch { await page.waitForTimeout(5000); }
  }
  await prepareApp(page);
  // Force the confirmation dialog to appear (not pro-suppressed) so we exercise
  // the confirm path, and route AI to local just in case.
  await page.evaluate(() => {
    try {
      window.localStorage.removeItem('confirm.deleteOutline.suppressed');
      window.localStorage.setItem('confirmDelete', 'true');
      window.localStorage.setItem('aiProvider', 'local');
    } catch {}
  }).catch(() => {});
}

async function closeApp() {
  if (!electronApp) return;
  await Promise.race([
    electronApp.close().catch(() => {}),
    new Promise((r) => setTimeout(r, 5000)),
  ]);
}

// Dismiss any first-run modal (data-protection notice, welcome, etc.) whose
// backdrop intercepts clicks. Marks the notice "seen" so it can't remount, and
// clicks the affirmative button / Escape until no dark backdrop remains.
async function dismissBlockingOverlays() {
  await page.evaluate(() => {
    try {
      window.localStorage.setItem('onboarding:dataProtectionSeen', 'true');
      window.localStorage.setItem('onboarding:dataProtectionMuted', 'true');
      window.localStorage.setItem('onboarding:welcomeShowcaseSeen', 'true');
    } catch {}
  }).catch(() => {});
  for (let i = 0; i < 12; i += 1) {
    const overlay = page.locator('div.fixed.inset-0.z-50[aria-hidden="true"]');
    const blocked = await overlay.first().isVisible().catch(() => false);
    if (!blocked) return;
    const gotIt = page.locator('button:has-text("Got it")');
    if ((await gotIt.count().catch(() => 0)) > 0 && (await gotIt.first().isVisible().catch(() => false))) {
      await gotIt.first().click().catch(() => {});
    } else {
      await page.keyboard.press('Escape').catch(() => {});
    }
    await page.waitForTimeout(400);
  }
}

// Sidebar-scoped locator for outline name rows.
function untitledRows() {
  return page.locator('.sidebar-shadow').getByText('Untitled Outline', { exact: true });
}

async function run() {
  const details = { steps: [] };
  let passed = false;
  try {
    await launch();
    await dismissBlockingOverlays();
    await snap('app-loaded');

    const newOutlineBtn = page.locator('button:has-text("New Outline")').first();
    const baseline = await untitledRows().count();
    details.steps.push(`Baseline "Untitled Outline" rows: ${baseline}`);

    // 1. Create 3 fresh outlines.
    for (let i = 0; i < 3; i += 1) {
      await newOutlineBtn.click();
      await page.waitForTimeout(600);
    }
    await page.waitForTimeout(500);
    const afterCreate = await untitledRows().count();
    details.steps.push(`After creating 3: ${afterCreate} rows`);
    await snap('after-create-3');
    if (afterCreate < baseline + 3) {
      throw new Error(`Expected at least ${baseline + 3} rows, saw ${afterCreate}`);
    }

    // 2. Multi-select the 3 newest (last 3 in the list) via Meta+Click.
    const total = afterCreate;
    const targetIdx = [total - 3, total - 2, total - 1];
    for (const idx of targetIdx) {
      await untitledRows().nth(idx).click({ modifiers: ['Meta'] });
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(300);
    await snap('after-multiselect');

    // 3. Verify the selection bar shows "3 selected".
    const selBar = page.locator('.sidebar-shadow').getByText('3 selected', { exact: false });
    const selVisible = await selBar.first().isVisible().catch(() => false);
    details.steps.push(`"3 selected" bar visible: ${selVisible}`);
    if (!selVisible) throw new Error('Multi-selection bar did not show "3 selected"');

    // 4. Right-click a selected row -> context menu -> "Delete 3 Outlines".
    await untitledRows().nth(total - 2).click({ button: 'right' });
    await page.waitForTimeout(500);
    await snap('context-menu-open');
    const bulkItem = page.locator('[role="menuitem"]:has-text("Delete 3 Outlines")');
    const bulkVisible = await bulkItem.first().isVisible().catch(() => false);
    details.steps.push(`Context menu shows "Delete 3 Outlines": ${bulkVisible}`);
    if (!bulkVisible) {
      // Diagnostic: dump any visible menu items.
      const items = await page.locator('[role="menuitem"]').allTextContents().catch(() => []);
      details.menuItems = items;
      throw new Error('Context menu did not offer "Delete 3 Outlines"');
    }
    await bulkItem.first().click();
    await page.waitForTimeout(400);

    // 5. Confirm the destructive dialog if it appears.
    const dialog = page.locator('[role="alertdialog"]');
    const dialogVisible = await dialog.first().isVisible().catch(() => false);
    details.steps.push(`Confirm dialog visible: ${dialogVisible}`);
    await snap('confirm-dialog');
    if (dialogVisible) {
      const title = await dialog.first().innerText().catch(() => '');
      details.steps.push(`Dialog title/text includes "3": ${/3\s+Outlines/i.test(title)}`);
      const confirmBtn = dialog.locator('button:has-text("Delete")').last();
      await confirmBtn.click();
      await page.waitForTimeout(1200);
    }
    await snap('after-delete');

    // 6. Assert the 3 outlines are gone.
    const afterDelete = await untitledRows().count();
    details.steps.push(`After delete: ${afterDelete} rows (expected ${afterCreate - 3})`);
    if (afterDelete !== afterCreate - 3) {
      throw new Error(`Bulk delete failed: expected ${afterCreate - 3} rows, saw ${afterDelete}`);
    }

    passed = true;
    details.steps.push('PASS: sidebar bulk multi-select delete removed all 3 selected outlines.');
  } catch (err) {
    details.error = err.message;
    await snap('failure');
  } finally {
    await closeApp();
  }

  const report = {
    suite: 'bulk-outline-delete',
    passed,
    timestamp: new Date().toISOString(),
    details,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  const md = [
    `# Bulk Outline Delete — ${passed ? 'PASS ✅' : 'FAIL ❌'}`,
    '',
    ...details.steps.map((s) => `- ${s}`),
    details.error ? `\n**Error:** ${details.error}` : '',
    details.menuItems ? `\n**Menu items seen:** ${JSON.stringify(details.menuItems)}` : '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), md);

  console.log(md);
  process.exit(passed ? 0 : 1);
}

run();
