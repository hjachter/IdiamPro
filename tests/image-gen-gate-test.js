/**
 * image-gen-gate-test.js — Cost-safety regression for AI image generation.
 *
 * The "Generate Visual" dialog can call the PAID Google Imagen server action.
 * Before this test it was ungated: a free user could spend real API money.
 * The fix routes the illustration (Imagen) spend through the shared
 * useAIUsageGate with feature 'imageGeneration' (a Pro-only feature), exactly
 * like Podcast / Video.
 *
 * This suite drives the real UI as a default (free-trial, non-Pro, no BYOK)
 * user and asserts:
 *   1. Illustration → Generate shows the upgrade prompt and does NOT insert an
 *      image (the paid Imagen call is never reached).
 *   2. Mind Map (a local, free diagram) → Generate does NOT show the upgrade
 *      prompt (free/local path stays ungated).
 *
 * Screenshots + report to test-screenshots/image-gen-gate/.
 */

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

const REPORT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'image-gen-gate');
if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

let electronApp;
let page;
const results = [];

async function findMainWindow(app, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    for (const win of app.windows()) {
      try {
        const url = win.url();
        if (url.startsWith('devtools://')) continue;
        if (url.includes('localhost:9002')) return win;
      } catch { /* not ready */ }
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error('Could not find main app window');
}

async function launchApp() {
  electronApp = await electron.launch({
    args: [path.resolve(__dirname, '..')],
    env: { ...process.env, NODE_ENV: 'development' },
  });
  page = await findMainWindow(electronApp);
  page.on('dialog', (d) => { d.dismiss().catch(() => {}); });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  await page.evaluate(() => {
    // DEFAULT FREE USER: no tier id (→ free-trial), no BYOK key, cloud provider.
    // Grant AI consent so we reach the cost gate (handleGenerateImage checks
    // consent first). Silence discovery toasts so they can't eat clicks.
    localStorage.removeItem('idiampro-tier-id');
    localStorage.removeItem('idiampro-ai-usage-counter-v1');
    for (const p of ['gemini', 'openai', 'anthropic', 'mistral', 'groq']) {
      localStorage.removeItem(`apiKey_${p}`);
    }
    localStorage.removeItem('aiProvider');
    localStorage.setItem('aiDataConsent', 'granted');
    localStorage.setItem('discovery:professionalMode', 'true');
  });

  if (!page.url().includes('/app')) {
    await page.evaluate(() => { window.location.href = '/app'; });
    await page.waitForLoadState('domcontentloaded');
    try {
      await page.locator('button:has-text("New Outline")').waitFor({ state: 'visible', timeout: 30000 });
    } catch { await page.waitForTimeout(5000); }
  }
}

async function shot(name) {
  try { await page.screenshot({ path: path.join(REPORT_DIR, `${name}.png`) }); } catch { /* ignore */ }
}

async function closeAllDialogs() {
  for (let i = 0; i < 8; i++) {
    const dialogs = await page.locator('[role="dialog"]').count().catch(() => 0);
    const overlays = await page.locator('div.fixed.inset-0.z-50').count().catch(() => 0);
    if (dialogs === 0 && overlays === 0) break;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);
  }
  // Belt-and-suspenders: wait for the Radix modal overlay to fully detach so
  // it can't intercept later clicks on the outline tree.
  await page
    .locator('div.fixed.inset-0.z-50')
    .first()
    .waitFor({ state: 'detached', timeout: 3000 })
    .catch(() => {});
}

async function runTest(name, fn) {
  console.log(`\n  ▶ ${name}`);
  const t0 = Date.now();
  let entry = { name, passed: false, durationMs: 0, details: {} };
  try {
    const res = await fn();
    entry = { ...entry, ...res, durationMs: Date.now() - t0 };
    console.log(`    ${entry.passed ? '✓' : '✗'} ${name} (${entry.durationMs}ms)`);
    if (!entry.passed && entry.details.error) console.log(`      ${entry.details.error}`);
  } catch (err) {
    entry.details.error = err.message;
    entry.durationMs = Date.now() - t0;
    console.log(`    ✗ ${name} — ${err.message}`);
  }
  results.push(entry);
  return entry;
}

// Build a real (non-guide) outline with a selectable child node so the content
// pane + its "Image" toolbar button are enabled (the button is disabled on the
// read-only User Guide).
async function buildOutline() {
  await closeAllDialogs();
  const newBtn = page.locator('button:has-text("New Outline")').first();
  await newBtn.waitFor({ state: 'visible', timeout: 15000 });
  await newBtn.click();
  await page.waitForTimeout(2000);

  const root = page.locator('[role="treeitem"]:has-text("Untitled Outline")').first();
  await root.waitFor({ state: 'visible', timeout: 5000 });
  await root.locator('text=Untitled Outline').first().click();
  await page.waitForTimeout(400);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  const edit = page.locator('input[type="text"]:visible, textarea:visible').first();
  if (await edit.isVisible({ timeout: 2000 }).catch(() => false)) {
    await edit.fill('Visual target node');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  const child = page.locator('[role="treeitem"]:has-text("Visual target node")').first();
  await child.locator('text=Visual target node').first().click();
  await page.waitForTimeout(500);
  await shot('01-outline-built');
}

async function openGenerateVisual() {
  const imgBtn = page.locator('button:has(.lucide-image-plus)').first();
  await imgBtn.waitFor({ state: 'visible', timeout: 8000 });
  if (await imgBtn.isDisabled().catch(() => true)) {
    throw new Error('Image button is disabled (still on guide / no node selected)');
  }
  await imgBtn.click();
  await page.locator('[role="dialog"]:has-text("Generate Visual")').waitFor({ state: 'visible', timeout: 5000 });
}

// TEST 1 — illustration Generate must hit the Pro upgrade prompt, not Imagen.
async function testIllustrationBlockedByGate() {
  await openGenerateVisual();
  // Illustration is the default type; a prompt is prefilled. Click Generate.
  await shot('02-visual-dialog');
  const genBtn = page.locator('[role="dialog"] button:has-text("Generate")').last();
  await genBtn.click();
  await page.waitForTimeout(1500);

  // The shared upgrade prompt uses this exact Pro-only copy for imageGeneration.
  const upgradeVisible = await page
    .locator('text=Image generation is a Pro feature')
    .first()
    .isVisible({ timeout: 4000 })
    .catch(() => false);
  await shot('03-upgrade-prompt');

  // No AI image should have been inserted into the editor.
  const imgCount = await page.locator('.ProseMirror img').count().catch(() => 0);

  // Dismiss ONLY the upgrade prompt (click "Maybe later") so the Generate
  // Visual dialog underneath stays open for the next check.
  await page.locator('[role="dialog"] button:has-text("Maybe later")').first().click().catch(() => {});
  await page.waitForTimeout(500);
  const ok = upgradeVisible && imgCount === 0;
  return {
    passed: ok,
    details: {
      upgradePromptShown: upgradeVisible,
      imagesInEditor: imgCount,
      error: ok ? undefined : `upgrade=${upgradeVisible} imgs=${imgCount}`,
    },
  };
}

// TEST 2 — Mind Map (local, free) must NOT trigger the upgrade prompt.
// Runs in the SAME Generate Visual dialog left open by test 1 (only the
// upgrade prompt was dismissed), so no re-selection is needed.
async function testMindMapStaysFree() {
  const dialogOpen = await page
    .locator('[role="dialog"]:has-text("Generate Visual")')
    .first()
    .isVisible({ timeout: 3000 })
    .catch(() => false);
  if (!dialogOpen) {
    // Fallback: reopen it (selection may have been retained).
    const child = page.locator('[role="treeitem"]:has-text("Visual target node")').first();
    await child.locator('text=Visual target node').first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
    await openGenerateVisual();
  }
  // Switch the Visual Type select to Mind Map.
  const typeTrigger = page.locator('[role="dialog"] button[role="combobox"]').first();
  await typeTrigger.click();
  await page.waitForTimeout(300);
  await page.locator('[role="option"]:has-text("Mind Map")').first().click();
  await page.waitForTimeout(400);
  await shot('04-mindmap-selected');

  const genBtn = page.locator('[role="dialog"] button:has-text("Generate")').last();
  await genBtn.click();
  await page.waitForTimeout(1500);

  const upgradeVisible = await page
    .locator('text=Image generation is a Pro feature')
    .first()
    .isVisible({ timeout: 2000 })
    .catch(() => false);
  await shot('05-after-mindmap');
  await closeAllDialogs();

  // Free/local path: the upgrade prompt must NOT appear.
  return {
    passed: !upgradeVisible,
    details: { upgradePromptShown: upgradeVisible, error: upgradeVisible ? 'mind map wrongly gated' : undefined },
  };
}

async function main() {
  console.log('Launching Electron for image-gen-gate-test…');
  await launchApp();
  await buildOutline();

  await runTest('illustration Generate → Pro upgrade prompt, no Imagen call', testIllustrationBlockedByGate);
  await runTest('Mind Map Generate → stays free (no upgrade prompt)', testMindMapStaysFree);

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const report = {
    suite: 'image-gen-gate',
    runAt: new Date().toISOString(),
    platform: { platform: os.platform(), arch: os.arch(), nodeVersion: process.version },
    summary: { passed, total, allPassed: passed === total },
    results,
  };
  fs.writeFileSync(path.join(REPORT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(REPORT_DIR, 'report.md'),
    [
      '# image-gen-gate-test report',
      '',
      `**Run:** ${report.runAt}`,
      `**Result:** ${passed} / ${total} passed`,
      '',
      ...results.map((r) => `- ${r.passed ? '✓' : '✗'} ${r.name} (${r.durationMs}ms)` + (r.details.error ? `\n  - ${r.details.error}` : '')),
      '',
    ].join('\n'),
  );

  if (electronApp) await Promise.race([
    electronApp.close().catch(() => {}),
    new Promise((r) => setTimeout(r, 5000)),
  ]);
  console.log(`\n  Done: ${passed}/${total} passed.`);
  process.exit(passed === total ? 0 : 1);
}

main().catch(async (err) => {
  console.error('Fatal:', err);
  try { if (electronApp) await electronApp.close(); } catch {}
  process.exit(1);
});
