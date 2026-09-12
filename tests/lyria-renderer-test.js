// ============================================================================
// Lyria music-bed test (content-compiler Phase 3C) — FULLY MOCKED, $0, own
// Electron instance.
// ----------------------------------------------------------------------------
// 🟠 THIS TEST MUST NEVER CALL THE REAL LYRIA API. All Lyria HTTP goes through
// the global.__lyriaTestFetch seam in electron/lyria-renderer.js; a mock
// installed in the Electron MAIN process answers every request and records it.
// A separate spy on the REAL fetch asserts zero calls ever reached
// googleapis.com or openai.com. The env var GEMINI_API_KEY is deliberately set
// to a SENTINEL in the launch env to prove the music path REFUSES env keys.
//
// What it proves:
//   1. REQUEST SHAPE + MODEL: one synchronous POST to /v1beta/interactions
//      with the exact model constant (matching src/lib/video/lyria-constants),
//      x-goog-api-key = the user's BYOK key, the dated Api-Revision header,
//      an instrumental-only prompt in `input`, and response_format audio.
//   2. KEY ROUTING: a run with music enabled but NO user key is REFUSED (zero
//      calls, video still completes without music) despite the env sentinel
//      being present; the sentinel appears in ZERO calls anywhere.
//   3. CACHE / NO-REBILL: an identical re-run reuses the raw bed from cache —
//      ZERO new API calls (a re-stitch never re-bills).
//   4. DUCK-MIX: the finished MP4 is ffprobe-valid with the narration and the
//      looped bed flattened into exactly ONE audio stream, and the bed is
//      audibly present (volumedetect vs. a music-off control render).
//   5. CONFIRM: with music ON the P2 confirm ALWAYS appears (Professional
//      mode + suppression flags set — alwaysConfirm) carrying the honest
//      cents framing, with no "Don't ask again" offered. Light + dark shots.
//   6. KEY GATING: without a Gemini key the Music section does not exist.
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
const OUT_DIR = path.join(projectRoot, 'test-screenshots', 'lyria-renderer');
fs.mkdirSync(OUT_DIR, { recursive: true });

const ENV_SENTINEL = 'ENV-KEY-MUST-NEVER-BE-USED';
const USER_KEY = 'TEST-USER-GEMINI-KEY';
const EXPECTED_MODEL = 'lyria-3-clip-preview';
const EXPECTED_REVISION = '2026-05-20';

let electronApp, page;
const report = { suite: 'lyria-renderer', startedAt: new Date().toISOString(), steps: [], pass: false };

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
    `# Lyria Music-Bed Test (Phase 3C) — ${report.pass ? 'PASS' : 'FAIL'}`,
    '',
    'Fully mocked at the HTTP boundary — the real Lyria API is NEVER called ($0).',
    'Request shape, user-key-only routing (env key refused), raw-bed cache',
    'no-rebill, single-flattened-audio duck-mix, and the un-suppressible confirm.',
    '',
    '## Steps',
    ...report.steps.map((s) => `- ${s}`),
    '',
    report.error ? `## Error\n\n\`\`\`\n${report.error}\n\`\`\`\n` : '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), md);
}

function ffToolPaths() {
  return {
    ffmpeg: require(path.join(projectRoot, 'node_modules', 'ffmpeg-static')),
    ffprobe: require(path.join(projectRoot, 'node_modules', 'ffprobe-static')).path,
  };
}

function probeMp4(filePath) {
  const { ffprobe } = ffToolPaths();
  const out = execFileSync(ffprobe, [
    '-v', 'error', '-show_entries', 'format=duration:stream=codec_type',
    '-of', 'json', filePath,
  ], { encoding: 'utf8', maxBuffer: 1 << 20 });
  const data = JSON.parse(out);
  const streams = Array.isArray(data.streams) ? data.streams : [];
  return {
    duration: parseFloat((data.format && data.format.duration) || '0') || 0,
    videoStreams: streams.filter((s) => s.codec_type === 'video').length,
    audioStreams: streams.filter((s) => s.codec_type === 'audio').length,
  };
}

// Mean loudness of a file's audio track (dB, e.g. -25.3; silence ≈ -91).
function meanVolumeDb(filePath) {
  const { ffmpeg } = ffToolPaths();
  let stderr = '';
  try {
    execFileSync(ffmpeg, ['-i', filePath, '-af', 'volumedetect', '-f', 'null', '-'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 22,
    });
  } catch (e) {
    stderr = String((e && e.stderr) || '');
  }
  // execFileSync succeeds too; but ffmpeg logs to stderr which execFileSync
  // doesn't return on success — run again capturing stderr explicitly.
  if (!stderr) {
    const { spawnSync } = require('child_process');
    const r = spawnSync(ffmpeg, ['-i', filePath, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
    stderr = String(r.stderr || '');
  }
  const m = stderr.match(/mean_volume:\s*(-?[\d.]+)\s*dB/);
  if (!m) throw new Error('volumedetect produced no mean_volume for ' + filePath);
  return parseFloat(m[1]);
}

// Build a real 30s MP3 the mock serves as the "generated" bed (must exceed
// the renderer's 30 KB minimum; a clearly audible tone proves mix presence).
function buildMockBed() {
  const { ffmpeg } = ffToolPaths();
  const p = path.join(OUT_DIR, 'mock-lyria-bed.mp3');
  execFileSync(ffmpeg, [
    '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=30',
    '-af', 'volume=0.8', '-c:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', p,
  ], { stdio: 'ignore' });
  const size = fs.statSync(p).size;
  if (size < 35 * 1024) throw new Error(`mock bed too small (${size} bytes)`);
  return p;
}

async function main() {
  let savedLocal = null;

  try {
    if (process.platform !== 'darwin') {
      step('Skipped: free `say` narration path is macOS-only.');
      report.skipped = true; report.pass = true; writeReport();
      console.log('SKIP (non-darwin)'); process.exit(0);
    }

    const mockBedPath = buildMockBed();
    const mockBedB64 = fs.readFileSync(mockBedPath).toString('base64');
    step(`Mock Lyria bed built (${Math.round(mockBedB64.length * 0.75 / 1024)} KB MP3).`);

    console.log('Launching Electron (own instance)...');
    electronApp = await electron.launch({
      args: [projectRoot],
      // 🟠 The env DELIBERATELY carries a Gemini sentinel key: the music path
      // must refuse it. OpenAI key absent so narration uses the free voice.
      env: { ...process.env, NODE_ENV: 'development', OPENAI_API_KEY: '', GEMINI_API_KEY: ENV_SENTINEL },
    });

    // Install (a) a REAL-fetch spy proving no network traffic escaped, and
    // (b) the __lyriaTestFetch mock at the renderer's HTTP boundary.
    await electronApp.evaluate((_m, args) => {
      delete process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = '';
      if (!global.__lyriaSpyInstalled) {
        const realFetch = global.fetch;
        global.__lyriaRealNetCalls = { googleapis: 0, openai: 0 };
        global.fetch = (url, opts) => {
          try {
            const u = String(url).toLowerCase();
            if (u.includes('googleapis.com')) global.__lyriaRealNetCalls.googleapis++;
            if (u.includes('openai.com')) global.__lyriaRealNetCalls.openai++;
          } catch {}
          return realFetch(url, opts);
        };
        global.__lyriaSpyInstalled = true;
      }
      global.__lyriaMock = { calls: [], bedB64: args.bedB64 };
      global.__lyriaTestFetch = async (url, opts) => {
        const rec = {
          url: String(url),
          method: (opts && opts.method) || 'GET',
          key: (opts && opts.headers && opts.headers['x-goog-api-key']) || null,
          revision: (opts && opts.headers && opts.headers['Api-Revision']) || null,
          body: null,
        };
        if (opts && typeof opts.body === 'string') { try { rec.body = JSON.parse(opts.body); } catch {} }
        global.__lyriaMock.calls.push(rec);
        if (String(url).includes('/v1beta/interactions')) {
          return {
            ok: true, status: 200,
            json: async () => ({ output_audio: global.__lyriaMock.bedB64 }),
            text: async () => 'ok',
          };
        }
        return { ok: false, status: 404, json: async () => ({}), text: async () => 'unexpected url ' + url };
      };
    }, { bedB64: mockBedB64 });
    step('Mock installed at the HTTP boundary + real-fetch spy armed ($0 guaranteed).');

    // Model constant must match on both sides (main-process module source vs.
    // the client constants file) — a drift would silently change what's billed.
    const rendererSrc = fs.readFileSync(path.join(projectRoot, 'electron', 'lyria-renderer.js'), 'utf8');
    const mainModel = (rendererSrc.match(/LYRIA_DEFAULT_MODEL\s*=\s*'([^']+)'/) || [])[1];
    const clientSrc = fs.readFileSync(path.join(projectRoot, 'src', 'lib', 'video', 'lyria-constants.ts'), 'utf8');
    const clientModel = (clientSrc.match(/LYRIA_MODEL_ID\s*=\s*'([^']+)'/) || [])[1];
    if (clientModel !== EXPECTED_MODEL) throw new Error(`Client model constant drifted: ${clientModel}`);
    if (mainModel !== EXPECTED_MODEL) throw new Error(`Main-process model constant drifted: ${mainModel}`);
    step(`Model constant verified on both sides: ${EXPECTED_MODEL}.`);

    // Grep-proof: the Lyria module reads NO environment variables at all.
    if (/process\.env/.test(rendererSrc)) throw new Error('lyria-renderer.js touches process.env — env keys must be structurally impossible');
    step('Grep-proof: zero process.env access in electron/lyria-renderer.js.');

    // Load the generator (installs __videoSceneCache) and clear leftover
    // lyria-raw beds so cache assertions start clean.
    {
      const ok = await electronApp.evaluate(async () => {
        try { await global.__generateSlideshowVideo({}); } catch {}
        return !!global.__videoSceneCache;
      });
      if (!ok) throw new Error('global.__videoSceneCache hook did not install');
      const snap = await electronApp.evaluate(() => global.__videoSceneCache.snapshot());
      if (snap.dir && fs.existsSync(snap.dir)) {
        let n = 0;
        for (const f of fs.readdirSync(snap.dir)) {
          if (f.startsWith('lyria-raw-')) { try { fs.unlinkSync(path.join(snap.dir, f)); n++; } catch {} }
        }
        step(`Raw-bed cache cleared (${n} leftover bed(s) removed).`);
      }
      report.cacheDir = snap.dir || null;
    }

    const runVideo = (opts) => electronApp.evaluate(
      async (_m, o) => await global.__generateSlideshowVideo(o), opts,
    );
    const mockCalls = () => electronApp.evaluate(() => global.__lyriaMock.calls);

    const SLIDES = [{
      title: 'Quarterly Planning Retreat', bullets: ['Goals', 'Budget'],
      narration: 'Welcome to the quarterly planning retreat overview.', kind: 'cover',
    }];

    // ---- 🟠 1. KEY REFUSAL (env sentinel present, no user key) -------------
    {
      const before = (await mockCalls()).length;
      const res = await runVideo({
        slides: SLIDES,
        music: { enabled: true }, // no apiKey — must NOT fall back to the env key
        useSceneCache: false,
        visuals: { mindmap: false, photo: false, videoclip: false },
        outputPath: path.join(OUT_DIR, 'refusal.mp4'),
      });
      const after = (await mockCalls()).length;
      if (!res || res.success !== true) throw new Error('Refusal probe render failed: ' + (res && res.error));
      if (!res.music || res.music.refusedNoKey !== true || res.music.applied !== false) {
        throw new Error('Keyless music run did not report refusal: ' + JSON.stringify(res.music));
      }
      if (after - before !== 0) throw new Error(`KEY-REFUSAL VIOLATION: ${after - before} Lyria call(s) with no user key (env sentinel present)`);
      step('🟠 Env-key REFUSAL proven: music with no user key made ZERO calls (env sentinel ignored); the video still completed, without music.');
    }

    // ---- 2. GENERATION: request shape + applied bed + flattened audio ------
    const genOut = path.join(OUT_DIR, 'with-music.mp4');
    {
      const before = (await mockCalls()).length;
      const res = await runVideo({
        slides: SLIDES,
        music: { enabled: true, apiKey: USER_KEY, model: EXPECTED_MODEL, mood: 'subtle' },
        useSceneCache: true,
        visuals: { mindmap: false, photo: false, videoclip: false },
        outputPath: genOut,
      });
      if (!res || res.success !== true) throw new Error('Generation probe failed: ' + (res && res.error));
      if (!res.music || res.music.apiCalls !== 1 || res.music.rawReused !== 0 || res.music.applied !== true) {
        throw new Error('Generation music accounting wrong: ' + JSON.stringify(res.music));
      }
      const calls = (await mockCalls()).slice(before);
      if (calls.length !== 1) throw new Error(`Expected exactly 1 Lyria call, saw ${calls.length}`);
      const c = calls[0];
      if (!c.url.endsWith('/v1beta/interactions') || c.method !== 'POST') throw new Error(`Bad endpoint: ${c.method} ${c.url}`);
      if (c.key !== USER_KEY) throw new Error(`KEY-ROUTING VIOLATION: call used key "${c.key}"`);
      if (c.revision !== EXPECTED_REVISION) throw new Error(`Missing/wrong Api-Revision header: ${c.revision}`);
      if (!c.body || c.body.model !== EXPECTED_MODEL) throw new Error(`Bad model in body: ${JSON.stringify(c.body && c.body.model)}`);
      if (typeof c.body.input !== 'string' || !c.body.input.includes('Instrumental only') || !c.body.input.includes('Quarterly Planning Retreat')) {
        throw new Error(`Bad prompt in body: ${String(c.body.input).slice(0, 160)}`);
      }
      if (!c.body.response_format || c.body.response_format.type !== 'audio') {
        throw new Error(`Bad response_format: ${JSON.stringify(c.body.response_format)}`);
      }
      const probe = probeMp4(genOut);
      if (probe.videoStreams !== 1 || probe.audioStreams !== 1 || !(probe.duration > 2)) {
        throw new Error(`Mixed MP4 invalid (want 1 video + 1 flattened audio stream): ${JSON.stringify(probe)}`);
      }
      report.mixedMp4 = { path: genOut, ...probe };
      step(`Request shape verified: POST /v1beta/interactions, model ${EXPECTED_MODEL}, Api-Revision ${EXPECTED_REVISION}, x-goog-api-key = user's key, instrumental prompt + audio response_format.`);
      step(`Mixed MP4 valid: narration + looped bed flattened into ONE audio stream (${probe.duration.toFixed(1)}s).`);
    }

    // ---- 3. CACHE / NO-REBILL: identical re-run reuses the raw bed ---------
    {
      const before = (await mockCalls()).length;
      const res = await runVideo({
        slides: SLIDES,
        music: { enabled: true, apiKey: USER_KEY, model: EXPECTED_MODEL, mood: 'subtle' },
        useSceneCache: true,
        visuals: { mindmap: false, photo: false, videoclip: false },
        outputPath: path.join(OUT_DIR, 'with-music-rerun.mp4'),
      });
      const after = (await mockCalls()).length;
      if (!res || res.success !== true) throw new Error('Cache re-run failed: ' + (res && res.error));
      if (!res.music || res.music.rawReused !== 1 || res.music.apiCalls !== 0 || res.music.applied !== true) {
        throw new Error('Cache re-run accounting wrong: ' + JSON.stringify(res.music));
      }
      if (after - before !== 0) throw new Error(`NO-REBILL VIOLATION: re-stitch made ${after - before} Lyria call(s)`);
      step('🟠 Raw-bed cache proven: identical re-run reused the already-paid-for bed — ZERO API calls, nothing re-billed.');
    }

    // ---- 4. MIX PRESENCE: silent narration, music vs. control --------------
    {
      // Title AND narration empty: the generator's narration falls back to the
      // title, so both must be blank to hit the true silence path.
      const silentSlides = [{ title: '', bullets: ['Quiet visual probe'], narration: '', kind: 'content' }];
      const ctlOut = path.join(OUT_DIR, 'control-no-music.mp4');
      const musOut = path.join(OUT_DIR, 'silent-plus-music.mp4');
      const ctl = await runVideo({
        slides: silentSlides, useSceneCache: false,
        visuals: { mindmap: false, photo: false, videoclip: false }, outputPath: ctlOut,
      });
      const mus = await runVideo({
        slides: silentSlides,
        music: { enabled: true, apiKey: USER_KEY },
        useSceneCache: false,
        visuals: { mindmap: false, photo: false, videoclip: false }, outputPath: musOut,
      });
      if (!ctl.success || !mus.success) throw new Error('Mix-presence probes failed to render');
      const ctlDb = meanVolumeDb(ctlOut);
      const musDb = meanVolumeDb(musOut);
      report.mixLoudness = { controlDb: ctlDb, withMusicDb: musDb };
      if (!(ctlDb < -60)) throw new Error(`Control (silent, no music) unexpectedly loud: ${ctlDb} dB`);
      if (!(musDb > ctlDb + 20)) throw new Error(`Music not audible in the mix: control ${ctlDb} dB vs with-music ${musDb} dB`);
      const p = probeMp4(musOut);
      if (p.audioStreams !== 1) throw new Error(`With-music probe has ${p.audioStreams} audio streams (want 1 flattened)`);
      step(`Mix presence proven: silent control ${ctlDb.toFixed(1)} dB vs with-music ${musDb.toFixed(1)} dB — the bed is really in the (single) audio track.`);
    }

    // ================= UI: confirm wording + key gating =====================
    page = await findMainWindow(electronApp);
    page.on('dialog', async (d) => { try { await d.dismiss(); } catch {} });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    await page.setViewportSize({ width: 1440, height: 980 });
    if (!page.url().includes('/app')) {
      await page.evaluate(() => { window.location.href = '/app'; }).catch(() => {});
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }
    // Professional mode ON + BOTH suppression flags set: the music confirm
    // must appear anyway (alwaysConfirm — real money moves on the user's key).
    savedLocal = await page.evaluate((userKey) => {
      const keys = [
        'discovery:professionalMode', 'aiDataConsent', 'idiampro-tier-id',
        'onboarding:welcomeShowcaseSeen', 'onboarding:completed',
        'apiKey_openai', 'apiKey_gemini',
        'confirm.heavyOp.videoGeneration.suppressed',
        'confirm.heavyOp.videoGenerationVeo.suppressed',
        'idiampro:video-visuals-set', 'idiampro:video-depth', 'idiampro:video-style',
        'idiampro:video-scene-style', 'idiampro:video-music', 'idiampro-video-manifests',
      ];
      const saved = {};
      for (const k of keys) saved[k] = localStorage.getItem(k);
      try {
        localStorage.setItem('discovery:professionalMode', 'true'); // must NOT bypass
        localStorage.setItem('confirm.heavyOp.videoGeneration.suppressed', 'true'); // must NOT bypass
        localStorage.setItem('confirm.heavyOp.videoGenerationVeo.suppressed', 'true');
        localStorage.setItem('aiDataConsent', 'granted');
        localStorage.setItem('idiampro-tier-id', 'pro');
        localStorage.setItem('onboarding:welcomeShowcaseSeen', 'true');
        localStorage.setItem('onboarding:completed', 'true');
        localStorage.removeItem('apiKey_openai');
        localStorage.setItem('apiKey_gemini', userKey);
        localStorage.setItem('idiampro:video-scene-style', 'slides'); // music alone must force the confirm
        localStorage.setItem('idiampro:video-music', 'subtle');
        localStorage.setItem('idiampro:video-visuals-set', JSON.stringify({ mindmap: false, photo: false, videoclip: false }));
        localStorage.setItem('idiampro:video-depth', 'overview');
        localStorage.removeItem('idiampro-video-manifests');
      } catch {}
      return saved;
    }, USER_KEY);
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

    // Small outline so the dialog has a chapter to work with.
    await newBtn.click(); await page.waitForTimeout(1500);
    await page.locator('[role="treeitem"]').first().click().catch(() => {});
    await page.waitForTimeout(400);
    for (const nm of ['Focus Rituals', 'Recovery Habits']) {
      await page.keyboard.press('Enter');
      const input = page.locator('input[type="text"]:visible').first();
      try { await input.waitFor({ state: 'visible', timeout: 4000 }); } catch {}
      await page.waitForTimeout(150); await input.fill(nm); await page.waitForTimeout(120);
      await page.keyboard.press('Enter'); await page.waitForTimeout(350);
    }
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    await page.locator('[role="treeitem"]').first().click().catch(() => {});
    await page.waitForTimeout(400);
    step('Created a small outline (2 branches).');

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
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(200);
      await page.locator('[role="treeitem"] span').first().click().catch(() => {});
      await page.waitForTimeout(500);
      await openExportMenu();
      const direct = page.locator('[role="menuitem"]:has-text("Generate Video")').first();
      if ((await direct.count().catch(() => 0)) > 0 && await direct.isVisible().catch(() => false)) {
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

    // ---- 5. Music section visible + confirm un-suppressible ----------------
    await openVideoDialog();
    const musicRow = page.locator('[data-testid="video-music-subtle"]');
    if (!(await musicRow.isVisible().catch(() => false))) throw new Error('Music "Subtle bed" option not visible with a Gemini key on file');
    await musicRow.scrollIntoViewIfNeeded().catch(() => {});
    await shot('01-config-music');
    step('Music section visible (Gemini key on file), "Subtle bed" selected from saved choice.');

    await page.locator('[role="dialog"] button', { hasText: /^Generate$/ }).first().click();
    const confirm = page.locator('[data-testid="heavy-op-confirm"]');
    try { await confirm.waitFor({ state: 'visible', timeout: 8000 }); } catch {
      throw new Error('ALWAYS-CONFIRM VIOLATION: with music ON the P2 confirm did not appear (Professional mode + suppression must not bypass it)');
    }
    const scope = (await page.locator('[data-testid="heavy-op-scope"]').textContent().catch(() => '')) || '';
    const payer = (await page.locator('[data-testid="heavy-op-payer"]').textContent().catch(() => '')) || '';
    const cost = (await page.locator('[data-testid="heavy-op-cost"]').textContent().catch(() => '')) || '';
    for (const needle of ['music bed', '5 to 10 cents per video', 'billed by Google to your key', 'Estimates only']) {
      if (!(scope + ' ' + payer + ' ' + cost).includes(needle)) {
        throw new Error(`Confirm wording missing "${needle}". scope="${scope}" payer="${payer}" cost="${cost}"`);
      }
    }
    const dontAsk = await page.locator('[data-testid="heavy-op-dont-ask"]').count().catch(() => 0);
    if (dontAsk !== 0) throw new Error('Real-money music confirm offered "Don\'t ask again" — it must not');
    report.confirmWording = { scope: scope.trim(), payer: payer.trim(), cost: cost.trim() };
    step(`🟠 Un-suppressible confirm proven with honest framing: "${scope.trim()}"`);
    await page.waitForTimeout(600);
    await shot('02-confirm-music-light');
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(400);
    await shot('03-confirm-music-dark');
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    await page.waitForTimeout(300);
    // Cancel — nothing renders, nothing bills; the generation path was already
    // proven end-to-end in the main-process probes above.
    await page.locator('[data-testid="heavy-op-cancel"]').click();
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    step('Confirm cancelled cleanly (nothing ran, nothing billed).');

    // ---- 6. Keyless gating: no Gemini key → no Music section ---------------
    await page.evaluate(() => { try { localStorage.removeItem('apiKey_gemini'); } catch {} });
    await page.reload().catch(() => {});
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(2500);
    await page.keyboard.press('Escape').catch(() => {});
    await openVideoDialog();
    const keylessCount = await page.locator('[data-testid="video-music-subtle"]').count().catch(() => 0);
    if (keylessCount !== 0) throw new Error('Music section visible WITHOUT a Gemini key — it must be hidden');
    await shot('04-config-keyless-no-music');
    step('Key gating proven: without a Gemini key the Music section does not exist.');
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);

    // ================= FINAL money-safety assertions ========================
    const net = await electronApp.evaluate(() => global.__lyriaRealNetCalls);
    report.realNetCalls = net;
    if (net.googleapis !== 0 || net.openai !== 0) {
      throw new Error(`MONEY-SAFETY VIOLATION: real network calls escaped the mock: ${JSON.stringify(net)}`);
    }
    step('🟠 Zero REAL network calls to googleapis.com / openai.com across the whole test ($0 spent — mocks only).');
    const allCalls = await mockCalls();
    if (allCalls.some((c) => c.key === ENV_SENTINEL)) throw new Error('ENV key reached a mock call');
    step('Env sentinel key appeared in ZERO calls (user BYOK key only, everywhere).');

    report.pass = true;
    console.log('PASS');
  } catch (err) {
    report.error = String((err && err.stack) || err);
    console.error('FAIL:', report.error);
    try { if (page) await shot('ERR-final'); } catch {}
  } finally {
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
