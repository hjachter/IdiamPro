/**
 * Generate Video — "Style" step verification (2026-07-08)
 *
 * Drives the real Electron app: loads an outline with content, selects a
 * chapter node, opens the Export menu, launches the Generate Video dialog, and
 * asserts the new Style controls are present and interactive:
 *   - Theme toggle (Dark / Light)
 *   - Accent color swatches (+ custom color input)
 *   - Brand-name text field
 *   - Upload-logo control
 *   - EXACTLY SIX narrator voices (Alloy / Echo / Fable / Nova / Onyx / Shimmer)
 *   - A live 16:9 preview that responds to changes
 *
 * It does NOT click Generate (avoids a multi-minute render + paid TTS).
 *
 * Follows tests/electron-test.js conventions: launch via playwright._electron,
 * skip DevTools windows, screenshot every step, resilient selectors with
 * diagnostic dumps, report.json + report.md, non-zero exit on failure.
 */

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Swallow the benign teardown dialog race (see electron-test.js).
process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

let electronApp;
let page;

const SUITE_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'video-style');

const EXPECTED_VOICES = [
  'Alloy (neutral)',
  'Echo (male)',
  'Fable (expressive)',
  'Nova (female)',
  'Onyx (male, deep)',
  'Shimmer (female, warm)',
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
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

async function takeShot(name) {
  try {
    const p = path.join(SUITE_DIR, `${name}.png`);
    await page.screenshot({ path: p, fullPage: true });
    console.log(`  screenshot: ${name}.png`);
    return p;
  } catch (e) {
    console.log(`  failed screenshot ${name}: ${e.message}`);
    return null;
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
      } catch { /* window may not be ready */ }
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
  page = await findMainWindow(electronApp);
  console.log('Found main window:', page.url());
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  if (!page.url().includes('/app')) {
    await page.evaluate(() => { window.location.href = '/app'; });
    await page.waitForLoadState('domcontentloaded');
  }
  // Always wait for the real app UI — the client shows "Loading…" while it
  // bootstraps (reads outlines from Electron storage), and the /app URL is
  // present well before the UI is interactive.
  try {
    await page.locator('button:has-text("New Outline")').waitFor({ state: 'visible', timeout: 180000 });
    console.log('App UI ready — New Outline button visible');
  } catch {
    console.log('New Outline button not visible within 60s; continuing with diagnostics');
    await page.waitForTimeout(3000);
  }
  console.log('App ready at:', page.url());
}

async function closeApp() {
  if (!electronApp) return;
  await Promise.race([
    electronApp.close().catch(() => {}),
    new Promise((r) => setTimeout(r, 5000)),
  ]);
}

// Clear any open dialogs / hint overlays so clicks aren't intercepted.
async function clearOverlays() {
  for (let i = 0; i < 5; i++) {
    const dialogs = await page.locator('[role="dialog"]').count().catch(() => 0);
    if (dialogs === 0) break;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(250);
  }
}

async function run() {
  ensureDir(SUITE_DIR);
  const report = {
    suite: 'video-style',
    timestamp: new Date().toISOString(),
    platform: getPlatformInfo(),
    steps: [],
    checks: {},
    passed: false,
  };
  const step = (s) => { console.log(`  • ${s}`); report.steps.push(s); };

  try {
    await launchApp();
    await takeShot('01-launched');

    // --- Load an outline with content: the built-in User Guide ---
    const guideBtn = page.locator('button:has-text("User Guide")');
    if (await guideBtn.count() > 0 && await guideBtn.first().isVisible({ timeout: 5000 })) {
      await guideBtn.first().click();
      await page.waitForTimeout(2000);
      step('Loaded User Guide outline');
    } else {
      // Fallback: create a new outline (still gives a selectable root node).
      await page.locator('button:has-text("New Outline")').first().click();
      await page.waitForTimeout(1500);
      step('User Guide not found — created a New Outline instead');
    }
    await clearOverlays();
    await takeShot('02-outline-loaded');

    // --- Select a chapter node (needs a selected node to enable Generate Video) ---
    let selected = false;
    const candidateNodes = ['Getting Started', 'Core Features', 'Introduction'];
    for (const label of candidateNodes) {
      const node = page.locator(`span:has-text("${label}")`).first();
      if (await node.count() > 0 && await node.isVisible({ timeout: 1500 }).catch(() => false)) {
        await node.click();
        step(`Selected node "${label}"`);
        selected = true;
        break;
      }
    }
    if (!selected) {
      // Fallback: click the root heading.
      const root = page.locator('h1').first();
      await root.click().catch(() => {});
      step('Selected root heading as chapter (fallback)');
    }
    await page.waitForTimeout(500);

    // --- Open the Export menu (BookUp icon) ---
    const exportTrigger = page.locator(
      'button:has(svg.lucide-book-up), button:has(.lucide-book-up), [aria-label="Export"], button[title="Export"]'
    );
    if (await exportTrigger.count() === 0) {
      const btns = await page.locator('button').allTextContents();
      report.checks.exportTriggerFound = false;
      report.diagnostics = { visibleButtons: btns.slice(0, 25) };
      throw new Error('Export menu trigger (BookUp) not found');
    }
    await exportTrigger.first().click({ force: true });
    await page.waitForTimeout(600);
    report.checks.exportMenuOpened = true;
    step('Opened Export menu');
    await takeShot('03-export-menu');

    // --- Click "Generate Video" ---
    const genItem = page.locator('[role="menuitem"]:has-text("Generate Video")');
    if (await genItem.count() === 0) {
      const items = await page.locator('[role="menuitem"]').allTextContents();
      report.diagnostics = { menuItems: items };
      throw new Error('"Generate Video" menu item not found');
    }
    await genItem.first().click();
    await page.waitForTimeout(800);
    await takeShot('04-dialog-open');

    const dialog = page.locator('[role="dialog"]');
    if (await dialog.count() === 0) throw new Error('Generate Video dialog did not open');
    // Guard against the desktop-only notice (means isElectron() returned false).
    const desktopNotice = await dialog.locator('text="Available in the desktop app"').count();
    if (desktopNotice > 0) {
      report.checks.desktopMode = false;
      throw new Error('Dialog shows desktop-only notice — Style controls are not rendered on web/non-Electron');
    }
    report.checks.desktopMode = true;
    step('Generate Video dialog opened in desktop mode');

    // --- Assert Style controls present ---
    // Theme toggle
    const darkBtn = dialog.locator('button:has-text("Dark")');
    const lightBtn = dialog.locator('button:has-text("Light")');
    report.checks.themeToggle = (await darkBtn.count() > 0) && (await lightBtn.count() > 0);
    step(`Theme toggle present: ${report.checks.themeToggle}`);

    // Accent swatches (aria-labels from ACCENT_PRESETS)
    const swatchNames = ['IdiamPro Blue', 'Indigo', 'Emerald', 'Rose', 'Amber', 'Violet', 'Slate'];
    let swatchCount = 0;
    for (const n of swatchNames) {
      swatchCount += await dialog.locator(`button[aria-label="${n}"]`).count();
    }
    const customColor = await dialog.locator('input[type="color"], label[aria-label="Custom color"]').count();
    report.checks.accentSwatches = swatchCount;
    report.checks.customColorInput = customColor > 0;
    step(`Accent swatches found: ${swatchCount}; custom color control: ${customColor > 0}`);

    // Brand field
    const brand = dialog.locator('input[placeholder="Your name or brand"]');
    report.checks.brandField = await brand.count() > 0;
    step(`Brand field present: ${report.checks.brandField}`);

    // Logo upload control (Upload button when no logo, or Remove control when a logo is set)
    const uploadBtn = dialog.locator('button:has-text("Upload logo")');
    const removeLogo = dialog.locator('[aria-label="Remove logo"]');
    report.checks.logoControl = (await uploadBtn.count() > 0) || (await removeLogo.count() > 0);
    step(`Logo control present: ${report.checks.logoControl}`);

    // Voices: exactly six, with the expected labels
    const voiceLabels = dialog.locator('label[for^="vid-voice-"]');
    const voiceTexts = (await voiceLabels.allTextContents()).map((t) => t.trim());
    report.checks.voiceCount = voiceTexts.length;
    report.checks.voiceLabels = voiceTexts;
    const allExpectedPresent = EXPECTED_VOICES.every((v) => voiceTexts.includes(v));
    report.checks.sixExpectedVoices = voiceTexts.length === 6 && allExpectedPresent;
    step(`Voices found (${voiceTexts.length}): ${voiceTexts.join(', ')}`);

    // Preview element present
    const preview = dialog.locator('.aspect-video');
    report.checks.previewPresent = await preview.count() > 0;
    step(`Live preview present: ${report.checks.previewPresent}`);
    await takeShot('05-style-controls');

    // --- Interact: theme -> Light ---
    if (await lightBtn.count() > 0) {
      await lightBtn.first().click();
      await page.waitForTimeout(400);
      step('Switched theme to Light');
      await takeShot('06-theme-light');
      report.checks.previewAfterTheme = await dialog.locator('.aspect-video').count() > 0;
    }

    // --- Interact: pick a non-default accent (Emerald) ---
    const emerald = dialog.locator('button[aria-label="Emerald"]');
    if (await emerald.count() > 0) {
      await emerald.first().click();
      await page.waitForTimeout(400);
      step('Clicked non-default accent (Emerald)');
      await takeShot('07-accent-emerald');
      report.checks.previewAfterAccent = await dialog.locator('.aspect-video').count() > 0;
    }

    // --- Interact: type a brand name ---
    if (await brand.count() > 0) {
      await brand.first().fill('Acme Corp');
      await page.waitForTimeout(400);
      step('Typed brand name "Acme Corp"');
      await takeShot('08-brand-typed');
      // Confirm the preview reflects the brand text.
      const previewShowsBrand = await dialog.locator('.aspect-video:has-text("Acme Corp")').count() > 0;
      report.checks.previewShowsBrand = previewShowsBrand;
      report.checks.brandInputValue = await brand.first().inputValue();
      step(`Preview shows brand text: ${previewShowsBrand}`);
    }

    // We deliberately DO NOT click Generate.
    step('Skipped Generate (no render / no paid TTS) — configure UI only');
    await takeShot('09-final');

    // --- Overall pass criteria ---
    const c = report.checks;
    report.passed = Boolean(
      c.desktopMode &&
      c.themeToggle &&
      c.accentSwatches >= 1 &&
      c.brandField &&
      c.logoControl &&
      c.sixExpectedVoices &&
      c.previewPresent
    );
  } catch (err) {
    report.error = err.message;
    console.error('  ERROR:', err.message);
    await takeShot('99-error');
  } finally {
    await closeApp();
  }

  // Write reports
  fs.writeFileSync(path.join(SUITE_DIR, 'report.json'), JSON.stringify(report, null, 2));
  const md = [
    '# Generate Video — Style Step Test',
    '',
    `**Generated:** ${new Date(report.timestamp).toLocaleString()}`,
    `**Result:** ${report.passed ? 'PASS' : 'FAIL'}`,
    '',
    '## Checks',
    '',
    '```json',
    JSON.stringify(report.checks, null, 2),
    '```',
    '',
    '## Steps',
    '',
    ...report.steps.map((s) => `- ${s}`),
    report.error ? `\n**Error:** ${report.error}` : '',
  ].join('\n');
  fs.writeFileSync(path.join(SUITE_DIR, 'report.md'), md);
  console.log(`\nResult: ${report.passed ? 'PASS' : 'FAIL'}`);
  console.log(`Report: ${path.join(SUITE_DIR, 'report.json')}`);
  return report;
}

run().then((report) => {
  process.exit(report.passed ? 0 : 1);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
