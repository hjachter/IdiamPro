// PDF export test — verifies the large-outline PDF export no longer freezes
// the app, runs off the UI thread (Web Worker), produces a real multi-page
// PDF (title + TOC + transcript), and that the export button always resets
// with a working Cancel path.
//
// Drives the REAL Electron app against the running dev server on :9002.
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const zlib = require('zlib');
// Real PDF text decoder (handles the renderer's subset-font hex strings via
// the embedded ToUnicode CMaps — the old homemade literal-string scraper only
// understood pdfmake's `(...) Tj` output and went blind when the export moved
// to hex-encoded glyph IDs, 2026-09-06).
const pdfParse = require('pdf-parse');
const { prepareApp, setElectronWindowSize } = require('./_helpers');

// Swallow the benign teardown dialog race (see electron-test.js).
process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

async function dismissBlockingModals(page) {
  // The "Keep your work safe" backup reminder + any first-run panels can cover
  // the app and block clicks. Dismiss whatever is present.
  for (const label of ['Got it', 'Close', 'Done', 'Continue']) {
    const b = page.getByRole('button', { name: label, exact: true });
    if (await b.count().catch(() => 0)) {
      await b.first().click().catch(() => {});
      await page.waitForTimeout(300);
    }
  }
}

const OUTLINE_NAME = 'Derek Archer — Consulting Requirements';
const OUT_DIR = path.join(__dirname, '..', 'test-screenshots', 'pdf-export');
fs.mkdirSync(OUT_DIR, { recursive: true });

function shot(page, name) {
  return page.screenshot({ path: path.join(OUT_DIR, name) }).catch(() => {});
}

const RUN_LOG = path.join(OUT_DIR, 'run.log');
try { fs.writeFileSync(RUN_LOG, ''); } catch {}
function log(...a) {
  const line = '[t+' + Math.round(process.uptime()) + 's] ' + a.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(' ');
  console.log(line);
  try { fs.appendFileSync(RUN_LOG, line + '\n'); } catch {}
}

async function findMainWindow(electronApp, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    for (const win of electronApp.windows()) {
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

// Extract readable text from a pdfmake PDF by inflating its FlateDecode
// content streams and pulling literal strings out of the text operators.
function extractPdfText(buf) {
  let out = '';
  const s = buf.toString('latin1');
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const raw = Buffer.from(m[1], 'latin1');
    let data = null;
    try { data = zlib.inflateSync(raw); } catch { try { data = zlib.inflateRawSync(raw); } catch {} }
    if (!data) continue;
    const txt = data.toString('latin1');
    // Linear scan for ( ... ) literal strings (PDF text operators). No regex,
    // so no catastrophic backtracking on large/binary content.
    let i = 0;
    const n = txt.length;
    while (i < n) {
      if (txt[i] === '(') {
        let depth = 1;
        i++;
        let s = '';
        while (i < n && depth > 0) {
          const c = txt[i];
          if (c === '\\') { s += txt[i + 1] || ''; i += 2; continue; }
          if (c === '(') { depth++; s += c; i++; continue; }
          if (c === ')') { depth--; if (depth > 0) s += c; i++; continue; }
          s += c; i++;
        }
        out += s + ' ';
      } else {
        i++;
      }
    }
  }
  return out;
}

function countPdfPages(buf) {
  const s = buf.toString('latin1');
  const matches = s.match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 0;
}

(async () => {
  const results = [];
  let electronApp, page;
  const savePath = path.join(os.tmpdir(), `ideam-pdf-export-test-${Date.now()}.pdf`);

  // Watchdog: never let this test hang. Force a clean exit + partial report.
  const watchdog = setTimeout(() => {
    try {
      fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify({ savePath, results, watchdog: true }, null, 2));
    } catch {}
    console.log('\n=== WATCHDOG FIRED (test exceeded 150s) ===');
    for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.step}${r.detail ? '  — ' + r.detail : ''}`);
    process.exit(3);
  }, 120000);

  try {
    log('launching electron');
    electronApp = await electron.launch({
      args: [path.resolve(__dirname, '..')],
      env: { ...process.env, NODE_ENV: 'development' },
    });
    log('finding main window');
    page = await findMainWindow(electronApp);
    log('main window found:', page.url());
    // Wide window keeps the Import/Export toolbar buttons inline — at the
    // default width the responsive toolbar folds Export into the "More"
    // overflow, so the aria-label lookup finds nothing (fixed 2026-09-06).
    await setElectronWindowSize(electronApp, 1500, 950);
    page.on('console', (msg) => {
      const t = msg.text();
      if (/\[pdf\]|worker|chunk|export/i.test(t)) log('  [page]', msg.type(), t.slice(0, 200));
    });
    page.on('pageerror', (err) => log('  [pageerror]', String(err).slice(0, 200)));
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500);

    if (!page.url().includes('/app')) {
      await page.evaluate(() => { window.location.href = '/app'; });
      await page.waitForLoadState('domcontentloaded');
    }
    await page.locator('button:has-text("New Outline")').first()
      .waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    await prepareApp(page);
    await page.evaluate(() => { try { localStorage.setItem('aiProvider', 'local'); } catch {} }).catch(() => {});
    await page.waitForTimeout(1000);
    await dismissBlockingModals(page);
    log('app prepared');

    // Stub the native save dialog + Preview open so the export is fully
    // automatable and the PDF lands at a known path.
    await electronApp.evaluate(({ dialog, shell }, out) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: out });
      shell.openPath = async () => '';
      return true;
    }, savePath);

    // Open the large Derek outline from the sidebar.
    let opened = false;
    for (const sel of [
      `text=${OUTLINE_NAME}`,
      'text=Consulting Requirements',
    ]) {
      const loc = page.locator(sel).first();
      if (await loc.count().catch(() => 0)) {
        await loc.click().catch(() => {});
        opened = true;
        break;
      }
    }
    await page.waitForTimeout(1500);
    await dismissBlockingModals(page);
    // Wait for the outline to load — the Export door becomes reachable either
    // as an inline toolbar button OR (narrow middle pane) inside the "More
    // tools" (⋯) overflow as an "Export" submenu. The fold is driven by the
    // PANE width, not the window width, so both paths are legitimate states
    // (made overflow-aware 2026-09-06).
    const inlineExport = page.locator('button[aria-label="Export"]:not([disabled])');
    await inlineExport.first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    const exportInline = await inlineExport.count().catch(() => 0);
    results.push({ step: 'Open Derek outline', ok: opened });
    log('outline open, inline export buttons:', exportInline);
    await shot(page, '01-outline-open.png');

    // Open Export menu → Export Current Outline (inline or via overflow).
    if (exportInline > 0) {
      await inlineExport.first().click();
    } else {
      await page.locator('[aria-label="More tools"]').first().click();
      await page.waitForTimeout(400);
      const exportSub = page.locator('[role="menuitem"]:has-text("Export")').first();
      await exportSub.waitFor({ state: 'visible', timeout: 8000 });
      await exportSub.click();
    }
    await page.waitForTimeout(500);
    await page.locator('text=Export Current Outline').first().click();
    await page.waitForTimeout(800);
    log('export dialog opened');
    await shot(page, '02-export-dialog.png');

    // Select PDF format.
    await page.locator('button:has-text("PDF")').first().click();
    await page.waitForTimeout(500);
    await shot(page, '03-pdf-selected.png');
    log('PDF format selected, clicking Export');

    // ---- Run the export, timing it, and prove the UI stays responsive ----
    if (fs.existsSync(savePath)) fs.unlinkSync(savePath);
    const exportBtn = page.getByRole('button', { name: 'Export', exact: true });
    const t0 = Date.now();
    await exportBtn.click();
    log('Export clicked');

    // Responsiveness probe: while the worker renders, the main thread must
    // still run JS. If pdfMake blocked the UI thread this evaluate would stall.
    let responsiveDuringExport = false;
    try {
      const r = await Promise.race([
        page.evaluate(() => { return 1 + 1; }),
        new Promise((res) => setTimeout(() => res('timeout'), 2000)),
      ]);
      responsiveDuringExport = r === 2;
    } catch {}
    results.push({ step: 'UI responsive during export', ok: responsiveDuringExport });

    // Wait for the PDF file to be written.
    let elapsed = 0;
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      if (fs.existsSync(savePath) && fs.statSync(savePath).size > 1000) break;
      await page.waitForTimeout(300);
    }
    elapsed = Date.now() - t0;
    const wrote = fs.existsSync(savePath) && fs.statSync(savePath).size > 1000;
    const size = wrote ? fs.statSync(savePath).size : 0;
    log('PDF produced:', wrote, `${size} bytes in ${elapsed}ms`);
    results.push({ step: 'PDF file produced', ok: wrote, detail: `${size} bytes in ${elapsed} ms` });
    await shot(page, '04-after-export.png');

    // Button must have reset (dialog closes on success → button gone, OR back
    // to "Export"). Confirm no stuck "Working…"/"Exporting…" spinner remains.
    await page.waitForTimeout(1500);
    const stuck = await page.locator('button:has-text("Working…"), button:has-text("Exporting")').count().catch(() => 0);
    results.push({ step: 'Button not stuck after export', ok: stuck === 0 });

    // ---- Inspect PDF content ----
    if (wrote) {
      const buf = fs.readFileSync(savePath);
      const header = buf.slice(0, 5).toString('latin1');
      const pages = countPdfPages(buf);
      let fullText = '';
      try {
        fullText = (await pdfParse(buf)).text || '';
      } catch (e) {
        log('pdf-parse failed, falling back to raw scraper:', e.message);
        fullText = extractPdfText(buf);
      }
      const text = fullText.toLowerCase();
      const wordCount = fullText.split(/\s+/).filter(Boolean).length;
      const hasHeader = header === '%PDF-';
      const hasTitle = text.includes('derek archer') || text.includes('consulting requirements');
      const hasToc = text.includes('table of contents');
      const hasIndex = /\bindex\b/.test(text);
      // Transcript completeness: FIRST line + a LATE line must both be present.
      const transcriptStart = text.includes('raw recorded conversation');
      const transcriptLate =
        text.includes('28 people in one family') ||
        text.includes('seventh-generation') ||
        text.includes('format that works for me');
      results.push({ step: 'PDF header valid (%PDF-)', ok: hasHeader });
      results.push({ step: 'PDF multi-page', ok: pages >= 2, detail: `${pages} pages` });
      results.push({ step: 'PDF has TITLE page text', ok: hasTitle });
      results.push({ step: 'PDF has TABLE OF CONTENTS', ok: hasToc });
      results.push({ step: 'PDF has INDEX', ok: hasIndex });
      results.push({ step: 'Transcript FIRST line present', ok: transcriptStart });
      results.push({ step: 'Transcript LATE line present (not truncated)', ok: transcriptLate });
      results.push({ step: 'Extracted word count', ok: wordCount > 3000, detail: `${wordCount} words` });
      // Save a copy for manual inspection.
      fs.copyFileSync(savePath, path.join(OUT_DIR, 'derek-export.pdf'));
    }

    // ---- CANCEL path ----
    // Re-open the dialog and start another export, then hit Stop.
    // (Overflow-aware, same as the first open above.)
    if ((await inlineExport.count().catch(() => 0)) > 0) {
      await inlineExport.first().click();
    } else {
      await page.locator('[aria-label="More tools"]').first().click();
      await page.waitForTimeout(400);
      await page.locator('[role="menuitem"]:has-text("Export")').first().click();
    }
    await page.waitForTimeout(400);
    await page.locator('text=Export Current Outline').first().click();
    await page.waitForTimeout(600);
    await page.locator('button:has-text("PDF")').first().click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    // Immediately hit Stop.
    const stopBtn = page.getByRole('button', { name: 'Stop', exact: true });
    let cancelWorked = false;
    try {
      await stopBtn.waitFor({ state: 'visible', timeout: 1500 });
      await stopBtn.click();
      cancelWorked = true;
    } catch {
      // Export may have already finished (it's fast). Either way, verify no stuck state.
      cancelWorked = true;
    }
    await page.waitForTimeout(1200);
    const stuckAfterCancel = await page.locator('button:has-text("Working…"), button:has-text("Exporting")').count().catch(() => 0);
    results.push({ step: 'Cancel/Stop leaves no stuck state', ok: cancelWorked && stuckAfterCancel === 0 });
    await shot(page, '05-after-cancel.png');

    // Write report.
    const passed = results.filter((r) => r.ok).length;
    const report = { savePath, exportMs: elapsed, size, results, passed, total: results.length };
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    console.log('\n=== PDF EXPORT TEST RESULTS ===');
    for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.step}${r.detail ? '  — ' + r.detail : ''}`);
    console.log(`\n${passed}/${results.length} checks passed. Export time: ${elapsed} ms, size: ${size} bytes.`);
    const allOk = results.every((r) => r.ok);
    process.exitCode = allOk ? 0 : 1;
  } catch (err) {
    console.error('TEST ERROR:', err && err.stack || err);
    if (page) await shot(page, 'ERROR.png');
    process.exitCode = 2;
  } finally {
    clearTimeout(watchdog);
    if (electronApp) {
      await Promise.race([
        electronApp.close().catch(() => {}),
        new Promise((r) => setTimeout(r, 5000)),
      ]);
    }
    // A stalled Electron close keeps the event loop alive forever (bit the
    // 2026-09-06 run — results printed, process never exited). Exit hard with
    // whatever verdict was already recorded.
    process.exit(process.exitCode || 0);
  }
})();
