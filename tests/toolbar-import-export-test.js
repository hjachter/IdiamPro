// Toolbar Import/Export adjacency test.
// Verifies the top toolbar shows the Import (BookDown) and Export (BookUp)
// icon-buttons directly next to each other, in order Import then Export, with
// the Backup (ShieldCheck) button sitting after Export. Only positions were
// changed — handlers/tooltips/shortcuts are untouched.
//
// Follows the conventions in tests/electron-test.js: launch Electron via
// _electron.launch, skip DevTools windows, find the localhost:9002 window,
// navigate to /app, load an outline, screenshot the toolbar, assert ordering.

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

let electronApp;
let page;

async function findMainWindow(app, maxWait = 30000) {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    for (const win of app.windows()) {
      try {
        const url = win.url();
        if (url.startsWith('devtools://')) continue;
        if (url.includes('localhost:9002')) return win;
      } catch (e) { /* window not ready */ }
    }
    await new Promise((r) => setTimeout(r, 1000));
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

  // Wide viewport so the inline (lg) toolbar icons render.
  await page.setViewportSize({ width: 1440, height: 900 });

  if (!page.url().includes('/app')) {
    await page.evaluate(() => { window.location.href = '/app'; });
    await page.waitForLoadState('domcontentloaded');
    try {
      await page.locator('button:has-text("New Outline")').waitFor({ state: 'visible', timeout: 30000 });
    } catch (e) {
      await page.waitForTimeout(5000);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(500);
  return { electronApp, page };
}

async function closeApp() {
  if (!electronApp) return;
  await Promise.race([
    electronApp.close().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
}

async function run() {
  const report = { timestamp: new Date().toISOString(), steps: [], passed: false };
  const outDir = path.resolve(__dirname, '..', 'test-screenshots', 'toolbar-import-export');
  fs.mkdirSync(outDir, { recursive: true });

  try {
    await launchApp();
    report.steps.push('App launched');

    // Load an outline so the full toolbar is present.
    const userGuideButton = page.locator('button:has-text("User Guide")');
    if (await userGuideButton.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await userGuideButton.first().click();
      await page.waitForTimeout(2000);
      report.steps.push('Loaded User Guide outline');
    } else {
      const newOutline = page.locator('button:has-text("New Outline")');
      await newOutline.first().click();
      await page.waitForTimeout(2000);
      report.steps.push('Created new outline');
    }

    // Locate the three toolbar buttons by aria-label.
    const importBtn = page.locator('[aria-label^="Import"]').first();
    const exportBtn = page.locator('[aria-label^="Export"]').first();
    const backupBtn = page.locator('[aria-label^="Backup"]').first();

    const importVisible = await importBtn.isVisible({ timeout: 5000 }).catch(() => false);
    const exportVisible = await exportBtn.isVisible({ timeout: 5000 }).catch(() => false);
    const backupVisible = await backupBtn.isVisible({ timeout: 5000 }).catch(() => false);
    report.steps.push(`Import visible: ${importVisible}, Export visible: ${exportVisible}, Backup visible: ${backupVisible}`);

    if (!importVisible || !exportVisible) {
      throw new Error('Import and/or Export toolbar icon not visible at lg width');
    }

    // Assert horizontal ordering: Import left of Export, Export left of Backup.
    const importBox = await importBtn.boundingBox();
    const exportBox = await exportBtn.boundingBox();
    const backupBox = backupVisible ? await backupBtn.boundingBox() : null;
    report.geometry = { importBox, exportBox, backupBox };

    const importLeftOfExport = importBox.x < exportBox.x;
    const gap = exportBox.x - (importBox.x + importBox.width);
    const adjacent = gap >= -4 && gap < 40; // touching / small toolbar gap
    report.steps.push(`Import left of Export: ${importLeftOfExport}; horizontal gap: ${Math.round(gap)}px (adjacent: ${adjacent})`);

    let backupAfterExport = true;
    if (backupBox) {
      backupAfterExport = backupBox.x > exportBox.x;
      report.steps.push(`Backup after Export: ${backupAfterExport}`);
    }

    // Screenshot the toolbar region into the scratchpad path the caller asked for.
    const scratchPath = '/private/tmp/claude-501/-Users-howardjachter-Developer-IdiamPro/a8db6996-3bce-4aef-8646-4175b8f089c9/scratchpad/toolbar-import-export.png';
    const toolbarTop = Math.min(importBox.y, exportBox.y) - 12;
    const clip = {
      x: 0,
      y: Math.max(0, toolbarTop),
      width: Math.min(1440, (backupBox ? backupBox.x + backupBox.width : exportBox.x + exportBox.width) + 200),
      height: Math.max(importBox.height, exportBox.height) + 40,
    };
    await page.screenshot({ path: scratchPath, clip });
    fs.copyFileSync(scratchPath, path.join(outDir, 'toolbar-import-export.png'));
    // Also a full-window shot for context.
    await page.screenshot({ path: path.join(outDir, 'full-window.png') });
    report.steps.push(`Toolbar screenshot saved to ${scratchPath}`);

    report.passed = importLeftOfExport && adjacent && backupAfterExport;
  } catch (err) {
    report.error = err.message;
  } finally {
    await closeApp();
  }

  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  const md = [
    '# Toolbar Import/Export Adjacency Test',
    '',
    `**Generated:** ${new Date(report.timestamp).toLocaleString()}`,
    `**Result:** ${report.passed ? 'PASS' : 'FAIL'}`,
    '',
    '## Steps',
    ...report.steps.map((s) => `- ${s}`),
    report.error ? `\n**Error:** ${report.error}` : '',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'report.md'), md);

  console.log(report.passed ? 'PASS' : 'FAIL');
  report.steps.forEach((s) => console.log('  • ' + s));
  if (report.error) console.log('  Error: ' + report.error);
  return report;
}

run().then((r) => process.exit(r.passed ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
