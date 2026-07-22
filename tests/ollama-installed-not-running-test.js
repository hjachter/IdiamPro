/**
 * Ollama Installed-But-Not-Running UX Test
 *
 * Verifies that when /Applications/Ollama.app exists on disk but the
 * background Ollama service is NOT running, both the Settings dialog AND
 * the Research & Import dialog show "installed but not running" copy +
 * a "Start Ollama" button — NOT the misleading "Install Ollama" download
 * pitch.
 *
 * Assumptions on the test machine:
 *   • /Applications/Ollama.app is installed.
 *   • This script kills the Ollama service before launching Electron so
 *     the renderer sees `available=false`. If the user re-launches Ollama
 *     mid-test, the assertion for "not running" may fail.
 *
 * Screenshots → test-screenshots/ollama-installed-not-running/
 * Report      → test-screenshots/ollama-installed-not-running/report.{json,md}
 */

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const { prepareApp, openSettings, setElectronWindowSize } = require('./_helpers');

let electronApp;
let page;

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'ollama-installed-not-running');
const OLLAMA_APP_PATH = '/Applications/Ollama.app';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function fmt(ms) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function stopOllamaService() {
  try {
    execSync('pkill -f "ollama" 2>/dev/null || true', { stdio: 'ignore' });
  } catch {
    // pkill returns non-zero if nothing matched — that's fine.
  }
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
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Could not find main app window');
}

async function launchApp() {
  const projectRoot = path.resolve(__dirname, '..');
  console.log('Launching Electron from:', projectRoot);
  electronApp = await electron.launch({
    args: [projectRoot],
    env: { ...process.env, NODE_ENV: 'development' },
  });
  page = await findMainWindow(electronApp);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  // A wide window keeps the toolbar buttons ("Bring In", etc.) inline instead
  // of collapsing them into the "More tools" overflow menu — makes navigation
  // deterministic. The overflow path is still handled as a fallback below.
  await setElectronWindowSize(electronApp, 1500, 950);
  await page.waitForTimeout(300);

  if (!page.url().includes('/app')) {
    await page.evaluate(() => { window.location.href = '/app'; });
    await page.waitForLoadState('domcontentloaded');
    try {
      await page.locator('button:has-text("New Outline")').waitFor({ state: 'visible', timeout: 30000 });
    } catch {
      await page.waitForTimeout(5000);
    }
  }

  // Dismiss the first-run welcome showcase (it renders over the app and blocks
  // clicks) and wait for the real shell — shared with every other suite.
  await prepareApp(page);
  console.log('App ready at:', page.url());
}

async function shot(name) {
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  try {
    await page.screenshot({ path: file, fullPage: false });
    return file;
  } catch (e) {
    console.log(`  Screenshot failed: ${e.message}`);
    return null;
  }
}

async function closeAllDialogs() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const dialogCount = await page.locator('[role="dialog"]').count().catch(() => 0);
    if (dialogCount === 0) break;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(200);
}

// Open the Research & Import dialog reliably across viewport widths. Returns
// true once the item has been clicked. Mirrors the working pattern used by
// tests/import-secondbrain-sweep.js.
async function openResearchDialog() {
  await closeAllDialogs();

  // Inline path: the "Bring In" toolbar dropdown.
  const bringIn = page.locator('button[aria-label="Bring In"]').first();
  if (await bringIn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await bringIn.click().catch(() => {});
    await page.waitForTimeout(400);
    const item = page.locator('[role="menuitem"]:has-text("Research & Import")').first();
    if (await item.isVisible({ timeout: 1500 }).catch(() => false)) {
      await item.click().catch(() => {});
      return true;
    }
    // Close the dropdown before trying the overflow path.
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(200);
  }

  // Overflow path: "More tools" → "Bring In" submenu → "Research & Import".
  const more = page.locator('button[aria-label="More tools"]').first();
  if (await more.isVisible({ timeout: 1500 }).catch(() => false)) {
    await more.click().catch(() => {});
    await page.waitForTimeout(400);
    const sub = page.locator('[role="menuitem"]:has-text("Bring In")').first();
    if (await sub.isVisible({ timeout: 1500 }).catch(() => false)) {
      await sub.hover().catch(() => {});
      await page.waitForTimeout(400);
    }
    const item = page.locator('[role="menuitem"]:has-text("Research & Import")').first();
    if (await item.isVisible({ timeout: 1500 }).catch(() => false)) {
      await item.click().catch(() => {});
      return true;
    }
  }

  return false;
}

/* ─────────────────────────── Test 1: Settings ─────────────────────────── */
async function testSettingsDialog(ollamaInstalled) {
  const d = { steps: [] };
  try {
    // Open Settings via the shared, viewport-robust helper (drives the real
    // "More tools" overflow path, then falls back to the app's canonical
    // hidden [data-settings-trigger]). Replaces the old brittle force-click on
    // a button that is now hidden by the responsive toolbar.
    const opened = await openSettings(page);
    await page.waitForTimeout(1500); // let ollama probe finish
    if (!opened) {
      d.error = 'Could not open the Settings dialog';
      await shot('01-settings-cant-open');
      return { passed: false, details: d };
    }
    d.steps.push('Opened Settings dialog');

    // The Settings dialog is tabbed (2026-07); the Ollama / AI-provider status
    // lives under the "AI" category, not the default "General" tab. Navigate
    // there before reading the copy.
    const aiTab = page.locator('[data-testid="settings-nav-ai"]').first();
    if (await aiTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await aiTab.click().catch(() => {});
      await page.waitForTimeout(1500); // let the ollama probe finish on this tab
      d.steps.push('Switched to Settings → AI tab');
    } else {
      d.error = 'Could not find the AI tab in Settings';
      await shot('01-settings-no-ai-tab');
      return { passed: false, details: d };
    }
    await shot('01-settings-open');

    const dialogText = (await page.locator('[role="dialog"]').last().textContent().catch(() => '')) || '';
    d.dialogTextLength = dialogText.length;

    const hasInstalledNotRunning = /installed but not running|installed,\s*not running/i.test(dialogText);
    const hasStartOllamaButton = await page.locator('[role="dialog"] button:has-text("Start Ollama")').first().isVisible({ timeout: 1500 }).catch(() => false);
    const hasOldInstallPitch = /Install Ollama from/i.test(dialogText);

    if (ollamaInstalled) {
      // We expect the NEW copy and the Start button
      if (!hasInstalledNotRunning) {
        d.error = 'Expected "installed but not running" copy in Settings, but did not find it';
        await shot('01-settings-failed');
        return { passed: false, details: d };
      }
      d.steps.push('Settings shows "installed but not running" copy');
      if (!hasStartOllamaButton) {
        d.error = 'Expected "Start Ollama" button in Settings, but it was not visible';
        await shot('01-settings-no-start-btn');
        return { passed: false, details: d };
      }
      d.steps.push('Settings shows "Start Ollama" button');
      if (hasOldInstallPitch) {
        d.error = 'Settings still shows the misleading "Install Ollama from ollama.com" copy';
        return { passed: false, details: d };
      }
      d.steps.push('Settings no longer shows misleading "Install Ollama from ollama.com" pitch');
    } else {
      // Ollama not installed — should still show install pitch
      if (!hasOldInstallPitch) {
        d.error = 'Expected "Install Ollama from ollama.com" copy in Settings (Ollama not installed)';
        return { passed: false, details: d };
      }
      d.steps.push('Settings correctly shows install pitch when Ollama is not installed');
    }

    await closeAllDialogs();
    return { passed: true, details: d };
  } catch (e) {
    d.error = e.message;
    try { await closeAllDialogs(); } catch {}
    return { passed: false, details: d };
  }
}

/* ─────────────────────────── Test 2: Research & Import ─────────────────────────── */
async function testBulkResearchDialog(ollamaInstalled) {
  const d = { steps: [] };
  try {
    // "Research & Import" lives in the "Bring In" toolbar menu (the trigger
    // button is aria-label="Bring In", renamed 2026-07-21 from the old
    // "Import" label). On narrow widths it collapses into the "More tools"
    // overflow menu as a "Bring In" submenu. Try the inline menu first (the
    // wide window set at launch keeps it inline), then the overflow submenu.
    const opened = await openResearchDialog();
    if (!opened) {
      d.error = 'Research & Import menu item not found (tried Bring In menu + More tools overflow)';
      await shot('02-research-no-item');
      return { passed: false, details: d };
    }
    await page.waitForTimeout(1800); // let ollama probe finish
    d.steps.push('Opened Research & Import dialog');
    await shot('02-research-open');

    const dialogText = (await page.locator('[role="dialog"]').last().textContent().catch(() => '')) || '';
    d.dialogTextLength = dialogText.length;

    const hasInstalledNotRunning = /Ollama is installed but not running/i.test(dialogText);
    const hasStartOllamaButton = await page.locator('[role="dialog"] button:has-text("Start Ollama")').first().isVisible({ timeout: 1500 }).catch(() => false);
    const hasOldNotDetected = /Ollama not detected on your Mac/i.test(dialogText);

    if (ollamaInstalled) {
      if (!hasInstalledNotRunning) {
        d.error = 'Expected "Ollama is installed but not running" copy in Research dialog';
        await shot('02-research-failed');
        return { passed: false, details: d };
      }
      d.steps.push('Research dialog shows "Ollama is installed but not running" copy');
      if (!hasStartOllamaButton) {
        d.error = 'Expected "Start Ollama" button in Research dialog';
        return { passed: false, details: d };
      }
      d.steps.push('Research dialog shows "Start Ollama" button');
      if (hasOldNotDetected) {
        d.error = 'Research dialog still shows misleading "Ollama not detected on your Mac" copy';
        return { passed: false, details: d };
      }
      d.steps.push('Research dialog no longer shows misleading "Ollama not detected" copy');
    } else {
      if (!hasOldNotDetected) {
        d.error = 'Expected "Ollama not detected on your Mac" copy in Research dialog (Ollama not installed)';
        return { passed: false, details: d };
      }
      d.steps.push('Research dialog correctly shows "not detected" copy when Ollama is not installed');
    }

    await closeAllDialogs();
    return { passed: true, details: d };
  } catch (e) {
    d.error = e.message;
    try { await closeAllDialogs(); } catch {}
    return { passed: false, details: d };
  }
}

/* ─────────────────────────── Runner ─────────────────────────── */
async function runAll() {
  ensureDir(SCREENSHOT_DIR);
  const report = {
    timestamp: new Date().toISOString(),
    platform: {
      platform: os.platform(),
      arch: os.arch(),
    },
    tests: [],
    summary: { total: 0, passed: 0, failed: 0 },
  };

  const ollamaInstalled = fs.existsSync(OLLAMA_APP_PATH);
  report.ollamaInstalled = ollamaInstalled;
  console.log(`\n${OLLAMA_APP_PATH} present? ${ollamaInstalled ? 'YES' : 'NO'}`);

  // Stop any running Ollama service so the dialog sees "unavailable".
  console.log('Stopping any running Ollama service...');
  stopOllamaService();
  await new Promise(r => setTimeout(r, 500));

  const overall = Date.now();
  console.log('\n═══ Ollama Installed-But-Not-Running UX Test ═══\n');

  try {
    await launchApp();
    await shot('00-app-launched');

    const cases = [
      { name: 'Settings dialog — installed-not-running copy', fn: () => testSettingsDialog(ollamaInstalled) },
      { name: 'Research & Import dialog — installed-not-running copy', fn: () => testBulkResearchDialog(ollamaInstalled) },
    ];

    for (const c of cases) {
      console.log(`\n─── ${c.name} ───`);
      const t0 = Date.now();
      const r = await c.fn();
      const dur = Date.now() - t0;
      const status = r.passed ? '✓ PASS' : '✗ FAIL';
      console.log(`${status} (${fmt(dur)})`);
      if (r.details.steps) r.details.steps.forEach(s => console.log(`  • ${s}`));
      if (r.details.error) console.log(`  error: ${r.details.error}`);
      report.tests.push({ name: c.name, passed: r.passed, duration: dur, ...r.details });
    }
  } catch (e) {
    console.error('Test run aborted:', e.message);
    report.error = e.message;
  } finally {
    if (electronApp) await Promise.race([
      electronApp.close().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
  }

  report.summary.total = report.tests.length;
  report.summary.passed = report.tests.filter(t => t.passed).length;
  report.summary.failed = report.tests.filter(t => !t.passed).length;
  report.summary.duration = Date.now() - overall;

  console.log('\n═══ RESULTS ═══');
  for (const t of report.tests) {
    const s = t.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`  ${s}  ${t.name}  (${fmt(t.duration)})`);
  }
  console.log(`\nTotal: ${report.summary.passed}/${report.summary.total} passed in ${fmt(report.summary.duration)}\n`);

  fs.writeFileSync(path.join(SCREENSHOT_DIR, 'report.json'), JSON.stringify(report, null, 2));

  // Markdown report
  const md = [
    `# Ollama Installed-But-Not-Running UX Test`,
    ``,
    `**Run:** ${report.timestamp}`,
    `**Platform:** ${report.platform.platform} ${report.platform.arch}`,
    `**Ollama.app installed:** ${report.ollamaInstalled ? 'yes' : 'no'}`,
    ``,
    `## Summary`,
    ``,
    `- Total: ${report.summary.total}`,
    `- Passed: ${report.summary.passed}`,
    `- Failed: ${report.summary.failed}`,
    `- Duration: ${fmt(report.summary.duration)}`,
    ``,
    `## Tests`,
    ...report.tests.flatMap(t => [
      ``,
      `### ${t.passed ? '✓' : '✗'} ${t.name}`,
      ``,
      ...(t.steps || []).map(s => `- ${s}`),
      ...(t.error ? [``, `**Error:** ${t.error}`] : []),
    ]),
  ].join('\n');
  fs.writeFileSync(path.join(SCREENSHOT_DIR, 'report.md'), md);

  process.exit(report.summary.failed === 0 ? 0 : 1);
}

runAll().catch(e => { console.error(e); process.exit(1); });
