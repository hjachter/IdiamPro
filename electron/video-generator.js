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
const OV_USER_AGENT = 'IDMPro/1.0 (slideshow slide illustrations; https://secondbrainware.com)';
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

// Write media-credits.txt beside the finished MP4. Records provenance for BOTH
// stock photos (Phase B) and video clips (Phase C). Attribution isn't required
// for CC0/PDM (and Pexels/Pixabay waive it too), but recording it is good
// practice and reassures users the media is license-clean. Best-effort: never
// throws into the render.
function writeMediaCredits(outputPath, credits) {
  if (!Array.isArray(credits) || credits.length === 0) return;
  try {
    const lines = [
      `Media credits — ${path.basename(outputPath)}`,
      `Generated by IDMPro on ${new Date().toISOString()}`,
      '',
      'Every image and video clip used in this video was pulled from a free,',
      'license-clean source and is safe for commercial use with no attribution',
      'required. Photos come from Openverse (CC0 / Public Domain Mark). Video',
      'clips come from Wikimedia Commons (public-domain / CC0) — or, if you',
      'configured a free Pexels or Pixabay key, from those libraries under their',
      'no-attribution free licenses. Credits below are listed as good practice.',
      '',
    ];
    credits.forEach((c, i) => {
      const kind = c.kind === 'video' ? 'Clip' : 'Image';
      lines.push(
        `${i + 1}. Slide: ${c.slide || '(untitled)'}`,
        `   Search: "${c.query}"`,
        `   ${kind}:  ${c.title}`,
        `   By:     ${c.creator} (${c.provider})`,
        `   License:${c.license}${c.licenseUrl ? `  ${c.licenseUrl}` : ''}`,
        `   Source: ${c.source}`,
        '',
      );
    });
    fs.writeFileSync(path.join(path.dirname(outputPath), 'media-credits.txt'), lines.join('\n'), 'utf8');
  } catch (e) {
    console.warn('[VideoGen] Could not write media-credits.txt:', e && e.message ? e.message : e);
  }
}

// ============================================================================
// Video clips (slide visuals — Phase C). FREE + license-clean ONLY.
// ----------------------------------------------------------------------------
// A moving public-domain clip can sit BEHIND a slide's text (with a dark scrim
// for legibility) instead of a static photo. Sources, in preference order:
//   1. Pexels Videos  — ONLY if a PEXELS_API_KEY env var is set (free key; the
//      Pexels License allows commercial use with no attribution). Best quality
//      and relevance.
//   2. Pixabay Videos — ONLY if a PIXABAY_API_KEY env var is set (free key;
//      Pixabay Content License, no attribution required).
//   3. Wikimedia Commons — keyless; filtered to public-domain / CC0 files only.
// No key is ever hardcoded; a source with no key is simply skipped. No paid
// source is ever used. All fetching/compositing runs on the USER's machine.
//
// ROBUSTNESS: short timeouts, a per-query cache (misses included), a hard cap on
// how many distinct clips we download per render (big outlines REUSE already-
// downloaded clips instead of pulling hundreds), and a size ceiling so a giant
// file is skipped. If no clip can be had, the caller falls back to a stock PHOTO
// and then to TEXT — a missing clip can NEVER break a slide or cost anything.
// ============================================================================
const CLIP_SEARCH_TIMEOUT_MS = 9000;
const CLIP_DOWNLOAD_TIMEOUT_MS = 30000; // clips are bigger than photos
const CLIP_MIN_BYTES = 20 * 1024;        // skip empty/error bodies
const CLIP_MAX_BYTES = 45 * 1024 * 1024; // skip implausibly large files
const MAX_CLIP_DOWNLOADS = 8;            // cap distinct downloads; reuse beyond this
const WIKIMEDIA_ENDPOINT = 'https://commons.wikimedia.org/w/api.php';

// Strip HTML tags/entities from a metadata string (Commons "Artist" is HTML).
function stripTags(s) {
  return String(s == null ? '' : s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Is this license public-domain / CC0 (free, no attribution)? Used to gate the
// keyless Wikimedia source so we never pull an attribution-required file there.
function isPublicDomainLicense(licVal, licName) {
  const v = String(licVal || '').toLowerCase();
  const n = String(licName || '').toLowerCase();
  return (
    v.startsWith('cc0') || v === 'pd' || v.startsWith('pd') || v.includes('public') ||
    n.includes('cc0') || n.includes('public domain')
  );
}

// Wikimedia Commons keyless video search → candidate clips (public-domain/CC0
// only), smallest file first so we favor quick, sane-sized downloads.
async function wikimediaVideoSearch(query) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: `filetype:video ${query}`,
    gsrnamespace: '6',
    gsrlimit: '14',
    prop: 'imageinfo',
    iiprop: 'url|mime|size|extmetadata',
  });
  const resp = await fetchWithTimeout(
    `${WIKIMEDIA_ENDPOINT}?${params.toString()}`,
    { headers: { 'User-Agent': OV_USER_AGENT, Accept: 'application/json' } },
    CLIP_SEARCH_TIMEOUT_MS,
  );
  if (!resp.ok) throw new Error(`Wikimedia search HTTP ${resp.status}`);
  const data = await resp.json();
  const pages = (data && data.query && data.query.pages) || {};
  const out = [];
  for (const p of Object.values(pages)) {
    const ii = (p.imageinfo || [])[0];
    if (!ii || !ii.url) continue;
    const mime = String(ii.mime || '').toLowerCase();
    if (!/^video\//.test(mime) && !/ogg/.test(mime)) continue; // .ogv reports application/ogg
    const size = Number(ii.size || 0);
    if (size && size > CLIP_MAX_BYTES) continue; // skip huge files up front
    const em = ii.extmetadata || {};
    const licVal = (em.License && em.License.value) || '';
    const licName = (em.LicenseShortName && em.LicenseShortName.value) || '';
    if (!isPublicDomainLicense(licVal, licName)) continue;
    out.push({
      url: ii.url,
      size,
      credit: {
        query,
        title: p.title || '(untitled)',
        creator: stripTags((em.Artist && em.Artist.value) || '') || 'Unknown',
        license: (licName || String(licVal).toUpperCase() || 'Public domain').trim(),
        licenseUrl: (em.LicenseUrl && em.LicenseUrl.value) || '',
        source: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title || '')}`,
        provider: 'Wikimedia Commons',
        kind: 'video',
      },
    });
  }
  out.sort((a, b) => (a.size || 0) - (b.size || 0));
  return out;
}

// Pexels Videos search (only when PEXELS_API_KEY is set). Picks a file at or
// just under 1920px wide to keep downloads reasonable.
async function pexelsVideoSearch(query, key) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=8&orientation=landscape`;
  const resp = await fetchWithTimeout(url, { headers: { Authorization: key } }, CLIP_SEARCH_TIMEOUT_MS);
  if (!resp.ok) throw new Error(`Pexels search HTTP ${resp.status}`);
  const data = await resp.json();
  const out = [];
  for (const v of (data.videos || [])) {
    const files = (v.video_files || []).filter((f) => f && f.link && (f.width || 0) <= 1920);
    files.sort((a, b) => (b.width || 0) - (a.width || 0)); // biggest that's still <=1920
    const f = files[0] || (v.video_files || [])[0];
    if (!f || !f.link) continue;
    out.push({
      url: f.link,
      size: 0,
      credit: {
        query,
        title: `Pexels video #${v.id}`,
        creator: (v.user && v.user.name) || 'Unknown',
        license: 'Pexels License (free, commercial, no attribution required)',
        licenseUrl: 'https://www.pexels.com/license/',
        source: v.url || `https://www.pexels.com/video/${v.id}/`,
        provider: 'Pexels',
        kind: 'video',
      },
    });
  }
  return out;
}

// Pixabay Videos search (only when PIXABAY_API_KEY is set).
async function pixabayVideoSearch(query, key) {
  const url = `https://pixabay.com/api/videos/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}&per_page=8`;
  const resp = await fetchWithTimeout(url, { headers: { 'User-Agent': OV_USER_AGENT } }, CLIP_SEARCH_TIMEOUT_MS);
  if (!resp.ok) throw new Error(`Pixabay search HTTP ${resp.status}`);
  const data = await resp.json();
  const out = [];
  for (const hit of (data.hits || [])) {
    const vids = hit.videos || {};
    const pick = vids.medium || vids.small || vids.large || vids.tiny;
    if (!pick || !pick.url) continue;
    out.push({
      url: pick.url,
      size: Number(pick.size || 0),
      credit: {
        query,
        title: `Pixabay video #${hit.id}`,
        creator: hit.user || 'Unknown',
        license: 'Pixabay Content License (free, commercial, no attribution required)',
        licenseUrl: 'https://pixabay.com/service/license-summary/',
        source: hit.pageURL || `https://pixabay.com/videos/id-${hit.id}/`,
        provider: 'Pixabay',
        kind: 'video',
      },
    });
  }
  return out;
}

// Download a clip URL to bytes, honoring the size ceiling (checks the
// Content-Length header first, then the actual body). Returns { buf, ext }.
async function downloadClipBytes(url) {
  const resp = await fetchWithTimeout(url, { headers: { 'User-Agent': OV_USER_AGENT } }, CLIP_DOWNLOAD_TIMEOUT_MS);
  if (!resp.ok) throw new Error(`clip HTTP ${resp.status}`);
  const declared = Number(resp.headers.get('content-length') || 0);
  if (declared && declared > CLIP_MAX_BYTES) throw new Error(`clip too large (${declared})`);
  const buf = Buffer.from(await resp.arrayBuffer());
  if (buf.length < CLIP_MIN_BYTES || buf.length > CLIP_MAX_BYTES) throw new Error(`clip size ${buf.length}`);
  let ext = 'mp4';
  try {
    const p = new URL(url).pathname;
    const e = path.extname(p).replace('.', '').toLowerCase();
    if (e && e.length <= 4) ext = e;
  } catch { /* keep default */ }
  return { buf, ext };
}

// Fetch a video clip for a query, save it into workDir, and return
// { filePath, credit } — or null on any failure (caller falls back to photo,
// then text). Caches per query (misses included). Enforces MAX_CLIP_DOWNLOADS:
// once we've downloaded that many distinct clips, later slides REUSE one we
// already have (deterministic pick by query) so a big outline never floods the
// network with hundreds of downloads.
async function fetchSlideClip(query, workDir, ctx) {
  const q = String(query || '').trim();
  if (!q) return null;
  if (ctx.cache.has(q)) return ctx.cache.get(q);

  // Download budget spent → reuse an already-fetched clip if we have one.
  if (ctx.counters.downloads >= MAX_CLIP_DOWNLOADS) {
    const reuse = ctx.pool.length ? ctx.pool[q.length % ctx.pool.length] : null;
    ctx.cache.set(q, reuse);
    return reuse;
  }

  // Assemble candidate lists from whichever sources are available.
  let candidates = [];
  const searchers = [];
  if (ctx.pexelsKey) searchers.push(() => pexelsVideoSearch(q, ctx.pexelsKey));
  if (ctx.pixabayKey) searchers.push(() => pixabayVideoSearch(q, ctx.pixabayKey));
  searchers.push(() => wikimediaVideoSearch(q)); // always available (keyless)

  for (const search of searchers) {
    if (candidates.length) break;
    try {
      candidates = await search();
    } catch (e) {
      console.warn('[VideoGen] clip search failed:', e && e.message ? e.message : e);
      candidates = [];
    }
  }

  let out = null;
  for (const cand of candidates) {
    try {
      const { buf, ext } = await downloadClipBytes(cand.url);
      const safe = q.replace(/[^a-z0-9]+/gi, '-').slice(0, 40) || 'clip';
      const filePath = path.join(workDir, `clip-${safe}-${ctx.counters.downloads}.${ext}`);
      fs.writeFileSync(filePath, buf);
      out = { filePath, credit: cand.credit };
      ctx.counters.downloads += 1;
      ctx.pool.push(out);
      break;
    } catch {
      /* try the next candidate */
    }
  }

  ctx.cache.set(q, out); // cache misses too, so a dead query isn't retried
  return out;
}

// Build the HTML for one slide (Phase 3 — professional design).
// Two layouts share one visual system:
//   • cover  — centered title + brand eyebrow + accent rule + optional agenda
//   • content — title with accent rule, refined bullet list
// Both sit on a subtle dark gradient with a faint brand-blue glow, carry a footer
// (IDMPro wordmark + slide number), and AUTO-FIT: an inline script shrinks the
// content until it fits the safe area, so dense real-outline text never overflows.
// Brand accent is IDMPro's iOS blue (bright variant for dark-bg readability).
function slideHtml(slide, index, total, style, mindmapSvg, photoUrl, videoClip, screenshotUrl) {
  const isCover = slide && slide.kind === 'cover';
  const title = escapeHtml(slide.title || '');
  const bullets = (Array.isArray(slide.bullets) ? slide.bullets : []).filter(Boolean);
  const num = `${(index || 0) + 1} / ${total || 1}`;
  // A slide can carry a real PRODUCT SCREENSHOT (a local image) as its hero
  // visual. It is framed like an app window on the branded slide — NOT full-bleed
  // behind the text — so the actual UI stays crisp and legible. On a content
  // slide it sits in the visual card of the split layout (title + bullets on the
  // left, the screenshot on the right); on the cover it sits framed below the
  // title. Screenshots win over mind maps / photos / clips when present.
  const hasScreenshot = typeof screenshotUrl === 'string' && screenshotUrl.length > 4;
  // A section slide can carry a rendered mind-map SVG. When present (and this is
  // not the cover), we compose a split layout: text on the left, the mind map as
  // the hero visual on the right. If it's absent (leaf slide, or the diagram
  // failed to render), we fall back to the original text-only layout.
  const hasMindmap = !isCover && !hasScreenshot && typeof mindmapSvg === 'string' && mindmapSvg.length > 40;
  // A slide can carry a stock photo (Phase B). Mind maps win over photos on the
  // same slide (they never both apply in Auto mode). When a photo is present we
  // compose a cinematic full-bleed layout: the photo fills the frame under a
  // strong dark scrim, with the text on top — legible over ANY image. If the
  // fetch failed, photoUrl is empty and we fall back to mind-map/text layouts.
  const hasPhoto = !hasMindmap && !hasScreenshot && typeof photoUrl === 'string' && photoUrl.length > 4;
  // A slide can instead sit over a MOVING public-domain clip (Phase C). The clip
  // itself is composited by ffmpeg BEHIND this PNG; here we render the text +
  // scrim + footer on a TRANSPARENT page so the clip shows through. It reuses the
  // photo layout's scrim + light-text treatment for legibility over any footage.
  const hasVideoBg = !hasMindmap && !hasPhoto && !hasScreenshot && videoClip === true;
  // Text that sits over imagery (photo OR clip) gets the light, shadowed
  // treatment via the .on-photo class so it stays legible on any background.
  const overImagery = hasPhoto || hasVideoBg;

  // --- Resolve style with safe fallbacks to the original dark / blue look. ---
  const s = style || {};
  const theme = s.theme === 'light' ? 'light' : 'dark';
  const ACCENT = (typeof s.accent === 'string' && s.accent.trim()) || '#3898ff';
  const brandLabel = typeof s.brandLabel === 'string' ? s.brandLabel.trim() : 'IDMPro';
  const logoDataUrl = typeof s.logoDataUrl === 'string' ? s.logoDataUrl.trim() : '';
  // Free-tier taste: non-Pro renders carry a subtle "Made with IDMPro" mark.
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
    ? `<div class="wm"><span class="wm-dot"></span>Made with IDMPro</div>`
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
      background:${hasVideoBg ? 'transparent' : background};
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
  const stageClass = overImagery ? 'stage on-photo' : 'stage';
  const scrimClass = isCover ? 'scrim-cover' : 'scrim-content';
  // Photo slides paint the image + scrim; video-clip slides paint ONLY the scrim
  // (the clip is composited behind this transparent PNG by ffmpeg).
  const photoLayer = hasPhoto
    ? `<div class="photo-bg" style="background-image:url('${photoUrl}')"></div>` +
      `<div class="scrim ${scrimClass}"></div>`
    : hasVideoBg
      ? `<div class="scrim ${scrimClass}"></div>`
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
    const coverShot = hasScreenshot
      ? `<div class="cover-shot"><img class="shot" src="${screenshotUrl}" alt="" /></div>`
      : '';
    body = `
      <div class="${stageClass}">
        ${photoLayer}
        <div id="fit" class="cover${hasScreenshot ? ' cover-withshot' : ''}">
          ${eyebrow}
          <h1>${title}</h1>
          <div class="accent-rule cover-rule"></div>
          ${coverShot || agenda}
        </div>
        ${footerHtml}
      </div>`;
  } else if (hasScreenshot) {
    // Split layout with a real product screenshot as the hero visual: title +
    // bullets on the left, the framed app window on the right.
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
            <div class="mapcol shotcol"><img class="shot" src="${screenshotUrl}" alt="" /></div>
          </div>
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
    /* --- Product screenshot (framed app window) --- */
    .split .shotcol { padding: 0; background: transparent; border: none; overflow: hidden; }
    .shot { max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain;
      border-radius: 20px; border: 1px solid ${cardBorder};
      box-shadow: 0 34px 90px rgba(2,6,16,0.55), 0 0 0 1px rgba(255,255,255,0.03) inset; display: block; }
    .cover-withshot { justify-content: center; }
    .cover-withshot h1 { font-size: 78px; }
    .cover-withshot .eyebrow { margin-bottom: 26px; }
    .cover-withshot .cover-rule { margin: 34px auto 0; }
    .cover .cover-shot { margin-top: 62px; width: 100%; display: flex; justify-content: center;
      min-height: 0; flex: 0 1 auto; align-items: center; overflow: hidden; }
    .cover .cover-shot .shot { max-height: 500px; max-width: 76%; }
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
async function renderSlidePng(slide, outPath, index, total, style, mindmapSvg, photoUrl, renderOpts) {
  const opts = renderOpts || {};
  const videoClip = opts.videoClip === true;
  const screenshotUrl = typeof opts.screenshotUrl === 'string' ? opts.screenshotUrl : '';
  // For a video-clip slide we capture the text/scrim on a TRANSPARENT page so the
  // clip (composited behind by ffmpeg) shows through. An offscreen window renders
  // transparent when created with transparent:true + a fully-transparent bg color,
  // and NativeImage.toPNG() preserves the alpha channel.
  const transparent = opts.transparent === true;
  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    show: false,
    frame: false,
    transparent,
    backgroundColor: transparent ? '#00000000' : undefined,
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
    const html = slideHtml(slide, index, total, style, mindmapSvg, photoUrl, videoClip, screenshotUrl);
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

// Sanitize narration for the offline `say` engine: strip control chars,
// neutralize its [[...]] command syntax, collapse whitespace, and cap length.
// (We run `say` via execFile WITHOUT a shell and feed the text from a FILE, so
// there is no shell-injection surface at all; this just keeps the spoken text
// clean and bounded.)
function sanitizeForSay(text) {
  return String(text == null ? '' : text)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')  // strip control chars
    .replace(/[\[\]]/g, ' ')                   // `say` treats [[ ]] as commands
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000);
}

// FREE offline voiceover fallback using the operating system's built-in
// text-to-speech, so a video is NEVER silent even without an OpenAI key. On
// macOS this is the built-in `say` command (free + offline): it writes an AIFF
// we hand straight to the encoder (ffmpeg reads AIFF natively — no lossy
// re-encode needed). The narration is passed via a temp text FILE (`say -f`) so
// nothing in the text can be misread as a command-line option. Returns the
// produced audio file path, or null if this platform has no wired free engine
// or the engine failed (caller then falls back to silence).
// Cache the chosen best free voice for the life of one render (querying the
// installed voice list is cheap but we only need it once per video).
let __bestSayVoice;
function bestNarrationVoice() {
  if (__bestSayVoice !== undefined) return __bestSayVoice;
  try {
    // Reuse the podcast generator's voice picker so both features select the
    // same high-quality Apple voice (Premium/Enhanced tier when installed).
    const { pickBestSayVoice } = require('./podcast-generator');
    __bestSayVoice = pickBestSayVoice('n') || null; // neutral narrator flavor
  } catch {
    __bestSayVoice = null;
  }
  return __bestSayVoice;
}

async function synthesizeLocalTts(text, workDir, index) {
  const clean = sanitizeForSay(text);
  if (!clean) return null;
  if (process.platform === 'darwin') {
    const txtPath = path.join(workDir, `say-${index}.txt`);
    const aiffPath = path.join(workDir, `say-${index}.aiff`);
    const voice = bestNarrationVoice();
    const baseArgs = ['-f', txtPath, '-o', aiffPath];
    try {
      fs.writeFileSync(txtPath, clean, 'utf8');
      try {
        await run('say', voice ? ['-v', voice, ...baseArgs] : baseArgs);
      } catch (e) {
        // A named high-quality voice might not be installed after all — retry
        // once with the system default so narration is never lost.
        if (voice) await run('say', baseArgs);
        else throw e;
      }
      if (fs.existsSync(aiffPath) && fs.statSync(aiffPath).size > 1000) return aiffPath;
    } catch (e) {
      console.warn('[VideoGen] macOS `say` voiceover failed:', e && e.message ? e.message : e);
    } finally {
      try { fs.unlinkSync(txtPath); } catch { /* ignore */ }
    }
    return null;
  }
  // Other platforms (Windows/Linux): no trivially-available free offline engine
  // is wired yet, so the caller falls back to silence. (Windows SAPI / Linux
  // espeak could be added here later.)
  return null;
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
    // NOTE: no `-shortest`. `-t dur` already bounds the segment to the narration
    // length, and `-shortest` combined with `-loop 1` (an infinite image input)
    // was silently dropping the AUDIO for OpenAI TTS mp3s (24 kHz mono) — every
    // premium-voice render came out silent. Removing it keeps the audio; the
    // duration is unchanged because `-t` still caps the output.
    outPath,
  ]);
}

// Encode one VIDEO-BACKGROUND slide (Phase C): a moving clip behind a
// transparent text/scrim PNG, with narration (or silent) audio on top.
//   • the clip is scaled+cropped to fill 1920x1080 and looped to the segment
//     length (so a short clip still covers a long narration),
//   • the transparent overlay PNG (text + dark scrim + footer + watermark) is
//     laid on top so the words stay legible over any footage,
//   • the same gentle fade-in/out as still slides is applied to the composite,
//   • output codec params MATCH encodeSegment (libx264 / yuv420p / 30fps / aac
//     192k / 44.1k) so the final concat pass stays seamless.
async function encodeVideoSegment(clipPath, overlayPngPath, audioPath, outPath, durationSeconds) {
  const dur = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : FALLBACK_SECONDS;
  const fade = Math.min(0.5, dur / 6);
  const outStart = Math.max(0, dur - fade);
  // NOTE: the transparent overlay PNG is captured at the display's device pixel
  // ratio (e.g. 3840x2160 on a Retina Mac), so we explicitly scale it down to
  // 1920x1080 before compositing — otherwise only its top-left quarter would land
  // on the frame and the centered text would slide off to the right. (This mirrors
  // how the still-image path already scales its PNGs to the slide size.)
  const filter = [
    `[0:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},setsar=1,fps=${FPS}[bg]`,
    `[1:v]scale=${WIDTH}:${HEIGHT},setsar=1[fg]`,
    `[bg][fg]overlay=0:0:format=auto[ov]`,
    `[ov]fade=t=in:st=0:d=${fade.toFixed(3)},fade=t=out:st=${outStart.toFixed(3)}:d=${fade.toFixed(3)}[v]`,
  ].join(';');
  await run(ffmpegPath, [
    '-y',
    '-stream_loop', '-1', '-i', clipPath,   // input 0: the clip, looped to fill
    '-loop', '1', '-i', overlayPngPath,      // input 1: the transparent text PNG
    '-i', audioPath,                          // input 2: narration / silence
    '-filter_complex', filter,
    '-map', '[v]',
    '-map', '2:a',
    '-c:v', 'libx264',
    '-r', String(FPS),
    '-pix_fmt', 'yuv420p',
    '-t', dur.toFixed(3),
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ar', '44100',
    // No `-shortest` (see encodeSegment): `-t dur` bounds length, and `-shortest`
    // with looped/infinite video inputs was dropping the narration audio.
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
 * @param {(p:{phase:string,current:number,total:number,completed:number,totalSteps:number,label:string})=>void} [opts.onProgress]
 *        Optional live-progress callback fired at each meaningful step (one per
 *        slide, plus a final stitch step) so the UI can show a real progress bar
 *        and an estimated time remaining. Errors it throws are swallowed.
 * @param {'off'|'mindmap'|'photo'|'auto'|'videoclip'} [opts.visuals] Slide visuals
 *        mode (default 'auto'). off = text only; mindmap = mind map on section
 *        slides; photo = a free CC0/PDM stock photo on every content slide; auto =
 *        mind maps for sections + photos for leaf/detail slides; videoclip = like
 *        auto but leaf/detail slides (and the cover) get a MOVING public-domain
 *        clip background instead of a static photo (sections still get their mind
 *        map). Photos come from Openverse; clips from Wikimedia Commons (keyless,
 *        public-domain) or a free Pexels/Pixabay key if set — all free, no per-clip
 *        charge. Every fetch fails safe: a clip that can't be had falls back to a
 *        photo, then to text, so a missing visual can NEVER break or cost anything.
 * @returns {Promise<{success:boolean, outputPath?:string, durationSeconds?:number,
 *                     fileSizeBytes?:number, usedTts:boolean, slideCount:number,
 *                     error?:string}>}
 */
// Normalize the caller's slide-visuals selection into independent on/off flags.
// Accepts EITHER the new multi-select object { mindmap, photo, videoclip } OR a
// legacy single-string mode (off|mindmap|photo|auto|videoclip). Default (nothing
// passed) is the reliable, free, no-garbage combo: mind maps + photos, NO clips.
function normalizeVisuals(v) {
  if (v && typeof v === 'object') {
    return { mindmap: !!v.mindmap, photo: !!v.photo, videoclip: !!v.videoclip };
  }
  switch (v) {
    case 'off':       return { mindmap: false, photo: false, videoclip: false };
    case 'mindmap':   return { mindmap: true,  photo: false, videoclip: false };
    case 'photo':     return { mindmap: false, photo: true,  videoclip: false };
    case 'videoclip': return { mindmap: true,  photo: false, videoclip: true };
    case 'auto':      return { mindmap: true,  photo: true,  videoclip: false };
    default:          return { mindmap: true,  photo: true,  videoclip: false };
  }
}

async function generateSlideshowVideo(opts) {
  const slides = Array.isArray(opts && opts.slides) ? opts.slides : [];
  if (slides.length === 0) {
    return { success: false, error: 'No slides provided.', usedTts: false, slideCount: 0 };
  }

  const apiKey = (opts.openaiApiKey && String(opts.openaiApiKey).trim()) || process.env.OPENAI_API_KEY || '';
  const voice = opts.voice || 'nova';
  const style = opts.style || {};

  // Live progress reporting. The caller (IPC handler) passes an onProgress
  // callback; we invoke it at meaningful steps so the dialog can show a real
  // progress bar + time-remaining estimate. Every slide is one step, plus a
  // final "stitch" step, so the bar only reaches 100% when the file is done.
  // Wrapped so a misbehaving listener can NEVER break or slow the render.
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
  const totalSteps = slides.length + 1;
  const report = (payload) => {
    if (!onProgress) return;
    try { onProgress(payload); } catch { /* a progress listener must never break the render */ }
  };
  // Slide visuals are now INDEPENDENT, combinable toggles: mind maps, photos, and
  // video clips can each be on or off. normalizeVisuals accepts the new
  // { mindmap, photo, videoclip } object OR a legacy single-string mode, and
  // defaults (nothing passed) to the reliable, free combo mind maps + photos.
  const vis = normalizeVisuals(opts.visuals);
  // Per-render photo cache (query -> result|null) and a shared media credit log
  // (photos AND clips both write into it).
  const photoCache = new Map();
  const mediaCredits = [];
  // Per-render video-clip context: a query cache, a reuse pool of clips already
  // downloaded, a download counter (capped by MAX_CLIP_DOWNLOADS), and optional
  // Pexels/Pixabay keys read from the environment (never hardcoded; absent = the
  // source is skipped, leaving the keyless Wikimedia source).
  const clipCtx = {
    cache: new Map(),
    pool: [],
    counters: { downloads: 0 },
    pexelsKey: (process.env.PEXELS_API_KEY && String(process.env.PEXELS_API_KEY).trim()) || '',
    pixabayKey: (process.env.PIXABAY_API_KEY && String(process.env.PIXABAY_API_KEY).trim()) || '',
  };

  // Working directory for intermediate files.
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idiampro-video-'));

  // Default output location: ~/Documents/IDMPro Videos/
  let outputPath = opts.outputPath;
  if (!outputPath) {
    const outDir = path.join(os.homedir(), 'Documents', 'IDMPro Videos');
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
      // Report the start of this slide's work — the bar advances one step per
      // completed slide (completed = i means i slides are already behind us).
      report({
        phase: 'rendering', current: i + 1, total: slides.length,
        completed: i, totalSteps, label: `Rendering slide ${i + 1} of ${slides.length}`,
      });
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
      // In 'videoclip' mode, leaf/detail slides (and the cover) want a moving
      // clip; section slides still get their static mind map. Everything else
      // matches the earlier modes. A failed clip falls back to a photo, then text.
      const isCover = slide && slide.kind === 'cover';
      const isSection = !!(slide && slide.mindmapMermaid);

      // A slide may pin a REAL product screenshot (a local image file) as its
      // hero visual. When present it wins over every generated/fetched visual
      // (mind map / photo / clip are all skipped) and is framed like an app
      // window on the branded slide. A missing/unreadable file falls back to the
      // normal visual pipeline, so it can never break the render.
      let screenshotUrl = null;
      if (slide && typeof slide.imageFile === 'string' && slide.imageFile.trim()) {
        try {
          const p = slide.imageFile.trim();
          if (fs.existsSync(p)) screenshotUrl = pathToFileURL(p).href;
        } catch { /* fall back to the normal visual pipeline */ }
      }

      // Combinable per-slide rules:
      //   • section slide (has children) → a mind map, if Mind maps is on
      //   • detail/leaf slide (or a section with Mind maps off) → a video clip if
      //     Video clips is on, else a photo if Photos is on
      //   • cover slide → a video clip if on, else a photo if on
      // Video clips prefer over photos on the SAME detail slide; a clip that
      // can't be matched falls back to a photo below (never a forced bad clip).
      let wantMindmap = false;
      let wantPhoto = false;
      let wantClip = false;
      if (screenshotUrl) {
        // A pinned screenshot is the visual — skip all generated/fetched visuals.
      } else if (!isCover) {
        if (isSection && vis.mindmap) {
          wantMindmap = true;
        } else {
          if (vis.videoclip) wantClip = true;
          else if (vis.photo) wantPhoto = true;
        }
      } else {
        if (vis.videoclip) wantClip = true;
        else if (vis.photo) wantPhoto = true;
      }

      let mindmapSvg = null;
      if (wantMindmap && slide && slide.mindmapMermaid) {
        mindmapSvg = await renderMermaidSvg(slide.mindmapMermaid, style.theme, workDir, i);
      }

      // Video clip (Phase C). If we can't get one, degrade to a photo below.
      let clipPath = null;
      if (wantClip && !mindmapSvg) {
        const query = buildImageQuery(slide && slide.title, slide && slide.bullets);
        const clip = await fetchSlideClip(query, workDir, clipCtx);
        if (clip) {
          clipPath = clip.filePath;
          mediaCredits.push({ slide: slide && slide.title, ...clip.credit });
        } else {
          wantPhoto = true; // no clip → fall back to a still photo on this slide
        }
      }

      let photoUrl = null;
      if (wantPhoto && !mindmapSvg && !clipPath) {
        const query = buildImageQuery(slide && slide.title, slide && slide.bullets);
        const photo = await fetchSlidePhoto(query, workDir, photoCache);
        if (photo) {
          photoUrl = photo.fileUrl;
          mediaCredits.push({ slide: slide && slide.title, ...photo.credit });
        }
      }

      // A video-clip slide renders its text on a TRANSPARENT PNG (the clip is
      // composited behind by ffmpeg); every other slide renders opaquely.
      const isVideoSlide = !!clipPath;
      await renderSlidePng(
        slide, pngPath, i, slides.length, style, mindmapSvg, photoUrl,
        isVideoSlide
          ? { videoClip: true, transparent: true }
          : (screenshotUrl ? { screenshotUrl } : undefined),
      );

      // 2. Narration audio. Fallback chain so a video is NEVER silent:
      //    OpenAI TTS (if a key is present) → FREE built-in OS voice (macOS
      //    `say`) → fixed-length silence (last resort). `audioFile` points at
      //    whichever track we produced (the OS voice writes its own AIFF).
      const narration = (slide.narration || slide.title || '').trim();
      let gotAudio = false;
      let audioFile = audioPath;
      // A slide may supply a PRE-EXISTING narration audio file (e.g. reusing
      // already-synthesized/paid TTS). When present and readable, we use it
      // verbatim and skip TTS entirely — no new synthesis, no cost.
      if (!gotAudio && slide && typeof slide.audioFile === 'string' && slide.audioFile.trim()) {
        try {
          const ap = slide.audioFile.trim();
          if (fs.existsSync(ap) && fs.statSync(ap).size > 1000) {
            audioFile = ap;
            gotAudio = true;
          }
        } catch { /* fall through to synthesis */ }
      }
      if (!gotAudio && narration && (apiKey || process.platform === 'darwin')) {
        // Same step (bar doesn't jump back) — just a friendlier label while the
        // voiceover work runs, which is the slow part of a slide.
        report({
          phase: 'voiceover', current: i + 1, total: slides.length,
          completed: i, totalSteps, label: `Adding voiceover (${i + 1} of ${slides.length})`,
        });
      }
      if (!gotAudio && apiKey && narration) {
        try {
          await synthesizeTts(narration, voice, apiKey, audioPath);
          usedTts = true;
          gotAudio = true;
          audioFile = audioPath;
        } catch (ttsErr) {
          console.warn('[VideoGen] OpenAI TTS failed, trying the free built-in voice:', ttsErr.message);
        }
      }
      if (!gotAudio && narration) {
        // FREE offline voiceover so the video still narrates without any key.
        const localPath = await synthesizeLocalTts(narration, workDir, i);
        if (localPath) {
          usedTts = true;
          gotAudio = true;
          audioFile = localPath;
        }
      }
      if (!gotAudio) {
        // Last resort: fixed-length silence, roughly proportional to narration
        // so a silent slide still paces sensibly.
        const words = narration ? narration.split(/\s+/).length : 0;
        const seconds = Math.max(FALLBACK_SECONDS, Math.round(words / 2.5));
        await synthesizeSilence(seconds, audioPath);
        audioFile = audioPath;
      }

      // 3. Encode the per-slide segment (fades sized to the narration length).
      const segDuration = await probeDuration(audioFile);
      if (isVideoSlide) {
        try {
          // Composite the moving clip behind the transparent text overlay.
          await encodeVideoSegment(clipPath, pngPath, audioFile, segPath, segDuration);
        } catch (clipErr) {
          // Compositing failed (bad/corrupt clip, unsupported codec, etc.). The
          // transparent PNG alone would be unreadable, so re-render this slide as
          // an OPAQUE text slide and encode a normal still segment — the render
          // stays intact and the slide is still perfectly usable.
          console.warn('[VideoGen] clip compositing failed, using text slide:', clipErr && clipErr.message ? clipErr.message : clipErr);
          await renderSlidePng(slide, pngPath, i, slides.length, style, null, null, undefined);
          await encodeSegment(pngPath, audioFile, segPath, segDuration);
        }
      } else {
        await encodeSegment(pngPath, audioFile, segPath, segDuration);
      }
      segmentPaths.push(segPath);
    }

    // Stitch everything together — the final step of the progress bar.
    report({
      phase: 'stitching', current: slides.length, total: slides.length,
      completed: slides.length, totalSteps, label: 'Stitching video',
    });
    await concatSegments(segmentPaths, outputPath);
    report({
      phase: 'done', current: slides.length, total: slides.length,
      completed: totalSteps, totalSteps, label: 'Finishing up',
    });

    // Record photo + clip provenance beside the MP4 (best-effort; never blocks).
    writeMediaCredits(outputPath, mediaCredits);

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
  // Internal helpers exposed for automated testing of the Phase C video-clip
  // compositing pipeline (renders + ffmpeg run inside the Electron main process,
  // so a test must drive them there). Not part of the public API.
  __test: {
    renderSlidePng,
    encodeVideoSegment,
    encodeSegment,
    concatSegments,
    fetchSlideClip,
    wikimediaVideoSearch,
    probeDuration,
    synthesizeSilence,
  },
};
