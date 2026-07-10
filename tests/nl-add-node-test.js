// tests/nl-add-node-test.js
//
// Verifies the Tell-AI natural-language command bar can now ADD A NODE
// (the new create_node action), end to end:
//
//   1. Open the command bar (Cmd+K / toolbar).
//   2. "create an outline called ZZ TEST safe to delete"  -> a throwaway outline.
//   3. "add a node called Hello"                          -> create_node action.
//   4. Assert a node literally named "Hello" appears in the current outline,
//      and the friendly "Added a node" confirmation shows.
//
// DATA SAFETY: this test only ever creates a NEW throwaway outline named
// "ZZ TEST safe to delete" and works inside it. It never touches or mutates
// any pre-existing outline. It does NOT delete anything.
//
// Writes screenshots + report.json + report.md to test-screenshots/nl-add-node/.
// Exits non-zero on any assertion failure.

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

// During teardown, Playwright's auto-dialog handler can race the page closing
// (a benign beforeunload confirm). Swallow that specific rejection so it can't
// kill the process before the report is written.
process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'nl-add-node');
fs.mkdirSync(OUT_DIR, { recursive: true });

const TEST_OUTLINE = 'ZZ TEST safe to delete';
const TEST_NODE = 'Hello';

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
    for (const win of electronApp.windows()) {
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
  try {
    await page.screenshot({ path: path.join(OUT_DIR, file), fullPage: false });
    console.log(`  screenshot: ${file}`);
  } catch (e) {
    console.log(`  screenshot ${file} failed: ${e.message}`);
  }
}

async function openCommandPalette(page) {
  // The command palette opens with Cmd+K. Retry a couple times in case focus
  // isn't yet on the app body.
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await page.keyboard.press('Meta+k');
      await page.waitForTimeout(500);
      const input = page.locator('input[placeholder*="Type a command"]').first();
      if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
        return 'shortcut';
      }
    } catch {}
    await page.waitForTimeout(500);
  }
  throw new Error('Command palette (Cmd+K) never opened.');
}

// Type a phrase into the command bar and submit it via the "Tell AI" affordance,
// then wait for the palette to close and the AI action to resolve.
async function tellAI(page, phrase) {
  // Make sure we're not trapped inside a node editor before firing Cmd+K.
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(200);
  await openCommandPalette(page);
  const input = page.locator('input[placeholder*="Type a command"]').first();
  await input.click();
  await input.fill(phrase);
  await page.waitForTimeout(300);
  const affordance = page.locator('[data-testid="ask-ai-affordance"]').first();
  await affordance.waitFor({ state: 'visible', timeout: 5000 });
  await affordance.click();
  // AI round-trip to Gemini + state update.
  await page.waitForTimeout(6000);
}

async function run() {
  console.log('\n--- nl-add-node-test ---');
  console.log(`Started: ${new Date().toLocaleString()}`);

  const projectRoot = path.resolve(__dirname, '..');
  const electronApp = await electron.launch({
    args: [projectRoot],
    env: { ...process.env, NODE_ENV: 'development' },
  });

  let exitCode = 0;
  try {
    const page = await findMainWindow(electronApp);
    console.log('Main window:', page.url());

    page.on('dialog', async (d) => { try { await d.dismiss(); } catch {} });

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    if (!page.url().includes('/app')) {
      await page.evaluate(() => { window.location.href = '/app'; });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
    }

    // Professional mode suppresses confirmation dialogs so the flow is clean.
    await page.evaluate(() => {
      try { window.localStorage.setItem('discovery:professionalMode', 'true'); } catch {}
    });

    // Wait for the app shell to render — the sidebar "New Outline" button is a
    // reliable readiness signal. Cold boot loads all outlines from disk and can
    // sit on a "Loading…" screen for a while, so poll patiently and reload once
    // if it stalls. Capture diagnostics if it never comes up.
    const readyBtn = page.locator('button:has-text("New Outline")').first();
    let ready = false;
    const readyDeadline = Date.now() + 150000;
    let reloadedOnce = false;
    while (Date.now() < readyDeadline) {
      if (await readyBtn.isVisible({ timeout: 1000 }).catch(() => false)) { ready = true; break; }
      // If still stuck on the loading screen after ~40s, force one reload.
      if (!reloadedOnce && Date.now() > readyDeadline - 110000) {
        const stillLoading = await page.evaluate(() => /Loading/i.test(document.body.innerText || '')).catch(() => false);
        if (stillLoading) {
          reloadedOnce = true;
          await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
          await page.waitForTimeout(3000);
        }
      }
      await page.waitForTimeout(2000);
    }
    if (!ready) {
      await takeShot(page, '00-not-ready.png');
      const snap = await page.evaluate(() => ({
        url: location.href,
        title: document.title,
        body: (document.body.innerText || '').slice(0, 800),
        btns: Array.from(document.querySelectorAll('button')).map(b => (b.innerText || b.getAttribute('aria-label') || '').trim()).filter(Boolean).slice(0, 40),
      }));
      console.log('DIAG url:', snap.url);
      console.log('DIAG title:', snap.title);
      console.log('DIAG body:', snap.body.replace(/\n+/g, ' | '));
      console.log('DIAG btns:', JSON.stringify(snap.btns));
      throw new Error('App shell (New Outline) never became visible.');
    }
    await page.waitForTimeout(1500);
    await takeShot(page, '01-app-ready.png');

    // Step 1 — create the throwaway test outline via the command bar.
    await tellAI(page, `create an outline called ${TEST_OUTLINE}`);
    await takeShot(page, '02-outline-created.png');
    const outlineVisible = await page.getByText(TEST_OUTLINE, { exact: false }).first()
      .isVisible({ timeout: 5000 }).catch(() => false);
    record('Throwaway test outline created via command bar', outlineVisible,
      outlineVisible ? `"${TEST_OUTLINE}" is visible` : 'outline name not found on screen');

    // Step 2 — the new create_node action: add a node called Hello.
    await tellAI(page, `add a node called ${TEST_NODE}`);
    await page.waitForTimeout(1000);
    await takeShot(page, '03-node-added.png');

    // Assertion A — a node literally named "Hello" now exists on screen.
    const nodeVisible = await page.getByText(TEST_NODE, { exact: true }).first()
      .isVisible({ timeout: 6000 }).catch(() => false);
    record('A node named "Hello" appears after the add-node command', nodeVisible,
      nodeVisible ? 'node "Hello" is visible in the outline' : 'no visible "Hello" node found');

    // Assertion B — the friendly confirmation copy appeared.
    const bodyText = await page.evaluate(() => document.body.innerText || '');
    const confirmed = /Added a node/i.test(bodyText);
    record('Friendly "Added a node" confirmation shown', confirmed,
      confirmed ? 'confirmation toast present' : 'no "Added a node" text found');

    // Assertion C — no CLI-speak / error tone leaked (natural-language-error-tone rule).
    const badTone = /(unrecognized|invalid command|syntax|could not be dispatched)/i.test(bodyText);
    record('No CLI-speak / error jargon in the response', !badTone,
      badTone ? 'found forbidden CLI wording' : 'clean, conversational copy');

    await takeShot(page, '04-final.png');

    // ── Step 3 — Task 2: node content generation at the free/local tier ──────
    // Select the Hello node so its content editor is active, then click the
    // "Generate" (Sparkles) button and watch what happens.
    try {
      // The Hello node is already the selected node, so its content editor
      // (with the Generate button) is showing. If the Generate button isn't
      // found straight away, click the node once to (re)focus it.
      await page.waitForTimeout(1000);
      let genBtn = page.getByRole('button', { name: /^Generate$/ }).first();
      if (!(await genBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
        await page.getByText(TEST_NODE, { exact: true }).first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1200);
        genBtn = page.getByRole('button', { name: /^Generate$/ }).first();
      }
      const genVisible = await genBtn.isVisible({ timeout: 6000 }).catch(() => false);
      const genEnabled = genVisible ? await genBtn.isEnabled().catch(() => false) : false;
      record('Node content "Generate" button is available', genVisible,
        genVisible ? (genEnabled ? 'visible and enabled' : 'visible but disabled') : 'not found');

      if (genVisible && genEnabled) {
        // Baseline editor text length.
        const before = await page.evaluate(() => {
          const el = document.querySelector('.ProseMirror');
          return el ? (el.textContent || '').trim().length : -1;
        });
        await genBtn.click();
        await takeShot(page, '05-generate-clicked.png');

        // Poll up to 60s: either the editor gains real content, or a clear
        // tier / billing / error message surfaces.
        let outcome = 'timeout';
        for (let i = 0; i < 30; i++) {
          await page.waitForTimeout(2000);
          const after = await page.evaluate(() => {
            const el = document.querySelector('.ProseMirror');
            return el ? (el.textContent || '').trim().length : -1;
          });
          const body = await page.evaluate(() => document.body.innerText || '');
          if (after > before + 20) { outcome = 'content'; break; }
          if (/(upgrade|Pro feature|used all|API key|monthly.*cap|free trial|couldn't generate|AI Error)/i.test(body)) {
            outcome = 'message'; break;
          }
        }
        await takeShot(page, '06-generate-result.png');
        const finalLen = await page.evaluate(() => {
          const el = document.querySelector('.ProseMirror');
          return el ? (el.textContent || '').trim().length : -1;
        });
        record('Node content generation completes (content OR clear message)',
          outcome !== 'timeout',
          outcome === 'content'
            ? `editor gained content (${before} -> ${finalLen} chars)`
            : outcome === 'message'
              ? 'a clear tier/billing/error message was shown'
              : 'no content and no message within 60s');
      } else {
        record('Node content generation completes (content OR clear message)', false,
          'Generate button was unavailable, so generation could not be exercised');
      }
    } catch (genErr) {
      record('Node content generation completes (content OR clear message)', false,
        `content-gen probe error: ${String(genErr && genErr.message || genErr)}`);
    }

    const passed = assertions.filter(a => a.passed).length;
    const failed = assertions.length - passed;
    console.log(`\nResult: ${passed} passed, ${failed} failed`);
    if (failed > 0) exitCode = 1;

    const report = {
      suite: 'nl-add-node',
      startedAt: nowIso(),
      platform: platformInfo(),
      testOutline: TEST_OUTLINE,
      testNode: TEST_NODE,
      summary: { total: assertions.length, passed, failed },
      assertions,
    };
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    const md = [
      '# NL Add-Node Test',
      '',
      `- Total: ${assertions.length}`,
      `- Passed: ${passed}`,
      `- Failed: ${failed}`,
      '',
      '## Assertions',
      ...assertions.map(a => `- [${a.passed ? 'x' : ' '}] ${a.name}${a.detail ? ` — ${a.detail}` : ''}`),
    ].join('\n');
    fs.writeFileSync(path.join(OUT_DIR, 'report.md'), md);
  } catch (err) {
    console.error('Test crashed:', err);
    record('Test completed without crashing', false, String(err && err.message || err));
    exitCode = 1;
  } finally {
    try { await electronApp.close(); } catch {}
  }

  process.exit(exitCode);
}

run();
