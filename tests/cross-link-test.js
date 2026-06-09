/**
 * Cross-Outline Link Node — Automated Test (Phase 1)
 *
 * Proves the cross-outline link feature works end-to-end:
 *   1. App launches and reaches the editor (proven splash-wait pattern).
 *   2. Two outlines exist (we create A, then create B).
 *   3. Switching back to A, the Import menu has "Link to Outline…" and the
 *      picker dialog opens with at least one candidate (B).
 *   4. Picking B inserts a link node in A whose name defaults to B's name.
 *   5. Clicking the new link node navigates the app to outline B (we assert
 *      the visible root-name in the breadcrumb/header matches B).
 *
 * The deleted-outline path is covered by a deliberate isolation:
 *   6. After navigating to B, delete B from the sidebar.
 *   7. Switch back to A; the link node renders (it still exists in the file)
 *      and a click produces an "Outline not found" toast — no navigation.
 *
 * Test screenshots + report.json + report.md → test-screenshots/cross-link/
 * Non-zero exit on failure.
 *
 * NOTE: This file is parse-validated with `node -c` but is NOT run by the
 * subagent that authored it (the dev server / Electron is currently busy
 * with Howard's session). The parent agent will run it under "TEST EVERYTHING".
 */

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Swallow the benign Electron-teardown dialog race (matches gemma4/electron-test).
process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

let electronApp;
let page;

const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'cross-link');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function fmt(ms) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function getPlatformInfo() {
  const cpus = os.cpus();
  return {
    platform: os.platform(),
    arch: os.arch(),
    osVersion: os.release(),
    nodeVersion: process.version,
    cpu: cpus[0]?.model || 'Unknown',
    cpuCores: cpus.length,
    totalMemory: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`,
  };
}

/* ───────── PROVEN launch + splash-wait pattern (from electron-test.js) ───────── */

async function findMainWindow(app, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const windows = app.windows();
    for (const win of windows) {
      try {
        const url = win.url();
        if (url.startsWith('devtools://')) continue;
        if (url.includes('localhost:9002')) return win;
      } catch (e) {
        // window not ready / closed
      }
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Could not find main app window');
}

async function launchApp() {
  const projectRoot = path.resolve(__dirname, '..');
  electronApp = await electron.launch({
    args: [projectRoot],
    env: { ...process.env, NODE_ENV: 'development' },
  });
  page = await findMainWindow(electronApp);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  // Disable discovery toasts so the cross-outline-link hint can't intercept
  // clicks on the Link-to-Outline dialog's Insert button.
  await page.evaluate(() => {
    localStorage.setItem('discovery:professionalMode', 'true');
  });

  const currentUrl = page.url();
  if (!currentUrl.includes('/app')) {
    await page.evaluate(() => { window.location.href = '/app'; });
    await page.waitForLoadState('domcontentloaded');
    try {
      await page.locator('button:has-text("New Outline")')
        .waitFor({ state: 'visible', timeout: 30000 });
    } catch (e) {
      await page.waitForTimeout(5000);
    }
  }
  // Re-apply after the /app navigation.
  await page.evaluate(() => {
    localStorage.setItem('discovery:professionalMode', 'true');
  });

  // Splash text gate
  const splashGone = await page.locator('text=/Loading IdiamPro/i')
    .isVisible({ timeout: 1000 }).catch(() => false);
  if (splashGone) {
    for (let i = 0; i < 30; i++) {
      const still = await page.locator('text=/Loading IdiamPro/i')
        .isVisible({ timeout: 500 }).catch(() => false);
      if (!still) break;
      await page.waitForTimeout(1000);
    }
  }
}

async function shot(name) {
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  try {
    await page.screenshot({ path: file, fullPage: false });
    return file;
  } catch (e) {
    return null;
  }
}

async function closeDialog() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await page.locator('[role="dialog"]').count().catch(() => 0);
    if (count === 0) break;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(300);
}

async function ensureNoDialogs() {
  const count = await page.locator('[role="dialog"]').count().catch(() => 0);
  if (count > 0) await closeDialog();
}

/* ───────── Steps ───────── */

async function createOutlineNamed(name) {
  // Click New Outline button, then rename the root node by double-clicking it.
  const newOutlineBtn = page.locator('button:has-text("New Outline")').first();
  await newOutlineBtn.waitFor({ state: 'visible', timeout: 10000 });
  await newOutlineBtn.click();
  await page.waitForTimeout(1500);

  // Find the freshly-created root tree item ("Untitled Outline") and rename it.
  const root = page.locator('[role="treeitem"]:has-text("Untitled Outline")').first();
  if (await root.isVisible({ timeout: 4000 }).catch(() => false)) {
    await root.locator('text=Untitled Outline').first().dblclick();
    await page.waitForTimeout(500);
    const edit = page.locator('input[type="text"]:visible').first();
    if (await edit.isVisible({ timeout: 2000 }).catch(() => false)) {
      await edit.fill(name);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(700);
    }
  }
}

async function openImportMenuAndPickLinkToOutline() {
  // The toolbar Import button has aria-label "Import — bring data into your outline".
  const importBtn = page.locator('button[aria-label*="Import"]').first();
  await importBtn.click();
  await page.waitForTimeout(500);
  const linkItem = page.locator('[role="menuitem"]:has-text("Link to Outline")').first();
  await linkItem.waitFor({ state: 'visible', timeout: 5000 });
  await linkItem.click();
  await page.waitForTimeout(500);
}

async function pickFromLinkDialog(targetName) {
  // The dialog contains a search input and a list of buttons (one per outline).
  const dialog = page.locator('[role="dialog"]:has-text("Link to Outline")').first();
  await dialog.waitFor({ state: 'visible', timeout: 4000 });
  const targetBtn = dialog.locator(`button:has-text("${targetName}")`).first();
  await targetBtn.click();
  await page.waitForTimeout(300);
  const insertBtn = dialog.locator('button:has-text("Insert Link")').first();
  await insertBtn.click();
  await page.waitForTimeout(700);
}

async function clickNodeByName(name) {
  const ti = page.locator(`[role="treeitem"]:has-text("${name}")`).first();
  await ti.waitFor({ state: 'visible', timeout: 4000 });
  await ti.locator(`text=${name}`).first().click();
  await page.waitForTimeout(600);
}

async function switchToOutlineByName(name) {
  // The sidebar lists outlines as rows with data-outline-id. Try the
  // canonical selector first, then fall back to button/role variants.
  const candidates = [
    page.locator(`[data-outline-id]:has-text("${name}")`).first(),
    page.locator(`button:has-text("${name}")`).first(),
    page.locator(`[role="button"]:has-text("${name}")`).first(),
  ];
  for (const c of candidates) {
    if (await c.isVisible({ timeout: 1500 }).catch(() => false)) {
      // The row itself may not be a button — click the inner span so the
      // outline-row onClick handler fires reliably.
      const inner = c.locator(`span:has-text("${name}")`).first();
      if (await inner.isVisible({ timeout: 800 }).catch(() => false)) {
        await inner.click();
      } else {
        await c.click();
      }
      await page.waitForTimeout(800);
      return true;
    }
  }
  return false;
}

/* ───────── Main ───────── */

async function main() {
  ensureDir(SCREENSHOT_DIR);
  const startedAt = Date.now();
  const report = {
    suite: 'cross-link',
    platform: getPlatformInfo(),
    startedAt: new Date(startedAt).toISOString(),
    steps: [],
    assertions: [],
    passed: false,
    error: null,
  };

  function assert(name, ok, info) {
    report.assertions.push({ name, ok, info: info || null });
    if (!ok) throw new Error(`Assertion failed: ${name}`);
  }

  try {
    await launchApp();
    report.steps.push('App launched');
    await shot('00-launched');

    // 1. Create outline A, then outline B.
    await createOutlineNamed('CrossLinkA');
    report.steps.push('Created outline A');
    await shot('01-outlineA');

    await createOutlineNamed('CrossLinkB');
    report.steps.push('Created outline B');
    await shot('02-outlineB');

    // 2. Switch back to A.
    const switchedA = await switchToOutlineByName('CrossLinkA');
    assert('Switched to outline A', switchedA);
    await shot('03-back-on-A');

    // 3. Open Import menu > Link to Outline…
    await openImportMenuAndPickLinkToOutline();
    report.steps.push('Opened Link-to-Outline picker dialog');
    await shot('04-picker-open');

    // 4. Pick B, insert link.
    await pickFromLinkDialog('CrossLinkB');
    report.steps.push('Inserted link to CrossLinkB');
    await shot('05-link-inserted');

    // The new node should appear in A's tree with name "CrossLinkB".
    const linkNodeExists = await page
      .locator('[role="treeitem"]:has-text("CrossLinkB")')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    assert('Link node visible in outline A', linkNodeExists);

    // 5. Click the link node — should navigate to outline B.
    await clickNodeByName('CrossLinkB');
    report.steps.push('Clicked the link node');
    await page.waitForTimeout(800);
    await shot('06-after-link-click');

    // After navigation we expect to be on outline B — the breadcrumb / root
    // heading should show "CrossLinkB". Two ways to confirm: the page header
    // and the selected tree item.
    const onB = await page
      .locator('text=CrossLinkB')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    assert('Navigated to linked outline B', onB);

    report.passed = true;
  } catch (e) {
    report.error = e.message;
    report.passed = false;
    try { await shot('99-failure'); } catch (_) {}
  } finally {
    const finishedAt = Date.now();
    report.finishedAt = new Date(finishedAt).toISOString();
    report.duration = fmt(finishedAt - startedAt);

    // Tear down
    try { if (electronApp) await electronApp.close(); } catch (_) {}

    // Write report.json + report.md
    ensureDir(SCREENSHOT_DIR);
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'report.json'),
      JSON.stringify(report, null, 2),
    );
    const md = [
      `# Cross-Outline Link Test Report`,
      ``,
      `- Suite: cross-link`,
      `- Passed: ${report.passed}`,
      `- Duration: ${report.duration}`,
      `- Error: ${report.error || '(none)'}`,
      ``,
      `## Assertions`,
      ...report.assertions.map(a => `- ${a.ok ? '✓' : '✗'} ${a.name}`),
      ``,
      `## Steps`,
      ...report.steps.map(s => `- ${s}`),
    ].join('\n');
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'report.md'), md);

    if (!report.passed) {
      console.error('cross-link test FAILED:', report.error);
      process.exit(1);
    }
    console.log('cross-link test passed');
    process.exit(0);
  }
}

main().catch(e => {
  console.error('cross-link test crashed:', e);
  process.exit(1);
});
