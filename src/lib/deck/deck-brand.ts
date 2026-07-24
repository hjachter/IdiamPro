/**
 * Brand tokens for the "Turn Into a Slide Deck" (.pptx) export.
 *
 * These MATCH the app's existing brand look so an exported deck feels like the
 * same product as the Generate Video slide engine (src/lib/video/video-style.ts)
 * and the marketing website (src/app/page.tsx). Kept in ONE place so the deck,
 * the video, and the site never drift apart.
 *
 * Colors are stored as bare hex (no leading '#') because pptxgenjs wants them
 * that way. The default dark palette is the video engine's dark theme; the
 * accent is IdeaM Blue (#3898ff); the deep blues (#2563eb / #1d4ed8) are the
 * logo/marketing gradient.
 */

export interface DeckBrand {
  /** 'dark' (default, matches the video engine) or 'light'. */
  theme: 'dark' | 'light';
  /** Bare-hex accent (no '#'). Defaults to IdeaM Blue. */
  accent: string;
  /** Small wordmark shown in the footer of every slide. */
  brandLabel: string;
}

export const DECK_FONT = 'IBM Plex Sans';

// IdeaM Blue — the same accent the video engine defaults to (#3898ff).
export const DECK_DEFAULT_ACCENT = '3898FF';
// The logo / marketing gradient blues (used for the native logo mark).
export const DECK_LOGO_BLUE = '2563EB';
export const DECK_LOGO_BLUE_DEEP = '1D4ED8';

export const DEFAULT_DECK_BRAND: DeckBrand = {
  theme: 'dark',
  accent: DECK_DEFAULT_ACCENT,
  brandLabel: 'IdeaM',
};

/** A resolved color set for one theme — everything the builder needs to paint. */
export interface DeckPalette {
  bg: string;        // slide background
  panel: string;     // secondary surface / chart plot area
  text: string;      // primary text
  muted: string;     // secondary text / page numbers
  accent: string;    // accent (from brand)
  accentSoft: string;// a second series color for charts
  line: string;      // hairlines / dividers
}

/** Normalize a user hex (with or without '#') to bare uppercase hex. */
export function normalizeHex(hex: string | undefined, fallback: string): string {
  if (!hex) return fallback;
  const h = hex.replace('#', '').trim();
  return /^[0-9a-fA-F]{6}$/.test(h) ? h.toUpperCase() : fallback;
}

/** Build the concrete palette for a brand/theme. */
export function resolvePalette(brand: DeckBrand): DeckPalette {
  const accent = normalizeHex(brand.accent, DECK_DEFAULT_ACCENT);
  if (brand.theme === 'light') {
    return {
      bg: 'FFFFFF',
      panel: 'F3F6FB',
      text: '0B1220',
      muted: '64748B',
      accent,
      accentSoft: DECK_LOGO_BLUE,
      line: 'DDE5F2',
    };
  }
  // Dark — matches the video engine's dark slide gradient base.
  return {
    bg: '0A1120',
    panel: '0F1A30',
    text: 'F5F8FF',
    muted: '93A4B8',
    accent,
    accentSoft: DECK_LOGO_BLUE,
    line: '1E2A44',
  };
}
