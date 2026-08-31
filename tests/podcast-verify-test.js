// ============================================================================
// Podcast FREE-PATH end-to-end verification (real dialog UI, own Electron)
// ----------------------------------------------------------------------------
// Drives the actual Export -> Podcast dialog through to a playable preview on
// the FREE macOS `say` path, with NO OpenAI spend and NO script-generation AI
// spend:
//
//   * The OpenAI key is forced absent in the LAUNCH env AND scrubbed inside the
//     Electron main process (this dev checkout has one in .env.local), so the
//     synth can only reach the free `say` engine — $0, no OpenAI TTS.
//   * The /api/generate-podcast-script route is MOCKED to return a tiny canned
//     script, so no text-generation AI (Gemini/Ollama) is called either — the
//     test is deterministic, fast, and spends nothing.
//
// It asserts the in-dialog <audio> player appears and reports a real duration,
// screenshotting each step to test-screenshots/podcast-verify/.
// ============================================================================

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const projectRoot = path.resolve(__dirname, '..');
const OUT_DIR = path.join(projectRoot, 'test-screenshots', 'podcast-verify');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Canned two-speaker script returned by the mocked route (no AI call).
const CANNED_SEGMENTS = [
  { speaker: 'Host A', voice: 'nova', text: 'Welcome to the show. Today we turn an outline into a quick podcast.' },
  { speaker: 'Host B', voice: 'onyx', text: 'And it all runs on your Mac for free, with no cloud key needed.' },
  { speaker: 'Host A', voice: 'nova', text: 'Two built-in voices, one finished audio file. Let us listen.' },
];

let electronApp, page;
const report = { suite: 'podcast-verify', startedAt: new Date().toISOString(), steps: [], pass: false };

function step(s) { report.steps.push(s); console.log('  • ' + s); }
async function shot(name) { try { await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: false }); } catch (e) { console.log('shot fail', name, e.message); } }
async function refocus() { try { execFileSync('osascript', ['-e', 'tell application "Terminal" to activate']); } catch {} }

async function findMainWindow(app, maxWait = 40000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    for (const win of app.windows()) {
      try { const url = win.url(); if (url.startsWith('devtools://')) continue; if (url.includes('localhost:9002')) return win; } catch {}
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Could not find main app window');
}

function writeReport() {
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  const md = [
    `# Podcast Verify (free-say E2E) — ${report.pass ? 'PASS' : 'FAIL'}`,
    '',
    'Drives the real Export → Podcast dialog to a playable preview on the free',
    'macOS `say` path. No OpenAI TTS, no script-generation AI — $0 spent.',
    '',
    '## Steps',
    ...report.steps.map((s) => `- ${s}`),
    '',
    report.error ? `## Error\n\n\`\`\`\n${report.error}\n\`\`\`\n` : '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), md);
}

async function main() {
  try {
    if (process.platform !== 'darwin') {
      step('Skipped: free `say` path is macOS-only.');
      report.skipped = true; report.pass = true; writeReport();
      console.log('SKIP (non-darwin)'); process.exit(0);
    }

    console.log('Launching Electron (own instance)...');
    electronApp = await electron.launch({
      args: [projectRoot],
      env: { ...process.env, NODE_ENV: 'development', OPENAI_API_KEY: '' },
    });

    // Scrub the OpenAI key inside the MAIN process (main.js re-loads .env.local
    // via dotenv at boot). After this, the synth cannot reach OpenAI at all.
    await electronApp.evaluate(() => { delete process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = ''; });
    step('OpenAI key forced absent in the main process (free path guaranteed, $0).');

    page = await findMainWindow(electronApp);
    page.on('dialog', async (d) => { try { await d.dismiss(); } catch {} });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    await page.setViewportSize({ width: 1440, height: 980 });

    // Mock the script-generation route so NO text AI is called ($0, deterministic).
    await page.route('**/api/generate-podcast-script', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ segments: CANNED_SEGMENTS }),
      });
    });
    step('Mocked /api/generate-podcast-script → canned 3-segment script (no AI spend).');

    if (!page.url().includes('/app')) {
      await page.evaluate(() => { window.location.href = '/app'; }).catch(() => {});
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }
    // Permissive dev state + NO BYOK keys of any kind → forced free path.
    await page.evaluate(() => {
      try {
        localStorage.setItem('discovery:professionalMode', 'true');
        localStorage.setItem('aiDataConsent', 'granted');
        localStorage.setItem('idiampro-tier-id', 'pro');
        localStorage.setItem('onboarding:welcomeShowcaseSeen', 'true');
        localStorage.setItem('onboarding:completed', 'true');
        localStorage.removeItem('apiKey_openai');
        localStorage.removeItem('apiKey_gemini');
      } catch {}
    });
    // Reload so the onboarding/welcome flags take hold and no modal covers the UI.
    await page.reload().catch(() => {});
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(2500);
    // Belt-and-suspenders: dismiss any residual modal overlay.
    for (let i = 0; i < 3; i++) {
      const overlay = await page.locator('div.fixed.inset-0.z-50').first().isVisible().catch(() => false);
      if (!overlay) break;
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(400);
    }

    // Wait for the app shell.
    const newBtn = page.locator('button:has-text("New Outline")').first();
    const deadline = Date.now() + 120000; let ready = false;
    while (Date.now() < deadline) {
      if (await newBtn.isVisible({ timeout: 1000 }).catch(() => false)) { ready = true; break; }
      if (!page.url().includes('/app')) { await page.evaluate(() => { window.location.href = '/app'; }).catch(() => {}); }
      await page.waitForTimeout(2000);
    }
    if (!ready) throw new Error('App shell (New Outline) never became visible');
    await page.waitForTimeout(1000);
    step('App shell ready.');
    await shot('01-app-ready');

    // Create a fresh outline with a little content so Export is enabled.
    await newBtn.click(); await page.waitForTimeout(1500);
    await page.locator('[role="treeitem"]').first().click().catch(() => {});
    await page.waitForTimeout(400);
    // Add two child nodes with text so there is real exportable content.
    for (const nm of ['Morning Routines for a Calm Start', 'Wake Early and Hydrate']) {
      await page.keyboard.press('Enter');
      const input = page.locator('input[type="text"]:visible').first();
      try { await input.waitFor({ state: 'visible', timeout: 4000 }); } catch {}
      await page.waitForTimeout(150); await input.fill(nm); await page.waitForTimeout(120);
      await page.keyboard.press('Enter'); await page.waitForTimeout(350);
    }
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    await page.locator('[role="treeitem"]').first().click().catch(() => {});
    await page.waitForTimeout(400);
    step('Created a small outline with content so Export is enabled.');
    await shot('01b-after-outline');

    // Open the outline Export menu. In the (narrow) outline pane the Export
    // button folds into the "More tools" (•••) overflow as an "Export" submenu,
    // so try the inline enabled Export button first, then the overflow path.
    const openExportMenu = async () => {
      // Inline enabled Export button (wide panes)?
      const inline = page.locator('[aria-label="Export"]');
      const n = await inline.count().catch(() => 0);
      for (let i = 0; i < n; i++) {
        const b = inline.nth(i);
        if (await b.isEnabled().catch(() => false) && await b.isVisible().catch(() => false)) {
          await b.click(); await page.waitForTimeout(400); return;
        }
      }
      // Overflow: More tools → Export submenu.
      const more = page.locator('[aria-label="More tools"]').first();
      await more.click(); await page.waitForTimeout(400);
      const exportSub = page.locator('[role="menuitem"]:has-text("Export")').first();
      await exportSub.hover().catch(() => {});
      await exportSub.click().catch(() => {});
      await page.waitForTimeout(600);
    };
    await openExportMenu();
    await page.locator('[role="menuitem"]:has-text("Export Current Outline")').first().click();
    await page.waitForTimeout(1000);
    await shot('02-export-gallery');

    // Click the Podcast tile.
    const tile = page.locator('button:has(span:text-is("Podcast"))').first();
    await tile.scrollIntoViewIfNeeded().catch(() => {});
    await tile.click(); await page.waitForTimeout(1200);
    const opened = await page.locator('text=Generate Podcast').first().isVisible().catch(() => false);
    if (!opened) throw new Error('Podcast dialog did not open');
    step('Podcast dialog opened.');
    await shot('03-podcast-config');

    // Quick generate (mocked script → edit-script phase with Generate Audio).
    const gen = page.locator('[role="dialog"] button', { hasText: /^Generate$/ }).first();
    await gen.click();
    let audioReady = false;
    const scriptDeadline = Date.now() + 30000;
    while (Date.now() < scriptDeadline) {
      if ((await page.locator('[role="dialog"] button:has-text("Generate Audio")').count().catch(() => 0)) > 0) { audioReady = true; break; }
      const errTxt = await page.locator('[role="dialog"] .text-destructive').first().textContent().catch(() => null);
      if (errTxt && errTxt.trim()) throw new Error('Script phase error: ' + errTxt.trim().slice(0, 140));
      await page.waitForTimeout(800);
    }
    if (!audioReady) throw new Error('Never reached the edit-script phase (Generate Audio button)');
    const segBoxes = await page.locator('[role="dialog"] textarea').count().catch(() => 0);
    step(`Edit-script phase reached — ${segBoxes} segment box(es) from the canned script.`);
    await shot('04-edit-script');

    // Generate Audio → FREE `say` synthesis in the main process.
    await page.locator('[role="dialog"] button:has-text("Generate Audio")').first().click();
    let hasAudio = false;
    const audioDeadline = Date.now() + 120000;
    while (Date.now() < audioDeadline) {
      if ((await page.locator('[role="dialog"] audio').count().catch(() => 0)) > 0) { hasAudio = true; break; }
      const errTxt = await page.locator('[role="dialog"] .text-destructive').first().textContent().catch(() => null);
      if (errTxt && errTxt.trim()) throw new Error('Audio phase error: ' + errTxt.trim().slice(0, 160));
      await page.waitForTimeout(1000);
    }
    if (!hasAudio) throw new Error('No <audio> player appeared in the preview');

    // Confirm the player has a real, playable source with a duration.
    const audioInfo = await page.evaluate(async () => {
      const a = document.querySelector('[role="dialog"] audio');
      if (!a) return { present: false };
      const src = a.getAttribute('src') || '';
      // Force metadata load so duration is available.
      let duration = a.duration;
      if (!(duration > 0)) {
        await new Promise((res) => {
          const done = () => res();
          a.addEventListener('loadedmetadata', done, { once: true });
          try { a.load(); } catch {}
          setTimeout(done, 4000);
        });
        duration = a.duration;
      }
      return { present: true, src: src.slice(0, 24), duration: Number.isFinite(duration) ? duration : 0 };
    }).catch(() => ({ present: true, duration: 0 }));

    report.audioInfo = audioInfo;
    step(`In-dialog audio player present. src=${audioInfo.src || 'blob'} durationSec=${audioInfo.duration}`);
    await shot('05-preview-audio');

    if (!audioInfo.present) throw new Error('Audio element missing after preview');
    // A blob URL is proof the free-path bytes were produced; duration confirms playability.
    if (!(audioInfo.duration > 0.5)) throw new Error(`Preview audio duration too short/unplayable: ${audioInfo.duration}s`);

    report.pass = true;
    console.log('PASS');
  } catch (err) {
    report.error = String((err && err.stack) || err);
    console.error('FAIL:', report.error);
    try { await shot('ERR-final'); } catch {}
  } finally {
    await refocus();
    if (electronApp) {
      await Promise.race([
        electronApp.close().catch(() => {}),
        new Promise((r) => setTimeout(r, 5000)),
      ]);
    }
    writeReport();
  }
  process.exit(report.pass ? 0 : 1);
}

main();
