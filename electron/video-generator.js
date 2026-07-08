// ============================================================================
// Faceless slideshow video generator (Phase 1 — desktop/Electron core pipeline)
// ----------------------------------------------------------------------------
// Turns a small array of slides (title + bullet lines + narration text) into a
// stitched MP4 with an AI voiceover track. Runs entirely in the Electron MAIN
// process (native ffmpeg + file I/O), NOT in Next.js/Vercel serverless.
//
// Pipeline: for each slide ->
//   1. render an HTML/CSS slide to a 1920x1080 PNG (offscreen BrowserWindow)
//   2. synthesize narration audio (OpenAI TTS, reused approach) OR silent audio
//   3. encode a per-slide MP4 segment (image shown for the narration duration)
// then concat all segments into one final MP4 on disk.
//
// This is intentionally ROUGH (Phase 1): plain text on a solid background,
// hard cuts between slides, no fades. Design/polish/UI/Pro-gating come later.
// ============================================================================

const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');

const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
const FALLBACK_SECONDS = 4; // silent-slide duration when no TTS is available

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Build the HTML for one slide. Plain text on a solid dark background — Phase 1.
function slideHtml(slide) {
  const title = escapeHtml(slide.title || '');
  const bullets = Array.isArray(slide.bullets) ? slide.bullets : [];
  const bulletHtml = bullets
    .map((b) => `<li>${escapeHtml(b)}</li>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
    body {
      background: #0f172a;
      color: #f8fafc;
      font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
      display: flex; flex-direction: column; justify-content: center;
      padding: 140px 160px;
    }
    h1 {
      font-size: 96px; line-height: 1.1; font-weight: 800;
      color: #ffffff; margin-bottom: 60px;
      border-left: 16px solid #6366f1; padding-left: 40px;
    }
    ul { list-style: none; }
    li {
      font-size: 56px; line-height: 1.5; color: #cbd5e1;
      margin-bottom: 32px; padding-left: 60px; position: relative;
    }
    li::before {
      content: ''; position: absolute; left: 0; top: 28px;
      width: 22px; height: 22px; border-radius: 50%; background: #6366f1;
    }
  </style></head><body>
    <h1>${title}</h1>
    <ul>${bulletHtml}</ul>
  </body></html>`;
}

// Wait for the next real composited frame of THIS offscreen window and return it
// as a PNG buffer. We rely on the offscreen 'paint' stream (each frame it emits
// belongs to this specific window's webContents) instead of a blind-timeout
// capturePage(). A timed capturePage can hand back a stale buffer from a
// previously-rendered slide — the defect that made every slide come out looking
// like slide 1. Falls back to capturePage() only if no paint arrives in time.
function grabFreshFrame(win, getLatestFrame, { timeoutMs = 4000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const tick = async () => {
      const frame = getLatestFrame();
      if (frame) {
        const png = frame.toPNG();
        if (png && png.length >= 1000) return resolve(png);
      }
      if (Date.now() > deadline) {
        try {
          const image = await win.webContents.capturePage();
          return resolve(image ? image.toPNG() : null);
        } catch {
          return resolve(null);
        }
      }
      setTimeout(tick, 50);
    };
    tick();
  });
}

// Render one slide to a PNG file using an offscreen BrowserWindow capture.
async function renderSlidePng(slide, outPath) {
  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    show: false,
    frame: false,
    webPreferences: {
      offscreen: true,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  // Capture the freshest composited frame this window emits. Because each 'paint'
  // image is tied to this window's webContents, we can never accidentally save a
  // different slide's stale frame.
  let latestFrame = null;
  const onPaint = (_event, _dirty, image) => { latestFrame = image; };
  try {
    win.webContents.on('paint', onPaint);
    win.webContents.setFrameRate(30);
    const html = slideHtml(slide);
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    // Let webfonts + layout settle so the title/bullets are actually drawn before
    // we grab a frame (two rAFs guarantees a post-layout paint has been scheduled).
    await win.webContents
      .executeJavaScript(
        'new Promise((res) => { const go = () => requestAnimationFrame(() => requestAnimationFrame(() => res(true)));' +
          '(document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(go); })'
      )
      .catch(() => {});
    // Discard any pre-content frame so we wait for a paint of the settled slide.
    latestFrame = null;
    const png = await grabFreshFrame(win, () => latestFrame);
    if (!png || png.length < 1000) {
      throw new Error('Slide capture produced an empty image');
    }
    fs.writeFileSync(outPath, png);
  } finally {
    try { win.webContents.removeListener('paint', onPaint); } catch { /* ignore */ }
    win.destroy();
  }
}

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

// Synthesize narration audio via OpenAI TTS (same endpoint/approach the podcast
// feature uses). Returns true on success, false if it could not run.
async function synthesizeTts(text, voice, apiKey, outPath) {
  const resp = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice: voice || 'nova',
      response_format: 'mp3',
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`OpenAI TTS error (${resp.status}): ${body}`);
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(outPath, buf);
  return true;
}

// Generate a silent MP3 of a fixed length (fallback when TTS is unavailable).
async function synthesizeSilence(seconds, outPath) {
  await run(ffmpegPath, [
    '-y',
    '-f', 'lavfi',
    '-i', `anullsrc=r=44100:cl=stereo`,
    '-t', String(seconds),
    '-q:a', '9',
    outPath,
  ]);
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

// Encode one slide (still image + audio) into an MP4 segment.
async function encodeSegment(pngPath, audioPath, outPath) {
  await run(ffmpegPath, [
    '-y',
    '-loop', '1',
    '-i', pngPath,
    '-i', audioPath,
    '-c:v', 'libx264',
    '-tune', 'stillimage',
    '-r', String(FPS),
    '-pix_fmt', 'yuv420p',
    '-vf', `scale=${WIDTH}:${HEIGHT}`,
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ar', '44100',
    '-shortest',
    outPath,
  ]);
}

// Concatenate segment MP4s into the final video via the concat demuxer.
async function concatSegments(segmentPaths, outPath) {
  const listPath = path.join(path.dirname(outPath), `concat-${Date.now()}.txt`);
  const listBody = segmentPaths
    .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
    .join('\n');
  fs.writeFileSync(listPath, listBody);
  try {
    // Re-encode on concat for maximum robustness (segments already share params,
    // but re-encoding avoids edge-case timestamp/codec mismatches).
    await run(ffmpegPath, [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-r', String(FPS),
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '44100',
      outPath,
    ]);
  } finally {
    try { fs.unlinkSync(listPath); } catch { /* ignore */ }
  }
}

/**
 * Generate a faceless slideshow MP4 from a small array of slides.
 *
 * @param {Object} opts
 * @param {Array<{title:string,bullets:string[],narration:string}>} opts.slides
 * @param {string} [opts.outputPath]      Where to write the final MP4.
 * @param {string} [opts.openaiApiKey]    OpenAI key for TTS (falls back to env).
 * @param {string} [opts.voice]           OpenAI TTS voice (default 'nova').
 * @returns {Promise<{success:boolean, outputPath?:string, durationSeconds?:number,
 *                     fileSizeBytes?:number, usedTts:boolean, slideCount:number,
 *                     error?:string}>}
 */
async function generateSlideshowVideo(opts) {
  const slides = Array.isArray(opts && opts.slides) ? opts.slides : [];
  if (slides.length === 0) {
    return { success: false, error: 'No slides provided.', usedTts: false, slideCount: 0 };
  }

  const apiKey = (opts.openaiApiKey && String(opts.openaiApiKey).trim()) || process.env.OPENAI_API_KEY || '';
  const voice = opts.voice || 'nova';

  // Working directory for intermediate files.
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idiampro-video-'));

  // Default output location: ~/Documents/IdiamPro Videos/
  let outputPath = opts.outputPath;
  if (!outputPath) {
    const outDir = path.join(os.homedir(), 'Documents', 'IdiamPro Videos');
    fs.mkdirSync(outDir, { recursive: true });
    outputPath = path.join(outDir, `idiampro-video-${Date.now()}.mp4`);
  } else {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  }

  let usedTts = false;
  const segmentPaths = [];

  try {
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const pngPath = path.join(workDir, `slide-${i}.png`);
      const audioPath = path.join(workDir, `audio-${i}.mp3`);
      const segPath = path.join(workDir, `segment-${i}.mp4`);

      // 1. Render slide image.
      await renderSlidePng(slide, pngPath);

      // 2. Narration audio (TTS if we can, else fixed-length silence).
      const narration = (slide.narration || slide.title || '').trim();
      let gotAudio = false;
      if (apiKey && narration) {
        try {
          await synthesizeTts(narration, voice, apiKey, audioPath);
          usedTts = true;
          gotAudio = true;
        } catch (ttsErr) {
          console.warn('[VideoGen] TTS failed, using silent fallback:', ttsErr.message);
        }
      }
      if (!gotAudio) {
        // Length roughly proportional to narration so silent videos still pace.
        const words = narration ? narration.split(/\s+/).length : 0;
        const seconds = Math.max(FALLBACK_SECONDS, Math.round(words / 2.5));
        await synthesizeSilence(seconds, audioPath);
      }

      // 3. Encode the per-slide segment.
      await encodeSegment(pngPath, audioPath, segPath);
      segmentPaths.push(segPath);
    }

    // Stitch everything together.
    await concatSegments(segmentPaths, outputPath);

    const durationSeconds = await probeDuration(outputPath);
    const fileSizeBytes = fs.statSync(outputPath).size;

    return {
      success: true,
      outputPath,
      durationSeconds,
      fileSizeBytes,
      usedTts,
      slideCount: slides.length,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      usedTts,
      slideCount: slides.length,
    };
  } finally {
    // Best-effort cleanup of intermediate files.
    try {
      for (const f of fs.readdirSync(workDir)) {
        try { fs.unlinkSync(path.join(workDir, f)); } catch { /* ignore */ }
      }
      fs.rmdirSync(workDir);
    } catch { /* ignore */ }
  }
}

/**
 * Convenience helper: turn a chapter (title + narration paragraphs) into a
 * simple slide array. Phase 1 mapping is deliberately dumb — one slide per
 * paragraph, first line as the title, the rest as bullets, the whole paragraph
 * as narration. Real chapter->slide shaping comes in a later phase.
 */
function buildSlidesFromChapter(chapterName, paragraphs) {
  const slides = [];
  const paras = Array.isArray(paragraphs) ? paragraphs : [];
  for (let i = 0; i < paras.length; i++) {
    const text = String(paras[i] || '').trim();
    if (!text) continue;
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const title = i === 0 ? chapterName : (lines[0] || `${chapterName} (${i + 1})`);
    const bullets = lines.slice(i === 0 ? 0 : 1).slice(0, 4);
    slides.push({ title, bullets, narration: text });
  }
  return slides;
}

module.exports = {
  generateSlideshowVideo,
  buildSlidesFromChapter,
};
