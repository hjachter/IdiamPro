/**
 * ai-content-generate-fix-test.js — verifies the content-pane "AI" (generate
 * content) button no longer 500s with the opaque "Server Components render"
 * error.
 *
 * The bug: generateContentForNodeAction never forwarded the user's BYOK key
 * and bypassed the shared AI failover pipeline, so with the company key
 * intentionally off the server threw an unhandled error → generic 500.
 *
 * The fix: the action now forwards the BYOK key AND routes through
 * runAIWithFailover, so it either (a) generates content (on-device Ollama /
 * BYOK / metered company key), or (b) surfaces a friendly, actionable
 * guidance message — never a raw crash.
 *
 * This test drives the real button in Electron against the dev server and
 * asserts the crash string is GONE and we got a real outcome (generated text
 * OR friendly guidance). Exits non-zero on failure.
 */
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { prepareApp } = require('./_helpers');

const SCRATCH = '/private/tmp/claude-501/-Users-howardjachter/dc1a4cb9-7949-4c86-a6ad-521f02bacb84/scratchpad';
const SHOT = path.join(SCRATCH, 'ai-fix.png');
const REPORT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'ai-content-generate-fix');
fs.mkdirSync(REPORT_DIR, { recursive: true });
try { fs.mkdirSync(SCRATCH, { recursive: true }); } catch {}

let electronApp;
let page;

async function findMainWindow(app, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    for (const win of app.windows()) {
      try {
        const url = win.url();
        if (url.startsWith('devtools://')) continue;
        if (url.includes('localhost:9002')) return win;
      } catch { /* ignore */ }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Could not find main app window');
}

const results = [];
function record(name, pass, detail = '') { results.push({ name, pass: !!pass, detail }); }

// Dismiss any first-run modal (e.g. the "Keep your work safe" data-safety
// notice) whose backdrop otherwise intercepts clicks. Best-effort, looped.
async function dismissModals(page) {
  for (let i = 0; i < 6; i++) {
    const overlay = page.locator('div.fixed.inset-0.z-50[data-state="open"]');
    const blocking = await overlay.first().isVisible().catch(() => false);
    if (!blocking) return;
    const btn = page.locator(
      '[role="dialog"] button:has-text("Got it"), [role="dialog"] button:has-text("Continue"), ' +
      '[role="dialog"] button:has-text("I Agree"), [role="dialog"] button:has-text("Agree"), ' +
      '[role="dialog"] button:has-text("Close"), [role="dialog"] button:has-text("Dismiss")'
    );
    if ((await btn.count().catch(() => 0)) > 0) {
      await btn.first().click().catch(() => {});
    } else {
      await page.keyboard.press('Escape').catch(() => {});
    }
    await page.waitForTimeout(700);
  }
}

const CRASH_MARKERS = [
  'an error occurred in the server components render',
  'server components render',
  'application error: a server-side exception',
];

(async () => {
  try {
    electronApp = await electron.launch({
      args: [path.resolve(__dirname, '..')],
      env: { ...process.env, NODE_ENV: 'development' },
    });
    page = await findMainWindow(electronApp);
    // Auto-dismiss any native JS dialog (beforeunload on reload, confirm(), etc.)
    // so it never crashes the run with an uncaught ProtocolError.
    page.on('dialog', (d) => { d.dismiss().catch(() => {}); });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500);

    if (!page.url().includes('/app')) {
      await page.evaluate(() => { window.location.href = '/app'; });
      await page.waitForLoadState('domcontentloaded');
      await page.locator('button:has-text("New Outline")')
        .waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    }

    await prepareApp(page);
    await dismissModals(page);

    // Configure the exercised path: consent granted, CLOUD provider (so we go
    // through the server failover pipeline, NOT the pure local shortcut), and
    // NO BYOK key — the exact scenario that used to crash. The company key is
    // gated server-side; a signed-out test user can never reach it, so with
    // on-device Ollama up this generates locally, and without it we get the
    // friendly guidance message. Either proves the crash is fixed.
    // These are read at call-time by the client handler / consent check, so no
    // page reload is needed (and we avoid a beforeunload dialog).
    await page.evaluate(() => {
      try {
        localStorage.setItem('aiDataConsent', 'granted');
        localStorage.setItem('aiProvider', 'cloud');
        localStorage.removeItem('apiKey_gemini');
      } catch {}
    });

    // Fresh editable outline (User Guide is read-only and blocks AI).
    const newOutlineBtn = page.locator('button:has-text("New Outline")');
    await newOutlineBtn.first().waitFor({ state: 'visible', timeout: 20000 });
    await newOutlineBtn.first().click();
    await page.waitForTimeout(2000);
    record('new_outline_created',
      await page.locator('h1:has-text("Untitled Outline")').first().isVisible({ timeout: 5000 }).catch(() => false));

    // Select the root node so the content pane (with the AI button) is shown.
    const rootTitle = page.locator('h1:has-text("Untitled Outline")').first();
    await rootTitle.click().catch(() => {});
    await page.waitForTimeout(800);

    // The primary "AI" generate button in the content-pane toolbar.
    const aiButton = page.locator('button[aria-label="AI"]').first();
    let btnVisible = await aiButton.isVisible({ timeout: 8000 }).catch(() => false);
    if (!btnVisible) {
      // Try clicking into the editor first, then re-check.
      await page.locator('.ProseMirror, [contenteditable="true"]').first().click().catch(() => {});
      await page.waitForTimeout(500);
      btnVisible = await aiButton.isVisible({ timeout: 5000 }).catch(() => false);
    }
    record('ai_button_present', btnVisible);
    if (!btnVisible) throw new Error('AI generate button not found in content pane');

    // Capture editor text BEFORE.
    const beforeText = await page.locator('.ProseMirror, [contenteditable="true"]').first()
      .innerText().catch(() => '');

    // CLICK the generate button — this is the exact action that used to 500.
    await aiButton.click();

    // Wait up to ~60s for a real outcome: generated text grows the editor, OR a
    // toast / message with friendly guidance appears. Poll body text throughout
    // to catch (and fail on) any crash string the moment it would appear.
    let generated = false;
    let guidance = false;
    let crashed = false;
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const body = (await page.evaluate(() => document.body ? document.body.innerText : '').catch(() => '')).toLowerCase();
      if (CRASH_MARKERS.some((m) => body.includes(m))) { crashed = true; break; }
      if (body.includes('add your own api key') ||
          body.includes('cloud ai without your own key') ||
          body.includes('switch to on-device') ||
          body.includes("couldn't generate") ||
          body.includes('temporarily unavailable')) {
        guidance = true; break;
      }
      const now = await page.locator('.ProseMirror, [contenteditable="true"]').first()
        .innerText().catch(() => '');
      if (now && now.trim().length > (beforeText.trim().length + 15)) { generated = true; break; }
      await new Promise((r) => setTimeout(r, 1500));
    }

    // Final crash sweep.
    const finalBody = (await page.evaluate(() => document.body ? document.body.innerText : '').catch(() => '')).toLowerCase();
    if (CRASH_MARKERS.some((m) => finalBody.includes(m))) crashed = true;

    await page.screenshot({ path: SHOT, fullPage: false }).catch(() => {});
    await page.screenshot({ path: path.join(REPORT_DIR, 'ai-fix.png'), fullPage: false }).catch(() => {});

    record('no_server_components_crash', !crashed, crashed ? 'CRASH STRING PRESENT' : 'no crash string');
    record('real_outcome', generated || guidance,
      generated ? 'content generated' : guidance ? 'friendly guidance shown' : 'no outcome within timeout');

  } catch (err) {
    record('exception', false, String(err && err.message ? err.message : err));
    try { await page.screenshot({ path: SHOT }); } catch {}
  } finally {
    const passed = results.filter((r) => r.pass).length;
    const failed = results.length - passed;
    const ok = failed === 0;
    fs.writeFileSync(path.join(REPORT_DIR, 'report.json'),
      JSON.stringify({ passed, failed, total: results.length, results }, null, 2));
    console.log('\n# AI Content Generate Fix Test\n');
    console.log(`Result: ${ok ? 'PASS' : 'FAIL'} (${passed}/${results.length})\n`);
    for (const r of results) console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  ${r.detail}`);
    await Promise.race([
      electronApp ? electronApp.close().catch(() => {}) : Promise.resolve(),
      new Promise((r) => setTimeout(r, 5000)),
    ]);
    process.exit(ok ? 0 : 1);
  }
})();
