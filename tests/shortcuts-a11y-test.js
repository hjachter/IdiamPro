// Focused audit: keyboard shortcuts + accessibility basics.
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT = path.resolve(__dirname, '../test-screenshots/shortcuts-a11y');
fs.mkdirSync(OUT, { recursive: true });
const results = [];
function log(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`);
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
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('no main window');
}

(async () => {
  const projectRoot = path.resolve(__dirname, '..');
  const app = await electron.launch({ args: [projectRoot], env: { ...process.env, NODE_ENV: 'development' } });
  const page = await findMainWindow(app);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2500);
  if (!page.url().includes('/app')) {
    await page.evaluate(() => { window.location.href = '/app'; });
    await page.waitForLoadState('domcontentloaded');
    try { await page.locator('button:has-text("New Outline")').waitFor({ state: 'visible', timeout: 30000 }); } catch {}
  }
  await page.waitForTimeout(1500);

  const isMac = process.platform === 'darwin';
  const CMD = isMac ? 'Meta' : 'Control';

  // Ensure a ZZ TEST outline exists and is selected (throwaway).
  try {
    const existing = page.locator('text=ZZ TEST').first();
    if (await existing.count() === 0) {
      await page.locator('button:has-text("New Outline")').first().click();
      await page.waitForTimeout(800);
      // A rename/name field may appear; type name if an input is focused.
      const active = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
      if (active === 'INPUT') { await page.keyboard.type('ZZ TEST'); await page.keyboard.press('Enter'); }
    } else {
      await existing.click();
    }
    await page.waitForTimeout(600);
    log('Setup: ZZ TEST outline available/selected', true);
  } catch (e) { log('Setup: ZZ TEST outline', false, String(e.message)); }

  await page.screenshot({ path: path.join(OUT, '01-app.png') });

  // ---- SHORTCUTS ----
  // Cmd+K command palette
  try {
    await page.keyboard.press(`${CMD}+k`);
    await page.waitForTimeout(500);
    const open = await page.locator('input[placeholder="Type a command or question…"]').count() > 0;
    log('Cmd+K opens command palette', open);
    await page.screenshot({ path: path.join(OUT, '02-palette.png') });
    if (open) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
    const closed = await page.locator('input[placeholder="Type a command or question…"]').count() === 0;
    log('Escape closes command palette', closed);
  } catch (e) { log('Cmd+K palette', false, e.message); }

  // Ctrl+F search (control regardless of platform)
  try {
    await page.keyboard.press('Control+f');
    await page.waitForTimeout(500);
    const open = await page.locator('input[placeholder="Search outline..."]').count() > 0;
    log('Ctrl+F opens outline search', open);
    await page.screenshot({ path: path.join(OUT, '03-search.png') });
    if (open) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  } catch (e) { log('Ctrl+F search', false, e.message); }

  // Cmd+B toggle sidebar
  try {
    const before = await page.locator('button:has-text("New Outline")').count();
    await page.keyboard.press(`${CMD}+b`);
    await page.waitForTimeout(500);
    const afterHidden = await page.locator('button:has-text("New Outline")').count();
    await page.screenshot({ path: path.join(OUT, '04-sidebar-toggled.png') });
    await page.keyboard.press(`${CMD}+b`);
    await page.waitForTimeout(500);
    const afterShown = await page.locator('button:has-text("New Outline")').count();
    const worked = before > 0 && afterHidden === 0 && afterShown > 0;
    log('Cmd+B toggles sidebar (hide then show)', worked, `before=${before} hidden=${afterHidden} shown=${afterShown}`);
  } catch (e) { log('Cmd+B sidebar', false, e.message); }

  // Cmd+Shift+F focus mode (toast)
  try {
    await page.keyboard.press(`${CMD}+Shift+f`);
    await page.waitForTimeout(600);
    const toast = await page.locator('text=/Focus Mode/i').count() > 0;
    log('Cmd+Shift+F toggles focus mode (toast shown)', toast);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  } catch (e) { log('Cmd+Shift+F focus', false, e.message); }

  // ? shortcuts cheat-sheet
  try {
    await page.keyboard.press('?');
    await page.waitForTimeout(500);
    const open = await page.locator('text=Keyboard Shortcuts').count() > 0;
    log('? opens shortcuts cheat-sheet', open);
    await page.screenshot({ path: path.join(OUT, '05-cheatsheet.png') });
    if (open) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
    const closed = await page.locator('[role="dialog"]').count() === 0;
    log('Escape closes cheat-sheet dialog', closed);
  } catch (e) { log('? cheat-sheet', false, e.message); }

  // ---- ACCESSIBILITY ----
  // Icon-only buttons missing accessible names
  try {
    const bad = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('button').forEach(b => {
        const style = window.getComputedStyle(b);
        if (style.display === 'none' || style.visibility === 'hidden') return;
        const r = b.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const txt = (b.textContent || '').trim();
        const aria = b.getAttribute('aria-label');
        const title = b.getAttribute('title');
        const labelledby = b.getAttribute('aria-labelledby');
        // A form control (checkbox/radio) can be named by an associated
        // <label for=id> or a wrapping <label>, which screen readers honor.
        let assocLabel = false;
        if (b.id) { assocLabel = !!document.querySelector(`label[for="${b.id}"]`); }
        if (!assocLabel && b.closest('label')) assocLabel = true;
        const hasName = (txt && txt.length > 0) || (aria && aria.trim()) || (title && title.trim()) || labelledby || assocLabel;
        if (!hasName) {
          out.push(b.outerHTML.slice(0, 120));
        }
      });
      return out;
    });
    log('No visible icon-only buttons with empty accessible name', bad.length === 0, `count=${bad.length}`);
    if (bad.length) fs.writeFileSync(path.join(OUT, 'unlabeled-buttons.txt'), bad.join('\n'));
  } catch (e) { log('icon-button labels', false, e.message); }

  // Keyboard focus visibility: tab through and confirm focus ring styles exist
  try {
    const focusInfo = await page.evaluate(async () => {
      const seen = [];
      for (let i = 0; i < 12; i++) {
        const el = document.activeElement;
        if (el && el !== document.body) {
          const cs = window.getComputedStyle(el, ':focus-visible');
          seen.push({ tag: el.tagName, outline: cs.outlineStyle, ring: cs.boxShadow });
        }
      }
      return seen;
    });
    // We can't truly emulate :focus-visible in evaluate; do a real Tab walk instead.
    let reached = 0;
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const cs = window.getComputedStyle(el);
        return { tag: el.tagName, outline: cs.outlineStyle !== 'none', shadow: cs.boxShadow !== 'none' };
      });
      if (info && info.tag !== 'BODY') reached++;
    }
    log('Tab reaches interactive controls', reached >= 5, `reachedFocusableSteps=${reached}/10`);
    await page.screenshot({ path: path.join(OUT, '06-tab-focus.png') });
  } catch (e) { log('keyboard tab nav', false, e.message); }

  // Write report
  const passed = results.filter(r => r.pass).length;
  const report = { total: results.length, passed, failed: results.length - passed, results };
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`\n=== ${passed}/${results.length} passed ===`);

  await Promise.race([app.close().catch(() => {}), new Promise(r => setTimeout(r, 5000))]);
  process.exit(report.failed > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
