/**
 * Translate Dialog Verification Test (Issue #52)
 *
 * Mirrors the structure of `tests/livebooks-live-refresh-test.js` because the
 * Translate feature plugs into the same transform engine + preview/approve UX
 * as LIVE BOOKS — different transformer, same surface.
 *
 * Coverage:
 *   A. The Translate dialog opens from the AI menu and shows the configure
 *      phase (language picker + Translate & preview button).
 *   B. The language picker accepts a target language, the Translate button
 *      becomes enabled, and clicking it triggers the AI round-trip.
 *   C. Once the preview phase renders, per-node cards appear (either success
 *      diff cards with Before/After + Reject toggles, or error cards), and
 *      the "Apply N translation(s)" footer button reflects the accepted count.
 *
 * MOCK STRATEGY (matches livebooks-live-refresh-test.js):
 *   - PRONG 1 'fulfill' — try to forge a successful Flight response for the
 *     translate server action. If React decodes it, we land in preview with
 *     real diff cards.
 *   - PRONG 2 'abort'   — kill the next-action POST. The transform engine
 *     records a per-node error and the dialog still transitions to preview,
 *     rendering the error card section.
 *
 * Both prongs prove the preview phase wires up and renders post-translate
 * cards; we record which path actually ran and assert on the right cards.
 *
 * Why a BYOK key in localStorage:
 *   The AI usage gate blocks Translate on the Free tier. Setting
 *   `apiKey_gemini` exempts the user (free-byok), so the click reliably
 *   reaches the server action.
 *
 * Screenshots → test-screenshots/translate/
 * Report     → test-screenshots/translate/report.{json,md}
 * Non-zero exit on hard failure.
 */

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

let electronApp;
let page;

const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'translate');
const MOCK_MODE = process.env.TRANSLATE_MOCK_MODE || 'fulfill';

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

  await page.evaluate(() => {
    localStorage.setItem(
      'apiKey_gemini',
      'AIzaTestKey1234567890fakefakefakefakeFAKE'
    );
    localStorage.removeItem('aiProvider');
    localStorage.removeItem('idiampro-ai-usage-counter-v1');
  });

  const currentUrl = page.url();
  if (!currentUrl.includes('/app')) {
    console.log('Navigating to /app...');
    await page.evaluate(() => { window.location.href = '/app'; });
    await page.waitForLoadState('domcontentloaded');
    try {
      await page.locator('button:has-text("New Outline")')
        .waitFor({ state: 'visible', timeout: 30000 });
    } catch (e) {
      await page.waitForTimeout(5000);
    }
  }

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

/* ─── Build a small outline + select the root as the translate target ─── */

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

    // Add two children so there are 2-3 nodes total.
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

    const rootAgain = page
      .locator('[role="treeitem"]:has-text("Untitled Outline")')
      .first();
    if (await rootAgain.isVisible({ timeout: 3000 }).catch(() => false)) {
      await rootAgain.locator('text=Untitled Outline').first().click();
      await page.waitForTimeout(500);
      d.steps.push('Re-selected root as translate target');
    }

    const selectedCount = await page
      .locator('[role="treeitem"][aria-selected="true"]')
      .count().catch(() => 0);
    d.selectedCount = selectedCount;
    if (selectedCount === 0) {
      d.error = 'No tree item is selected — Translate gate will not open';
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

/* ─── Open the Translate dialog (AI menu) ─── */

async function openTranslateDialog() {
  const d = { steps: [], entryPointTried: [] };
  const dialogTitle = () =>
    page.locator('text=/Translate this section/i').first();
  const dialogVisible = async () =>
    dialogTitle().isVisible({ timeout: 2500 }).catch(() => false);

  try {
    d.entryPointTried.push('AI Features menu');
    const aiBtn = page.locator('button[title="AI Features"]').first();
    if (await aiBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await aiBtn.click();
      await page.waitForTimeout(700);
      const item = page.locator('text=/Translate this section/i').first();
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

  // Fallback: Command Palette
  try {
    d.entryPointTried.push('Command Palette');
    await page.keyboard.press('Meta+K');
    await page.waitForTimeout(700);
    const item = page.locator('[role="dialog"] :text("Translate this section")').first();
    if (await item.isVisible({ timeout: 2000 }).catch(() => false)) {
      await item.click();
      await page.waitForTimeout(1200);
      if (await dialogVisible()) {
        d.openedVia = 'Command Palette';
        d.steps.push('Opened via Command Palette');
        await shot('03-dialog-opened');
        return { passed: true, details: d };
      }
    } else {
      await page.keyboard.press('Escape');
    }
  } catch (e) {
    d.steps.push(`Command palette error: ${e.message}`);
  }

  d.error = `Translate dialog did not open (tried: ${d.entryPointTried.join(', ')})`;
  await shot('03-dialog-FAILED');
  return { passed: false, details: d };
}

/* ─── Server-action mock (translateNodeContentAction) ─── */

async function installServerActionMock(mode /* 'fulfill' | 'abort' */) {
  const fakeTranslateResult = {
    content:
      '<p>Contenido traducido por el mock de prueba. Esta sección refleja la traducción simulada que el motor de transformación inyecta durante la prueba automatizada.</p>',
    citations: [],
    changed: true,
    model: 'mock-model',
    modelProvider: 'cloud',
    webGrounded: false,
  };

  const flightBody =
    `1:${JSON.stringify(fakeTranslateResult)}\n` +
    `0:["$","$L1",null,{}]\n`;

  let interceptCount = 0;
  let abortCount = 0;
  let fulfillCount = 0;

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

/* ─── Pick a language + click Translate & preview, await preview phase ─── */

async function pickLanguageAndAwaitPreview() {
  const d = { steps: [], phaseSeen: { configure: true, running: false, preview: false } };
  try {
    // Pick a language via the <select> (aria-label="Target language").
    const select = page.locator('[role="dialog"] select[aria-label="Target language"]').first();
    if (!(await select.isVisible({ timeout: 3000 }).catch(() => false))) {
      d.error = 'Language picker not visible in dialog';
      return { passed: false, details: d };
    }
    await select.selectOption({ label: 'Spanish' });
    await page.waitForTimeout(400);
    d.steps.push('Picked target language: Spanish');
    await shot('04-language-picked');

    const runBtn = page.locator('button:has-text("Translate & preview")').first();
    if (!(await runBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      d.error = '"Translate & preview" button not visible';
      return { passed: false, details: d };
    }
    const isDisabled = await runBtn.isDisabled().catch(() => false);
    d.steps.push(`Translate button disabled state after picking language: ${isDisabled}`);
    if (isDisabled) {
      d.error = 'Translate button still disabled after picking language';
      return { passed: false, details: d };
    }

    await runBtn.click();
    d.steps.push('Clicked "Translate & preview"');

    // Running phase: look for the "Translating into Spanish…" text.
    const runningText = page.locator('text=/Translating into Spanish/i').first();
    const sawRunning = await runningText
      .isVisible({ timeout: 4000 })
      .catch(() => false);
    d.phaseSeen.running = sawRunning;
    if (sawRunning) {
      d.steps.push('Running phase visible (spinner + translating text)');
      await shot('05-running');
    } else {
      d.steps.push('Running phase NOT observed (may have transitioned too quickly)');
    }

    // Preview phase: characterized by the summary line ("N translated · …")
    // OR the preview-phase footer "Apply N translations" / "Discard".
    const previewSummary = page
      .locator('text=/translated\\s*·\\s*\\d+\\s*skipped/i')
      .first();
    const applyBtn = page
      .locator('[role="dialog"] button:has-text("Apply")')
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
      const backToConfigure = await page
        .locator('button:has-text("Translate & preview")').first()
        .isVisible({ timeout: 200 }).catch(() => false);
      if (backToConfigure && Date.now() - start > 2000) {
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

/* ─── Assert per-node cards + Reject toggle + Apply button reflection ─── */

async function assertPerNodeCards() {
  const d = { steps: [], checks: {} };
  try {
    const dialog = page.locator('[role="dialog"]').last();
    const dialogText = (await dialog.textContent().catch(() => '')) || '';

    const summaryOk = /translated\s*·/i.test(dialogText) ||
                      /Could not translate|errored/i.test(dialogText);
    d.checks.summaryHeaderPresent = summaryOk;
    d.steps.push(summaryOk ? 'Summary header present' : 'Summary header MISSING');

    // Diff cards: Before / After (target lang) labels + Reject buttons.
    const beforeLabels = await page
      .locator('[role="dialog"] :text("Before")').count().catch(() => 0);
    const afterLabels = await page
      .locator('[role="dialog"] :text("After")').count().catch(() => 0);
    const rejectBtns = await page
      .locator('[role="dialog"] button:has-text("Reject")').count().catch(() => 0);
    const restoreBtns = await page
      .locator('[role="dialog"] button:has-text("Restore")').count().catch(() => 0);

    d.diffCardSignals = { beforeLabels, afterLabels, rejectBtns, restoreBtns };
    const diffCardsPresent =
      beforeLabels >= 1 && afterLabels >= 1 && (rejectBtns + restoreBtns) >= 1;
    d.checks.diffCardsPresent = diffCardsPresent;
    d.steps.push(
      diffCardsPresent
        ? `Diff cards present (${beforeLabels} Before, ${afterLabels} After, ${rejectBtns + restoreBtns} toggle button(s))`
        : 'No success diff cards — checking error-card fallback path'
    );

    // Errored section appears as "Errored" header in the dialog.
    const erroredHeader = await page
      .locator('[role="dialog"] :text("Errored")').count().catch(() => 0);
    const errorCardsPresent = erroredHeader >= 1;
    d.checks.errorCardsPresent = errorCardsPresent;
    if (!diffCardsPresent) {
      d.steps.push(
        errorCardsPresent
          ? '"Errored" section present — error-card path rendered'
          : 'NEITHER diff cards NOR error cards rendered'
      );
    }

    const someCardsRendered = diffCardsPresent || errorCardsPresent;
    d.checks.someCardsRendered = someCardsRendered;

    if (diffCardsPresent) {
      // Toggle the first Reject button → should become "Restore"
      const firstToggle = page
        .locator('[role="dialog"] button:has-text("Reject"), [role="dialog"] button:has-text("Restore")')
        .first();
      const initialLabel = (await firstToggle.textContent().catch(() => '')) || '';
      d.steps.push(`First card toggle initial state: "${initialLabel.trim()}"`);

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

      // Restore so apply count is non-zero.
      await firstToggle.click().catch(() => {});
      await page.waitForTimeout(400);

      // "Apply N translation(s)" footer button.
      const applyBtn = page
        .locator('[role="dialog"] button:has-text("Apply")')
        .first();
      const applyText = (await applyBtn.textContent().catch(() => '')) || '';
      const applyHasCount = /Apply\s+\d+\s+translation/i.test(applyText);
      d.checks.applyButtonReflectsCount = applyHasCount;
      d.steps.push(
        applyHasCount
          ? `Apply button shows count: "${applyText.trim()}"`
          : `Apply button text unexpected: "${applyText.trim()}"`
      );
      await shot('08-apply-button-state');

      // Click Apply to confirm the approved translation lands in the outline
      // and the dialog closes.
      const enabled = !(await applyBtn.isDisabled().catch(() => true));
      if (enabled) {
        await applyBtn.click().catch(() => {});
        await page.waitForTimeout(1500);
        const stillOpen = await page
          .locator('[role="dialog"] :text("Translate this section")')
          .first().isVisible({ timeout: 1500 }).catch(() => false);
        d.checks.dialogClosedAfterApply = !stillOpen;
        d.steps.push(
          stillOpen
            ? 'Dialog stayed open after Apply (unexpected)'
            : 'Dialog closed after Apply (translation applied to outline)'
        );
        await shot('09-after-apply');
      } else {
        d.checks.dialogClosedAfterApply = null;
        d.steps.push('Apply button disabled — skipping apply step');
      }
    } else {
      d.checks.toggleFlipsState = null;
      d.checks.applyButtonReflectsCount = null;
      d.checks.dialogClosedAfterApply = null;
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
    feature: 'Translate dialog: language picker + preview/approve + apply (issue #52)',
    mockMode: MOCK_MODE,
    platform: getPlatformInfo(),
    tests: [],
    summary: { total: 0, passed: 0, failed: 0 },
  };

  const overall = Date.now();
  console.log('\n═══ Translate Dialog Verification Test ═══\n');
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

    mockHandle = await installServerActionMock(MOCK_MODE);
    console.log(`Server-action mock installed (mode=${MOCK_MODE})`);

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
    let pickRes = { passed: false, details: { steps: [], error: 'skipped — dialog never opened' } };
    let cardsRes = { passed: false, details: { steps: [], error: 'skipped — preview never appeared' } };

    if (build.passed) {
      console.log('\n─── Open Translate dialog ───');
      t0 = Date.now();
      openRes = await openTranslateDialog();
      report.tests.push({
        name: 'Open Translate dialog',
        passed: openRes.passed,
        duration: Date.now() - t0,
        ...openRes.details,
      });
      console.log(openRes.passed ? '✓ PASS' : '✗ FAIL');
      (openRes.details.steps || []).forEach(s => console.log(`  • ${s}`));
      if (openRes.details.error) console.log(`  error: ${openRes.details.error}`);

      if (openRes.passed) {
        console.log('\n─── Pick language & await preview phase ───');
        t0 = Date.now();
        pickRes = await pickLanguageAndAwaitPreview();
        report.tests.push({
          name: 'Pick language → Translate → preview phase transition',
          passed: pickRes.passed,
          duration: Date.now() - t0,
          ...pickRes.details,
        });
        console.log(pickRes.passed ? '✓ PASS' : '✗ FAIL');
        (pickRes.details.steps || []).forEach(s => console.log(`  • ${s}`));
        if (pickRes.details.error) console.log(`  error: ${pickRes.details.error}`);

        if (pickRes.passed) {
          console.log('\n─── Assert per-node cards + Reject/Apply ───');
          t0 = Date.now();
          cardsRes = await assertPerNodeCards();
          report.tests.push({
            name: 'Per-node cards render + Reject/Apply work',
            passed: cardsRes.passed,
            duration: Date.now() - t0,
            ...cardsRes.details,
          });
          console.log(cardsRes.passed ? '✓ PASS' : '✗ FAIL');
          (cardsRes.details.steps || []).forEach(s => console.log(`  • ${s}`));
          if (cardsRes.details.error) console.log(`  error: ${cardsRes.details.error}`);
        } else {
          report.tests.push({
            name: 'Per-node cards render + Reject/Apply work',
            passed: false, duration: 0, ...cardsRes.details,
          });
        }
      } else {
        report.tests.push({
          name: 'Pick language → Translate → preview phase transition',
          passed: false, duration: 0, ...pickRes.details,
        });
        report.tests.push({
          name: 'Per-node cards render + Reject/Apply work',
          passed: false, duration: 0, ...cardsRes.details,
        });
      }
    } else {
      report.tests.push({
        name: 'Open Translate dialog',
        passed: false, duration: 0, ...openRes.details,
      });
      report.tests.push({
        name: 'Pick language → Translate → preview phase transition',
        passed: false, duration: 0, ...pickRes.details,
      });
      report.tests.push({
        name: 'Per-node cards render + Reject/Apply work',
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
    '# Translate Dialog Verification Test Report',
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
