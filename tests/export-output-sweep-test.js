// tests/export-output-sweep-test.js
//
// EXPORT / OUTPUT QA SWEEP — drives IdiamPro's "send data OUT" workflows the
// way a human would, screenshots each, and judges the result.
//
// DATA SAFETY: does ALL work inside the pre-existing throwaway outline
// "ZZ TEST safe to delete" (created if missing). NEVER touches, renames, or
// deletes any of Howard's real outlines. Deletes nothing.
//
// COST SAFETY: only FREE / local outputs are run to completion (text exports,
// mind-map/diagram). Paid outputs (YouTube package = AI, Podcast = OpenAI TTS,
// AI illustration = Google Imagen) are only OPENED and inspected — the test
// STOPS before any button that would spend money.
//
// Workflows:
//   1. Export dialog — list all formats; run FREE text exports (Markdown, HTML,
//      Plain Text, CSV) to completion by mocking the native save dialog and
//      verifying a real file lands on disk with real content.
//   2. Mind-map / diagram from a branch (local/free) — generate + confirm SVG.
//   3. Share as YouTube package — open, inspect setup UI, STOP (AI/paid).
//   4. Podcast — open, inspect setup UI, STOP (OpenAI TTS/paid).
//   5. AI image (Generate Visual > Conceptual Illustration) — open, inspect
//      prompt UI, STOP (Google Imagen/paid).
//
// Screenshots + report.json/report.md -> test-screenshots/export-output-sweep/.

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'export-output-sweep');
fs.mkdirSync(OUT_DIR, { recursive: true });
const SCRATCH = '/private/tmp/claude-501/-Users-howardjachter-Developer-IdiamPro/a8db6996-3bce-4aef-8646-4175b8f089c9/scratchpad/export-sweep';
fs.mkdirSync(SCRATCH, { recursive: true });

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
async function refocus() {
  try {
    const { execSync } = require('child_process');
    execSync(`osascript -e 'tell application "Terminal" to activate'`);
  } catch {}
}
async function run(name, fn) {
  console.log(`\n=== ${name} ===`);
  try { const r = await fn(); results[name] = r; console.log(name, JSON.stringify(r)); }
  catch (e) { results[name] = { pass: false, note: 'threw: ' + e.message }; console.log(name, 'ERROR', e.message); }
  await refocus();
}
async function treeCount() { return await page.locator('[role="treeitem"]').count(); }

async function selectOutline(nameText) {
  const item = page.locator(`text=${nameText}`).first();
  await item.waitFor({ state: 'visible', timeout: 10000 });
  await item.click();
  await page.waitForTimeout(1500);
}
async function clickNode(text) {
  const n = page.locator(`[role="treeitem"] span:has-text("${text}")`).first();
  await n.click();
  await page.waitForTimeout(300);
  return n;
}
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
async function closeAnyDialog() {
  await page.keyboard.press('Escape').catch(()=>{});
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape').catch(()=>{});
  await page.waitForTimeout(300);
}

async function launch() {
  const projectRoot = path.resolve(__dirname, '..');
  electronApp = await electron.launch({ args: [projectRoot], env: { ...process.env, NODE_ENV: 'development' } });
  page = await findMainWindow(electronApp);
  page.on('dialog', async (d) => { try { await d.dismiss(); } catch {} });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  await page.setViewportSize({ width: 1440, height: 900 });
  if (!page.url().includes('/app')) {
    await page.evaluate(() => { window.location.href = '/app'; }).catch(()=>{});
    await page.waitForLoadState('domcontentloaded').catch(()=>{});
  }
  await page.evaluate(() => { try { localStorage.setItem('discovery:professionalMode', 'true'); localStorage.setItem('aiDataConsent', 'granted'); } catch {} });
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
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(1000);
}

async function ensureZZ() {
  // Select ZZ TEST if present; otherwise create + rename a throwaway outline.
  const zzItem = page.locator(`text=${ZZ}`).first();
  if (await zzItem.isVisible({ timeout: 3000 }).catch(()=>false)) {
    await selectOutline(ZZ);
    return true;
  }
  // Create it.
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
      await page.waitForTimeout(700);
    }
  }
  return true;
}

async function ensureBranch() {
  // Guarantee ZZ has a parent node with children + some content.
  const first = page.locator('[role="treeitem"]').first();
  await first.click();
  await page.waitForTimeout(300);
  await buildList(['Export Parent', 'Child One', 'Child Two']);
  // Indent Child One + Child Two under Export Parent.
  await clickNode('Child One');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(400);
  await clickNode('Child Two');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(400);
  // Add content to Child One.
  await clickNode('Child One');
  await page.waitForTimeout(400);
  const editor = page.locator('.ProseMirror').first();
  if (await editor.isVisible({ timeout: 5000 }).catch(()=>false)) {
    await editor.click();
    await page.keyboard.type('Sample content for export sweep. ' + Date.now());
    await page.waitForTimeout(600);
  }
  await page.keyboard.press('Escape').catch(()=>{});
}

async function openExportMenu() {
  const btn = page.locator('[aria-label^="Export"]').first();
  await btn.click();
  await page.waitForTimeout(500);
}

// The renderer's electronAPI is a FROZEN contextBridge object, so it cannot be
// mocked from the page. Instead we override the 'save-file-dialog' IPC handler
// in the MAIN process so no native OS save panel appears — it just returns our
// scratch path. writeFile stays real, so a genuine file lands on disk.
async function setSavePath(p) {
  await electronApp.evaluate(({ ipcMain }, savePath) => {
    try { ipcMain.removeHandler('save-file-dialog'); } catch {}
    ipcMain.handle('save-file-dialog', async () => savePath);
  }, p);
}

// Opens the export dialog fresh (it auto-closes after each successful export),
// runs one FREE format to completion, and verifies a real file on disk.
async function doOneExport(formatLabel, expectExt) {
  const outPath = path.join(SCRATCH, `zz-${formatLabel.replace(/[^a-z0-9]/gi,'_')}${expectExt}`);
  try { fs.unlinkSync(outPath); } catch {}
  await setSavePath(outPath);
  // Fresh open: Export menu -> "Export Current Outline".
  await clickNode('Export Parent');
  await openExportMenu();
  await page.locator('text=Export Current Outline').first().click();
  await page.waitForTimeout(900);
  const tile = page.locator(`button:has(span:text-is("${formatLabel}"))`).first();
  await tile.scrollIntoViewIfNeeded().catch(()=>{});
  await tile.click();
  await page.waitForTimeout(400);
  const exportBtn = page.locator('[role="dialog"] button:has-text("Export")').last();
  await exportBtn.click();
  const deadline = Date.now() + 15000;
  let exists = false, size = 0, head = '';
  while (Date.now() < deadline) {
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) { exists = true; size = fs.statSync(outPath).size; try { head = fs.readFileSync(outPath, 'utf8').slice(0, 120).replace(/\s+/g,' '); } catch { head = '(binary)'; } break; }
    await page.waitForTimeout(300);
  }
  await closeAnyDialog();
  return { exists, size, head };
}

async function main() {
  await launch();
  await shot('00-launched');
  await run('setup-zz', async () => { const ok = await ensureZZ(); await shot('01-zz'); return { pass: ok, note: 'ZZ selected/created' }; });
  await run('setup-branch', async () => { await ensureBranch(); await shot('02-branch'); return { pass: (await treeCount()) > 0, note: 'branch built' }; });

  // 1 — EXPORT DIALOG + free text exports
  await run('export-open-and-list', async () => {
    await clickNode('Export Parent');
    await openExportMenu();
    await shot('03a-export-menu');
    // Click "Export Current Outline" (whole outline export -> full format grid).
    const item = page.locator('text=Export Current Outline').first();
    await item.click();
    await page.waitForTimeout(1200);
    await shot('03b-export-dialog');
    // Collect all visible format tile names.
    const names = await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]');
      if (!dlg) return [];
      return Array.from(dlg.querySelectorAll('button span')).map(s => (s.textContent||'').trim()).filter(Boolean);
    });
    results.__formatList = names;
    const title = await page.locator('[role="dialog"] h2, [role="dialog"] [id]').first().textContent().catch(()=>'');
    await closeAnyDialog();
    return { pass: names.length > 5, note: `dialogTitle="${(title||'').slice(0,40)}" tiles=${names.length}` };
  });

  await run('export-markdown', async () => { const r = await doOneExport('Markdown', '.md'); await shot('04a-md'); return { pass: r.exists && r.size > 0, note: JSON.stringify(r) }; });
  await run('export-html', async () => { const r = await doOneExport('HTML', '.html'); await shot('04b-html'); return { pass: r.exists && r.size > 0, note: JSON.stringify(r) }; });
  await run('export-plaintext', async () => { const r = await doOneExport('Plain Text', '.txt'); await shot('04c-txt'); return { pass: r.exists && r.size > 0, note: JSON.stringify(r) }; });
  await run('export-csv', async () => { const r = await doOneExport('CSV', '.csv'); await shot('04d-csv'); return { pass: r.exists && r.size > 0, note: JSON.stringify(r) }; });
  await run('export-opml', async () => { const r = await doOneExport('OPML', '.opml'); await shot('04e-opml'); return { pass: r.exists && r.size > 0, note: JSON.stringify(r) }; });

  // 4 — PODCAST — open (fresh export dialog -> Podcast tile) + inspect only.
  await run('podcast-ui-only', async () => {
    await clickNode('Export Parent');
    await openExportMenu();
    await page.locator('text=Export Current Outline').first().click();
    await page.waitForTimeout(900);
    const tile = page.locator(`button:has(span:text-is("Podcast"))`).first();
    let opened = false, controls = '';
    if (await tile.isVisible({ timeout: 3000 }).catch(()=>false)) {
      await tile.scrollIntoViewIfNeeded().catch(()=>{});
      await tile.click();
      await page.waitForTimeout(1200);
      opened = await page.locator('text=Generate Podcast').first().isVisible().catch(()=>false);
      controls = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"]');
        return d ? (d.textContent||'').replace(/\s+/g,' ').slice(0, 400) : '';
      });
    }
    await shot('05-podcast-ui');
    await closeAnyDialog();
    return { pass: opened, note: `NO GENERATE CLICKED. text="${controls.slice(0,180)}"` };
  });

  await closeAnyDialog();

  // 2 — MIND MAP / DIAGRAM (free/local)
  await run('mindmap-generate', async () => {
    await clickNode('Export Parent');
    await page.waitForTimeout(500);
    // Diagram dropdown appears only when node has children.
    const diagBtn = page.locator('button:has-text("Diagram")').first();
    const vis = await diagBtn.isVisible({ timeout: 5000 }).catch(()=>false);
    if (!vis) return { pass: false, note: 'Diagram button not visible (node may lack children)' };
    await diagBtn.click();
    await page.waitForTimeout(400);
    await page.locator('text=Mind Map').first().click();
    await page.waitForTimeout(2500);
    await shot('06-mindmap');
    const svg = await page.locator('.ProseMirror svg').count();
    const hasMermaidText = await page.evaluate(() => (document.querySelector('.ProseMirror')?.textContent||'').includes('mindmap'));
    return { pass: svg > 0 || hasMermaidText, note: `svgInContent=${svg} mermaidText=${hasMermaidText}` };
  });

  // 5 — AI IMAGE (Generate Visual > Conceptual Illustration) — inspect only.
  await run('image-ui-only', async () => {
    await clickNode('Child One');
    await page.waitForTimeout(400);
    const imgBtn = page.locator('button:has-text("Image")').first();
    let opened = false, hasPrompt = false, hasCost = false, dText = '';
    if (await imgBtn.isVisible({ timeout: 5000 }).catch(()=>false)) {
      await imgBtn.click();
      await page.waitForTimeout(1000);
      opened = await page.locator('text=Generate Visual').first().isVisible().catch(()=>false);
      // Ensure Conceptual Illustration is selected (default).
      dText = await page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); return d ? (d.textContent||'').replace(/\s+/g,' ') : ''; });
      hasPrompt = await page.locator('textarea').first().isVisible().catch(()=>false);
      hasCost = /Imagen|Pro|generation|counts|paid|premium|charge/i.test(dText);
    }
    await shot('07-image-ui');
    await closeAnyDialog();
    return { pass: opened && hasPrompt, note: `NO GENERATE CLICKED. costDisclosed=${hasCost} text="${dText.slice(0,180)}"` };
  });

  // 3 — YOUTUBE PACKAGE — inspect only.
  await run('youtube-ui-only', async () => {
    await clickNode('Export Parent');
    await page.waitForTimeout(400);
    await openExportMenu();
    const item = page.locator('text=Share as YouTube package').first();
    let opened = false, dText = '';
    if (await item.isVisible({ timeout: 3000 }).catch(()=>false)) {
      await item.click();
      await page.waitForTimeout(1200);
      opened = await page.locator('[role="dialog"]').first().isVisible().catch(()=>false);
      dText = await page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); return d ? (d.textContent||'').replace(/\s+/g,' ').slice(0,400) : ''; });
    }
    await shot('08-youtube-ui');
    await closeAnyDialog();
    return { pass: opened, note: `NO GENERATE CLICKED. text="${dText.slice(0,200)}"` };
  });

  // Restore mocked API (cosmetic; app is about to close).
  await page.evaluate(() => { const api = window.electronAPI; if (api && api.__origSaveFileDialog) api.saveFileDialog = api.__origSaveFileDialog; }).catch(()=>{});

  const passCount = Object.values(results).filter(r => r && r.pass).length;
  const total = Object.keys(results).filter(k => !k.startsWith('__')).length;
  const report = { timestamp: new Date().toISOString(), passCount, total, formatList: results.__formatList || [], results };
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  const md = ['# Export / Output Sweep', '', `Result: ${passCount}/${total}`, '', '## Formats seen', (results.__formatList||[]).join(', '), '', '## Steps',
    ...Object.entries(results).filter(([k])=>!k.startsWith('__')).map(([k,v]) => `- **${k}**: ${v && v.pass ? 'PASS' : 'FAIL'} — ${v && v.note}`)].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), md);
  console.log(`\nRESULT ${passCount}/${total}`);

  await Promise.race([electronApp.close().catch(()=>{}), new Promise(r => setTimeout(r, 5000))]);
  await refocus();
  return report;
}

main().then(r => process.exit(r.passCount === r.total ? 0 : 1)).catch(e => { console.error(e); process.exit(1); });
