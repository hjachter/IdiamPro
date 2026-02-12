const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

let electronApp;
let page;

// Get platform info for report
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

    // Wait for app to fully load by checking for sidebar buttons
    console.log('Waiting for app to fully load...');
    try {
      await page.locator('button:has-text("New Outline")').waitFor({ state: 'visible', timeout: 30000 });
      console.log('App loaded - New Outline button visible');
    } catch (e) {
      console.log('Timeout waiting for New Outline button, continuing anyway...');
      await page.waitForTimeout(5000);
    }
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
  const details = { steps: [] };

  try {
    // Look for the Welcome Tour button in sidebar
    const welcomeButton = page.locator('button:has-text("Welcome Tour"), button:has-text("Welcome")');
    const count = await welcomeButton.count();
    details.steps.push(`Found ${count} Welcome button(s)`);

    if (count > 0 && await welcomeButton.first().isVisible({ timeout: 5000 })) {
      await welcomeButton.first().click();
      details.steps.push('Welcome Tour button clicked');

      // Verify welcome outline loaded - use heading to be more specific
      await page.waitForTimeout(2000);
      const welcomeTitle = page.locator('h1:has-text("Welcome to IdiamPro!")');
      if (await welcomeTitle.first().isVisible({ timeout: 5000 })) {
        details.steps.push('Welcome outline loaded successfully');
        return { passed: true, details };
      } else {
        details.error = 'Welcome outline title not found';
      }
    } else {
      details.error = 'Welcome Tour button not visible';
      const allButtons = await page.locator('button').allTextContents();
      details.availableButtons = allButtons.slice(0, 10);
    }
  } catch (error) {
    details.error = error.message;
  }
  return { passed: false, details };
}

// Test: Open Settings dialog
async function testSettingsDialog() {
  const details = { steps: [] };

  try {
    // Look for settings button
    const settingsButton = page.locator('button:has(svg[class*="settings"]), button:has(.lucide-settings), [aria-label*="Settings"]');
    const count = await settingsButton.count();
    details.steps.push(`Found ${count} Settings button(s)`);

    if (count > 0) {
      await settingsButton.first().click();
      details.steps.push('Settings button clicked');

      await page.waitForTimeout(1000);

      // Look for subscription plan section
      const subscriptionPlan = page.locator('text="Subscription Plan"');
      if (await subscriptionPlan.isVisible({ timeout: 3000 })) {
        details.steps.push('Settings dialog opened with Subscription Plan visible');

        // Click on the plan badge to open plan dialog
        const planBadge = page.locator('button:has-text("Manage Plan"), button:has-text("Change Plan")');
        if (await planBadge.first().isVisible({ timeout: 2000 })) {
          await planBadge.first().click();
          details.steps.push('Plan dialog opened');

          // Check for 4 tiers
          await page.waitForTimeout(500);
          const freePlan = await page.locator('text="Free"').count();
          const basicPlan = await page.locator('text="Basic"').count();
          const premiumPlan = await page.locator('text="Premium"').count();
          const academicPlan = await page.locator('text="Academic"').count();

          details.plansFound = { free: freePlan, basic: basicPlan, premium: premiumPlan, academic: academicPlan };

          if (freePlan > 0 && basicPlan > 0 && premiumPlan > 0 && academicPlan > 0) {
            details.steps.push('All 4 subscription tiers present');
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
        return { passed: true, details };
      }
    } else {
      details.error = 'Settings button not found';
    }
  } catch (error) {
    details.error = error.message;
  }
  return { passed: false, details };
}

// Test: Create new outline
async function testCreateOutline() {
  const details = { steps: [] };

  try {
    const newOutlineButton = page.locator('button:has-text("New Outline")');
    const count = await newOutlineButton.count();
    details.steps.push(`Found ${count} New Outline button(s)`);

    if (count > 0 && await newOutlineButton.first().isVisible({ timeout: 5000 })) {
      await newOutlineButton.first().click();
      details.steps.push('New Outline button clicked');

      await page.waitForTimeout(2000);
      // Use heading to be more specific
      const untitledOutline = page.locator('h1:has-text("Untitled Outline")');
      if (await untitledOutline.first().isVisible({ timeout: 3000 })) {
        details.steps.push('New outline created successfully');
        return { passed: true, details };
      } else {
        details.error = 'Untitled Outline not found';
      }
    } else {
      details.error = 'New Outline button not visible';
    }
  } catch (error) {
    details.error = error.message;
  }
  return { passed: false, details };
}

// Test: User Guide button
async function testUserGuide() {
  const details = { steps: [] };

  try {
    const userGuideButton = page.locator('button:has-text("User Guide")');
    const count = await userGuideButton.count();
    details.steps.push(`Found ${count} User Guide button(s)`);

    if (count > 0 && await userGuideButton.first().isVisible({ timeout: 5000 })) {
      await userGuideButton.first().click();
      details.steps.push('User Guide button clicked');

      await page.waitForTimeout(2000);
      // Use heading to be more specific
      const guideTitle = page.locator('h1:has-text("IdiamPro User Guide")');
      if (await guideTitle.first().isVisible({ timeout: 3000 })) {
        details.steps.push('User Guide loaded successfully');
        return { passed: true, details };
      } else {
        details.error = 'User Guide title not found';
      }
    } else {
      details.error = 'User Guide button not visible';
    }
  } catch (error) {
    details.error = error.message;
  }
  return { passed: false, details };
}

// Take screenshot
async function takeScreenshot(name) {
  try {
    const screenshotPath = path.resolve(__dirname, '..', 'test-screenshots', `${name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
  } catch (error) {
    console.log(`Failed to save screenshot ${name}:`, error.message);
    return null;
  }
}

// Format duration
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// Run all tests
async function runTests() {
  const report = {
    timestamp: new Date().toISOString(),
    platform: getPlatformInfo(),
    tests: [],
    summary: { total: 0, passed: 0, failed: 0, duration: 0 }
  };

  const overallStart = Date.now();

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║           IdiamPro Automated Test Suite                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`Platform: ${report.platform.platform} ${report.platform.arch}`);
  console.log(`OS Version: ${report.platform.osVersion}`);
  console.log(`Node: ${report.platform.nodeVersion}`);
  console.log(`CPU: ${report.platform.cpu} (${report.platform.cpuCores} cores)`);
  console.log(`Memory: ${report.platform.totalMemory}`);
  console.log(`Started: ${new Date().toLocaleString()}\n`);

  try {
    const launchStart = Date.now();
    await launchApp();
    report.launchDuration = Date.now() - launchStart;
    console.log(`App launch time: ${formatDuration(report.launchDuration)}\n`);

    // Take initial screenshot
    const initialScreenshot = await takeScreenshot('01-initial');

    // Define tests
    const testCases = [
      { name: 'User Guide', fn: testUserGuide, screenshot: '02-after-guide' },
      { name: 'Welcome Tour', fn: testWelcomeTour, screenshot: '03-after-welcome' },
      { name: 'Create Outline', fn: testCreateOutline, screenshot: '04-after-create' },
      { name: 'Settings Dialog', fn: testSettingsDialog, screenshot: '05-after-settings' },
    ];

    // Run each test
    for (const test of testCases) {
      console.log(`\n─── ${test.name} ───`);
      const testStart = Date.now();

      const result = await test.fn();
      const duration = Date.now() - testStart;

      const screenshotPath = await takeScreenshot(test.screenshot);

      const testResult = {
        name: test.name,
        passed: result.passed,
        duration,
        durationFormatted: formatDuration(duration),
        timestamp: new Date().toISOString(),
        screenshot: screenshotPath,
        details: result.details
      };

      report.tests.push(testResult);

      // Console output
      const status = result.passed ? '✓ PASS' : '✗ FAIL';
      const statusColor = result.passed ? '\x1b[32m' : '\x1b[31m';
      console.log(`${statusColor}${status}\x1b[0m (${formatDuration(duration)})`);

      if (result.details.steps) {
        result.details.steps.forEach(step => console.log(`  • ${step}`));
      }
      if (result.details.error) {
        console.log(`  Error: ${result.details.error}`);
      }
    }

  } catch (error) {
    console.error('\nTest run failed:', error);
    report.error = error.message;
  } finally {
    await closeApp();
  }

  // Calculate summary
  report.summary.total = report.tests.length;
  report.summary.passed = report.tests.filter(t => t.passed).length;
  report.summary.failed = report.tests.filter(t => !t.passed).length;
  report.summary.duration = Date.now() - overallStart;
  report.summary.durationFormatted = formatDuration(report.summary.duration);

  // Print summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                      TEST RESULTS                          ║');
  console.log('╠════════════════════════════════════════════════════════════╣');

  for (const test of report.tests) {
    const status = test.passed ? '\x1b[32m✓ PASS\x1b[0m' : '\x1b[31m✗ FAIL\x1b[0m';
    const padding = ' '.repeat(Math.max(0, 40 - test.name.length));
    console.log(`║  ${status}  ${test.name}${padding}${test.durationFormatted.padStart(8)} ║`);
  }

  console.log('╠════════════════════════════════════════════════════════════╣');

  const passColor = report.summary.failed === 0 ? '\x1b[32m' : '\x1b[33m';
  console.log(`║  ${passColor}Total: ${report.summary.passed}/${report.summary.total} passed\x1b[0m               Duration: ${report.summary.durationFormatted.padStart(8)} ║`);
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Save JSON report
  const reportPath = path.resolve(__dirname, '..', 'test-screenshots', 'test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report saved: test-screenshots/test-report.json`);

  // Save markdown report
  const mdReport = generateMarkdownReport(report);
  const mdReportPath = path.resolve(__dirname, '..', 'test-screenshots', 'test-report.md');
  fs.writeFileSync(mdReportPath, mdReport);
  console.log(`Report saved: test-screenshots/test-report.md\n`);

  return report;
}

// Generate markdown report
function generateMarkdownReport(report) {
  const lines = [
    '# IdiamPro Test Report',
    '',
    `**Generated:** ${new Date(report.timestamp).toLocaleString()}`,
    '',
    '## Platform',
    '',
    '| Property | Value |',
    '|----------|-------|',
    `| OS | ${report.platform.platform} ${report.platform.arch} |`,
    `| OS Version | ${report.platform.osVersion} |`,
    `| Node | ${report.platform.nodeVersion} |`,
    `| CPU | ${report.platform.cpu} |`,
    `| Cores | ${report.platform.cpuCores} |`,
    `| Memory | ${report.platform.totalMemory} |`,
    '',
    '## Summary',
    '',
    `- **Total Tests:** ${report.summary.total}`,
    `- **Passed:** ${report.summary.passed}`,
    `- **Failed:** ${report.summary.failed}`,
    `- **Duration:** ${report.summary.durationFormatted}`,
    '',
    '## Test Results',
    '',
    '| Test | Status | Duration |',
    '|------|--------|----------|',
  ];

  for (const test of report.tests) {
    const status = test.passed ? '✅ PASS' : '❌ FAIL';
    lines.push(`| ${test.name} | ${status} | ${test.durationFormatted} |`);
  }

  lines.push('');
  lines.push('## Test Details');
  lines.push('');

  for (const test of report.tests) {
    lines.push(`### ${test.name}`);
    lines.push('');
    lines.push(`**Status:** ${test.passed ? '✅ Passed' : '❌ Failed'}`);
    lines.push(`**Duration:** ${test.durationFormatted}`);
    lines.push('');

    if (test.details.steps && test.details.steps.length > 0) {
      lines.push('**Steps:**');
      test.details.steps.forEach(step => lines.push(`- ${step}`));
      lines.push('');
    }

    if (test.details.error) {
      lines.push(`**Error:** ${test.details.error}`);
      lines.push('');
    }

    if (test.screenshot) {
      const screenshotName = path.basename(test.screenshot);
      lines.push(`**Screenshot:** [${screenshotName}](./${screenshotName})`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

// Run tests
runTests().then((report) => {
  process.exit(report.summary.failed > 0 ? 1 : 0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
