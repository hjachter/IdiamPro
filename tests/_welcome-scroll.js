const { _electron: electron } = require('playwright');
const path = require('path');

const DIR = '/private/tmp/claude-501/-Users-howardjachter-Developer-IdiamPro/a8db6996-3bce-4aef-8646-4175b8f089c9/scratchpad';
const NORMAL_OUT = DIR + '/welcome-panel.png';
const SMALL_TOP = DIR + '/welcome-small-top.png';
const SMALL_BOTTOM = DIR + '/welcome-small-bottom.png';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    await sleep(500);
  }
  throw new Error('main window not found');
}
async function gotoApp(page) {
  await page.evaluate(() => { window.location.href = '/'; }).catch(() => {});
  await sleep(1500);
  await page.evaluate(() => { window.location.href = '/app'; }).catch(() => {});
  await sleep(6000);
}
async function pollVisible(page, sel, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }, sel).catch(() => false);
    if (ok) return true;
    await sleep(300);
  }
  return false;
}
async function clearSeen(page) {
  await page.evaluate(() => { try { localStorage.removeItem('onboarding:welcomeShowcaseSeen'); localStorage.removeItem('discovery:professionalMode'); } catch {} }).catch(() => {});
}

(async () => {
  const projectRoot = path.resolve(__dirname, '..');
  const app = await electron.launch({ args: [projectRoot], env: { ...process.env, NODE_ENV: 'development' } });
  const page = await findMainWindow(app);
  page.on('dialog', (d) => { d.accept().catch(() => {}); });
  await sleep(3000);

  // ---------- PASS 1: SMALL window (smaller than the panel) ----------
  await page.setViewportSize({ width: 700, height: 480 }).catch(() => {});
  await gotoApp(page);
  await clearSeen(page);
  await gotoApp(page);
  const vis1 = await pollVisible(page, '[data-testid="welcome-showcase"]', 20000);
  if (!vis1) { console.log('SMALL: PANEL NOT VISIBLE'); await app.close(); process.exit(1); }
  await sleep(1000);

  // Locate the internal scroll region (the card region should be scrollable).
  const scroll = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="welcome-showcase"]');
    if (!panel) return null;
    // find the deepest scrollable descendant
    let best = null;
    panel.querySelectorAll('*').forEach((el) => {
      if (el.scrollHeight - el.clientHeight > 4) {
        const cs = getComputedStyle(el);
        if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') {
          if (!best || el.scrollHeight > best.scrollHeight) best = el;
        }
      }
    });
    if (!best) return { scrollable: false };
    best.setAttribute('data-scrollprobe', '1');
    return { scrollable: true, scrollTop: best.scrollTop, scrollHeight: best.scrollHeight, clientHeight: best.clientHeight };
  });
  console.log('SMALL scroll region: ' + JSON.stringify(scroll));

  // Buttons present in DOM?
  const btns = await page.evaluate(() => ({
    skip: !!document.querySelector('[data-testid="welcome-showcase-skip"]'),
    start: !!document.querySelector('[data-testid="welcome-showcase-start"]'),
    cards: document.querySelectorAll('[data-testid="welcome-showcase"] .grid > div').length,
  }));
  console.log('SMALL dom: ' + JSON.stringify(btns));

  await page.screenshot({ path: SMALL_TOP });
  console.log('SAVED ' + SMALL_TOP);

  // Scroll the internal region to the bottom.
  await page.evaluate(() => {
    const el = document.querySelector('[data-scrollprobe="1"]');
    if (el) el.scrollTop = el.scrollHeight;
  });
  await sleep(600);

  // Are the footer buttons within the viewport now (reachable)?
  const btnReach = await page.evaluate(() => {
    const vh = window.innerHeight;
    const check = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return { present: false };
      const r = el.getBoundingClientRect();
      return { present: true, top: Math.round(r.top), bottom: Math.round(r.bottom), inView: r.top >= 0 && r.bottom <= vh + 1 };
    };
    return { vh, skip: check('[data-testid="welcome-showcase-skip"]'), start: check('[data-testid="welcome-showcase-start"]') };
  });
  console.log('SMALL button reach after scroll: ' + JSON.stringify(btnReach));
  await page.screenshot({ path: SMALL_BOTTOM });
  console.log('SAVED ' + SMALL_BOTTOM);

  const smallOk = scroll && scroll.scrollable && btnReach.skip.inView && btnReach.start.inView && btns.cards === 6;
  console.log('SMALL_RESULT ' + (smallOk ? 'PASS' : 'FAIL'));

  // ---------- PASS 2: NORMAL large window (clean full-panel shot) ----------
  await page.setViewportSize({ width: 1180, height: 1180 }).catch(() => {});
  await gotoApp(page);
  await clearSeen(page);
  await gotoApp(page);
  const vis2 = await pollVisible(page, '[data-testid="welcome-showcase"]', 20000);
  if (!vis2) { console.log('NORMAL: PANEL NOT VISIBLE'); await app.close(); process.exit(1); }
  await sleep(1200);
  // Confirm no horizontal clipping: the grid fits inside the panel.
  const clip = await page.evaluate(() => {
    const grid = document.querySelector('[data-testid="welcome-showcase"] .grid');
    if (!grid) return { ok: false };
    return { ok: grid.scrollWidth <= grid.clientWidth + 1, sw: grid.scrollWidth, cw: grid.clientWidth };
  });
  console.log('NORMAL horiz clip check: ' + JSON.stringify(clip));
  await page.screenshot({ path: NORMAL_OUT });
  console.log('SAVED ' + NORMAL_OUT);

  await app.close();
  process.exit(smallOk && clip.ok ? 0 : 2);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
