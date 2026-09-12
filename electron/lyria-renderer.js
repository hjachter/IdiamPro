// ============================================================================
// Lyria music-bed renderer (content-compiler Phase 3C) — an OPTIONAL
// AI-generated instrumental bed mixed under the video's narration.
// ----------------------------------------------------------------------------
// Given the video's chapter title + a mood, this module asks Google's Lyria
// model (via the user's OWN Gemini API key) for one short instrumental music
// clip, which the caller (electron/video-generator.js) loops and duck-mixes
// under the narration at the final assemble step. One clip per video.
//
// 🟠 MONEY RULES (non-negotiable — the exact Veo discipline, see
// electron/veo-renderer.js):
//   * Lyria bills REAL MONEY per generation, on the USER'S OWN Gemini key.
//   * The key MUST be passed in from the renderer (BYOK). This module NEVER
//     reads environment variables — there is NO dev-environment fallback AT
//     ALL, on packaged and unpackaged builds alike. Grep-proof: no
//     environment-variable access appears anywhere in this file, and
//     tests/lyria-renderer-test.js asserts it.
//   * No key → the request is REFUSED with a clear error; the caller simply
//     finishes the video WITHOUT music. Never a silent bill.
//   * Every music run is gated by the P2 heavy-op confirm in the dialog
//     BEFORE the generator is invoked (un-suppressible whenever music is on).
//     This module has no UI and trusts that gate, but the key rule above
//     means even a mis-wired call can only ever bill a key the user
//     explicitly stored themselves.
//
// RAW-BED CACHE: the generated clip is cached on disk keyed by
// (model + prompt + duration), so a RE-STITCH of the same video (Update
// Changed, narration-voice change, scene edits) reuses the already-paid-for
// bed and NEVER re-bills. "Start Fresh" honestly regenerates (the confirm
// priced it).
//
// API SHAPE (verified against ai.google.dev/gemini-api/docs/music-generation
// + /interactions/music-generation, 2026-09; ENDPOINT CONSTANTS below are the
// single place to update if Google revises the surface — re-verify before the
// one-time LIVE smoke test):
//   POST {BASE}/interactions
//        headers: x-goog-api-key, Content-Type: application/json,
//                 Api-Revision: 2026-05-20
//        body: { model, input: "<prompt>", response_format: { type: "audio" } }
//        → SYNCHRONOUS interaction object; the clip arrives as base64 audio,
//          either as a top-level `output_audio` convenience field or inside
//          steps[].content[] blocks with type "audio" (data / audio.data).
//   Output: 44.1 kHz stereo MP3; the clip model is a fixed 30 seconds.
// Pricing (Google, ai.google.dev/gemini-api/docs/pricing, 2026-09):
//   lyria-3-clip-preview ≈ $0.04 per generated clip; lyria-3.5 full song
//   ≈ $0.08. We use the CLIP model — one 30s bed, looped under the video —
//   so a video's music is typically about a nickel. The UI words this as a
//   "typically…" range only — never an exact promise.
//
// TESTING: all HTTP goes through lyriaFetch(), which prefers the test seam
// global.__lyriaTestFetch when installed (mirrors global.__veoTestFetch).
// Tests mock at this HTTP boundary and MUST NEVER call the real Lyria API.
// ============================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── ENDPOINT CONSTANTS (marked clearly — update here if Google changes) ─────
const LYRIA_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const LYRIA_INTERACTIONS_URL = `${LYRIA_API_BASE}/interactions`;
// The Interactions API requires a dated revision header (per Google's docs).
const LYRIA_API_REVISION = '2026-05-20';
// Default model: the 30-second CLIP tier — the cheapest generation (~$0.04)
// and exactly right for a looping background bed (the full-song model would
// double the price for length we'd loop anyway).
const LYRIA_DEFAULT_MODEL = 'lyria-3-clip-preview';
// The clip model's duration is FIXED at 30 seconds (not configurable). Kept
// as an explicit constant because it is part of the cache identity.
const LYRIA_BED_SECONDS = 30;
const LYRIA_REQUEST_TIMEOUT_MS = 3 * 60 * 1000; // synchronous call; generous
const LYRIA_MIN_BED_BYTES = 30 * 1024;          // reject empty/error bodies
const LYRIA_MAX_BED_BYTES = 40 * 1024 * 1024;   // reject implausibly large

// ── Key resolution — USER key only, hard refusal of anything else ───────────
// Returns the trimmed user-supplied key, or null. This is the ONLY key path
// for Lyria. By construction (no env access anywhere in this module) a
// missing user key can never fall through to a developer/company key.
function resolveLyriaUserKey(userApiKey) {
  if (typeof userApiKey !== 'string') return null;
  const k = userApiKey.trim();
  return k.length > 0 ? k : null;
}

// ── HTTP seam (mockable boundary for tests) ─────────────────────────────────
function lyriaFetch(url, opts) {
  const impl =
    (typeof global !== 'undefined' && typeof global.__lyriaTestFetch === 'function')
      ? global.__lyriaTestFetch
      : fetch;
  return impl(url, opts);
}

async function lyriaFetchWithTimeout(url, opts, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await lyriaFetch(url, { ...(opts || {}), signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// ── Prompt building ─────────────────────────────────────────────────────────
// One bed per video, themed by the chapter title. Instrumental-only is
// requested EXPLICITLY (per the docs, vocals are prompt-controlled) — a sung
// lyric under narration would be unusable. Moods are a small curated set so
// the cache identity stays stable ('subtle' is the only mood the UI offers
// today; the parameter exists so later moods slot in without reshaping).
const LYRIA_MOODS = {
  subtle: 'Soft, understated ambient background music. Gentle warm pads, ' +
    'light piano, slow tempo, calm and unobtrusive — designed to sit quietly ' +
    'under a spoken voice.',
};

function buildLyriaMusicPrompt({ title, mood } = {}) {
  const moodKey = typeof mood === 'string' && LYRIA_MOODS[mood] ? mood : 'subtle';
  const theme = String(title || '').trim().slice(0, 200);
  const parts = [
    'Instrumental only, no vocals, no singing, no spoken words.',
    LYRIA_MOODS[moodKey],
  ];
  if (theme) parts.push(`Evoking the theme: "${theme}".`);
  parts.push('Smooth seamless feel suitable for looping. No sudden loud moments.');
  return parts.join(' ');
}

// ── Raw-bed cache (model + prompt + duration — the "never re-bill" layer) ───
function rawBedCacheKey(model, prompt, durationSeconds) {
  return crypto
    .createHash('sha1')
    .update(['lyria-raw', 'v1', String(model), String(prompt), String(durationSeconds)].join('|'))
    .digest('hex');
}

function rawBedCachePath(cacheDir, key) {
  return path.join(cacheDir, `lyria-raw-${key}.mp3`);
}

function readRawBedFromCache(cacheDir, key, outPath) {
  try {
    const p = rawBedCachePath(cacheDir, key);
    const st = fs.statSync(p);
    if (!st.isFile() || st.size < LYRIA_MIN_BED_BYTES) return false;
    fs.copyFileSync(p, outPath);
    try { const now = new Date(); fs.utimesSync(p, now, now); } catch { /* LRU touch only */ }
    return true;
  } catch {
    return false;
  }
}

function writeRawBedToCache(cacheDir, key, bedPath) {
  try {
    fs.copyFileSync(bedPath, rawBedCachePath(cacheDir, key));
  } catch { /* cache write failure is never fatal */ }
}

// ── Response parsing ────────────────────────────────────────────────────────
// The interaction's audio arrives as base64. Docs show a convenience
// `output_audio` field; the raw steps schema carries content blocks with
// type "audio". Accept both shapes (and a couple of defensive nestings) so a
// minor serialization difference can't break the feature.
function extractAudioBase64(data) {
  if (!data || typeof data !== 'object') return null;
  if (typeof data.output_audio === 'string' && data.output_audio.length > 0) {
    return data.output_audio;
  }
  const steps = Array.isArray(data.steps) ? data.steps : [];
  for (const s of steps) {
    const content = Array.isArray(s && s.content) ? s.content : [];
    for (const block of content) {
      if (!block || block.type !== 'audio') continue;
      if (typeof block.data === 'string' && block.data.length > 0) return block.data;
      if (block.audio && typeof block.audio.data === 'string' && block.audio.data.length > 0) {
        return block.audio.data;
      }
    }
  }
  return null;
}

// ── The Lyria generation call (single synchronous request) ──────────────────
async function generateLyriaBed({ prompt, apiKey, model, outPath }) {
  const key = resolveLyriaUserKey(apiKey);
  if (!key) {
    // REFUSAL, not fallback-to-env: Lyria only ever runs on the user's own key.
    throw new Error(
      'AI music needs your own Google AI key (none was provided). ' +
      'The app never uses a built-in or developer key for AI music.',
    );
  }
  const mdl = (typeof model === 'string' && model.trim()) || LYRIA_DEFAULT_MODEL;

  const resp = await lyriaFetchWithTimeout(
    LYRIA_INTERACTIONS_URL,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': key,
        'Content-Type': 'application/json',
        'Api-Revision': LYRIA_API_REVISION,
      },
      body: JSON.stringify({
        model: mdl,
        input: String(prompt || ''),
        response_format: { type: 'audio' },
      }),
    },
    LYRIA_REQUEST_TIMEOUT_MS,
  );
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Music generation could not start (HTTP ${resp.status}): ${String(body).slice(0, 300)}`);
  }
  const data = await resp.json();
  const b64 = extractAudioBase64(data);
  if (!b64) {
    throw new Error('Music generation finished but returned no audio.');
  }
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < LYRIA_MIN_BED_BYTES || buf.length > LYRIA_MAX_BED_BYTES) {
    throw new Error(`Music clip has an implausible size (${buf.length} bytes).`);
  }
  fs.writeFileSync(outPath, buf);
  return outPath;
}

/**
 * Get the music bed for a video: raw-bed cache first (an already-paid-for
 * generation for the same model+prompt+duration is NEVER re-billed), then a
 * real generation on the user's own key. Throws on any failure — the caller
 * finishes the video without music (an enhancement must never break a render).
 *
 * @param {Object} a
 * @param {string}  a.title        The video's chapter title (themes the music).
 * @param {string} [a.mood]        Mood key (default 'subtle').
 * @param {string}  a.apiKey       The USER's Gemini key (BYOK; required).
 * @param {string} [a.model]       Lyria model id (default LYRIA_DEFAULT_MODEL).
 * @param {string}  a.workDir      Where to write the bed file.
 * @param {string|null} [a.cacheDir]  Raw-bed cache dir (null = no cache).
 * @param {boolean} [a.allowCacheRead=true]  false on "Start Fresh" (honest
 *        full regeneration — the confirm priced the music too).
 * @param {{apiCalls:number, rawReused:number}} [a.stats]  Mutated accounting.
 * @returns {Promise<string>} path to the video's music-bed MP3.
 */
async function getLyriaMusicBed(a) {
  const { title, mood, apiKey, workDir, cacheDir, stats } = a;
  const model = (typeof a.model === 'string' && a.model.trim()) || LYRIA_DEFAULT_MODEL;
  const allowCacheRead = a.allowCacheRead !== false;
  const prompt = buildLyriaMusicPrompt({ title, mood });
  const outPath = path.join(workDir, 'lyria-music-bed.mp3');
  const cacheKey = rawBedCacheKey(model, prompt, LYRIA_BED_SECONDS);

  if (cacheDir && allowCacheRead && readRawBedFromCache(cacheDir, cacheKey, outPath)) {
    if (stats) stats.rawReused = (stats.rawReused || 0) + 1;
    return outPath;
  }

  if (stats) stats.apiCalls = (stats.apiCalls || 0) + 1;
  await generateLyriaBed({ prompt, apiKey, model, outPath });
  if (cacheDir) writeRawBedToCache(cacheDir, cacheKey, outPath);
  return outPath;
}

module.exports = {
  LYRIA_DEFAULT_MODEL,
  LYRIA_BED_SECONDS,
  resolveLyriaUserKey,
  buildLyriaMusicPrompt,
  getLyriaMusicBed,
  // Internal pieces exposed for automated testing ONLY (mocked HTTP boundary).
  __test: {
    LYRIA_API_BASE,
    LYRIA_INTERACTIONS_URL,
    LYRIA_API_REVISION,
    generateLyriaBed,
    rawBedCacheKey,
    extractAudioBase64,
  },
};
