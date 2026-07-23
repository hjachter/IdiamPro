'use client';

/**
 * Instagram carousel slide renderer (2026-07-22).
 *
 * Turns a set of short "slide specs" (a punchy line per slide, slide 1 = a hook
 * cover) into REAL, downloadable SQUARE 1080×1080 branded PNG images — the
 * showpiece of the Share to Instagram feature.
 *
 * It reuses the Generate Video BRANDING model (VideoStyle: theme / accent /
 * brand label / logo) so a carousel looks like the same product as the user's
 * videos — same dark/light gradient, same accent glow + accent rule, same
 * footer wordmark and slide number. The video slide engine itself
 * (electron/video-generator.js) renders 16:9 frames inside an offscreen Electron
 * window and is desktop-only; re-tuning that for square output would strand web
 * and iOS users. So this renderer paints the SAME visual system onto a plain
 * HTML5 Canvas, which works identically in the Electron renderer, the browser,
 * and the iOS webview — no native pipeline, no Electron-only APIs.
 *
 * Output: an array of { name, dataUrl, blob } (blob = a genuine PNG image), plus
 * a zip helper so "Download carousel" saves the whole set in one file.
 */

import JSZip from 'jszip';
import type { VideoStyle } from '@/lib/video/video-style';

/** One carousel slide's content. Kept intentionally short — Instagram carousels
 *  are one punchy idea per card, big type, never a wall of text. */
export interface CarouselSlideInput {
  /** The card's headline — a hook on slide 1, one key point on the rest. */
  title: string;
  /** Optional single supporting line under the title. */
  subtitle?: string;
  /** 'cover' = the opening hook card; 'content' = a body card. */
  kind?: 'cover' | 'content';
}

/** A rendered slide: a real PNG blob plus a data URL for on-screen preview. */
export interface RenderedCarouselSlide {
  name: string;
  dataUrl: string;
  blob: Blob;
}

/** Just the branding fields we need (a subset of VideoStyle). */
export type CarouselBrand = Pick<VideoStyle, 'theme' | 'accent' | 'brandLabel' | 'logoDataUrl'>;

const SIZE = 1080;
const PAD = 108; // safe-area inset

/** #rrggbb (or #rgb) → "r, g, b" for use in rgba(). Falls back to a blue. */
function hexToRgbTriplet(hex: string): string {
  let h = (hex || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return '56, 152, 255';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

/** Theme palette mirroring the video slide engine's colours. */
function palette(theme: 'dark' | 'light') {
  const isLight = theme === 'light';
  return {
    isLight,
    title: isLight ? '#0b1220' : '#f5f8ff',
    body: isLight ? '#35485f' : '#c7d2e3',
    muted: isLight ? '#7d8ea3' : '#5f7286',
    name: isLight ? '#4a5c74' : '#93a4b8',
    gradStops: isLight
      ? ['#ffffff', '#f3f6fb', '#e9eff7']
      : ['#0a1120', '#0f1a30', '#0b1424'],
    glowAlpha: isLight ? 0.13 : 0.22,
  };
}

/** Load an image from a data URL; resolves null on any failure (never throws). */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** canvas.toBlob as a promise (PNG). */
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Could not render the slide image.'));
    }, 'image/png');
  });
}

/** Greedy word-wrap into lines that fit maxWidth at the current ctx font. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = (text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const cand = line ? `${line} ${w}` : w;
    if (ctx.measureText(cand).width <= maxWidth || !line) {
      line = cand;
    } else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Pick the largest font size (within a range) at which the wrapped title fits
 * inside the given box, so short hooks read HUGE and longer lines still fit —
 * the auto-fit behaviour the video engine has for its slides.
 */
function fitTitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxHeight: number,
  weight: string,
  maxPx: number,
  minPx: number,
): { size: number; lines: string[]; lineHeight: number } {
  for (let size = maxPx; size >= minPx; size -= 4) {
    ctx.font = `${weight} ${size}px -apple-system, "Helvetica Neue", "Segoe UI", Arial, sans-serif`;
    const lines = wrapLines(ctx, text, maxWidth);
    const lineHeight = size * 1.16;
    if (lines.length * lineHeight <= maxHeight) return { size, lines, lineHeight };
  }
  ctx.font = `${weight} ${minPx}px -apple-system, "Helvetica Neue", "Segoe UI", Arial, sans-serif`;
  return { size: minPx, lines: wrapLines(ctx, text, maxWidth), lineHeight: minPx * 1.16 };
}

/** Draw one slide onto a fresh canvas and return it as a PNG blob + data URL. */
async function renderOne(
  slide: CarouselSlideInput,
  index: number,
  total: number,
  brand: CarouselBrand,
  logo: HTMLImageElement | null,
): Promise<RenderedCarouselSlide> {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this environment.');

  const pal = palette(brand.theme);
  const accent = (brand.accent || '').trim() || '#3898ff';
  const accentRgb = hexToRgbTriplet(accent);
  const isCover = slide.kind === 'cover';

  // --- Background: diagonal gradient + accent glow (mirrors the video slides). ---
  const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  grad.addColorStop(0, pal.gradStops[0]);
  grad.addColorStop(0.55, pal.gradStops[1]);
  grad.addColorStop(1, pal.gradStops[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const glow = ctx.createRadialGradient(SIZE * 0.82, SIZE * 0.16, 0, SIZE * 0.82, SIZE * 0.16, SIZE * 0.6);
  glow.addColorStop(0, `rgba(${accentRgb}, ${pal.glowAlpha})`);
  glow.addColorStop(1, `rgba(${accentRgb}, 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SIZE, SIZE);
  // A second, softer glow bottom-left for depth.
  const glow2 = ctx.createRadialGradient(SIZE * 0.12, SIZE * 0.9, 0, SIZE * 0.12, SIZE * 0.9, SIZE * 0.5);
  glow2.addColorStop(0, `rgba(${accentRgb}, ${pal.glowAlpha * 0.5})`);
  glow2.addColorStop(1, `rgba(${accentRgb}, 0)`);
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const contentLeft = PAD;
  const contentWidth = SIZE - PAD * 2;
  const footerY = SIZE - PAD + 6;

  // --- Cover eyebrow (brand name, uppercase) at the top of the hook card. ---
  const brandLabel = (brand.brandLabel || '').trim();
  if (isCover && brandLabel) {
    ctx.font = `600 30px -apple-system, "Helvetica Neue", "Segoe UI", Arial, sans-serif`;
    ctx.fillStyle = pal.muted;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.save();
    try { (ctx as unknown as { letterSpacing: string }).letterSpacing = '4px'; } catch { /* older canvas */ }
    ctx.fillText(brandLabel.toUpperCase().slice(0, 40), contentLeft, PAD + 30);
    ctx.restore();
  }

  // --- Accent rule above the title. ---
  const titleBoxTop = SIZE * (isCover ? 0.30 : 0.24);
  const ruleY = titleBoxTop - 46;
  ctx.fillStyle = accent;
  roundRect(ctx, contentLeft, ruleY, 96, 12, 6);
  ctx.fill();

  // --- Title (auto-fit) ---
  const titleMaxH = SIZE * (isCover ? 0.42 : 0.40);
  const { lines, lineHeight, size } = fitTitle(
    ctx,
    slide.title || '',
    contentWidth,
    titleMaxH,
    '800',
    isCover ? 118 : 92,
    44,
  );
  ctx.font = `800 ${size}px -apple-system, "Helvetica Neue", "Segoe UI", Arial, sans-serif`;
  ctx.fillStyle = pal.title;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let y = titleBoxTop;
  for (const ln of lines) {
    ctx.fillText(ln, contentLeft, y);
    y += lineHeight;
  }

  // --- Optional subtitle line under the title. ---
  const subtitle = (slide.subtitle || '').trim();
  if (subtitle) {
    const subSize = Math.max(30, Math.min(46, Math.round(size * 0.46)));
    ctx.font = `500 ${subSize}px -apple-system, "Helvetica Neue", "Segoe UI", Arial, sans-serif`;
    ctx.fillStyle = pal.body;
    const subLines = wrapLines(ctx, subtitle, contentWidth).slice(0, 4);
    let sy = y + subSize * 0.6;
    for (const ln of subLines) {
      ctx.fillText(ln, contentLeft, sy);
      sy += subSize * 1.28;
    }
  }

  // --- Footer: brand (logo/dot + label) left, slide number right. ---
  ctx.textBaseline = 'middle';
  let footerX = contentLeft;
  if (logo) {
    const h = 52;
    const w = Math.min(180, (logo.width / logo.height) * h || h);
    ctx.drawImage(logo, footerX, footerY - h / 2, w, h);
    footerX += w + 18;
    if (brandLabel) {
      ctx.font = `600 28px -apple-system, "Helvetica Neue", "Segoe UI", Arial, sans-serif`;
      ctx.fillStyle = pal.name;
      ctx.textAlign = 'left';
      ctx.fillText(brandLabel.slice(0, 30), footerX, footerY);
    }
  } else if (brandLabel) {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(footerX + 11, footerY, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `600 28px -apple-system, "Helvetica Neue", "Segoe UI", Arial, sans-serif`;
    ctx.fillStyle = pal.name;
    ctx.textAlign = 'left';
    ctx.fillText(brandLabel.slice(0, 30), footerX + 30, footerY);
  }

  ctx.font = `600 28px -apple-system, "Helvetica Neue", "Segoe UI", Arial, sans-serif`;
  ctx.fillStyle = pal.muted;
  ctx.textAlign = 'right';
  ctx.fillText(`${index + 1} / ${total}`, SIZE - PAD, footerY);

  const blob = await canvasToBlob(canvas);
  const dataUrl = canvas.toDataURL('image/png');
  const name = `slide-${String(index + 1).padStart(2, '0')}.png`;
  return { name, dataUrl, blob };
}

/** Small rounded-rect path helper. */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Render every carousel slide to a real square PNG. Returns them in order so the
 * dialog can both PREVIEW (dataUrl) and DOWNLOAD (blob) the exact same images.
 */
export async function renderCarousel(
  slides: CarouselSlideInput[],
  brand: CarouselBrand,
): Promise<RenderedCarouselSlide[]> {
  if (typeof document === 'undefined') return [];
  const logo = brand.logoDataUrl ? await loadImage(brand.logoDataUrl) : null;
  const total = slides.length;
  const out: RenderedCarouselSlide[] = [];
  for (let i = 0; i < total; i++) {
    out.push(await renderOne(slides[i], i, total, brand, logo));
  }
  return out;
}

/** Bundle the rendered slides into a single .zip and trigger a download. */
export async function downloadCarouselZip(
  slides: RenderedCarouselSlide[],
  baseName: string,
): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder('carousel') ?? zip;
  for (const s of slides) folder.file(s.name, s.blob);
  const content = await zip.generateAsync({ type: 'blob' });
  const safe = (baseName || 'carousel').replace(/[^a-z0-9\- ]/gi, '').trim().replace(/\s+/g, '-').slice(0, 50) || 'carousel';
  triggerDownload(content, `${safe}-instagram-carousel.zip`);
}

/** Trigger a browser download of a blob. */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
