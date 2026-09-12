// ============================================================================
// Veo renderer test (content-compiler Phase 3B) — FULLY MOCKED, $0, own Electron
// ----------------------------------------------------------------------------
// 🟠 THIS TEST MUST NEVER CALL THE REAL VEO API. All Veo HTTP goes through the
// global.__veoTestFetch seam in electron/veo-renderer.js; a mock installed in
// the Electron MAIN process answers every request and records it. A separate
// spy on the REAL fetch asserts zero calls ever reached googleapis.com or
// openai.com. The env var GEMINI_API_KEY is deliberately set to a SENTINEL in
// the launch env to prove the Veo path REFUSES environment keys.
//
// What it proves:
//   1. REQUEST SHAPE + MODEL: predictLongRunning URL carries the exact model
//      constant (matching src/lib/video/veo-constants.ts), the body has
//      instances[0].prompt + parameters (aspectRatio/resolution/duration),
//      and the key travels in the x-goog-api-key header.
//   2. KEY ROUTING: every mock call used the USER's BYOK key from the
//      renderer; the env sentinel key appears in ZERO calls; a direct
//      main-process run with Veo enabled but NO user key is REFUSED (zero
//      calls, honest per-scene fallback) despite the env key being present.
//   3. CONFIRM: the P2 heavy-op confirm shows the REAL-dollar framing
//      ("typically about $1 to $2 per scene… billed by Google to your key…
//      Estimates only") + scene counts — and appears EVEN with Professional
//      mode ON and a suppression flag set (alwaysConfirm), with no
//      "Don't ask again" offered. Screenshots in light AND dark.
//   4. CACHE / NO-REBILL: an Update-Changed run with nothing edited issues
//      ZERO mock API calls; after a one-node edit, the mock is called ONLY
//      for the changed scenes (2 of 4: the edited branch + the cover agenda),
//      with the unchanged scenes' wording ("not billed again") in the confirm.
//   5. FALLBACK: one scene's generation mock-fails → that scene falls back to
//      the slide renderer, the final MP4 still assembles (ffprobe-valid), and
//      the completion note names the fallback scene.
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
const OUT_DIR = path.join(projectRoot, 'test-screenshots', 'veo-renderer');
fs.mkdirSync(OUT_DIR, { recursive: true });

const ENV_SENTINEL = 'ENV-KEY-MUST-NEVER-BE-USED';
const USER_KEY = 'TEST-USER-GEMINI-KEY';
const EXPECTED_MODEL = 'veo-3.1-fast-generate-preview';

let electronApp, page;
const report = { suite: 'veo-renderer', startedAt: new Date().toISOString(), steps: [], pass: false };

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
    `# Veo Renderer Test (Phase 3B) — ${report.pass ? 'PASS' : 'FAIL'}`,
    '',
    'Fully mocked at the HTTP boundary — the real Veo API is NEVER called ($0).',
    'Request shape, user-key-only routing (env key refused), real-dollar confirm',
    'wording, zero-rebill cache behavior, and per-scene slide fallback.',
    '',
    '## Steps',
    ...report.steps.map((s) => `- ${s}`),
    '',
    report.error ? `## Error\n\n\`\`\`\n${report.error}\n\`\`\`\n` : '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), md);
}

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

// Build a small real MP4 the mock "download" serves (must exceed the
// renderer's 20 KB minimum, so use the moving testsrc pattern).
function buildMockClip() {
  const ffmpegPath = require(path.join(projectRoot, 'node_modules', 'ffmpeg-static'));
  const p = path.join(OUT_DIR, 'mock-veo-clip.mp4');
  execFileSync(ffmpegPath, [
    '-y', '-f', 'lavfi', '-i', 'testsrc=duration=4:size=640x360:rate=30',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', p,
  ], { stdio: 'ignore' });
  const size = fs.statSync(p).size;
  if (size < 25 * 1024) throw new Error(`mock clip too small (${size} bytes)`);
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

    const mockClipPath = buildMockClip();
    const mockClipB64 = fs.readFileSync(mockClipPath).toString('base64');
    step(`Mock Veo clip built (${Math.round(mockClipB64.length * 0.75 / 1024)} KB).`);

    console.log('Launching Electron (own instance)...');
    electronApp = await electron.launch({
      args: [projectRoot],
      // 🟠 The env DELIBERATELY carries a Gemini sentinel key: the Veo path
      // must refuse it. OpenAI key absent so narration uses the free voice.
      env: { ...process.env, NODE_ENV: 'development', OPENAI_API_KEY: '', GEMINI_API_KEY: ENV_SENTINEL },
    });

    // Install (a) a REAL-fetch spy proving no Veo/OpenAI network traffic, and
    // (b) the __veoTestFetch mock at the renderer's HTTP boundary.
    await electronApp.evaluate((_m, args) => {
      delete process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = '';
      if (!global.__veoSpyInstalled) {
        const realFetch = global.fetch;
        global.__realNetCalls = { googleapis: 0, openai: 0 };
        global.fetch = (url, opts) => {
          try {
            const u = String(url).toLowerCase();
            if (u.includes('googleapis.com')) global.__realNetCalls.googleapis++;
            if (u.includes('openai.com')) global.__realNetCalls.openai++;
          } catch {}
          return realFetch(url, opts);
        };
        global.__veoSpyInstalled = true;
      }
      global.__veoMock = { calls: [], failNeedle: null, clipB64: args.clipB64 };
      global.__veoTestFetch = async (url, opts) => {
        const u = String(url);
        const rec = {
          url: u,
          method: (opts && opts.method) || 'GET',
          key: (opts && opts.headers && opts.headers['x-goog-api-key']) || null,
          body: null,
        };
        if (opts && typeof opts.body === 'string') { try { rec.body = JSON.parse(opts.body); } catch {} }
        global.__veoMock.calls.push(rec);
        const mk = (obj, ok = true, status = 200) => ({
          ok, status,
          json: async () => obj,
          text: async () => JSON.stringify(obj),
          arrayBuffer: async () => {
            const b = Buffer.from(global.__veoMock.clipB64, 'base64');
            return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
          },
        });
        if (u.includes(':predictLongRunning')) {
          const prompt = (rec.body && rec.body.instances && rec.body.instances[0] && rec.body.instances[0].prompt) || '';
          if (global.__veoMock.failNeedle && prompt.includes(global.__veoMock.failNeedle)) {
            return mk({ error: { message: 'mock injected generation failure' } }, false, 500);
          }
          return mk({ name: `operations/veo-mock-${global.__veoMock.calls.length}` });
        }
        if (u.includes('/operations/veo-mock-')) {
          return mk({
            done: true,
            response: { generateVideoResponse: { generatedSamples: [{ video: { uri: 'https://veo-mock.invalid/clip.mp4' } }] } },
          });
        }
        if (u.includes('veo-mock.invalid')) return mk({});
        return mk({ error: { message: 'unexpected url ' + u } }, false, 404);
      };
    }, { clipB64: mockClipB64 });
    step('Mock installed at the HTTP boundary + real-fetch spy armed ($0 guaranteed).');

    // Model constant must match the client-side constant file exactly.
    const mainModel = await electronApp.evaluate(() => {
      try {
        const p = require('path');
        return require(p.join(process.cwd(), 'electron', 'veo-renderer.js')).VEO_DEFAULT_MODEL;
      } catch { return null; }
    }).catch(() => null);
    const clientSrc = fs.readFileSync(path.join(projectRoot, 'src', 'lib', 'video', 'veo-constants.ts'), 'utf8');
    const clientModel = (clientSrc.match(/VEO_MODEL_ID\s*=\s*'([^']+)'/) || [])[1];
    if (clientModel !== EXPECTED_MODEL) throw new Error(`Client model constant drifted: ${clientModel}`);
    if (mainModel && mainModel !== EXPECTED_MODEL) throw new Error(`Main-process model constant drifted: ${mainModel}`);
    step(`Model constant verified on both sides: ${EXPECTED_MODEL}.`);

    // Load the video-generator module (installs __videoSceneCache) and start
    // from an EMPTY scene cache (composited scenes AND veo-raw clips).
    {
      const ok = await electronApp.evaluate(async () => {
        try { await global.__generateSlideshowVideo({}); } catch {}
        return !!global.__videoSceneCache;
      });
      if (!ok) throw new Error('global.__videoSceneCache hook did not install');
      const pre = await electronApp.evaluate(() => global.__videoSceneCache.snapshot());
      if (pre.dir) {
        for (const f of Object.keys(pre.files)) { try { fs.unlinkSync(path.join(pre.dir, f)); } catch {} }
        step(`Scene cache cleared (${Object.keys(pre.files).length} leftover clip(s) removed).`);
      }
    }

    // ---- 🟠 DIRECT MAIN-PROCESS ENV-REFUSAL PROOF (before any UI runs) ----
    // Veo enabled, NO user key passed, env sentinel present: the run must
    // REFUSE Veo (zero mock calls), fall back per-scene, and still succeed.
    {
      const before = await electronApp.evaluate(() => global.__veoMock.calls.length);
      const res = await electronApp.evaluate(async () => {
        return await global.__generateSlideshowVideo({
          slides: [{ title: 'Env refusal probe', bullets: ['a'], narration: 'Testing.', kind: 'content' }],
          veo: { enabled: true }, // no apiKey — must NOT fall back to the env key
          useSceneCache: false,
          visuals: { mindmap: false, photo: false, videoclip: false },
        });
      });
      const after = await electronApp.evaluate(() => global.__veoMock.calls.length);
      if (!res || res.success !== true) throw new Error('Env-refusal probe render failed: ' + (res && res.error));
      if (!res.veo || res.veo.refusedNoKey !== true) throw new Error('Keyless Veo run did not report refusedNoKey: ' + JSON.stringify(res.veo));
      if (!Array.isArray(res.veo.fellBack) || res.veo.fellBack.indexOf(0) === -1) throw new Error('Keyless Veo scene did not fall back: ' + JSON.stringify(res.veo));
      if (after - before !== 0) throw new Error(`KEY-REFUSAL VIOLATION: ${after - before} Veo call(s) happened with no user key (env sentinel present)`);
      step('🟠 Env-key REFUSAL proven: Veo with no user key made ZERO calls (env sentinel ignored), scene fell back, video still completed.');
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
    // localStorage setup: the user's OWN Gemini BYOK key, Veo scene style,
    // pro tier, visuals off, Overview depth — and, deliberately, Professional
    // mode ON plus the Veo suppression flag SET, to prove the real-dollar
    // confirm can NEVER be bypassed (alwaysConfirm).
    savedLocal = await page.evaluate((userKey) => {
      const keys = [
        'discovery:professionalMode', 'aiDataConsent', 'idiampro-tier-id',
        'onboarding:welcomeShowcaseSeen', 'onboarding:completed',
        'apiKey_openai', 'apiKey_gemini',
        'confirm.heavyOp.videoGeneration.suppressed',
        'confirm.heavyOp.videoGenerationVeo.suppressed',
        'idiampro:video-visuals-set', 'idiampro:video-depth', 'idiampro:video-style',
        'idiampro:video-scene-style', 'idiampro-video-manifests',
      ];
      const saved = {};
      for (const k of keys) saved[k] = localStorage.getItem(k);
      try {
        localStorage.setItem('discovery:professionalMode', 'true'); // must NOT bypass the Veo confirm
        localStorage.setItem('confirm.heavyOp.videoGenerationVeo.suppressed', 'true'); // must NOT bypass either
        localStorage.setItem('aiDataConsent', 'granted');
        localStorage.setItem('idiampro-tier-id', 'pro');
        localStorage.setItem('onboarding:welcomeShowcaseSeen', 'true');
        localStorage.setItem('onboarding:completed', 'true');
        localStorage.removeItem('apiKey_openai');
        localStorage.setItem('apiKey_gemini', userKey);
        localStorage.setItem('idiampro:video-scene-style', 'veo');
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

    // Approve the Veo P2 confirm, asserting the honest dollar framing.
    const approveVeoConfirm = async (mustContain, shotNames) => {
      const confirm = page.locator('[data-testid="heavy-op-confirm"]');
      try { await confirm.waitFor({ state: 'visible', timeout: 8000 }); } catch {
        throw new Error('ALWAYS-CONFIRM VIOLATION: the Veo P2 confirm did not appear (it must, even with Professional mode + suppression set)');
      }
      const scope = (await page.locator('[data-testid="heavy-op-scope"]').textContent().catch(() => '')) || '';
      const payer = (await page.locator('[data-testid="heavy-op-payer"]').textContent().catch(() => '')) || '';
      const cost = (await page.locator('[data-testid="heavy-op-cost"]').textContent().catch(() => '')) || '';
      for (const needle of mustContain) {
        if (!(scope + ' ' + payer + ' ' + cost).includes(needle)) {
          throw new Error(`Confirm wording missing "${needle}". scope="${scope}" payer="${payer}" cost="${cost}"`);
        }
      }
      // No "Don't ask again" on real-dollar confirms.
      const dontAsk = await page.locator('[data-testid="heavy-op-dont-ask"]').count().catch(() => 0);
      if (dontAsk !== 0) throw new Error('Real-dollar Veo confirm offered "Don\'t ask again" — it must not');
      report.confirmWording = report.confirmWording || [];
      report.confirmWording.push({ scope: scope.trim(), payer: payer.trim(), cost: cost.trim() });
      step(`Veo confirm shown. Scope: "${scope.trim()}"`);
      if (shotNames) {
        await page.waitForTimeout(700); // let the dialog's fade-in fully settle
        await shot(shotNames[0]);
        await page.evaluate(() => document.documentElement.classList.add('dark'));
        await page.waitForTimeout(400);
        await shot(shotNames[1]);
        await page.evaluate(() => document.documentElement.classList.remove('dark'));
        await page.waitForTimeout(300);
      }
      await page.locator('[data-testid="heavy-op-run"]').click();
      await page.waitForTimeout(400);
    };

    const waitForDone = async () => {
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
        veo: window.__videoVeoStats || null,
      }));
    };

    const readManifest = async () => page.evaluate(() => {
      try {
        const store = JSON.parse(localStorage.getItem('idiampro-video-manifests') || '{}');
        const entries = Object.values(store).sort((a, b) => b.compiledAt - a.compiledAt);
        return entries[0] || null;
      } catch { return null; }
    });

    const mockCalls = async () => electronApp.evaluate(() => global.__veoMock.calls.map((c) => ({
      url: c.url, method: c.method, key: c.key,
      prompt: (c.body && c.body.instances && c.body.instances[0] && c.body.instances[0].prompt) || null,
      params: (c.body && c.body.parameters) || null,
    })));
    const predictCalls = (calls) => calls.filter((c) => c.url.includes(':predictLongRunning'));

    // ================= RUN 1 — first generation (4 Veo scenes) ==============
    await openVideoDialog();
    // The scene-style choice is visible and Veo is selected + enabled.
    const veoRow = page.locator('[data-testid="scene-style-veo"]');
    if (!(await veoRow.isVisible().catch(() => false))) throw new Error('Cinematic AI video option not visible in the dialog');
    await shot('01-config-veo');
    await page.locator('[role="dialog"] button', { hasText: /^Generate$/ }).first().click();
    await approveVeoConfirm(
      ['4 scenes', 'typically about $1 to $2 per scene', 'billed by Google to your key', 'Estimates only', 'your Google AI key'],
      ['02-confirm-fresh-light', '03-confirm-fresh-dark'],
    );
    const run1 = await waitForDone();
    report.run1 = run1;
    await shot('04-done-first');
    if (!run1.stats || run1.stats.reused !== 0 || run1.stats.generated !== 4) {
      throw new Error(`Run 1 expected 0 reused / 4 generated, got ${JSON.stringify(run1.stats)}`);
    }
    if (!run1.veo || run1.veo.requested !== 4 || run1.veo.apiCalls !== 4 || run1.veo.rawReused !== 0 || run1.veo.fellBack.length !== 0) {
      throw new Error(`Run 1 Veo accounting wrong: ${JSON.stringify(run1.veo)}`);
    }
    step(`Run 1: 4 Veo scenes generated (${JSON.stringify(run1.veo)}).`);

    const calls1 = await mockCalls();
    const preds1 = predictCalls(calls1);
    if (preds1.length !== 4) throw new Error(`Expected 4 generation starts, saw ${preds1.length}`);
    for (const c of calls1) {
      if (c.key !== USER_KEY) throw new Error(`KEY-ROUTING VIOLATION: a Veo call used key "${c.key}" (expected the user's BYOK key)`);
      if (c.key === ENV_SENTINEL) throw new Error('KEY-ROUTING VIOLATION: the ENV key reached a Veo call');
    }
    for (const c of preds1) {
      if (!c.url.includes(`/v1beta/models/${EXPECTED_MODEL}:predictLongRunning`)) throw new Error(`Bad predictLongRunning URL: ${c.url}`);
      if (!c.prompt || typeof c.prompt !== 'string' || c.prompt.length < 20) throw new Error(`Bad prompt in request: ${c.prompt}`);
      if (!c.params || c.params.aspectRatio !== '16:9' || String(c.params.durationSeconds) !== '8' || c.params.resolution !== '720p') {
        throw new Error(`Bad parameters in request: ${JSON.stringify(c.params)}`);
      }
    }
    step(`Request shape verified on all 4 calls: model ${EXPECTED_MODEL}, x-goog-api-key = user's key only, instances[0].prompt + 16:9/720p/8s parameters.`);

    const manifest1 = await readManifest();
    if (!manifest1 || !Array.isArray(manifest1.scenes) || manifest1.scenes.length !== 4) {
      throw new Error('Manifest missing/short after run 1');
    }
    for (const s of manifest1.scenes) {
      if (s.engine !== 'veo') throw new Error(`Veo scene recorded wrong engine: ${s.engine}`);
      if (!s.clipKey) throw new Error(`Veo scene ${s.index} missing clipKey`);
    }
    const mp41 = probeMp4(manifest1.outputPath);
    if (!mp41.hasVideo || !mp41.hasAudio || !(mp41.duration > 2)) throw new Error(`Run 1 MP4 invalid: ${JSON.stringify(mp41)}`);
    report.mp4Run1 = { path: manifest1.outputPath, ...mp41 };
    step(`Run 1 MP4 valid (${mp41.duration.toFixed(1)}s, video+audio); manifest scenes all engine 'veo'.`);

    await page.keyboard.press('Escape'); await page.waitForTimeout(600);
    await page.keyboard.press('Escape'); await page.waitForTimeout(600);

    // ============ RUN 2 — Update Changed, NOTHING edited: zero calls ========
    await openVideoDialog();
    const prevBox = page.locator('[data-testid="video-previous-version"]');
    if ((await prevBox.count().catch(() => 0)) === 0) throw new Error('Previous-version box missing on run 2');
    const callsBefore2 = (await mockCalls()).length;
    await page.locator('[data-testid="video-update-changed"]').click();
    await approveVeoConfirm(
      ['Nothing has changed', 'already generated', 'bills nothing new'],
      null,
    );
    const run2 = await waitForDone();
    report.run2 = run2;
    if (!run2.stats || run2.stats.reused !== 4 || run2.stats.generated !== 0) {
      throw new Error(`Run 2 expected 4 reused / 0 generated, got ${JSON.stringify(run2.stats)}`);
    }
    const callsAfter2 = (await mockCalls()).length;
    if (callsAfter2 - callsBefore2 !== 0) {
      throw new Error(`NO-REBILL VIOLATION: unchanged rerun made ${callsAfter2 - callsBefore2} API call(s)`);
    }
    step('🟠 Run 2 (nothing changed): all 4 scenes reused — ZERO mock API calls, nothing re-billed.');

    await page.keyboard.press('Escape'); await page.waitForTimeout(600);
    await page.keyboard.press('Escape'); await page.waitForTimeout(600);

    // ============ RUN 3 — edit ONE node → Update Changed: 2 scoped calls ====
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
    step(`Renamed branch 3 → "${renamed}" (changes that scene AND the cover agenda).`);

    await openVideoDialog();
    if ((await prevBox.count().catch(() => 0)) === 0) throw new Error('Previous-version box missing on run 3');
    const callsBefore3 = (await mockCalls()).length;
    await page.locator('[data-testid="video-update-changed"]').click();
    await approveVeoConfirm(
      ['Updating 2 of 4 scenes', 'typically about $1 to $2 per scene', 'billed by Google to your key', 'Estimates only',
       '2 scenes unchanged — already generated, not billed again'],
      ['05-confirm-update-light', '06-confirm-update-dark'],
    );
    const run3 = await waitForDone();
    report.run3 = run3;
    if (!run3.stats || run3.stats.reused !== 2 || run3.stats.generated !== 2) {
      throw new Error(`Run 3 expected 2 reused / 2 generated, got ${JSON.stringify(run3.stats)}`);
    }
    const calls3 = await mockCalls();
    const newPreds3 = predictCalls(calls3.slice(callsBefore3));
    if (newPreds3.length !== 2) {
      throw new Error(`SCOPED-BILLING VIOLATION: expected exactly 2 generation calls for the changed scenes, saw ${newPreds3.length}`);
    }
    for (const c of newPreds3) {
      if (c.key !== USER_KEY) throw new Error(`KEY-ROUTING VIOLATION in run 3: "${c.key}"`);
      if (c.prompt && (c.prompt.includes('theme: "Morning Routines"') || c.prompt.includes('theme: "Deep Work Habits"'))) {
        throw new Error(`Unchanged scene was re-generated: ${c.prompt.slice(0, 120)}`);
      }
    }
    if (!newPreds3.some((c) => c.prompt && c.prompt.includes(renamed))) {
      throw new Error('The renamed scene was not among the regenerated calls');
    }
    step('🟠 Run 3: only the 2 CHANGED scenes hit the API (renamed branch + cover); unchanged scenes made zero calls.');

    await page.keyboard.press('Escape'); await page.waitForTimeout(600);
    await page.keyboard.press('Escape'); await page.waitForTimeout(600);

    // ============ RUN 4 — one scene mock-fails → slide fallback =============
    await electronApp.evaluate(() => { global.__veoMock.failNeedle = 'evoking the theme: "Weekend'; });
    await openVideoDialog();
    await page.locator('[data-testid="video-start-fresh"]').click();
    await approveVeoConfirm(['4 scenes', 'billed by Google to your key', 'Estimates only'], null);
    const run4 = await waitForDone();
    report.run4 = run4;
    await shot('07-done-fallback');
    if (!run4.veo || !Array.isArray(run4.veo.fellBack) || run4.veo.fellBack.length !== 1) {
      throw new Error(`Run 4 expected exactly 1 fallback scene, got ${JSON.stringify(run4.veo)}`);
    }
    const fbNote = await page.locator('[data-testid="video-veo-fallback-note"]').textContent().catch(() => '');
    if (!fbNote || !/designed-slide look/.test(fbNote) || !new RegExp(`Scene ${run4.veo.fellBack[0] + 1}`).test(fbNote)) {
      throw new Error(`Fallback completion note missing/wrong: "${fbNote}"`);
    }
    step(`Run 4: injected failure → scene ${run4.veo.fellBack[0] + 1} fell back to the slide look; note shown: "${(fbNote || '').trim()}"`);
    const manifest4 = await readManifest();
    const mp44 = probeMp4(manifest4.outputPath);
    if (!mp44.hasVideo || !mp44.hasAudio || !(mp44.duration > 2)) throw new Error(`Run 4 MP4 invalid: ${JSON.stringify(mp44)}`);
    report.mp4Run4 = { path: manifest4.outputPath, ...mp44 };
    step(`Run 4 MP4 valid despite the failed scene (${mp44.duration.toFixed(1)}s) — the video always completes.`);
    await electronApp.evaluate(() => { global.__veoMock.failNeedle = null; });

    // ================= FINAL money-safety assertions ========================
    const net = await electronApp.evaluate(() => global.__realNetCalls);
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
    try { await shot('ERR-final'); } catch {}
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
