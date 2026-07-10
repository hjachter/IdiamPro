// tests/data-recovery-test.js
//
// DATA-SAFETY & RECOVERY SWEEP — verifies the three protection layers that make
// outline data "sacred": (1) Undo/redo, (2) autosave/dirty-flag persistence,
// (3) disk snapshots (Backup/Restore). Simulates accidental loss and confirms
// recovery.
//
// DATA SAFETY: creates ONE brand-new throwaway outline "ZZ RECOVERY TEST" and
// does ALL destructive actions (deleting nodes/branches) inside it only. It
// NEVER touches, renames, or deletes any of Howard's real outlines, never
// clears localStorage globally, and never deletes files from disk.
//
// Screenshots + report -> test-screenshots/data-recovery/.

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'data-recovery');
fs.mkdirSync(OUT_DIR, { recursive: true });

const ZZ = 'ZZ RECOVERY ' + Date.now().toString().slice(-5);
let electronApp, page;

// Open the Backup/Restore dialog robustly. The backup button can be duplicated
// across responsive layouts (inline + overflow clone), so try every visible
// instance until the dialog actually mounts. Returns true if it opened.
let lastBackupDiag = '';
async function openBackupDialog() {
  const buttons = page.locator('[data-testid="backup-outline-button"]');
  const marker = page.locator('[role="dialog"]:has-text("Backups for")').first();
  const anyDialog = page.locator('[role="dialog"]');
  const n = await buttons.count();
  let vis = 0;
  for (let i = 0; i < n; i++) {
    const b = buttons.nth(i);
    const isVis = await b.isVisible().catch(()=>false);
    if (isVis) vis++;
    if (!isVis) continue;
    await b.scrollIntoViewIfNeeded().catch(()=>{});
    await b.click().catch(async () => { await b.click({ force: true }).catch(()=>{}); });
    await page.waitForTimeout(1200);
    const dlgCount = await anyDialog.count();
    let dlgText = '';
    if (dlgCount > 0) dlgText = (await anyDialog.first().innerText().catch(()=>'')).slice(0, 40).replace(/\n/g, ' ');
    lastBackupDiag = `count=${n} vis=${vis} clicked=${i} dlgCount=${dlgCount} dlgText="${dlgText}"`;
    if (await marker.isVisible({ timeout: 1500 }).catch(()=>false)) return true;
    // Try a direct DOM click on the same element (bypasses pointer hit-testing).
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="backup-outline-button"]');
      if (el) el.click();
    }).catch(()=>{});
    await page.waitForTimeout(1000);
    const dlg2 = await anyDialog.count();
    lastBackupDiag += ` domClickDlg=${dlg2}`;
    if (await marker.isVisible({ timeout: 1500 }).catch(()=>false)) return true;
  }
  // Fallback: overflow "More tools" menu → "Backup Outline".
  const more = page.locator('button[aria-label="More tools"]').first();
  if (await more.isVisible().catch(()=>false)) {
    await more.click().catch(()=>{});
    await page.waitForTimeout(400);
    const item = page.locator('[role="menuitem"]:has-text("Backup Outline")').first();
    if (await item.isVisible().catch(()=>false)) {
      await item.click().catch(()=>{});
      if (await marker.isVisible({ timeout: 2500 }).catch(()=>false)) { lastBackupDiag = `count=${n} vis=${vis} openedByMenu`; return true; }
    }
  }
  lastBackupDiag = 'NONE-opened; ' + lastBackupDiag;
  return false;
}
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
async function nodeExists(text) {
  return (await page.locator(`[role="treeitem"] span:has-text("${text}")`).count()) > 0;
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

async function selectOutline(nameText) {
  const item = page.locator(`text=${nameText}`).first();
  await item.waitFor({ state: 'visible', timeout: 10000 });
  await item.click();
  await page.waitForTimeout(1500);
}

async function closeDialogs() {
  // Dismiss any open Radix dialog so it stops intercepting pointer events.
  for (let i = 0; i < 3; i++) {
    if ((await page.locator('[role="dialog"]').count()) === 0) break;
    await page.keyboard.press('Escape').catch(()=>{});
    await page.waitForTimeout(300);
  }
}

async function clickNode(text) {
  await closeDialogs();
  const n = page.locator(`[role="treeitem"] span:has-text("${text}")`).first();
  await n.click();
  await page.waitForTimeout(300);
  return n;
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

// Delete the currently-selected node, confirming the alert dialog if it appears.
async function deleteSelected() {
  await page.keyboard.press('Delete');
  await page.waitForTimeout(600);
  // Confirm dialog: click the destructive "Delete" button if present.
  const confirmBtn = page.locator('button:has-text("Delete")').last();
  if (await confirmBtn.isVisible().catch(()=>false)) {
    await confirmBtn.click();
    await page.waitForTimeout(700);
  }
}

async function dismissWelcome() {
  // The one-time "What you can make" onboarding showcase blocks the tree.
  const skip = page.locator('[data-testid="welcome-showcase-skip"]').first();
  if (await skip.isVisible().catch(()=>false)) { await skip.click().catch(()=>{}); await page.waitForTimeout(600); }
}

async function launch() {
  const projectRoot = path.resolve(__dirname, '..');
  electronApp = await electron.launch({ args: [projectRoot], env: { ...process.env, NODE_ENV: 'development' } });
  page = await findMainWindow(electronApp);
  page.on('dialog', async (d) => { try { await d.dismiss(); } catch {} });
  page.on('pageerror', (e) => console.log('[PAGEERROR]', String(e.message || e).slice(0, 200)));
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  // Suppress onboarding showcase + enable professional mode BEFORE the shell mounts.
  await page.evaluate(() => { try { localStorage.setItem('onboarding:welcomeShowcaseSeen', 'true'); localStorage.setItem('discovery:professionalMode', 'true'); } catch {} });
  if (!page.url().includes('/app')) {
    await page.evaluate(() => { window.location.href = '/app'; }).catch(()=>{});
    await page.waitForLoadState('domcontentloaded').catch(()=>{});
  }
  await page.evaluate(() => { try { localStorage.setItem('onboarding:welcomeShowcaseSeen', 'true'); localStorage.setItem('discovery:professionalMode', 'true'); } catch {} });
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
  await page.evaluate(() => { try { localStorage.setItem('onboarding:welcomeShowcaseSeen', 'true'); localStorage.setItem('discovery:professionalMode', 'true'); } catch {} });
  await dismissWelcome();
  await page.waitForTimeout(1000);
}

async function main() {
  await launch();
  await shot('00-launched');

  // SETUP — create a FRESH throwaway outline (unique name) with a few nodes.
  await run('setup-create-outline', async () => {
    await page.locator('button:has-text("New Outline")').first().click();
    await page.waitForTimeout(1500);
    const root = page.locator('[role="treeitem"] span:has-text("Untitled Outline")').first();
    if (await root.count() > 0) {
      await root.dblclick();
      await page.waitForTimeout(500);
      const input = page.locator('input[type="text"]:visible').first();
      if (await input.isVisible().catch(()=>false)) {
        await input.fill(ZZ);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(600);
      }
    }
    await shot('01-created');
    return { pass: await nodeExists(ZZ), note: 'created ZZ RECOVERY TEST' };
  });

  // Build content: three siblings, put content on one, and a child branch.
  await run('setup-build-content', async () => {
    const first = page.locator('[role="treeitem"]').first();
    await first.click();
    await page.waitForTimeout(300);
    const before = await treeCount();
    await buildList(['Keeper One', 'Precious Branch', 'Keeper Three']);
    // Give "Precious Branch" a child so deleting it removes a whole subtree.
    await clickNode('Precious Branch');
    await page.keyboard.press('Enter');
    let input = page.locator('input[type="text"]:visible').first();
    await input.waitFor({ state: 'visible', timeout: 4000 }).catch(()=>{});
    await input.fill('Precious Child');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await page.keyboard.press('Tab'); // indent under Precious Branch
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    // Add content to Precious Child so we can prove content survives recovery.
    await clickNode('Precious Child');
    await page.waitForTimeout(400);
    const editor = page.locator('.ProseMirror').first();
    await editor.waitFor({ state: 'visible', timeout: 8000 });
    await editor.click();
    await page.keyboard.type('SACRED CONTENT DO NOT LOSE');
    await page.waitForTimeout(800);
    await shot('02-content-built');
    const after = await treeCount();
    return { pass: after >= before + 4, note: `before=${before} after=${after}` };
  });

  // EARLY UI PROBE — does the Backup toolbar button open the dialog? Run BEFORE
  // any reload so we fairly assess the button in a fresh renderer.
  await run('probe-backup-button-opens', async () => {
    const dialogUp = await openBackupDialog();
    await shot('02b-backup-button-probe');
    if (dialogUp) { await page.locator('button:has-text("Cancel"), button:has-text("Close")').first().click().catch(()=>{}); await page.waitForTimeout(400); }
    // Comparative control: does ANOTHER toolbar button respond to a click? If the
    // Search button opens search but Backup does not, the fault is Backup-specific.
    let searchWorks = false;
    const searchBtn = page.locator('button[aria-label="Search outline"]').first();
    if (await searchBtn.isVisible().catch(()=>false)) {
      await searchBtn.click().catch(()=>{});
      await page.waitForTimeout(600);
      searchWorks = await page.locator('input[placeholder="Search outline..."]').first().isVisible().catch(()=>false);
      await page.keyboard.press('Escape').catch(()=>{});
      await page.waitForTimeout(300);
    }
    return { pass: dialogUp, note: `dialogOpened=${dialogUp} searchBtnWorks=${searchWorks} [${lastBackupDiag}]` };
  });

  // LAYER 1 — UNDO: delete a node, Cmd+Z, confirm it returns intact.
  await run('layer1-undo-single', async () => {
    await clickNode('Keeper Three');
    const before = await treeCount();
    await deleteSelected();
    await shot('03a-deleted-keeper3');
    const afterDelete = await treeCount();
    const goneAfterDelete = !(await nodeExists('Keeper Three'));
    // Undo
    await page.keyboard.press('Meta+z');
    await page.waitForTimeout(1000);
    await shot('03b-undone');
    const backAfterUndo = await nodeExists('Keeper Three');
    const afterUndo = await treeCount();
    return {
      pass: goneAfterDelete && backAfterUndo && afterUndo >= before,
      note: `before=${before} afterDelete=${afterDelete} gone=${goneAfterDelete} back=${backAfterUndo} afterUndo=${afterUndo}`,
    };
  });

  // LAYER 1b — multi-step undo/redo integrity.
  await run('layer1-undo-redo-multi', async () => {
    // Rename Keeper One twice, then undo twice, redo once.
    await clickNode('Keeper One');
    await page.locator('[role="treeitem"] span:has-text("Keeper One")').first().dblclick();
    await page.waitForTimeout(400);
    let input = page.locator('input[type="text"]:visible').first();
    if (await input.isVisible().catch(()=>false)) { await input.fill('Keeper One EDIT1'); await page.keyboard.press('Enter'); await page.waitForTimeout(500); }
    await page.locator('[role="treeitem"] span:has-text("Keeper One EDIT1")').first().dblclick();
    await page.waitForTimeout(400);
    input = page.locator('input[type="text"]:visible').first();
    if (await input.isVisible().catch(()=>false)) { await input.fill('Keeper One EDIT2'); await page.keyboard.press('Enter'); await page.waitForTimeout(500); }
    const hadEdit2 = await nodeExists('Keeper One EDIT2');
    // Undo once -> EDIT1
    await page.keyboard.press('Meta+z'); await page.waitForTimeout(900);
    const backToEdit1 = await nodeExists('Keeper One EDIT1') && !(await nodeExists('Keeper One EDIT2'));
    // Undo again -> original
    await page.keyboard.press('Meta+z'); await page.waitForTimeout(900);
    const backToOrig = await nodeExists('Keeper One') && !(await nodeExists('Keeper One EDIT1'));
    // Redo -> EDIT1
    await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(900);
    const redoToEdit1 = await nodeExists('Keeper One EDIT1');
    await shot('04-undo-redo-multi');
    return {
      pass: hadEdit2 && backToEdit1 && backToOrig && redoToEdit1,
      note: `edit2=${hadEdit2} undo1=${backToEdit1} undo2=${backToOrig} redo=${redoToEdit1}`,
    };
  });

  // LAYER 2 — AUTOSAVE / PERSISTENCE across a full app reload.
  await run('layer2-persist-across-reload', async () => {
    // Ensure a distinctive node + content exist, then reload the renderer.
    await clickNode('Precious Child');
    await page.waitForTimeout(400);
    const contentBefore = await page.evaluate(() => (document.querySelector('.ProseMirror')?.textContent || ''));
    // Full reload of the renderer (does NOT clear disk/localStorage).
    await page.reload();
    await page.waitForLoadState('domcontentloaded').catch(()=>{});
    await page.waitForTimeout(4000);
    if (!page.url().includes('/app')) {
      await page.evaluate(() => { window.location.href = '/app'; }).catch(()=>{});
      await page.waitForTimeout(4000);
    }
    // Wait for shell.
    const newBtn = page.locator('button:has-text("New Outline")').first();
    await newBtn.waitFor({ state: 'visible', timeout: 60000 }).catch(()=>{});
    await dismissWelcome();
    await selectOutline(ZZ).catch(()=>{});
    await page.waitForTimeout(1000);
    const survivedNode = await nodeExists('Precious Child');
    let survivedContent = false;
    if (survivedNode) {
      await clickNode('Precious Child');
      await page.waitForTimeout(600);
      survivedContent = await page.evaluate(() => (document.querySelector('.ProseMirror')?.textContent || '').includes('SACRED CONTENT'));
    }
    await shot('05-after-reload');
    return {
      pass: survivedNode && survivedContent,
      note: `contentBeforeLen=${contentBefore.length} nodeSurvived=${survivedNode} contentSurvived=${survivedContent}`,
    };
  });

  // LAYER 3 — SNAPSHOT ENGINE: prove the disk snapshot data path works end to
  // end (create -> persist -> list -> read back intact). This is the layer that
  // survives crashes / undo-stack overflow. Driven through the exposed
  // electronAPI so it is independent of the toolbar button UI.
  await run('layer3-snapshot-engine-roundtrip', async () => {
    const engineName = 'ZZ ENGINE ' + Date.now().toString().slice(-6);
    const r = await page.evaluate(async (name) => {
      const api = (window).electronAPI;
      if (!api || typeof api.snapshotCreate !== 'function') return { ok: false, reason: 'no snapshot API' };
      const outline = {
        id: 'eng', name, rootId: 'r', createdAt: Date.now(), updatedAt: Date.now(),
        nodes: { r: { id: 'r', name, content: 'SACRED CONTENT ENGINE', childrenIds: [], parentId: null } },
      };
      const create = await api.snapshotCreate({ outline, label: 'engine test', kind: 'manual' });
      const list = await api.snapshotList({ outlineName: name });
      const snaps = (list && list.snapshots) || [];
      let readContent = false;
      if (snaps.length) {
        const read = await api.snapshotRead({ outlineName: name, fileName: snaps[0].fileName });
        readContent = !!(read && read.outline && JSON.stringify(read.outline).includes('SACRED CONTENT ENGINE'));
        // cleanup the throwaway snapshot
        await api.snapshotDelete({ outlineName: name, fileName: snaps[0].fileName }).catch(()=>{});
      }
      return { ok: true, created: !!(create && create.success), listed: snaps.length, readContent };
    }, engineName);
    return {
      pass: !!(r.ok && r.created && r.listed >= 1 && r.readContent),
      note: JSON.stringify(r),
    };
  });

  // LAYER 3c — FULL UI PATH: manual Backup via the toolbar button, delete the
  // whole branch, then Restore the snapshot through the dialog UI. Proves the
  // user-facing snapshot recovery works end to end (not just the engine).
  await run('layer3-manual-backup-restore-ui', async () => {
    await selectOutline(ZZ).catch(()=>{});
    await page.waitForTimeout(600);
    // Make a manual snapshot.
    if (!(await openBackupDialog())) return { pass: false, note: 'backup dialog would not open [' + lastBackupDiag + ']' };
    const labelInput = page.locator('#snapshot-label');
    if (await labelInput.isVisible().catch(()=>false)) await labelInput.fill('ui recovery point');
    const backupNow = page.locator('button:has-text("Back up now")').first();
    const backedUp = await backupNow.isVisible().catch(()=>false);
    if (backedUp) { await backupNow.click(); await page.waitForTimeout(1600); }
    await shot('06a-manual-backup');
    await page.locator('button:has-text("Close")').first().click().catch(()=>{});
    await page.waitForTimeout(500);
    // Delete the whole Precious Branch subtree.
    await clickNode('Precious Branch');
    await deleteSelected();
    await page.waitForTimeout(600);
    const branchGone = !(await nodeExists('Precious Branch')) && !(await nodeExists('Precious Child'));
    await shot('06b-branch-deleted');
    // Restore via the dialog UI.
    if (!(await openBackupDialog())) return { pass: false, note: 'restore dialog would not open; backedUp=' + backedUp };
    const restoreTab = page.locator('button[role="tab"]:has-text("Restore")').first();
    await restoreTab.click().catch(()=>{});
    await page.waitForTimeout(1000);
    await shot('06c-restore-list');
    const restoreRow = page.locator('button[title="Restore this snapshot"]').first();
    const hasRow = await restoreRow.isVisible().catch(()=>false);
    if (hasRow) {
      await restoreRow.click();
      await page.waitForTimeout(700);
      const confirmRestore = page.locator('[role="alertdialog"] button:has-text("Restore")').last();
      if (await confirmRestore.isVisible().catch(()=>false)) { await confirmRestore.click(); await page.waitForTimeout(2500); }
    }
    await page.waitForTimeout(1200);
    await shot('06d-after-ui-restore');
    const branchBack = await nodeExists('Precious Branch');
    let contentBack = false;
    if (await nodeExists('Precious Child')) {
      await clickNode('Precious Child');
      await page.waitForTimeout(700);
      contentBack = await page.evaluate(() => (document.querySelector('.ProseMirror')?.textContent || '').includes('SACRED CONTENT'));
    }
    return {
      pass: backedUp && branchGone && hasRow && branchBack && contentBack,
      note: `backedUp=${backedUp} branchGone=${branchGone} restoreRow=${hasRow} branchBack=${branchBack} contentBack=${contentBack}`,
    };
  });

  // LAYER 3b — WORST CASE: delete an entire branch (subtree + its content), then
  // recover it. Undo is the always-available recovery path; snapshots are the
  // backstop verified above. Confirms nothing is lost with no way back.
  await run('layer3-delete-branch-recover', async () => {
    await selectOutline(ZZ).catch(()=>{});
    await page.waitForTimeout(600);
    await clickNode('Precious Branch');
    const before = await treeCount();
    await deleteSelected();
    await page.waitForTimeout(600);
    await shot('07a-branch-deleted');
    const branchGone = !(await nodeExists('Precious Branch')) && !(await nodeExists('Precious Child'));
    // Recover via undo.
    await page.keyboard.press('Meta+z');
    await page.waitForTimeout(1200);
    await shot('07b-branch-recovered');
    const branchBack = await nodeExists('Precious Branch');
    let childBack = false, contentBack = false;
    if (await nodeExists('Precious Child')) {
      childBack = true;
      await clickNode('Precious Child');
      await page.waitForTimeout(700);
      contentBack = await page.evaluate(() => (document.querySelector('.ProseMirror')?.textContent || '').includes('SACRED CONTENT'));
    }
    const after = await treeCount();
    return {
      pass: branchGone && branchBack && childBack && contentBack,
      note: `before=${before} branchGone=${branchGone} branchBack=${branchBack} childBack=${childBack} contentBack=${contentBack} after=${after}`,
    };
  });

  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(results, null, 2));
  const passed = Object.values(results).filter(r => r.pass).length;
  const total = Object.keys(results).length;
  const md = ['# Data Recovery Sweep', '', `Passed ${passed}/${total}`, '',
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
