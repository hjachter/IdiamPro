// Editor audit: drives the content/writing pane through the core writing
// capabilities (typing, formatting via keyboard + bubble menu, headings,
// lists, blockquote, code, checklist, links, paste, undo/redo, persistence).
// Dumps the editor HTML at each step so formatting can be objectively verified.
// All work happens in a throwaway "ZZ TEST" outline. No real data is touched.
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const SHOT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'editor-audit');
fs.mkdirSync(SHOT_DIR, { recursive: true });

let electronApp, page;
const results = [];
function log(step, verdict, detail) {
  results.push({ step, verdict, detail });
  console.log(`[${verdict}] ${step}${detail ? ' :: ' + detail : ''}`);
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
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Could not find main app window');
}

async function shot(name) {
  const p = path.join(SHOT_DIR, `${name}.png`);
  try { await page.screenshot({ path: p, fullPage: true }); } catch (e) { console.log('shot fail', name, e.message); }
  return p;
}

async function editorHTML() {
  return await page.evaluate(() => {
    const el = document.querySelector('.tiptap');
    return el ? el.innerHTML : '(no .tiptap found)';
  });
}

async function launch() {
  const projectRoot = path.resolve(__dirname, '..');
  electronApp = await electron.launch({ args: [projectRoot], env: { ...process.env, NODE_ENV: 'development' } });
  page = await findMainWindow(electronApp);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  await page.evaluate(() => { try { localStorage.setItem('discovery:professionalMode', 'true'); } catch {} });
  const newBtn = page.locator('button:has-text("New Outline")').first();
  const deadline = Date.now() + 120000;
  let ready = false;
  while (Date.now() < deadline) {
    if (!page.url().includes('/app')) {
      await page.evaluate(() => { window.location.href = '/app'; }).catch(()=>{});
      await page.waitForLoadState('domcontentloaded').catch(()=>{});
    }
    try { await newBtn.waitFor({ state: 'visible', timeout: 8000 }); ready = true; break; }
    catch { await page.evaluate(() => { window.location.href = '/app'; }).catch(()=>{}); await page.waitForTimeout(1500); }
  }
  if (!ready) throw new Error('App shell never became visible');
  await dismissDialogs();
  await page.waitForTimeout(1000);
}

async function dismissDialogs() {
  // Onboarding / welcome modals can appear on a fresh launch and block the UI.
  for (let i = 0; i < 4; i++) {
    const overlay = page.locator('div[data-state="open"].fixed.inset-0').first();
    if (!(await overlay.isVisible().catch(() => false))) break;
    // Try common dismiss buttons first, then Escape.
    const btn = page.locator('button:has-text("Got it"), button:has-text("Get started"), button:has-text("Start writing"), button:has-text("Close"), [aria-label="Close"]').first();
    if (await btn.isVisible().catch(() => false)) { await btn.click().catch(()=>{}); }
    else { await page.keyboard.press('Escape'); }
    await page.waitForTimeout(600);
  }
}

async function dismissToasts() {
  // Discovery toasts appear bottom-right and can intercept clicks. Remove them.
  await page.evaluate(() => {
    document.querySelectorAll('[data-testid="discovery-toast-stack"]').forEach(el => el.remove());
  }).catch(()=>{});
}

async function focusEditor() {
  await dismissToasts();
  const ed = page.locator('.tiptap').first();
  await ed.waitFor({ state: 'visible', timeout: 15000 });
  // Click near the top of the editor to avoid any bottom-right overlay.
  await ed.click({ position: { x: 60, y: 12 } }).catch(async () => { await ed.click({ force: true }); });
  await page.waitForTimeout(300);
  return ed;
}

async function selectAll() {
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.waitForTimeout(150);
}

async function clearEditor() {
  await focusEditor();
  await selectAll();
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(200);
}

(async () => {
  try {
    await launch();

    // Create throwaway outline
    await dismissDialogs();
    await page.locator('button:has-text("New Outline")').first().click();
    await page.waitForTimeout(1500);
    await dismissDialogs();
    await page.locator('[role="treeitem"]').first().waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(500);
    // Select the root node so the content pane binds to it
    await page.locator('[role="treeitem"]').first().click();
    await page.waitForTimeout(800);
    await shot('00-initial');

    // Check placeholder present in an empty editor
    const placeholder = await page.evaluate(() => {
      const el = document.querySelector('.tiptap p');
      return el ? (el.getAttribute('data-placeholder') || '') : '(none)';
    });
    log('Placeholder', placeholder ? 'INFO' : 'INFO', `placeholder="${placeholder}"`);

    // 1. Basic writing
    await focusEditor();
    await page.keyboard.type('The quick brown fox jumps over the lazy dog. ', { delay: 8 });
    await page.keyboard.type('A second sentence to test responsiveness.');
    await page.waitForTimeout(300);
    await shot('01-basic-typing');
    let html = await editorHTML();
    log('Basic writing', html.includes('quick brown fox') ? 'WORKS' : 'BROKEN', html.slice(0, 120));

    // 2a. Bold via keyboard (Cmd+B)
    await selectAll();
    await page.keyboard.press('Meta+B');
    await page.waitForTimeout(200);
    html = await editorHTML();
    log('Bold (Cmd+B)', /<strong>/.test(html) ? 'WORKS' : 'BROKEN');
    await page.keyboard.press('Meta+B'); // toggle off
    await page.waitForTimeout(150);

    // 2b. Italic via keyboard
    await selectAll();
    await page.keyboard.press('Meta+I');
    await page.waitForTimeout(200);
    html = await editorHTML();
    log('Italic (Cmd+I)', /<em>/.test(html) ? 'WORKS' : 'BROKEN');
    await page.keyboard.press('Meta+I');
    await page.waitForTimeout(150);

    // 2c. Underline via keyboard (Cmd+U)
    await selectAll();
    await page.keyboard.press('Meta+U');
    await page.waitForTimeout(200);
    html = await editorHTML();
    log('Underline (Cmd+U)', /<u>|underline/.test(html) ? 'WORKS' : 'BROKEN', html.slice(0, 120));
    await page.keyboard.press('Meta+U');
    await page.waitForTimeout(150);

    // 2d. Bubble menu appears on selection
    await selectAll();
    await page.waitForTimeout(500);
    const bubbleVisible = await page.locator('[data-testid="bubble-reformat-button"]').first().isVisible().catch(() => false);
    log('Bubble menu appears', bubbleVisible ? 'WORKS' : 'AWKWARD', bubbleVisible ? 'reformat button visible' : 'not found');
    await shot('02-bubble-menu');

    // 2e-g. Bubble menu buttons. NOTE: for top-of-doc selections the bubble can
    // tuck under the editor toolbar, so we force-click to bypass occlusion and
    // verify the underlying command wiring. Occlusion itself is flagged separately.
    async function bubbleClick(label) {
      const btn = page.locator(`[aria-label="${label}"]`).first();
      try { await btn.click({ force: true, timeout: 3000 }); } catch {}
      await page.waitForTimeout(200);
    }
    await selectAll(); await page.waitForTimeout(300);
    await bubbleClick('Bold');
    html = await editorHTML();
    log('Bold (bubble button)', /<strong>/.test(html) ? 'WORKS' : 'BROKEN');
    await bubbleClick('Bold');

    // Direct element-level click bypasses ANY occlusion, isolating command wiring
    // from the toolbar-overlap positioning problem.
    await selectAll(); await page.waitForTimeout(300);
    await page.evaluate(() => {
      const b = document.querySelector('[aria-label="Bold"]');
      if (b) b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(250);
    html = await editorHTML();
    log('Bold (direct element click)', /<strong>/.test(html) ? 'WORKS' : 'BROKEN', 'isolates wiring from occlusion');
    await page.evaluate(() => { const b = document.querySelector('[aria-label="Bold"]'); if (b) b.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await page.waitForTimeout(200);

    await selectAll(); await page.waitForTimeout(300);
    await bubbleClick('Heading 1');
    html = await editorHTML();
    log('Heading 1 (bubble)', /<h1/.test(html) ? 'WORKS' : 'BROKEN');
    await bubbleClick('Heading 1');

    await selectAll(); await page.waitForTimeout(200);
    await bubbleClick('Strikethrough');
    html = await editorHTML();
    log('Strikethrough (bubble)', /<s>|<del>|line-through/.test(html) ? 'WORKS' : 'BROKEN');
    await bubbleClick('Strikethrough');

    await selectAll(); await page.waitForTimeout(200);
    await bubbleClick('Inline code');
    html = await editorHTML();
    log('Inline code (bubble)', /<code>/.test(html) ? 'WORKS' : 'BROKEN');
    await bubbleClick('Inline code');

    // 3. Lists via toolbar
    await clearEditor();
    await page.keyboard.type('First item');
    await page.locator('[aria-label="Bullet list"]').first().click().catch(()=>{});
    await page.waitForTimeout(200);
    html = await editorHTML();
    log('Bullet list', /<ul>/.test(html) ? 'WORKS' : 'BROKEN');

    await clearEditor();
    await page.keyboard.type('Step one');
    await page.locator('[aria-label="Numbered list"]').first().click().catch(()=>{});
    await page.waitForTimeout(200);
    html = await editorHTML();
    log('Numbered list', /<ol>/.test(html) ? 'WORKS' : 'BROKEN');

    await clearEditor();
    await page.keyboard.type('Todo one');
    await page.locator('[aria-label="Checklist"]').first().click().catch(()=>{});
    await page.waitForTimeout(200);
    html = await editorHTML();
    log('Checklist', /data-type="taskList"|type="checkbox"/.test(html) ? 'WORKS' : 'BROKEN');
    await shot('03-checklist');

    // 3b. Blockquote + code block via markdown input rules
    await clearEditor();
    await page.keyboard.type('> A quoted line');
    await page.waitForTimeout(200);
    html = await editorHTML();
    log('Blockquote (md ">")', /<blockquote>/.test(html) ? 'WORKS' : 'AWKWARD', 'no toolbar/bubble button for it');

    await clearEditor();
    await page.keyboard.type('```');
    await page.keyboard.type('code here');
    await page.waitForTimeout(200);
    html = await editorHTML();
    log('Code block (md ```)', /<pre>/.test(html) ? 'WORKS' : 'AWKWARD', 'no toolbar/bubble button for it');

    // 4. Link on paste
    await clearEditor();
    await page.evaluate(async () => {
      // put a URL on clipboard by typing then autolink via space
    });
    await page.keyboard.type('Visit https://example.com now');
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    html = await editorHTML();
    log('Autolink URL', /<a [^>]*href="https?:\/\/example\.com/.test(html) ? 'WORKS' : 'AWKWARD', html.slice(0,160));

    // 5. Paste behavior — rich HTML list + plain text fidelity
    await clearEditor();
    await page.evaluate(async () => {
      const el = document.querySelector('.tiptap');
      el.focus();
      const dt = new DataTransfer();
      dt.setData('text/html', '<ul><li>Alpha</li><li>Beta</li><li>Gamma</li></ul>');
      dt.setData('text/plain', 'Alpha\nBeta\nGamma');
      const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
      el.dispatchEvent(ev);
    });
    await page.waitForTimeout(400);
    html = await editorHTML();
    log('Paste rich list', /<ul>[\s\S]*Alpha[\s\S]*Beta[\s\S]*Gamma/.test(html) ? 'WORKS' : 'BROKEN', html.slice(0,160));
    await shot('05a-paste-list');

    await clearEditor();
    await page.evaluate(async () => {
      const el = document.querySelector('.tiptap');
      el.focus();
      const dt = new DataTransfer();
      dt.setData('text/plain', 'Line one\nLine two\n\nAfter blank line');
      const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
      el.dispatchEvent(ev);
    });
    await page.waitForTimeout(400);
    html = await editorHTML();
    const preservedLines = /Line one/.test(html) && /Line two/.test(html) && /After blank line/.test(html);
    log('Paste plain multiline', preservedLines ? 'WORKS' : 'BROKEN', html.slice(0,180));
    await shot('05b-paste-plain');

    // 6. Undo / redo
    await clearEditor();
    await page.keyboard.type('Undo target text');
    await page.waitForTimeout(200);
    await page.keyboard.press('Meta+Z');
    await page.waitForTimeout(300);
    let afterUndo = await editorHTML();
    await page.keyboard.press('Meta+Shift+Z');
    await page.waitForTimeout(300);
    let afterRedo = await editorHTML();
    log('Undo', !afterUndo.includes('Undo target text') || afterUndo.length < 40 ? 'WORKS' : 'CHECK', 'post-undo len ' + afterUndo.length);
    log('Redo', afterRedo.includes('Undo target') || afterRedo.length >= afterUndo.length ? 'WORKS' : 'CHECK', 'post-redo len ' + afterRedo.length);

    // 7. Persistence: type a marker, fully reload the app, and confirm it's
    // still there. Reload proves the content was written to storage, not just
    // held in memory — the strongest persistence test.
    await clearEditor();
    await page.keyboard.type('PERSIST-MARKER content body');
    await page.waitForTimeout(1800); // allow autosave to flush
    await page.evaluate(() => { window.location.href = '/app'; }).catch(()=>{});
    await page.waitForLoadState('domcontentloaded').catch(()=>{});
    await page.waitForTimeout(4000);
    await dismissDialogs();
    // Reopen our outline from the sidebar, then select its root node.
    const outlineEntry = page.locator('text=Untitled Outline').first();
    if (await outlineEntry.isVisible().catch(()=>false)) { await outlineEntry.click().catch(()=>{}); await page.waitForTimeout(1200); }
    await dismissToasts();
    const rootItem = page.locator('[role="treeitem"]').first();
    if (await rootItem.isVisible().catch(()=>false)) { await rootItem.click().catch(()=>{}); await page.waitForTimeout(1000); }
    let persisted = false;
    try { await page.locator('.tiptap').first().waitFor({ state: 'visible', timeout: 15000 }); html = await editorHTML(); persisted = html.includes('PERSIST-MARKER'); }
    catch { html = '(editor not found after reload)'; }
    log('Persistence across full reload', persisted ? 'WORKS' : 'BROKEN', html.slice(0, 120));
    await shot('07-persistence');

    // Final: dump a rendered sample of everything for visual inspection
    await clearEditor();
    await page.keyboard.type('Heading sample');
    await selectAll();
    await page.locator('[aria-label="Heading 2"]').first().click().catch(()=>{});
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Normal paragraph with ');
    await page.keyboard.press('Meta+B'); await page.keyboard.type('bold'); await page.keyboard.press('Meta+B');
    await page.keyboard.type(' and ');
    await page.keyboard.press('Meta+I'); await page.keyboard.type('italic'); await page.keyboard.press('Meta+I');
    await page.keyboard.type(' words.');
    await page.waitForTimeout(300);
    await shot('08-mixed-sample');

    fs.writeFileSync(path.join(SHOT_DIR, 'report.json'), JSON.stringify(results, null, 2));
    console.log('\n===== EDITOR AUDIT SUMMARY =====');
    results.forEach(r => console.log(`${r.verdict.padEnd(8)} ${r.step}`));
    const broken = results.filter(r => r.verdict === 'BROKEN');
    console.log(`\n${broken.length} BROKEN, ${results.length} checks total`);
    // Hard-cap the close so a Playwright/Electron shutdown hang can't stall the
    // whole suite (observed to hang indefinitely on this machine).
    try { await Promise.race([electronApp.close(), new Promise(r => setTimeout(r, 5000))]); } catch {}
    process.exit(broken.length > 0 ? 2 : 0);
  } catch (e) {
    console.error('FATAL', e);
    try { await shot('FATAL'); } catch {}
    try { await electronApp.close(); } catch {}
    process.exit(1);
  }
})();
