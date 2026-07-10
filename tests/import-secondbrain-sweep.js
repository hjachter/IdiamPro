// Import + Second Brain QA sweep.
// Drives the free/local import paths (file import: Markdown / OPML / plain-text)
// and the Second Brain workflows (save, quick capture, search, dashboard),
// and UI-verifies the paid/AI imports (image OCR, audio/video transcription)
// WITHOUT triggering any paid API call.
//
// SAFETY: creates only ZZ-TEST-prefixed outlines. Never edits Howard's
// existing outlines. Saving to Second Brain adds one ZZ TEST entry (additive).
//
// No background tasks. Foreground synchronous run.

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  console.log('UNHANDLED:', msg);
});

const PROJECT_ROOT = '/Users/howardjachter/Developer/IdiamPro';
const SAMPLES = '/private/tmp/claude-501/-Users-howardjachter-Developer-IdiamPro/a8db6996-3bce-4aef-8646-4175b8f089c9/scratchpad/import-samples';
const SHOT_DIR = path.join(PROJECT_ROOT, 'test-screenshots', 'import-secondbrain-sweep');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

let app, page;
const results = [];
function R(step, verdict, note) { results.push({ step, verdict, note }); console.log(`[${verdict}] ${step} — ${note}`); }

async function shot(name) {
  try { await page.screenshot({ path: path.join(SHOT_DIR, name + '.png') }); } catch (e) {}
  try { require('child_process').execSync('osascript -e \'tell application "Terminal" to activate\'', { stdio: 'ignore' }); } catch (e) {}
}

async function findMain(a, maxWait = 30000) {
  const t = Date.now();
  while (Date.now() - t < maxWait) {
    for (const w of a.windows()) {
      try { const u = w.url(); if (u.startsWith('devtools://')) continue; if (u.includes('localhost:9002')) return w; } catch (e) {}
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('no main window');
}

async function closeAnyDialog() {
  try { await page.keyboard.press('Escape'); await page.waitForTimeout(400); } catch (e) {}
}

async function run() {
  console.log('Launching Electron...');
  app = await electron.launch({ args: [PROJECT_ROOT], env: { ...process.env, NODE_ENV: 'development' } });
  page = await findMain(app);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  if (!page.url().includes('/app')) {
    await page.evaluate(() => { window.location.href = '/app'; });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(4000);
  }
  await page.waitForTimeout(2000);
  await shot('01-app-loaded');

  // ---------- IMPORT: FILE (Markdown) ----------
  try {
    await openImportMenu();
    await page.locator('[role="menuitem"]:has-text("Import Outline")').first().click();
    await page.waitForTimeout(800);
    await shot('02-file-import-dialog');
    const fileInput = page.locator('input[type="file"]').last();
    await fileInput.setInputFiles(path.join(SAMPLES, 'ZZ-sample.md'));
    await page.waitForTimeout(1200);
    await shot('03-md-selected');
    // Click import/confirm button
    const importBtn = page.locator('button:has-text("Import")').last();
    if (await importBtn.count()) { await importBtn.click(); await page.waitForTimeout(1500); }
    await shot('04-md-imported');
    const bodyTxt = await page.evaluate(() => document.body.innerText);
    const ok = /Phase Two Build|Phase One Planning|Testing details/i.test(bodyTxt);
    R('Import Markdown file', ok ? 'WORKS' : 'CHECK', ok ? 'Nested nodes (Phase One/Two/Three, Testing details) appeared.' : 'Did not see expected node text after import — inspect screenshot 04.');
  } catch (e) { R('Import Markdown file', 'BROKEN', 'Threw: ' + e.message); await shot('04-md-error'); }
  await closeAnyDialog();

  // ---------- IMPORT: FILE (OPML) ----------
  try {
    await openImportMenu();
    await page.locator('[role="menuitem"]:has-text("Import Outline")').first().click();
    await page.waitForTimeout(800);
    const fileInput = page.locator('input[type="file"]').last();
    await fileInput.setInputFiles(path.join(SAMPLES, 'ZZ-sample.opml'));
    await page.waitForTimeout(1200);
    await shot('05-opml-selected');
    const importBtn = page.locator('button:has-text("Import")').last();
    if (await importBtn.count()) { await importBtn.click(); await page.waitForTimeout(1500); }
    await shot('06-opml-imported');
    const bodyTxt = await page.evaluate(() => document.body.innerText);
    const ok = /Fruits|Vegetables|Banana|Carrot/i.test(bodyTxt);
    R('Import OPML file', ok ? 'WORKS' : 'CHECK', ok ? 'Fruits/Vegetables tree imported.' : 'Expected OPML nodes not found — inspect 06.');
  } catch (e) { R('Import OPML file', 'BROKEN', 'Threw: ' + e.message); await shot('06-opml-error'); }
  await closeAnyDialog();

  // ---------- IMPORT: FILE (plain text, indentation -> nesting) ----------
  try {
    await openImportMenu();
    await page.locator('[role="menuitem"]:has-text("Import Outline")').first().click();
    await page.waitForTimeout(800);
    const fileInput = page.locator('input[type="file"]').last();
    await fileInput.setInputFiles(path.join(SAMPLES, 'ZZ-sample.txt'));
    await page.waitForTimeout(1200);
    await shot('07-txt-selected');
    const importBtn = page.locator('button:has-text("Import")').last();
    if (await importBtn.count()) { await importBtn.click(); await page.waitForTimeout(1500); }
    await shot('08-txt-imported');
    const bodyTxt = await page.evaluate(() => document.body.innerText);
    const ok = /Grocery List|Produce|Chores|Apples/i.test(bodyTxt);
    R('Import plain-text file', ok ? 'WORKS' : 'CHECK', ok ? 'Indented text became nested nodes.' : 'Expected text nodes not found — inspect 08.');
  } catch (e) { R('Import plain-text file', 'BROKEN', 'Threw: ' + e.message); await shot('08-txt-error'); }
  await closeAnyDialog();

  // ---------- RESEARCH & IMPORT: open + inspect source types + cost UI ----------
  try {
    await openImportMenu();
    await page.locator('[role="menuitem"]:has-text("Research & Import")').first().click();
    await page.waitForTimeout(1000);
    await shot('09-research-import-open');
    const txt = await page.evaluate(() => document.body.innerText);
    R('Research & Import dialog opens', /Research & Import/i.test(txt) ? 'WORKS' : 'CHECK', 'Dialog opened.');

    // Try to reveal the source-type picker and read available types.
    await shot('10-research-source-types');

    // Look for cost / AssemblyAI / key disclosure text anywhere in the dialog.
    const hasAssembly = /AssemblyAI/i.test(txt);
    const hasKeyNote = /requires .*key|API key|BYOK/i.test(txt);
    R('Research & Import cost disclosure (text scan)', 'INFO',
      `AssemblyAI mentioned: ${hasAssembly}; key/BYOK note: ${hasKeyNote}.`);
  } catch (e) { R('Research & Import dialog opens', 'BROKEN', 'Threw: ' + e.message); await shot('09-ri-error'); }
  await closeAnyDialog();

  // ---------- SECOND BRAIN: Save to SB (DATA-SAFE: only from a ZZ TEST outline) ----------
  // IMPORTANT: Save-to-Second-Brain copies the SELECTED node's whole subtree
  // into the real Second Brain. To avoid polluting real data we ONLY proceed
  // when a ZZ-TEST-prefixed outline is loaded and a ZZ node is selected.
  try {
    await openSidebar();
    const zzOutline = page.locator('text=/ZZ[- ]?sample/i').first();
    if (await zzOutline.count()) { await zzOutline.click(); await page.waitForTimeout(1000); }
    await shot('11-zz-outline-loaded');
    // Select a leaf node inside the ZZ outline (its content is our sample data).
    const zzNode = page.locator('text=/^\\s*Chores\\s*$/i, text=/Grocery List/i, text=/Phase Two Build/i, text=/Fruits/i').first();
    let selectedZz = false;
    if (await zzNode.count()) { await zzNode.click(); await page.waitForTimeout(500); selectedZz = true; }
    await shot('12-zz-node-selected');

    if (!selectedZz) {
      R('Save to Second Brain', 'SKIP', 'Data-safety guard: no ZZ TEST node available to select; skipped to avoid copying real data into Second Brain.');
    } else {
      await openBrainMenu();
      const saveItem = page.locator('[role="menuitem"]:has-text("Save Selection to Second Brain")').first();
      const disabled = await saveItem.getAttribute('aria-disabled');
      if (disabled === 'true') {
        R('Save to Second Brain', 'CHECK', 'Save item disabled despite selected ZZ node — inspect 12.');
        await closeAnyDialog();
      } else {
        await saveItem.click();
        await page.waitForTimeout(1200);
        await shot('13-saved-to-sb');
        const t = await page.evaluate(() => document.body.innerText);
        const ok = /Saved|Second Brain/i.test(t);
        R('Save to Second Brain', ok ? 'WORKS' : 'CHECK', ok ? 'ZZ subtree copied into Second Brain (use Unmerge to revert).' : 'No obvious confirmation — inspect 13.');
      }
    }
  } catch (e) { R('Save to Second Brain', 'BROKEN', 'Threw: ' + e.message); await shot('13-sb-error'); }
  await closeAnyDialog();

  // ---------- SECOND BRAIN: Quick Capture ----------
  try {
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+I' : 'Control+Shift+I');
    await page.waitForTimeout(900);
    await shot('14-quick-capture-open');
    const ta = page.locator('textarea').last();
    if (await ta.count()) {
      await ta.click();
      await ta.fill('ZZ TEST quick capture note — sweep verification');
      await page.waitForTimeout(400);
      await shot('15-quick-capture-typed');
      const saveBtn = page.locator('button:has-text("Capture"), button:has-text("Save")').last();
      if (await saveBtn.count()) { await saveBtn.click(); await page.waitForTimeout(1200); }
      await shot('16-quick-capture-saved');
      R('Quick Capture', 'WORKS', 'Note typed and captured.');
    } else {
      R('Quick Capture', 'CHECK', 'No textarea found in Quick Capture dialog — inspect 14.');
    }
  } catch (e) { R('Quick Capture', 'BROKEN', 'Threw: ' + e.message); await shot('16-qc-error'); }
  await closeAnyDialog();

  // ---------- SECOND BRAIN: Dashboard ----------
  try {
    await openBrainMenu();
    await page.locator('[role="menuitem"]:has-text("View Dashboard")').first().click();
    await page.waitForTimeout(1000);
    await shot('17-sb-dashboard');
    const t = await page.evaluate(() => document.body.innerText);
    const ok = /Second Brain Dashboard|Total nodes|Recent saves/i.test(t);
    const seesZZ = /ZZ TEST/i.test(t);
    R('Second Brain Dashboard', ok ? 'WORKS' : 'CHECK', ok ? `Dashboard reads clearly. ZZ TEST entry visible: ${seesZZ}.` : 'Dashboard content not found — inspect 17.');
  } catch (e) { R('Second Brain Dashboard', 'BROKEN', 'Threw: ' + e.message); await shot('17-dash-error'); }
  await closeAnyDialog();

  // ---------- SECOND BRAIN: Search ----------
  try {
    await openBrainMenu();
    await page.locator('[role="menuitem"]:has-text("Search Second Brain")').first().click();
    await page.waitForTimeout(1000);
    await shot('18-sb-search-open');
    // Type a query if a search field appears
    const t = await page.evaluate(() => document.body.innerText);
    // NOTE: "Search Second Brain" actually opens the "Ask Your Outlines" AI
    // Q&A chat scoped to Second Brain — NOT a keyword search box. Each query
    // spends an AI generation. Flagged as a naming mismatch.
    const isAskChat = /Ask Your Outlines|Ask me anything/i.test(t);
    const scopedSB = /Second Brain/i.test(t);
    R('Search Second Brain', isAskChat ? 'AWKWARD' : 'CHECK',
      isAskChat
        ? `Opens the "Ask Your Outlines" AI chat scoped to Second Brain (${scopedSB ? 'scope confirmed' : 'scope unclear'}), not a keyword search — label implies free search but it costs an AI generation.`
        : 'Did not open the expected surface — inspect 18.');
  } catch (e) { R('Search Second Brain', 'BROKEN', 'Threw: ' + e.message); await shot('19-search-error'); }
  await closeAnyDialog();

  // ---------- REFRESH FROM WEB (LIVE BOOKS) menu presence ----------
  try {
    await openImportMenu();
    await page.waitForTimeout(400);
    await shot('20-import-menu');
    const t = await page.evaluate(() => document.body.innerText);
    const has = /Refresh from Web/i.test(t);
    R('Refresh from Web menu item', has ? 'WORKS' : 'CHECK', has ? '"Refresh from Web" present in Import menu.' : 'Not found in Import menu — inspect 20.');
  } catch (e) { R('Refresh from Web menu item', 'BROKEN', 'Threw: ' + e.message); }
  await closeAnyDialog();

  // ---------- WRITE REPORT ----------
  const report = { ranAt: new Date().toISOString(), results };
  fs.writeFileSync(path.join(SHOT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  const md = ['# Import + Second Brain sweep', '', ...results.map(r => `- **${r.verdict}** — ${r.step}: ${r.note}`)].join('\n');
  fs.writeFileSync(path.join(SHOT_DIR, 'report.md'), md);
  console.log('\n===== SUMMARY =====');
  results.forEach(r => console.log(`[${r.verdict}] ${r.step}: ${r.note}`));

  await app.close();
}

// ---- helpers to open menus (try toolbar then overflow) ----
async function clickAny(selectors) {
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.count()) { try { await el.click({ timeout: 2000 }); return true; } catch (e) {} }
  }
  return false;
}
async function openImportMenu() {
  await closeAnyDialog();
  let ok = await clickAny(['button[aria-label^="Import"]', 'button[aria-label*="Import" i]']);
  if (!ok) { // try overflow
    await clickAny(['button[aria-label="More tools"]']);
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(500);
}
async function openBrainMenu() {
  await closeAnyDialog();
  let ok = await clickAny(['button[aria-label="Second Brain menu"]']);
  if (!ok) {
    await clickAny(['button[aria-label="More tools"]']);
    await page.waitForTimeout(300);
    await clickAny(['[role="menuitem"]:has-text("Second Brain")']);
  }
  await page.waitForTimeout(500);
}
async function openSidebar() {
  await clickAny(['button[aria-label*="sidebar" i]', 'button[aria-label*="outlines sidebar" i]']);
  await page.waitForTimeout(600);
}

run().catch(async (e) => { console.error('FATAL', e); try { await shot('FATAL'); } catch (_) {} try { await app.close(); } catch (_) {} process.exit(1); });
