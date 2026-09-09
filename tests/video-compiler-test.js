// ============================================================================
// Video COMPILER test (content-compiler Phase 3A) — free path, $0, own Electron
// ----------------------------------------------------------------------------
// Proves the Phase-3A loop on the video adapter, spending nothing:
//
//   1. FIRST GENERATION: a 3-branch outline renders into a 4-scene video
//      (cover + one scene per branch, Detail = Overview, visuals OFF for
//      deterministic, network-free slides); a manifest is recorded with
//      per-scene source node ids + content fingerprints + scene-clip cache
//      references; the final MP4 is a valid video+audio file.
//   2. SELECTIVE REGENERATION: rename ONE branch → the dialog offers
//      "Update Changed" ("2 of 4 scenes have changed" — the renamed branch's
//      scene AND the cover, whose on-screen agenda lists the branch name),
//      the P2 heavy-op confirm shows the honest SCOPED note, and at render
//      time the 2 unchanged scenes' clips are REUSED from the cache (proved
//      by clip-file birthtimes AND the generator's reuse accounting) while
//      only the changed scenes re-render. The final MP4 is valid.
//   3. START FRESH: rebuilds everything (reused = 0), honestly, with the P2
//      confirm appearing first (no scoped note on a full rebuild).
//   4. ENGINE-AWARENESS: a cached free `say` scene clip is NOT reachable
//      under an OpenAI-engine cache key for the same scene material.
//
// MONEY SAFETY: OpenAI key forced absent in launch env AND scrubbed in the
// main process; a fetch spy in the main process must record ZERO calls to
// openai.com across the entire test. Visuals are all OFF, so no Openverse/
// Wikimedia fetches either. Narration uses the FREE macOS `say` voice.
// ============================================================================

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const projectRoot = path.resolve(__dirname, '..');
const OUT_DIR = path.join(projectRoot, 'test-screenshots', 'video-compiler');
fs.mkdirSync(OUT_DIR, { recursive: true });

let electronApp, page;
const report = { suite: 'video-compiler', startedAt: new Date().toISOString(), steps: [], pass: false };

function step(s) { report.steps.push(s); console.log('  • ' + s); }
async function shot(name) { try { await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: false }); } catch (e) { console.log('shot fail', name, e.message); } }
async function refocus() { try { execFileSync('osascript', ['-e', 'tell application "Terminal" to activate']); } catch {} }

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

function writeReport() {
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  const md = [
    `# Video Compiler Test (Phase 3A) — ${report.pass ? 'PASS' : 'FAIL'}`,
    '',
    'Selective scene regeneration on the free `say` path: manifest + per-scene',
    'traceability + scene-clip cache reuse, with $0 spent and zero OpenAI calls.',
    '',
    '## Steps',
    ...report.steps.map((s) => `- ${s}`),
    '',
    report.error ? `## Error\n\n\`\`\`\n${report.error}\n\`\`\`\n` : '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), md);
}

// ffprobe (from the project's own ffprobe-static) to validate finished MP4s.
function probeMp4(filePath) {
  const ffprobePath = require(path.join(projectRoot, 'node_modules', 'ffprobe-static')).path;
  const out = execFileSync(ffprobePath, [
    '-v', 'error', '-show_entries', 'format=duration:stream=codec_type',
    '-of', 'json', filePath,
  ], { encoding: 'utf8', maxBuffer: 1 << 20 });
  const data = JSON.parse(out);
  const streams = Array.isArray(data.streams) ? data.streams : [];
  return {
    duration: parseFloat((data.format && data.format.duration) || '0') || 0,
    hasVideo: streams.some((s) => s.codec_type === 'video'),
    hasAudio: streams.some((s) => s.codec_type === 'audio'),
  };
}

async function main() {
  let savedLocal = null; // localStorage keys we override, restored at the end

  try {
    if (process.platform !== 'darwin') {
      step('Skipped: free `say` narration path is macOS-only.');
      report.skipped = true; report.pass = true; writeReport();
      console.log('SKIP (non-darwin)'); process.exit(0);
    }

    console.log('Launching Electron (own instance)...');
    electronApp = await electron.launch({
      args: [projectRoot],
      env: { ...process.env, NODE_ENV: 'development', OPENAI_API_KEY: '' },
    });

    // Scrub the OpenAI key in the MAIN process and install a persistent fetch
    // spy counting any attempt to reach openai.com for the whole test.
    await electronApp.evaluate(() => {
      delete process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = '';
      if (!global.__openaiSpyInstalled) {
        const realFetch = global.fetch;
        global.__openaiCallCount = 0;
        global.fetch = (url, opts) => {
          try { if (String(url).toLowerCase().includes('openai.com')) global.__openaiCallCount++; } catch {}
          return realFetch(url, opts);
        };
        global.__openaiSpyInstalled = true;
      }
    });
    step('OpenAI key scrubbed in main + fetch spy installed ($0 guaranteed).');

    // Force the video-generator module to load (installs the read-only
    // global.__videoSceneCache hook), then start from an EMPTY scene cache so
    // the reuse accounting is deterministic even on repeat runs.
    {
      const ok = await electronApp.evaluate(async () => {
        try { await global.__generateSlideshowVideo({}); } catch {}
        return !!global.__videoSceneCache;
      });
      if (!ok) throw new Error('global.__videoSceneCache hook did not install');
      const pre = await electronApp.evaluate(() => global.__videoSceneCache.snapshot());
      if (pre.dir) {
        for (const f of Object.keys(pre.files)) {
          try { fs.unlinkSync(path.join(pre.dir, f)); } catch {}
        }
        step(`Scene cache cleared (${Object.keys(pre.files).length} leftover clip(s) removed).`);
      }
    }

    page = await findMainWindow(electronApp);
    page.on('dialog', async (d) => { try { await d.dismiss(); } catch {} });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    await page.setViewportSize({ width: 1440, height: 980 });

    if (!page.url().includes('/app')) {
      await page.evaluate(() => { window.location.href = '/app'; }).catch(() => {});
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }
    // Save + override localStorage: NO BYOK keys (money safety), pro tier so
    // the free-video gate/watermark stays out of the way, Professional mode
    // OFF so the P2 heavy-op confirm actually appears (this test asserts it),
    // visuals ALL OFF (deterministic, network-free slides), Detail = Overview
    // (4 scenes: cover + 3 branches). Restored at the end.
    savedLocal = await page.evaluate(() => {
      const keys = [
        'discovery:professionalMode', 'aiDataConsent', 'idiampro-tier-id',
        'onboarding:welcomeShowcaseSeen', 'onboarding:completed',
        'apiKey_openai', 'apiKey_gemini', 'confirm.heavyOp.videoGeneration.suppressed',
        'idiampro:video-visuals-set', 'idiampro:video-depth', 'idiampro:video-style',
        'idiampro-video-manifests',
      ];
      const saved = {};
      for (const k of keys) saved[k] = localStorage.getItem(k);
      try {
        localStorage.setItem('discovery:professionalMode', 'false');
        localStorage.setItem('aiDataConsent', 'granted');
        localStorage.setItem('idiampro-tier-id', 'pro');
        localStorage.setItem('onboarding:welcomeShowcaseSeen', 'true');
        localStorage.setItem('onboarding:completed', 'true');
        localStorage.removeItem('apiKey_openai');
        localStorage.removeItem('apiKey_gemini');
        localStorage.removeItem('confirm.heavyOp.videoGeneration.suppressed');
        localStorage.setItem('idiampro:video-visuals-set', JSON.stringify({ mindmap: false, photo: false, videoclip: false }));
        localStorage.setItem('idiampro:video-depth', 'overview');
        localStorage.removeItem('idiampro-video-manifests');
      } catch {}
      return saved;
    });
    await page.reload().catch(() => {});
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(2500);
    for (let i = 0; i < 3; i++) {
      const overlay = await page.locator('div.fixed.inset-0.z-50').first().isVisible().catch(() => false);
      if (!overlay) break;
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(400);
    }

    const newBtn = page.locator('button:has-text("New Outline")').first();
    const deadline = Date.now() + 120000; let ready = false;
    while (Date.now() < deadline) {
      if (await newBtn.isVisible({ timeout: 1000 }).catch(() => false)) { ready = true; break; }
      if (!page.url().includes('/app')) { await page.evaluate(() => { window.location.href = '/app'; }).catch(() => {}); }
      await page.waitForTimeout(2000);
    }
    if (!ready) throw new Error('App shell (New Outline) never became visible');
    step('App shell ready.');
    await shot('01-app-ready');

    // ---- Build a 3-branch outline (cover + 3 scenes at Overview depth). ----
    await newBtn.click(); await page.waitForTimeout(1500);
    await page.locator('[role="treeitem"]').first().click().catch(() => {});
    await page.waitForTimeout(400);
    const branchNames = ['Morning Routines', 'Deep Work Habits', 'Evening Wind Down'];
    for (const nm of branchNames) {
      await page.keyboard.press('Enter');
      const input = page.locator('input[type="text"]:visible').first();
      try { await input.waitFor({ state: 'visible', timeout: 4000 }); } catch {}
      await page.waitForTimeout(150); await input.fill(nm); await page.waitForTimeout(120);
      await page.keyboard.press('Enter'); await page.waitForTimeout(350);
    }
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    await page.locator('[role="treeitem"]').first().click().catch(() => {});
    await page.waitForTimeout(400);
    step('Created outline with 3 branches: ' + branchNames.join(', '));
    await shot('02-outline');

    const openExportMenu = async () => {
      const inline = page.locator('[aria-label="Export"]');
      const n = await inline.count().catch(() => 0);
      for (let i = 0; i < n; i++) {
        const b = inline.nth(i);
        if (await b.isEnabled().catch(() => false) && await b.isVisible().catch(() => false)) {
          await b.click(); await page.waitForTimeout(400); return;
        }
      }
      const more = page.locator('[aria-label="More tools"]').first();
      await more.click(); await page.waitForTimeout(400);
      const exportSub = page.locator('[role="menuitem"]:has-text("Export")').first();
      await exportSub.hover().catch(() => {});
      await exportSub.click().catch(() => {});
      await page.waitForTimeout(600);
    };

    const openVideoDialog = async () => {
      // Generate Video needs a SELECTED chapter node — click the root node's
      // NAME SPAN (the proven selection pattern; a row click can miss).
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(200);
      await page.locator('[role="treeitem"] span').first().click().catch(() => {});
      await page.waitForTimeout(500);
      await openExportMenu();
      // Preferred: a direct "Generate Video" menu item; fallback: the export
      // gallery ("Export Current Outline" → Video tile).
      const direct = page.locator('[role="menuitem"]:has-text("Generate Video")').first();
      if ((await direct.count().catch(() => 0)) > 0 && await direct.isVisible().catch(() => false)) {
        const disabled = await direct.getAttribute('aria-disabled').catch(() => null);
        if (disabled === 'true') throw new Error('"Generate Video" menu item is disabled (no chapter selected)');
        await direct.click();
      } else {
        await page.locator('[role="menuitem"]:has-text("Export Current Outline")').first().click();
        await page.waitForTimeout(1000);
        const tile = page.locator('button:has(span:text-is("Video"))').first();
        await tile.scrollIntoViewIfNeeded().catch(() => {});
        await tile.click();
      }
      await page.waitForTimeout(1200);
      const opened = await page.locator('text=Generate Video').first().isVisible().catch(() => false);
      if (!opened) throw new Error('Generate Video dialog did not open');
    };

    const approveHeavyOp = async (expectScopeText, shotName) => {
      const confirm = page.locator('[data-testid="heavy-op-confirm"]');
      try { await confirm.waitFor({ state: 'visible', timeout: 6000 }); } catch {
        throw new Error('P2 heavy-op confirm did not appear before the render');
      }
      if (expectScopeText) {
        const scope = await page.locator('[data-testid="heavy-op-scope"]').textContent().catch(() => '');
        if (!scope || !scope.includes(expectScopeText)) {
          throw new Error(`Scoped cost note missing/mismatched. Wanted "${expectScopeText}", got "${scope}"`);
        }
        step(`P2 confirm shows scoped note: "${scope.trim()}"`);
      } else {
        step('P2 heavy-op confirm appeared before the render.');
      }
      if (shotName) await shot(shotName);
      await page.locator('[data-testid="heavy-op-run"]').click();
      await page.waitForTimeout(400);
    };

    const waitForDone = async () => {
      await page.evaluate(() => { window.__videoCacheStats = undefined; window.__videoSceneResults = undefined; });
      const dl = Date.now() + 300000;
      while (Date.now() < dl) {
        if (await page.locator('text=Your video is ready').first().isVisible().catch(() => false)) break;
        const errTxt = await page.locator('[role="dialog"] .text-destructive').first().textContent().catch(() => null);
        if (errTxt && errTxt.trim()) throw new Error('Render error: ' + errTxt.trim().slice(0, 200));
        await page.waitForTimeout(1000);
      }
      if (!(await page.locator('text=Your video is ready').first().isVisible().catch(() => false))) {
        throw new Error('Render never reached the done phase');
      }
      return page.evaluate(() => ({
        stats: window.__videoCacheStats || null,
        scenes: window.__videoSceneResults || null,
      }));
    };

    const readManifest = async () => page.evaluate(() => {
      try {
        const store = JSON.parse(localStorage.getItem('idiampro-video-manifests') || '{}');
        const entries = Object.values(store).sort((a, b) => b.compiledAt - a.compiledAt);
        return entries[0] || null;
      } catch { return null; }
    });

    const cacheSnapshot = async () => electronApp.evaluate(() => global.__videoSceneCache.snapshot());

    // ================= RUN 1 — first generation (all scenes fresh) ==========
    await openVideoDialog();
    const prevBoxRun1 = await page.locator('[data-testid="video-previous-version"]').count().catch(() => 0);
    if (prevBoxRun1 !== 0) throw new Error('Previous-version box shown on a brand-new video');
    step('Run 1: no previous-version box (correct for a first generation).');
    const slideNote = await page.locator('[role="dialog"] .font-medium', { hasText: /slides/ }).first().textContent().catch(() => '');
    step(`Run 1 slide count note: "${(slideNote || '').trim()}"`);
    await shot('03-config-first');
    await page.locator('[role="dialog"] button', { hasText: /^Generate$/ }).first().click();
    await approveHeavyOp(null, '04-p2-confirm-first');
    const run1 = await waitForDone();
    report.run1 = run1;
    await shot('05-done-first');
    if (!run1.stats || run1.stats.reused !== 0 || run1.stats.generated !== 4) {
      throw new Error(`Run 1 expected 0 reused / 4 generated scenes, got ${JSON.stringify(run1.stats)}`);
    }
    step(`Run 1: 4 scenes rendered fresh, 0 reused (${JSON.stringify(run1.stats)}).`);

    const manifest1 = await readManifest();
    if (!manifest1) throw new Error('No compile manifest recorded after run 1');
    if (!Array.isArray(manifest1.scenes) || manifest1.scenes.length !== 4) {
      throw new Error(`Manifest expected 4 scenes, got ${manifest1 && manifest1.scenes && manifest1.scenes.length}`);
    }
    for (const s of manifest1.scenes) {
      if (!Array.isArray(s.sourceNodeIds) || s.sourceNodeIds.length === 0) throw new Error(`Manifest scene ${s.index} missing sourceNodeIds`);
      if (!s.fingerprint) throw new Error(`Manifest scene ${s.index} missing fingerprint`);
      if (typeof s.narration !== 'string' || !s.narration) throw new Error(`Manifest scene ${s.index} missing narration text`);
      if (!s.clipKey) throw new Error(`Manifest scene ${s.index} missing clipKey`);
      if (s.engine !== 'say') throw new Error(`Free-path scene recorded wrong engine: ${s.engine}`);
    }
    // Cover scene traces to the chapter root + every branch on its agenda.
    if (manifest1.scenes[0].sourceNodeIds.length < 4) {
      throw new Error(`Cover scene should trace to root + 3 agenda branches, got ${manifest1.scenes[0].sourceNodeIds.length} ids`);
    }
    step('Manifest recorded: 4 scenes, each with source node ids + fingerprint + narration + say-engine clip keys.');

    if (!manifest1.outputPath || !fs.existsSync(manifest1.outputPath)) {
      throw new Error('Manifest outputPath missing or file not on disk: ' + manifest1.outputPath);
    }
    const mp41 = probeMp4(manifest1.outputPath);
    if (!mp41.hasVideo || !mp41.hasAudio || !(mp41.duration > 2)) {
      throw new Error(`Run 1 MP4 invalid: ${JSON.stringify(mp41)}`);
    }
    report.mp4Run1 = { path: manifest1.outputPath, ...mp41 };
    step(`Run 1 MP4 valid: video+audio streams, ${mp41.duration.toFixed(1)}s.`);

    const snap1 = await cacheSnapshot();
    const run1Keys = manifest1.scenes.map((s) => s.clipKey + '.mp4');
    for (const k of run1Keys) {
      if (!snap1.files[k]) throw new Error(`Cached scene clip missing on disk: ${k}`);
    }
    step(`All 4 run-1 scene clips present in the scene cache (${snap1.dir}).`);

    // Close the dialog back to the app.
    await page.keyboard.press('Escape'); await page.waitForTimeout(600);
    await page.keyboard.press('Escape'); await page.waitForTimeout(600);

    // ================= EDIT ONE NODE (rename branch 3) ======================
    await page.locator('button:has-text("Got it")').first().click().catch(() => {});
    await page.waitForTimeout(300);
    const renamed = 'Weekend Recovery Rituals';
    const targetSpan = page.locator(`[role="treeitem"] span:has-text("${branchNames[2]}")`).first();
    await targetSpan.click(); await page.waitForTimeout(300);
    await targetSpan.dblclick(); await page.waitForTimeout(500);
    const editInput = page.locator('input[type="text"]:visible').first();
    await editInput.waitFor({ state: 'visible', timeout: 5000 });
    await editInput.fill(renamed); await page.waitForTimeout(150);
    await page.keyboard.press('Enter'); await page.waitForTimeout(500);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    await page.locator('[role="treeitem"]').first().click().catch(() => {});
    await page.waitForTimeout(400);
    step(`Renamed branch 3 → "${renamed}" (changes that branch's scene AND the cover's agenda).`);

    // ================= RUN 2 — Update Changed (selective) ===================
    await openVideoDialog();
    const prevBox = page.locator('[data-testid="video-previous-version"]');
    if ((await prevBox.count().catch(() => 0)) === 0) throw new Error('Previous-version box missing on run 2');
    const boxText = (await prevBox.textContent().catch(() => '')) || '';
    if (!/2 of 4/.test(boxText)) throw new Error(`Expected "2 of 4" changed scenes (branch + cover agenda), box says: ${boxText.slice(0, 200)}`);
    step('Run 2: dialog offers Update Changed — "2 of 4 scenes have changed".');
    await shot('06-update-offer-light');
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(400);
    await shot('07-update-offer-dark');
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    await page.waitForTimeout(300);

    await page.locator('[data-testid="video-update-changed"]').click();
    await approveHeavyOp('2 of 4 scene', '08-p2-scoped-confirm');
    const run2 = await waitForDone();
    report.run2 = run2;
    await shot('09-done-update');
    if (!run2.stats || run2.stats.reused !== 2 || run2.stats.generated !== 2) {
      throw new Error(`Run 2 expected 2 reused / 2 generated scenes, got ${JSON.stringify(run2.stats)}`);
    }
    step(`Run 2: selective update — 2 scenes reused, 2 re-rendered (${JSON.stringify(run2.stats)}).`);

    const manifest2 = await readManifest();
    const snap2 = await cacheSnapshot();
    // Birthtime proof: the 2 unchanged scenes (branches 1 & 2 = indexes 1,2)
    // kept the SAME clip files (not recreated).
    for (const idx of [1, 2]) {
      const before = manifest1.scenes[idx];
      const after = manifest2.scenes[idx];
      if (before.clipKey !== after.clipKey) throw new Error(`Unchanged scene ${idx} clipKey changed — not reused`);
      const k = after.clipKey + '.mp4';
      if (!snap1.files[k] || !snap2.files[k]) throw new Error(`Unchanged scene clip vanished: ${k}`);
      if (Math.abs(snap1.files[k].birthtimeMs - snap2.files[k].birthtimeMs) > 1) {
        throw new Error(`Unchanged scene clip was RE-CREATED (birthtime moved): ${k}`);
      }
    }
    // The 2 changed scenes (cover = 0, renamed branch = 3) got FRESH clips.
    for (const idx of [0, 3]) {
      const before = manifest1.scenes[idx];
      const after = manifest2.scenes[idx];
      if (before.clipKey === after.clipKey) throw new Error(`Changed scene ${idx} kept its old clipKey — not re-rendered`);
      const k = after.clipKey + '.mp4';
      if (snap1.files[k]) throw new Error(`Changed scene clip existed BEFORE the edit — not fresh: ${k}`);
      if (!snap2.files[k]) throw new Error(`Changed scene clip missing after run 2: ${k}`);
      if (before.fingerprint === after.fingerprint) throw new Error(`Changed scene ${idx} fingerprint did not change`);
    }
    step('Clip files prove reuse: 2 unchanged clips untouched on disk (same birthtime); 2 fresh clips for the edited scenes only.');
    if (manifest2.compiledAt <= manifest1.compiledAt) throw new Error('Manifest was not refreshed after run 2');
    if (!manifest2.scenes[3].title.includes(renamed)) throw new Error(`Renamed scene title not in manifest: ${manifest2.scenes[3].title}`);
    step('Manifest refreshed; renamed scene carries the new title + fingerprint.');

    const mp42 = probeMp4(manifest2.outputPath);
    if (!mp42.hasVideo || !mp42.hasAudio || !(mp42.duration > 2)) {
      throw new Error(`Run 2 MP4 invalid: ${JSON.stringify(mp42)}`);
    }
    report.mp4Run2 = { path: manifest2.outputPath, ...mp42 };
    step(`Run 2 MP4 valid: video+audio streams, ${mp42.duration.toFixed(1)}s.`);

    // Engine-awareness: the same scene material under an OPENAI-engine key
    // must MISS (a free `say` clip can never masquerade as premium).
    const sceneResults2 = run2.scenes || [];
    const reusedScene = sceneResults2.find((r) => r && r.fromCache);
    if (!reusedScene || !reusedScene.materialHash) throw new Error('No reused scene with materialHash in results');
    const engineCheck = await electronApp.evaluate(
      (_m, args) => ({
        sayKeyed: global.__videoSceneCache.hasKeyVariant('say', args.voiceId, args.materialHash),
        openaiKeyed: global.__videoSceneCache.hasKeyVariant('openai', 'nova|tts-1', args.materialHash),
      }),
      { materialHash: reusedScene.materialHash, voiceId: 'PROBE-ONLY' },
    );
    if (engineCheck.openaiKeyed) throw new Error('ENGINE-AWARENESS VIOLATION: a say scene clip is reachable under an OpenAI cache key');
    step('Engine-aware scene cache verified: free `say` clips are NOT reachable under OpenAI keys.');

    // Close the dialog back to the app.
    await page.keyboard.press('Escape'); await page.waitForTimeout(600);
    await page.keyboard.press('Escape'); await page.waitForTimeout(600);

    // ================= RUN 3 — Start Fresh (full rebuild) ===================
    await openVideoDialog();
    if ((await prevBox.count().catch(() => 0)) === 0) throw new Error('Previous-version box missing on run 3');
    await page.locator('[data-testid="video-start-fresh"]').click();
    await approveHeavyOp(null, '10-p2-confirm-fresh');
    const run3 = await waitForDone();
    report.run3 = run3;
    if (!run3.stats || run3.stats.reused !== 0 || run3.stats.generated !== 4) {
      throw new Error(`Start Fresh expected 0 reused / 4 generated scenes, got ${JSON.stringify(run3.stats)}`);
    }
    step(`Run 3 (Start Fresh): everything rebuilt — 0 reused, 4 generated.`);
    await shot('11-done-fresh');
    const manifest3 = await readManifest();
    const mp43 = probeMp4(manifest3.outputPath);
    if (!mp43.hasVideo || !mp43.hasAudio || !(mp43.duration > 2)) {
      throw new Error(`Run 3 MP4 invalid: ${JSON.stringify(mp43)}`);
    }
    step(`Run 3 MP4 valid: video+audio streams, ${mp43.duration.toFixed(1)}s.`);

    // ================= MONEY-SAFETY final assertion =========================
    const openaiCalls = await electronApp.evaluate(() => global.__openaiCallCount || 0);
    report.openaiCalls = openaiCalls;
    if (openaiCalls !== 0) throw new Error(`MONEY-SAFETY VIOLATION: ${openaiCalls} OpenAI call(s) attempted during the test`);
    step('Zero OpenAI network calls across the entire test ($0 spent).');

    report.pass = true;
    console.log('PASS');
  } catch (err) {
    report.error = String((err && err.stack) || err);
    console.error('FAIL:', report.error);
    try { await shot('ERR-final'); } catch {}
  } finally {
    // Restore the localStorage keys we overrode (best effort).
    try {
      if (page && savedLocal) {
        await page.evaluate((saved) => {
          for (const [k, v] of Object.entries(saved)) {
            try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch {}
          }
        }, savedLocal);
      }
    } catch {}
    await refocus();
    if (electronApp) {
      await Promise.race([
        electronApp.close().catch(() => {}),
        new Promise((r) => setTimeout(r, 5000)),
      ]);
    }
    writeReport();
  }
  process.exit(report.pass ? 0 : 1);
}

main();
