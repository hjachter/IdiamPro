// Fast regression: default (Gemini) text path still generates after the BYOK
// refactor. Default provider, consent granted, NO cloud key → the seam fails
// closed (no company billing) and the app falls over to on-device Ollama, which
// returns real content. Accept EITHER real generated content OR the friendly
// fail-closed guidance message (both prove the refactored path is intact and
// never silently bills a company key).
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { prepareApp, setElectronWindowSize } = require('./_helpers');

const REPORT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'byok-verify');
fs.mkdirSync(REPORT_DIR, { recursive: true });
let electronApp, page;

async function findMainWindow(app, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    for (const win of app.windows()) {
      try { const u = win.url(); if (!u.startsWith('devtools://') && u.includes('localhost:9002')) return win; } catch {}
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('main window not found');
}

(async () => {
  const out = {};
  try {
    electronApp = await electron.launch({ args: [path.resolve(__dirname, '..')], env: { ...process.env, NODE_ENV: 'development' } });
    page = await findMainWindow(electronApp);
    page.on('dialog', d => d.accept().catch(() => {}));
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500);
    if (!page.url().includes('/app')) {
      await page.evaluate(() => { window.location.href = '/app'; });
      await page.waitForLoadState('domcontentloaded');
      await page.locator('button:has-text("New Outline")').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    }
    await prepareApp(page);
    await setElectronWindowSize(electronApp, 1600, 1000);
    // Clear any launch-time modal overlay (upgrade/welcome/gate dialogs) so it
    // can't intercept clicks.
    for (let i = 0; i < 4; i++) {
      const overlay = await page.locator('.fixed.inset-0.z-50').count().catch(() => 0);
      if (overlay === 0) break;
      // Prefer clicking a visible close/dismiss control, else Escape.
      const close = page.locator('[role="dialog"] button[aria-label*="lose" i], [role="dialog"] button:has-text("Got it"), [role="dialog"] button:has-text("Skip"), [role="dialog"] button:has-text("Maybe later"), [role="dialog"] button:has-text("Not now")');
      if ((await close.count().catch(() => 0)) > 0) { await close.first().click().catch(() => {}); }
      else { await page.keyboard.press('Escape').catch(() => {}); }
      await page.waitForTimeout(500);
    }
    await page.evaluate(() => {
      try {
        localStorage.setItem('aiDataConsent', 'granted');
        localStorage.setItem('aiProvider', 'cloud');
        localStorage.removeItem('apiKey_gemini');
        localStorage.setItem('textProvider', 'gemini');
      } catch {}
    });
    // Fresh editable outline.
    const newBtn = page.locator('button:has-text("New Outline")');
    await newBtn.first().waitFor({ state: 'visible', timeout: 20000 });
    await newBtn.first().click();
    await page.waitForTimeout(1800);
    await page.locator('h1:has-text("Untitled Outline")').first().click().catch(() => {});
    await page.waitForTimeout(600);
    // Click into the editor so the content pane is active.
    await page.locator('.ProseMirror, [contenteditable="true"]').first().click().catch(() => {});
    await page.waitForTimeout(400);

    // The CONTENT-PANE AI split-button is the LAST aria-label="AI menu" (the
    // outline toolbar has its own earlier in the DOM).
    const aiMenus = page.locator('button[aria-label="AI menu"]');
    const cnt = await aiMenus.count().catch(() => 0);
    out.ai_menu_count = cnt;
    const aiButton = aiMenus.last();
    const btnVisible = await aiButton.isVisible({ timeout: 8000 }).catch(() => false);
    out.ai_button_present = btnVisible;
    const beforeText = await page.locator('.ProseMirror, [contenteditable="true"]').first().innerText().catch(() => '');
    await page.screenshot({ path: path.join(REPORT_DIR, 'gen-01-before.png') });
    if (btnVisible) {
      await aiButton.click();
      await page.waitForTimeout(500);
      await page.locator('[role="menuitem"]:has-text("Generate content")').first().click({ timeout: 5000 }).catch(() => {});
      // "Generate content" may open the "Expand with AI" prompt dialog first —
      // give it an instruction and Send (handled 2026-09-06).
      const promptBox = page.locator('[role="dialog"]:has-text("Expand with AI") textarea');
      if (await promptBox.first().isVisible({ timeout: 4000 }).catch(() => false)) {
        await promptBox.first().fill('Write 3 short bullet points about fruit.');
        await page.locator('[role="dialog"] button:has-text("Send")').first().click().catch(() => {});
      }
    }

    const CRASH = ['internal server error', 'unhandledrejection', 'is not a function', 'cannot read propert'];
    const GUIDANCE = ['add your own api key', 'cloud ai without your own key', 'switch to on-device', "couldn't generate", 'temporarily unavailable', 'add your key'];
    let generated = false, guidance = false, crashed = false;
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      const body = (await page.evaluate(() => document.body ? document.body.innerText : '').catch(() => '')).toLowerCase();
      if (CRASH.some(m => body.includes(m))) { crashed = true; break; }
      if (GUIDANCE.some(m => body.includes(m))) { guidance = true; break; }
      // The unified Proposed Changes review engine (2026-09) holds generated
      // content in a "Review new content" dialog until the user approves —
      // nothing lands in the editor on its own. Approve through the gate,
      // then confirm the content really commits (updated 2026-09-06).
      if (body.includes('review new content')) {
        await page.locator('[role="dialog"] button:has-text("Approve")').first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1500);
        const committed = await page.locator('.ProseMirror, [contenteditable="true"]').first().innerText().catch(() => '');
        generated = !!committed && committed.trim().length > beforeText.trim().length + 15;
        break;
      }
      // Same engine, "Expand with AI" flavor: the response lands in an
      // "AI Response" panel with a "Save to Node" commit button.
      const saveBtn = page.locator('[role="dialog"] button:has-text("Save to Node")');
      if (body.includes('ai response') && (await saveBtn.count().catch(() => 0)) > 0) {
        await saveBtn.first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(600);
        // Split-button: the click can open a placement menu — choose Append.
        const appendItem = page.locator('[role="menuitem"]:has-text("Append")');
        if ((await appendItem.count().catch(() => 0)) > 0) {
          await appendItem.first().click().catch(() => {});
        }
        await page.waitForTimeout(1500);
        const committed = await page.locator('.ProseMirror, [contenteditable="true"]').first().innerText().catch(() => '');
        generated = !!committed && committed.trim().length > beforeText.trim().length + 15;
        break;
      }
      const now = await page.locator('.ProseMirror, [contenteditable="true"]').first().innerText().catch(() => '');
      if (now && now.trim().length > beforeText.trim().length + 15) { generated = true; break; }
      await new Promise(r => setTimeout(r, 1500));
    }
    await page.screenshot({ path: path.join(REPORT_DIR, 'gen-02-after.png') });
    out.crashed = crashed; out.generated = generated; out.guidance = guidance;
    out.pass = btnVisible && !crashed && (generated || guidance);
    fs.writeFileSync(path.join(REPORT_DIR, 'gen-report.json'), JSON.stringify(out, null, 2));
    console.log('GEN REGRESSION:', JSON.stringify(out));
    await electronApp.close().catch(() => {});
    process.exit(out.pass ? 0 : 1);
  } catch (err) {
    console.error('FATAL', err.message);
    out.fatal = err.message;
    try { fs.writeFileSync(path.join(REPORT_DIR, 'gen-report.json'), JSON.stringify(out, null, 2)); } catch {}
    try { await electronApp.close(); } catch {}
    process.exit(2);
  }
})();
