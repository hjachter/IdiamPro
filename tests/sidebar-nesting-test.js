/**
 * Sidebar Nesting of Linked Outlines — Automated Test (Cross-link Phase 2)
 *
 * Proves the sidebar nesting feature works end-to-end:
 *   1. Create outline A and outline B; insert a link in A → B.
 *      Assert B appears nested under A in the sidebar (data-nested="true").
 *   2. Toggle the chevron on A; verify the nested B row visibility flips.
 *   3. Set the persistence flag, reload, and assert it persists.
 *   4. Cycle case: A links to B, B links back to A.
 *      Assert no infinite render; assert the cycle leaf indicator is present.
 *   5. Multi-parent: A and C both link to B.
 *      Assert B appears nested under both A and C.
 *   6. Dedupe: A has two link nodes both pointing to B.
 *      Assert B appears nested under A exactly ONCE.
 *   7. Delete B; assert the link node in A goes to the "deleted outline"
 *      muted state from Phase 1 (the nested sidebar row disappears, but
 *      the in-outline link node remains and shows a destructive toast on
 *      click — verified indirectly: nested row count drops to zero).
 *
 * Test screenshots + report.json + report.md → test-screenshots/sidebar-nesting/
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

// Swallow the benign Electron-teardown dialog race.
process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

let electronApp;
let page;

const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'sidebar-nesting');

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
  // Re-apply after the /app navigation in case the localStorage write
  // happened on a different origin/path.
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

/* ───────── Steps ───────── */

async function createOutlineNamed(name) {
  const newOutlineBtn = page.locator('button:has-text("New Outline")').first();
  await newOutlineBtn.waitFor({ state: 'visible', timeout: 10000 });
  await newOutlineBtn.click();
  await page.waitForTimeout(1500);

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

async function insertOutlineLinkFromImportMenu(targetName) {
  const importBtn = page.locator('button[aria-label*="Import"]').first();
  await importBtn.click();
  await page.waitForTimeout(500);
  const linkItem = page.locator('[role="menuitem"]:has-text("Link to Outline")').first();
  await linkItem.waitFor({ state: 'visible', timeout: 5000 });
  await linkItem.click();
  await page.waitForTimeout(500);

  const dialog = page.locator('[role="dialog"]:has-text("Link to Outline")').first();
  await dialog.waitFor({ state: 'visible', timeout: 4000 });
  const targetBtn = dialog.locator(`button:has-text("${targetName}")`).first();
  await targetBtn.click();
  await page.waitForTimeout(300);
  const insertBtn = dialog.locator('button:has-text("Insert Link")').first();
  await insertBtn.click();
  await page.waitForTimeout(700);
}

async function switchToOutlineByName(name) {
  const candidates = [
    page.locator(`[data-outline-id]:has-text("${name}")`).first(),
    page.locator(`button:has-text("${name}")`).first(),
    page.locator(`[role="button"]:has-text("${name}")`).first(),
  ];
  for (const c of candidates) {
    if (await c.isVisible({ timeout: 1500 }).catch(() => false)) {
      await c.click();
      await page.waitForTimeout(800);
      return true;
    }
  }
  return false;
}

async function countSidebarRowsFor(outlineName, opts = {}) {
  // Returns: { total, nested, topLevel, cycleLeaves }
  // Identifies rows by name match within data-outline-id elements.
  return await page.evaluate(({ name }) => {
    const rows = Array.from(document.querySelectorAll('[data-outline-id]'));
    let total = 0;
    let nested = 0;
    let topLevel = 0;
    for (const row of rows) {
      const text = row.textContent || '';
      if (!text.includes(name)) continue;
      total += 1;
      if (row.getAttribute('data-nested') === 'true') nested += 1;
      else topLevel += 1;
    }
    const cycleLeaves = Array.from(
      document.querySelectorAll('[data-cycle-leaf="true"]')
    ).filter(el => (el.textContent || '').includes(name)).length;
    return { total, nested, topLevel, cycleLeaves };
  }, { name: outlineName });
}

async function clickChevronOnRow(outlineName) {
  // Click the chevron-button inside the first matching row.
  const result = await page.evaluate(({ name }) => {
    const rows = Array.from(document.querySelectorAll('[data-outline-id][data-nested="false"]'));
    for (const row of rows) {
      const text = row.textContent || '';
      if (!text.includes(name)) continue;
      const btn = row.querySelector('button[aria-label*="linked outlines"]');
      if (btn) {
        btn.click();
        return true;
      }
    }
    return false;
  }, { name: outlineName });
  await page.waitForTimeout(400);
  return result;
}

/* ───────── Main ───────── */

async function main() {
  console.log('═══ sidebar-nesting test starting ═══');
  ensureDir(SCREENSHOT_DIR);
  const startedAt = Date.now();
  const report = {
    suite: 'sidebar-nesting',
    platform: getPlatformInfo(),
    startedAt: new Date(startedAt).toISOString(),
    steps: [],
    assertions: [],
    passed: false,
    error: null,
  };

  function assert(name, ok, info) {
    report.assertions.push({ name, ok, info: info || null });
    if (!ok) throw new Error(`Assertion failed: ${name}${info ? ' — ' + JSON.stringify(info) : ''}`);
  }

  try {
    console.log('launching app...');
    await launchApp();
    console.log('app launched, building outlines');
    report.steps.push('App launched');
    await shot('00-launched');

    // ── Setup: create A, B, C ────────────────────────────────────────────
    await createOutlineNamed('NestA');
    await createOutlineNamed('NestB');
    await createOutlineNamed('NestC');
    report.steps.push('Created NestA, NestB, NestC');
    await shot('01-three-outlines');

    // ── Test 1: link in A → B; B appears nested under A ──────────────────
    await switchToOutlineByName('NestA');
    await insertOutlineLinkFromImportMenu('NestB');
    await shot('02-A-links-to-B');
    // Force-expand A by clicking its chevron (default state is collapsed).
    await clickChevronOnRow('NestA');
    await page.waitForTimeout(400);

    let counts = await countSidebarRowsFor('NestB');
    assert('B appears at root + nested once under A', counts.total >= 2, counts);
    assert('B appears nested at least once', counts.nested >= 1, counts);

    // ── Test 2: chevron toggles visibility ───────────────────────────────
    await clickChevronOnRow('NestA');
    await page.waitForTimeout(400);
    counts = await countSidebarRowsFor('NestB');
    assert('After collapse, B only at root', counts.nested === 0, counts);
    // Re-expand for next steps.
    await clickChevronOnRow('NestA');
    await page.waitForTimeout(400);

    // ── Test 3: persistence — set state, reload, verify ─────────────────
    // Locate NestA's outline ID via the data attribute, then poke localStorage
    // directly to set expansion to true, then reload and check it stays.
    const nestAId = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[data-outline-id][data-nested="false"]'));
      for (const r of rows) {
        if ((r.textContent || '').includes('NestA')) {
          return r.getAttribute('data-outline-id');
        }
      }
      return null;
    });
    assert('Found NestA outline ID', !!nestAId);
    await page.evaluate((id) => {
      window.localStorage.setItem(`sidebarExpanded:${id}`, 'true');
    }, nestAId);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    // Splash gate after reload.
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
    await page.waitForTimeout(1500);
    counts = await countSidebarRowsFor('NestB');
    assert('After reload, B is still nested (persisted)', counts.nested >= 1, counts);
    await shot('03-persisted-after-reload');

    // ── Test 4: multi-parent — C also links to B ─────────────────────────
    await switchToOutlineByName('NestC');
    await insertOutlineLinkFromImportMenu('NestB');
    await page.evaluate(() => {
      // Force-expand all known parents via localStorage so the counts pick up.
      const rows = Array.from(document.querySelectorAll('[data-outline-id][data-nested="false"]'));
      for (const r of rows) {
        const id = r.getAttribute('data-outline-id');
        if (id) window.localStorage.setItem(`sidebarExpanded:${id}`, 'true');
      }
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
    counts = await countSidebarRowsFor('NestB');
    assert('B appears nested under both A and C', counts.nested >= 2, counts);
    await shot('04-multi-parent');

    // ── Test 5: dedupe — add a second link in A → B ──────────────────────
    await switchToOutlineByName('NestA');
    await insertOutlineLinkFromImportMenu('NestB');
    await page.waitForTimeout(800);
    counts = await countSidebarRowsFor('NestB');
    // We added a second link in A, so the in-outline tree should now have
    // two link nodes pointing at B. The sidebar must dedupe — total nested
    // count should remain 2 (one under A, one under C), not 3.
    assert('Dedupe: B still nested exactly twice (A + C)', counts.nested === 2, counts);
    await shot('05-dedupe');

    // ── Test 6: cycle — make B link back to A ────────────────────────────
    await switchToOutlineByName('NestB');
    await insertOutlineLinkFromImportMenu('NestA');
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[data-outline-id][data-nested="false"]'));
      for (const r of rows) {
        const id = r.getAttribute('data-outline-id');
        if (id) window.localStorage.setItem(`sidebarExpanded:${id}`, 'true');
      }
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
    // The cycle: A -> B -> A. When expanded, A's child B is shown; expanding
    // B would show its child A, but A is already an ancestor → cycle leaf.
    // We assert that at least one cycle leaf row exists for NestA.
    const cycleCounts = await countSidebarRowsFor('NestA');
    assert('Cycle leaf rendered for A under B', cycleCounts.cycleLeaves >= 1, cycleCounts);
    // Also assert page didn't infinite-loop / crash by checking the body
    // is still responsive.
    const bodyReady = await page.locator('body').isVisible().catch(() => false);
    assert('Page still responsive after cycle render', bodyReady);
    await shot('06-cycle-leaf');

    // ── Test 7: delete B; nested rows for B should disappear ─────────────
    // Open the dropdown for B (top-level) and delete it.
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[data-outline-id][data-nested="false"]'));
      for (const r of rows) {
        if ((r.textContent || '').includes('NestB')) {
          const btn = r.querySelector('button[aria-label*="Actions for"]');
          if (btn) (btn).click();
          break;
        }
      }
    });
    await page.waitForTimeout(400);
    const deleteMenu = page.locator('[role="menuitem"]:has-text("Delete")').first();
    if (await deleteMenu.isVisible({ timeout: 1500 }).catch(() => false)) {
      await deleteMenu.click();
      await page.waitForTimeout(500);
      const confirm = page.locator('button:has-text("Delete")').last();
      if (await confirm.isVisible({ timeout: 1500 }).catch(() => false)) {
        await confirm.click();
        await page.waitForTimeout(800);
      }
    }
    counts = await countSidebarRowsFor('NestB');
    assert('After deleting B, no sidebar rows for B remain', counts.total === 0, counts);
    await shot('07-after-delete-B');

    report.passed = true;
  } catch (e) {
    report.error = e.message;
    report.passed = false;
    try { await shot('99-failure'); } catch (_) {}
  } finally {
    const finishedAt = Date.now();
    report.finishedAt = new Date(finishedAt).toISOString();
    report.duration = fmt(finishedAt - startedAt);

    try { if (electronApp) await electronApp.close(); } catch (_) {}

    ensureDir(SCREENSHOT_DIR);
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'report.json'),
      JSON.stringify(report, null, 2),
    );
    const md = [
      `# Sidebar Nesting Test Report (Cross-link Phase 2)`,
      ``,
      `- Suite: sidebar-nesting`,
      `- Passed: ${report.passed}`,
      `- Duration: ${report.duration}`,
      `- Error: ${report.error || '(none)'}`,
      ``,
      `## Assertions`,
      ...report.assertions.map(a => `- ${a.ok ? 'PASS' : 'FAIL'} ${a.name}${a.info ? ' — ' + JSON.stringify(a.info) : ''}`),
      ``,
      `## Steps`,
      ...report.steps.map(s => `- ${s}`),
      ``,
    ].join('\n');
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'report.md'), md);

    process.exit(report.passed ? 0 : 1);
  }
}

main();
