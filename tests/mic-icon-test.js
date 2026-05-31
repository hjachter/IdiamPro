// tests/mic-icon-test.js
//
// Verifies the natural-language command palette (Cmd+K) voice UX:
//
//   1. With Input mode = "voice-auto-start" (set via localStorage), opening
//      the palette auto-engages voice listening — no inner mic button to
//      click.
//   2. While listening, a red-dot indicator (data-testid="listening-indicator")
//      appears in the input row alongside a "Listening" label.
//   3. Clicking the red dot stops listening (indicator disappears).
//
// Writes screenshots + report.json + report.md to test-screenshots/mic-icon/.
// Exits non-zero on any assertion failure.

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'mic-icon');
fs.mkdirSync(OUT_DIR, { recursive: true });

function nowIso() { return new Date().toISOString(); }

function platformInfo() {
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

const assertions = [];
function record(name, passed, detail) {
  assertions.push({ name, passed, detail, at: nowIso() });
  const tag = passed ? 'PASS' : 'FAIL';
  console.log(`  [${tag}] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function findMainWindow(electronApp, maxWaitMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const windows = electronApp.windows();
    for (const win of windows) {
      try {
        const url = win.url();
        if (url.startsWith('devtools://')) continue;
        if (url.includes('localhost:9002')) return win;
      } catch {}
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Could not find main app window (localhost:9002).');
}

async function takeShot(page, file) {
  const full = path.join(OUT_DIR, file);
  try {
    await page.screenshot({ path: full, fullPage: false });
    console.log(`  screenshot: ${file}`);
  } catch (e) {
    console.log(`  screenshot ${file} failed: ${e.message}`);
  }
  return full;
}

async function openCommandPalette(page) {
  // Prefer keyboard shortcut.
  try {
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(400);
    const input = page.locator('input[placeholder*="Type or speak a command"]');
    if (await input.first().isVisible({ timeout: 1000 })) {
      return 'shortcut';
    }
  } catch {}

  // Fallback: click the red Mic toolbar button.
  const toolbarMic = page.locator('button[aria-label^="Tell me what you want to do"]');
  await toolbarMic.first().waitFor({ state: 'visible', timeout: 5000 });
  await toolbarMic.first().click();
  await page.waitForTimeout(400);
  const input = page.locator('input[placeholder*="Type or speak a command"]');
  await input.first().waitFor({ state: 'visible', timeout: 5000 });
  return 'toolbar-click';
}

async function run() {
  console.log('\n--- mic-icon-test (auto-listen redesign) ---');
  console.log(`Started: ${new Date().toLocaleString()}`);

  const projectRoot = path.resolve(__dirname, '..');
  console.log('Launching Electron from:', projectRoot);

  const electronApp = await electron.launch({
    args: [projectRoot],
    env: { ...process.env, NODE_ENV: 'development' },
  });

  let exitCode = 0;
  let openMethod = null;
  const consoleLog = [];

  try {
    const page = await findMainWindow(electronApp);
    console.log('Main window:', page.url());

    page.on('dialog', async (d) => {
      console.log('  [dialog]', d.type(), '-', d.message().slice(0, 120));
      try { await d.dismiss(); } catch {}
    });
    page.on('console', (msg) => {
      const text = msg.text();
      consoleLog.push({ type: msg.type(), text, at: nowIso() });
      if (/speech|mic|permission|denied|getUserMedia|not-allowed/i.test(text)) {
        console.log(`  [renderer ${msg.type()}]`, text.slice(0, 240));
      }
    });

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500);

    if (!page.url().includes('/app')) {
      await page.evaluate(() => { window.location.href = '/app'; });
      await page.waitForLoadState('domcontentloaded');
    }

    // Set Input mode preference to voice-auto-start. The hook listens for a
    // custom 'inputmode:changed' event in the same tab, so we set localStorage
    // and dispatch the event — no slow page.reload required (the app loads
    // dozens of large outlines on startup and reload times out).
    await page.evaluate(() => {
      window.localStorage.setItem('inputMode', 'voice-auto-start');
      window.dispatchEvent(new CustomEvent('inputmode:changed'));
    });

    // Wait specifically for the toolbar mic button to render — that's our proof
    // the app shell is alive and ready for keystrokes.
    await page.locator('button[aria-label^="Tell me what you want to do"]').first()
      .waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(800);

    // Open the palette.
    openMethod = await openCommandPalette(page);
    record('Command palette opens (Cmd+K or toolbar click)', true, `via ${openMethod}`);
    await takeShot(page, '01-palette-open.png');

    // Wait for the auto-start useEffect to engage listening.
    await page.waitForTimeout(2000);
    await takeShot(page, '02-listening.png');

    // Listening indicator (red dot) should be visible.
    const indicator = page.locator('[data-testid="listening-indicator"]').first();
    let indicatorVisible = false;
    try {
      await indicator.waitFor({ state: 'visible', timeout: 3000 });
      indicatorVisible = true;
    } catch {}
    record('Listening indicator (red dot) appears automatically after palette opens',
      indicatorVisible,
      indicatorVisible ? 'visible' : 'NOT visible — auto-start may have failed');

    // Verify no [speech-to-text] onerror surfaced.
    await page.waitForTimeout(800);
    const speechErrors = consoleLog.filter(e =>
      e.type === 'warning' && /\[speech-to-text\] onerror:/i.test(e.text)
    );
    record('No [speech-to-text] onerror warning (mic permission OK)',
      speechErrors.length === 0,
      speechErrors.length > 0
        ? `errors observed: ${speechErrors.map(e => e.text).join(' | ').slice(0, 240)}`
        : 'no onerror warning logged');

    // Typing a key should stop listening (no manual stop needed).
    if (indicatorVisible) {
      const input = page.locator('input[placeholder*="Type or speak a command"]').first();
      await input.focus();
      await input.press('a');
      await page.waitForTimeout(800);
      await takeShot(page, '03-stopped.png');

      const stillVisible = await indicator.isVisible().catch(() => false);
      record('Typing a character stops listening (indicator disappears)',
        !stillVisible,
        stillVisible ? 'still visible — typing did not stop listening' : 'indicator gone');
    }

    // No inner mic button should exist any more.
    const innerMicCount = await page.locator(
      'button[aria-label="Voice input"], button[aria-label="Stop listening"]'
    ).count();
    record('Inner mic toggle button has been removed (now zero count)',
      innerMicCount === 0,
      `found ${innerMicCount} button(s) — expected 0`);

    // The red-dot indicator should be a non-interactive span (not a button).
    const indicatorIsButton = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="listening-indicator"]');
      return el ? el.tagName.toLowerCase() === 'button' : false;
    });
    record('Red-dot indicator is output-only (not a button)',
      !indicatorIsButton,
      indicatorIsButton ? 'still a <button> — should be a non-interactive span' : 'indicator is non-interactive');

    const failed = assertions.filter(a => !a.passed);
    if (failed.length > 0) {
      console.log(`\nFAILED ${failed.length}/${assertions.length}`);
      exitCode = 1;
    } else {
      console.log(`\nPASSED all ${assertions.length} assertions`);
    }
  } catch (err) {
    console.error('FATAL', err);
    exitCode = 2;
    record('Test fatally crashed', false, err.message);
  } finally {
    // Write reports.
    const report = {
      generated: nowIso(),
      openMethod,
      platform: platformInfo(),
      assertions,
      consoleLog: consoleLog.slice(-200),
    };
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    const md = [
      '# Mic Icon Test Report (auto-listen redesign)',
      '',
      `**Generated:** ${new Date().toLocaleString()}`,
      `**Open method:** ${openMethod || '?'}`,
      '',
      '## Summary',
      `- Total: ${assertions.length}`,
      `- Passed: ${assertions.filter(a => a.passed).length}`,
      `- Failed: ${assertions.filter(a => !a.passed).length}`,
      '',
      '## Assertions',
      '',
      '| # | Status | Name | Detail |',
      '|---|--------|------|--------|',
      ...assertions.map((a, i) =>
        `| ${i + 1} | ${a.passed ? 'PASS' : 'FAIL'} | ${a.name} | ${a.detail || ''} |`),
      '',
      '## Screenshots',
      '',
      '- 01-palette-open.png',
      '- 02-listening.png',
      '- 03-stopped.png',
    ].join('\n');
    fs.writeFileSync(path.join(OUT_DIR, 'report.md'), md);

    try { await electronApp.close(); } catch {}
    process.exit(exitCode);
  }
}

run();
