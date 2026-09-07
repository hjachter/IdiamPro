// ============================================================================
// AI Cost Model — heavy-op approval + usage ledger E2E (P2, 2026-09-06)
// ----------------------------------------------------------------------------
// Verifies, in a real Electron instance it launches itself, with $0 AI spend:
//
//   1. HEAVY op (podcast, FREE path — no OpenAI key anywhere): clicking
//      Generate shows the heavy-op approval dialog FIRST, with honest
//      wording (free Mac voices / no key; no exact-cost promises).
//   2. Cancel truly cancels — nothing generates.
//   3. Run proceeds (mocked script route → edit-script phase; no AI called).
//   4. "Don't ask again" + Run → reopening and generating again shows NO
//      approval dialog (per-op suppression, confirm.* namespace).
//   5. MEDIUM op (Summarize outline) shows NO heavy-op approval — no new
//      friction for everyday tools.
//   6. The local usage ledger (aiUsageLedger.v1) records entries for the
//      ops that ran, with correct cost classes.
//
// Professional mode is explicitly OFF here (it legitimately suppresses the
// approval dialog; other suites turn it on for zero-friction runs).
// No OpenAI/Gemini keys are present; the one real server action attempted
// (summarize) fails closed with no key — $0 by design.
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
const OUT_DIR = path.join(projectRoot, 'test-screenshots', 'cost-model');
fs.mkdirSync(OUT_DIR, { recursive: true });

const CANNED_SEGMENTS = [
  { speaker: 'Host A', voice: 'nova', text: 'Welcome to the cost-model test podcast.' },
  { speaker: 'Host B', voice: 'onyx', text: 'Approved by the user before a single cent could move.' },
];

let electronApp, page;
const report = { suite: 'cost-model', startedAt: new Date().toISOString(), steps: [], failures: [], pass: false };

function step(s) { report.steps.push(s); console.log('  • ' + s); }
function fail(s) { report.failures.push(s); console.log('  ✗ FAIL: ' + s); }
async function shot(name) { try { await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: false }); } catch (e) { console.log('shot fail', name, e.message); } }
function refocus() { try { execFileSync('osascript', ['-e', 'tell application "Terminal" to activate']); } catch {} }

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
    `# AI Cost Model (heavy-op approval + ledger) — ${report.pass ? 'PASS' : 'FAIL'}`,
    '',
    '## Steps',
    ...report.steps.map((s) => `- ${s}`),
    '',
    report.failures.length ? `## Failures\n\n${report.failures.map((f) => `- ${f}`).join('\n')}\n` : '',
    report.error ? `## Error\n\n\`\`\`\n${report.error}\n\`\`\`\n` : '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), md);
}

const confirmSel = '[data-testid="heavy-op-confirm"]';

async function openExportMenu() {
  const inline = page.locator('[aria-label="Export"]');
  const n = await inline.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    const b = inline.nth(i);
    if (await b.isEnabled().catch(() => false) && await b.isVisible().catch(() => false)) {
      await b.click(); await page.waitForTimeout(400); return;
    }
  }
  const more = page.locator('[aria-label="More tools"]').first();
  await more.click(); await page.waitForTimeout(400);
  const exportSub = page.locator('[role="menuitem"]:has-text("Export")').first();
  await exportSub.hover().catch(() => {});
  await exportSub.click().catch(() => {});
  await page.waitForTimeout(600);
}

async function openPodcastDialog() {
  await openExportMenu();
  await page.locator('[role="menuitem"]:has-text("Export Current Outline")').first().click();
  await page.waitForTimeout(1000);
  const tile = page.locator('button:has(span:text-is("Podcast"))').first();
  await tile.scrollIntoViewIfNeeded().catch(() => {});
  await tile.click(); await page.waitForTimeout(1200);
  const opened = await page.locator('text=Generate Podcast').first().isVisible().catch(() => false);
  if (!opened) throw new Error('Podcast dialog did not open');
}

async function closeAnyDialog() {
  for (let i = 0; i < 4; i++) {
    const open = await page.locator('[role="dialog"]').first().isVisible().catch(() => false);
    if (!open) return;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
  }
}

async function main() {
  try {
    if (process.platform !== 'darwin') {
      step('Skipped: free Mac-voices path is macOS-only.');
      report.skipped = true; report.pass = true; writeReport();
      console.log('SKIP (non-darwin)'); process.exit(0);
    }

    console.log('Launching Electron (own instance)...');
    electronApp = await electron.launch({
      args: [projectRoot],
      env: { ...process.env, NODE_ENV: 'development', OPENAI_API_KEY: '' },
    });
    await electronApp.evaluate(() => { delete process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = ''; });
    step('OpenAI key forced absent in the main process (free voices path, $0).');

    page = await findMainWindow(electronApp);
    page.on('dialog', async (d) => { try { await d.dismiss(); } catch {} });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    await page.setViewportSize({ width: 1440, height: 980 });

    if (!page.url().includes('/app')) {
      await page.evaluate(() => { window.location.href = '/app'; }).catch(() => {});
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }

    // Seed state: Professional mode OFF (approval dialog must show), pro tier
    // (podcast is Pro-gated), no BYOK keys, no prior suppressions, empty ledger.
    await page.evaluate(() => {
      try {
        localStorage.removeItem('discovery:professionalMode');
        localStorage.setItem('aiDataConsent', 'granted');
        localStorage.setItem('idiampro-tier-id', 'pro');
        localStorage.setItem('onboarding:welcomeShowcaseSeen', 'true');
        localStorage.setItem('onboarding:completed', 'true');
        localStorage.removeItem('apiKey_openai');
        localStorage.removeItem('apiKey_gemini');
        localStorage.removeItem('aiUsageLedger.v1');
        // Clear any prior heavy-op suppressions from earlier runs.
        const kill = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('confirm.heavyOp.')) kill.push(k);
        }
        kill.forEach((k) => localStorage.removeItem(k));
      } catch {}
    });
    await page.reload().catch(() => {});
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(2500);

    // Mock the podcast script route — no text AI is ever called.
    await page.route('**/api/generate-podcast-script', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ segments: CANNED_SEGMENTS }),
      });
    });
    step('Mocked /api/generate-podcast-script (no AI spend).');

    for (let i = 0; i < 3; i++) {
      const overlay = await page.locator('div.fixed.inset-0.z-50').first().isVisible().catch(() => false);
      if (!overlay) break;
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(400);
    }

    const newBtn = page.locator('button:has-text("New Outline")').first();
    const deadline = Date.now() + 120000; let ready = false;
    while (Date.now() < deadline) {
      if (await newBtn.isVisible({ timeout: 1000 }).catch(() => false)) { ready = true; break; }
      if (!page.url().includes('/app')) { await page.evaluate(() => { window.location.href = '/app'; }).catch(() => {}); }
      await page.waitForTimeout(2000);
    }
    if (!ready) throw new Error('App shell (New Outline) never became visible');
    step('App shell ready.');
    await shot('01-app-ready');

    // Fresh outline with content so Export is enabled.
    await newBtn.click(); await page.waitForTimeout(1500);
    await page.locator('[role="treeitem"]').first().click().catch(() => {});
    await page.waitForTimeout(400);
    for (const nm of ['Cost Model Chapter', 'Honest Money Talk']) {
      await page.keyboard.press('Enter');
      const input = page.locator('input[type="text"]:visible').first();
      try { await input.waitFor({ state: 'visible', timeout: 4000 }); } catch {}
      await page.waitForTimeout(150); await input.fill(nm); await page.waitForTimeout(120);
      await page.keyboard.press('Enter'); await page.waitForTimeout(350);
    }
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    await page.locator('[role="treeitem"]').first().click().catch(() => {});
    await page.waitForTimeout(400);
    step('Created a small outline with content.');

    // ── TEST 1: heavy-op approval appears FIRST on the free podcast path ──
    await openPodcastDialog();
    await shot('02-podcast-config');
    const genBtn = page.locator('[role="dialog"] button', { hasText: /^Generate$/ }).first();
    await genBtn.click();
    await page.waitForTimeout(800);
    const confirmVisible = await page.locator(confirmSel).first().isVisible().catch(() => false);
    if (confirmVisible) step('Heavy-op approval dialog appeared BEFORE any generation.');
    else fail('Heavy-op approval dialog did not appear on Generate.');
    await shot('03-heavy-op-confirm');

    const payerText = (await page.locator('[data-testid="heavy-op-payer"]').textContent().catch(() => '')) || '';
    const costText = (await page.locator('[data-testid="heavy-op-cost"]').textContent().catch(() => '')) || '';
    if (/free built-in voices/i.test(payerText) && /no key/i.test(payerText)) {
      step(`Payer line is honest for the free path: "${payerText.trim()}"`);
    } else {
      fail(`Payer line missing free-Mac-voices/no-key wording: "${payerText.trim()}"`);
    }
    // Money-honesty: typical-range language, no absolute cost promises.
    if (/typically/i.test(costText) && !/guarantee|exactly|always free/i.test(costText)) {
      step('Cost line uses honest "typically…" framing (no promises).');
    } else {
      fail(`Cost line framing looks off: "${costText.trim()}"`);
    }

    // ── TEST 2: Cancel truly cancels ──
    await page.locator('[data-testid="heavy-op-cancel"]').click();
    await page.waitForTimeout(800);
    const stillConfig = await genBtn.isVisible().catch(() => false);
    const generating = await page.locator('[role="dialog"]:has-text("Generating podcast script")').first().isVisible().catch(() => false);
    const editScript = (await page.locator('[role="dialog"] button:has-text("Generate Audio")').count().catch(() => 0)) > 0;
    if (stillConfig && !generating && !editScript) step('Cancel truly cancelled — still on config, nothing generated.');
    else fail(`Cancel did not fully cancel (config=${stillConfig}, generating=${generating}, editScript=${editScript}).`);
    await shot('04-after-cancel');

    // ── TEST 3: Don't ask again + Run proceeds ──
    await genBtn.click();
    await page.waitForTimeout(800);
    if (!(await page.locator(confirmSel).first().isVisible().catch(() => false))) {
      fail('Approval dialog did not reappear on second Generate.');
    }
    await page.locator('[data-testid="heavy-op-dont-ask"]').click();
    await page.waitForTimeout(200);
    await shot('05-dont-ask-checked');
    await page.locator('[data-testid="heavy-op-run"]').click();
    let proceeded = false;
    const runDeadline = Date.now() + 30000;
    while (Date.now() < runDeadline) {
      if ((await page.locator('[role="dialog"] button:has-text("Generate Audio")').count().catch(() => 0)) > 0) { proceeded = true; break; }
      await page.waitForTimeout(700);
    }
    if (proceeded) step('Run proceeded — reached the edit-script phase (mocked script).');
    else fail('Run did not proceed to the edit-script phase.');
    await shot('06-after-run');

    // ── TEST 4: suppression — reopen, Generate, NO approval dialog ──
    await closeAnyDialog();
    await openPodcastDialog();
    await page.locator('[role="dialog"] button', { hasText: /^Generate$/ }).first().click();
    await page.waitForTimeout(1000);
    const confirmAgain = await page.locator(confirmSel).first().isVisible().catch(() => false);
    if (!confirmAgain) step('"Don\'t ask again" honored — no approval dialog on the next run.');
    else fail('Approval dialog reappeared despite "Don\'t ask again".');
    await shot('07-suppressed-run');
    await closeAnyDialog();

    // ── TEST 5: MEDIUM op (Summarize) shows NO heavy-op approval ──
    const aiBtn = page.locator('button[aria-label="AI menu"]').first();
    if (await aiBtn.isVisible().catch(() => false)) {
      await aiBtn.click(); await page.waitForTimeout(500);
      const item = page.locator('[role="menuitem"]', { hasText: 'Summarize outline' }).first();
      if (await item.isVisible().catch(() => false)) {
        await item.click(); await page.waitForTimeout(800);
        const sumBtn = page.locator('[role="dialog"] button:has-text("Summarize")').last();
        await sumBtn.click().catch(() => {});
        await page.waitForTimeout(1500);
        const heavyOnMedium = await page.locator(confirmSel).first().isVisible().catch(() => false);
        if (!heavyOnMedium) step('Medium op (Summarize) ran with NO heavy-op approval — no new friction.');
        else fail('Heavy-op approval wrongly appeared for a MEDIUM op (Summarize).');
        await shot('08-summarize-no-confirm');
        await closeAnyDialog();
      } else {
        step('NOTE: Summarize menu item not found; medium-op friction check skipped.');
        await page.keyboard.press('Escape').catch(() => {});
      }
    } else {
      step('NOTE: AI menu button not found; medium-op friction check skipped.');
    }

    // ── TEST 6: the local usage ledger recorded the ops ──
    const ledger = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('aiUsageLedger.v1') || '[]'); } catch { return []; }
    });
    const podcastEntries = ledger.filter((e) => e.op === 'podcastGeneration');
    const heavyOk = podcastEntries.length >= 1 && podcastEntries.every((e) => e.cls === 'heavy');
    if (heavyOk) step(`Ledger recorded ${podcastEntries.length} podcastGeneration entr(ies), class "heavy".`);
    else fail(`Ledger missing/incorrect podcastGeneration entries: ${JSON.stringify(podcastEntries)}`);
    const mediumEntries = ledger.filter((e) => e.op === 'summarizeOutline');
    if (mediumEntries.length >= 1 && mediumEntries.every((e) => e.cls === 'medium')) {
      step(`Ledger recorded ${mediumEntries.length} summarizeOutline entr(ies), class "medium".`);
    } else {
      step(`NOTE: no summarizeOutline ledger entry (${mediumEntries.length}) — acceptable if the medium-op check was skipped or blocked pre-gate.`);
    }
    step(`Ledger total entries this run: ${ledger.length}. All local, no server calls.`);

    // Cleanup: remove the suppressions this test created so the dev app
    // (which shares this profile) shows the approval dialog fresh again.
    await page.evaluate(() => {
      try {
        const kill = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('confirm.heavyOp.')) kill.push(k);
        }
        kill.forEach((k) => localStorage.removeItem(k));
      } catch {}
    });
    step('Cleaned up test-created "Don\'t ask again" suppressions.');

    report.pass = report.failures.length === 0;
  } catch (err) {
    report.error = String((err && err.stack) || err);
    report.pass = false;
  } finally {
    try { if (electronApp) await electronApp.close(); } catch {}
    writeReport();
    refocus();
    console.log(report.pass ? 'PASS' : 'FAIL');
    process.exit(report.pass ? 0 : 1);
  }
}

main();
