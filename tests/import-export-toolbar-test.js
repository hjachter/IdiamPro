/**
 * Import / Export Toolbar Buttons Verification Test
 *
 * Verifies the 2026-06-04 migration that promoted Import and Export from the
 * Wrench admin menu (and the AI Features menu, in the case of Research &
 * Import) into two dedicated top-level toolbar icon buttons.
 *
 * Coverage:
 *   A. Both Import (BookDown) and Export (BookUp) icon buttons render in the
 *      outline pane toolbar with the expected aria-labels.
 *   B. Hovering each button shows the correct one-word tooltip ("Import" /
 *      "Export").
 *   C. Clicking Import opens a dropdown containing the three migrated items:
 *      Research & Import, Import Outline, Restore All Outlines.
 *   D. Clicking Export opens a dropdown containing the three migrated items:
 *      Share Subtree as…, Export Current Outline, Backup All Outlines.
 *   E. The AI Features dropdown no longer contains "Research & Import".
 *   F. The Wrench (Admin) dropdown no longer contains the five migrated items
 *      (it should only contain Refresh User Guide after the cleanup).
 *
 * This test mounts the app, opens each menu, asserts on the presence /
 * absence of menu items, and takes screenshots at each step.  It deliberately
 * does NOT click any of the destructive actions (no Backup / Restore / Import
 * gets executed) — visibility-only assertions are sufficient to prove the
 * surface migrated.
 *
 * Screenshots → test-screenshots/import-export-toolbar/
 * Report     → test-screenshots/import-export-toolbar/report.{json,md}
 * Non-zero exit on hard failure.
 */

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

let electronApp;
let page;

const SCREENSHOT_DIR = path.resolve(
  __dirname,
  '..',
  'test-screenshots',
  'import-export-toolbar'
);

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
        /* not ready */
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
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
  await page.waitForTimeout(3000);

  const currentUrl = page.url();
  if (!currentUrl.includes('/app')) {
    console.log('Navigating to /app...');
    await page.evaluate(() => {
      window.location.href = '/app';
    });
    await page.waitForLoadState('domcontentloaded');
    try {
      await page
        .locator('button:has-text("New Outline")')
        .waitFor({ state: 'visible', timeout: 30000 });
    } catch (e) {
      await page.waitForTimeout(5000);
    }
  }

  const splashVisible = await page
    .locator('text=/Loading IdiamPro/i')
    .isVisible({ timeout: 1000 })
    .catch(() => false);
  if (splashVisible) {
    for (let i = 0; i < 30; i++) {
      const still = await page
        .locator('text=/Loading IdiamPro/i')
        .isVisible({ timeout: 500 })
        .catch(() => false);
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

async function closeAnyOpenMenu() {
  // Dismiss any radix dropdown by pressing Escape a few times.
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(200);
  }
}

/**
 * Open a dropdown by its toolbar trigger aria-label, then return the list of
 * visible menu item text contents.
 */
async function openMenuAndListItems(triggerSelector) {
  await closeAnyOpenMenu();
  const trigger = page.locator(triggerSelector).first();
  await trigger.waitFor({ state: 'visible', timeout: 5000 });
  await trigger.click();
  await page.waitForTimeout(500);
  // Radix renders menu items with role="menuitem"
  const items = await page.locator('[role="menuitem"]').allTextContents();
  return items.map((t) => t.trim()).filter(Boolean);
}

async function runTest() {
  const results = {
    startedAt: new Date().toISOString(),
    platform: getPlatformInfo(),
    steps: [],
    assertions: [],
    passed: false,
    durationMs: 0,
  };
  const t0 = Date.now();

  try {
    await launchApp();
    await shot('00-app-launched');

    // A. Both icon buttons render
    const importBtn = page.locator(
      'button[aria-label="Import — bring data into your outline"]'
    );
    const exportBtn = page.locator(
      'button[aria-label="Export — send your outline data out"]'
    );

    const importVisible = await importBtn
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    const exportVisible = await exportBtn
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    results.assertions.push({
      name: 'Import button renders in toolbar',
      passed: importVisible,
    });
    results.assertions.push({
      name: 'Export button renders in toolbar',
      passed: exportVisible,
    });

    if (!importVisible || !exportVisible) {
      results.error = 'Toolbar buttons missing';
      await shot('FAIL-buttons-missing');
      return results;
    }
    await shot('01-toolbar-buttons-visible');

    // B. Tooltip on hover (single-word per UI naming convention)
    await importBtn.first().hover();
    await page.waitForTimeout(700);
    const importTooltip = await page
      .locator('[role="tooltip"]:has-text("Import")')
      .first()
      .isVisible({ timeout: 1500 })
      .catch(() => false);
    results.assertions.push({
      name: 'Import tooltip renders on hover',
      passed: importTooltip,
    });
    await shot('02-import-tooltip');

    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);

    await exportBtn.first().hover();
    await page.waitForTimeout(700);
    const exportTooltip = await page
      .locator('[role="tooltip"]:has-text("Export")')
      .first()
      .isVisible({ timeout: 1500 })
      .catch(() => false);
    results.assertions.push({
      name: 'Export tooltip renders on hover',
      passed: exportTooltip,
    });
    await shot('03-export-tooltip');

    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);

    // C. Import dropdown contents
    const importItems = await openMenuAndListItems(
      'button[aria-label="Import — bring data into your outline"]'
    );
    await shot('04-import-menu-open');
    results.steps.push({ name: 'Import menu items', items: importItems });

    const importHasResearch = importItems.some((i) =>
      /Research\s*&\s*Import/i.test(i)
    );
    const importHasImportOutline = importItems.some((i) =>
      /Import Outline/i.test(i)
    );
    const importHasRestoreAll = importItems.some((i) =>
      /Restore All Outlines/i.test(i)
    );
    results.assertions.push({
      name: 'Import menu contains Research & Import',
      passed: importHasResearch,
    });
    results.assertions.push({
      name: 'Import menu contains Import Outline',
      passed: importHasImportOutline,
    });
    results.assertions.push({
      name: 'Import menu contains Restore All Outlines',
      passed: importHasRestoreAll,
    });

    await closeAnyOpenMenu();

    // D. Export dropdown contents
    const exportItems = await openMenuAndListItems(
      'button[aria-label="Export — send your outline data out"]'
    );
    await shot('05-export-menu-open');
    results.steps.push({ name: 'Export menu items', items: exportItems });

    const exportHasShareSubtree = exportItems.some((i) =>
      /Share Subtree/i.test(i)
    );
    const exportHasExportCurrent = exportItems.some((i) =>
      /Export Current Outline/i.test(i)
    );
    const exportHasBackupAll = exportItems.some((i) =>
      /Backup All Outlines/i.test(i)
    );
    results.assertions.push({
      name: 'Export menu contains Share Subtree as…',
      passed: exportHasShareSubtree,
    });
    results.assertions.push({
      name: 'Export menu contains Export Current Outline',
      passed: exportHasExportCurrent,
    });
    results.assertions.push({
      name: 'Export menu contains Backup All Outlines',
      passed: exportHasBackupAll,
    });

    await closeAnyOpenMenu();

    // E. AI Features menu no longer contains Research & Import
    const aiMenuTrigger = page.locator(
      'button[aria-label="AI features menu"]'
    );
    let aiItems = [];
    if (await aiMenuTrigger.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      aiItems = await openMenuAndListItems('button[aria-label="AI features menu"]');
      await shot('06-ai-menu-open');
      results.steps.push({ name: 'AI menu items', items: aiItems });
      const aiHasResearch = aiItems.some((i) => /Research\s*&\s*Import/i.test(i));
      results.assertions.push({
        name: 'AI menu does NOT contain Research & Import',
        passed: !aiHasResearch,
      });
    } else {
      // AI menu may be hidden when no AI features are enabled — still passes
      // the "Research & Import removed from AI menu" assertion vacuously.
      results.assertions.push({
        name: 'AI menu does NOT contain Research & Import (AI menu not rendered)',
        passed: true,
      });
    }
    await closeAnyOpenMenu();

    // F. Wrench (Admin) menu no longer contains migrated items
    const wrenchTrigger = page.locator('button[aria-label="Outline admin"]');
    if (await wrenchTrigger.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      const wrenchItems = await openMenuAndListItems(
        'button[aria-label="Outline admin"]'
      );
      await shot('07-wrench-menu-open');
      results.steps.push({ name: 'Wrench menu items', items: wrenchItems });

      const migrated = [
        'Import Outline',
        'Export Current Outline',
        'Backup All Outlines',
        'Restore All Outlines',
        'Research & Import',
      ];
      for (const label of migrated) {
        const stillThere = wrenchItems.some((i) =>
          new RegExp(label.replace(/&/g, '\\s*&\\s*'), 'i').test(i)
        );
        results.assertions.push({
          name: `Wrench menu does NOT contain "${label}"`,
          passed: !stillThere,
        });
      }
      const wrenchHasRefresh = wrenchItems.some((i) =>
        /Refresh User Guide/i.test(i)
      );
      results.assertions.push({
        name: 'Wrench menu still contains Refresh User Guide',
        passed: wrenchHasRefresh,
      });
    } else {
      results.assertions.push({
        name: 'Wrench (Admin) menu renders',
        passed: false,
      });
    }
    await closeAnyOpenMenu();

    results.passed = results.assertions.every((a) => a.passed);
  } catch (e) {
    results.error = String(e && e.stack ? e.stack : e);
    await shot('FAIL-exception');
  } finally {
    results.durationMs = Date.now() - t0;
    try {
      if (electronApp) await electronApp.close();
    } catch (e) {
      /* ignore close errors */
    }
  }
  return results;
}

function writeReports(results) {
  ensureDir(SCREENSHOT_DIR);
  const jsonPath = path.join(SCREENSHOT_DIR, 'report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

  const lines = [];
  lines.push('# Import / Export Toolbar — Test Report');
  lines.push('');
  lines.push(`- Started: ${results.startedAt}`);
  lines.push(`- Duration: ${fmt(results.durationMs)}`);
  lines.push(`- Platform: ${results.platform.platform} ${results.platform.arch} (${results.platform.osVersion})`);
  lines.push(`- Overall: ${results.passed ? 'PASS' : 'FAIL'}`);
  lines.push('');
  lines.push('## Assertions');
  for (const a of results.assertions) {
    lines.push(`- [${a.passed ? 'x' : ' '}] ${a.name}`);
  }
  if (results.steps.length) {
    lines.push('');
    lines.push('## Captured menu items');
    for (const s of results.steps) {
      lines.push(`- **${s.name}**: ${(s.items || []).join(' | ')}`);
    }
  }
  if (results.error) {
    lines.push('');
    lines.push('## Error');
    lines.push('```');
    lines.push(results.error);
    lines.push('```');
  }

  const mdPath = path.join(SCREENSHOT_DIR, 'report.md');
  fs.writeFileSync(mdPath, lines.join('\n'));
  return { jsonPath, mdPath };
}

(async () => {
  ensureDir(SCREENSHOT_DIR);
  const results = await runTest();
  const { jsonPath, mdPath } = writeReports(results);
  console.log('Report:', mdPath);
  console.log('JSON:', jsonPath);
  if (!results.passed) {
    console.error('IMPORT/EXPORT TOOLBAR TEST FAILED');
    process.exit(1);
  }
  console.log('IMPORT/EXPORT TOOLBAR TEST PASSED');
})();
