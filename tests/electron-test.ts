import { _electron as electron, Page, ElectronApplication } from 'playwright';
import * as path from 'path';

let electronApp: ElectronApplication;
let page: Page;

async function findMainWindow(app: ElectronApplication, maxWait = 30000): Promise<Page> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const windows = app.windows();
    console.log(`  Found ${windows.length} window(s)`);

    for (const win of windows) {
      try {
        const url = win.url();
        console.log(`  Window URL: ${url}`);

        // Skip DevTools windows
        if (url.startsWith('devtools://')) {
          continue;
        }

        // Look for localhost window (our app)
        if (url.includes('localhost:9002')) {
          return win;
        }
      } catch (e) {
        // Window might be closed or not ready
      }
    }

    // Wait a bit and try again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error('Could not find main app window');
}

async function launchApp() {
  const projectRoot = path.resolve(__dirname, '..');

  console.log('Launching Electron app from:', projectRoot);

  // Launch Electron app
  electronApp = await electron.launch({
    args: [projectRoot],
    env: {
      ...process.env,
      NODE_ENV: 'development'
    }
  });

  console.log('Waiting for main window...');

  // Find the main app window (not DevTools)
  page = await findMainWindow(electronApp);
  console.log('Found main window:', page.url());

  // Wait for page to be fully loaded
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000); // Give app time to initialize

  // Navigate to the app page (Electron loads marketing page by default)
  const currentUrl = page.url();
  if (!currentUrl.includes('/app')) {
    console.log('Navigating to /app...');
    await page.evaluate(() => {
      window.location.href = '/app';
    });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(8000); // Give app time to fully initialize
  }

  console.log('App launched successfully, now at:', page.url());
  return { electronApp, page };
}

async function closeApp() {
  if (electronApp) {
    await electronApp.close();
  }
}

// Test: Click Welcome Tour button
async function testWelcomeTour() {
  console.log('Testing Welcome Tour button...');

  try {
    // Look for the Welcome Tour button in sidebar
    const welcomeButton = page.locator('button:has-text("Welcome Tour"), button:has-text("Welcome")');

    if (await welcomeButton.first().isVisible({ timeout: 5000 })) {
      await welcomeButton.first().click();
      console.log('✓ Welcome Tour button clicked');

      // Verify welcome outline loaded - use heading to be more specific
      await page.waitForTimeout(2000);
      const welcomeTitle = page.locator('h1:has-text("Welcome to IdiamPro!")');
      if (await welcomeTitle.first().isVisible({ timeout: 3000 })) {
        console.log('✓ Welcome outline loaded');
        return true;
      }
    } else {
      console.log('✗ Welcome Tour button not found');
      return false;
    }
  } catch (error) {
    console.log('✗ Welcome Tour test failed:', error);
    return false;
  }
  return false;
}

// Test: Open Settings dialog
async function testSettingsDialog() {
  console.log('Testing Settings dialog...');

  try {
    // Look for settings button (gear icon)
    const settingsButton = page.locator('button[aria-label*="Settings"], button:has(svg.lucide-settings)');

    if (await settingsButton.first().isVisible({ timeout: 5000 })) {
      await settingsButton.first().click();
      console.log('✓ Settings button clicked');

      // Wait for dialog
      await page.waitForTimeout(500);

      // Look for subscription plan section
      const subscriptionPlan = page.locator('text="Subscription Plan"');
      if (await subscriptionPlan.isVisible({ timeout: 3000 })) {
        console.log('✓ Settings dialog opened with Subscription Plan visible');

        // Close dialog
        const closeButton = page.locator('button:has-text("Close"), [aria-label="Close"]');
        if (await closeButton.first().isVisible()) {
          await closeButton.first().click();
        }
        return true;
      }
    } else {
      console.log('✗ Settings button not found');
      return false;
    }
  } catch (error) {
    console.log('✗ Settings test failed:', error);
    return false;
  }
  return false;
}

// Test: Create new outline
async function testCreateOutline() {
  console.log('Testing Create Outline...');

  try {
    const newOutlineButton = page.locator('button:has-text("New Outline")');

    if (await newOutlineButton.first().isVisible({ timeout: 5000 })) {
      await newOutlineButton.first().click();
      console.log('✓ New Outline button clicked');

      // Should create a new untitled outline - use heading to be specific
      await page.waitForTimeout(2000);
      const untitledOutline = page.locator('h1:has-text("Untitled Outline")');
      if (await untitledOutline.first().isVisible({ timeout: 3000 })) {
        console.log('✓ New outline created');
        return true;
      }
    } else {
      console.log('✗ New Outline button not found');
      return false;
    }
  } catch (error) {
    console.log('✗ Create Outline test failed:', error);
    return false;
  }
  return false;
}

// Test: User Guide button
async function testUserGuide() {
  console.log('Testing User Guide button...');

  try {
    const userGuideButton = page.locator('button:has-text("User Guide")');

    if (await userGuideButton.first().isVisible({ timeout: 5000 })) {
      await userGuideButton.first().click();
      console.log('✓ User Guide button clicked');

      await page.waitForTimeout(2000);
      // Use heading to be more specific
      const guideTitle = page.locator('h1:has-text("IdiamPro User Guide")');
      if (await guideTitle.first().isVisible({ timeout: 3000 })) {
        console.log('✓ User Guide loaded');
        return true;
      }
    } else {
      console.log('✗ User Guide button not found');
      return false;
    }
  } catch (error) {
    console.log('✗ User Guide test failed:', error);
    return false;
  }
  return false;
}

// Take screenshot
async function takeScreenshot(name: string) {
  const screenshotPath = path.resolve(__dirname, '..', 'test-screenshots', `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Screenshot saved: ${screenshotPath}`);
}

// Run all tests
async function runTests() {
  const results: { name: string; passed: boolean }[] = [];

  try {
    await launchApp();

    // Take initial screenshot
    await takeScreenshot('01-initial');

    // Run tests
    results.push({ name: 'Welcome Tour', passed: await testWelcomeTour() });
    await takeScreenshot('02-after-welcome');

    results.push({ name: 'User Guide', passed: await testUserGuide() });
    await takeScreenshot('03-after-guide');

    results.push({ name: 'Create Outline', passed: await testCreateOutline() });
    await takeScreenshot('04-after-create');

    results.push({ name: 'Settings Dialog', passed: await testSettingsDialog() });
    await takeScreenshot('05-after-settings');

  } catch (error) {
    console.error('Test run failed:', error);
  } finally {
    await closeApp();
  }

  // Print summary
  console.log('\n========== TEST RESULTS ==========');
  let passed = 0;
  let failed = 0;
  for (const result of results) {
    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${status}: ${result.name}`);
    if (result.passed) passed++;
    else failed++;
  }
  console.log(`\nTotal: ${passed} passed, ${failed} failed`);
  console.log('==================================\n');

  return results;
}

// Export for use as module or run directly
export { launchApp, closeApp, testWelcomeTour, testSettingsDialog, testCreateOutline, testUserGuide, takeScreenshot, runTests };

// Run if called directly
if (require.main === module) {
  runTests().then(() => process.exit(0)).catch(() => process.exit(1));
}
