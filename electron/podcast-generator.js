// ============================================================================
// Podcast audio generator (Electron MAIN process) — voice parity with Video.
// ----------------------------------------------------------------------------
// Turns an array of dialogue segments ({ speaker, voice, text }) into a single
// stitched MP3, mirroring how electron/video-generator.js produces narration:
//
//   Per segment, the audio fallback chain (so a podcast is NEVER silent):
//     1. OpenAI TTS  — ONLY if an OpenAI key is available. The key is the user's
//        own BYOK key (passed from the renderer). The founder's env key is used
//        ONLY as a dev convenience on an UNPACKAGED build — never in a shipped
//        app, so a real user is never billed to the founder's key. This is the
//        premium, natural-sounding path and runs on the caller's key.
//     2. FREE macOS `say` — the built-in offline text-to-speech. Each speaker is
//        given a DISTINCT system voice, so a keyless (free) user still gets an
//        audible, two-voice back-and-forth (robotic but real). macOS only.
//     3. (segment skipped) — if neither path can produce audio, the segment is
//        dropped; the render still succeeds as long as most segments produced
//        sound (same tolerance the web TTS route uses).
//
// All segment clips are normalized to a uniform MP3 (44.1kHz stereo) and then
// concatenated into one MP3 with ffmpeg, so mixing an OpenAI clip and a `say`
// clip in the same podcast (e.g. one segment's TTS failed) still stitches cleanly.
//
// This lives in the MAIN process (native `say` + ffmpeg) exactly like the video
// generator; the Next.js /api/synthesize-podcast route stays as the web/iOS path.
// ============================================================================

const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile, execFileSync } = require('child_process');

// Whether this process is a SHIPPED/packaged app or an unpackaged dev checkout.
// This is the load-bearing money-safety gate for OpenAI TTS: the founder's
// personal env key (OPENAI_API_KEY, loaded from .env.local in dev) may be used
// as a DEVELOPER CONVENIENCE only, and ONLY when we are demonstrably running
// unpackaged on a dev machine. In a packaged build shipped to real users it is
// STRUCTURALLY IMPOSSIBLE to reach the env key — a keyless user gets the free
// macOS `say` voices instead, never a charge on the founder's key.
//
// FAIL CLOSED: if we cannot positively confirm we are unpackaged (electron not
// resolvable, app object missing), we assume PACKAGED and refuse the env key.
function isUnpackagedDevBuild() {
  try {
    // eslint-disable-next-line global-require
    const { app } = require('electron');
    return app && app.isPackaged === false;
  } catch {
    return false; // can't prove we're a dev build → treat as packaged
  }
}

const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

// Run a binary and resolve with { stdout, stderr }. Rejects on non-zero exit.
function run(bin, args) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { maxBuffer: 1024 * 1024 * 64 }, (err, stdout, stderr) => {
      if (err) {
        err.message = `${bin} failed: ${err.message}\n${stderr || ''}`;
        return reject(err);
      }
      resolve({ stdout, stderr });
    });
  });
}

// Small async sleep used for rate-limit backoff and inter-request pacing.
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms || 0)));
}

// OpenAI's TTS endpoint rejects a single request whose `input` exceeds ~4096
// characters (HTTP 400). Split long narration into sub-chunks that stay safely
// under that ceiling, preferring to break on sentence / whitespace boundaries so
// the spoken audio doesn't chop a word in half. Each returned chunk is then
// synthesized separately and the clips are concatenated back into one segment.
const TTS_MAX_INPUT = 4000;
function splitForTts(text, limit = TTS_MAX_INPUT) {
  const src = String(text || '');
  if (src.length <= limit) return [src];
  const chunks = [];
  // Break into sentence-ish pieces first, then greedily pack them into chunks.
  const pieces = src.match(/[^.!?]*[.!?]+(?:\s+|$)|[^.!?]+$/g) || [src];
  let cur = '';
  const flush = () => { if (cur.trim()) chunks.push(cur.trim()); cur = ''; };
  for (let piece of pieces) {
    // A single sentence longer than the limit: hard-split it on whitespace.
    while (piece.length > limit) {
      let cut = piece.lastIndexOf(' ', limit);
      if (cut <= 0) cut = limit;
      const head = piece.slice(0, cut);
      if ((cur + head).length > limit) flush();
      cur += head;
      flush();
      piece = piece.slice(cut);
    }
    if ((cur + piece).length > limit) flush();
    cur += piece;
  }
  flush();
  return chunks.length ? chunks : [src.slice(0, limit)];
}

// Parse a Retry-After header (either "<seconds>" or an HTTP date) into ms, or
// null if absent/unparseable.
function parseRetryAfter(headerVal) {
  if (!headerVal) return null;
  const asNum = Number(headerVal);
  if (Number.isFinite(asNum)) return Math.max(0, asNum * 1000);
  const asDate = Date.parse(headerVal);
  if (Number.isFinite(asDate)) return Math.max(0, asDate - Date.now());
  return null;
}

// One OpenAI TTS API call for a chunk of text (already under the input limit),
// with rate-limit resilience: on HTTP 429 or 5xx (or a transient network
// error) it retries with exponential backoff + jitter, honoring a Retry-After
// header when the server sends one. A 4xx that isn't 429 (e.g. bad key) fails
// immediately so the caller falls back to the free voice without wasting time.
// Returns a Buffer of MP3 bytes. Throws only after retries are exhausted.
async function ttsRequest(text, voice, model, apiKey) {
  const maxAttempts = 5;
  let lastErr = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let resp;
    try {
      resp = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model === 'tts-1-hd' ? 'tts-1-hd' : 'tts-1',
          input: text,
          voice: voice || 'alloy',
          response_format: 'mp3',
        }),
      });
    } catch (netErr) {
      // Transient network failure — retry with backoff.
      lastErr = netErr;
      if (attempt < maxAttempts - 1) {
        await sleep(Math.min(20000, 800 * 2 ** attempt) + Math.random() * 400);
        continue;
      }
      throw new Error(`OpenAI TTS network error: ${netErr && netErr.message ? netErr.message : netErr}`);
    }

    if (resp.ok) {
      return Buffer.from(await resp.arrayBuffer());
    }

    const retriable = resp.status === 429 || resp.status >= 500;
    const body = await resp.text().catch(() => '');
    lastErr = new Error(`OpenAI TTS error (${resp.status}): ${body}`);
    if (!retriable || attempt === maxAttempts - 1) {
      throw lastErr;
    }
    // Honor Retry-After if present, else exponential backoff + jitter.
    const retryAfter = parseRetryAfter(resp.headers && resp.headers.get && resp.headers.get('retry-after'));
    const backoff = retryAfter != null ? retryAfter : Math.min(20000, 800 * 2 ** attempt);
    await sleep(backoff + Math.random() * 400);
  }
  throw lastErr || new Error('OpenAI TTS failed');
}

// Synthesize one segment via OpenAI TTS (same endpoint/approach the podcast web
// route and the video generator use). Handles long text by splitting it into
// sub-chunks under the API input limit, synthesizing each, and concatenating
// them into a single MP3 at outPath. Throws on error (caller then falls back).
async function synthesizeTts(text, voice, model, apiKey, outPath, workDir, index) {
  const chunks = splitForTts(text);
  if (chunks.length === 1) {
    const buf = await ttsRequest(chunks[0], voice, model, apiKey);
    fs.writeFileSync(outPath, buf);
    return true;
  }
  // Long segment: synthesize each sub-chunk, then stitch them together.
  const dir = workDir || path.dirname(outPath);
  const idx = index == null ? Date.now() : index;
  const chunkPaths = [];
  try {
    for (let c = 0; c < chunks.length; c++) {
      const buf = await ttsRequest(chunks[c], voice, model, apiKey);
      const cp = path.join(dir, `ttsraw-${idx}-${c}.mp3`);
      fs.writeFileSync(cp, buf);
      chunkPaths.push(cp);
      // Gentle pacing between sub-chunk calls too.
      if (c < chunks.length - 1) await sleep(150);
    }
    await concatAudio(chunkPaths, outPath);
    return true;
  } finally {
    for (const cp of chunkPaths) { try { fs.unlinkSync(cp); } catch { /* ignore */ } }
  }
}

// Sanitize narration for the offline `say` engine: strip control chars,
// neutralize its [[...]] command syntax, collapse whitespace, and cap length.
// (`say` runs via execFile WITHOUT a shell and reads the text from a FILE, so
// there is no shell-injection surface; this just keeps the spoken text clean.)
function sanitizeForSay(text) {
  return String(text == null ? '' : text)
    .replace(/[ -]/g, ' ')
    .replace(/[\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000);
}

// Quality rank for a macOS voice, read straight from the name that `say -v ?`
// reports. Apple ships each modern voice in three tiers, and the higher tiers
// sound dramatically more natural (close to Siri) — they're a FREE one-time
// system download the user may or may not have installed:
//   3 = Premium, 2 = Enhanced, 1 = default/compact. We always prefer the
// highest tier that is actually installed, so a free user gets the best voice
// their machine already has without ever touching a paid API.
function voiceQualityRank(name) {
  if (/\(premium\)/i.test(name)) return 3;
  if (/\(enhanced\)/i.test(name)) return 2;
  return 1;
}

// Novelty / joke voices ("Bad News", "Bells", "Zarvox", …). These are real
// installed voices but sound like gimmicks, so we exclude them from the
// "grab any remaining voice" fallback — a free podcast should never be narrated
// by "Bubbles". Matched on the leading word of the voice name.
const NOVELTY_VOICES = new Set([
  'Albert', 'Bad', 'Bahh', 'Bells', 'Boing', 'Bubbles', 'Cellos', 'Wobble',
  'Good', 'Jester', 'Junior', 'Organ', 'Superstar', 'Ralph', 'Trinoids',
  'Whisper', 'Zarvox', 'Kathy', 'Grandma', 'Grandpa',
]);

// List the macOS `say` voices actually installed on this machine.
// Returns [{ name, locale }]. Empty array if `say` is unavailable or the parse
// fails (caller then falls back to the system default voice).
function listSayVoices() {
  try {
    const out = execFileSync('say', ['-v', '?'], { encoding: 'utf8', maxBuffer: 1 << 20 });
    const voices = [];
    for (const line of out.split('\n')) {
      // "Alex                en_US    # Most people recognize me by my voice."
      // "Ava (Premium)       en_US    # Hi, ..."  ← name keeps its quality suffix
      // Voice names can contain spaces / parentheses, so match up to the locale.
      const m = line.match(/^(.+?)\s+([a-z]{2}(?:_[A-Z]{2})?)\s+#/);
      if (m) voices.push({ name: m[1].trim(), locale: m[2] });
    }
    return voices;
  } catch {
    return [];
  }
}

// Preference lists so a spoken voice roughly matches the OpenAI voice's flavor
// (female / male / neutral). The newer, most natural-sounding voices lead each
// list so that at equal quality tier we still pick the nicest one. Assignment is
// greedy + distinct, so two speakers ALWAYS get two different system voices as
// long as >=2 usable English voices exist.
const FEMALE_PREF = ['Ava', 'Allison', 'Susan', 'Samantha', 'Serena', 'Zoe', 'Nicky', 'Joelle', 'Victoria', 'Kate', 'Karen', 'Moira', 'Tessa', 'Fiona'];
const MALE_PREF = ['Tom', 'Alex', 'Evan', 'Nathan', 'Aaron', 'Daniel', 'Oliver', 'Fred', 'Rishi', 'Gordon', 'Lee'];
const OPENAI_VOICE_GENDER = { nova: 'f', shimmer: 'f', onyx: 'm', echo: 'm', alloy: 'n', fable: 'n' };

// The leading word of a voice name ("Ava (Premium)" -> "Ava"), used both to
// match against the gender preference lists and to screen out novelty voices.
function voiceLeadWord(name) {
  return String(name).split(/[\s(]/)[0];
}

// Given the distinct OpenAI voices in use across the script, assign each one a
// DISTINCT installed macOS `say` voice, preferring the highest-quality tier
// (Premium > Enhanced > default) available for each preferred name. Returns
// { [openaiVoice]: sayVoiceName }. A value of null means "use the system
// default" (only when we genuinely run out of usable voices).
function pickSayVoices(openaiVoices) {
  const english = listSayVoices()
    .filter((v) => /^en/i.test(v.locale))
    .filter((v) => !NOVELTY_VOICES.has(voiceLeadWord(v.name)))
    .map((v) => ({ name: v.name, lead: voiceLeadWord(v.name), rank: voiceQualityRank(v.name) }));
  const used = new Set();
  const take = (prefs) => {
    // 1) Walk the gender preference list; for each preferred name choose the
    //    best-quality installed variant (e.g. "Samantha (Enhanced)" over plain
    //    "Samantha").
    for (const p of prefs) {
      const matches = english
        .filter((v) => !used.has(v.name) && v.lead === p)
        .sort((a, b) => b.rank - a.rank);
      if (matches.length) { used.add(matches[0].name); return matches[0].name; }
    }
    // 2) Otherwise take the highest-quality unused non-novelty voice.
    const rest = english.filter((v) => !used.has(v.name)).sort((a, b) => b.rank - a.rank);
    if (rest.length) { used.add(rest[0].name); return rest[0].name; }
    return null; // ran out — caller uses the default voice
  };
  const map = {};
  for (const ov of openaiVoices) {
    const g = OPENAI_VOICE_GENDER[ov] || 'n';
    const prefs = g === 'f' ? FEMALE_PREF : g === 'm' ? MALE_PREF : [...MALE_PREF, ...FEMALE_PREF];
    map[ov] = take(prefs);
  }
  return map;
}

// Pick the single best-quality installed macOS voice matching a gender flavor
// ('f' | 'm' | 'n'), for single-voice narration (e.g. video). Returns a voice
// name or null (use system default).
function pickBestSayVoice(gender) {
  const map = pickSayVoices(gender === 'f' ? ['nova'] : gender === 'm' ? ['onyx'] : ['alloy']);
  const only = Object.values(map)[0];
  return only || null;
}

// FREE offline synthesis of one segment via the macOS `say` command. Writes an
// AIFF (ffmpeg reads it natively). Text is passed via a temp FILE (`say -f`) so
// nothing in it can be misread as a CLI option. If a specific voice isn't
// installed, retries once with the default voice. Returns the AIFF path or null.
async function synthesizeLocalTts(text, sayVoice, workDir, index) {
  const clean = sanitizeForSay(text);
  if (!clean) return null;
  if (process.platform !== 'darwin') return null;
  const txtPath = path.join(workDir, `say-${index}.txt`);
  const aiffPath = path.join(workDir, `say-${index}.aiff`);
  const ok = () => fs.existsSync(aiffPath) && fs.statSync(aiffPath).size > 1000;
  try {
    fs.writeFileSync(txtPath, clean, 'utf8');
    const args = sayVoice ? ['-v', sayVoice, '-f', txtPath, '-o', aiffPath] : ['-f', txtPath, '-o', aiffPath];
    try {
      await run('say', args);
      if (ok()) return aiffPath;
    } catch (e) {
      // A named voice may not be installed — retry once with the default voice.
      if (sayVoice) {
        try {
          await run('say', ['-f', txtPath, '-o', aiffPath]);
          if (ok()) return aiffPath;
        } catch { /* fall through */ }
      }
      console.warn('[PodcastGen] macOS `say` failed:', e && e.message ? e.message : e);
    }
  } finally {
    try { fs.unlinkSync(txtPath); } catch { /* ignore */ }
  }
  return null;
}

// Re-encode any input audio (OpenAI MP3 or `say` AIFF) to a uniform MP3
// (44.1kHz stereo) so all parts share codec params and concat seamlessly.
async function normalizeToMp3(inPath, outPath) {
  await run(ffmpegPath, [
    '-y',
    '-i', inPath,
    '-ar', '44100',
    '-ac', '2',
    '-c:a', 'libmp3lame',
    '-q:a', '2',
    outPath,
  ]);
}

// Concatenate the normalized MP3 parts into one MP3 via the concat demuxer
// (re-encoded for robustness against edge-case timestamp/codec mismatches).
async function concatAudio(partPaths, outPath) {
  const listPath = path.join(path.dirname(outPath), `concat-${Date.now()}.txt`);
  const listBody = partPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(listPath, listBody);
  try {
    await run(ffmpegPath, [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-ar', '44100',
      '-ac', '2',
      '-c:a', 'libmp3lame',
      '-q:a', '2',
      outPath,
    ]);
  } finally {
    try { fs.unlinkSync(listPath); } catch { /* ignore */ }
  }
}

// Probe a media file's duration in seconds (float).
async function probeDuration(filePath) {
  const { stdout } = await run(ffprobePath, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  const d = parseFloat(String(stdout).trim());
  return Number.isFinite(d) ? d : 0;
}

/**
 * Generate a single podcast MP3 from dialogue segments.
 *
 * @param {Object} opts
 * @param {Array<{speaker?:string, voice?:string, text:string, sayVoiceOverride?:string}>} opts.segments
 *   `sayVoiceOverride` (optional, free native path only) forces a specific macOS
 *   `say` voice for that segment's speaker instead of the auto-picked one.
 * @param {string} [opts.openaiApiKey]  User's BYOK OpenAI key. The founder's env
 *   key is used only as a dev convenience on an unpackaged build, never packaged.
 * @param {'tts-1'|'tts-1-hd'} [opts.ttsModel]
 * @param {(p:{phase:string,message:string,percent:number,segmentIndex?:number,totalSegments?:number})=>void} [opts.onProgress]
 * @returns {Promise<{success:boolean, audioBase64?:string, usedTts:boolean,
 *   usedLocalVoice:boolean, failedSegments?:number, durationSeconds?:number, error?:string}>}
 */
async function generatePodcastAudio(opts) {
  const segments = Array.isArray(opts && opts.segments) ? opts.segments : [];
  if (segments.length === 0) {
    return { success: false, error: 'No segments provided.', usedTts: false, usedLocalVoice: false };
  }

  // ---- OpenAI TTS key resolution (money-safety, matches BYOK text-provider) ----
  //   a. The USER'S own BYOK OpenAI key passed from the renderer → premium
  //      voices billed to the user's own key.
  //   b. Else the founder's env key (OPENAI_API_KEY) ONLY as a dev convenience,
  //      and ONLY on an unpackaged dev build — never in a shipped app.
  //   c. Else no key at all → the free macOS `say` engine below carries the load.
  // So a PACKAGED build can NEVER bill the founder's env key for TTS.
  const userKey = (opts.openaiApiKey && String(opts.openaiApiKey).trim()) || '';
  let apiKey = userKey;
  if (!apiKey && isUnpackagedDevBuild()) {
    const envKey = process.env.OPENAI_API_KEY;
    if (typeof envKey === 'string' && envKey.trim().length > 0) apiKey = envKey.trim();
  }
  const ttsModel = opts.ttsModel === 'tts-1-hd' ? 'tts-1-hd' : 'tts-1';
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
  const report = (p) => { if (!onProgress) return; try { onProgress(p); } catch { /* never break the render */ } };

  // Distinct macOS voices for the free path — one per distinct OpenAI voice used.
  const distinctVoices = [...new Set(segments.map((s) => (s && s.voice) || 'alloy'))];
  const sayVoiceMap = process.platform === 'darwin' ? pickSayVoices(distinctVoices) : {};

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idiampro-podcast-'));
  const partPaths = [];
  let usedTts = false;
  let usedLocalVoice = false;
  let failed = 0;

  try {
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i] || {};
      const text = String(seg.text || '').trim();
      const percent = Math.round((i / segments.length) * 90);
      report({
        phase: 'tts',
        message: `Synthesizing audio (${i + 1}/${segments.length})...`,
        percent,
        segmentIndex: i,
        totalSegments: segments.length,
      });
      if (!text) continue;

      const rawPath = path.join(workDir, `raw-${i}.mp3`);
      const partPath = path.join(workDir, `part-${i}.mp3`);
      let got = false;

      // 1. Premium OpenAI TTS (user's own key, or env fallback).
      if (apiKey) {
        try {
          await synthesizeTts(text, seg.voice || 'alloy', ttsModel, apiKey, rawPath, workDir, i);
          await normalizeToMp3(rawPath, partPath);
          usedTts = true;
          got = true;
          // Pace requests so a long podcast (60+ segments) doesn't burst the
          // OpenAI rate limit; the backoff in ttsRequest handles any that slip.
          if (i < segments.length - 1) await sleep(200);
        } catch (e) {
          console.warn('[PodcastGen] OpenAI TTS failed, trying the free built-in voice:', e && e.message ? e.message : e);
        }
      }

      // 2. FREE macOS `say` with a per-speaker distinct voice. An explicit
      //    per-speaker override (from the in-app voice picker) wins; otherwise
      //    we fall back to the auto-picked best voice for this speaker. Only the
      //    free native path honors the override — the OpenAI path is untouched.
      if (!got) {
        const override = seg && typeof seg.sayVoiceOverride === 'string' ? seg.sayVoiceOverride.trim() : '';
        const sayVoice = override || sayVoiceMap[(seg.voice) || 'alloy'] || null;
        const aiff = await synthesizeLocalTts(text, sayVoice, workDir, i);
        if (aiff) {
          await normalizeToMp3(aiff, partPath);
          usedLocalVoice = true;
          got = true;
        }
      }

      // A failed segment is skipped, never fatal — the podcast keeps building
      // from every segment that DID produce audio. We only give up if ZERO
      // segments across the whole script produced any sound.
      if (!got) {
        failed++;
        console.warn(`[PodcastGen] Segment ${i + 1}/${segments.length} produced no audio; skipping it and continuing.`);
        continue;
      }
      partPaths.push(partPath);
    }

    if (partPaths.length === 0) {
      throw new Error('Could not generate any audio for this podcast. Please check your internet connection or OpenAI API key and try again.');
    }

    report({ phase: 'combining', message: 'Combining audio segments...', percent: 92 });
    const outPath = path.join(workDir, 'podcast.mp3');
    await concatAudio(partPaths, outPath);

    const audioBase64 = fs.readFileSync(outPath).toString('base64');
    const durationSeconds = await probeDuration(outPath);
    report({ phase: 'done', message: 'Podcast generated successfully!', percent: 100 });

    return { success: true, audioBase64, usedTts, usedLocalVoice, failedSegments: failed, durationSeconds };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      usedTts,
      usedLocalVoice,
    };
  } finally {
    try {
      for (const f of fs.readdirSync(workDir)) {
        try { fs.unlinkSync(path.join(workDir, f)); } catch { /* ignore */ }
      }
      fs.rmdirSync(workDir);
    } catch { /* ignore */ }
  }
}

module.exports = {
  generatePodcastAudio,
  // Shared voice helpers (also used by the video generator so both features
  // pick the same high-quality free Apple voices).
  listSayVoices,
  pickSayVoices,
  pickBestSayVoice,
  // Exposed so the main process can flag which installed voices are the "good"
  // ones (Enhanced/Premium, English, non-novelty) for the in-app voice picker.
  voiceQualityRank,
  voiceLeadWord,
  NOVELTY_VOICES,
  // Internal helpers exposed for automated testing (run in the main process).
  __test: {
    listSayVoices,
    pickSayVoices,
    pickBestSayVoice,
    voiceQualityRank,
    synthesizeLocalTts,
    normalizeToMp3,
    concatAudio,
    probeDuration,
    splitForTts,
    parseRetryAfter,
  },
};
