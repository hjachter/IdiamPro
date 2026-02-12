const { _electron: electron } = require('playwright');
const path = require('path');

let electronApp;
let page;

async function findMainWindow(electronApp, maxWait = 30000) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const windows = electronApp.windows();
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
  console.log('\nTesting Welcome Tour button...');

  try {
    // Look for the Welcome Tour button in sidebar
    const welcomeButton = page.locator('button:has-text("Welcome Tour"), button:has-text("Welcome")');
    const count = await welcomeButton.count();
    console.log(`  Found ${count} Welcome button(s)`);

    if (count > 0 && await welcomeButton.first().isVisible({ timeout: 5000 })) {
      await welcomeButton.first().click();
      console.log('  ✓ Welcome Tour button clicked');

      // Verify welcome outline loaded - use heading to be more specific
      await page.waitForTimeout(2000);
      const welcomeTitle = page.locator('h1:has-text("Welcome to IdiamPro!")');
      if (await welcomeTitle.first().isVisible({ timeout: 5000 })) {
        console.log('  ✓ Welcome outline loaded');
        return true;
      } else {
        console.log('  ✗ Welcome outline title not found');
      }
    } else {
      console.log('  ✗ Welcome Tour button not visible');
      // Debug: print all buttons
      const allButtons = await page.locator('button').allTextContents();
      console.log('  Available buttons:', allButtons.slice(0, 10));
    }
  } catch (error) {
    console.log('  ✗ Welcome Tour test failed:', error.message);
  }
  return false;
}

// Test: Open Settings dialog
async function testSettingsDialog() {
  console.log('\nTesting Settings dialog...');

  try {
    // Look for settings button
    const settingsButton = page.locator('button:has(svg[class*="settings"]), button:has(.lucide-settings), [aria-label*="Settings"]');
    const count = await settingsButton.count();
    console.log(`  Found ${count} Settings button(s)`);

    if (count > 0) {
      await settingsButton.first().click();
      console.log('  ✓ Settings button clicked');

      await page.waitForTimeout(1000);

      // Look for subscription plan section
      const subscriptionPlan = page.locator('text="Subscription Plan"');
      if (await subscriptionPlan.isVisible({ timeout: 3000 })) {
        console.log('  ✓ Settings dialog opened with Subscription Plan visible');

        // Click on the plan badge to open plan dialog
        const planBadge = page.locator('button:has-text("Manage Plan"), button:has-text("Change Plan")');
        if (await planBadge.first().isVisible({ timeout: 2000 })) {
          await planBadge.first().click();
          console.log('  ✓ Plan dialog opened');

          // Check for 4 tiers
          await page.waitForTimeout(500);
          const freePlan = await page.locator('text="Free"').count();
          const basicPlan = await page.locator('text="Basic"').count();
          const premiumPlan = await page.locator('text="Premium"').count();
          const academicPlan = await page.locator('text="Academic"').count();

          console.log(`  Plans found: Free=${freePlan}, Basic=${basicPlan}, Premium=${premiumPlan}, Academic=${academicPlan}`);

          if (freePlan > 0 && basicPlan > 0 && premiumPlan > 0 && academicPlan > 0) {
            console.log('  ✓ All 4 subscription tiers present');
          }
        }

        // Close dialogs
        const closeButtons = page.locator('button:has-text("Close")');
        const closeCount = await closeButtons.count();
        for (let i = 0; i < closeCount; i++) {
          if (await closeButtons.nth(i).isVisible()) {
            await closeButtons.nth(i).click();
            await page.waitForTimeout(300);
          }
        }
        return true;
      }
    } else {
      console.log('  ✗ Settings button not found');
    }
  } catch (error) {
    console.log('  ✗ Settings test failed:', error.message);
  }
  return false;
}

// Test: Create new outline
async function testCreateOutline() {
  console.log('\nTesting Create Outline...');

  try {
    const newOutlineButton = page.locator('button:has-text("New Outline")');
    const count = await newOutlineButton.count();
    console.log(`  Found ${count} New Outline button(s)`);

    if (count > 0 && await newOutlineButton.first().isVisible({ timeout: 5000 })) {
      await newOutlineButton.first().click();
      console.log('  ✓ New Outline button clicked');

      await page.waitForTimeout(2000);
      // Use heading to be more specific
      const untitledOutline = page.locator('h1:has-text("Untitled Outline")');
      if (await untitledOutline.first().isVisible({ timeout: 3000 })) {
        console.log('  ✓ New outline created');
        return true;
      } else {
        console.log('  ✗ Untitled Outline not found');
      }
    } else {
      console.log('  ✗ New Outline button not visible');
    }
  } catch (error) {
    console.log('  ✗ Create Outline test failed:', error.message);
  }
  return false;
}

// Test: User Guide button
async function testUserGuide() {
  console.log('\nTesting User Guide button...');

  try {
    const userGuideButton = page.locator('button:has-text("User Guide")');
    const count = await userGuideButton.count();
    console.log(`  Found ${count} User Guide button(s)`);

    if (count > 0 && await userGuideButton.first().isVisible({ timeout: 5000 })) {
      await userGuideButton.first().click();
      console.log('  ✓ User Guide button clicked');

      await page.waitForTimeout(2000);
      // Use heading to be more specific
      const guideTitle = page.locator('h1:has-text("IdiamPro User Guide")');
      if (await guideTitle.first().isVisible({ timeout: 3000 })) {
        console.log('  ✓ User Guide loaded');
        return true;
      } else {
        console.log('  ✗ User Guide title not found');
      }
    } else {
      console.log('  ✗ User Guide button not visible');
    }
  } catch (error) {
    console.log('  ✗ User Guide test failed:', error.message);
  }
  return false;
}

// Take screenshot
async function takeScreenshot(name) {
  try {
    const screenshotPath = path.resolve(__dirname, '..', 'test-screenshots', `${name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved: ${name}.png`);
  } catch (error) {
    console.log(`Failed to save screenshot ${name}:`, error.message);
  }
}

// Run all tests
async function runTests() {
  const results = [];

  try {
    await launchApp();

    // Take initial screenshot
    await takeScreenshot('01-initial');

    // Run tests
    results.push({ name: 'User Guide', passed: await testUserGuide() });
    await takeScreenshot('02-after-guide');

    results.push({ name: 'Welcome Tour', passed: await testWelcomeTour() });
    await takeScreenshot('03-after-welcome');

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

// Run tests
runTests().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
