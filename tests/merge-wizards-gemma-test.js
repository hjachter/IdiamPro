// MERGE (Bring In → Research & Import) + WIZARDS certification, forced onto the
// FREE/LOCAL Gemma (Ollama) path. NO paid/cloud AI is ever triggered:
//  - app-level aiProvider is forced to 'local'
//  - the Research & Import "Use Local AI (Ollama)" box is explicitly checked
//  - the Automatic Book wizard reads aiProvider==='local' and runs on Ollama
//  - the engine wizards (Website/Podcast/YouTube) are only OPENED, never run to
//    a paid generation.
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { prepareApp, setElectronWindowSize } = require('./_helpers');

const SHOT = path.resolve(__dirname, '..', 'test-screenshots', 'merge-wizards-gemma');
fs.mkdirSync(SHOT, { recursive: true });
process.on('unhandledRejection', (err) => {
  const m = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(m)) return;
});

const out = { steps: [], merge: {}, wizards: {}, pass: true };
let app, page;

async function findMain(a, maxWait = 30000) {
  const s = Date.now();
  while (Date.now() - s < maxWait) {
    for (const w of a.windows()) {
      try { const u = w.url(); if (!u.startsWith('devtools://') && u.includes('localhost:9002')) return w; } catch {}
    }
    await new Promise(r => setTimeout(r, 800));
  }
  throw new Error('no window');
}
async function shot(n) { await page.screenshot({ path: path.join(SHOT, n) }).catch(() => {}); }
async function menuTexts() {
  return await page.evaluate(() => [...document.querySelectorAll('[role="menuitem"]')].map(e => (e.innerText || '').trim().replace(/\s+/g, ' ')).filter(Boolean));
}
async function closeMenus() {
  for (let i = 0; i < 5; i++) {
    const n = await page.locator('[role="menu"]:visible').count().catch(() => 0);
    if (n === 0) break;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(200);
  }
}
async function closeDialogs() {
  for (let i = 0; i < 6; i++) {
    const n = await page.locator('[role="dialog"]').count().catch(() => 0);
    if (n === 0) break;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
  }
}
// Read the current outline tree as indented text so we can eyeball merge quality.
async function dumpOutline() {
  return await page.evaluate(() => {
    const items = [...document.querySelectorAll('[data-testid="outline-pane"] [role="treeitem"]')];
    return items.map(li => {
      const lvl = parseInt(li.getAttribute('aria-level') || '1', 10);
      const t = (li.querySelector('span, [contenteditable]') || li).innerText || '';
      return '  '.repeat(Math.max(0, lvl - 1)) + t.trim().split('\n')[0];
    }).filter(Boolean).slice(0, 80);
  }).catch(() => []);
}

(async () => {
  const root = path.resolve(__dirname, '..');
  app = await electron.launch({ args: [root], env: { ...process.env, NODE_ENV: 'development' } });
  page = await findMain(app);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2500);
  if (!page.url().includes('/app')) {
    await page.evaluate(() => { window.location.href = '/app'; });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  }
  await prepareApp(page);
  await setElectronWindowSize(app, 1700, 1050);
  await page.waitForTimeout(600);
  // COST SAFETY: force local Gemma everywhere; also suppress discovery toasts.
  await page.evaluate(() => {
    try { localStorage.setItem('aiProvider', 'local'); } catch {}
    try { localStorage.setItem('discovery:professionalMode', 'true'); } catch {}
    try { localStorage.setItem('ai-consent-accepted', 'true'); } catch {}
  });

  // Fresh outline to merge into.
  await page.locator('button:has-text("New Outline")').first().click().catch(() => {});
  await page.waitForTimeout(1200);
  await closeMenus();

  /* ───────────── MERGE via Bring In → Research & Import ───────────── */
  try {
    await page.locator('[aria-label="Bring In"]').first().click({ timeout: 6000 });
    await page.waitForTimeout(600);
    out.merge.menu = await menuTexts();
    const research = page.locator('[role="menuitem"]:has-text("Research & Import")').first();
    await research.click({ timeout: 4000 });
    await page.waitForTimeout(1500);
    await shot('merge-01-dialog.png');

    // Pick a text source. The "Add a source" combobox shows placeholder
    // "Choose source type..." — target it specifically (there is also an
    // "AI Reasoning Depth" combobox above it, so a bare .first() grabs the
    // wrong one). Choose "Type or Paste Text".
    const srcSel = page.locator('[role="dialog"] [role="combobox"]:has-text("Choose source type")').first();
    if (await srcSel.isVisible({ timeout: 3000 }).catch(() => false)) {
      await srcSel.click().catch(() => {});
      await page.waitForTimeout(400);
      await page.locator('[role="option"]:has-text("Type or Paste Text"), [role="option"]:has-text("Text")').first().click().catch(() => {});
    }
    await page.waitForTimeout(800);

    const REP = `Morning routines for focus. Wake at 6am. Ten minutes of stretching. Cold shower. Then write the top three priorities for the day before touching email.
Nutrition basics. Protein at breakfast. Cut sugary drinks. Drink water first thing. Meal-prep on Sundays to avoid decision fatigue.
Deep work blocks. Silence notifications. Work in 90-minute sprints with short breaks. Track what actually got done, not hours logged.`;
    const ta = page.locator('[role="dialog"] textarea[placeholder*="Paste or type"], [role="dialog"] textarea').first();
    await ta.waitFor({ state: 'visible', timeout: 5000 });
    await ta.click();
    await ta.fill(REP);
    out.merge.inputChars = REP.length;
    await page.waitForTimeout(400);

    // COST SAFETY: explicitly check "Use Local AI (Ollama)".
    const localBox = page.locator('#use-local-ai').first();
    if (await localBox.isVisible({ timeout: 2000 }).catch(() => false)) {
      const checked = await localBox.getAttribute('data-state').catch(() => null);
      if (checked !== 'checked') await localBox.click().catch(() => {});
      out.merge.localAIChecked = true;
    } else {
      out.merge.localAIChecked = false;
    }
    await shot('merge-02-ready.png');

    // Synthesize.
    const synth = page.locator('[role="dialog"] button:has-text("Synthesize")').first();
    await synth.waitFor({ state: 'visible', timeout: 4000 });
    const beforeTree = await dumpOutline();
    await synth.click();
    out.steps.push('Clicked Synthesize (local Gemma)');

    // Wait for the merge to land: the dialog closes and the outline grows.
    const deadline = Date.now() + 240000;
    let merged = false;
    while (Date.now() < deadline) {
      const dlgs = await page.locator('[role="dialog"]').count().catch(() => 0);
      const tree = await dumpOutline();
      if (dlgs === 0 && tree.length > beforeTree.length) { merged = true; break; }
      await page.waitForTimeout(2500);
    }
    await page.waitForTimeout(1500);
    await closeDialogs();
    const finalTree = await dumpOutline();
    out.merge.beforeCount = beforeTree.length;
    out.merge.afterCount = finalTree.length;
    out.merge.tree = finalTree;
    out.merge.completed = merged;
    await shot('merge-03-result.png');
    out.steps.push(`Merge ${merged ? 'completed' : 'did NOT visibly land'} — nodes ${beforeTree.length} -> ${finalTree.length}`);
  } catch (e) {
    out.merge.error = String(e).split('\n')[0];
    out.pass = false;
    await shot('merge-ERROR.png');
    await closeDialogs();
  }

  // Helper: open the Wizards gallery (AI menu → Wizards). Waits out any AI
  // loading first, since the AI menu button is disabled while a generation runs.
  async function openWizards() {
    await closeMenus(); await closeDialogs();
    const aiBtn = page.locator('[aria-label="AI menu"]').first();
    for (let i = 0; i < 40; i++) {
      const disabled = await aiBtn.isDisabled().catch(() => true);
      if (!disabled) break;
      await page.waitForTimeout(500);
    }
    await aiBtn.click({ timeout: 6000 });
    await page.waitForTimeout(400);
    await page.locator('[role="menuitem"]:has-text("Wizards")').first().click({ timeout: 4000 });
    await page.waitForTimeout(900);
  }

  /* ───── WIZARDS: Website / Podcast / YouTube — verify they LAUNCH only ─────
     (run BEFORE the Automatic Book wizard, which leaves the AI busy and would
      disable the AI-menu button that opens the gallery). No paid generation is
      triggered — we only confirm each engine dialog opens. */
  for (const [name, key] of [['Website Building', 'website'], ['Podcast', 'podcast'], ['YouTube Video', 'youtube']]) {
    try {
      await openWizards();
      await page.locator(`[role="dialog"] button:has-text("${name}")`).first().click({ timeout: 5000 });
      await page.waitForTimeout(1800);
      const title = await page.evaluate(() => {
        const dlgs = [...document.querySelectorAll('[role="dialog"]')];
        const d = dlgs[dlgs.length - 1];
        return d ? (d.innerText || '').split('\n').slice(0, 3).join(' | ') : '';
      });
      out.wizards[key] = { launched: !!title, header: title.slice(0, 120) };
      await shot(`wiz-engine-${key}.png`);
      out.steps.push(`${name}: engine dialog ${title ? 'opened' : 'did NOT open'}`);
      await closeDialogs();
    } catch (e) {
      out.wizards[key] = { launched: false, error: String(e).split('\n')[0] };
      await closeDialogs();
    }
  }

  /* ───────────── WIZARD: Automatic Book (pure AI, on Gemma) — LAST ───────── */
  try {
    await openWizards();
    await shot('wiz-01-gallery.png');
    out.wizards.gallery = await page.evaluate(() =>
      [...document.querySelectorAll('[role="dialog"] button')].map(b => (b.innerText || '').trim().split('\n')[0]).filter(Boolean).slice(0, 20));

    await page.locator('[role="dialog"] button:has-text("Automatic Book")').first().click({ timeout: 4000 });
    await page.waitForTimeout(800);
    const topic = page.locator('#app-topic').first();
    await topic.waitFor({ state: 'visible', timeout: 4000 });
    await topic.fill('A short beginner guide to composting at home');
    await shot('wiz-02-book-config.png');
    await page.locator('[role="dialog"] button:has-text("Run")').first().click({ timeout: 4000 });
    out.steps.push('Automatic Book: clicked Run (local Gemma)');

    // The wizard closes and a new outline (named the topic) becomes current and
    // fills in live. Wait for a multi-node structure to exist.
    const dl = Date.now() + 300000;
    let built = false;
    while (Date.now() < dl) {
      const tree = await dumpOutline();
      if (tree.length >= 4) { built = true; break; }
      await page.waitForTimeout(3000);
    }
    await page.waitForTimeout(3000); // let a couple sections fill
    const bookTree = await dumpOutline();
    out.wizards.automaticBook = { built, nodeCount: bookTree.length, tree: bookTree.slice(0, 40) };
    await shot('wiz-03-book-result.png');
    out.steps.push(`Automatic Book ${built ? 'produced a structure' : 'did NOT build'} — ${bookTree.length} nodes`);
  } catch (e) {
    out.wizards.automaticBookError = String(e).split('\n')[0];
    await shot('wiz-book-ERROR.png');
    await closeDialogs();
  }

  fs.writeFileSync(path.join(SHOT, 'report.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await app.close().catch(() => {});
  process.exit(0);
})().catch(async (e) => {
  out.fatal = String(e).split('\n')[0];
  try { fs.writeFileSync(path.join(SHOT, 'report.json'), JSON.stringify(out, null, 2)); } catch {}
  console.log('FATAL', out.fatal);
  try { await app.close(); } catch {}
  process.exit(1);
});
