/**
 * LIVE BOOKS Automated Test
 *
 * Proves the LIVE BOOKS feature (commit fe67c34) works at runtime:
 * a manual AI "refresh" of a selected node + its descendants, opened via
 * the toolbar AI menu, the Command Palette, or Cmd/Ctrl+Shift+R, showing a
 * preview/diff with per-node accept/reject before applying.
 *
 * This test reuses the PROVEN electron-test.js launch + splash-wait +
 * main-window-selection pattern (a prior bespoke probe stalled on the
 * "Loading IdiamPro..." splash because it did NOT reuse this pattern).
 *
 * Asserted for real (no network / AI key needed):
 *   1. App launches and gets fully past the splash.
 *   2. A normal (non-Guide) multi-node outline can be created.
 *   3. A node is selected.
 *   4. The LIVE BOOKS refresh dialog opens (tries Cmd+Shift+R, the AI menu,
 *      and the Command Palette — whichever the proven pattern can drive).
 *   5. The dialog renders (title "LIVE BOOKS — Refresh from the web").
 *   6. The scope text reflects the selected node + its descendants.
 *   7. The preview/approve UI is present: merge-vs-overwrite radio, the
 *      "Apply automatically" opt-in defaulting OFF, and the
 *      Refresh & preview action.
 *
 * Driving a full real AI refresh is OPTIONAL and is SKIPPED here (it needs
 * network / a Gemini key or a local model and 30s+). The test reports this
 * honestly rather than passing vacuously.
 *
 * Screenshots + report.json + report.md → test-screenshots/livebooks/
 * Non-zero exit on failure.
 */

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

let electronApp;
let page;

const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'livebooks');

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
  console.log('Launching Electron app from:', projectRoot);

  electronApp = await electron.launch({
    args: [projectRoot],
    env: { ...process.env, NODE_ENV: 'development' },
  });

  console.log('Waiting for main window...');
  page = await findMainWindow(electronApp);
  console.log('Found main window:', page.url());

  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000); // give the app time to initialize

  // Electron loads the marketing page by default — navigate to /app.
  const currentUrl = page.url();
  if (!currentUrl.includes('/app')) {
    console.log('Navigating to /app...');
    await page.evaluate(() => { window.location.href = '/app'; });
    await page.waitForLoadState('domcontentloaded');

    // CRUCIAL splash wait: the app shows "Loading IdiamPro..." until the
    // sidebar is interactive. Wait for the New Outline button — exactly the
    // proven electron-test.js signal that we are past the splash.
    console.log('Waiting for app to fully load (past splash)...');
    try {
      await page.locator('button:has-text("New Outline")')
        .waitFor({ state: 'visible', timeout: 30000 });
      console.log('App loaded — New Outline button visible (past splash)');
    } catch (e) {
      console.log('Timeout waiting for New Outline button, continuing anyway...');
      await page.waitForTimeout(5000);
    }
  }

  // Double-check the splash text is gone before we interact.
  const splashGone = await page.locator('text=/Loading IdiamPro/i')
    .isVisible({ timeout: 1000 }).catch(() => false);
  if (splashGone) {
    console.log('Splash still visible — waiting longer...');
    for (let i = 0; i < 30; i++) {
      const still = await page.locator('text=/Loading IdiamPro/i')
        .isVisible({ timeout: 500 }).catch(() => false);
      if (!still) break;
      await page.waitForTimeout(1000);
    }
  }

  console.log('App launched successfully, now at:', page.url());
}

async function shot(name) {
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  try {
    await page.screenshot({ path: file, fullPage: false });
    return file;
  } catch (e) {
    console.log(`  Screenshot failed (${name}): ${e.message}`);
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

/* ───────── Build a normal multi-node outline + select a node ───────── */
// Returns { passed, details, parentNodeName }

async function buildOutlineAndSelectNode() {
  const d = { steps: [] };
  try {
    await ensureNoDialogs();

    // Create a fresh, normal (non-Guide) outline.
    const newOutlineBtn = page.locator('button:has-text("New Outline")').first();
    await newOutlineBtn.waitFor({ state: 'visible', timeout: 10000 });
    await newOutlineBtn.click();
    await page.waitForTimeout(2000);
    d.steps.push('Created new outline (non-Guide)');
    await shot('01-new-outline');

    // Select the root node IN THE TREE (a [role="treeitem"], NOT the content
    // pane H1 — clicking the H1 does not set the outline selection that the
    // LIVE BOOKS gate checks).
    const rootTreeItem = page
      .locator('[role="treeitem"]:has-text("Untitled Outline")')
      .first();
    if (!(await rootTreeItem.isVisible({ timeout: 5000 }).catch(() => false))) {
      d.error = 'Could not find the new outline root tree item ("Untitled Outline")';
      const items = await page.locator('[role="treeitem"]').allTextContents().catch(() => []);
      d.diagnosticTreeItems = items.slice(0, 8);
      return { passed: false, details: d };
    }
    // Click the node label text inside the tree item.
    await rootTreeItem.locator('text=Untitled Outline').first().click();
    await page.waitForTimeout(500);
    d.steps.push('Selected root node in tree ("Untitled Outline")');

    // Add two child nodes under the root so the refresh scope is
    // "selected node + descendants" and is non-trivial.
    // Enter creates a sibling/child; with the root selected the app adds a
    // child, auto-enters edit mode. Type a name, Enter to commit, repeat.
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    let edit = page.locator('input[type="text"]:visible, textarea:visible').first();
    if (await edit.isVisible({ timeout: 2000 }).catch(() => false)) {
      await edit.fill('Background');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(600);
      d.steps.push('Added child node "Background"');
    } else {
      d.steps.push('Edit field for first child did not appear (continuing)');
    }

    // A second node — pressing Enter again from the just-created node makes a sibling.
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    edit = page.locator('input[type="text"]:visible, textarea:visible').first();
    if (await edit.isVisible({ timeout: 2000 }).catch(() => false)) {
      await edit.fill('Current Status');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(600);
      d.steps.push('Added node "Current Status"');
    } else {
      d.steps.push('Edit field for second node did not appear (continuing)');
    }

    // Press Escape to ensure we're out of any edit mode.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // Select the ROOT again in the tree as the refresh target (root +
    // descendants = the whole outline; the dialog text says so explicitly).
    const rootAgain = page
      .locator('[role="treeitem"]:has-text("Untitled Outline")')
      .first();
    if (await rootAgain.isVisible({ timeout: 3000 }).catch(() => false)) {
      await rootAgain.locator('text=Untitled Outline').first().click();
      await page.waitForTimeout(500);
      d.steps.push('Re-selected root node in tree as the refresh target');
    }

    // Verify the selection actually took (aria-selected="true"). The LIVE
    // BOOKS gate depends on a real selected node.
    const selectedCount = await page
      .locator('[role="treeitem"][aria-selected="true"]')
      .count()
      .catch(() => 0);
    d.steps.push(`Tree items with aria-selected=true: ${selectedCount}`);
    d.selectedCount = selectedCount;
    if (selectedCount === 0) {
      d.error = 'No tree item is selected after clicking — LIVE BOOKS gate will not open';
      return { passed: false, details: d };
    }

    const treeItems = await page.locator('[role="treeitem"]').count().catch(() => 0);
    d.steps.push(`Outline tree shows ${treeItems} tree item(s)`);
    d.treeItemCount = treeItems;

    await shot('02-outline-built');
    return { passed: true, details: d, rootSelected: true };
  } catch (e) {
    d.error = e.message;
    return { passed: false, details: d };
  }
}

/* ───────── Open the LIVE BOOKS dialog (3 entry points, in order) ───────── */

async function openLiveBooksDialog() {
  const d = { steps: [], entryPointTried: [] };

  const dialogTitle = () =>
    page.locator('text=/LIVE BOOKS .* Refresh from the web/i').first();

  async function dialogVisible() {
    return dialogTitle().isVisible({ timeout: 2500 }).catch(() => false);
  }

  // Entry point 1: Cmd+Shift+R keyboard shortcut.
  try {
    d.entryPointTried.push('Cmd+Shift+R');
    await page.keyboard.press('Meta+Shift+R');
    await page.waitForTimeout(1200);
    if (await dialogVisible()) {
      d.steps.push('Opened via Cmd+Shift+R');
      d.openedVia = 'Cmd+Shift+R';
      await shot('03-dialog-via-shortcut');
      return { passed: true, details: d };
    }
    // Try the Ctrl variant too (cross-platform).
    await page.keyboard.press('Control+Shift+R');
    await page.waitForTimeout(1200);
    if (await dialogVisible()) {
      d.steps.push('Opened via Ctrl+Shift+R');
      d.openedVia = 'Ctrl+Shift+R';
      await shot('03-dialog-via-shortcut');
      return { passed: true, details: d };
    }
  } catch (e) {
    d.steps.push(`Shortcut attempt error: ${e.message}`);
  }

  // Entry point 2: toolbar AI Features menu → "LIVE BOOKS: Refresh from the web".
  try {
    d.entryPointTried.push('AI Features menu');
    const aiBtn = page.locator('button[title="AI Features"]').first();
    if (await aiBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await aiBtn.click();
      await page.waitForTimeout(700);
      await shot('03-ai-menu-open');
      const item = page.locator('text=/LIVE BOOKS: *Refresh from the web/i').first();
      if (await item.isVisible({ timeout: 2000 }).catch(() => false)) {
        await item.click();
        await page.waitForTimeout(1200);
        if (await dialogVisible()) {
          d.steps.push('Opened via AI Features menu');
          d.openedVia = 'AI Features menu';
          await shot('03-dialog-via-menu');
          return { passed: true, details: d };
        }
      } else {
        d.steps.push('LIVE BOOKS item not found in AI Features menu');
        await page.keyboard.press('Escape');
      }
    } else {
      d.steps.push('AI Features toolbar button not visible');
    }
  } catch (e) {
    d.steps.push(`AI menu attempt error: ${e.message}`);
  }

  // Entry point 3: Command Palette (Cmd+K) → "LIVE BOOKS: Refresh from the web".
  try {
    d.entryPointTried.push('Command Palette');
    await page.keyboard.press('Meta+K');
    await page.waitForTimeout(900);
    let palette = page.locator('[role="dialog"] input, [cmdk-input]').first();
    if (!(await palette.isVisible({ timeout: 2000 }).catch(() => false))) {
      await page.keyboard.press('Control+K');
      await page.waitForTimeout(900);
      palette = page.locator('[role="dialog"] input, [cmdk-input]').first();
    }
    if (await palette.isVisible({ timeout: 2000 }).catch(() => false)) {
      await palette.fill('LIVE BOOKS');
      await page.waitForTimeout(700);
      await shot('03-command-palette');
      const cmdItem = page.locator('text=/LIVE BOOKS: *Refresh from the web/i').first();
      if (await cmdItem.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cmdItem.click();
        await page.waitForTimeout(1200);
        if (await dialogVisible()) {
          d.steps.push('Opened via Command Palette');
          d.openedVia = 'Command Palette';
          await shot('03-dialog-via-palette');
          return { passed: true, details: d };
        }
      } else {
        d.steps.push('LIVE BOOKS entry not found in Command Palette');
        await page.keyboard.press('Escape');
      }
    } else {
      d.steps.push('Command Palette did not open');
    }
  } catch (e) {
    d.steps.push(`Command Palette attempt error: ${e.message}`);
  }

  d.error = `LIVE BOOKS dialog did not open via any entry point (tried: ${d.entryPointTried.join(', ')})`;
  await shot('03-dialog-FAILED');
  return { passed: false, details: d };
}

/* ───────── Assert dialog content: scope + preview/approve config UI ───────── */

async function assertDialogContent() {
  const d = { steps: [], checks: {} };
  try {
    const dialog = page.locator('[role="dialog"]').last();
    const text = (await dialog.textContent().catch(() => '')) || '';
    d.dialogTextLength = text.length;

    // Check 1: dialog title renders.
    const titleOk = /LIVE BOOKS\s*—?\s*Refresh from the web/i.test(text);
    d.checks.dialogRenders = titleOk;
    d.steps.push(titleOk ? 'Dialog title renders' : 'Dialog title MISSING');

    // Check 2: scope reflects the selected node + descendants.
    // Root selected → "Refreshes the entire outline...". Either the
    // entire-outline phrasing OR the "...and all of its descendants" phrasing
    // proves the scope is the selected node's subtree.
    const scopeOk =
      /Refreshes the entire outline/i.test(text) ||
      /and all of its descendants/i.test(text);
    d.checks.scopeReflectsSelection = scopeOk;
    d.steps.push(
      scopeOk
        ? 'Scope text reflects selected node + descendants'
        : 'Scope text NOT found (expected "entire outline" or "all of its descendants")'
    );

    // Check 3: merge-vs-overwrite option present.
    const mergeOpt = await page.locator('#lb-merge').count().catch(() => 0);
    const overwriteOpt = await page.locator('#lb-overwrite').count().catch(() => 0);
    const mergeText = /Merge\s*&?\s*augment/i.test(text);
    const overwriteText = /Overwrite \/ regenerate from scratch/i.test(text);
    const mergeVsOverwrite =
      (mergeOpt > 0 && overwriteOpt > 0) || (mergeText && overwriteText);
    d.checks.mergeVsOverwrite = mergeVsOverwrite;
    d.steps.push(
      mergeVsOverwrite
        ? 'Merge-vs-overwrite option present'
        : 'Merge-vs-overwrite option MISSING'
    );

    // Check 4: the "Apply automatically without previewing" opt-in is present
    // AND defaults to OFF (unchecked). This is the mandatory-preview safety gate.
    const autoApplyText = /Apply automatically without previewing/i.test(text);
    let autoApplyOff = null;
    const autoBox = page.locator('#lb-autoapply').first();
    if (await autoBox.count().catch(() => 0)) {
      // Radix Checkbox uses aria-checked / data-state.
      const ariaChecked = await autoBox.getAttribute('aria-checked').catch(() => null);
      const dataState = await autoBox.getAttribute('data-state').catch(() => null);
      autoApplyOff = ariaChecked === 'false' || dataState === 'unchecked';
    }
    d.checks.autoApplyPresent = autoApplyText;
    d.checks.autoApplyDefaultsOff = autoApplyOff === true;
    d.steps.push(
      autoApplyText
        ? `Auto-apply opt-in present; defaults OFF: ${autoApplyOff === true ? 'YES' : (autoApplyOff === false ? 'NO (DEFECT)' : 'could not read state')}`
        : 'Auto-apply opt-in MISSING'
    );

    // Check 5: the preview/approve workflow is wired — the primary action
    // reads "Refresh & preview" when auto-apply is OFF (proves per-node
    // preview/approve is the default path; the per-node Accept/Reject buttons
    // only render after a real refresh, which we intentionally skip).
    const previewBtn = page.locator('button:has-text("Refresh & preview")').first();
    const previewBtnVisible = await previewBtn.isVisible({ timeout: 2000 }).catch(() => false);
    d.checks.previewIsDefaultPath = previewBtnVisible;
    d.steps.push(
      previewBtnVisible
        ? 'Primary action is "Refresh & preview" (per-node approve is the default path)'
        : '"Refresh & preview" action button NOT found'
    );

    // Note: the per-node Accept/Reject diff cards only exist AFTER a real AI
    // refresh runs. That requires network/keys and 30s+, so it is SKIPPED.
    d.note =
      'A real AI refresh was NOT driven (needs network/Gemini key or a local model, 30s+). ' +
      'The per-node Accept/Reject diff cards render only after a real refresh and were therefore not exercised. ' +
      'The configure-phase preview/approve safety UI (mandatory-preview default, merge/overwrite, auto-apply-off) WAS asserted for real.';

    await shot('04-dialog-asserted');

    const allCriticalPass =
      d.checks.dialogRenders &&
      d.checks.scopeReflectsSelection &&
      d.checks.mergeVsOverwrite &&
      d.checks.autoApplyPresent &&
      d.checks.autoApplyDefaultsOff &&
      d.checks.previewIsDefaultPath;

    if (!allCriticalPass) {
      d.error = 'One or more critical LIVE BOOKS UI assertions failed (see checks).';
      d.dialogTextSample = text.slice(0, 600);
    }
    return { passed: allCriticalPass, details: d };
  } catch (e) {
    d.error = e.message;
    return { passed: false, details: d };
  }
}

/* ───────── Runner ───────── */

async function runAll() {
  ensureDir(SCREENSHOT_DIR);
  const report = {
    timestamp: new Date().toISOString(),
    feature: 'LIVE BOOKS (manual AI refresh of node subtree, commit fe67c34)',
    platform: getPlatformInfo(),
    tests: [],
    summary: { total: 0, passed: 0, failed: 0 },
  };

  const overall = Date.now();
  console.log('\n═══ LIVE BOOKS Automated Test ═══\n');
  console.log(`Platform: ${report.platform.platform} ${report.platform.arch}`);
  console.log(`Node: ${report.platform.nodeVersion}\n`);

  try {
    const launchStart = Date.now();
    await launchApp();
    report.launchDuration = Date.now() - launchStart;
    console.log(`Launch + splash-wait: ${fmt(report.launchDuration)}\n`);
    await shot('00-app-launched');

    // Step 1: build a normal outline + select a node.
    console.log('─── Build outline & select node ───');
    let t0 = Date.now();
    const build = await buildOutlineAndSelectNode();
    report.tests.push({
      name: 'Build non-Guide outline & select node',
      passed: build.passed,
      duration: Date.now() - t0,
      ...build.details,
    });
    console.log(build.passed ? '✓ PASS' : '✗ FAIL');
    (build.details.steps || []).forEach(s => console.log(`  • ${s}`));
    if (build.details.error) console.log(`  error: ${build.details.error}`);

    let openRes = { passed: false, details: { steps: [], error: 'skipped — outline build failed' } };
    let assertRes = { passed: false, details: { steps: [], error: 'skipped — dialog never opened' } };

    if (build.passed) {
      // Step 2: open the LIVE BOOKS dialog.
      console.log('\n─── Open LIVE BOOKS dialog ───');
      t0 = Date.now();
      openRes = await openLiveBooksDialog();
      report.tests.push({
        name: 'Open LIVE BOOKS dialog',
        passed: openRes.passed,
        duration: Date.now() - t0,
        ...openRes.details,
      });
      console.log(openRes.passed ? '✓ PASS' : '✗ FAIL');
      (openRes.details.steps || []).forEach(s => console.log(`  • ${s}`));
      if (openRes.details.error) console.log(`  error: ${openRes.details.error}`);

      if (openRes.passed) {
        // Step 3: assert dialog content (scope + preview/approve config UI).
        console.log('\n─── Assert dialog scope + preview/approve UI ───');
        t0 = Date.now();
        assertRes = await assertDialogContent();
        report.tests.push({
          name: 'Assert scope + preview/approve UI',
          passed: assertRes.passed,
          duration: Date.now() - t0,
          ...assertRes.details,
        });
        console.log(assertRes.passed ? '✓ PASS' : '✗ FAIL');
        (assertRes.details.steps || []).forEach(s => console.log(`  • ${s}`));
        if (assertRes.details.note) console.log(`  note: ${assertRes.details.note}`);
        if (assertRes.details.error) console.log(`  error: ${assertRes.details.error}`);
      } else {
        report.tests.push({
          name: 'Assert scope + preview/approve UI',
          passed: false,
          duration: 0,
          ...assertRes.details,
        });
      }
    } else {
      report.tests.push({
        name: 'Open LIVE BOOKS dialog',
        passed: false,
        duration: 0,
        ...openRes.details,
      });
      report.tests.push({
        name: 'Assert scope + preview/approve UI',
        passed: false,
        duration: 0,
        ...assertRes.details,
      });
    }
  } catch (e) {
    console.error('Test run aborted:', e.message);
    report.error = e.message;
  } finally {
    if (electronApp) await electronApp.close().catch(() => {});
  }

  report.summary.total = report.tests.length;
  report.summary.passed = report.tests.filter(t => t.passed).length;
  report.summary.failed = report.tests.filter(t => !t.passed).length;
  report.summary.duration = Date.now() - overall;

  console.log('\n═══ RESULTS ═══');
  for (const t of report.tests) {
    console.log(`  ${t.passed ? '✓ PASS' : '✗ FAIL'}  ${t.name}  (${fmt(t.duration)})`);
  }
  console.log(`\nTotal: ${report.summary.passed}/${report.summary.total} passed in ${fmt(report.summary.duration)}\n`);

  fs.writeFileSync(
    path.join(SCREENSHOT_DIR, 'report.json'),
    JSON.stringify(report, null, 2)
  );

  const md = [
    '# LIVE BOOKS Automated Test Report',
    '',
    `**Generated:** ${new Date(report.timestamp).toLocaleString()}`,
    `**Feature:** ${report.feature}`,
    '',
    '## Summary',
    '',
    `- Passed: **${report.summary.passed}** / ${report.summary.total}`,
    `- Failed: **${report.summary.failed}**`,
    `- Duration: ${fmt(report.summary.duration)}`,
    `- Launch + splash-wait: ${report.launchDuration ? fmt(report.launchDuration) : 'n/a'}`,
    '',
    '## Tests',
    '',
    '| Test | Status | Duration |',
    '|---|---|---|',
    ...report.tests.map(t => `| ${t.name} | ${t.passed ? '✅ PASS' : '❌ FAIL'} | ${fmt(t.duration)} |`),
    '',
    '## Details',
    '',
    ...report.tests.flatMap(t => [
      `### ${t.name}`,
      '',
      ...(t.steps || []).map(s => `- ${s}`),
      ...(t.checks ? ['', '**Assertion checks:**', ...Object.entries(t.checks).map(([k, v]) => `- ${k}: ${v ? '✅' : '❌'}`)] : []),
      ...(t.note ? ['', `_note:_ ${t.note}`] : []),
      ...(t.error ? ['', `**error:** ${t.error}`] : []),
      '',
    ]),
  ].join('\n');
  fs.writeFileSync(path.join(SCREENSHOT_DIR, 'report.md'), md);

  console.log(`Reports: ${SCREENSHOT_DIR}/report.{json,md}`);
  console.log(`Screenshots: ${SCREENSHOT_DIR}/\n`);

  process.exit(report.summary.failed > 0 ? 1 : 0);
}

runAll();
