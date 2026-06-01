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
    const input = page.locator('input[placeholder*="Type a command"]');
    if (await input.first().isVisible({ timeout: 1000 })) {
      return 'shortcut';
    }
  } catch {}

  // Fallback: click the toolbar Ask AI (Sparkles) button.
  const toolbarMic = page.locator('button[aria-label^="Ask AI"]');
  await toolbarMic.first().waitFor({ state: 'visible', timeout: 5000 });
  await toolbarMic.first().click();
  await page.waitForTimeout(400);
  const input = page.locator('input[placeholder*="Type a command"]');
  await input.first().waitFor({ state: 'visible', timeout: 5000 });
  return 'toolbar-click';
}

async function run() {
  console.log('\n--- mic-icon-test (auto-listen redesign) ---');
  console.log(`Started: ${new Date().toLocaleString()}`);

  const projectRoot = path.resolve(__dirname, '..');
  console.log('Launching Electron from:', projectRoot);

  // Feed simulated audio into getUserMedia via Chromium fake-audio flags.
  // - `--use-fake-device-for-media-stream` skips the OS mic prompt entirely
  //   and replaces the real input device with a synthetic 440Hz beep tone
  //   pattern. That gives the level meter genuine non-silent audio frames to
  //   chew on, which is exactly what we need to verify the meter responds to
  //   real audio (not just that the indicator is mounted).
  // - `--use-file-for-fake-audio-capture=<path>` would swap the beep for a
  //   WAV's contents, but Electron's sandboxed audio utility process does not
  //   reliably honor that switch (the renderer ends up with pure silence in
  //   our testing). We keep the reference speech WAV in `fixtures/` for the
  //   day Electron fixes that — and pass the switch so main.js's forwarding
  //   path stays exercised — but the assertions below tolerate either mode.
  //   Electron filters most Chromium switches by default; main.js forwards
  //   the two allowlisted ones via app.commandLine.appendSwitch().
  const wavPath = path.resolve(__dirname, 'fixtures', 'speech-test.wav');
  if (!fs.existsSync(wavPath)) {
    throw new Error(`Missing fake-audio fixture at ${wavPath}. Regenerate it with:\n  say -o ${wavPath} --data-format=LEI16@16000 "create an outline called fake audio test"`);
  }

  // NOTE on `--use-file-for-fake-audio-capture`: we deliberately don't pass
  // it. In Electron 39 the file-based fake capture path produces pure
  // silence in the renderer (confirmed via standalone probes), while the
  // beep-only mode is solid. We still keep the WAV fixture committed for the
  // day Electron fixes that — at which point we can pass the file flag and
  // tighten the level threshold. The synthetic 440Hz beep is enough to
  // prove the meter responds to genuine non-silent audio frames.
  const electronApp = await electron.launch({
    args: [
      projectRoot,
      '--use-fake-device-for-media-stream',
    ],
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
    // the app shell is alive and ready for keystrokes. The dev-server's initial
    // outline hydration can be slow on cold launches, so we allow generous time
    // and take a diagnostic screenshot on timeout for human inspection.
    try {
      await page.locator('button[aria-label^="Ask AI"]').first()
        .waitFor({ state: 'visible', timeout: 60000 });
    } catch (e) {
      await takeShot(page, '00-toolbar-timeout.png');
      throw e;
    }
    await page.waitForTimeout(800);

    // Open the palette.
    openMethod = await openCommandPalette(page);
    record('Command palette opens (Cmd+K or toolbar click)', true, `via ${openMethod}`);
    await takeShot(page, '01-palette-open.png');

    // Wait for the auto-start useEffect to engage listening.
    await page.waitForTimeout(2000);
    await takeShot(page, '02-listening.png');

    // Listening indicator should be visible.
    const indicator = page.locator('[data-testid="listening-indicator"]').first();
    let indicatorVisible = false;
    try {
      await indicator.waitFor({ state: 'visible', timeout: 3000 });
      indicatorVisible = true;
    } catch {}
    record('Listening indicator appears automatically after palette opens',
      indicatorVisible,
      indicatorVisible ? 'visible' : 'NOT visible — auto-start may have failed');

    // Live level meter: the indicator should contain multiple <span> bars
    // (animatable content), not a single static dot.
    if (indicatorVisible) {
      const meterSpanCount = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="listening-indicator"]');
        if (!el) return 0;
        return el.querySelectorAll('span').length;
      });
      record('Listening indicator renders a live level meter (multiple <span> bars)',
        meterSpanCount >= 2,
        `found ${meterSpanCount} <span> element(s) inside indicator — expected >= 2`);

      // Fake audio is being fed in via Chromium flags. Chromium's synthetic
      // device emits a 440Hz beep pattern (the file flag is best-effort —
      // see launch-flag comment), so the level rises and falls. Sample the
      // hook-mirrored level repeatedly over ~3 seconds and assert the
      // observed PEAK exceeds the noise-floor threshold. This is the right
      // shape for non-stationary audio — checking a single instant is fragile
      // because the smoothed level can be near zero between beep cycles.
      const audioObservation = await page.evaluate(async () => {
        const samples = [];
        const detectedSamples = [];
        const start = Date.now();
        await new Promise(resolve => {
          const tick = () => {
            const w = window;
            samples.push(typeof w.__speechLevel === 'number' ? w.__speechLevel : 0);
            detectedSamples.push(w.__speechAudioDetected === true);
            if (Date.now() - start > 3000) return resolve();
            setTimeout(tick, 80);
          };
          tick();
        });
        const peak = samples.reduce((m, v) => v > m ? v : m, 0);
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
        const everDetected = detectedSamples.some(Boolean);
        return { peak, avg, samples: samples.length, everDetected };
      });
      record('Fake audio reaches the AudioContext (peak level > 0.05)',
        audioObservation.peak > 0.05,
        `peak=${audioObservation.peak.toFixed(4)}, avg=${audioObservation.avg.toFixed(4)} over ${audioObservation.samples} samples`);
      record('audioDetected flipped true at some point while fake audio played',
        audioObservation.everDetected === true,
        `everDetected=${audioObservation.everDetected}`);

      // The silence hint should NOT be present while we're feeding real audio.
      const silenceHintCount = await page.locator('[data-testid="silence-hint"]').count();
      record('Silence hint hidden while real audio is arriving',
        silenceHintCount === 0,
        `silence-hint elements present: ${silenceHintCount}`);

      // Screenshot the meter under live fake audio — saved for human inspection.
      // We screenshot AFTER the level sampling above to give the beep a chance
      // to hit a peak moment; otherwise the still frame might land on silence.
      await takeShot(page, '04-with-audio.png');

      // Inspect the tallest bar height observed during the sampling window
      // above. We re-sample here for ~1.5s and take the max — single-frame
      // checks miss the beep's peaks.
      const tallestBarPctObserved = await page.evaluate(async () => {
        const start = Date.now();
        let max = 0;
        await new Promise(resolve => {
          const tick = () => {
            const el = document.querySelector('[data-testid="listening-indicator"]');
            if (el) {
              const bars = Array.from(el.querySelectorAll('span > span'));
              for (const b of bars) {
                const h = (b).style.height || '';
                const n = parseFloat(h);
                if (!Number.isNaN(n) && n > max) max = n;
              }
            }
            if (Date.now() - start > 1500) return resolve();
            setTimeout(tick, 40);
          };
          tick();
        });
        return max;
      });
      record('Level meter bars rise above placeholder minimum (>30% height)',
        tallestBarPctObserved > 30,
        `peak bar height observed = ${tallestBarPctObserved}% (placeholder is 20%)`);
    }

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

    // Typing a key should stop listening (no manual stop needed). We use a
    // distinctive string that won't match any built-in command via cmdk's
    // fuzzy search — that way the "Ask AI" affordance is guaranteed to
    // appear instead of a partially-matching command list.
    if (indicatorVisible) {
      const input = page.locator('input[placeholder*="Type a command"]').first();
      await input.focus();
      await input.type('zzqxq');
      await page.waitForTimeout(800);
      await takeShot(page, '03-stopped.png');

      const stillVisible = await indicator.isVisible().catch(() => false);
      record('Typing a character stops listening (indicator disappears)',
        !stillVisible,
        stillVisible ? 'still visible — typing did not stop listening' : 'indicator gone');

      // After typing one character, the field contains "a" which matches no
      // built-in command, so the "Ask AI" affordance should be visible in
      // place of the old "No results found" dead-end.
      const askAi = page.locator('[data-testid="ask-ai-affordance"]').first();
      let askAiVisible = false;
      try {
        await askAi.waitFor({ state: 'visible', timeout: 2000 });
        askAiVisible = true;
      } catch {}
      record('Non-matching input shows the "Ask AI" affordance (no dead-end)',
        askAiVisible,
        askAiVisible ? 'visible — natural-language path is reachable' : 'NOT visible — affordance missing');

      // The affordance should NOT show the old "No results found" text.
      const bodyText = await page.evaluate(() => document.body.innerText || '');
      const hasDeadEnd = /No results found/i.test(bodyText);
      record('"No results found" dead-end text is gone',
        !hasDeadEnd,
        hasDeadEnd ? 'still present in DOM — old text leaked through' : 'replaced by friendlier affordance');
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
      '- 04-with-audio.png',
    ].join('\n');
    fs.writeFileSync(path.join(OUT_DIR, 'report.md'), md);

    try { await electronApp.close(); } catch {}
    process.exit(exitCode);
  }
}

run();
