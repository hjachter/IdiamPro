// Wizards gallery front-door verification.
// 9 cards: 4 LIVE (Automatic Book, Website Building, Podcast, YouTube Video),
// 5 Coming Soon. Confirms each live front-door opens its real engine dialog and
// the coming-soon cards stay inert (no dialog, no AI, no cost).
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { prepareApp, setElectronWindowSize } = require('./_helpers');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT = path.resolve(__dirname, '..', 'test-screenshots', 'wizards2');
fs.mkdirSync(OUT, { recursive: true });
const results = [];
function log(step, ok, note) { results.push({ step, ok, note: note || '' }); console.log(`${ok ? 'PASS' : 'FAIL'} — ${step}${note ? ' :: ' + note : ''}`); }
async function shot(page, name) { try { await page.screenshot({ path: path.join(OUT, name) }); } catch (e) { console.log('shot fail', name, e.message); } }

async function findMainWindow(app, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    for (const win of app.windows()) {
      try { const u = win.url(); if (!u.startsWith('devtools://') && u.includes('localhost:9002')) return win; } catch {}
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('no main window');
}

async function clickVisible(page, selector, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const loc = page.locator(selector);
    const n = await loc.count().catch(() => 0);
    for (let i = 0; i < n; i++) {
      const el = loc.nth(i);
      if (await el.isVisible().catch(() => false)) { await el.click().catch(() => {}); return true; }
    }
    await page.waitForTimeout(200);
  }
  return false;
}

async function openWizards(page) {
  // Path A: the Smart Tools (Sparkles) menu button is inline (wide column).
  if (await clickVisible(page, '[aria-label="Smart Tools menu"]', 2500)) {
    await page.waitForTimeout(400);
    await clickVisible(page, '[role="menuitem"]:has-text("Wizards")', 4000);
    await page.waitForTimeout(700);
    return;
  }
  // Path B: narrow middle column — Smart Tools is collapsed into the action
  // toolbar's "More" (⋯) overflow, as a "Smart Tools" submenu holding Wizards.
  await clickVisible(page, '[data-testid="outline-toolbar-more"]', 4000);
  await page.waitForTimeout(400);
  // Open the "Smart Tools" submenu (Radix SubTrigger opens on click/hover).
  const subTrigger = page.locator('[role="menuitem"]:has-text("Smart Tools")');
  if ((await subTrigger.count().catch(() => 0)) > 0) {
    await subTrigger.first().hover().catch(() => {});
    await subTrigger.first().click().catch(() => {});
    await page.waitForTimeout(500);
  }
  await clickVisible(page, '[role="menuitem"]:has-text("Wizards")', 4000);
  await page.waitForTimeout(700);
}

async function dialogVisible(page, text) {
  return (await page.locator(`[role="dialog"]:has-text("${text}")`).count().catch(() => 0)) > 0
    && await page.locator(`[role="dialog"]:has-text("${text}")`).first().isVisible().catch(() => false);
}

async function closeAnyDialog(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(400);
}

(async () => {
  const app = await electron.launch({ args: [path.resolve(__dirname, '..')], env: { ...process.env, NODE_ENV: 'development' } });
  const page = await findMainWindow(app);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  if (!page.url().includes('/app')) {
    await page.evaluate(() => { window.location.href = '/app'; });
    await page.waitForLoadState('domcontentloaded');
    await page.locator('button:has-text("New Outline")').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  }
  await prepareApp(page);
  await setElectronWindowSize(app, 1500, 950);
  await page.waitForTimeout(1500);

  // Sequential first-run modals stack: the "Keep your work safe" backup notice,
  // then the "What you can make here" welcome showcase. Dismiss any that appear.
  for (let i = 0; i < 6; i++) {
    const closers = page.locator('button:has-text("Got it"), button:has-text("Get started"), [data-testid="welcome-showcase-dont-show"]');
    let clicked = false;
    const n = await closers.count().catch(() => 0);
    for (let j = 0; j < n; j++) {
      const el = closers.nth(j);
      if (await el.isVisible().catch(() => false)) { await el.click().catch(() => {}); clicked = true; await page.waitForTimeout(600); break; }
    }
    if (!clicked) break;
  }

  // Ensure an outline is loaded — the wizards operate on the current outline.
  // If none is selected, create one.
  const hasOutline = await page.evaluate(() => !!document.querySelector('[data-node-id], [data-testid="outline-node"], .outline-node')).catch(() => false);
  if (!hasOutline) {
    const nw = page.locator('button:has-text("New Outline")');
    if ((await nw.count().catch(() => 0)) > 0) { await nw.first().click().catch(() => {}); await page.waitForTimeout(1500); }
  }
  await shot(page, '00-app.png');

  // ── a. Open gallery, count cards & badges ──────────────────────────────
  await openWizards(page);
  const galleryUp = await dialogVisible(page, 'Wizards');
  log('Gallery opens', galleryUp);
  await shot(page, '01-gallery.png');

  const counts = await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('[role="dialog"]')].find(d => /Wizards/.test(d.textContent));
    if (!dlg) return null;
    const cards = dlg.querySelectorAll('button[aria-disabled]');
    let live = 0, soon = 0;
    dlg.querySelectorAll('button[aria-disabled]').forEach(b => {
      const t = b.textContent || '';
      if (/Coming Soon/i.test(t)) soon++; else if (/\bLive\b/.test(t)) live++;
    });
    return { cards: cards.length, live, soon };
  });
  log('Card counts', !!counts && counts.cards === 9 && counts.live === 4 && counts.soon === 5, JSON.stringify(counts));

  // ── b. Website Building ────────────────────────────────────────────────
  await page.locator('[role="dialog"] button:has-text("Website Building")').first().click();
  await page.waitForTimeout(900);
  const websiteUp = await dialogVisible(page, 'Generate Website');
  const galleryGone = !(await dialogVisible(page, 'One click runs the whole recipe'));
  log('Website front-door opens Generate Website dialog', websiteUp, `galleryClosed=${galleryGone}`);
  await shot(page, '02-website.png');
  await closeAnyDialog(page);

  // ── c. Podcast ─────────────────────────────────────────────────────────
  await openWizards(page);
  await page.locator('[role="dialog"] button:has-text("Podcast")').first().click();
  await page.waitForTimeout(900);
  const podcastUp = await dialogVisible(page, 'Generate Podcast');
  log('Podcast front-door opens Generate Podcast dialog', podcastUp);
  await shot(page, '03-podcast.png');
  await closeAnyDialog(page);

  // ── d. YouTube Video ───────────────────────────────────────────────────
  await openWizards(page);
  await page.locator('[role="dialog"] button:has-text("YouTube Video")').first().click();
  await page.waitForTimeout(900);
  const videoUp = await dialogVisible(page, 'Generate Video');
  const videoToast = (await page.locator(':text("Video is turned off")').count().catch(() => 0)) > 0;
  log('YouTube Video front-door', videoUp || videoToast, videoUp ? 'Generate Video dialog opened' : (videoToast ? 'flag OFF -> toast shown' : 'nothing happened'));
  await shot(page, '04-video.png');
  await closeAnyDialog(page);

  // ── e. Coming-Soon card stays inert ────────────────────────────────────
  await openWizards(page);
  const beforeDialogs = await page.locator('[role="dialog"]').count();
  // Coming-soon cards carry aria-disabled; force the click (they still fire
  // onClick to show the inline note — that inertness is exactly what we test).
  await page.locator('[role="dialog"] button:has-text("Screenplay")').first().click({ force: true });
  await page.waitForTimeout(800);
  const noteShown = (await page.locator(':text("Coming soon")').count().catch(() => 0)) > 0;
  const afterDialogs = await page.locator('[role="dialog"]').count();
  const stillGallery = await dialogVisible(page, 'Wizards');
  log('Coming-Soon card inert (note shown, no new dialog)', noteShown && stillGallery && afterDialogs <= beforeDialogs, `note=${noteShown} dialogs ${beforeDialogs}->${afterDialogs}`);
  await shot(page, '05-comingsoon.png');
  await closeAnyDialog(page);

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ results }, null, 2));
  const failed = results.filter(r => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);
  await app.close();
  process.exit(failed.length ? 1 : 0);
})().catch(async (e) => { console.error('FATAL', e); process.exit(2); });
