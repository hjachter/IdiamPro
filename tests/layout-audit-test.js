// Layout audit across arbitrary window sizes (iOS/iPadOS 27 readiness, 2026-09)
//
// From iPadOS 27 the app can no longer assume a fixed fullscreen size — users
// can resize the window arbitrarily. This suite launches ITS OWN Electron
// instance (never touches the founder's running app), overrides the window's
// minimum size, and drives REAL BrowserWindow resizes (not viewport emulation)
// through a matrix of phone / split-view / tablet / desktop / odd sizes.
//
// At each size it measures, objectively:
//   - page-level horizontal overflow (scrollWidth vs innerWidth) + offenders
//   - clipped buttons in the outline header row and action toolbar
//   - Help (?) and AI button visibility (codified: ALWAYS visible)
//   - Settings dialog fit: taller/wider than window? footer buttons reachable?
//   - editor pane visibility with the sidebar open and closed
// ...and screenshots every surface to test-screenshots/layout-audit/ as
// <width>x<height>-<surface>.png for human inspection.
//
// READ-ONLY audit: makes no source changes. Creates one throwaway outline
// ("ZZ Layout Audit ...") inside its own Electron instance.
//
// Run: node tests/layout-audit-test.js   (dev server must be up on 9002)

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { prepareApp, openSettings } = require('./_helpers');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT = path.resolve(__dirname, '..', 'test-screenshots', 'layout-audit');
fs.mkdirSync(OUT, { recursive: true });

// The audit matrix: [width, height, label]
// Optionally audit a subset: AUDIT_SIZES="1024x768,900x500" node tests/layout-audit-test.js
// Results merge into measurements.json (existing records for other sizes kept).
const SIZES_ALL = [
  [390, 844, 'phone'],
  [320, 568, 'phone-worst'],
  [507, 744, 'splitview-narrow'],
  [639, 744, 'splitview-half'],
  [678, 1024, 'splitview-tall'],
  [768, 1024, 'tablet-portrait'],
  [834, 1112, 'tablet-11in'],
  [1024, 768, 'tablet-landscape'],
  [1280, 800, 'desktop-small'],
  [1440, 900, 'desktop'],
  [555, 700, 'odd-mid'],
  [900, 500, 'odd-short'],
  [1100, 600, 'odd-wide-short'],
];
const SIZES = process.env.AUDIT_SIZES
  ? SIZES_ALL.filter(([w, h]) => process.env.AUDIT_SIZES.split(',').includes(`${w}x${h}`))
  : SIZES_ALL;

let electronApp;
let page;
const records = [];

function log(...a) { console.log(...a); }

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

async function launch() {
  const projectRoot = path.resolve(__dirname, '..');
  electronApp = await electron.launch({
    args: [projectRoot],
    env: { ...process.env, NODE_ENV: 'development' },
  });
  page = await findMainWindow(electronApp);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  if (!page.url().includes('/app')) {
    await page.evaluate(() => { window.location.href = '/app'; });
    await page.waitForLoadState('domcontentloaded');
    try {
      await page.locator('button:has-text("New Outline")').waitFor({ state: 'visible', timeout: 45000 });
    } catch { await page.waitForTimeout(5000); }
  }
  await prepareApp(page);
  // The dev server can serve a transient error-boundary screen when a second
  // Electron instance attaches mid-compile. Recover via Try again/Reload.
  for (let i = 0; i < 4; i++) {
    const errScreen = await page.locator('text=Something went wrong').first().isVisible().catch(() => false);
    if (!errScreen) break;
    log('  error boundary showing — recovering (attempt ' + (i + 1) + ')');
    const tryAgain = page.locator('button:has-text("Try again")').first();
    const reload = page.locator('button:has-text("Reload page")').first();
    if (i < 2 && (await tryAgain.isVisible().catch(() => false))) await tryAgain.click().catch(() => {});
    else if (await reload.isVisible().catch(() => false)) await reload.click().catch(() => {});
    else await page.reload().catch(() => {});
    await page.waitForTimeout(5000);
    await prepareApp(page);
  }
  // COST SAFETY: never allow a cloud AI call from this suite.
  await page.evaluate(() => {
    try { window.localStorage.setItem('aiProvider', 'local'); } catch {}
    try { window.localStorage.setItem('discovery:professionalMode', 'true'); } catch {}
  }).catch(() => {});
  // Allow arbitrary tiny sizes: the app ships minWidth 800 x minHeight 600,
  // which would silently clamp our matrix. Real window resizes only.
  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find(
      (w) => !w.webContents.getURL().startsWith('devtools://')
    );
    if (win) { win.setMinimumSize(200, 300); win.setResizable(true); }
  });
  log('App ready at', page.url());
}

async function setWindowSize(w, h) {
  await electronApp.evaluate(({ BrowserWindow }, size) => {
    const win = BrowserWindow.getAllWindows().find(
      (x) => !x.webContents.getURL().startsWith('devtools://')
    );
    if (win) win.setBounds({ x: 20, y: 40, width: size.w, height: size.h });
  }, { w, h });
  await page.waitForTimeout(900); // ResizeObserver + React settle
  return electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find(
      (x) => !x.webContents.getURL().startsWith('devtools://')
    );
    const b = win ? win.getBounds() : null;
    return b ? { w: b.width, h: b.height } : null;
  });
}

async function shot(name) {
  try { await page.screenshot({ path: path.join(OUT, `${name}.png`) }); } catch (e) { log('  shot failed', name, e.message); }
}

// ---- measurements -------------------------------------------------------

async function pageOverflow() {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const iw = window.innerWidth, ih = window.innerHeight;
    const hOverflow = Math.max(doc.scrollWidth - iw, document.body ? document.body.scrollWidth - iw : 0);
    // Scan for elements poking past the right edge of the viewport.
    const offenders = [];
    const els = document.querySelectorAll('body *');
    for (const el of els) {
      if (offenders.length >= 8) break;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (cs.position === 'fixed' && (r.right <= 0 || r.left >= iw)) continue; // intentionally offscreen
      if (r.right > iw + 4 && r.left < iw) {
        const id = el.getAttribute('data-testid') || el.getAttribute('aria-label') || el.id ||
          (el.className && typeof el.className === 'string' ? el.className.split(' ').slice(0, 2).join('.') : el.tagName);
        offenders.push(`${el.tagName.toLowerCase()}[${String(id).slice(0, 40)}] right=${Math.round(r.right)}`);
      }
    }
    return { innerWidth: iw, innerHeight: ih, hOverflow, offenders };
  });
}

async function inspectToolbar(testid) {
  const toolbar = page.locator(`[data-testid="${testid}"]`);
  if ((await toolbar.count()) === 0) return { present: false };
  const box = await toolbar.first().boundingBox();
  if (!box) return { present: false };
  const iw = (await page.evaluate(() => window.innerWidth));
  const buttons = toolbar.first().locator('button, [role="button"]');
  const n = await buttons.count();
  let visible = 0, clipped = 0;
  const clippedLabels = [];
  for (let i = 0; i < n; i++) {
    const b = buttons.nth(i);
    if (!(await b.isVisible().catch(() => false))) continue;
    const bb = await b.boundingBox();
    if (!bb || bb.width === 0) continue;
    visible++;
    const pastToolbar = bb.x < box.x - 2 || bb.x + bb.width > box.x + box.width + 2;
    const pastViewport = bb.x + bb.width > iw + 2 || bb.x < -2;
    if (pastToolbar || pastViewport) {
      clipped++;
      const label = (await b.getAttribute('aria-label')) || (await b.textContent()) || '?';
      clippedLabels.push(String(label).trim().slice(0, 24));
    }
  }
  return { present: true, visible, clipped, clippedLabels, w: Math.round(box.width) };
}

async function visibleOnScreen(selector) {
  const el = page.locator(selector).first();
  if ((await el.count().catch(() => 0)) === 0) return false;
  if (!(await el.isVisible().catch(() => false))) return false;
  const bb = await el.boundingBox().catch(() => null);
  if (!bb) return false;
  const vp = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
  return bb.x >= -2 && bb.y >= -2 && bb.x + bb.width <= vp.w + 2 && bb.y + bb.height <= vp.h + 2;
}

async function measureDialog() {
  return page.evaluate(() => {
    // Prefer the SETTINGS dialog (contains Theme / Subscription copy) — on
    // narrow widths the sidebar renders as a sheet with role=dialog too.
    const all = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"]'));
    const dlg = all.find((d) => /Theme|Subscription Plan|Appearance/.test(d.textContent || '')) || all[0];
    if (!dlg) return { present: false };
    const r = dlg.getBoundingClientRect();
    const iw = window.innerWidth, ih = window.innerHeight;
    // Is the dialog itself internally scrollable (content taller than box)?
    const scrollable = dlg.scrollHeight > dlg.clientHeight + 4 ||
      Array.from(dlg.querySelectorAll('*')).some((el) => {
        const cs = getComputedStyle(el);
        return /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 4;
      });
    // Any button inside the dialog fully below the window bottom (unreachable
    // unless something scrolls)?
    let buttonsBelowFold = 0;
    const btnLabels = [];
    for (const b of dlg.querySelectorAll('button')) {
      const br = b.getBoundingClientRect();
      if (br.height === 0) continue;
      if (br.top >= ih - 2) {
        buttonsBelowFold++;
        if (btnLabels.length < 5) btnLabels.push((b.getAttribute('aria-label') || b.textContent || '?').trim().slice(0, 24));
      }
    }
    return {
      present: true,
      w: Math.round(r.width), h: Math.round(r.height),
      overflowsWidth: r.width > iw + 2 || r.left < -2 || r.right > iw + 2,
      overflowsHeight: r.height > ih + 2 || r.top < -2 || r.bottom > ih + 2,
      tallerThanWindow: r.height > ih + 2,
      scrollable,
      buttonsBelowFold, btnLabels,
    };
  });
}

// ---- fixture outline ----------------------------------------------------

async function buildAuditOutline() {
  // Fresh throwaway outline with nesting + long names + long editor content.
  // The sidebar "New Outline" text button may be hidden (collapsed sidebar);
  // fall back to the toolbar's icon button (aria-label="New outline").
  await setSidebar(true);
  const textBtn = page.locator('button:has-text("New Outline")').first();
  const iconBtn = page.locator('[aria-label="New outline"]').first();
  if (await textBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await textBtn.click();
  } else if (await iconBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await iconBtn.click();
  } else {
    await shot('00-no-new-outline-button');
    throw new Error('No New Outline button found (text or icon)');
  }
  await page.waitForTimeout(1500);
  const root = page.locator('[role="treeitem"] span:has-text("Untitled Outline")').first();
  if ((await root.count()) > 0) {
    await root.dblclick();
    await page.waitForTimeout(400);
    const input = page.locator('input[type="text"]:visible').first();
    if (await input.isVisible().catch(() => false)) {
      await input.fill('ZZ Layout Audit — A Deliberately Very Long Root Node Name To Stress Truncation And Wrapping Behavior');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
    }
  }
  // Add sibling + nested nodes via Enter/Tab (per core-outlining sweep).
  const first = page.locator('[role="treeitem"]').first();
  await first.click();
  await page.waitForTimeout(300);
  const names = [
    ['Strategic considerations for the third-quarter product marketing rollout across regions', 0],
    ['A nested child node that also carries an uncomfortably long name for narrow panes', 1],
    ['Grandchild node — deepest level, long name, tests indent + truncation together nicely', 2],
    ['Short node', 1],
    ['Another top-level sibling with a fairly long descriptive name for the audit', 0],
  ];
  let lastDepth = 0;
  for (const [name, depth] of names) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(350);
    while (lastDepth < depth) { await page.keyboard.press('Tab'); await page.waitForTimeout(250); lastDepth++; }
    while (lastDepth > depth) { await page.keyboard.press('Shift+Tab'); await page.waitForTimeout(250); lastDepth--; }
    const input = page.locator('input[type="text"]:visible').first();
    if (await input.isVisible().catch(() => false)) {
      await input.fill(name);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      // Enter both commits the name AND creates the next node in some builds —
      // re-select the named node to keep depth bookkeeping stable.
    } else {
      await page.keyboard.type(name);
      await page.waitForTimeout(200);
    }
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(400);
  // Type long content into the first real node's editor.
  const node = page.locator('[role="treeitem"]').nth(1);
  await node.click().catch(() => {});
  await page.waitForTimeout(600);
  const editor = page.locator('.ProseMirror').first();
  if (await editor.isVisible().catch(() => false)) {
    await editor.click();
    await page.waitForTimeout(300);
    await page.keyboard.type(
      'This paragraph exists to give the content editor something real to lay out. ' +
      'It should wrap cleanly at every window width without producing a horizontal scrollbar. ' +
      'Superlongunbrokentokenwithoutanyspacesatalltotestwordbreakoverflowbehaviorinnarrowwindows. ' +
      'And a final sentence to give the paragraph a little more height.'
    );
    await page.waitForTimeout(500);
  }
  await shot('00-fixture-outline');
}

// Dismiss the "Did you know?" discovery toast permanently so it can't cover
// surfaces or poke past the window edge during the audit.
async function dismissDiscoveryToast() {
  try {
    const toast = page.locator('[class*="discovery-toast"], div:has(> * >> text="DID YOU KNOW?")').first();
    const dontShow = page.locator('text=Don’t show me this again').first();
    if (await dontShow.isVisible().catch(() => false)) {
      // check the opt-out box (checkbox sits just before the label)
      const box = page.locator('button[role="checkbox"]').last();
      await box.click().catch(() => {});
      await page.waitForTimeout(200);
    }
    const gotIt = page.locator('button:has-text("Got it")').first();
    if (await gotIt.isVisible().catch(() => false)) {
      await gotIt.click().catch(() => {});
      await page.waitForTimeout(400);
    }
  } catch {}
}

// Close any stray open dropdown menu (e.g. the More tools menu that
// openSettings' first attempt can leave open) without touching dialogs.
async function closeStrayMenus() {
  const menuOpen = await page
    .evaluate(() => !!document.querySelector('[role="menu"][data-state="open"], [role="menu"]'))
    .catch(() => false);
  if (menuOpen) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
  }
}

// Close any open modal (welcome, recovery prompt, etc.) whose backdrop would
// swallow clicks. Escape a few times, then click visible close buttons.
async function dismissAnyDialog() {
  for (let i = 0; i < 4; i++) {
    const overlay = await page
      .evaluate(() => !!document.querySelector('[role="dialog"], [role="alertdialog"], [data-state="open"].fixed.inset-0'))
      .catch(() => false);
    if (!overlay) return;
    const close = page.locator(
      '[role="dialog"] [aria-label="Close"], [role="alertdialog"] [aria-label="Close"], ' +
      '[role="dialog"] button:has-text("Close"), [role="alertdialog"] button:has-text("Cancel"), ' +
      '[role="dialog"] button:has-text("Not now"), [role="dialog"] button:has-text("Skip")'
    ).first();
    if (await close.isVisible().catch(() => false)) await close.click().catch(() => {});
    else await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(700);
  }
}

// ---- sidebar helpers ----------------------------------------------------

async function setSidebar(open) {
  const hide = page.locator('[aria-label="Hide sidebar"]').first();
  const show = page.locator('[aria-label="Show sidebar"], [aria-label="Open outlines sidebar"]').first();
  // On narrow widths the sidebar renders as a modal sheet (role=dialog with
  // the New Outline button). Detect it so open/close work in both modes.
  const sheet = page.locator('[role="dialog"]:has(button:has-text("New Outline"))').first();
  const sheetOpen = await sheet.isVisible().catch(() => false);
  if (open) {
    if (!sheetOpen && (await show.isVisible().catch(() => false))) {
      await show.click().catch(() => {});
      await page.waitForTimeout(500);
    }
  } else {
    if (sheetOpen) {
      const x = sheet.locator('[aria-label="Close"], button:has-text("Close")').first();
      if (await x.isVisible().catch(() => false)) await x.click().catch(() => {});
      else await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(500);
    } else if (await hide.isVisible().catch(() => false)) {
      await hide.click().catch(() => {});
      await page.waitForTimeout(500);
    }
  }
}

// ---- crash recovery -----------------------------------------------------

async function pageAlive() {
  try { await page.evaluate(() => 1); return true; } catch { return false; }
}

// If the renderer/window died (small sizes have crashed it), relaunch the
// whole Electron instance and re-open the saved audit outline from disk.
async function ensureApp() {
  if (await pageAlive()) return;
  log('  !! window/renderer gone — relaunching Electron');
  await closeApp();
  electronApp = null; page = null;
  await launch();
  await setWindowSize(1200, 800);
  await dismissAnyDialog();
  await setSidebar(true);
  const item = page.locator('text=ZZ Layout Audit').first();
  if (await item.isVisible({ timeout: 8000 }).catch(() => false)) {
    await item.click().catch(() => {});
    await page.waitForTimeout(1500);
  }
}

// ---- per-size audit -----------------------------------------------------

async function auditSize([w, h, label]) {
  const tag = `${w}x${h}`;
  log(`\n=== ${tag} (${label}) ===`);
  await ensureApp();
  const actual = await setWindowSize(w, h);
  if (!(await pageAlive())) {
    // The resize itself killed the renderer — a finding in its own right.
    records.push({ size: tag, label, requested: { w, h }, rendererDiedOnResize: true });
    log(`  !! renderer DIED on resize to ${tag}`);
    await ensureApp();
    return;
  }
  const rec = { size: tag, label, requested: { w, h }, actual };

  await closeStrayMenus();
  await dismissDiscoveryToast();

  // Surface 1: outline view, sidebar OPEN
  await setSidebar(true);
  await page.waitForTimeout(400);
  rec.sidebarOpen = {
    overflow: await pageOverflow(),
    headerRow: await inspectToolbar('outline-header-row'),
    actionToolbar: await inspectToolbar('outline-action-toolbar'),
    helpVisible: await visibleOnScreen('[aria-label="Help and support"]'),
    aiVisible: await visibleOnScreen('[aria-label="AI menu"]'),
    editorVisible: await page.locator('.ProseMirror').first().isVisible().catch(() => false),
  };
  await shot(`${tag}-outline-sidebar-open`);

  // Surface 2: sidebar CLOSED — outline + editor get the full width
  await setSidebar(false);
  await page.waitForTimeout(400);
  await closeStrayMenus();
  // focus a node so the editor pane is active — click the node NAME span
  const nodeSpan = page.locator('[role="treeitem"] span').filter({ hasText: /Strategic considerations|New Node/ }).first();
  if (await nodeSpan.isVisible().catch(() => false)) await nodeSpan.click().catch(() => {});
  else await page.locator('[role="treeitem"]').nth(1).click().catch(() => {});
  await page.waitForTimeout(500);
  rec.sidebarClosed = {
    overflow: await pageOverflow(),
    headerRow: await inspectToolbar('outline-header-row'),
    actionToolbar: await inspectToolbar('outline-action-toolbar'),
    helpVisible: await visibleOnScreen('[aria-label="Help and support"]'),
    aiVisible: await visibleOnScreen('[aria-label="AI menu"]'),
    editorVisible: await page.locator('.ProseMirror').first().isVisible().catch(() => false),
    moreToolsVisible: await visibleOnScreen('[aria-label="More tools"]'),
  };
  await shot(`${tag}-editor-sidebar-closed`);

  // Surface 3: Settings dialog
  await closeStrayMenus();
  const opened = await openSettings(page);
  await page.waitForTimeout(600);
  rec.settings = { opened, ...(opened ? await measureDialog() : {}) };
  await shot(`${tag}-settings`);
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(500);
  // belt & suspenders: click any lingering close button
  const closeBtn = page.locator('[role="dialog"] [aria-label="Close"], [role="dialog"] button:has-text("Close")').first();
  if (await closeBtn.isVisible().catch(() => false)) { await closeBtn.click().catch(() => {}); await page.waitForTimeout(400); }

  // restore sidebar for next size
  await setSidebar(true);
  records.push(rec);
  log(JSON.stringify({
    tag,
    actual,
    openOverflow: rec.sidebarOpen.overflow.hOverflow,
    closedOverflow: rec.sidebarClosed.overflow.hOverflow,
    headerClipped: rec.sidebarClosed.headerRow.clipped,
    actionClipped: rec.sidebarClosed.actionToolbar.clipped,
    help: rec.sidebarClosed.helpVisible,
    ai: rec.sidebarClosed.aiVisible,
    settings: rec.settings.present ? {
      overW: rec.settings.overflowsWidth, overH: rec.settings.overflowsHeight,
      scrollable: rec.settings.scrollable, btnsBelow: rec.settings.buttonsBelowFold,
    } : 'not-open',
  }));
}

// Merge this run's records into measurements.json: a fresh record for a size
// replaces any earlier record for the same size; other sizes are preserved.
function writeMerged() {
  const file = path.join(OUT, 'measurements.json');
  let existing = [];
  try { existing = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  const bySize = new Map(existing.map((r) => [r.size, r]));
  for (const r of records) bySize.set(r.size, r);
  const merged = SIZES_ALL.map(([w, h]) => bySize.get(`${w}x${h}`)).filter(Boolean);
  fs.writeFileSync(file, JSON.stringify(merged, null, 2));
  log(`\nWrote/merged ${merged.length} size records to measurements.json`);
}

async function closeApp() {
  if (!electronApp) return;
  await Promise.race([
    electronApp.close().catch(() => {}),
    new Promise((r) => setTimeout(r, 5000)),
  ]);
}

(async () => {
  try {
    await launch();
    // Start wide so the fixture builds with every control inline.
    await setWindowSize(1440, 900);
    // Reuse the audit outline if a previous run already saved it.
    await dismissAnyDialog();
    await setSidebar(true);
    const existing = page.locator('text=ZZ Layout Audit').first();
    if (await existing.isVisible({ timeout: 4000 }).catch(() => false)) {
      log('Reusing existing ZZ Layout Audit outline');
      await existing.click({ timeout: 10000 }).catch(async () => {
        await dismissAnyDialog();
        await existing.click({ timeout: 10000 }).catch(() => {});
      });
      await page.waitForTimeout(1500);
      await shot('00-fixture-outline');
    } else {
      await buildAuditOutline();
    }

    for (const size of SIZES) {
      try { await auditSize(size); writeMerged(); } catch (e) {
        log(`  SIZE ${size[0]}x${size[1]} crashed:`, String(e.message).split('\n')[0]);
        records.push({ size: `${size[0]}x${size[1]}`, label: size[2], error: String(e.message).split('\n')[0] });
        // try to recover: relaunch if dead, else close any dialog + sane size
        try { await ensureApp(); } catch (e2) { log('  recovery failed:', String(e2.message).split('\n')[0]); }
        await page.keyboard.press('Escape').catch(() => {});
        await setWindowSize(1200, 800).catch(() => {});
      }
    }

    writeMerged();
    await closeApp();
    process.exit(0);
  } catch (err) {
    console.error('Audit crashed:', err && err.message);
    try { writeMerged(); } catch {}
    await closeApp();
    process.exit(1);
  }
})();
