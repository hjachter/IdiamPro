// BYOK text-generation-provider verification suite.
// Verifies: (1) Settings "Text generation model" picker exists + defaults to
// Google Gemini and persists a selection across reopen; (2) Claude/Mistral/Groq
// no longer show a "Coming soon" state in the key list; (3) a real Smart Tool
// generation on the DEFAULT path still returns content after the refactor.
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { prepareApp, openSettings, setElectronWindowSize } = require('./_helpers');

const REPORT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'byok-verify');
fs.mkdirSync(REPORT_DIR, { recursive: true });

let electronApp, page;
const results = [];
function record(name, passed, details) {
  results.push({ name, passed: !!passed, details: details || {} });
  console.log(`  ${passed ? '✓' : '✗'} ${name}${details ? ' — ' + JSON.stringify(details) : ''}`);
}

async function findMainWindow(app, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    for (const win of app.windows()) {
      try {
        const url = win.url();
        if (url.startsWith('devtools://')) continue;
        if (url.includes('localhost:9002')) return win;
      } catch {}
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('main window not found');
}

async function openAISettings() {
  await page.evaluate(() => {
    const btn = document.querySelector('[data-settings-trigger]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(500);
  await page.locator('[data-testid="settings-nav-ai"]').click({ force: true }).catch(() => {});
  await page.waitForTimeout(500);
}
async function closeSettings() {
  // Press Escape (may first close an open Select popup, then the dialog) and
  // wait until the modal overlay is actually gone so it can't intercept clicks.
  for (let i = 0; i < 3; i++) {
    const overlay = await page.locator('.fixed.inset-0.z-50').count().catch(() => 0);
    const dlg = await page.locator('[role="dialog"]').count().catch(() => 0);
    if (overlay === 0 && dlg === 0) break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
  }
  await page.waitForTimeout(200);
}

async function reloadApp() {
  await page.evaluate(() => { window.location.href = '/app'; });
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.locator('button:has-text("New Outline")').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  await prepareApp(page);
  await page.waitForTimeout(500);
}

(async () => {
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
    await setElectronWindowSize(electronApp, 1500, 950);
    await page.waitForTimeout(500);

    // ---- 1. Picker exists + default label ----
    await openAISettings();
    // scroll the picker into view
    await page.locator('label:has-text("Text generation model")').scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(REPORT_DIR, '01-picker-default.png'), fullPage: false });
    const pickerLabel = await page.locator('label:has-text("Text generation model")').isVisible({ timeout: 4000 }).catch(() => false);
    record('picker_label_present', pickerLabel);
    const trigger = page.locator('[role="dialog"]').locator('button:has-text("Google Gemini")').first();
    const defaultText = await trigger.innerText().catch(() => '');
    record('picker_defaults_to_gemini', /gemini/i.test(defaultText), { defaultText });

    // ---- 2. Coming-soon removed for anthropic/mistral/groq ----
    // Grab, for each provider card, whether a "Coming soon" badge is present.
    const comingSoon = await page.evaluate(() => {
      const out = {};
      const names = { 'Anthropic Claude': 'anthropic', 'Mistral AI': 'mistral', 'Groq': 'groq' };
      const labels = Array.from(document.querySelectorAll('label'));
      for (const [display, key] of Object.entries(names)) {
        const lbl = labels.find(l => l.textContent && l.textContent.trim() === display);
        if (!lbl) { out[key] = 'label-not-found'; continue; }
        const card = lbl.closest('.rounded-lg') || lbl.parentElement;
        out[key] = card ? /coming soon/i.test(card.textContent || '') : 'no-card';
      }
      return out;
    });
    record('anthropic_no_coming_soon', comingSoon.anthropic === false, { v: comingSoon.anthropic });
    record('mistral_no_coming_soon', comingSoon.mistral === false, { v: comingSoon.mistral });
    record('groq_no_coming_soon', comingSoon.groq === false, { v: comingSoon.groq });

    // ---- 3. Persistence: store an anthropic key BEFORE the dialog mounts
    // (settings reads keys on mount), reload, then the premium option appears;
    // pick it, reload, confirm it stuck. ----
    await closeSettings();
    await page.evaluate(() => {
      try { window.localStorage.setItem('apiKey_anthropic', 'sk-ant-fake-verify-key'); } catch {}
    });
    await reloadApp();
    await openAISettings();
    await page.locator('label:has-text("Text generation model")').scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);
    // Open the select and choose the Anthropic option.
    const sel = page.locator('[role="dialog"]').locator('button:has-text("Google Gemini")').first();
    await sel.click().catch(() => {});
    await page.waitForTimeout(500);
    const anthropicOpt = page.locator('[role="option"]:has-text("Anthropic")');
    const optVisible = await anthropicOpt.first().isVisible({ timeout: 3000 }).catch(() => false);
    record('premium_option_appears_with_key', optVisible);
    if (optVisible) { await anthropicOpt.first().click().catch(() => {}); }
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(REPORT_DIR, '02-anthropic-selected.png'), fullPage: false });
    const storedChoice = await page.evaluate(() => window.localStorage.getItem('textProvider'));
    record('selection_persisted_to_localstorage', storedChoice === 'anthropic', { storedChoice });
    // Reload and confirm the trigger reflects it (read-on-mount persistence).
    await closeSettings();
    await reloadApp();
    await openAISettings();
    await page.locator('label:has-text("Text generation model")').scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(400);
    const afterReopen = await page.locator('[role="dialog"]').locator('button:has-text("Anthropic")').first().isVisible({ timeout: 3000 }).catch(() => false);
    record('selection_survives_reopen', afterReopen);
    await page.screenshot({ path: path.join(REPORT_DIR, '03-after-reopen.png'), fullPage: false });

    // Reset to default gemini + remove the fake key before the generation test.
    await page.evaluate(() => {
      try {
        window.localStorage.removeItem('apiKey_anthropic');
        window.localStorage.setItem('textProvider', 'gemini');
      } catch {}
    });
    await closeSettings();

    // ---- 4. Real Smart Tool generation on the DEFAULT path ----
    // Default (Gemini) provider, consent granted, NO cloud key → the seam fails
    // closed (no company billing) and the app falls over to on-device Ollama,
    // which returns real content. Proves the refactored flow still generates.
    await page.evaluate(() => {
      try {
        localStorage.setItem('aiDataConsent', 'granted');
        localStorage.setItem('aiProvider', 'cloud');
        localStorage.removeItem('apiKey_gemini');
        localStorage.setItem('textProvider', 'gemini');
      } catch {}
    });
    const newBtn = page.locator('button:has-text("New Outline")');
    await newBtn.first().waitFor({ state: 'visible', timeout: 20000 });
    await newBtn.first().click();
    await page.waitForTimeout(1800);
    const rootTitle = page.locator('h1:has-text("Untitled Outline")').first();
    await rootTitle.click().catch(() => {});
    await page.waitForTimeout(700);
    // The content-pane AI control is a split-button (aria-label="AI menu"); the
    // generate action is the "Generate content" item inside its dropdown.
    const aiButton = page.locator('button[aria-label="AI menu"]').first();
    let btnVisible = await aiButton.isVisible({ timeout: 8000 }).catch(() => false);
    if (!btnVisible) {
      await page.locator('.ProseMirror, [contenteditable="true"]').first().click().catch(() => {});
      await page.waitForTimeout(500);
      btnVisible = await aiButton.isVisible({ timeout: 5000 }).catch(() => false);
    }
    record('ai_button_present', btnVisible);
    const beforeText = await page.locator('.ProseMirror, [contenteditable="true"]').first().innerText().catch(() => '');
    await page.screenshot({ path: path.join(REPORT_DIR, '04-before-generate.png'), fullPage: false });
    if (btnVisible) {
      await aiButton.click();
      await page.waitForTimeout(500);
      const genItem = page.locator('[role="menuitem"]:has-text("Generate content"), [role="menuitem"]:has-text("Generate")').first();
      await genItem.click({ timeout: 5000 }).catch(() => {});
      // "Generate content" may open the "Expand with AI" prompt dialog first —
      // give it an instruction and Send (aligned with the unified Proposed
      // Changes review engine, 2026-09-06).
      const promptBox = page.locator('[role="dialog"]:has-text("Expand with AI") textarea');
      if (await promptBox.first().isVisible({ timeout: 4000 }).catch(() => false)) {
        await promptBox.first().fill('Write 3 short bullet points about fruit.');
        await page.locator('[role="dialog"] button:has-text("Send")').first().click().catch(() => {});
      }
    }

    const CRASH = ['500', 'internal server error', 'unhandledrejection', 'is not a function', 'cannot read propert'];
    let generated = false, crashed = false, topicDialogSubmitted = false, reviewCommitted = false;
    const beforeBodyLen = (await page.evaluate(() => document.body ? document.body.innerText.length : 0).catch(() => 0));
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      const body = (await page.evaluate(() => document.body ? document.body.innerText : '').catch(() => '')).toLowerCase();
      if (CRASH.some(m => body.includes(m))) { crashed = true; break; }
      // The outline-toolbar AI menu's generate action opens the "Generate
      // Suboutline from Topic" wizard — submit it once (2026-09-06).
      if (!topicDialogSubmitted && body.includes('generate suboutline from topic')) {
        await page.locator('[role="dialog"] button:has-text("Generate")').first().click({ timeout: 5000 }).catch(() => {});
        topicDialogSubmitted = true;
        await page.waitForTimeout(1500);
        continue;
      }
      // Generated nodes arrive as a provisional proposal — commit via "Add",
      // then judge success by the outline tree actually growing.
      if (!reviewCommitted && (body.includes('until you choose add') || body.includes('nothing is added until you'))) {
        const addBtn = page.locator('button:has-text("Add")').last();
        if (await addBtn.isVisible().catch(() => false)) {
          await addBtn.click().catch(() => {});
          reviewCommitted = true;
          await page.waitForTimeout(1500);
          const afterBodyLen = (await page.evaluate(() => document.body ? document.body.innerText.length : 0).catch(() => 0));
          generated = afterBodyLen > beforeBodyLen + 60;
          break;
        }
      }
      // Unified review engine: content is held for approval, not auto-inserted.
      if (body.includes('review new content')) {
        await page.locator('[role="dialog"] button:has-text("Approve")').first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1500);
        const committed = await page.locator('.ProseMirror, [contenteditable="true"]').first().innerText().catch(() => '');
        generated = !!committed && committed.trim().length > beforeText.trim().length + 15;
        break;
      }
      const saveBtn = page.locator('[role="dialog"] button:has-text("Save to Node")');
      if (body.includes('ai response') && (await saveBtn.count().catch(() => 0)) > 0) {
        await saveBtn.first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(600);
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
    await page.screenshot({ path: path.join(REPORT_DIR, '05-after-generate.png'), fullPage: false });
    record('no_crash_during_generation', !crashed, { crashed });
    record('default_path_generated_content', generated, { generated });

    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const report = { suite: 'byok-textprovider-verify', passed, total, allPassed: passed === total, results };
    fs.writeFileSync(path.join(REPORT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`\nBYOK VERIFY: ${passed}/${total} passed`);
    await electronApp.close().catch(() => {});
    process.exit(passed === total ? 0 : 1);
  } catch (err) {
    console.error('FATAL', err.message);
    try { fs.writeFileSync(path.join(REPORT_DIR, 'report.json'), JSON.stringify({ fatal: err.message, results }, null, 2)); } catch {}
    try { await electronApp.close(); } catch {}
    process.exit(2);
  }
})();
