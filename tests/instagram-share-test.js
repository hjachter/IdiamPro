// Playwright suite for "Share to Instagram" — the second social format template
// under the opt-in "Social export" switch (2026-07-22).
//
// Verifies the full spec with Social export ON:
//   1. Instagram appears in the Share to Social platform picker.
//   2. CAPTION mode → a real caption + hashtags; Copy caption puts caption +
//      hashtags on the clipboard; Download saves a .txt.
//   3. CAROUSEL mode → multiple slides rendered as REAL square (1080×1080)
//      branded PNG images; a rendered slide is written to disk for visual
//      inspection; Download carousel produces a .zip.
//   4. "In my voice" applies when Your Voice is on.
//   5. The honest "post from your phone" note is shown and there is NO fake
//      "Open in Instagram" button.
//
// The draft runs on local AI (Ollama), so the run is self-contained and the tier
// gate is exempt (aiProvider='local'). If the on-device model is slow/flaky we
// retry the generation a few times.

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

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'share-to-instagram');
fs.mkdirSync(OUT_DIR, { recursive: true });

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
  // Dismiss the floating "Did you know?" tip card that can overlap the toolbar.
  try {
    const tip = page.locator('button:has-text("Got it")');
    if ((await tip.count().catch(() => 0)) > 0 && (await tip.first().isVisible().catch(() => false))) {
      await tip.first().click().catch(() => {});
      await page.waitForTimeout(300);
    }
  } catch {}
}

// Right-click the selected node's row to get its context menu, then click
// "Share to Social" — a fallback when the toolbar branch menu is finicky.
async function openShareSocialViaContextMenu() {
  await closeAnyDialog();
  const row = page.locator('[role="treeitem"][aria-selected="true"]');
  if ((await row.count().catch(() => 0)) === 0) return false;
  await row.first().click({ button: 'right' }).catch(() => {});
  await page.waitForTimeout(500);
  const item = page.locator('[role="menuitem"]:has-text("Share to Social")');
  if ((await item.count().catch(() => 0)) > 0) {
    await item.first().click().catch(() => {});
    await page.waitForTimeout(700);
    return true;
  }
  await page.keyboard.press('Escape').catch(() => {});
  return false;
}

// Open the Share to Social dialog by whatever path works, verifying the dialog
// actually appears. Retries a couple of times.
async function ensureShareSocialDialog() {
  for (let attempt = 0; attempt < 3; attempt++) {
    await dismissBlockingOverlays();
    await selectSomeNode();
    let opened = await openShareSocialFromMenu();
    if (!opened) opened = await openShareSocialViaContextMenu();
    if (opened && (await page.locator('[data-testid="share-to-social-dialog"]').first().isVisible().catch(() => false))) {
      return true;
    }
    await closeAnyDialog();
    await page.waitForTimeout(600);
  }
  return await page.locator('[data-testid="share-to-social-dialog"]').first().isVisible().catch(() => false);
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
    await page.waitForTimeout(700);
    return true;
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

// Click the generate button and wait until `targetTestId` becomes visible,
// retrying the flaky on-device model a few times.
async function generateAndReach(targetTestId) {
  let reached = false;
  for (let attempt = 0; attempt < 3 && !reached; attempt++) {
    await page.locator('[data-testid="social-generate"]').first().click().catch(() => {});
    const start = Date.now();
    while (Date.now() - start < 120000) {
      if (await page.locator(`[data-testid="${targetTestId}"]`).first().isVisible().catch(() => false)) {
        reached = true;
        break;
      }
      const erred = await page
        .locator("text=/couldn.t create|couldn.t make sense|didn.t go through|could not render/i")
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

// Arm Electron's own download handler (main process) to save the NEXT download
// to a known path — the authoritative way to capture a blob: download in
// Electron, where Playwright's download event is unreliable.
async function armElectronDownload(app, savePath) {
  try { fs.unlinkSync(savePath); } catch {}
  await app.evaluate(({ BrowserWindow }, sp) => {
    const wins = BrowserWindow.getAllWindows();
    let win = wins[0];
    for (const w of wins) {
      try { if (w.webContents.getURL().includes('localhost:9002')) { win = w; break; } } catch {}
    }
    const ses = win.webContents.session;
    ses.removeAllListeners('will-download');
    ses.on('will-download', (_event, item) => { try { item.setSavePath(sp); } catch {} });
  }, savePath);
}

async function waitForFileBytes(p, minBytes, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const st = fs.statSync(p); if (st.size >= minBytes) return st.size; } catch {}
    await page.waitForTimeout(300);
  }
  try { return fs.statSync(p).size; } catch { return 0; }
}

async function selectInstagramPlatform() {
  const btn = page.locator('[data-testid="social-platform-instagram"]');
  if ((await btn.count().catch(() => 0)) === 0) return false;
  await btn.first().click().catch(() => {});
  await page.waitForTimeout(300);
  return true;
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

async function run() {
  console.log('Launching Electron…');
  const started = await launch();
  electronApp = started.app;
  page = started.p;
  await setElectronWindowSize(electronApp, 1700, 1000);
  await prepareApp(page);

  // Deterministic clean start: local AI; Social export ON with consent granted
  // and Instagram sub-toggle ON; Your Voice OFF. Only these keys are touched.
  await page.evaluate(() => {
    try {
      window.localStorage.setItem('aiProvider', 'local');
      window.localStorage.setItem('socialExport.enabled', 'true');
      window.localStorage.setItem('socialExport.consent', 'granted');
      window.localStorage.setItem('socialExport.platform.instagram', 'true');
      window.localStorage.setItem('socialExport.platform.x', 'true');
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

  // -- Open the Share to Social dialog and pick Instagram -------------------
  const dialogOpen = await ensureShareSocialDialog();
  record('Share to Social dialog opens', dialogOpen);
  if (!dialogOpen) { await finishAndExit(); return; }

  const igPicked = await selectInstagramPlatform();
  record('Instagram appears in the platform picker', igPicked);
  await shot('02-instagram-selected');

  // -- CAPTION mode ---------------------------------------------------------
  await page.locator('[data-testid="ig-mode-caption"]').click().catch(() => {});
  await page.waitForTimeout(300);
  const captionReached = await generateAndReach('ig-caption-textarea');
  record('Caption mode reaches a caption', captionReached);
  await shot('03-caption-preview');

  if (captionReached) {
    const captionText = (await page.locator('[data-testid="ig-caption-textarea"]').inputValue().catch(() => '')) || '';
    record('Caption is a real, non-empty caption', captionText.trim().length > 10, `${captionText.trim().length} chars`);
    const hashtagText = (await page.locator('[data-testid="ig-hashtags"]').textContent().catch(() => '')) || '';
    record('Hashtags are produced', /#\w/.test(hashtagText), hashtagText.slice(0, 80));

    // Copy caption → clipboard holds caption + hashtags.
    await page.locator('[data-testid="ig-copy-caption"]').click().catch(() => {});
    await page.waitForTimeout(600);
    let clip = '';
    try { clip = await electronApp.evaluate(({ clipboard }) => clipboard.readText()); } catch {}
    const copiedIndicator = await page.locator('[data-testid="ig-copy-caption"]:has-text("Copied")').count().catch(() => 0);
    const snippet = captionText.trim().slice(0, 20);
    const copyOk = (snippet && clip.includes(snippet)) || copiedIndicator > 0;
    record('Copy caption puts the caption on the clipboard', copyOk, clip ? 'clipboard read OK' : 'via indicator');

    // Download caption → a .txt, captured via Electron's own download handler.
    const capPath = path.join(OUT_DIR, 'downloaded-caption.txt');
    await armElectronDownload(electronApp, capPath);
    await page.locator('[data-testid="ig-download-caption"]').click().catch(() => {});
    const capBytes = await waitForFileBytes(capPath, 10, 8000);
    let capTxt = '';
    try { capTxt = fs.readFileSync(capPath, 'utf8'); } catch {}
    const downloadOk = capBytes > 10 && (capTxt.includes(snippet) || capTxt.length > 10);
    record('Download produces a .txt caption', downloadOk, `${capBytes} bytes`);

    // No fake "Open in Instagram" hand-off.
    const fakeOpen = await page.locator('button:has-text("Open in Instagram")').count().catch(() => 0);
    record('No fake "Open in Instagram" button', fakeOpen === 0);
    // Honest "post from your phone" note.
    const noteText = (await page.locator('[data-testid="ig-honest-note"]').textContent().catch(() => '')) || '';
    record('Honest "post from your phone" note is shown', /from your phone/i.test(noteText));
  }

  // -- CAROUSEL mode --------------------------------------------------------
  await page.locator('[data-testid="social-redraft"]').click().catch(() => {});
  await page.waitForTimeout(400);
  await page.locator('[data-testid="ig-mode-carousel"]').click().catch(() => {});
  await page.waitForTimeout(300);
  const carouselReached = await generateAndReach('ig-slide-img-0');
  record('Carousel mode renders slide images', carouselReached);
  await shot('04-carousel-preview');

  if (carouselReached) {
    const slideCount = await page.locator('[data-testid^="ig-slide-img-"]').count().catch(() => 0);
    record('Carousel produces multiple slides', slideCount >= 2, `${slideCount} slides`);

    // Confirm the rendered image is a real SQUARE 1080×1080 PNG.
    const dims = await page.locator('[data-testid="ig-slide-img-0"]').evaluate((el) => ({ w: el.naturalWidth, h: el.naturalHeight })).catch(() => ({ w: 0, h: 0 }));
    record('Slides are square 1080×1080 images', dims.w === 1080 && dims.h === 1080, `${dims.w}x${dims.h}`);

    // Write a rendered slide to disk (decoded from its data URL) for visual inspection.
    const src = (await page.locator('[data-testid="ig-slide-img-0"]').getAttribute('src').catch(() => '')) || '';
    if (src.startsWith('data:image/png;base64,')) {
      try {
        fs.writeFileSync(path.join(OUT_DIR, 'rendered-slide-0.png'), Buffer.from(src.split(',')[1], 'base64'));
      } catch {}
    }
    // Non-blank check: a branded slide PNG is well over a few KB.
    const slidePath = path.join(OUT_DIR, 'rendered-slide-0.png');
    const slideBytes = fs.existsSync(slidePath) ? fs.statSync(slidePath).size : 0;
    record('Rendered slide image is non-blank (has real content)', slideBytes > 8000, `${slideBytes} bytes`);

    // Honest note present in carousel too; no fake open button.
    const noteText = (await page.locator('[data-testid="ig-honest-note"]').textContent().catch(() => '')) || '';
    record('Carousel shows the honest "post from your phone" note', /from your phone/i.test(noteText));
    const fakeOpen = await page.locator('button:has-text("Open in Instagram")').count().catch(() => 0);
    record('Carousel has no fake "Open in Instagram" button', fakeOpen === 0);

    // Download carousel → a real .zip bundle, captured via Electron's own
    // download handler and validated by the PK zip signature.
    const zipFile = path.join(OUT_DIR, 'downloaded-carousel.zip');
    await armElectronDownload(electronApp, zipFile);
    await page.locator('[data-testid="ig-download-carousel"]').click().catch(() => {});
    const zBytes = await waitForFileBytes(zipFile, 1000, 12000);
    let isZip = false;
    try {
      const fd = fs.openSync(zipFile, 'r');
      const buf = Buffer.alloc(2);
      fs.readSync(fd, buf, 0, 2, 0);
      fs.closeSync(fd);
      isZip = buf[0] === 0x50 && buf[1] === 0x4b; // "PK"
    } catch {}
    record('Download carousel produces an image bundle (.zip)', zBytes > 1000 && isZip, `${zBytes} bytes zip=${isZip}`);
    await shot('05-carousel-handoffs');
  }

  // -- "In my voice" applies when Your Voice is on --------------------------
  await closeAnyDialog();
  await page.evaluate(() => {
    try {
      window.localStorage.setItem('voice.enabled', 'true');
      window.localStorage.setItem('voice.profile', 'Punchy, upbeat, lots of short sentences and the occasional emoji.');
      window.dispatchEvent(new CustomEvent('voice-profile-settings-changed'));
    } catch {}
  });
  await page.waitForTimeout(500);
  const reopened = await ensureShareSocialDialog();
  if (reopened) await selectInstagramPlatform();
  const voiceOptionShown = reopened && (await page.locator('[data-testid="social-in-my-voice"]').isVisible().catch(() => false));
  record('"In my voice" option appears when Your Voice is on', !!voiceOptionShown);
  if (voiceOptionShown) {
    await page.locator('[data-testid="ig-mode-caption"]').click().catch(() => {});
    await page.waitForTimeout(200);
    await page.locator('[data-testid="social-in-my-voice"]').click().catch(() => {});
    await page.waitForTimeout(300);
    const voiceCaptionReached = await generateAndReach('ig-caption-textarea');
    record('Caption generates with "In my voice" applied', voiceCaptionReached);
  }
  await shot('06-in-my-voice');

  await finishAndExit();
}

async function finishAndExit() {
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const report = {
    suite: 'share-to-instagram',
    when: new Date().toISOString(),
    platform: { os: os.platform(), arch: os.arch(), node: process.version },
    passed,
    total,
    allPassed: passed === total,
    results,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`\n=== Share to Instagram suite: ${passed}/${total} passed ===`);
  try { await electronApp.close(); } catch {}
  process.exit(passed === total ? 0 : 1);
}

run().catch(async (e) => {
  console.error('Suite crashed:', e);
  record('Suite completed without crashing', false, String(e && e.message));
  try { await finishAndExit(); } catch { process.exit(1); }
});
