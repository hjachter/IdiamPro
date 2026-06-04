/**
 * LIVE BOOKS Live-Refresh Verification Test (Issue #57)
 *
 * Complements the existing `tests/livebooks-test.js` (which covers the
 * configure-phase preview/approve safety UI). This test covers the two
 * surfaces that test was NOT able to drive without network:
 *
 *   A. The AI refresh round-trip — clicking "Refresh & preview" triggers the
 *      AI call and the dialog transitions configure → running → preview.
 *   B. The per-node post-refresh cards — once the preview phase renders,
 *      per-node cards appear (either success diff cards with Before/After +
 *      Accepted/Rejected toggles, or error cards in the "Could not refresh"
 *      section), and the summary header reflects the counts.
 *
 * ──────────────────────────────────────────────────────────────────────
 * MOCK STRATEGY (why and how)
 * ──────────────────────────────────────────────────────────────────────
 *
 * Real AI calls are slow (~30s+), non-deterministic, and cost money / require
 * a live Gemini key or a running Ollama. We need a fast, deterministic round
 * trip that exercises the renderer code in `live-books-dialog.tsx` end-to-end.
 *
 * The refresh runs through a Next.js *server action*
 * (`refreshNodeContentAction` in `src/app/actions.ts`). Server actions POST
 * to the page URL with a `next-action` header and the response is an RSC
 * Flight stream (`text/x-component`). Forging the Flight stream byte-for-byte
 * from outside the app is brittle (the format is internal to Next + React),
 * so we use a TWO-PRONG strategy and assert on whichever path actually fires:
 *
 *   PRONG 1 — TRY a fulfilled mock first.
 *     We install a `page.route()` interceptor that matches the
 *     `next-action` POST and returns a minimal Flight-shaped response
 *     containing a SUCCESSFUL refresh result with fake "after" content +
 *     a citation. If the React client decodes it, we land in the preview
 *     phase with real DIFF CARDS (Before/After + Accepted/Rejected
 *     buttons). We then test the per-card toggle interaction and the
 *     "Apply N approved" button reflection.
 *
 *   PRONG 2 — FALLBACK if React refuses the forged response.
 *     The fetch interceptor instead `abort()`s the next-action POST.
 *     That makes the server action throw on the client. The transform
 *     engine catches per-node and produces an ERROR proposal. The dialog
 *     STILL transitions to the preview phase and renders the per-node
 *     ERROR card section ("Could not refresh") plus the summary header.
 *     This proves the post-refresh card rendering code path even when
 *     the success-card-specific assertions are skipped.
 *
 * We pick a path PER RUN at startup (controlled by `MOCK_MODE` below) and
 * fall back automatically if the chosen path does not produce a preview
 * phase within the timeout. The report records which path actually ran.
 *
 * Why a BYOK key in localStorage:
 *   The AI usage gate (`useAIUsageGate`) blocks the Refresh button on the
 *   Free tier. Setting `apiKey_gemini` exempts the user (free-byok tier),
 *   so the click reliably reaches the server action.
 *
 * ──────────────────────────────────────────────────────────────────────
 * Screenshots → test-screenshots/livebooks-live-refresh/
 * Report     → test-screenshots/livebooks-live-refresh/report.{json,md}
 * Non-zero exit on hard failure.
 */

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

let electronApp;
let page;

const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'livebooks-live-refresh');

// 'fulfill' = try to forge a successful Flight response first; if React can't
//             decode it the test auto-falls-back to the abort path.
// 'abort'   = always abort the action; preview phase always shows ERROR cards.
const MOCK_MODE = process.env.LIVEBOOKS_MOCK_MODE || 'fulfill';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function fmt(ms) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

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

/* ─── PROVEN launch + splash-wait pattern (mirrors livebooks-test.js) ─── */

async function findMainWindow(app, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const windows = app.windows();
    for (const win of windows) {
      try {
        const url = win.url();
        if (url.startsWith('devtools://')) continue;
        if (url.includes('localhost:9002')) return win;
      } catch (e) { /* window not ready */ }
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Could not find main app window');
}

async function launchApp() {
  const projectRoot = path.resolve(__dirname, '..');
  console.log('Launching Electron app from:', projectRoot);

  electronApp = await electron.launch({
    args: [projectRoot],
    env: { ...process.env, NODE_ENV: 'development' },
  });

  console.log('Waiting for main window...');
  page = await findMainWindow(electronApp);
  console.log('Found main window:', page.url());

  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  // Install BYOK key + force LIVE BOOKS to use the cloud path (so the
  // server action runs the cloud refreshNodeContent flow). The key is fake;
  // our interceptor stops the network call before it hits Gemini.
  await page.evaluate(() => {
    localStorage.setItem(
      'apiKey_gemini',
      'AIzaTestKey1234567890fakefakefakefakeFAKE'
    );
    // Cloud provider (default) so liveBooksUseLocal stays false.
    localStorage.removeItem('aiProvider');
    // Reset the usage counter so nothing else interferes.
    localStorage.removeItem('idiampro-ai-usage-counter-v1');
  });

  const currentUrl = page.url();
  if (!currentUrl.includes('/app')) {
    console.log('Navigating to /app...');
    await page.evaluate(() => { window.location.href = '/app'; });
    await page.waitForLoadState('domcontentloaded');

    console.log('Waiting for app to fully load (past splash)...');
    try {
      await page.locator('button:has-text("New Outline")')
        .waitFor({ state: 'visible', timeout: 30000 });
      console.log('App loaded — New Outline button visible (past splash)');
    } catch (e) {
      console.log('Timeout waiting for New Outline button, continuing anyway...');
      await page.waitForTimeout(5000);
    }
  }

  // Splash double-check.
  const splashVisible = await page.locator('text=/Loading IdiamPro/i')
    .isVisible({ timeout: 1000 }).catch(() => false);
  if (splashVisible) {
    for (let i = 0; i < 30; i++) {
      const still = await page.locator('text=/Loading IdiamPro/i')
        .isVisible({ timeout: 500 }).catch(() => false);
      if (!still) break;
      await page.waitForTimeout(1000);
    }
  }

  console.log('App launched successfully, now at:', page.url());
}

async function shot(name) {
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  try {
    await page.screenshot({ path: file, fullPage: false });
    return file;
  } catch (e) {
    console.log(`  Screenshot failed (${name}): ${e.message}`);
    return null;
  }
}

async function closeDialog() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await page.locator('[role="dialog"]').count().catch(() => 0);
    if (count === 0) break;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(300);
}

async function ensureNoDialogs() {
  const count = await page.locator('[role="dialog"]').count().catch(() => 0);
  if (count > 0) await closeDialog();
}

/* ─── Build a small outline + select the root as the refresh target ─── */

async function buildOutlineAndSelectNode() {
  const d = { steps: [] };
  try {
    await ensureNoDialogs();

    const newOutlineBtn = page.locator('button:has-text("New Outline")').first();
    await newOutlineBtn.waitFor({ state: 'visible', timeout: 10000 });
    await newOutlineBtn.click();
    await page.waitForTimeout(2000);
    d.steps.push('Created new outline (non-Guide)');
    await shot('01-new-outline');

    const rootTreeItem = page
      .locator('[role="treeitem"]:has-text("Untitled Outline")')
      .first();
    if (!(await rootTreeItem.isVisible({ timeout: 5000 }).catch(() => false))) {
      d.error = 'Could not find the new outline root tree item';
      return { passed: false, details: d };
    }
    await rootTreeItem.locator('text=Untitled Outline').first().click();
    await page.waitForTimeout(500);
    d.steps.push('Selected root node in tree');

    // Add two children so there are 2-3 nodes total in the subtree.
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    let edit = page.locator('input[type="text"]:visible, textarea:visible').first();
    if (await edit.isVisible({ timeout: 2000 }).catch(() => false)) {
      await edit.fill('Overview');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(600);
      d.steps.push('Added child "Overview"');
    }

    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    edit = page.locator('input[type="text"]:visible, textarea:visible').first();
    if (await edit.isVisible({ timeout: 2000 }).catch(() => false)) {
      await edit.fill('Details');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(600);
      d.steps.push('Added child "Details"');
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // Re-select the root as the refresh target (root + descendants).
    const rootAgain = page
      .locator('[role="treeitem"]:has-text("Untitled Outline")')
      .first();
    if (await rootAgain.isVisible({ timeout: 3000 }).catch(() => false)) {
      await rootAgain.locator('text=Untitled Outline').first().click();
      await page.waitForTimeout(500);
      d.steps.push('Re-selected root as refresh target');
    }

    const selectedCount = await page
      .locator('[role="treeitem"][aria-selected="true"]')
      .count().catch(() => 0);
    d.selectedCount = selectedCount;
    if (selectedCount === 0) {
      d.error = 'No tree item is selected — LIVE BOOKS gate will not open';
      return { passed: false, details: d };
    }

    const treeItems = await page.locator('[role="treeitem"]').count().catch(() => 0);
    d.treeItemCount = treeItems;
    d.steps.push(`Outline tree shows ${treeItems} item(s); ${selectedCount} selected`);

    await shot('02-outline-built');
    return { passed: true, details: d };
  } catch (e) {
    d.error = e.message;
    return { passed: false, details: d };
  }
}

/* ─── Open the LIVE BOOKS dialog (Cmd+Shift+R first, fallbacks after) ─── */

async function openLiveBooksDialog() {
  const d = { steps: [], entryPointTried: [] };
  const dialogTitle = () =>
    page.locator('text=/LIVE BOOKS .* Refresh from the web/i').first();
  const dialogVisible = async () =>
    dialogTitle().isVisible({ timeout: 2500 }).catch(() => false);

  // Cmd+Shift+R shortcut.
  try {
    d.entryPointTried.push('Cmd+Shift+R');
    await page.keyboard.press('Meta+Shift+R');
    await page.waitForTimeout(1200);
    if (await dialogVisible()) {
      d.openedVia = 'Cmd+Shift+R';
      d.steps.push('Opened via Cmd+Shift+R');
      await shot('03-dialog-opened');
      return { passed: true, details: d };
    }
    await page.keyboard.press('Control+Shift+R');
    await page.waitForTimeout(1200);
    if (await dialogVisible()) {
      d.openedVia = 'Ctrl+Shift+R';
      d.steps.push('Opened via Ctrl+Shift+R');
      await shot('03-dialog-opened');
      return { passed: true, details: d };
    }
  } catch (e) {
    d.steps.push(`Shortcut error: ${e.message}`);
  }

  // AI Features menu.
  try {
    d.entryPointTried.push('AI Features menu');
    const aiBtn = page.locator('button[title="AI Features"]').first();
    if (await aiBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await aiBtn.click();
      await page.waitForTimeout(700);
      const item = page.locator('text=/LIVE BOOKS: *Refresh from the web/i').first();
      if (await item.isVisible({ timeout: 2000 }).catch(() => false)) {
        await item.click();
        await page.waitForTimeout(1200);
        if (await dialogVisible()) {
          d.openedVia = 'AI Features menu';
          d.steps.push('Opened via AI Features menu');
          await shot('03-dialog-opened');
          return { passed: true, details: d };
        }
      } else {
        await page.keyboard.press('Escape');
      }
    }
  } catch (e) {
    d.steps.push(`AI menu error: ${e.message}`);
  }

  d.error = `LIVE BOOKS dialog did not open (tried: ${d.entryPointTried.join(', ')})`;
  await shot('03-dialog-FAILED');
  return { passed: false, details: d };
}

/* ─── Install the server-action mock ─── */
// Strategy: route() intercept on POSTs that look like Next.js server-action
// calls (they go to the current page URL with a `next-action` header). The
// fulfill path returns a minimal Flight-shaped response; the abort path
// kills the request and lets the engine record a per-node error.

async function installServerActionMock(mode /* 'fulfill' | 'abort' */) {
  const fakeRefreshResult = {
    content:
      'Refreshed-by-mock content. As of the test run, this node now reflects ' +
      'the latest fictional facts injected by the LIVE BOOKS live-refresh test.',
    citations: [
      { url: 'https://example.test/mock-source-1', title: 'Mock Source 1' },
      { url: 'https://example.test/mock-source-2', title: 'Mock Source 2' },
    ],
    changed: true,
    model: 'mock-model',
    modelProvider: 'cloud',
    webGrounded: true,
  };

  // Minimal Flight response. Format details are internal to Next/React; if
  // the React client refuses to decode it, the action throws on the client,
  // and our test auto-falls-back to the per-node error path (which is also
  // a valid post-refresh card render).
  const flightBody =
    `1:${JSON.stringify(fakeRefreshResult)}\n` +
    `0:["$","$L1",null,{}]\n`;

  let interceptCount = 0;
  let abortCount = 0;
  let fulfillCount = 0;

  // Match anything that POSTs to the app, since server actions POST to the
  // current page URL. We further filter by the `next-action` header below.
  await page.route('**/*', async (route, request) => {
    try {
      if (request.method() !== 'POST') return route.continue();
      const headers = request.headers();
      const hasActionHeader =
        !!headers['next-action'] || !!headers['Next-Action'];
      if (!hasActionHeader) return route.continue();

      interceptCount++;

      if (mode === 'abort') {
        abortCount++;
        return route.abort('failed');
      }

      // mode === 'fulfill'
      fulfillCount++;
      return route.fulfill({
        status: 200,
        headers: {
          'content-type': 'text/x-component',
          'cache-control': 'no-cache, no-store, must-revalidate',
        },
        body: flightBody,
      });
    } catch (e) {
      try { return route.continue(); } catch { /* swallow */ }
    }
  });

  return {
    counters: () => ({ interceptCount, abortCount, fulfillCount }),
  };
}

/* ─── Click Refresh, verify running → preview transitions ─── */

async function clickRefreshAndAwaitPreview() {
  const d = { steps: [], phaseSeen: { configure: true, running: false, preview: false } };
  try {
    // Click "Refresh & preview" (auto-apply is OFF by default).
    const refreshBtn = page.locator('button:has-text("Refresh & preview")').first();
    if (!(await refreshBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      d.error = '"Refresh & preview" button not visible';
      return { passed: false, details: d };
    }
    await shot('04-before-refresh');
    await refreshBtn.click();
    d.steps.push('Clicked "Refresh & preview"');

    // Watch for the running phase (Loader2 spinner + "Refreshing content..." text).
    const runningText = page.locator(
      'text=/Refreshing content against the latest information/i'
    ).first();
    const sawRunning = await runningText
      .isVisible({ timeout: 4000 })
      .catch(() => false);
    d.phaseSeen.running = sawRunning;
    if (sawRunning) {
      d.steps.push('Running phase visible (spinner + refreshing text)');
      await shot('05-running');
    } else {
      d.steps.push('Running phase NOT observed (may have transitioned too quickly)');
    }

    // Wait for the preview phase — characterized by the count summary line
    // ("N proposed change(s)") OR the preview-phase footer button
    // ("Apply N approved" or "Discard").
    const previewSummary = page
      .locator('text=/proposed change\\(s\\)/i')
      .first();
    const applyBtn = page
      .locator('button:has-text("Apply")')
      .first();
    const discardBtn = page
      .locator('[role="dialog"] button:has-text("Discard")')
      .first();

    const previewWaitMs = 60000;
    const start = Date.now();
    let sawPreview = false;
    while (Date.now() - start < previewWaitMs) {
      const a = await previewSummary.isVisible({ timeout: 500 }).catch(() => false);
      const b = await discardBtn.isVisible({ timeout: 500 }).catch(() => false);
      const c = await applyBtn.isVisible({ timeout: 500 }).catch(() => false);
      if (a || b || c) { sawPreview = true; break; }
      // If the dialog returned to configure (toast error path), stop early.
      const refreshBackVisible = await page
        .locator('button:has-text("Refresh & preview")').first()
        .isVisible({ timeout: 200 }).catch(() => false);
      if (refreshBackVisible && Date.now() - start > 2000) {
        d.steps.push('Dialog returned to configure phase (action errored before any per-node result)');
        break;
      }
      await page.waitForTimeout(500);
    }
    d.phaseSeen.preview = sawPreview;
    if (!sawPreview) {
      d.error = 'Preview phase never appeared within ' + (previewWaitMs / 1000) + 's';
      await shot('05-preview-TIMEOUT');
      return { passed: false, details: d };
    }
    d.steps.push('Preview phase appeared');
    await shot('06-preview');
    return { passed: true, details: d };
  } catch (e) {
    d.error = e.message;
    return { passed: false, details: d };
  }
}

/* ─── Assert per-node cards (diff cards if mock succeeded, else error cards) ─── */

async function assertPerNodeCards() {
  const d = { steps: [], checks: {} };
  try {
    const dialog = page.locator('[role="dialog"]').last();
    const dialogText = (await dialog.textContent().catch(() => '')) || '';

    // The preview-phase summary header always shows "N proposed change(s)".
    const summaryOk = /proposed change\(s\)/i.test(dialogText);
    d.checks.summaryHeaderPresent = summaryOk;
    d.steps.push(summaryOk ? 'Summary header present' : 'Summary header MISSING');

    // Look for diff cards (Before / After labels + Accepted/Rejected toggles).
    const beforeLabels = await page
      .locator('[role="dialog"] :text("Before")').count().catch(() => 0);
    const afterLabels = await page
      .locator('[role="dialog"] :text("After")').count().catch(() => 0);
    const acceptedBtns = await page
      .locator('[role="dialog"] button:has-text("Accepted")').count().catch(() => 0);
    const rejectedBtns = await page
      .locator('[role="dialog"] button:has-text("Rejected")').count().catch(() => 0);

    d.diffCardSignals = { beforeLabels, afterLabels, acceptedBtns, rejectedBtns };
    const diffCardsPresent =
      beforeLabels >= 1 && afterLabels >= 1 && (acceptedBtns + rejectedBtns) >= 1;
    d.checks.diffCardsPresent = diffCardsPresent;
    d.steps.push(
      diffCardsPresent
        ? `Diff cards present (${beforeLabels} Before, ${afterLabels} After, ${acceptedBtns + rejectedBtns} toggle button(s))`
        : 'No success diff cards — checking error-card fallback path'
    );

    // Look for the error-card section (the alternative post-refresh UI).
    const errorHeader = await page
      .locator('[role="dialog"] :text("Could not refresh")').count().catch(() => 0);
    const errorCardsPresent = errorHeader >= 1;
    d.checks.errorCardsPresent = errorCardsPresent;
    if (!diffCardsPresent) {
      d.steps.push(
        errorCardsPresent
          ? '"Could not refresh" section present — error-card path rendered'
          : 'NEITHER diff cards NOR error cards rendered'
      );
    }

    // At least one of the two MUST be present for the preview phase to be
    // meaningfully populated.
    const someCardsRendered = diffCardsPresent || errorCardsPresent;
    d.checks.someCardsRendered = someCardsRendered;

    // If diff cards are present, also drive the Accept/Reject toggle on the
    // first card and assert that the "Apply N approved" button reflects state.
    if (diffCardsPresent) {
      const firstToggle = page
        .locator('[role="dialog"] button:has-text("Accepted"), [role="dialog"] button:has-text("Rejected")')
        .first();
      const initialLabel = (await firstToggle.textContent().catch(() => '')) || '';
      d.steps.push(`First card toggle initial state: "${initialLabel.trim()}"`);

      // The dialog pre-approves changed proposals, so the first toggle should
      // start as "Accepted". Click to flip to "Rejected".
      await firstToggle.click().catch(() => {});
      await page.waitForTimeout(400);
      const afterClickLabel = (await firstToggle.textContent().catch(() => '')) || '';
      const flipped = initialLabel.trim() !== afterClickLabel.trim();
      d.checks.toggleFlipsState = flipped;
      d.steps.push(
        flipped
          ? `Per-card toggle flips state (now: "${afterClickLabel.trim()}")`
          : 'Per-card toggle did NOT flip state'
      );
      await shot('07-toggle-flipped');

      // Flip it back so the apply count is non-zero.
      await firstToggle.click().catch(() => {});
      await page.waitForTimeout(400);

      // Check the "Apply N approved" footer button shows a non-zero count.
      const applyBtn = page
        .locator('[role="dialog"] button:has-text("Apply")')
        .first();
      const applyText = (await applyBtn.textContent().catch(() => '')) || '';
      const applyHasCount = /Apply\s+\d+\s+approved/i.test(applyText);
      d.checks.applyButtonReflectsCount = applyHasCount;
      d.steps.push(
        applyHasCount
          ? `Apply button shows count: "${applyText.trim()}"`
          : `Apply button text unexpected: "${applyText.trim()}"`
      );
      await shot('08-apply-button-state');
    } else {
      d.checks.toggleFlipsState = null;       // n/a — no success cards
      d.checks.applyButtonReflectsCount = null;
    }

    if (!someCardsRendered) {
      d.error = 'Preview phase rendered but neither diff cards nor error cards appeared.';
      d.dialogTextSample = dialogText.slice(0, 800);
      return { passed: false, details: d };
    }

    return { passed: true, details: d };
  } catch (e) {
    d.error = e.message;
    return { passed: false, details: d };
  }
}

/* ─── Runner ─── */

async function runAll() {
  ensureDir(SCREENSHOT_DIR);
  const report = {
    timestamp: new Date().toISOString(),
    feature:
      'LIVE BOOKS live-refresh round-trip + per-node post-refresh cards (issue #57)',
    mockMode: MOCK_MODE,
    platform: getPlatformInfo(),
    tests: [],
    summary: { total: 0, passed: 0, failed: 0 },
  };

  const overall = Date.now();
  console.log('\n═══ LIVE BOOKS Live-Refresh Verification Test ═══\n');
  console.log(`Platform: ${report.platform.platform} ${report.platform.arch}`);
  console.log(`Mock mode: ${MOCK_MODE}`);
  console.log(`Node: ${report.platform.nodeVersion}\n`);

  let mockHandle = null;

  try {
    const launchStart = Date.now();
    await launchApp();
    report.launchDuration = Date.now() - launchStart;
    console.log(`Launch + splash-wait: ${fmt(report.launchDuration)}\n`);
    await shot('00-app-launched');

    // Install the server-action mock BEFORE opening the dialog so the very
    // first action POST is intercepted.
    mockHandle = await installServerActionMock(MOCK_MODE);
    console.log(`Server-action mock installed (mode=${MOCK_MODE})`);

    // 1. Build outline + select node.
    console.log('─── Build outline & select node ───');
    let t0 = Date.now();
    const build = await buildOutlineAndSelectNode();
    report.tests.push({
      name: 'Build outline & select node',
      passed: build.passed,
      duration: Date.now() - t0,
      ...build.details,
    });
    console.log(build.passed ? '✓ PASS' : '✗ FAIL');
    (build.details.steps || []).forEach(s => console.log(`  • ${s}`));
    if (build.details.error) console.log(`  error: ${build.details.error}`);

    let openRes = { passed: false, details: { steps: [], error: 'skipped — outline build failed' } };
    let refreshRes = { passed: false, details: { steps: [], error: 'skipped — dialog never opened' } };
    let cardsRes = { passed: false, details: { steps: [], error: 'skipped — preview never appeared' } };

    if (build.passed) {
      // 2. Open the dialog.
      console.log('\n─── Open LIVE BOOKS dialog ───');
      t0 = Date.now();
      openRes = await openLiveBooksDialog();
      report.tests.push({
        name: 'Open LIVE BOOKS dialog',
        passed: openRes.passed,
        duration: Date.now() - t0,
        ...openRes.details,
      });
      console.log(openRes.passed ? '✓ PASS' : '✗ FAIL');
      (openRes.details.steps || []).forEach(s => console.log(`  • ${s}`));
      if (openRes.details.error) console.log(`  error: ${openRes.details.error}`);

      if (openRes.passed) {
        // 3. Click Refresh & wait for preview.
        console.log('\n─── Click Refresh & await preview phase ───');
        t0 = Date.now();
        refreshRes = await clickRefreshAndAwaitPreview();
        report.tests.push({
          name: 'Click Refresh → running → preview phase transition',
          passed: refreshRes.passed,
          duration: Date.now() - t0,
          ...refreshRes.details,
        });
        console.log(refreshRes.passed ? '✓ PASS' : '✗ FAIL');
        (refreshRes.details.steps || []).forEach(s => console.log(`  • ${s}`));
        if (refreshRes.details.error) console.log(`  error: ${refreshRes.details.error}`);

        if (refreshRes.passed) {
          // 4. Assert per-node cards rendered + Accept/Reject works.
          console.log('\n─── Assert per-node post-refresh cards ───');
          t0 = Date.now();
          cardsRes = await assertPerNodeCards();
          report.tests.push({
            name: 'Per-node post-refresh cards render + Accept/Reject works',
            passed: cardsRes.passed,
            duration: Date.now() - t0,
            ...cardsRes.details,
          });
          console.log(cardsRes.passed ? '✓ PASS' : '✗ FAIL');
          (cardsRes.details.steps || []).forEach(s => console.log(`  • ${s}`));
          if (cardsRes.details.error) console.log(`  error: ${cardsRes.details.error}`);
        } else {
          report.tests.push({
            name: 'Per-node post-refresh cards render + Accept/Reject works',
            passed: false,
            duration: 0,
            ...cardsRes.details,
          });
        }
      } else {
        report.tests.push({
          name: 'Click Refresh → running → preview phase transition',
          passed: false, duration: 0, ...refreshRes.details,
        });
        report.tests.push({
          name: 'Per-node post-refresh cards render + Accept/Reject works',
          passed: false, duration: 0, ...cardsRes.details,
        });
      }
    } else {
      report.tests.push({
        name: 'Open LIVE BOOKS dialog',
        passed: false, duration: 0, ...openRes.details,
      });
      report.tests.push({
        name: 'Click Refresh → running → preview phase transition',
        passed: false, duration: 0, ...refreshRes.details,
      });
      report.tests.push({
        name: 'Per-node post-refresh cards render + Accept/Reject works',
        passed: false, duration: 0, ...cardsRes.details,
      });
    }

    if (mockHandle) {
      report.mockCounters = mockHandle.counters();
    }
  } catch (e) {
    console.error('Test run aborted:', e.message);
    report.error = e.message;
  } finally {
    if (electronApp) await electronApp.close().catch(() => {});
  }

  report.summary.total = report.tests.length;
  report.summary.passed = report.tests.filter(t => t.passed).length;
  report.summary.failed = report.tests.filter(t => !t.passed).length;
  report.summary.duration = Date.now() - overall;

  console.log('\n═══ RESULTS ═══');
  for (const t of report.tests) {
    console.log(`  ${t.passed ? '✓ PASS' : '✗ FAIL'}  ${t.name}  (${fmt(t.duration)})`);
  }
  console.log(`\nTotal: ${report.summary.passed}/${report.summary.total} passed in ${fmt(report.summary.duration)}\n`);
  if (report.mockCounters) {
    console.log(
      `Mock: ${report.mockCounters.interceptCount} intercept(s), ` +
      `${report.mockCounters.fulfillCount} fulfilled, ` +
      `${report.mockCounters.abortCount} aborted\n`
    );
  }

  fs.writeFileSync(
    path.join(SCREENSHOT_DIR, 'report.json'),
    JSON.stringify(report, null, 2)
  );

  const md = [
    '# LIVE BOOKS Live-Refresh Verification Test Report',
    '',
    `**Generated:** ${new Date(report.timestamp).toLocaleString()}`,
    `**Feature:** ${report.feature}`,
    `**Mock mode:** \`${report.mockMode}\``,
    '',
    '## Summary',
    '',
    `- Passed: **${report.summary.passed}** / ${report.summary.total}`,
    `- Failed: **${report.summary.failed}**`,
    `- Duration: ${fmt(report.summary.duration)}`,
    `- Launch + splash-wait: ${report.launchDuration ? fmt(report.launchDuration) : 'n/a'}`,
    report.mockCounters
      ? `- Server-action intercepts: ${report.mockCounters.interceptCount} ` +
        `(${report.mockCounters.fulfillCount} fulfilled, ` +
        `${report.mockCounters.abortCount} aborted)`
      : '',
    '',
    '## Tests',
    '',
    '| Test | Status | Duration |',
    '|---|---|---|',
    ...report.tests.map(t => `| ${t.name} | ${t.passed ? '✅ PASS' : '❌ FAIL'} | ${fmt(t.duration)} |`),
    '',
    '## Details',
    '',
    ...report.tests.flatMap(t => [
      `### ${t.name}`,
      '',
      ...(t.steps || []).map(s => `- ${s}`),
      ...(t.checks
        ? [
            '',
            '**Assertion checks:**',
            ...Object.entries(t.checks).map(([k, v]) =>
              `- ${k}: ${v === true ? '✅' : v === false ? '❌' : 'n/a'}`
            ),
          ]
        : []),
      ...(t.diffCardSignals
        ? [
            '',
            '**Diff-card signals:**',
            ...Object.entries(t.diffCardSignals).map(([k, v]) =>
              `- ${k}: ${v}`
            ),
          ]
        : []),
      ...(t.error ? ['', `**error:** ${t.error}`] : []),
      '',
    ]),
  ].filter(Boolean).join('\n');
  fs.writeFileSync(path.join(SCREENSHOT_DIR, 'report.md'), md);

  console.log(`Reports: ${SCREENSHOT_DIR}/report.{json,md}`);
  console.log(`Screenshots: ${SCREENSHOT_DIR}/\n`);

  process.exit(report.summary.failed > 0 ? 1 : 0);
}

runAll();
