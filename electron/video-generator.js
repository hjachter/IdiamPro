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
const { pathToFileURL } = require('url');

// Resolve the bundled Mermaid browser build (a self-contained ~3MB UMD file that
// sets globalThis.mermaid). Cached after the first lookup. Used to render a
// slide's mind map to an SVG inside an offscreen window (slide visuals — Phase A).
let __mermaidJsPath = null;
function mermaidJsPath() {
  if (__mermaidJsPath) return __mermaidJsPath;
  try {
    __mermaidJsPath = require.resolve('mermaid/dist/mermaid.min.js');
  } catch {
    const pkg = require.resolve('mermaid/package.json');
    __mermaidJsPath = path.join(path.dirname(pkg), 'dist', 'mermaid.min.js');
  }
  return __mermaidJsPath;
}

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

// ============================================================================
// Stock photos (slide visuals — Phase B). FREE + license-clean ONLY.
// ----------------------------------------------------------------------------
// We pull a relevant photo per slide from the Openverse API — keyless for basic
// use — and FILTER to CC0 + Public Domain Mark (`license=cc0,pdm`), so every
// image is free for commercial use with NO attribution required and NO per-image
// charge. The fetch runs on the user's own machine (Electron main process), not
// a server we pay for. For each image we record source/creator/license and write
// an "image-credits.txt" beside the MP4 (good practice even when not required).
//
// ROBUSTNESS: short per-request timeout + a couple of retries; results are cached
// per query (including misses) so we never hammer the API. If an image can't be
// fetched (offline, rate-limited, no match), the slide gracefully falls back to
// its mind-map or text-only layout — a failed image NEVER breaks a slide.
// ============================================================================
const OPENVERSE_ENDPOINT = 'https://api.openverse.org/v1/images/';
const OV_USER_AGENT = 'IdiamPro/1.0 (slideshow slide illustrations; https://secondbrainware.com)';
const IMG_TIMEOUT_MS = 9000;
const IMG_MAX_BYTES = 14 * 1024 * 1024; // skip anything implausibly large
const IMG_MIN_BYTES = 1500;             // skip empty/error bodies

// Words that add noise to an image search (outline titles are often phrased as
// tasks/notes). Trimming them yields more photogenic results.
const QUERY_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'your',
  'my', 'our', 'their', 'this', 'that', 'these', 'those', 'is', 'are', 'be',
  'how', 'why', 'what', 'when', 'about', 'via', 'per', 'vs', 'notes', 'note',
]);

// Turn a slide title (plus a hint word from its first bullet) into a compact,
// photogenic search query. Strips punctuation + stopwords, caps the length.
function buildImageQuery(title, bullets) {
  const clean = (s) => String(s || '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  let words = clean(title).split(' ').filter((w) => w && !QUERY_STOPWORDS.has(w.toLowerCase()));
  // If the title is very short, borrow a keyword or two from the first bullet.
  if (words.length < 2 && Array.isArray(bullets) && bullets[0]) {
    const extra = clean(bullets[0]).split(' ').filter((w) => w && !QUERY_STOPWORDS.has(w.toLowerCase()));
    words = words.concat(extra);
  }
  if (words.length === 0) words = clean(title).split(' ').filter(Boolean); // last resort: keep stopwords
  return words.slice(0, 6).join(' ').trim();
}

// fetch() with an AbortController timeout (Electron main has global fetch).
async function fetchWithTimeout(url, opts, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...(opts || {}), signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// Query Openverse for CC0/PDM, landscape-ish images. Returns the results array.
async function openverseSearch(query) {
  const params = new URLSearchParams({
    q: query,
    license: 'cc0,pdm',      // CC0 + Public Domain Mark: free commercial, no attribution
    aspect_ratio: 'wide',    // prefer landscape for 16:9 slides
    size: 'medium',
    mature: 'false',
    page_size: '8',
  });
  const resp = await fetchWithTimeout(
    `${OPENVERSE_ENDPOINT}?${params.toString()}`,
    { headers: { 'User-Agent': OV_USER_AGENT, Accept: 'application/json' } },
    IMG_TIMEOUT_MS,
  );
  if (!resp.ok) throw new Error(`Openverse search HTTP ${resp.status}`);
  const data = await resp.json();
  return Array.isArray(data.results) ? data.results : [];
}

// Download an image URL to bytes, verifying it's actually an image of sane size.
async function downloadImageBytes(url) {
  const resp = await fetchWithTimeout(url, { headers: { 'User-Agent': OV_USER_AGENT } }, IMG_TIMEOUT_MS);
  if (!resp.ok) throw new Error(`image HTTP ${resp.status}`);
  const ct = (resp.headers.get('content-type') || '').toLowerCase();
  if (!/^image\//.test(ct)) throw new Error(`not an image (${ct || 'no content-type'})`);
  const buf = Buffer.from(await resp.arrayBuffer());
  if (buf.length < IMG_MIN_BYTES || buf.length > IMG_MAX_BYTES) throw new Error(`image size ${buf.length}`);
  const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('gif') ? 'gif' : 'jpg';
  return { buf, ext };
}

// Fetch a photo for a query, save it into workDir, and return
// { fileUrl, credit } — or null on any failure (caller falls back gracefully).
// Cached per query (misses included) so repeated queries never refetch.
async function fetchSlidePhoto(query, workDir, cache) {
  const q = String(query || '').trim();
  if (!q) return null;
  if (cache.has(q)) return cache.get(q);

  let out = null;
  for (let attempt = 0; attempt < 2 && !out; attempt++) {
    try {
      const results = await openverseSearch(q);
      for (const r of results) {
        const src = r.url || r.thumbnail; // prefer full image, fall back to thumbnail
        if (!src) continue;
        try {
          const { buf, ext } = await downloadImageBytes(src);
          const safe = q.replace(/[^a-z0-9]+/gi, '-').slice(0, 40) || 'img';
          const filePath = path.join(workDir, `photo-${safe}-${attempt}.${ext}`);
          fs.writeFileSync(filePath, buf);
          out = {
            fileUrl: pathToFileURL(filePath).href,
            credit: {
              query: q,
              title: r.title || '(untitled)',
              creator: r.creator || 'Unknown',
              license: `${(r.license || 'cc0').toUpperCase()}${r.license_version ? ` ${r.license_version}` : ''}`.trim(),
              licenseUrl: r.license_url || '',
              source: r.foreign_landing_url || r.url || src,
              provider: r.source || r.provider || 'Openverse',
            },
          };
          break;
        } catch {
          /* try the next result */
        }
      }
    } catch (e) {
      // Search failed (offline / rate-limited): brief backoff, then one retry.
      console.warn('[VideoGen] Openverse fetch failed:', e && e.message ? e.message : e);
      await new Promise((r) => setTimeout(r, 450));
    }
  }
  cache.set(q, out); // cache misses too, so we don't retry the same dead query
  return out;
}

// Write image-credits.txt beside the finished MP4. Attribution isn't required
// for CC0/PDM, but recording provenance is good practice (and reassures users
// the images are license-clean). Best-effort: never throws into the render.
function writeImageCredits(outputPath, credits) {
  if (!Array.isArray(credits) || credits.length === 0) return;
  try {
    const lines = [
      `Image credits — ${path.basename(outputPath)}`,
      `Generated by IdiamPro on ${new Date().toISOString()}`,
      '',
      'All images were sourced from Openverse (https://openverse.org) and filtered to',
      'CC0 (Public Domain Dedication) and PDM (Public Domain Mark). These are free for',
      'commercial use with no attribution required. Credits are listed as good practice.',
      '',
    ];
    credits.forEach((c, i) => {
      lines.push(
        `${i + 1}. Slide: ${c.slide || '(untitled)'}`,
        `   Search: "${c.query}"`,
        `   Image:  ${c.title}`,
        `   By:     ${c.creator} (${c.provider})`,
        `   License:${c.license}${c.licenseUrl ? `  ${c.licenseUrl}` : ''}`,
        `   Source: ${c.source}`,
        '',
      );
    });
    fs.writeFileSync(path.join(path.dirname(outputPath), 'image-credits.txt'), lines.join('\n'), 'utf8');
  } catch (e) {
    console.warn('[VideoGen] Could not write image-credits.txt:', e && e.message ? e.message : e);
  }
}

// Build the HTML for one slide (Phase 3 — professional design).
// Two layouts share one visual system:
//   • cover  — centered title + brand eyebrow + accent rule + optional agenda
//   • content — title with accent rule, refined bullet list
// Both sit on a subtle dark gradient with a faint brand-blue glow, carry a footer
// (IdiamPro wordmark + slide number), and AUTO-FIT: an inline script shrinks the
// content until it fits the safe area, so dense real-outline text never overflows.
// Brand accent is IdiamPro's iOS blue (bright variant for dark-bg readability).
function slideHtml(slide, index, total, style, mindmapSvg, photoUrl) {
  const isCover = slide && slide.kind === 'cover';
  const title = escapeHtml(slide.title || '');
  const bullets = (Array.isArray(slide.bullets) ? slide.bullets : []).filter(Boolean);
  const num = `${(index || 0) + 1} / ${total || 1}`;
  // A section slide can carry a rendered mind-map SVG. When present (and this is
  // not the cover), we compose a split layout: text on the left, the mind map as
  // the hero visual on the right. If it's absent (leaf slide, or the diagram
  // failed to render), we fall back to the original text-only layout.
  const hasMindmap = !isCover && typeof mindmapSvg === 'string' && mindmapSvg.length > 40;
  // A slide can carry a stock photo (Phase B). Mind maps win over photos on the
  // same slide (they never both apply in Auto mode). When a photo is present we
  // compose a cinematic full-bleed layout: the photo fills the frame under a
  // strong dark scrim, with the text on top — legible over ANY image. If the
  // fetch failed, photoUrl is empty and we fall back to mind-map/text layouts.
  const hasPhoto = !hasMindmap && typeof photoUrl === 'string' && photoUrl.length > 4;

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
  // Panel behind the mind map — a subtle card that lifts the diagram off the
  // slide background and reads on both themes.
  const cardBg = isLight ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.045)';
  const cardBorder = isLight ? 'rgba(11,18,32,0.10)' : 'rgba(245,248,255,0.10)';

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

  // When a photo is present, lay it under a scrim as the first thing in the
  // stage so all text/footers paint on top of it. Cover and content use
  // differently-shaped scrims (centered vs. lower-left) for legibility.
  const stageClass = hasPhoto ? 'stage on-photo' : 'stage';
  const photoLayer = hasPhoto
    ? `<div class="photo-bg" style="background-image:url('${photoUrl}')"></div>` +
      `<div class="scrim ${isCover ? 'scrim-cover' : 'scrim-content'}"></div>`
    : '';

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
      <div class="${stageClass}">
        ${photoLayer}
        <div id="fit" class="cover">
          ${eyebrow}
          <h1>${title}</h1>
          <div class="accent-rule cover-rule"></div>
          ${agenda}
        </div>
        ${footerHtml}
      </div>`;
  } else if (hasMindmap) {
    // Split layout: title on top, bullets on the left, mind map as the hero on
    // the right. The mind-map SVG is injected raw (it is self-contained markup).
    const bulletsBlock = bullets.length ? `<ul>${bulletHtml}</ul>` : '';
    body = `
      <div class="stage">
        <div id="fit" class="split">
          <div class="head">
            <div class="accent-rule"></div>
            <h1>${title}</h1>
          </div>
          <div class="cols">
            <div class="textcol">${bulletsBlock}</div>
            <div class="mapcol"><div class="mm">${mindmapSvg}</div></div>
          </div>
        </div>
        ${footerHtml}
      </div>`;
  } else {
    // Text layout — also used, unchanged in structure, as the photo layout: the
    // .content block sits over the photo/scrim (narrowed to the left in CSS when
    // .on-photo is set) so the words stay readable against the image.
    body = `
      <div class="${stageClass}">
        ${photoLayer}
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
    /* --- Split layout (text + mind map) --- */
    .split { position: absolute; left: 150px; right: 150px; top: 130px; bottom: 160px;
      display: flex; flex-direction: column; transform-origin: left top; }
    .split .head .accent-rule { margin-bottom: 30px; }
    .split .head h1 { font-size: 72px; line-height: 1.06; font-weight: 800;
      color: ${TITLE}; letter-spacing: -1px; margin-bottom: 44px; max-width: 1600px; }
    .split .cols { display: flex; gap: 60px; flex: 1 1 auto; min-height: 0; }
    .split .textcol { flex: 0 0 36%; display: flex; flex-direction: column; justify-content: flex-start; }
    .split .textcol ul { list-style: none; }
    .split .textcol li { display: flex; align-items: flex-start; gap: 26px;
      font-size: 42px; line-height: 1.4; color: ${BODY}; margin-bottom: 28px; }
    .split .textcol li .mk { flex: 0 0 auto; width: 18px; height: 18px; margin-top: 16px;
      border-radius: 5px; background: ${ACCENT}; box-shadow: 0 0 14px ${accentGlow}; }
    .split .mapcol { flex: 1 1 64%; min-width: 0; display: flex; align-items: center; justify-content: center;
      background: ${cardBg}; border: 1px solid ${cardBorder}; border-radius: 26px; padding: 36px; }
    .split .mm { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
    .split .mm svg { width: 100%; height: auto; max-height: 100%; display: block; margin: auto; }
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
    /* --- Photo layout (stock images, Phase B) --- */
    .photo-bg { position: absolute; inset: 0; background-repeat: no-repeat;
      background-size: cover; background-position: center; }
    .scrim { position: absolute; inset: 0; }
    /* Content photo: darkest at the lower-left where the text + footer sit, fading
       to reveal the image on the right — a cinematic caption look. */
    .scrim-content { background:
      linear-gradient(90deg, rgba(4,8,16,0.92) 0%, rgba(4,8,16,0.74) 40%, rgba(4,8,16,0.30) 68%, rgba(4,8,16,0.06) 100%),
      linear-gradient(0deg, rgba(4,8,16,0.82) 0%, rgba(4,8,16,0.12) 34%, rgba(4,8,16,0) 56%); }
    /* Cover photo: an even vignette so the centered title reads anywhere. */
    .scrim-cover { background:
      radial-gradient(circle at 50% 42%, rgba(4,8,16,0.30), rgba(4,8,16,0.60) 66%, rgba(4,8,16,0.84) 100%),
      linear-gradient(0deg, rgba(4,8,16,0.74) 0%, rgba(4,8,16,0) 48%); }
    /* Over a photo, force light text + a soft shadow so it stays legible on ANY
       image regardless of the chosen dark/light theme; narrow content to the left. */
    .on-photo h1 { color: #ffffff !important; text-shadow: 0 2px 26px rgba(0,0,0,0.6); }
    .on-photo .content { right: 46%; }
    .on-photo .content li { color: #eaf1fa !important; text-shadow: 0 2px 18px rgba(0,0,0,0.55); }
    .on-photo .cover .agenda li { color: #eaf1fa !important; text-shadow: 0 2px 18px rgba(0,0,0,0.55); }
    .on-photo .cover .agenda-label { color: #cdd8e6 !important; }
    .on-photo .footer .name, .on-photo .footer .num { color: #d6dfec !important; }
    .on-photo .wm { color: #d6dfec !important; opacity: 0.9; }
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

// Render a Mermaid definition to an SVG string inside an offscreen window that
// loads the bundled Mermaid library. Returns the SVG markup, or null if Mermaid
// isn't available / the diagram fails to render — callers then fall back to a
// text-only slide, so a bad diagram can never break the render. (Slide visuals —
// mind maps, Phase A.)
async function renderMermaidSvg(mermaidDef, theme, workDir, tag) {
  const def = String(mermaidDef || '').trim();
  if (!def) return null;
  const mmTheme = theme === 'light' ? 'default' : 'dark';
  const htmlPath = path.join(workDir, `mm-${tag}.html`);
  let jsHref;
  try {
    jsHref = pathToFileURL(mermaidJsPath()).href;
  } catch {
    return null;
  }
  const defLiteral = JSON.stringify(def);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { background: transparent; }
    #c svg { max-width: 100%; height: auto; }
  </style><script src="${jsHref}"></script></head><body>
    <div id="c"></div>
    <script>
      (async function () {
        try {
          if (!window.mermaid) { window.__mmErr = 'mermaid-not-loaded'; window.__mmDone = 'err'; return; }
          window.mermaid.initialize({
            startOnLoad: false,
            theme: ${JSON.stringify(mmTheme)},
            securityLevel: 'loose',
            flowchart: { htmlLabels: true, curve: 'basis', padding: 14, nodeSpacing: 40, rankSpacing: 46 },
            fontFamily: '-apple-system, Helvetica Neue, Segoe UI, Arial, sans-serif',
          });
          const out = await window.mermaid.render('mmg', ${defLiteral});
          window.__mmSvg = (out && out.svg) ? out.svg : '';
          window.__mmDone = window.__mmSvg ? 'ok' : 'err';
        } catch (e) {
          window.__mmErr = String((e && e.message) || e);
          window.__mmDone = 'err';
        }
      })();
    </script></body></html>`;
  fs.writeFileSync(htmlPath, html);

  const win = new BrowserWindow({
    width: 1400,
    height: 1200,
    show: false,
    frame: false,
    webPreferences: { offscreen: true, nodeIntegration: false, contextIsolation: true },
  });
  try {
    await win.loadURL(pathToFileURL(htmlPath).href);
    const deadline = Date.now() + 8000;
    let status = null;
    while (Date.now() < deadline) {
      status = await win.webContents.executeJavaScript('window.__mmDone || null').catch(() => null);
      if (status) break;
      await new Promise((r) => setTimeout(r, 80));
    }
    if (status !== 'ok') {
      const err = await win.webContents.executeJavaScript('window.__mmErr || ""').catch(() => '');
      if (err) console.warn(`[VideoGen] Mermaid render failed (${tag}):`, err);
      return null;
    }
    let svg = await win.webContents.executeJavaScript('window.__mmSvg || ""').catch(() => '');
    if (!svg || svg.length <= 40) return null;
    // Mermaid stamps an inline `max-width: NNNpx` (its natural size) on the root
    // <svg>, which would stop the diagram from scaling UP to fill its slide card.
    // Relax that cap to 100% so the slide's CSS controls the size; the viewBox
    // keeps the aspect ratio intact when it grows.
    svg = svg.replace(/max-width:\s*[\d.]+px/gi, 'max-width: 100%');
    return svg;
  } catch (e) {
    console.warn(`[VideoGen] Mermaid window error (${tag}):`, e && e.message ? e.message : e);
    return null;
  } finally {
    win.destroy();
    try { fs.unlinkSync(htmlPath); } catch { /* ignore */ }
  }
}

// Render one slide to a PNG file using an offscreen BrowserWindow capture.
async function renderSlidePng(slide, outPath, index, total, style, mindmapSvg, photoUrl) {
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
  // The slide HTML is written to a temp file and loaded via a file:// URL rather
  // than a data: URL. This keeps loads reliable when the slide references a local
  // photo file (file:// image on a file:// page loads under webSecurity) and
  // avoids data-URL length limits when a large image is embedded.
  const htmlPath = `${outPath}.html`;
  try {
    win.webContents.on('paint', onPaint);
    win.webContents.setFrameRate(30);
    const html = slideHtml(slide, index, total, style, mindmapSvg, photoUrl);
    fs.writeFileSync(htmlPath, html);
    await win.loadURL(pathToFileURL(htmlPath).href);
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
    try { fs.unlinkSync(htmlPath); } catch { /* ignore */ }
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
 * @param {'off'|'mindmap'|'photo'|'auto'} [opts.visuals] Slide visuals mode
 *        (default 'auto'). off = text only; mindmap = mind map on section slides;
 *        photo = a free CC0/PDM stock photo on every content slide; auto = mind
 *        maps for sections + photos for leaf/detail slides (the richest, all-free
 *        mix). Photos come from Openverse (no cost, no key, license-clean) and a
 *        failed fetch always falls back to mind-map/text so it can't break a slide.
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
  // Slide visuals: 'off' = text only; 'mindmap' = mind map on section slides
  // (Phase A); 'photo' = a free stock photo on every content slide; 'auto' = mind
  // maps for sections + photos for leaf slides (Phase B). Default to 'auto' — the
  // richest all-free mix. Any unknown value falls back to 'auto'.
  const VISUALS_MODES = ['off', 'mindmap', 'photo', 'auto'];
  const visuals = VISUALS_MODES.includes(opts.visuals) ? opts.visuals : 'auto';
  // Per-render photo cache (query -> result|null) and credit log.
  const photoCache = new Map();
  const imageCredits = [];

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

      // 1. Decide this slide's visual, then render. A "section" slide is one that
      // carries a mind-map definition (it has children); anything else is a leaf.
      // Mode → visual:
      //   off      → nothing
      //   mindmap  → mind map on section slides only
      //   photo    → a stock photo on every content slide (+ optional cover photo)
      //   auto     → mind map on sections, photo on leaves (+ optional cover photo)
      // A failed mind map OR a failed photo returns null and the slide falls back
      // to the next-best layout — a visual failure can NEVER break the render.
      const isCover = slide && slide.kind === 'cover';
      const isSection = !!(slide && slide.mindmapMermaid);

      let wantMindmap = false;
      let wantPhoto = false;
      if (!isCover) {
        if (visuals === 'mindmap') wantMindmap = isSection;
        else if (visuals === 'photo') wantPhoto = true;
        else if (visuals === 'auto') { wantMindmap = isSection; wantPhoto = !isSection; }
      } else if (visuals === 'photo' || visuals === 'auto') {
        wantPhoto = true; // cover gets a tasteful photo background when available
      }

      let mindmapSvg = null;
      if (wantMindmap && slide && slide.mindmapMermaid) {
        mindmapSvg = await renderMermaidSvg(slide.mindmapMermaid, style.theme, workDir, i);
      }
      let photoUrl = null;
      if (wantPhoto && !mindmapSvg) {
        const query = buildImageQuery(slide && slide.title, slide && slide.bullets);
        const photo = await fetchSlidePhoto(query, workDir, photoCache);
        if (photo) {
          photoUrl = photo.fileUrl;
          imageCredits.push({ slide: slide && slide.title, ...photo.credit });
        }
      }
      await renderSlidePng(slide, pngPath, i, slides.length, style, mindmapSvg, photoUrl);

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

    // Record image provenance beside the MP4 (best-effort; never blocks success).
    writeImageCredits(outputPath, imageCredits);

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
