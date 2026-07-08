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

// Build the HTML for one slide (Phase 3 — professional design).
// Two layouts share one visual system:
//   • cover  — centered title + brand eyebrow + accent rule + optional agenda
//   • content — title with accent rule, refined bullet list
// Both sit on a subtle dark gradient with a faint brand-blue glow, carry a footer
// (IdiamPro wordmark + slide number), and AUTO-FIT: an inline script shrinks the
// content until it fits the safe area, so dense real-outline text never overflows.
// Brand accent is IdiamPro's iOS blue (bright variant for dark-bg readability).
function slideHtml(slide, index, total, style) {
  const isCover = slide && slide.kind === 'cover';
  const title = escapeHtml(slide.title || '');
  const bullets = (Array.isArray(slide.bullets) ? slide.bullets : []).filter(Boolean);
  const num = `${(index || 0) + 1} / ${total || 1}`;

  // --- Resolve style with safe fallbacks to the original dark / blue look. ---
  const s = style || {};
  const theme = s.theme === 'light' ? 'light' : 'dark';
  const ACCENT = (typeof s.accent === 'string' && s.accent.trim()) || '#3898ff';
  const brandLabel = typeof s.brandLabel === 'string' ? s.brandLabel.trim() : 'IdiamPro';
  const logoDataUrl = typeof s.logoDataUrl === 'string' ? s.logoDataUrl.trim() : '';
  // Free-tier taste: non-Pro renders carry a subtle "Made with IdiamPro" mark.
  // Pro renders leave this off so their videos stay fully white-labeled.
  const watermark = s.watermark === true;

  // Theme palettes. The accent glows use color-mix so they follow the chosen
  // accent (Chromium in Electron supports color-mix, so we lean on it freely).
  const isLight = theme === 'light';
  const TITLE = isLight ? '#0b1220' : '#f5f8ff';
  const BODY = isLight ? '#35485f' : '#c7d2e3';
  const MUTED = isLight ? '#7d8ea3' : '#5f7286';
  const NAME = isLight ? '#4a5c74' : '#93a4b8';
  const baseGradient = isLight
    ? 'linear-gradient(135deg, #ffffff 0%, #f3f6fb 55%, #e9eff7 100%)'
    : 'linear-gradient(135deg, #0a1120 0%, #0f1a30 55%, #0b1424 100%)';
  const glowStrong = isLight ? '13%' : '22%';
  const glowSoft = isLight ? '8%' : '10%';
  const background = `
        radial-gradient(circle at 82% 16%, color-mix(in srgb, ${ACCENT} ${glowStrong}, transparent), transparent 46%),
        radial-gradient(circle at 12% 92%, color-mix(in srgb, ${ACCENT} ${glowSoft}, transparent), transparent 44%),
        ${baseGradient}`;
  const accentLight = `color-mix(in srgb, ${ACCENT} 55%, white)`;
  const accentGlow = `color-mix(in srgb, ${ACCENT} 65%, transparent)`;

  // Footer brand: logo (if any) beside label (if any); else accent dot + label;
  // else nothing at all when neither is set.
  let brandHtml = '';
  if (logoDataUrl) {
    const labelSpan = brandLabel ? `<span class="name">${escapeHtml(brandLabel)}</span>` : '';
    brandHtml = `<div class="brand"><img class="logo" src="${logoDataUrl}" alt="" />${labelSpan}</div>`;
  } else if (brandLabel) {
    brandHtml = `<div class="brand"><span class="dot"></span><span class="name">${escapeHtml(brandLabel)}</span></div>`;
  } else {
    brandHtml = `<div class="brand"></div>`;
  }
  // Free-tier watermark: bottom-CENTER so it never collides with the user's
  // own brand (bottom-left) or the slide number (bottom-right). Small, muted
  // (reuses MUTED so it reads on dark AND light themes), with a tiny accent
  // dot — legible but understated, never garish.
  const watermarkHtml = watermark
    ? `<div class="wm"><span class="wm-dot"></span>Made with IdiamPro</div>`
    : '';
  const footerHtml = `
        <div class="footer">
          ${brandHtml}
          <div class="num">${num}</div>
        </div>
        ${watermarkHtml}`;

  const commonHead = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
    body {
      font-family: -apple-system, 'Helvetica Neue', 'Segoe UI', Arial, sans-serif;
      color: ${TITLE};
      background:${background};
      -webkit-font-smoothing: antialiased;
    }
    .stage { position: relative; width: 100%; height: 100%; }
    .footer {
      position: absolute; left: 150px; right: 150px; bottom: 66px;
      display: flex; align-items: center; justify-content: space-between;
      font-size: 30px; letter-spacing: 0.5px; color: ${MUTED};
    }
    .brand { display: flex; align-items: center; gap: 18px; font-weight: 600; min-height: 46px; }
    .brand .dot { width: 20px; height: 20px; border-radius: 50%;
      background: ${ACCENT}; box-shadow: 0 0 22px ${accentGlow}; }
    .brand .logo { max-height: 46px; width: auto; object-fit: contain; display: block; }
    .brand .name { color: ${NAME}; letter-spacing: 1px; }
    .num { font-variant-numeric: tabular-nums; color: ${MUTED}; }
    .accent-rule { width: 132px; height: 10px; border-radius: 6px;
      background: linear-gradient(90deg, ${ACCENT}, ${accentLight}); }
    .wm {
      position: absolute; left: 50%; bottom: 66px; transform: translateX(-50%);
      display: flex; align-items: center; gap: 12px; white-space: nowrap;
      font-size: 24px; font-weight: 500; letter-spacing: 0.5px;
      color: ${MUTED}; opacity: 0.72;
    }
    .wm .wm-dot { width: 12px; height: 12px; border-radius: 50%;
      background: ${ACCENT}; opacity: 0.85; }
  `;

  const bulletHtml = bullets
    .map((b) => `<li><span class="mk"></span><span class="tx">${escapeHtml(b)}</span></li>`)
    .join('');

  let body;
  if (isCover) {
    const agenda = bullets.length
      ? `<div class="agenda-label">In this video</div>
         <ul class="agenda">${bulletHtml}</ul>`
      : '';
    const eyebrow = brandLabel
      ? `<div class="eyebrow">${escapeHtml(brandLabel.toUpperCase())}</div>`
      : '';
    body = `
      <div class="stage">
        <div id="fit" class="cover">
          ${eyebrow}
          <h1>${title}</h1>
          <div class="accent-rule cover-rule"></div>
          ${agenda}
        </div>
        ${footerHtml}
      </div>`;
  } else {
    body = `
      <div class="stage">
        <div id="fit" class="content">
          <div class="accent-rule"></div>
          <h1>${title}</h1>
          <ul>${bulletHtml}</ul>
        </div>
        ${footerHtml}
      </div>`;
  }

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${commonHead}
    /* --- Content layout --- */
    .content { position: absolute; left: 150px; right: 150px; top: 150px; bottom: 170px;
      display: flex; flex-direction: column; justify-content: center; transform-origin: left center; }
    .content .accent-rule { margin-bottom: 44px; }
    .content h1 { font-size: 92px; line-height: 1.08; font-weight: 800;
      color: ${TITLE}; margin-bottom: 62px; letter-spacing: -1px; max-width: 1500px; }
    .content ul { list-style: none; }
    .content li { display: flex; align-items: flex-start; gap: 34px;
      font-size: 52px; line-height: 1.45; color: ${BODY}; margin-bottom: 34px; max-width: 1520px; }
    .content li .mk { flex: 0 0 auto; width: 20px; height: 20px; margin-top: 22px;
      border-radius: 6px; background: ${ACCENT}; box-shadow: 0 0 16px ${accentGlow}; }
    /* --- Cover layout --- */
    .cover { position: absolute; left: 150px; right: 150px; top: 150px; bottom: 170px;
      display: flex; flex-direction: column; justify-content: center; align-items: center;
      text-align: center; transform-origin: center center; }
    .cover .eyebrow { font-size: 34px; font-weight: 700; letter-spacing: 10px;
      color: ${ACCENT}; margin-bottom: 40px; }
    .cover h1 { font-size: 118px; line-height: 1.06; font-weight: 800;
      color: ${TITLE}; letter-spacing: -1.5px; max-width: 1500px; }
    .cover .cover-rule { margin: 52px auto 0; }
    .cover .agenda-label { margin-top: 60px; font-size: 32px; letter-spacing: 4px;
      text-transform: uppercase; color: ${MUTED}; }
    .cover .agenda { list-style: none; margin-top: 26px; }
    .cover .agenda li { display: flex; align-items: center; justify-content: center; gap: 24px;
      font-size: 46px; line-height: 1.5; color: ${BODY}; margin-bottom: 18px; }
    .cover .agenda li .mk { width: 16px; height: 16px; border-radius: 50%; background: ${ACCENT}; }
  </style></head><body>
    ${body}
    <script>
      // Auto-fit: shrink the content block until it fits within its box, so long
      // real-outline titles/bullets never clip. Runs before we capture the frame.
      (function () {
        var el = document.getElementById('fit');
        if (!el) return;
        var box = el.getBoundingClientRect();
        var maxH = box.height, maxW = box.width;
        var scale = 1;
        for (var i = 0; i < 24; i++) {
          if (el.scrollHeight <= maxH + 1 && el.scrollWidth <= maxW + 1) break;
          scale -= 0.06;
          if (scale < 0.4) { scale = 0.4; el.style.transform = 'scale(' + scale + ')'; break; }
          el.style.transform = 'scale(' + scale + ')';
        }
      })();
    </script>
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
async function renderSlidePng(slide, outPath, index, total, style) {
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
    const html = slideHtml(slide, index, total, style);
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

// Encode one slide (still image + audio) into an MP4 segment, with a gentle
// video fade-in at the start and fade-out at the end. On the near-black slide
// background these read as a soft dissolve between slides (replacing the Phase 1
// hard cuts) while leaving the narration audio untouched. `durationSeconds` is
// the segment length (the audio's duration); short clips get proportionally
// smaller fades so nothing fades to black over the whole slide.
async function encodeSegment(pngPath, audioPath, outPath, durationSeconds) {
  const dur = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : FALLBACK_SECONDS;
  const fade = Math.min(0.5, dur / 6); // cap fade length; shrink on short slides
  const outStart = Math.max(0, dur - fade);
  const vf = `scale=${WIDTH}:${HEIGHT},fade=t=in:st=0:d=${fade.toFixed(3)},fade=t=out:st=${outStart.toFixed(3)}:d=${fade.toFixed(3)}`;
  await run(ffmpegPath, [
    '-y',
    '-loop', '1',
    '-i', pngPath,
    '-i', audioPath,
    '-c:v', 'libx264',
    '-tune', 'stillimage',
    '-r', String(FPS),
    '-pix_fmt', 'yuv420p',
    '-t', dur.toFixed(3),
    '-vf', vf,
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
  const style = opts.style || {};

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
      await renderSlidePng(slide, pngPath, i, slides.length, style);

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

      // 3. Encode the per-slide segment (fades sized to the narration length).
      const segDuration = await probeDuration(audioPath);
      await encodeSegment(pngPath, audioPath, segPath, segDuration);
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
    slides.push({ title, bullets, narration: text, kind: i === 0 ? 'cover' : 'content' });
  }
  return slides;
}

module.exports = {
  generateSlideshowVideo,
  buildSlidesFromChapter,
};
