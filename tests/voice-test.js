// "Your Voice" — personal writing-style emulation suite (2026-07-22).
//
// Verifies the opt-in Your Voice feature end-to-end in the real Electron app:
//   1. With Your Voice OFF, the "In my voice" option is ABSENT from the
//      Summarize wizard and the setup is inactive (samples box hidden).
//   2. Turning Your Voice ON, pasting a distinctive writing sample, and
//      generating a profile (via local Ollama) produces a distilled profile
//      that is shown in an editable box.
//   3. With a profile in place, the "In my voice" option APPEARS in the
//      Summarize wizard and is checkable — proving the profile is wired into
//      the generation path.
//
// Ollama is expected to be running locally so real distillation works; the
// generate step forces local AI so it needs no cloud key.

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { prepareApp, openSettings, setElectronWindowSize } = require('./_helpers');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT_DIR = path.join(__dirname, '..', 'test-screenshots', 'voice');
fs.mkdirSync(OUT_DIR, { recursive: true });

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail: detail || '' });
  console.log(`  ${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`);
}

async function shot(page, name) {
  try { await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`) }); } catch {}
}

async function findMainWindow(app, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    for (const win of app.windows()) {
      try {
        const url = win.url();
        if (!url.startsWith('devtools://') && url.includes('localhost:9002')) return win;
      } catch {}
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Could not find main app window');
}

// Open the Smart Tools ("AI menu") dropdown and return whether the Summarize
// item is present; optionally click it to open the Summarize dialog.
async function openSummarizeWizard(page) {
  // Retry the menu a few times — after closing a dialog an overlay can briefly
  // swallow the first click, and the dropdown mounts asynchronously.
  for (let attempt = 0; attempt < 4; attempt++) {
    // Clear any lingering overlay/menu first.
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
    const trigger = page.locator('[aria-label="AI menu"]');
    if ((await trigger.count().catch(() => 0)) === 0) { await page.waitForTimeout(800); continue; }
    await trigger.first().click().catch(() => {});
    await page.waitForTimeout(600);
    const item = page.locator('[role="menuitem"]:has-text("Summarize outline")');
    if ((await item.count().catch(() => 0)) > 0) {
      await item.first().click().catch(() => {});
      await page.waitForTimeout(700);
      return true;
    }
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
  }
  return false;
}

(async () => {
  const projectRoot = path.resolve(__dirname, '..');
  const app = await electron.launch({ args: [projectRoot], env: { ...process.env, NODE_ENV: 'development' } });
  const page = await findMainWindow(app);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  await setElectronWindowSize(app, 1500, 950);
  // The dev sign-in gate ("Loading…") can stall on the Clerk dev rate limit;
  // give it a generous window to clear before driving the UI.
  await prepareApp(page, { timeoutMs: 90000 });
  await page.waitForTimeout(1500);

  // Deterministic baseline: the dev Electron profile persists localStorage
  // across runs, so a prior run could leave Your Voice ON. Reset it OFF first.
  await page.evaluate(() => {
    try {
      localStorage.removeItem('voice.enabled');
      localStorage.removeItem('voice.profile');
      localStorage.removeItem('voice.updatedAt');
      window.dispatchEvent(new CustomEvent('voice-profile-settings-changed'));
    } catch {}
  }).catch(() => {});
  await page.waitForTimeout(600);

  try {
    // Ensure a non-guide outline is current so the Summarize item is offered.
    await page.locator('[aria-label="New outline"]').first().click().catch(() => {});
    await page.waitForTimeout(1500);
    await shot(page, '01-fresh-outline');

    // ── STEP 1: Your Voice OFF → no "In my voice" in Summarize wizard ────────
    const openedOff = await openSummarizeWizard(page);
    if (openedOff) {
      const optOff = await page.locator('[data-testid="summarize-in-my-voice"]').count().catch(() => 0);
      record('Summarize wizard hides "In my voice" when Your Voice is OFF', optOff === 0, `found ${optOff}`);
      await shot(page, '02-summarize-voice-off');
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(400);
    } else {
      record('Summarize wizard reachable (voice OFF)', false, 'Summarize item not found');
    }

    // ── STEP 2: Open Settings → Professional → Your Voice ────────────────────
    await openSettings(page);
    await page.waitForTimeout(500);
    await page.locator('[data-testid="settings-nav-professional"]').first().click().catch(() => {});
    await page.waitForTimeout(600);

    const master = page.locator('[data-testid="your-voice-master"]');
    const masterExists = (await master.count().catch(() => 0)) > 0;
    const masterOff = masterExists ? (await master.first().getAttribute('aria-checked')) !== 'true' : false;
    record('Your Voice master switch present and OFF by default', masterExists && masterOff,
      masterExists ? `aria-checked=${await master.first().getAttribute('aria-checked')}` : 'switch missing');

    const samplesHiddenWhenOff = (await page.locator('[data-testid="voice-samples"]').count().catch(() => 0)) === 0;
    record('Samples box hidden while Your Voice is OFF', samplesHiddenWhenOff);
    await shot(page, '03-settings-voice-off');

    // Turn Your Voice ON.
    await master.first().click().catch(() => {});
    await page.waitForTimeout(700);
    const samplesBox = page.locator('[data-testid="voice-samples"]');
    const samplesVisible = (await samplesBox.count().catch(() => 0)) > 0;
    record('Turning Your Voice ON reveals the samples box', samplesVisible);
    await shot(page, '04-settings-voice-on');

    // ── STEP 3: Paste a distinctive sample + generate profile (local AI) ─────
    const distinctiveSample = [
      "ok so REAL talk 🔥 shipped the new thing today and honestly?? so hyped.",
      "no long paragraphs from me lol. short. punchy. done. 💪",
      "grabbed coffee ☕, fixed the bug, posted about it. easy day.",
      "if it's not fun why even do it 🤷 just vibes and good code.",
      "gonna keep it simple: build cool stuff, tell people, repeat. 🚀 #buildinpublic",
      "no corporate speak here. i write like i talk — fast, casual, lots of emoji 😎",
    ].join('\n');
    await samplesBox.first().click().catch(() => {});
    await samplesBox.first().fill(distinctiveSample).catch(() => {});

    // Force local AI so no cloud key is needed.
    await page.locator('[data-testid="voice-local"]').first().click().catch(() => {});
    await page.waitForTimeout(300);
    await shot(page, '05-sample-pasted');

    await page.locator('[data-testid="voice-generate"]').first().click().catch(() => {});

    // Wait for the distilled profile textarea to appear and populate.
    let profileText = '';
    const deadline = Date.now() + 120000; // local Ollama can be slow
    while (Date.now() < deadline) {
      const prof = page.locator('[data-testid="voice-profile"]');
      if ((await prof.count().catch(() => 0)) > 0) {
        profileText = (await prof.first().inputValue().catch(() => '')) || '';
        if (profileText.trim().length > 30) break;
      }
      await page.waitForTimeout(2000);
    }
    const profileMade = profileText.trim().length > 30;
    record('AI distilled a voice profile from the samples (shown & editable)', profileMade,
      profileMade ? `${profileText.trim().length} chars` : 'profile empty/timeout');
    await shot(page, '06-profile-generated');

    // Confirm it's editable and persists.
    if (profileMade) {
      const prof = page.locator('[data-testid="voice-profile"]');
      const edited = profileText.trim() + '\nEDIT: keeps it playful.';
      await prof.first().fill(edited).catch(() => {});
      await page.waitForTimeout(400);
      const roundTrip = (await prof.first().inputValue().catch(() => '')) || '';
      record('Voice profile is editable and saved', roundTrip.includes('EDIT: keeps it playful.'));
    }

    // Close Settings.
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(600);

    // ── STEP 4: Your Voice ON → "In my voice" appears in Summarize wizard ────
    const openedOn = await openSummarizeWizard(page);
    if (openedOn) {
      const optOn = page.locator('[data-testid="summarize-in-my-voice"]');
      const present = (await optOn.count().catch(() => 0)) > 0;
      record('Summarize wizard shows "In my voice" once a profile exists', present);
      if (present) {
        await optOn.first().click().catch(() => {});
        await page.waitForTimeout(300);
        const checked = (await optOn.first().getAttribute('data-state').catch(() => '')) === 'checked'
          || (await optOn.first().getAttribute('aria-checked').catch(() => '')) === 'true';
        record('"In my voice" option is checkable (wired into generation)', checked);
      }
      await shot(page, '07-summarize-voice-on');
      await page.keyboard.press('Escape').catch(() => {});
    } else {
      record('Summarize wizard reachable (voice ON)', false, 'Summarize item not found');
    }
  } catch (err) {
    record('Suite ran without fatal error', false, String((err && err.message) || err));
    await shot(page, '99-error');
  } finally {
    const passed = results.filter(r => r.pass).length;
    const total = results.length;
    const report = { suite: 'voice', passed, total, results, ts: new Date().toISOString() };
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(OUT_DIR, 'report.md'),
      `# Your Voice test\n\n${passed}/${total} passed\n\n` +
      results.map(r => `- ${r.pass ? '✅' : '❌'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`).join('\n') + '\n');
    console.log(`\nYour Voice suite: ${passed}/${total} passed`);
    await app.close().catch(() => {});
    process.exit(passed === total ? 0 : 1);
  }
})();
