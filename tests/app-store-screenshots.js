/**
 * App Store Screenshot Capture (IdiamPro / SecondBrainWare)
 *
 * Generates a full set of submission-ready screenshots in the required Apple
 * sizes (iPhone 6.7", iPhone 6.5", iPad 12.9", iPad 13", macOS) by rendering
 * the web build at each viewport in headless Chromium.
 *
 * Requirements:
 *   - Dev server must already be running on http://localhost:9002
 *   - Playwright must be installed (it is — used by other tests in this folder)
 *
 * Run:
 *   node tests/app-store-screenshots.js
 *
 * Output:
 *   test-screenshots/app-store/<device-name>/<NN>-<scene-name>.png
 *
 * Notes:
 *   - This script never modifies app source or other test scripts.
 *   - Scene failures are logged and skipped; the script continues.
 *   - Re-run any time to refresh screenshots.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');

const DEV_URL = 'http://localhost:9002';
const APP_URL = `${DEV_URL}/app`;
const OUTPUT_ROOT = path.resolve(__dirname, '..', 'test-screenshots', 'app-store');

// Apple-required submission sizes. Portrait for phones/tablets, landscape for Mac.
const DEVICES = [
  {
    name: 'iphone-6.7',
    label: 'iPhone 6.7" (1290 x 2796)',
    width: 1290,
    height: 2796,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
  {
    name: 'iphone-6.5',
    label: 'iPhone 6.5" (1242 x 2688)',
    width: 1242,
    height: 2688,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  },
  {
    name: 'ipad-12.9',
    label: 'iPad 12.9" (2048 x 2732)',
    width: 2048,
    height: 2732,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
  {
    name: 'ipad-13',
    label: 'iPad 13" M4 (2064 x 2752)',
    width: 2064,
    height: 2752,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  },
  {
    name: 'mac-retina',
    label: 'macOS Retina (2880 x 1800)',
    width: 2880,
    height: 1800,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  {
    name: 'mac-standard',
    label: 'macOS Standard (1280 x 800)',
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
];

// ---------- helpers ----------

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function checkDevServer() {
  return new Promise((resolve) => {
    const req = http.get(DEV_URL, { timeout: 4000 }, (res) => {
      // Any HTTP response (even a redirect) means the server is up.
      res.resume();
      resolve(res.statusCode && res.statusCode < 500);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

async function safeClick(page, locator, timeout = 3000) {
  try {
    await locator.first().waitFor({ state: 'visible', timeout });
    await locator.first().click();
    return true;
  } catch (e) {
    return false;
  }
}

async function dismissAnyOpenDialog(page) {
  // Press Escape a couple times to close stacked dialogs/menus.
  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  } catch {
    /* ignore */
  }
}

async function loadAppFresh(page, { dark = false } = {}) {
  // Seed theme + onboarding flags BEFORE navigating so first paint matches.
  await page.addInitScript(
    ({ dark }) => {
      try {
        localStorage.setItem('theme', dark ? 'dark' : 'light');
        // next-themes uses this key by default
        localStorage.setItem('next-themes-theme', dark ? 'dark' : 'light');
        // Suppress first-run / welcome / install nags so screenshots are clean
        localStorage.setItem('idiampro-welcome-shown', 'true');
        localStorage.setItem('idiampro-onboarding-complete', 'true');
        localStorage.setItem('pwa-install-dismissed', 'true');
      } catch {
        /* ignore */
      }
    },
    { dark }
  );

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Force theme on <html> after navigation as a belt-and-suspenders measure.
  await page.evaluate((dark) => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
    }
  }, dark);

  // Wait for the app shell to render. Be tolerant — fall back to time delay.
  try {
    await page.waitForSelector(
      'button:has-text("New Outline"), button:has-text("User Guide"), [aria-label="Open outlines sidebar"]',
      { timeout: 15000 }
    );
  } catch {
    /* continue with whatever loaded */
  }
  await page.waitForTimeout(1500);
}

async function loadUserGuide(page) {
  // Best-effort: click "User Guide" if present. Many mobile layouts hide the
  // sidebar by default — open it first.
  const sidebarOpener = page.locator('[aria-label="Open outlines sidebar"]');
  if ((await sidebarOpener.count()) > 0) {
    await safeClick(page, sidebarOpener, 1500);
    await page.waitForTimeout(400);
  }
  await safeClick(page, page.locator('button:has-text("User Guide")'), 2500);
  await page.waitForTimeout(1500);
}

async function captureScene(page, deviceDir, index, sceneName, action) {
  const filename = `${String(index).padStart(2, '0')}-${sceneName}.png`;
  const outPath = path.join(deviceDir, filename);
  try {
    await action(page);
    await page.waitForTimeout(500);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`    [OK] ${filename}`);
    return { scene: sceneName, ok: true, path: outPath };
  } catch (err) {
    console.log(`    [SKIP] ${filename} - ${err.message}`);
    // Still capture whatever's on screen so we have evidence
    try {
      await page.screenshot({ path: outPath, fullPage: false });
    } catch {
      /* ignore */
    }
    return { scene: sceneName, ok: false, error: err.message };
  }
}

// ---------- scene definitions ----------

const SCENES = [
  {
    name: 'main-outline',
    setup: async (page) => {
      await loadAppFresh(page, { dark: false });
      await loadUserGuide(page);
      await dismissAnyOpenDialog(page);
    },
  },
  {
    name: 'ai-menu',
    setup: async (page) => {
      await dismissAnyOpenDialog(page);
      const aiBtn = page.locator(
        '[aria-label="AI features menu"], button[title="AI Features"]'
      );
      const ok = await safeClick(page, aiBtn, 3000);
      if (!ok) throw new Error('AI menu button not found');
      await page.waitForTimeout(800);
    },
  },
  {
    name: 'knowledge-chat',
    setup: async (page) => {
      await dismissAnyOpenDialog(page);
      // Knowledge chat is exposed via the Brain menu. Open it first.
      const brainBtn = page.locator('[aria-label="Second Brain menu"]');
      const opened = await safeClick(page, brainBtn, 3000);
      if (!opened) throw new Error('Second Brain menu button not found');
      await page.waitForTimeout(400);
      // Look for a menu item that opens Knowledge Chat
      const chatItem = page.locator(
        'text=/Knowledge Chat|Ask Knowledge|Chat with/i'
      );
      const clickedChat = await safeClick(page, chatItem, 2500);
      if (!clickedChat) {
        // Close the brain menu, fall back to a plain screenshot of the menu.
        await page.keyboard.press('Escape');
        throw new Error('Knowledge Chat menu item not found');
      }
      await page.waitForTimeout(1200);
    },
  },
  {
    name: 'quick-capture',
    setup: async (page) => {
      await dismissAnyOpenDialog(page);
      const qc = page.locator(
        '[aria-label="Quick Capture"], button[title="Quick Capture"]'
      );
      const ok = await safeClick(page, qc, 3000);
      if (!ok) throw new Error('Quick Capture button not found');
      await page.waitForTimeout(900);
    },
  },
  {
    name: 'second-brain-dashboard',
    setup: async (page) => {
      await dismissAnyOpenDialog(page);
      const brainBtn = page.locator('[aria-label="Second Brain menu"]');
      const opened = await safeClick(page, brainBtn, 3000);
      if (!opened) throw new Error('Second Brain menu button not found');
      await page.waitForTimeout(400);
      const dashItem = page.locator('text=/View Dashboard|Dashboard/i');
      const ok = await safeClick(page, dashItem, 2500);
      if (!ok) {
        await page.keyboard.press('Escape');
        throw new Error('Dashboard menu item not found');
      }
      await page.waitForTimeout(1500);
    },
  },
  {
    name: 'templates',
    setup: async (page) => {
      await dismissAnyOpenDialog(page);
      // Templates trigger lives in the sidebar Templates section header.
      // First try clicking a "Templates" button if visible directly.
      const tmpl = page.locator('button:has-text("Templates")');
      const ok = await safeClick(page, tmpl, 2500);
      if (!ok) throw new Error('Templates trigger not found');
      await page.waitForTimeout(800);
    },
  },
  {
    name: 'dark-mode-outline',
    setup: async (page) => {
      // Re-load the app in dark mode for a clean dark-themed capture.
      await loadAppFresh(page, { dark: true });
      await loadUserGuide(page);
      await dismissAnyOpenDialog(page);
    },
  },
];

// ---------- main ----------

async function captureForDevice(browser, device) {
  console.log(`\n=== ${device.label} ===`);
  const deviceDir = path.join(OUTPUT_ROOT, device.name);
  ensureDir(deviceDir);

  const contextOpts = {
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: device.deviceScaleFactor,
    isMobile: device.isMobile,
    hasTouch: device.hasTouch,
  };
  if (device.userAgent) contextOpts.userAgent = device.userAgent;

  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();

  const results = [];
  for (let i = 0; i < SCENES.length; i++) {
    const scene = SCENES[i];
    const result = await captureScene(
      page,
      deviceDir,
      i + 1,
      scene.name,
      scene.setup
    );
    results.push(result);
  }

  await context.close();
  return { device: device.name, label: device.label, results };
}

async function main() {
  console.log('App Store Screenshot Capture');
  console.log('============================');

  console.log('Checking dev server at', DEV_URL, '...');
  const up = await checkDevServer();
  if (!up) {
    console.error(
      `\nERROR: Dev server is not responding at ${DEV_URL}.\n` +
        'Start it with `npm run dev` and re-run this script.'
    );
    process.exit(1);
  }
  console.log('Dev server is up.');

  ensureDir(OUTPUT_ROOT);

  const browser = await chromium.launch({ headless: true });
  const allResults = [];
  try {
    for (const device of DEVICES) {
      const deviceResult = await captureForDevice(browser, device);
      allResults.push(deviceResult);
    }
  } finally {
    await browser.close();
  }

  // Summary
  console.log('\n============================');
  console.log('Summary');
  console.log('============================');
  let total = 0;
  let ok = 0;
  for (const dev of allResults) {
    const passed = dev.results.filter((r) => r.ok).length;
    total += dev.results.length;
    ok += passed;
    console.log(`${dev.label}: ${passed}/${dev.results.length} scenes captured`);
    for (const r of dev.results) {
      if (!r.ok) console.log(`  - SKIPPED ${r.scene}: ${r.error}`);
    }
  }
  console.log(`\nTotal: ${ok}/${total} screenshots produced`);
  console.log(`Output: ${OUTPUT_ROOT}`);

  // Write a JSON report alongside the screenshots
  const reportPath = path.join(OUTPUT_ROOT, 'report.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        runAt: new Date().toISOString(),
        devUrl: DEV_URL,
        totals: { ok, total },
        devices: allResults,
      },
      null,
      2
    )
  );
  console.log(`Report: ${reportPath}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
