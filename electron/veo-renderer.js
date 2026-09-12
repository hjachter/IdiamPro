// ============================================================================
// Veo scene renderer (content-compiler Phase 3B) — REAL-video generation as an
// ALTERNATIVE per-scene renderer for the slideshow video pipeline.
// ----------------------------------------------------------------------------
// Given one scene's slide material, this module asks Google's Veo model (via
// the user's OWN Gemini API key) for a short cinematic clip, which the caller
// (electron/video-generator.js) then composites behind the scene's text
// overlay exactly like the existing public-domain video-clip path.
//
// 🟠 MONEY RULES (non-negotiable, stricter than TTS):
//   * Veo bills REAL DOLLARS per generation, on the USER'S OWN Gemini key.
//   * The key MUST be passed in from the renderer (BYOK). This module NEVER
//     reads environment variables — there is NO dev-environment fallback AT
//     ALL, on packaged and unpackaged builds alike. (Unlike the TTS dev
//     convenience: a silent env fallback here could bill the founder real
//     dollars.) Grep-proof: no environment-variable access appears anywhere
//     in this file, and tests/veo-renderer-test.js asserts it.
//   * No key → the request is REFUSED with a clear error; the caller falls
//     back to the free slide renderer for that scene. Never a silent bill.
//   * Every Veo run is gated by the P2 heavy-op confirm in the dialog BEFORE
//     the generator is invoked — this module has no UI and trusts that gate,
//     but the key rule above means even a mis-wired call can only ever bill
//     a key the user explicitly stored themselves.
//
// RAW-CLIP CACHE: the generated Veo clip (pre-compositing) is cached on disk
// keyed by (model + prompt). The finished composited scene is ALSO cached by
// video-generator.js under engine 'veo' — two layers, so an unchanged scene
// NEVER re-bills, and even a narration-voice change (which invalidates the
// composited scene) reuses the already-paid-for raw clip.
//
// API SHAPE (verified against https://ai.google.dev/gemini-api/docs/veo,
// 2026-09; ENDPOINT CONSTANTS below are the single place to update if Google
// revises the surface — re-verify before the one-time LIVE smoke test):
//   POST {BASE}/models/{model}:predictLongRunning
//        headers: x-goog-api-key, Content-Type: application/json
//        body: { instances: [{ prompt }], parameters: { aspectRatio,
//               resolution, durationSeconds } }
//        → { name: "operations/..." }
//   GET  {BASE}/{operationName}  (same key header)
//        → { done, response: { generateVideoResponse:
//               { generatedSamples: [{ video: { uri } }] } } }
//   GET  {uri}  (same key header) → MP4 bytes.
// Pricing (Google, 2026-09): Veo 3.1 Fast ≈ $0.15/second, Standard ≈ $0.40/s;
// 8-second clips ⇒ roughly $1.20/scene on Fast. The UI words this as a
// "typically…" range only — never an exact promise.
//
// TESTING: all HTTP goes through veoFetch(), which prefers the test seam
// global.__veoTestFetch when installed (mirrors the house test-hook style:
// global.__videoSceneCache, global.__podcastClipCache). Tests mock at this
// HTTP boundary and MUST NEVER call the real Veo API.
// ============================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── ENDPOINT CONSTANTS (marked clearly — update here if Google changes) ─────
const VEO_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
// Default model: the FAST variant — same 8s cinematic clips at roughly a
// third of the standard model's per-second price. Honest default for a
// per-scene pipeline that may run many scenes.
const VEO_DEFAULT_MODEL = 'veo-3.1-fast-generate-preview';
// Docs allow 4 | 6 | 8 seconds; we always ask for the max so the clip loops
// less under long narration. (Docs show the value as a number; if the live
// API rejects it, the string form "8" is the documented alternative.)
const VEO_CLIP_SECONDS = 8;
const VEO_ASPECT_RATIO = '16:9';
const VEO_RESOLUTION = '720p'; // composited under 1080p text; 720p is the
                               // cheapest tier and upscales cleanly as a
                               // full-bleed background
const VEO_POLL_INTERVAL_MS = 5000;   // docs: 11s min latency, up to ~6 min
const VEO_MAX_WAIT_MS = 6.5 * 60 * 1000;
const VEO_MIN_CLIP_BYTES = 20 * 1024;          // reject empty/error bodies
const VEO_MAX_CLIP_BYTES = 120 * 1024 * 1024;  // reject implausibly large

// ── Key resolution — USER key only, hard refusal of anything else ───────────
// Returns the trimmed user-supplied key, or null. This is the ONLY key path
// for Veo. By construction (no env access anywhere in this module) a missing
// user key can never fall through to a developer/company key.
function resolveVeoUserKey(userApiKey) {
  if (typeof userApiKey !== 'string') return null;
  const k = userApiKey.trim();
  return k.length > 0 ? k : null;
}

// ── HTTP seam (mockable boundary for tests) ─────────────────────────────────
function veoFetch(url, opts) {
  const impl =
    (typeof global !== 'undefined' && typeof global.__veoTestFetch === 'function')
      ? global.__veoTestFetch
      : fetch;
  return impl(url, opts);
}

// fetch with a hard timeout so a stuck request can't hang the render forever.
async function veoFetchWithTimeout(url, opts, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await veoFetch(url, { ...(opts || {}), signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// ── Prompt building ─────────────────────────────────────────────────────────
// Turn one scene's outline material into a short cinematic prompt. The text
// itself is painted by OUR overlay (crisp, branded, legible) — the Veo clip
// is the moving backdrop — so we ask for imagery, not on-screen text.
function buildVeoScenePrompt(slide) {
  const title = String((slide && slide.title) || '').trim();
  const bullets = (Array.isArray(slide && slide.bullets) ? slide.bullets : [])
    .filter(Boolean)
    .slice(0, 5)
    .map((b) => String(b).trim())
    .filter(Boolean);
  const isCover = !!(slide && slide.kind === 'cover');
  const parts = [
    `Cinematic, professional b-roll footage evoking the theme: "${title}".`,
  ];
  if (bullets.length) {
    parts.push(`Related ideas: ${bullets.join('; ')}.`);
  }
  parts.push(
    isCover
      ? 'Establishing shot mood: sweeping, elegant, optimistic opening imagery.'
      : 'Smooth slow camera movement, soft natural light, shallow depth of field.',
    'Photorealistic, high production value, calm pacing.',
    'No on-screen text, no captions, no words, no logos, no watermarks.',
  );
  // Veo prompts cap at ~1,024 tokens; stay far under it.
  return parts.join(' ').slice(0, 1800);
}

// ── Raw-clip cache (per model + prompt — the "never re-bill" layer) ─────────
function rawClipCacheKey(model, prompt) {
  return crypto
    .createHash('sha1')
    .update(['veo-raw', 'v1', String(model), String(prompt)].join('|'))
    .digest('hex');
}

function rawClipCachePath(cacheDir, key) {
  return path.join(cacheDir, `veo-raw-${key}.mp4`);
}

function readRawClipFromCache(cacheDir, key, outPath) {
  try {
    const p = rawClipCachePath(cacheDir, key);
    const st = fs.statSync(p);
    if (!st.isFile() || st.size < VEO_MIN_CLIP_BYTES) return false;
    fs.copyFileSync(p, outPath);
    try { const now = new Date(); fs.utimesSync(p, now, now); } catch { /* LRU touch only */ }
    return true;
  } catch {
    return false;
  }
}

function writeRawClipToCache(cacheDir, key, clipPath) {
  try {
    fs.copyFileSync(clipPath, rawClipCachePath(cacheDir, key));
  } catch { /* cache write failure is never fatal */ }
}

// ── The Veo generation call (start → poll → download) ───────────────────────
async function generateVeoClip({ prompt, apiKey, model, outPath }) {
  const key = resolveVeoUserKey(apiKey);
  if (!key) {
    // REFUSAL, not fallback-to-env: Veo only ever runs on the user's own key.
    throw new Error(
      'AI video needs your own Google AI key (none was provided). ' +
      'The app never uses a built-in or developer key for AI video.',
    );
  }
  const mdl = (typeof model === 'string' && model.trim()) || VEO_DEFAULT_MODEL;

  // 1. Start the long-running generation.
  const startResp = await veoFetchWithTimeout(
    `${VEO_API_BASE}/models/${mdl}:predictLongRunning`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: String(prompt || '') }],
        parameters: {
          aspectRatio: VEO_ASPECT_RATIO,
          resolution: VEO_RESOLUTION,
          durationSeconds: VEO_CLIP_SECONDS,
        },
      }),
    },
    30000,
  );
  if (!startResp.ok) {
    const body = await startResp.text().catch(() => '');
    throw new Error(`Veo generation could not start (HTTP ${startResp.status}): ${String(body).slice(0, 300)}`);
  }
  const startData = await startResp.json();
  const opName = startData && startData.name;
  if (!opName || typeof opName !== 'string') {
    throw new Error('Veo generation returned no operation name.');
  }

  // 2. Poll the operation until done (or our deadline).
  const deadline = Date.now() + VEO_MAX_WAIT_MS;
  let opData = null;
  for (;;) {
    const pollResp = await veoFetchWithTimeout(
      `${VEO_API_BASE}/${opName}`,
      { method: 'GET', headers: { 'x-goog-api-key': key } },
      30000,
    );
    if (!pollResp.ok) {
      const body = await pollResp.text().catch(() => '');
      throw new Error(`Veo status check failed (HTTP ${pollResp.status}): ${String(body).slice(0, 300)}`);
    }
    opData = await pollResp.json();
    if (opData && opData.done) break;
    if (Date.now() > deadline) {
      throw new Error('Veo generation timed out (no result within the wait window).');
    }
    await new Promise((r) => setTimeout(r, VEO_POLL_INTERVAL_MS));
  }
  if (opData.error) {
    const msg = (opData.error && opData.error.message) || JSON.stringify(opData.error);
    throw new Error(`Veo generation failed: ${String(msg).slice(0, 300)}`);
  }
  const samples =
    opData.response &&
    opData.response.generateVideoResponse &&
    Array.isArray(opData.response.generateVideoResponse.generatedSamples)
      ? opData.response.generateVideoResponse.generatedSamples
      : [];
  const uri = samples[0] && samples[0].video && samples[0].video.uri;
  if (!uri || typeof uri !== 'string') {
    throw new Error('Veo generation finished but returned no video.');
  }

  // 3. Download the clip bytes (key header required per docs).
  const dlResp = await veoFetchWithTimeout(
    uri,
    { method: 'GET', headers: { 'x-goog-api-key': key } },
    120000,
  );
  if (!dlResp.ok) {
    throw new Error(`Veo clip download failed (HTTP ${dlResp.status}).`);
  }
  const buf = Buffer.from(await dlResp.arrayBuffer());
  if (buf.length < VEO_MIN_CLIP_BYTES || buf.length > VEO_MAX_CLIP_BYTES) {
    throw new Error(`Veo clip has an implausible size (${buf.length} bytes).`);
  }
  fs.writeFileSync(outPath, buf);
  return outPath;
}

/**
 * Get the Veo clip for one scene: raw-clip cache first (an already-paid-for
 * generation for the same model+prompt is NEVER re-billed), then a real
 * generation on the user's own key. Throws on any failure — the caller
 * falls back to the free slide renderer for that scene.
 *
 * @param {Object} a
 * @param {Object}  a.slide        The scene's slide (title/bullets/narration/kind).
 * @param {string}  a.apiKey       The USER's Gemini key (BYOK; required).
 * @param {string} [a.model]       Veo model id (default VEO_DEFAULT_MODEL).
 * @param {string}  a.workDir      Where to write the clip file.
 * @param {number}  a.index        Scene index (file naming only).
 * @param {string|null} [a.cacheDir]  Raw-clip cache dir (null = no cache).
 * @param {boolean} [a.allowCacheRead=true]  false on "Start Fresh" (honest
 *        full regeneration — the confirm priced every scene).
 * @param {{apiCalls:number, rawReused:number}} [a.stats]  Mutated accounting.
 * @returns {Promise<string>} path to the scene's Veo clip.
 */
async function getVeoSceneClip(a) {
  const { slide, apiKey, workDir, index, cacheDir, stats } = a;
  const model = (typeof a.model === 'string' && a.model.trim()) || VEO_DEFAULT_MODEL;
  const allowCacheRead = a.allowCacheRead !== false;
  const prompt = buildVeoScenePrompt(slide);
  const outPath = path.join(workDir, `veo-scene-${index}.mp4`);
  const cacheKey = rawClipCacheKey(model, prompt);

  if (cacheDir && allowCacheRead && readRawClipFromCache(cacheDir, cacheKey, outPath)) {
    if (stats) stats.rawReused = (stats.rawReused || 0) + 1;
    return outPath;
  }

  if (stats) stats.apiCalls = (stats.apiCalls || 0) + 1;
  await generateVeoClip({ prompt, apiKey, model, outPath });
  if (cacheDir) writeRawClipToCache(cacheDir, cacheKey, outPath);
  return outPath;
}

module.exports = {
  VEO_DEFAULT_MODEL,
  VEO_CLIP_SECONDS,
  resolveVeoUserKey,
  buildVeoScenePrompt,
  getVeoSceneClip,
  // Internal pieces exposed for automated testing ONLY (mocked HTTP boundary).
  __test: {
    VEO_API_BASE,
    generateVeoClip,
    rawClipCacheKey,
  },
};
