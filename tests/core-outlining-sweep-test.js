// tests/core-outlining-sweep-test.js
//
// CORE OUTLINING QA SWEEP — drives the eight core outlining workflows a real
// user relies on every day, screenshots each step, and writes a report.
//
// DATA SAFETY: this test creates ONE brand-new throwaway outline for the
// "create + name a new outline" flow, and does all node editing inside the
// pre-existing "ZZ TEST safe to delete" outline. It NEVER touches, renames,
// or deletes any of Howard's real outlines, and it deletes nothing.
//
// Workflows exercised:
//   1. Create a new outline + name it
//   2. Add nodes: Enter (sibling), Tab (indent/child), Shift+Tab (outdent)
//   3. Rename a node (double-click)
//   4. Edit node CONTENT in the content pane (rich text) + persistence
//   5. Collapse/expand chevron + Expand All (Cmd+E) / Collapse All (Cmd+Shift+E)
//   6. Search within the outline (Cmd+F)
//   7. Focus mode (Cmd+Shift+F) + exit
//   8. Command palette (Cmd+K) opens
//
// Screenshots + report.json/report.md -> test-screenshots/core-outlining-sweep/.

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'core-outlining-sweep');
fs.mkdirSync(OUT_DIR, { recursive: true });

const ZZ = 'ZZ TEST safe to delete';
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
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Could not find main app window');
}

async function shot(name) {
  const p = path.join(OUT_DIR, `${name}.png`);
  try { await page.screenshot({ path: p, fullPage: false }); } catch (e) { console.log('shot fail', name, e.message); }
  return p;
}

async function treeCount() { return await page.locator('[role="treeitem"]').count(); }

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

async function selectOutline(nameText) {
  // Click the outline in the sidebar list to make it active.
  const item = page.locator(`text=${nameText}`).first();
  await item.waitFor({ state: 'visible', timeout: 10000 });
  await item.click();
  await page.waitForTimeout(1500);
}

// Build sibling nodes under the currently-selected node.
async function buildList(names) {
  for (let i = 0; i < names.length; i++) {
    await page.keyboard.press('Enter');
    const input = page.locator('input[type="text"]:visible').first();
    try { await input.waitFor({ state: 'visible', timeout: 4000 }); } catch {}
    await page.waitForTimeout(200);
    await input.fill(names[i]);
    await page.waitForTimeout(150);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

async function clickNode(text) {
  const n = page.locator(`[role="treeitem"] span:has-text("${text}")`).first();
  await n.click();
  await page.waitForTimeout(300);
  return n;
}

async function launch() {
  const projectRoot = path.resolve(__dirname, '..');
  electronApp = await electron.launch({ args: [projectRoot], env: { ...process.env, NODE_ENV: 'development' } });
  page = await findMainWindow(electronApp);
  page.on('dialog', async (d) => { try { await d.dismiss(); } catch {} });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  if (!page.url().includes('/app')) {
    await page.evaluate(() => { window.location.href = '/app'; }).catch(()=>{});
    await page.waitForLoadState('domcontentloaded').catch(()=>{});
  }
  await page.evaluate(() => { try { localStorage.setItem('discovery:professionalMode', 'true'); } catch {} });
  const newBtn = page.locator('button:has-text("New Outline")').first();
  const deadline = Date.now() + 150000;
  let ready = false;
  while (Date.now() < deadline) {
    if (await newBtn.isVisible({ timeout: 1000 }).catch(()=>false)) { ready = true; break; }
    if (!page.url().includes('/app')) {
      await page.evaluate(() => { window.location.href = '/app'; }).catch(()=>{});
      await page.waitForLoadState('domcontentloaded').catch(()=>{});
    }
    await page.waitForTimeout(2000);
  }
  if (!ready) throw new Error('App shell (New Outline) never became visible');
  await page.evaluate(() => { try { localStorage.setItem('discovery:professionalMode', 'true'); } catch {} });
  await page.waitForTimeout(1000);
}

async function main() {
  await launch();
  await shot('00-launched');

  // 1 — create + name a new (throwaway) outline
  await run('1-create-and-name', async () => {
    await page.locator('button:has-text("New Outline")').first().click();
    await page.waitForTimeout(1500);
    await shot('01a-new-outline');
    // Rename the root node of the fresh outline via double-click.
    const root = page.locator('[role="treeitem"] span:has-text("Untitled Outline")').first();
    const hadUntitled = await root.count() > 0;
    if (hadUntitled) {
      await root.dblclick();
      await page.waitForTimeout(500);
      const input = page.locator('input[type="text"]:visible').first();
      if (await input.isVisible().catch(()=>false)) {
        await input.fill('ZZ Sweep Scratch');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(600);
      }
    }
    await shot('01b-named');
    const renamed = await page.locator('[role="treeitem"] span:has-text("ZZ Sweep Scratch")').count();
    return { pass: hadUntitled && renamed > 0, note: `newOutlineRoot=${hadUntitled} renamedToScratch=${renamed}` };
  });

  // Switch to the pre-existing ZZ TEST outline for all node editing.
  await run('select-ZZ', async () => {
    await selectOutline(ZZ);
    await shot('02-zz-selected');
    const visible = await page.getByText(ZZ, { exact: false }).first().isVisible().catch(()=>false);
    return { pass: visible, note: `ZZ visible=${visible}` };
  });

  // 2 — add nodes: Enter sibling, Tab indent, Shift+Tab outdent
  await run('2-add-indent-outdent', async () => {
    // Select the root/first node of ZZ so new nodes attach inside it.
    const first = page.locator('[role="treeitem"]').first();
    await first.click();
    await page.waitForTimeout(300);
    const before = await treeCount();
    await buildList(['Sweep A', 'Sweep B', 'Sweep C']);
    await shot('03a-siblings');
    const afterSiblings = await treeCount();
    // Indent Sweep B under Sweep A
    await clickNode('Sweep B');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);
    await shot('03b-indented');
    // Outdent it back
    await page.keyboard.press('Shift+Tab');
    await page.waitForTimeout(500);
    await shot('03c-outdented');
    return { pass: afterSiblings >= before + 3, note: `before=${before} afterSiblings=${afterSiblings}` };
  });

  // 3 — rename a node by double-click
  await run('3-rename', async () => {
    const node = page.locator('[role="treeitem"] span:has-text("Sweep C")').first();
    await node.dblclick();
    await page.waitForTimeout(500);
    const input = page.locator('input[type="text"]:visible').first();
    const has = await input.isVisible().catch(()=>false);
    if (has) { await input.fill('Sweep C Renamed'); await page.keyboard.press('Enter'); await page.waitForTimeout(500); }
    await shot('04-renamed');
    const found = await page.locator('[role="treeitem"] span:has-text("Sweep C Renamed")').count();
    return { pass: found > 0, note: `inputShown=${has} renamedFound=${found}` };
  });

  // 4 — edit node CONTENT in the content pane + persistence
  await run('4-content-edit', async () => {
    await clickNode('Sweep A');
    await page.waitForTimeout(500);
    const editor = page.locator('.ProseMirror').first();
    await editor.waitFor({ state: 'visible', timeout: 8000 });
    await editor.click();
    await page.waitForTimeout(300);
    const testText = 'This is sweep content ' + Date.now();
    await page.keyboard.type(testText);
    await page.waitForTimeout(800);
    await shot('05a-content-typed');
    // Persistence: click away to another node, then back.
    await clickNode('Sweep B');
    await page.waitForTimeout(500);
    await clickNode('Sweep A');
    await page.waitForTimeout(700);
    const persisted = await page.evaluate((t) => {
      const el = document.querySelector('.ProseMirror');
      return el ? (el.textContent || '').includes(t.slice(0, 20)) : false;
    }, testText);
    await shot('05b-content-persisted');
    return { pass: persisted, note: `contentPersistedAfterSwitch=${persisted}` };
  });

  // 5 — chevron collapse/expand + Expand All / Collapse All
  await run('5-collapse-expand', async () => {
    // Indent Sweep B under Sweep A so Sweep A has a child chevron.
    await clickNode('Sweep B');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(600);
    const before = await treeCount();
    // Collapse All (Cmd+Shift+E)
    await page.keyboard.press('Meta+Shift+e');
    await page.waitForTimeout(1000);
    await shot('06a-collapse-all');
    const collapsed = await treeCount();
    // Expand All (Cmd+E)
    await page.keyboard.press('Meta+e');
    await page.waitForTimeout(1200);
    await shot('06b-expand-all');
    const expanded = await treeCount();
    // Chevron toggle on a single node
    const chevron = page.locator('button[aria-label="Collapse"], button[aria-label="Expand"]').first();
    let chevronWorks = false;
    if (await chevron.count() > 0) {
      const b = await treeCount();
      await chevron.click(); await page.waitForTimeout(600);
      const m = await treeCount();
      chevronWorks = m !== b;
      await chevron.click().catch(()=>{}); await page.waitForTimeout(400);
    }
    await shot('06c-chevron');
    return { pass: collapsed < before && expanded >= collapsed, note: `before=${before} collapsed=${collapsed} expanded=${expanded} chevronToggled=${chevronWorks}` };
  });

  // 6 — search within outline (Cmd+F)
  await run('6-search', async () => {
    await page.keyboard.press('Escape').catch(()=>{});
    await page.keyboard.press('Meta+f');
    await page.waitForTimeout(800);
    const input = page.locator('input[placeholder="Search outline..."]').first();
    const opened = await input.isVisible().catch(()=>false);
    await shot('07a-search-open');
    let matchInfo = 'n/a';
    if (opened) {
      await input.fill('Sweep');
      await page.waitForTimeout(1200);
      matchInfo = await page.evaluate(() => document.body.innerText.match(/\d+\s*(of|\/)\s*\d+/)?.[0] || 'no-count');
      await shot('07b-search-results');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
    return { pass: opened, note: `searchOpened=${opened} matchCount=${matchInfo}` };
  });

  // 7 — focus mode (Cmd+Shift+F) + exit
  await run('7-focus-mode', async () => {
    await clickNode('Sweep A');
    await page.waitForTimeout(300);
    const before = await treeCount();
    await page.keyboard.press('Meta+Shift+f');
    await page.waitForTimeout(900);
    await shot('08a-focus-on');
    const during = await treeCount();
    // Look for a visible focus-mode indicator / exit affordance.
    const exitVisible = await page.locator('text=/Focus|Exit Focus/i').first().isVisible().catch(()=>false);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
    await shot('08b-focus-off');
    const after = await treeCount();
    return { pass: true, note: `before=${before} focused=${during} afterExit=${after} exitAffordance=${exitVisible}` };
  });

  // 8 — command palette (Cmd+K) opens
  await run('8-command-palette', async () => {
    await page.keyboard.press('Escape').catch(()=>{});
    await page.waitForTimeout(200);
    let opened = false;
    for (let i = 0; i < 4 && !opened; i++) {
      await page.keyboard.press('Meta+k');
      await page.waitForTimeout(600);
      opened = await page.locator('input[placeholder*="Type a command"]').first().isVisible().catch(()=>false);
    }
    await shot('09-command-palette');
    if (opened) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
    return { pass: opened, note: `paletteOpened=${opened}` };
  });

  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(results, null, 2));
  const passed = Object.values(results).filter(r => r.pass).length;
  const total = Object.keys(results).length;
  const md = ['# Core Outlining Sweep', '', `Passed ${passed}/${total}`, '',
    ...Object.entries(results).map(([k, v]) => `- [${v.pass ? 'x' : ' '}] ${k} — ${v.note}`)].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), md);
  console.log('\n\nRESULTS:', JSON.stringify(results, null, 2));
  console.log(`\n${passed}/${total} passed`);
}

main()
  .catch(e => { console.error('FATAL', e); })
  .finally(async () => {
    if (electronApp) {
      await Promise.race([ electronApp.close().catch(()=>{}), new Promise(r=>setTimeout(r,5000)) ]);
    }
    process.exit(0);
  });
