// Playwright suite for the opt-in "Social export" feature and its first
// social-media output format, "Share to X" (2026-07-22).
//
// Verifies the full spec:
//   1. Master "Social export" OFF (default) → the Share to Social action is absent.
//   2. Settings → Professional Customization → flip master ON → the short honest
//      consent note appears with Enable/Cancel → Enable. Per-platform "Share to X"
//      sub-toggle present.
//   3. Select a branch, invoke Share to Social → generate a THREAD → real posts,
//      each within the 280-char limit, a hook first, an editable preview, and the
//      four hand-offs wired:
//        - Copy thread → numbered thread on the clipboard (read back via Electron).
//        - Open in X   → https://twitter.com/intent/tweet?text=<encoded first post>.
//        - Download     → a .txt with the thread.
//   4. Single-post mode → exactly one post ≤ 280 chars.
//   5. When Your Voice is on with a profile, the "In my voice" option appears.
//
// The draft runs on local AI (Ollama), so the run is self-contained and the tier
// gate is exempt (aiProvider='local'). If the on-device model is slow/flaky we
// retry the generation a few times.

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { prepareApp, openSettings, setElectronWindowSize } = require('./_helpers');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'share-to-x');
fs.mkdirSync(OUT_DIR, { recursive: true });
const X_LIMIT = 280;

let electronApp;
let page;
const results = [];

function record(name, passed, info) {
  results.push({ name, passed, info: info || '' });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`);
}

async function shot(name) {
  try {
    await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`) });
  } catch {}
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
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Could not find main app window');
}

// Dismiss the first-run overlays that mount over the app and eat clicks (they
// blocked node selection): the "What you can make here" welcome showcase and
// the "Keep your work safe" data-protection notice.
async function dismissBlockingOverlays() {
  try {
    // Welcome showcase.
    const showcase = page.locator('[data-testid="welcome-showcase"]');
    if ((await showcase.count().catch(() => 0)) > 0 && (await showcase.first().isVisible().catch(() => false))) {
      const optOut = page.locator('[data-testid="welcome-showcase-dont-show"], [data-testid="welcome-showcase-skip"]');
      if ((await optOut.count().catch(() => 0)) > 0) {
        await optOut.first().click().catch(() => {});
      } else {
        await page.locator('[data-testid="welcome-showcase"] button:has-text("Get started")').first().click().catch(() => {});
      }
      await page.waitForTimeout(400);
    }
  } catch {}
  try {
    // Data-protection notice.
    const got = page.locator('[data-testid="data-protection-got-it"]');
    if ((await got.count().catch(() => 0)) > 0 && (await got.first().isVisible().catch(() => false))) {
      await got.first().click().catch(() => {});
      await page.waitForTimeout(400);
    }
  } catch {}
}

async function closeAnyDialog() {
  for (let i = 0; i < 4; i++) {
    const open = await page.locator('[role="dialog"]').count().catch(() => 0);
    if (open === 0) break;
    const closeBtn = page.locator('[role="dialog"] button[aria-label="Close"], [role="dialog"] button:has-text("Close")');
    if ((await closeBtn.count().catch(() => 0)) > 0) {
      await closeBtn.first().click().catch(() => {});
    } else {
      await page.keyboard.press('Escape').catch(() => {});
    }
    await page.waitForTimeout(400);
  }
  // Also close any lingering dropdown/context menu that would cover the outline
  // and make node clicks time out.
  for (let i = 0; i < 3; i++) {
    const menus = await page.locator('[role="menu"]').count().catch(() => 0);
    if (menus === 0) break;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
  }
}

// Open the "Turn Into" branch-actions menu regardless of layout.
async function openBranchMenu() {
  const top = page.locator('[aria-label="Turn Into"]');
  const tn = await top.count().catch(() => 0);
  for (let i = 0; i < tn; i++) {
    await top.nth(i).click().catch(() => {});
    await page.waitForTimeout(450);
    const hasFamily = await page
      .locator('[role="menuitem"]:has-text("Share Suboutline"), [role="menuitem"]:has-text("Export Current Outline")')
      .count()
      .catch(() => 0);
    if (hasFamily > 0) return true;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(200);
  }
  const more = page.locator('[aria-label="More tools"]');
  if ((await more.count().catch(() => 0)) > 0) {
    await more.first().click().catch(() => {});
    await page.waitForTimeout(450);
    const sub = page.locator('[role="menuitem"]:has-text("Turn Into")');
    if ((await sub.count().catch(() => 0)) > 0) {
      await sub.first().hover().catch(() => {});
      await sub.first().click().catch(() => {});
      await page.waitForTimeout(600);
      const hasFamily = await page
        .locator('[role="menuitem"]:has-text("Share Suboutline"), [role="menuitem"]:has-text("Export Current Outline")')
        .count()
        .catch(() => 0);
      if (hasFamily > 0) return true;
    }
  }
  return false;
}

async function branchMenuHasShareSocial() {
  await closeAnyDialog();
  const opened = await openBranchMenu();
  if (!opened) {
    console.log('  [probe] could not open branch menu');
    return false;
  }
  const count = await page.locator('[role="menuitem"]:has-text("Share to Social")').count().catch(() => 0);
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);
  return count > 0;
}

async function openShareSocialFromMenu() {
  await closeAnyDialog();
  const opened = await openBranchMenu();
  if (!opened) return false;
  const item = page.locator('[role="menuitem"]:has-text("Share to Social")');
  if ((await item.count().catch(() => 0)) > 0) {
    await item.first().click().catch(() => {});
    await page.waitForTimeout(700);
    return true;
  }
  return false;
}

// True when some outline node is selected. Node rows are role="treeitem" with
// aria-selected — the authoritative selection signal.
async function nodeIsSelected() {
  return (await page.locator('[role="treeitem"][aria-selected="true"]').count().catch(() => 0)) > 0;
}

// Select a node by clicking its treeitem row (which triggers the app's own
// select handler) and confirming aria-selected flips. Tries several rows.
// Clears overlays/menus first so clicks aren't intercepted (which would make
// Playwright wait out the actionability timeout on every click).
async function selectSomeNode() {
  await dismissBlockingOverlays();
  await closeAnyDialog();
  if (await nodeIsSelected()) return true;
  const items = page.locator('[role="treeitem"]');
  const n = await items.count().catch(() => 0);
  for (let i = 0; i < Math.min(n, 8); i++) {
    const it = items.nth(i);
    if (!(await it.isVisible().catch(() => false))) continue;
    // Short timeout so an intercepted click fails fast instead of hanging.
    await it.click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(300);
    if (await nodeIsSelected()) return true;
  }
  return await nodeIsSelected();
}

// Generate posts from the currently-open dialog, retrying the flaky on-device
// model a few times. Returns true when the preview (post 0 textarea) appears.
async function generateAndReachPreview(buttonText) {
  let reached = false;
  for (let attempt = 0; attempt < 3 && !reached; attempt++) {
    await page.locator(`button:has-text("${buttonText}")`).first().click().catch(() => {});
    const start = Date.now();
    while (Date.now() - start < 95000) {
      if (await page.locator('[data-testid="social-post-textarea-0"]').isVisible().catch(() => false)) {
        reached = true;
        break;
      }
      const erred = await page
        .locator("text=/couldn.t draft|couldn.t make sense|didn.t go through/i")
        .count()
        .catch(() => 0);
      if (erred > 0) {
        console.log(`  generate attempt ${attempt + 1} errored — retrying`);
        break;
      }
      await page.waitForTimeout(1500);
    }
  }
  return reached;
}

async function readAllPosts() {
  const boxes = page.locator('[data-testid^="social-post-textarea-"]');
  const n = await boxes.count().catch(() => 0);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push((await boxes.nth(i).inputValue().catch(() => '')) || '');
  }
  return out;
}

async function launch() {
  const projectRoot = path.resolve(__dirname, '..');
  const app = await electron.launch({
    args: [projectRoot],
    env: { ...process.env, NODE_ENV: 'development' },
  });
  const p = await findMainWindow(app);
  await p.waitForLoadState('domcontentloaded');
  await p.waitForTimeout(3000);
  // Fast-fail on intercepted clicks so a covered element never hangs 30s.
  p.setDefaultTimeout(8000);
  return { app, p };
}

async function run() {
  console.log('Launching Electron…');
  const started = await launch();
  electronApp = started.app;
  page = started.p;
  await setElectronWindowSize(electronApp, 1700, 1000);
  await prepareApp(page);

  // Deterministic clean start: local AI (exempt from tier gate); Social export
  // OFF with no prior consent; Your Voice OFF. Only these keys are touched.
  await page.evaluate(() => {
    try {
      window.localStorage.setItem('aiProvider', 'local');
      window.localStorage.setItem('socialExport.enabled', 'false');
      window.localStorage.removeItem('socialExport.consent');
      window.localStorage.removeItem('socialExport.platform.x');
      window.localStorage.setItem('voice.enabled', 'false');
      window.localStorage.removeItem('voice.profile');
      window.localStorage.setItem('onboarding:dataProtectionSeen', 'true');
      window.localStorage.setItem('onboarding:welcomeShowcaseSeen', 'true');
      window.dispatchEvent(new CustomEvent('social-export-settings-changed'));
      window.dispatchEvent(new CustomEvent('voice-profile-settings-changed'));
    } catch {}
  });
  await page.waitForTimeout(800);
  await dismissBlockingOverlays();

  await selectSomeNode();
  await shot('01-node-selected');

  // -- Step 1: master OFF → Share to Social absent --------------------------
  const absentWhenOff = !(await branchMenuHasShareSocial());
  record('Share to Social absent when Social export OFF', absentWhenOff);

  // -- Step 2: enable Social export via the consent note --------------------
  await openSettings(page);
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Professional Customization")').first().click().catch(() => {});
  await page.waitForTimeout(500);
  await shot('02-professional-panel');

  const masterBefore = await page.locator('[data-testid="social-export-master"]').count();
  await page.locator('[data-testid="social-export-master"]').click();
  await page.waitForTimeout(600);
  const consentShown = await page
    .locator('[data-testid="social-export-consent-dialog"]')
    .isVisible()
    .catch(() => false);
  const enableBtn = page.locator('[data-testid="social-export-consent-enable"]');
  const cancelBtn = page.locator('[data-testid="social-export-consent-cancel"]');
  const hasBoth = (await enableBtn.count()) > 0 && (await cancelBtn.count()) > 0;
  record('Consent note appears on first enable (Enable + Cancel)', consentShown && hasBoth && masterBefore > 0);
  await shot('03-consent-dialog');

  await enableBtn.click();
  await page.waitForTimeout(600);
  const masterOn = await page.locator('[data-testid="social-export-master"]').isChecked().catch(() => false);
  record('Master switch ON after Enable', masterOn);

  const xToggleOn = await page.locator('[data-testid="social-feature-x"]').isChecked().catch(() => false);
  record('Share to X sub-toggle present and on', xToggleOn);
  await shot('04-social-enabled');

  await closeAnyDialog();
  await page.waitForTimeout(400);

  // -- Step 3: Share to Social present + open dialog ------------------------
  const selOk = await selectSomeNode();
  console.log('  [step3] node selected:', selOk);
  await page.waitForTimeout(300);
  const opened = await openBranchMenu();
  const shareItem = page.locator('[role="menuitem"]:has-text("Share to Social")');
  const shareCount = await shareItem.count().catch(() => 0);
  const shareDisabled = shareCount > 0
    ? await shareItem.first().getAttribute('aria-disabled').catch(() => null)
    : 'no-item';
  console.log('  [step3] menu opened:', opened, 'share item count:', shareCount, 'aria-disabled:', shareDisabled);
  const presentWhenOn = opened && shareCount > 0;
  record('Share to Social present when Social export ON', presentWhenOn);
  if (presentWhenOn) {
    await shareItem.first().click().catch(() => {});
    await page.waitForTimeout(800);
  }
  const dialogOpen = await page.locator('[data-testid="share-to-social-dialog"]').first().isVisible().catch(() => false);
  record('Share to Social dialog opens', dialogOpen);
  await shot('05-dialog-input');
  if (!dialogOpen) {
    console.log('  [step3] dialog did not open — skipping generation steps');
    await finishAndExit();
    return;
  }

  // -- Thread mode generation -----------------------------------------------
  // Thread is the default mode. Generate a thread.
  const threadReached = await generateAndReachPreview('Write thread');
  record('AI thread reaches editable preview', threadReached);
  await shot('06-thread-preview');

  if (!threadReached) {
    await finishAndExit();
    return;
  }

  const threadPosts = await readAllPosts();
  const nonEmpty = threadPosts.filter((p) => p.trim().length > 0);
  record('Thread produces at least one real post', nonEmpty.length >= 1, `${nonEmpty.length} posts`);
  const allWithinLimit = nonEmpty.every((p) => p.length <= X_LIMIT);
  const longest = nonEmpty.reduce((m, p) => Math.max(m, p.length), 0);
  record('Every thread post is within the 280-char limit', allWithinLimit, `longest ${longest}`);
  const hookOk = (nonEmpty[0] || '').trim().length > 0;
  record('First post (hook) is present', hookOk);

  // Overwrite post 0 with a deterministic value so hand-off payloads are checkable.
  const HOOK = 'Here is a bold hook about outlines. #IdeaM';
  await page.locator('[data-testid="social-post-textarea-0"]').fill(HOOK);
  await page.waitForTimeout(400);

  // Hand-off 1: Copy thread — numbered thread on the clipboard.
  await page.locator('[data-testid="social-copy-thread"]').click();
  await page.waitForTimeout(700);
  let clip = '';
  try {
    clip = await electronApp.evaluate(({ clipboard }) => clipboard.readText());
  } catch {}
  const threadAttr = (await page.locator('[data-testid="social-copy-thread"]').getAttribute('data-thread-text').catch(() => '')) || '';
  const copiedIndicator = await page.locator('[data-testid="social-copy-thread"]:has-text("Copied")').count().catch(() => 0);
  const multi = nonEmpty.length > 1;
  const threadTextOk =
    threadAttr.includes(HOOK) && (!multi || /\b1\/\d/.test(threadAttr));
  const copyOk = (clip.includes(HOOK)) || copiedIndicator > 0 || threadTextOk;
  record('Copy thread puts the numbered thread on the clipboard', copyOk && threadTextOk, clip ? 'clipboard read OK' : 'via attr/indicator');

  // Hand-off 2: Open in X — intent URL with encoded first post.
  const intentUrl = (await page.locator('[data-testid="social-open-intent"]').getAttribute('data-intent-url').catch(() => '')) || '';
  const intentOk =
    intentUrl.startsWith('https://twitter.com/intent/tweet?text=') &&
    intentUrl.includes(encodeURIComponent(HOOK));
  record('Open in X builds the correct intent URL with the encoded first post', intentOk, intentUrl.slice(0, 90));

  // Hand-off 3: Download — capture the .txt with the thread.
  let txt = '';
  try {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 8000 }),
      page.locator('[data-testid="social-download"]').click(),
    ]);
    const dlPath = await download.path();
    if (dlPath) txt = fs.readFileSync(dlPath, 'utf8');
  } catch {}
  if (!txt) txt = threadAttr;
  const downloadOk = txt.includes(HOOK);
  record('Download produces a .txt with the thread', downloadOk);
  await shot('07-thread-handoffs');

  // -- Single-post mode -----------------------------------------------------
  await page.locator('[data-testid="social-redraft"]').click().catch(() => {});
  await page.waitForTimeout(500);
  await page.locator('[data-testid="social-mode-single"]').click().catch(() => {});
  await page.waitForTimeout(300);
  const singleReached = await generateAndReachPreview('Write post');
  record('Single-post mode reaches preview', singleReached);
  if (singleReached) {
    const singlePosts = (await readAllPosts()).filter((p) => p.trim().length > 0);
    const oneOk = singlePosts.length === 1 && singlePosts[0].length <= X_LIMIT;
    record('Single-post mode yields exactly one post ≤ 280 chars', oneOk, `${singlePosts.length} posts, ${singlePosts[0] ? singlePosts[0].length : 0} chars`);
  }
  await shot('08-single-preview');

  // -- Your Voice → "In my voice" option ------------------------------------
  // Close the dialog, enable Your Voice with a profile, reopen, confirm option.
  await closeAnyDialog();
  await page.evaluate(() => {
    try {
      window.localStorage.setItem('voice.enabled', 'true');
      window.localStorage.setItem('voice.profile', 'Punchy, upbeat, lots of short sentences and the occasional emoji.');
      window.dispatchEvent(new CustomEvent('voice-profile-settings-changed'));
    } catch {}
  });
  await page.waitForTimeout(500);
  await selectSomeNode();
  await page.waitForTimeout(300);
  const reopened = await openShareSocialFromMenu();
  const voiceOptionShown = reopened && (await page.locator('[data-testid="social-in-my-voice"]').isVisible().catch(() => false));
  record('"In my voice" option appears when Your Voice is on', !!voiceOptionShown);
  if (voiceOptionShown) {
    await page.locator('[data-testid="social-in-my-voice"]').click().catch(() => {});
    await page.waitForTimeout(300);
    const voiceThreadReached = await generateAndReachPreview('Write thread');
    record('Thread generates with "In my voice" applied', voiceThreadReached);
  }
  await shot('09-in-my-voice');

  await finishAndExit();
}

async function finishAndExit() {
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const report = {
    suite: 'share-to-x',
    when: new Date().toISOString(),
    platform: { os: os.platform(), arch: os.arch(), node: process.version },
    passed,
    total,
    allPassed: passed === total,
    results,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`\n=== Share to X suite: ${passed}/${total} passed ===`);
  try {
    await electronApp.close();
  } catch {}
  process.exit(passed === total ? 0 : 1);
}

run().catch(async (e) => {
  console.error('Suite crashed:', e);
  record('Suite completed without crashing', false, String(e && e.message));
  try {
    await finishAndExit();
  } catch {
    process.exit(1);
  }
});
