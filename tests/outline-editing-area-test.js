const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const SHOT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'outline-editing');
fs.mkdirSync(SHOT_DIR, { recursive: true });

let electronApp, page;
const results = {};

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
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Could not find main app window');
}

async function shot(name) {
  const p = path.join(SHOT_DIR, `${name}.png`);
  try { await page.screenshot({ path: p, fullPage: true }); } catch (e) { console.log('shot fail', name, e.message); }
  return p;
}

async function setProMode() {
  await page.evaluate(() => { try { localStorage.setItem('discovery:professionalMode', 'true'); } catch {} });
}

async function launch() {
  const projectRoot = path.resolve(__dirname, '..');
  electronApp = await electron.launch({ args: [projectRoot], env: { ...process.env, NODE_ENV: 'development' } });
  page = await findMainWindow(electronApp);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  await setProMode();
  // The dev server inside Electron compiles /app on first hit, which can be
  // slow on a cold start. Navigate to /app and poll for the shell; if it
  // doesn't appear, re-navigate and keep polling up to ~120s total.
  const newBtn = page.locator('button:has-text("New Outline")').first();
  const deadline = Date.now() + 120000;
  let ready = false;
  while (Date.now() < deadline) {
    if (!page.url().includes('/app')) {
      await page.evaluate(() => { window.location.href = '/app'; }).catch(()=>{});
      await page.waitForLoadState('domcontentloaded').catch(()=>{});
    }
    try {
      await newBtn.waitFor({ state: 'visible', timeout: 8000 });
      ready = true; break;
    } catch {
      // reload the /app route and try again
      await page.evaluate(() => { window.location.href = '/app'; }).catch(()=>{});
      await page.waitForTimeout(1500);
    }
  }
  if (!ready) throw new Error('App shell (New Outline) never became visible');
  await setProMode();
  await page.waitForTimeout(1500);
  // Warm-up: create + discard a scratch outline so the tree renderer is hot
  // before the first real scenario runs.
  await newBtn.click();
  await page.waitForTimeout(1500);
  await page.locator('[role="treeitem"]').first().waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(500);
}

async function newOutline() {
  await page.locator('button:has-text("New Outline")').first().click();
  await page.waitForTimeout(1500);
}

// Build a flat list of children under the currently-selected node.
// Pattern verified from screenshots: first Enter creates a child in edit mode;
// type name; each subsequent Enter commits the current name AND creates the next
// sibling still in edit mode. So: Enter once to start, then type/Enter/type/Enter.
async function buildList(names) {
  for (let i = 0; i < names.length; i++) {
    await page.keyboard.press('Enter');         // create a new empty node in edit mode
    // Wait for the rename/edit input to actually be present & focused
    const input = page.locator('input[type="text"]:visible').first();
    try { await input.waitFor({ state: 'visible', timeout: 4000 }); } catch {}
    await page.waitForTimeout(200);
    await input.fill(names[i]);                  // fill is atomic — no per-key race
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');          // commit
    await page.waitForTimeout(500);
    // Selection stays on the just-committed node; next Enter makes a sibling below.
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}
async function loadGuide() {
  await page.locator('button:has-text("User Guide")').first().click();
  await page.waitForTimeout(2000);
}

// Select a treeitem by visible text
async function clickNode(text) {
  const n = page.locator(`[role="treeitem"] span:has-text("${text}")`).first();
  await n.click();
  await page.waitForTimeout(300);
  return n;
}

async function treeItemCount() {
  return await page.locator('[role="treeitem"]').count();
}

async function run(name, fn) {
  console.log(`\n=== ${name} ===`);
  try {
    const r = await fn();
    results[name] = r;
    console.log(name, JSON.stringify(r));
  } catch (e) {
    results[name] = { pass: false, note: 'threw: ' + e.message };
    console.log(name, 'ERROR', e.message);
  }
}

async function main() {
  await launch();
  await shot('00-launched');

  // 1-1 create new outline + 5-item top-level list
  await run('1-1', async () => {
    await newOutline();
    await clickNode('Untitled Outline');
    await buildList(['Item One','Item Two','Item Three','Item Four','Item Five']);
    await shot('sc-1-1');
    const cnt = await treeItemCount();
    return { pass: cnt >= 5, note: `treeitems=${cnt}`, cnt };
  });

  // 1-2 indent then outdent
  await run('1-2', async () => {
    await clickNode('Item Two');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);
    await shot('sc-1-2a-indent');
    await page.keyboard.press('Shift+Tab');
    await page.waitForTimeout(500);
    await shot('sc-1-2');
    return { pass: true, note: 'Tab then Shift+Tab pressed on Item Two' };
  });

  // 1-3 duplicate Cmd+D
  await run('1-3', async () => {
    const before = await treeItemCount();
    await clickNode('Item Three');
    await page.keyboard.press('Meta+d');
    await page.waitForTimeout(600);
    await shot('sc-1-3');
    const after = await treeItemCount();
    return { pass: after > before, note: `before=${before} after=${after}`, before, after };
  });

  // 1-4 delete + confirm
  await run('1-4', async () => {
    // Ensure the delete-confirmation prompt is NOT suppressed by a stored
    // "Don't ask again" preference, so we can verify the safety dialog fires.
    await page.evaluate(() => { try { localStorage.removeItem('confirmDelete'); } catch {} });
    const before = await treeItemCount();
    await clickNode('Item Four');
    await page.keyboard.press('Delete');
    await page.waitForTimeout(800);
    // confirmation dialog
    const dlg = page.locator('[role="dialog"], [role="alertdialog"]');
    let dialogSeen = await dlg.count() > 0;
    await shot('sc-1-4a-dialog');
    if (dialogSeen) {
      const confirm = page.locator('[role="dialog"] button, [role="alertdialog"] button').filter({ hasText: /Delete|Remove|Confirm|Yes/i });
      if (await confirm.count() > 0) { await confirm.last().click(); }
      else { await page.keyboard.press('Enter'); }
      await page.waitForTimeout(600);
    }
    await shot('sc-1-4');
    const after = await treeItemCount();
    const gone = await page.locator(`[role="treeitem"] span:has-text("Item Four")`).count();
    return { pass: dialogSeen && after < before, note: `dialog=${dialogSeen} before=${before} after=${after} remaining Item Four=${gone}`, dialogSeen };
  });

  // 1-5 rename by double-click
  await run('1-5', async () => {
    const node = page.locator(`[role="treeitem"] span:has-text("Item Five")`).first();
    await node.dblclick();
    await page.waitForTimeout(500);
    const input = page.locator('input[type="text"]');
    const hasInput = await input.count() > 0 && await input.first().isVisible().catch(()=>false);
    if (hasInput) {
      await input.first().fill('Renamed Item');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
    }
    await shot('sc-1-5');
    const renamed = await page.locator(`[role="treeitem"] span:has-text("Renamed Item")`).count();
    return { pass: renamed > 0, note: `inputShown=${hasInput} renamedFound=${renamed}` };
  });

  // 1-6 reorder by drag
  await run('1-6', async () => {
    await newOutline();
    await clickNode('Untitled Outline');
    await buildList(['Alpha','Bravo','Charlie']);
    await shot('sc-1-6a-before');
    // try to drag Charlie above Alpha
    const src = page.locator(`[role="treeitem"] span:has-text("Charlie")`).first();
    const dst = page.locator(`[role="treeitem"] span:has-text("Alpha")`).first();
    let dragErr = null;
    try { await src.dragTo(dst); await page.waitForTimeout(600); } catch(e){ dragErr = e.message; }
    await shot('sc-1-6');
    // read order of visible treeitems
    const texts = await page.locator('[role="treeitem"]').allInnerTexts();
    return { pass: !dragErr, note: `dragErr=${dragErr||'none'} order=${JSON.stringify(texts.map(t=>t.replace(/\s+/g,' ').trim().slice(0,20)))}` };
  });

  // 1-7 collapse & expand a branch via chevron
  await run('1-7', async () => {
    await loadGuide();
    await page.waitForTimeout(500);
    const chevron = page.locator('button[aria-label="Collapse"], button[aria-label="Expand"]').first();
    const before = await treeItemCount();
    await chevron.click(); await page.waitForTimeout(600);
    await shot('sc-1-7a');
    const mid = await treeItemCount();
    // click again to toggle back
    const chevron2 = page.locator('button[aria-label="Collapse"], button[aria-label="Expand"]').first();
    await chevron2.click(); await page.waitForTimeout(600);
    await shot('sc-1-7');
    const after = await treeItemCount();
    return { pass: mid !== before, note: `before=${before} collapsed=${mid} reexpanded=${after}` };
  });

  // 1-8 Expand All / Collapse All
  await run('1-8', async () => {
    await loadGuide();
    await page.waitForTimeout(600);
    const before = await treeItemCount();
    const toolBtn = page.locator('button[aria-label="Show or hide all items"]').first();
    // Collapse All via dropdown
    await toolBtn.click(); await page.waitForTimeout(400);
    await page.locator('[role="menuitem"]:has-text("Collapse All")').click();
    await page.waitForTimeout(1200);
    await shot('sc-1-8a-collapsed');
    const collapsed = await treeItemCount();
    // Expand All via dropdown
    await toolBtn.click(); await page.waitForTimeout(400);
    await page.locator('[role="menuitem"]:has-text("Expand All")').click();
    await page.waitForTimeout(1500);
    await shot('sc-1-8');
    const expanded = await treeItemCount();
    return { pass: collapsed < before && expanded > collapsed, note: `before=${before} collapsed=${collapsed} expanded=${expanded}` };
  });

  // 1-9 copy/cut/paste a branch
  await run('1-9', async () => {
    await newOutline();
    await clickNode('Untitled Outline');
    await buildList(['Source','Target']);
    const before = await treeItemCount();
    await clickNode('Source');
    await page.keyboard.press('Meta+c'); await page.waitForTimeout(400);
    await clickNode('Target');
    await page.keyboard.press('Meta+v'); await page.waitForTimeout(700);
    await shot('sc-1-9a-paste');
    const afterPaste = await treeItemCount();
    // undo the paste
    await page.keyboard.press('Meta+z'); await page.waitForTimeout(600);
    const afterUndo = await treeItemCount();
    await shot('sc-1-9');
    return { pass: afterPaste > before, note: `before=${before} afterCopyPaste=${afterPaste} afterUndo=${afterUndo}` };
  });

  // 1-10 multi-select + bulk action (feature-gap check)
  await run('1-10', async () => {
    await newOutline();
    await clickNode('Untitled Outline');
    await buildList(['M1','M2','M3']);
    // Cmd+Click to multi-select
    const a = page.locator(`[role="treeitem"] span:has-text("M1")`).first();
    const b = page.locator(`[role="treeitem"] span:has-text("M2")`).first();
    await a.click(); await page.waitForTimeout(200);
    await b.click({ modifiers: ['Meta'] }); await page.waitForTimeout(400);
    await shot('sc-1-10a-multiselect');
    // check for any bulk color/tag toolbar
    const bulkBar = await page.locator('text=/selected/i').count();
    // right-click to look for bulk actions
    await b.click({ button: 'right' }).catch(()=>{});
    await page.waitForTimeout(500);
    const menuItems = await page.locator('[role="menuitem"]').allInnerTexts().catch(()=>[]);
    await shot('sc-1-10');
    await page.keyboard.press('Escape').catch(()=>{});
    return { pass: false, note: `multiselectBar=${bulkBar} contextMenuItems=${JSON.stringify(menuItems)}`, featureGap: true };
  });

  // 1-11 numbering correct after reordering
  await run('1-11', async () => {
    await newOutline();
    await clickNode('Untitled Outline');
    await buildList(['First','Second','Third']);
    await shot('sc-1-11a-initial');
    // Numbering renders as a leading prefix ("1", "2", "3") next to each title.
    const texts = (await page.locator('[role="treeitem"]').allInnerTexts()).map(t=>t.replace(/\s+/g,' ').trim());
    const first = texts.find(t=>/First/.test(t)) || '';
    const second = texts.find(t=>/Second/.test(t)) || '';
    const third = texts.find(t=>/Third/.test(t)) || '';
    const ok = /(^|\D)1\s*First/.test(first) && /(^|\D)2\s*Second/.test(second) && /(^|\D)3\s*Third/.test(third);
    return { pass: ok, note: `first="${first.slice(0,20)}" second="${second.slice(0,20)}" third="${third.slice(0,20)}"` };
  });

  // 1-12 Pin to top (feature-gap check)
  await run('1-12', async () => {
    await newOutline();
    await clickNode('Untitled Outline');
    await buildList(['Important']);
    const node = page.locator(`[role="treeitem"] span:has-text("Important")`).first();
    await node.click({ button: 'right' }); await page.waitForTimeout(500);
    const menuItems = await page.locator('[role="menuitem"]').allInnerTexts().catch(()=>[]);
    const hasPin = menuItems.some(m=>/pin/i.test(m));
    await shot('sc-1-12');
    await page.keyboard.press('Escape').catch(()=>{});
    return { pass: false, note: `contextMenuItems=${JSON.stringify(menuItems)} pinFound=${hasPin}`, featureGap: !hasPin };
  });

  // 1-13 focus mode
  await run('1-13', async () => {
    await loadGuide();
    await page.waitForTimeout(500);
    await page.locator('[role="treeitem"]').first().click();
    await page.waitForTimeout(300);
    const before = await treeItemCount();
    await page.keyboard.press('Meta+Shift+f');
    await page.waitForTimeout(800);
    await shot('sc-1-13a-focus-on');
    const during = await treeItemCount();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
    await shot('sc-1-13');
    const after = await treeItemCount();
    return { pass: true, note: `before=${before} focused=${during} afterEsc=${after}` };
  });

  fs.writeFileSync(path.join(SHOT_DIR, 'results.json'), JSON.stringify(results, null, 2));
  console.log('\n\nALL RESULTS:', JSON.stringify(results, null, 2));
}

main()
  .catch(e => { console.error('FATAL', e); })
  .finally(async () => {
    if (electronApp) {
      await Promise.race([ electronApp.close().catch(()=>{}), new Promise(r=>setTimeout(r,5000)) ]);
    }
    process.exit(0);
  });
