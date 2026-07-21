// tests/free-voice-wizards-test.js
//
// FREE-VOICE WIZARD CERTIFICATION — proves the Podcast and Generate Video
// wizards run to a FINISHED rendered media file entirely on the FREE Apple/Mac
// system voice (`say`) with ZERO paid AI:
//   - Podcast script  : local Gemma (Ollama) — company Gemini key is disabled.
//   - Podcast audio   : free macOS `say` — no OpenAI key anywhere.
//   - Video narration : free macOS `say` — no OpenAI key anywhere.
//
// COST SAFETY: Electron is launched with OPENAI_API_KEY='' and GEMINI_API_KEY=''
// so the TTS fallbacks physically cannot reach a paid endpoint, and the Next
// dev server has both keys commented out in .env.local for the duration.
//
// DATA SAFETY: all work happens in the throwaway outline "ZZ TEST safe to delete".
//
// Screenshots + report -> test-screenshots/free-voice-wizards/

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const OUT_DIR = path.resolve(__dirname, '..', 'test-screenshots', 'free-voice-wizards');
fs.mkdirSync(OUT_DIR, { recursive: true });
const SCRATCH = path.join(os.tmpdir(), 'free-voice-wizards');
fs.mkdirSync(SCRATCH, { recursive: true });
const VIDEO_DIR = path.join(os.homedir(), 'Documents', 'IdeaM Videos');

const ZZ = 'ZZ TEST safe to delete';
let electronApp, page;
const results = {};

function record(name, r) { results[name] = r; console.log(`${r.pass ? 'PASS' : 'FAIL'} — ${name} :: ${r.note || ''}`); }

async function findMainWindow(app, maxWait = 40000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    for (const win of app.windows()) {
      try { const url = win.url(); if (url.startsWith('devtools://')) continue; if (url.includes('localhost:9002')) return win; } catch {}
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Could not find main app window');
}
async function shot(name) { try { await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: false }); } catch (e) { console.log('shot fail', name, e.message); } }
async function refocus() { try { execFileSync('osascript', ['-e', 'tell application "Terminal" to activate']); } catch {} }
async function run(name, fn) { console.log(`\n=== ${name} ===`); try { record(name, await fn()); } catch (e) { record(name, { pass: false, note: 'threw: ' + e.message }); await shot(`ERR-${name}`); } await refocus(); }

async function clickNode(text) { const n = page.locator(`[role="treeitem"] span:has-text("${text}")`).first(); await n.click(); await page.waitForTimeout(300); return n; }
async function buildList(names) {
  for (const nm of names) {
    await page.keyboard.press('Enter');
    const input = page.locator('input[type="text"]:visible').first();
    try { await input.waitFor({ state: 'visible', timeout: 4000 }); } catch {}
    await page.waitForTimeout(200); await input.fill(nm); await page.waitForTimeout(150);
    await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  }
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
}
async function closeAnyDialog() { await page.keyboard.press('Escape').catch(()=>{}); await page.waitForTimeout(400); await page.keyboard.press('Escape').catch(()=>{}); await page.waitForTimeout(300); }
// Open the "Turn Into" (output) menu. It's inline when the pane is wide enough,
// otherwise it folds into the "⋯ More tools" overflow as a submenu.
async function openTurnInto() {
  const direct = page.locator('[aria-label="Turn Into"]').first();
  if (await direct.isVisible({ timeout: 2000 }).catch(()=>false)) {
    await direct.click(); await page.waitForTimeout(500); return;
  }
  const more = page.locator('[aria-label="More tools"]').first();
  await more.click(); await page.waitForTimeout(400);
  const sub = page.locator('[role="menuitem"]:has-text("Turn Into"), [role="menuitemcheckbox"]:has-text("Turn Into")').first();
  await sub.hover().catch(()=>{}); await sub.click().catch(()=>{}); await page.waitForTimeout(600);
}
async function dialogText() { return await page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); return d ? (d.textContent || '').replace(/\s+/g, ' ') : ''; }); }
async function setSavePath(p) { await electronApp.evaluate(({ ipcMain }, savePath) => { try { ipcMain.removeHandler('save-file-dialog'); } catch {} ipcMain.handle('save-file-dialog', async () => savePath); }, p); }

async function launch() {
  const projectRoot = path.resolve(__dirname, '..');
  electronApp = await electron.launch({
    args: [projectRoot],
    // Belt-and-suspenders: no paid keys reach the Electron main process, so the
    // podcast/video TTS fallback can ONLY use the free macOS `say` voice.
    env: { ...process.env, NODE_ENV: 'development', OPENAI_API_KEY: '', GEMINI_API_KEY: '' },
  });
  page = await findMainWindow(electronApp);
  page.on('dialog', async (d) => { try { await d.dismiss(); } catch {} });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  await page.setViewportSize({ width: 1440, height: 980 });
  if (!page.url().includes('/app')) { await page.evaluate(() => { window.location.href = '/app'; }).catch(()=>{}); await page.waitForLoadState('domcontentloaded').catch(()=>{}); }
  // Seed permissive dev state + FORCE the free voice: Pro tier (no gates),
  // consent granted, professional mode, and NO BYOK keys of any kind.
  await page.evaluate(() => {
    try {
      localStorage.setItem('discovery:professionalMode', 'true');
      localStorage.setItem('aiDataConsent', 'granted');
      localStorage.setItem('idiampro-tier-id', 'pro');
      localStorage.setItem('onboarding:welcomeShowcaseSeen', 'true');
      localStorage.removeItem('apiKey_openai');
      localStorage.removeItem('apiKey_gemini');
      localStorage.removeItem('apiKey_openrouter');
    } catch {}
  });
  const newBtn = page.locator('button:has-text("New Outline")').first();
  const deadline = Date.now() + 150000; let ready = false;
  while (Date.now() < deadline) {
    if (await newBtn.isVisible({ timeout: 1000 }).catch(()=>false)) { ready = true; break; }
    if (!page.url().includes('/app')) { await page.evaluate(() => { window.location.href = '/app'; }).catch(()=>{}); await page.waitForLoadState('domcontentloaded').catch(()=>{}); }
    await page.waitForTimeout(2000);
  }
  if (!ready) throw new Error('App shell (New Outline) never became visible');
  await page.waitForTimeout(1000);
}

async function ensureZZ() {
  const zzItem = page.locator(`text=${ZZ}`).first();
  if (await zzItem.isVisible({ timeout: 3000 }).catch(()=>false)) { await zzItem.click(); await page.waitForTimeout(1500); return true; }
  await page.locator('button:has-text("New Outline")').first().click(); await page.waitForTimeout(1500);
  const root = page.locator('[role="treeitem"] span:has-text("Untitled Outline")').first();
  if (await root.count() > 0) {
    await root.dblclick(); await page.waitForTimeout(500);
    const input = page.locator('input[type="text"]:visible').first();
    if (await input.isVisible().catch(()=>false)) { await input.fill(ZZ); await page.keyboard.press('Enter'); await page.waitForTimeout(700); }
  }
  return true;
}

async function ensureBranch() {
  // Small, coherent topic so the Gemma script + slides have real substance.
  const haveParent = await page.locator('[role="treeitem"] span:has-text("Morning Routines")').count();
  if (haveParent > 0) { return; }
  const first = page.locator('[role="treeitem"]').first(); await first.click(); await page.waitForTimeout(300);
  await buildList(['Morning Routines', 'Wake Early', 'Hydrate First']);
  await clickNode('Wake Early'); await page.keyboard.press('Tab'); await page.waitForTimeout(400);
  await clickNode('Hydrate First'); await page.keyboard.press('Tab'); await page.waitForTimeout(400);
  await clickNode('Wake Early'); await page.waitForTimeout(400);
  const editor = page.locator('.ProseMirror').first();
  if (await editor.isVisible({ timeout: 5000 }).catch(()=>false)) {
    await editor.click();
    await page.keyboard.type('Waking up an hour earlier gives you quiet, uninterrupted time to think and plan before the day gets busy. Consistency matters more than the exact hour.');
    await page.waitForTimeout(500);
  }
  await clickNode('Hydrate First'); await page.waitForTimeout(400);
  const editor2 = page.locator('.ProseMirror').first();
  if (await editor2.isVisible({ timeout: 5000 }).catch(()=>false)) {
    await editor2.click();
    await page.keyboard.type('Drinking a full glass of water right after waking rehydrates the body after sleep and helps you feel alert before coffee.');
    await page.waitForTimeout(500);
  }
  await page.keyboard.press('Escape').catch(()=>{});
}

function inspectMp3(p) {
  if (!fs.existsSync(p)) return { ok: false, size: 0 };
  const size = fs.statSync(p).size;
  const buf = fs.readFileSync(p, { start: 0, end: 3 });
  const isId3 = buf.slice(0, 3).toString('ascii') === 'ID3';
  const isFrame = buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0;
  return { ok: size > 2000 && (isId3 || isFrame), size, header: isId3 ? 'ID3' : (isFrame ? 'MPEG-frame' : buf.toString('hex')) };
}
function ffprobeDuration(p) {
  try {
    const ffprobe = require(path.resolve(__dirname, '..', 'node_modules', 'ffprobe-static')).path;
    const out = execFileSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', p], { encoding: 'utf8' });
    const d = parseFloat(String(out).trim()); return Number.isFinite(d) ? d : 0;
  } catch (e) { return -1; }
}

async function podcastWizard() {
  await run('podcast-open', async () => {
    await clickNode('Morning Routines');
    await openTurnInto();
    await page.locator('[role="menuitem"]:has-text("Export Current Outline")').first().click();
    await page.waitForTimeout(1000);
    const tile = page.locator(`button:has(span:text-is("Podcast"))`).first();
    await tile.scrollIntoViewIfNeeded().catch(()=>{});
    await tile.click(); await page.waitForTimeout(1200);
    const opened = await page.locator('text=Generate Podcast').first().isVisible().catch(()=>false);
    const txt = await dialogText();
    const freeHint = /built-in voices? \(free/i.test(txt) || /Mac.{0,3}s built-in voices/i.test(txt);
    await shot('10-podcast-config');
    return { pass: opened && freeHint, note: `opened=${opened} freeVoiceHint=${freeHint}` };
  });

  await run('podcast-generate-script', async () => {
    // Quick path: click the primary "Generate" (not "Edit Prompt"/"Cancel").
    const gen = page.locator('[role="dialog"] button', { hasText: /^Generate$/ }).first();
    await gen.click();
    // Wait for the edit-script phase (Gemma local generation).
    const deadline = Date.now() + 180000; let ok = false, note = 'timeout';
    while (Date.now() < deadline) {
      const audioBtn = await page.locator('[role="dialog"] button:has-text("Generate Audio")').count().catch(()=>0);
      const errTxt = await page.locator('[role="dialog"] .text-destructive').first().textContent().catch(()=>null);
      if (audioBtn > 0) { ok = true; note = 'edit-script reached'; break; }
      if (errTxt && errTxt.trim()) { note = 'script error: ' + errTxt.trim().slice(0, 120); break; }
      await page.waitForTimeout(1500);
    }
    await shot('11-podcast-script');
    const segCount = await page.locator('[role="dialog"] textarea').count().catch(()=>0);
    return { pass: ok, note: `${note}; segmentBoxes=${segCount}` };
  });

  await run('podcast-generate-audio-free-say', async () => {
    const audioBtn = page.locator('[role="dialog"] button:has-text("Generate Audio")').first();
    if (!(await audioBtn.isVisible().catch(()=>false))) return { pass: false, note: 'no Generate Audio button (script step failed)' };
    await audioBtn.click();
    const deadline = Date.now() + 180000; let ok = false, note = 'timeout';
    while (Date.now() < deadline) {
      const hasAudio = await page.locator('[role="dialog"] audio').count().catch(()=>0);
      const errTxt = await page.locator('[role="dialog"] .text-destructive').first().textContent().catch(()=>null);
      if (hasAudio > 0) { ok = true; note = 'preview/audio element present'; break; }
      if (errTxt && errTxt.trim()) { note = 'audio error: ' + errTxt.trim().slice(0, 140); break; }
      await page.waitForTimeout(1500);
    }
    await shot('12-podcast-preview');
    const dur = await page.evaluate(() => { const a = document.querySelector('[role="dialog"] audio'); return a ? (a.duration || 0) : -1; }).catch(()=>-1);
    return { pass: ok, note: `${note}; audioDurationSec=${dur}` };
  });

  await run('podcast-save-real-file', async () => {
    const outPath = path.join(SCRATCH, `zz-podcast-${Date.now()}.mp3`);
    try { fs.unlinkSync(outPath); } catch {}
    await setSavePath(outPath);
    const saveBtn = page.locator('[role="dialog"] button:has-text("Save Audio File")').first();
    if (!(await saveBtn.isVisible().catch(()=>false))) return { pass: false, note: 'no Save button (no preview)' };
    await saveBtn.click();
    const deadline = Date.now() + 15000; let info = { ok: false, size: 0 };
    while (Date.now() < deadline) { info = inspectMp3(outPath); if (info.ok) break; await page.waitForTimeout(400); }
    const dur = info.ok ? ffprobeDuration(outPath) : -1;
    await closeAnyDialog();
    return { pass: info.ok && dur > 0.5, note: `mp3 size=${info.size} header=${info.header} durationSec=${dur}` };
  });
}

async function videoWizard() {
  await run('video-open', async () => {
    await clickNode('Morning Routines');
    await openTurnInto();
    const item = page.locator('[role="menuitem"]:has-text("Generate Video")').first();
    const vis = await item.isVisible({ timeout: 4000 }).catch(()=>false);
    if (!vis) { await shot('20-video-menu-missing'); return { pass: false, note: 'Generate Video menu item not visible' }; }
    await item.click(); await page.waitForTimeout(1200);
    const txt = await dialogText();
    const opened = /Generate Video/i.test(txt);
    const freeHint = /built-in voice \(free/i.test(txt) || /Mac.{0,3}s built-in voice/i.test(txt);
    await shot('21-video-config');
    return { pass: opened && freeHint, note: `opened=${opened} freeVoiceHint=${freeHint}` };
  });

  await run('video-configure-light', async () => {
    // Fastest render: Detail = Overview, and uncheck all visuals (text-only).
    await page.locator('[role="dialog"] button:has-text("Overview")').first().click().catch(()=>{});
    await page.waitForTimeout(300);
    for (const id of ['vis-mindmap', 'vis-photo', 'vis-videoclip']) {
      const cb = page.locator(`#${id}`);
      if (await cb.count().catch(()=>0)) {
        const checked = await cb.isChecked().catch(()=>false);
        if (checked) { await cb.click().catch(()=>{}); await page.waitForTimeout(150); }
      }
    }
    await shot('22-video-configured');
    return { pass: true, note: 'Overview depth + visuals off' };
  });

  await run('video-render-free-say', async () => {
    const before = Date.now();
    const existingBefore = fs.existsSync(VIDEO_DIR) ? new Set(fs.readdirSync(VIDEO_DIR)) : new Set();
    const gen = page.locator('[role="dialog"] button:has-text("Generate")').last();
    await gen.click();
    const deadline = Date.now() + 300000; let done = false, note = 'timeout';
    while (Date.now() < deadline) {
      const readyTxt = await page.locator('[role="dialog"]:has-text("Your video is ready")').count().catch(()=>0);
      const errBox = await page.locator('[role="dialog"] .text-destructive').first().textContent().catch(()=>null);
      if (readyTxt > 0) { done = true; note = 'done screen shown'; break; }
      if (errBox && errBox.trim()) { note = 'render error: ' + errBox.trim().slice(0, 160); break; }
      await page.waitForTimeout(2000);
    }
    await shot('23-video-done');
    // Find the freshly written mp4.
    let newest = null, newestMtime = before - 1;
    if (fs.existsSync(VIDEO_DIR)) {
      for (const f of fs.readdirSync(VIDEO_DIR)) {
        if (!f.endsWith('.mp4')) continue;
        const fp = path.join(VIDEO_DIR, f);
        const m = fs.statSync(fp).mtimeMs;
        if (m >= before && m > newestMtime) { newestMtime = m; newest = fp; }
      }
    }
    let size = 0, dur = -1;
    if (newest) { size = fs.statSync(newest).size; dur = ffprobeDuration(newest); }
    await closeAnyDialog();
    return { pass: done && !!newest && size > 10000 && dur > 0.5, note: `${note}; mp4=${newest ? path.basename(newest) : 'none'} size=${size} durationSec=${dur}` };
  });
}

async function main() {
  await launch();
  await shot('00-launched');
  await run('setup-zz', async () => { const ok = await ensureZZ(); await shot('01-zz'); return { pass: ok, note: 'ZZ selected/created' }; });
  await run('setup-branch', async () => { await ensureBranch(); await shot('02-branch'); return { pass: (await page.locator('[role="treeitem"]').count()) > 0, note: 'topic seeded' }; });

  await podcastWizard();
  await videoWizard();

  const passCount = Object.values(results).filter(r => r.pass).length;
  const total = Object.keys(results).length;
  const report = { when: new Date().toISOString(), passCount, total, results };
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  const md = [`# Free-Voice Wizard Certification`, ``, `${passCount}/${total} passed`, ``, ...Object.entries(results).map(([k, v]) => `- ${v.pass ? 'PASS' : 'FAIL'} — **${k}** — ${v.note || ''}`)].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), md);
  console.log(`\n==== ${passCount}/${total} passed ====`);

  try { await electronApp.close(); } catch {}
  await refocus();
  process.exit(passCount === total ? 0 : 1);
}

main().catch(async (e) => { console.error('FATAL', e); try { await shot('FATAL'); } catch {} try { await electronApp.close(); } catch {} process.exit(2); });
