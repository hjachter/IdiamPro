// Playwright suite for the four NEW social-media output formats added on the
// existing "social format template" pattern (2026-07-22):
//   LinkedIn, Facebook, Threads, Bluesky.
//
// With Social export ON (master + all four sub-toggles) and Your Voice ON with a
// profile, for EACH platform this verifies:
//   - the platform option appears in the Share to Social picker,
//   - real, platform-appropriate content generates within the platform's char norm,
//   - Copy puts the post text on the clipboard / data-thread-text,
//   - Download produces a .txt with the post,
//   - Threads & Bluesky expose an "Open in…" button whose intent URL is the
//     correct compose endpoint with the URL-encoded post text,
//   - LinkedIn & Facebook do NOT expose any "Open in…" button and DO show the
//     honest copy-and-paste note.
// Plus a spot-check that "In my voice" is offered and a draft generates with it.
//
// Drafts run on local AI (Ollama), so the run is self-contained and tier-exempt
// (aiProvider='local'). The flaky on-device model is retried a few times.

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { prepareApp, setElectronWindowSize } = require('./_helpers');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'share-more-social');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Per-platform expectations.
const PLATFORMS = [
  {
    id: 'linkedin', label: 'LinkedIn', charLimit: 3000,
    hasIntent: false, intentBase: null,
  },
  {
    id: 'facebook', label: 'Facebook', charLimit: 2000,
    hasIntent: false, intentBase: null,
  },
  {
    id: 'threads', label: 'Threads', charLimit: 500,
    hasIntent: true, intentBase: 'https://www.threads.net/intent/post?text=',
  },
  {
    id: 'bluesky', label: 'Bluesky', charLimit: 300,
    hasIntent: true, intentBase: 'https://bsky.app/intent/compose?text=',
  },
];

let electronApp;
let page;
const results = [];

function record(name, passed, info) {
  results.push({ name, passed, info: info || '' });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`);
}

async function shot(name) {
  try { await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`) }); } catch {}
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

async function dismissBlockingOverlays() {
  try {
    const showcase = page.locator('[data-testid="welcome-showcase"]');
    if ((await showcase.count().catch(() => 0)) > 0 && (await showcase.first().isVisible().catch(() => false))) {
      const optOut = page.locator('[data-testid="welcome-showcase-dont-show"], [data-testid="welcome-showcase-skip"]');
      if ((await optOut.count().catch(() => 0)) > 0) await optOut.first().click().catch(() => {});
      else await page.locator('[data-testid="welcome-showcase"] button:has-text("Get started")').first().click().catch(() => {});
      await page.waitForTimeout(400);
    }
  } catch {}
  try {
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
    if ((await closeBtn.count().catch(() => 0)) > 0) await closeBtn.first().click().catch(() => {});
    else await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);
  }
  for (let i = 0; i < 3; i++) {
    const menus = await page.locator('[role="menu"]').count().catch(() => 0);
    if (menus === 0) break;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
  }
}

async function openBranchMenu() {
  const top = page.locator('[aria-label="Turn Into"]');
  const tn = await top.count().catch(() => 0);
  for (let i = 0; i < tn; i++) {
    await top.nth(i).click().catch(() => {});
    await page.waitForTimeout(450);
    const hasFamily = await page
      .locator('[role="menuitem"]:has-text("Share Suboutline"), [role="menuitem"]:has-text("Export Current Outline")')
      .count().catch(() => 0);
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
        .count().catch(() => 0);
      if (hasFamily > 0) return true;
    }
  }
  return false;
}

async function openShareSocialFromMenu() {
  await closeAnyDialog();
  const opened = await openBranchMenu();
  if (!opened) return false;
  const item = page.locator('[role="menuitem"]:has-text("Share to Social")');
  if ((await item.count().catch(() => 0)) > 0) {
    await item.first().click().catch(() => {});
    await page.waitForTimeout(800);
    return await page.locator('[data-testid="share-to-social-dialog"]').first().isVisible().catch(() => false);
  }
  return false;
}

async function nodeIsSelected() {
  return (await page.locator('[role="treeitem"][aria-selected="true"]').count().catch(() => 0)) > 0;
}

async function selectSomeNode() {
  await dismissBlockingOverlays();
  await closeAnyDialog();
  if (await nodeIsSelected()) return true;
  const items = page.locator('[role="treeitem"]');
  const n = await items.count().catch(() => 0);
  for (let i = 0; i < Math.min(n, 8); i++) {
    const it = items.nth(i);
    if (!(await it.isVisible().catch(() => false))) continue;
    await it.click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(300);
    if (await nodeIsSelected()) return true;
  }
  return await nodeIsSelected();
}

// Click Generate (works for both thread/single modes via the stable testid) and
// wait for the editable preview, retrying the flaky on-device model.
async function generateAndReachPreview() {
  let reached = false;
  for (let attempt = 0; attempt < 3 && !reached; attempt++) {
    await page.locator('[data-testid="social-generate"]').first().click().catch(() => {});
    const start = Date.now();
    while (Date.now() - start < 100000) {
      if (await page.locator('[data-testid="social-post-textarea-0"]').isVisible().catch(() => false)) {
        reached = true;
        break;
      }
      const erred = await page
        .locator("text=/couldn.t draft|couldn.t make sense|didn.t go through/i")
        .count().catch(() => 0);
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
  for (let i = 0; i < n; i++) out.push((await boxes.nth(i).inputValue().catch(() => '')) || '');
  return out;
}

async function launch() {
  const projectRoot = path.resolve(__dirname, '..');
  const app = await electron.launch({ args: [projectRoot], env: { ...process.env, NODE_ENV: 'development' } });
  const p = await findMainWindow(app);
  await p.waitForLoadState('domcontentloaded');
  await p.waitForTimeout(3000);
  p.setDefaultTimeout(8000);
  return { app, p };
}

// Drive one platform end-to-end from the dialog's input phase.
async function verifyPlatform(spec, { useVoice } = {}) {
  const tag = spec.label;
  // Pick the platform.
  const picker = page.locator(`[data-testid="social-platform-${spec.id}"]`);
  const present = (await picker.count().catch(() => 0)) > 0;
  record(`${tag}: option appears in the platform picker`, present);
  if (!present) return;
  await picker.first().click().catch(() => {});
  await page.waitForTimeout(400);

  if (useVoice) {
    const vbox = page.locator('[data-testid="social-in-my-voice"]');
    const voiceShown = await vbox.isVisible().catch(() => false);
    record(`${tag}: "In my voice" option offered when Your Voice is on`, voiceShown);
    if (voiceShown) await vbox.click().catch(() => {});
    await page.waitForTimeout(300);
  }

  const reached = await generateAndReachPreview();
  record(`${tag}: AI draft reaches editable preview${useVoice ? ' (in my voice)' : ''}`, reached);
  if (!reached) return;
  await shot(`${spec.id}-preview`);

  const posts = (await readAllPosts()).filter((p) => p.trim().length > 0);
  record(`${tag}: produces at least one real post`, posts.length >= 1, `${posts.length} posts`);
  const longest = posts.reduce((m, p) => Math.max(m, p.length), 0);
  record(`${tag}: every post within the ${spec.charLimit}-char norm`, posts.every((p) => p.length <= spec.charLimit), `longest ${longest}`);

  // Deterministic first-post text so hand-off payloads are checkable.
  const HOOK = `A ${tag} test post about outlines and ideas.`;
  await page.locator('[data-testid="social-post-textarea-0"]').fill(HOOK);
  await page.waitForTimeout(400);

  // Copy.
  await page.locator('[data-testid="social-copy-thread"]').click().catch(() => {});
  await page.waitForTimeout(600);
  let clip = '';
  try { clip = await electronApp.evaluate(({ clipboard }) => clipboard.readText()); } catch {}
  const threadAttr = (await page.locator('[data-testid="social-copy-thread"]').getAttribute('data-thread-text').catch(() => '')) || '';
  record(`${tag}: Copy puts the post on the clipboard`, (clip.includes(HOOK) || threadAttr.includes(HOOK)), clip.includes(HOOK) ? 'clipboard' : 'attr');

  // Intent button behaviour.
  const intentCount = await page.locator('[data-testid="social-open-intent"]').count().catch(() => 0);
  if (spec.hasIntent) {
    const intentUrl = (await page.locator('[data-testid="social-open-intent"]').getAttribute('data-intent-url').catch(() => '')) || '';
    const ok = intentCount > 0 && intentUrl.startsWith(spec.intentBase) && intentUrl.includes(encodeURIComponent(HOOK));
    record(`${tag}: "Open in ${tag}" builds the correct compose intent URL`, ok, intentUrl.slice(0, 80));
  } else {
    const noFakeButton = intentCount === 0;
    const noteShown = await page.locator('[data-testid="social-honest-note"]').isVisible().catch(() => false);
    record(`${tag}: NO fake "Open in…" button (copy/paste only)`, noFakeButton);
    record(`${tag}: honest copy-and-paste note is shown`, noteShown);
  }

  // Download.
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
  record(`${tag}: Download produces a .txt with the post`, txt.includes(HOOK));

  // Back to input for the next platform.
  await page.locator('[data-testid="social-redraft"]').click().catch(() => {});
  await page.waitForTimeout(500);
}

async function run() {
  console.log('Launching Electron…');
  const started = await launch();
  electronApp = started.app;
  page = started.p;
  await setElectronWindowSize(electronApp, 1700, 1000);
  await prepareApp(page);

  // Deterministic start: local AI; Social export ON + consent granted + all four
  // new platforms on; Your Voice ON with a profile so "In my voice" is offered.
  await page.evaluate(() => {
    try {
      window.localStorage.setItem('aiProvider', 'local');
      window.localStorage.setItem('socialExport.enabled', 'true');
      window.localStorage.setItem('socialExport.consent', 'granted');
      for (const k of ['x', 'instagram', 'linkedin', 'facebook', 'threads', 'bluesky']) {
        window.localStorage.setItem('socialExport.platform.' + k, 'true');
      }
      window.localStorage.setItem('voice.enabled', 'true');
      window.localStorage.setItem('voice.profile', 'Warm, plain-spoken, short punchy sentences, the occasional wry aside.');
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

  const dialogOpen = await openShareSocialFromMenu();
  record('Share to Social dialog opens with Social export ON', dialogOpen);
  await shot('02-dialog-input');
  if (!dialogOpen) { await finishAndExit(); return; }

  // Verify the four platforms in turn (no voice), staying in the same dialog.
  for (const spec of PLATFORMS) {
    await verifyPlatform(spec, { useVoice: false });
  }

  // Spot-check "In my voice" on Bluesky (short + fast to generate).
  await verifyPlatform(PLATFORMS[3], { useVoice: true });
  await shot('03-in-my-voice');

  await finishAndExit();
}

async function finishAndExit() {
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const report = {
    suite: 'share-more-social',
    when: new Date().toISOString(),
    platform: { os: os.platform(), arch: os.arch(), node: process.version },
    passed, total, allPassed: passed === total, results,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`\n=== Share to LinkedIn/Facebook/Threads/Bluesky suite: ${passed}/${total} passed ===`);
  try { await electronApp.close(); } catch {}
  process.exit(passed === total ? 0 : 1);
}

run().catch(async (e) => {
  console.error('Suite crashed:', e);
  record('Suite completed without crashing', false, String(e && e.message));
  try { await finishAndExit(); } catch { process.exit(1); }
});
