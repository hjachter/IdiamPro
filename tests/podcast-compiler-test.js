// ============================================================================
// Podcast COMPILER test (content-compiler Phase 1) — free path, $0, own Electron
// ----------------------------------------------------------------------------
// Proves the whole Phase-1 loop on the podcast adapter, spending nothing:
//
//   1. FIRST GENERATION (sectioned): a 3-branch outline compiles into a
//      3-section podcast; a manifest is recorded with per-section source node
//      ids + content fingerprints + per-segment audio clip references.
//   2. SELECTIVE REGENERATION: rename ONE branch → the dialog offers
//      "Update Changed" ("1 of 3 sections have changed"), the P2 heavy-op
//      confirm shows the honest SCOPED note, the script request contains ONLY
//      the changed section, and at audio time the unchanged segments' clips
//      are REUSED from the cache (proved by clip-file birthtimes AND the
//      generator's reuse accounting) while only the changed section is
//      re-synthesized. The final MP3 is playable.
//   3. START FRESH: rebuilds everything (reused = 0), honestly.
//   4. ENGINE-AWARENESS: a cached free `say` clip is NOT reachable under an
//      OpenAI-engine cache key for the same text.
//
// MONEY SAFETY: OpenAI key forced absent in launch env AND scrubbed in the
// main process; a fetch spy in the main process must record ZERO calls to
// openai.com across the entire test. The script route is fully MOCKED, so no
// text-generation AI is called either.
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
const OUT_DIR = path.join(projectRoot, 'test-screenshots', 'podcast-compiler');
fs.mkdirSync(OUT_DIR, { recursive: true });

let electronApp, page;
const report = { suite: 'podcast-compiler', startedAt: new Date().toISOString(), steps: [], pass: false };

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
    `# Podcast Compiler Test (Phase 1) — ${report.pass ? 'PASS' : 'FAIL'}`,
    '',
    'Selective regeneration on the free `say` path: manifest + per-segment',
    'traceability + clip-cache reuse, with $0 spent and zero OpenAI calls.',
    '',
    '## Steps',
    ...report.steps.map((s) => `- ${s}`),
    '',
    report.error ? `## Error\n\n\`\`\`\n${report.error}\n\`\`\`\n` : '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), md);
}

// Deterministic canned dialogue for a section: stable while the section's
// title is stable, different once the branch is renamed — exactly mirroring
// how real content edits change real scripts.
function cannedSectionSegments(index, title) {
  return [
    { speaker: 'Host A', voice: 'nova', text: `Section ${index + 1}. Let us explore ${title} together in plain terms.` },
    { speaker: 'Host B', voice: 'onyx', text: `Absolutely. ${title} matters because it shapes the story we are telling today.` },
  ];
}

async function main() {
  const capturedRequests = []; // every body POSTed to the script route
  let savedLocal = null; // localStorage keys we override, restored at the end

  try {
    if (process.platform !== 'darwin') {
      step('Skipped: free `say` path is macOS-only.');
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

    // Start from an EMPTY clip cache so the reuse accounting is deterministic
    // even on repeat runs (canned text is stable, so a previous run's clips
    // would otherwise register as reuse). The hook gives us the dir; this test
    // process deletes the files itself.
    {
      const pre = await electronApp.evaluate(() => global.__podcastClipCache.snapshot());
      if (pre.dir) {
        for (const f of Object.keys(pre.files)) {
          try { fs.unlinkSync(path.join(pre.dir, f)); } catch {}
        }
        step(`Clip cache cleared (${Object.keys(pre.files).length} leftover clip(s) removed).`);
      }
    }

    page = await findMainWindow(electronApp);
    page.on('dialog', async (d) => { try { await d.dismiss(); } catch {} });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    await page.setViewportSize({ width: 1440, height: 980 });

    // Mock the script route: sectioned requests get NDJSON section events;
    // legacy requests get the old single-JSON shape. No AI is ever called.
    await page.route('**/api/generate-podcast-script', async (route) => {
      let body = {};
      try { body = JSON.parse(route.request().postData() || '{}'); } catch {}
      capturedRequests.push(body);
      if (Array.isArray(body.sectionJobs) && body.sectionJobs.length > 0) {
        const lines = [];
        let running = 0;
        body.sectionJobs.forEach((job, j) => {
          lines.push(JSON.stringify({ type: 'section-start', index: job.index, done: j, jobs: body.sectionJobs.length }));
          const segs = cannedSectionSegments(job.index, job.title);
          running += segs.length;
          lines.push(JSON.stringify({ type: 'section', index: job.index, segments: segs }));
          lines.push(JSON.stringify({ type: 'progress', segments: running, jobsDone: j + 1, jobs: body.sectionJobs.length }));
        });
        lines.push(JSON.stringify({ type: 'done', mode: 'sectioned' }));
        await route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: lines.join('\n') + '\n' });
      } else {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ segments: cannedSectionSegments(0, 'the whole outline') }),
        });
      }
    });
    step('Mocked /api/generate-podcast-script (sectioned-aware, no AI spend).');

    if (!page.url().includes('/app')) {
      await page.evaluate(() => { window.location.href = '/app'; }).catch(() => {});
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }
    // Save + override localStorage: NO BYOK keys (money safety), pro tier so
    // the feature gate passes, Professional mode OFF so the P2 heavy-op
    // confirm actually appears (this test asserts it). Restored at the end.
    savedLocal = await page.evaluate(() => {
      const keys = [
        'discovery:professionalMode', 'aiDataConsent', 'idiampro-tier-id',
        'onboarding:welcomeShowcaseSeen', 'onboarding:completed',
        'apiKey_openai', 'apiKey_gemini', 'confirm.heavyOp.podcastGeneration.suppressed',
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
        localStorage.removeItem('confirm.heavyOp.podcastGeneration.suppressed');
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

    // ---- Build a 3-branch outline (3 podcast sections). ----
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

    const openPodcastDialog = async () => {
      await openExportMenu();
      await page.locator('[role="menuitem"]:has-text("Export Current Outline")').first().click();
      await page.waitForTimeout(1000);
      const tile = page.locator('button:has(span:text-is("Podcast"))').first();
      await tile.scrollIntoViewIfNeeded().catch(() => {});
      await tile.click(); await page.waitForTimeout(1200);
      const opened = await page.locator('text=Generate Podcast').first().isVisible().catch(() => false);
      if (!opened) throw new Error('Podcast dialog did not open');
    };

    const approveHeavyOpIfShown = async (expectScopeText) => {
      const confirm = page.locator('[data-testid="heavy-op-confirm"]');
      try { await confirm.waitFor({ state: 'visible', timeout: 6000 }); } catch {
        throw new Error('P2 heavy-op confirm did not appear before generation');
      }
      if (expectScopeText) {
        const scope = await page.locator('[data-testid="heavy-op-scope"]').textContent().catch(() => '');
        if (!scope || !scope.includes(expectScopeText)) {
          throw new Error(`Scoped cost note missing/mismatched. Wanted "${expectScopeText}", got "${scope}"`);
        }
        step(`P2 confirm shows scoped note: "${scope.trim()}"`);
      } else {
        step('P2 heavy-op confirm appeared before generation.');
      }
      await shot(expectScopeText ? '10-p2-scoped-confirm' : '03-p2-confirm');
      await page.locator('[data-testid="heavy-op-run"]').click();
      await page.waitForTimeout(400);
    };

    const waitForEditScript = async () => {
      const dl = Date.now() + 30000;
      while (Date.now() < dl) {
        if ((await page.locator('[role="dialog"] button:has-text("Generate Audio")').count().catch(() => 0)) > 0) return;
        const errTxt = await page.locator('[role="dialog"] .text-destructive').first().textContent().catch(() => null);
        if (errTxt && errTxt.trim()) throw new Error('Script phase error: ' + errTxt.trim().slice(0, 160));
        await page.waitForTimeout(600);
      }
      throw new Error('Never reached edit-script phase');
    };

    const generateAudioAndWait = async () => {
      await page.evaluate(() => { window.__podcastCacheStats = undefined; });
      await page.locator('[role="dialog"] button:has-text("Generate Audio")').first().click();
      const dl = Date.now() + 180000;
      while (Date.now() < dl) {
        if ((await page.locator('[role="dialog"] audio').count().catch(() => 0)) > 0) break;
        const errTxt = await page.locator('[role="dialog"] .text-destructive').first().textContent().catch(() => null);
        if (errTxt && errTxt.trim()) throw new Error('Audio phase error: ' + errTxt.trim().slice(0, 160));
        await page.waitForTimeout(1000);
      }
      if ((await page.locator('[role="dialog"] audio').count().catch(() => 0)) === 0) {
        throw new Error('No <audio> player appeared in the preview');
      }
      const info = await page.evaluate(async () => {
        const a = document.querySelector('[role="dialog"] audio');
        if (!a) return { present: false, duration: 0 };
        let duration = a.duration;
        if (!(duration > 0)) {
          await new Promise((res) => {
            a.addEventListener('loadedmetadata', res, { once: true });
            try { a.load(); } catch {}
            setTimeout(res, 4000);
          });
          duration = a.duration;
        }
        return {
          present: true,
          duration: Number.isFinite(duration) ? duration : 0,
          stats: window.__podcastCacheStats || null,
        };
      });
      if (!(info.duration > 0.5)) throw new Error(`Preview audio unplayable/too short: ${info.duration}s`);
      return info;
    };

    const readManifest = async () => page.evaluate(() => {
      try {
        const store = JSON.parse(localStorage.getItem('idiampro-podcast-manifests') || '{}');
        const entries = Object.values(store).sort((a, b) => b.compiledAt - a.compiledAt);
        return entries[0] || null;
      } catch { return null; }
    });

    // `require` isn't available inside electronApp.evaluate — use the
    // read-only test hook main.js exposes on global (__podcastClipCache).
    const cacheDirSnapshot = async () => electronApp.evaluate(() => global.__podcastClipCache.snapshot());

    // ================= RUN 1 — first generation (all sections fresh) ========
    await openPodcastDialog();
    const prevBoxRun1 = await page.locator('[data-testid="podcast-previous-version"]').count().catch(() => 0);
    if (prevBoxRun1 !== 0) throw new Error('Previous-version box shown on a brand-new podcast');
    step('Run 1: no previous-version box (correct for a first generation).');
    await shot('03-config-first');
    await page.locator('[role="dialog"] button', { hasText: /^Generate$/ }).first().click();
    await approveHeavyOpIfShown(null);
    await waitForEditScript();
    await shot('04-edit-script-first');

    const run1Req = capturedRequests[capturedRequests.length - 1];
    if (!Array.isArray(run1Req.sectionJobs)) throw new Error('Run 1 did not use the sectioned request');
    if (run1Req.sectionJobs.length !== 3) throw new Error(`Run 1 expected 3 section jobs, got ${run1Req.sectionJobs.length}`);
    step(`Run 1: sectioned request with ${run1Req.sectionJobs.length} jobs (one per branch).`);

    const info1 = await generateAudioAndWait();
    report.run1 = { duration: info1.duration, stats: info1.stats };
    step(`Run 1 audio playable (${info1.duration.toFixed(1)}s). Cache stats: ${JSON.stringify(info1.stats)}`);
    if (!info1.stats || info1.stats.generated < 6 || info1.stats.reused !== 0) {
      throw new Error(`Run 1 expected 6 generated / 0 reused clips, got ${JSON.stringify(info1.stats)}`);
    }
    await shot('05-preview-first');

    const manifest1 = await readManifest();
    if (!manifest1) throw new Error('No compile manifest recorded after run 1');
    if (!Array.isArray(manifest1.sections) || manifest1.sections.length !== 3) {
      throw new Error(`Manifest expected 3 sections, got ${manifest1 && manifest1.sections && manifest1.sections.length}`);
    }
    for (const s of manifest1.sections) {
      if (!Array.isArray(s.sourceNodeIds) || s.sourceNodeIds.length === 0) throw new Error(`Manifest section ${s.index} missing sourceNodeIds`);
      if (!s.fingerprint) throw new Error(`Manifest section ${s.index} missing fingerprint`);
      if (!Array.isArray(s.segments) || s.segments.length === 0) throw new Error(`Manifest section ${s.index} has no segments`);
      for (const seg of s.segments) {
        if (!seg.clipKey) throw new Error(`Manifest section ${s.index} segment missing clipKey`);
        if (seg.engine !== 'say') throw new Error(`Free-path clip recorded wrong engine: ${seg.engine}`);
      }
    }
    step('Manifest recorded: 3 sections, each with source node ids + fingerprint + say-engine clip keys.');

    const snap1 = await cacheDirSnapshot();
    const run1Keys = manifest1.sections.flatMap((s) => s.segments.map((x) => x.clipKey + '.mp3'));
    for (const k of run1Keys) {
      if (!snap1.files[k]) throw new Error(`Cached clip missing on disk: ${k}`);
    }
    step(`All ${run1Keys.length} run-1 clips present in the clip cache (${snap1.dir}).`);

    // Close the dialog back to the app.
    await page.keyboard.press('Escape'); await page.waitForTimeout(600);
    await page.keyboard.press('Escape'); await page.waitForTimeout(600);

    // ================= EDIT ONE NODE (rename branch 3) ======================
    // Dismiss any "Did you know?" toast so it can't swallow clicks.
    await page.locator('button:has-text("Got it")').first().click().catch(() => {});
    await page.waitForTimeout(300);
    const renamed = 'Weekend Recovery Rituals';
    // Double-click the NAME SPAN (not the row) — the proven rename pattern.
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
    step(`Renamed branch 3 → "${renamed}" (one section's source content changed).`);

    // ================= RUN 2 — Update Changed (selective) ===================
    await openPodcastDialog();
    const prevBox = page.locator('[data-testid="podcast-previous-version"]');
    if ((await prevBox.count().catch(() => 0)) === 0) throw new Error('Previous-version box missing on run 2');
    const boxText = (await prevBox.textContent().catch(() => '')) || '';
    if (!/1 of 3/.test(boxText)) throw new Error(`Expected "1 of 3" changed sections, box says: ${boxText.slice(0, 160)}`);
    step('Run 2: dialog offers Update Changed — "1 of 3 sections have changed".');
    await shot('06-update-offer-light');
    // Dark-mode screenshot of the same choice.
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(400);
    await shot('07-update-offer-dark');
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    await page.waitForTimeout(300);

    await page.locator('[data-testid="podcast-update-changed"]').click();
    await approveHeavyOpIfShown('1 of 3 section');
    await waitForEditScript();
    await shot('08-edit-script-update');

    const run2Req = capturedRequests[capturedRequests.length - 1];
    if (!Array.isArray(run2Req.sectionJobs) || run2Req.sectionJobs.length !== 1) {
      throw new Error(`Run 2 expected EXACTLY 1 section job (the changed one), got ${run2Req.sectionJobs && run2Req.sectionJobs.length}`);
    }
    if (!String(run2Req.sectionJobs[0].title).includes(renamed)) {
      throw new Error(`Run 2 regenerated the wrong section: ${run2Req.sectionJobs[0].title}`);
    }
    step('Run 2: script request contained ONLY the changed section (scoped generation).');

    const info2 = await generateAudioAndWait();
    report.run2 = { duration: info2.duration, stats: info2.stats };
    step(`Run 2 audio playable (${info2.duration.toFixed(1)}s). Cache stats: ${JSON.stringify(info2.stats)}`);
    if (!info2.stats || info2.stats.reused !== 4 || info2.stats.generated !== 2) {
      throw new Error(`Run 2 expected 4 reused / 2 generated clips, got ${JSON.stringify(info2.stats)}`);
    }
    await shot('09-preview-update');

    // Birthtime proof: the 4 unchanged clips are the SAME files (not recreated).
    const snap2 = await cacheDirSnapshot();
    const manifest2 = await readManifest();
    const unchangedKeys = manifest2.sections
      .filter((s) => s.index < 2)
      .flatMap((s) => s.segments.map((x) => x.clipKey + '.mp3'));
    let reusedOnDisk = 0;
    for (const k of unchangedKeys) {
      if (!snap1.files[k] || !snap2.files[k]) throw new Error(`Unchanged clip vanished: ${k}`);
      if (Math.abs(snap1.files[k].birthtimeMs - snap2.files[k].birthtimeMs) > 1) {
        throw new Error(`Unchanged clip was RE-CREATED (birthtime moved): ${k}`);
      }
      reusedOnDisk++;
    }
    const changedKeys = manifest2.sections
      .filter((s) => s.index === 2)
      .flatMap((s) => s.segments.map((x) => x.clipKey + '.mp3'));
    for (const k of changedKeys) {
      if (snap1.files[k]) throw new Error(`Changed section clip existed BEFORE the edit — not fresh: ${k}`);
      if (!snap2.files[k]) throw new Error(`Changed section clip missing after run 2: ${k}`);
    }
    step(`Clip files prove reuse: ${reusedOnDisk} unchanged clips untouched on disk; ${changedKeys.length} fresh clips for the edited section only.`);
    if (manifest2.compiledAt <= manifest1.compiledAt) throw new Error('Manifest was not refreshed after run 2');
    const fp1 = manifest1.sections.find((s) => s.index === 2).fingerprint;
    const fp2 = manifest2.sections.find((s) => s.index === 2).fingerprint;
    if (fp1 === fp2) throw new Error('Changed section fingerprint did not change');
    step('Manifest refreshed; changed section carries a new fingerprint.');

    // Engine-awareness: the same text under an OPENAI-engine key must MISS.
    const engineCheck = await electronApp.evaluate(
      (_m, args) => ({
        openaiKeyedFileExists: global.__podcastClipCache.hasKey('openai', 'nova|tts-1', args.text),
      }),
      { text: manifest2.sections[0].segments[0].text },
    );
    if (engineCheck.openaiKeyedFileExists) throw new Error('ENGINE-AWARENESS VIOLATION: a say clip is reachable under an OpenAI cache key');
    step('Engine-aware cache verified: free `say` clips are NOT reachable under OpenAI keys.');

    // Close the dialog back to the app.
    await page.keyboard.press('Escape'); await page.waitForTimeout(600);
    await page.keyboard.press('Escape'); await page.waitForTimeout(600);

    // ================= RUN 3 — Start Fresh (full rebuild) ===================
    await openPodcastDialog();
    if ((await prevBox.count().catch(() => 0)) === 0) throw new Error('Previous-version box missing on run 3');
    await page.locator('[data-testid="podcast-start-fresh"]').click();
    await approveHeavyOpIfShown(null);
    await waitForEditScript();
    const run3Req = capturedRequests[capturedRequests.length - 1];
    if (!Array.isArray(run3Req.sectionJobs) || run3Req.sectionJobs.length !== 3) {
      throw new Error(`Start Fresh expected ALL 3 section jobs, got ${run3Req.sectionJobs && run3Req.sectionJobs.length}`);
    }
    const info3 = await generateAudioAndWait();
    report.run3 = { duration: info3.duration, stats: info3.stats };
    if (!info3.stats || info3.stats.reused !== 0 || info3.stats.generated < 6) {
      throw new Error(`Start Fresh expected 0 reused / 6 generated clips, got ${JSON.stringify(info3.stats)}`);
    }
    step(`Run 3 (Start Fresh): everything rebuilt — 0 reused, ${info3.stats.generated} generated; audio ${info3.duration.toFixed(1)}s.`);
    await shot('11-preview-fresh');

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
