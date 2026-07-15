/**
 * Video style / branding for the Generate Video feature.
 *
 * Holds the user's chosen look for their slideshow videos — theme, accent
 * color, brand label, and an optional logo. Persisted in localStorage so the
 * dialog defaults to their last customization next time. Consumed by the
 * Electron render pipeline (electron/video-generator.js) via the args object.
 */

import type { OpenAIVoice } from '@/types';

export interface VideoStyle {
  theme: 'dark' | 'light';
  accent: string;
  brandLabel: string;
  logoDataUrl: string;
  voice: OpenAIVoice;
}

export const DEFAULT_VIDEO_STYLE: VideoStyle = {
  theme: 'dark',
  accent: '#3898ff',
  brandLabel: 'IdiamPro',
  logoDataUrl: '',
  voice: 'nova',
};

// Curated accent presets shown as swatches in the Style section.
export const ACCENT_PRESETS: { name: string; hex: string }[] = [
  { name: 'IdiamPro Blue', hex: '#3898ff' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Slate', hex: '#64748b' },
];

const STORAGE_KEY = 'idiampro:video-style';

// Above this size we refuse to PERSIST a logo blob (localStorage is small and
// shared). The logo can still be used for the current render — we just don't
// save it across sessions.
const MAX_PERSISTED_LOGO_BYTES = 1_500_000;

/**
 * Load the saved video style, merged over the defaults so any missing field is
 * safe. Never throws — returns defaults on any parse/storage error.
 */
export function loadVideoStyle(): VideoStyle {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_VIDEO_STYLE };
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VIDEO_STYLE };
    const parsed = JSON.parse(raw) as Partial<VideoStyle>;
    const theme: 'dark' | 'light' = parsed.theme === 'light' ? 'light' : 'dark';
    return {
      ...DEFAULT_VIDEO_STYLE,
      ...parsed,
      theme,
    };
  } catch {
    return { ...DEFAULT_VIDEO_STYLE };
  }
}

/**
 * Persist the video style. A logo larger than ~1.5MB is dropped from what we
 * SAVE (to avoid bloating localStorage) — the caller keeps the in-memory copy
 * for the current render. Never throws.
 */
export function saveVideoStyle(s: VideoStyle): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const toStore: VideoStyle = { ...s };
    if (toStore.logoDataUrl && toStore.logoDataUrl.length > MAX_PERSISTED_LOGO_BYTES) {
      toStore.logoDataUrl = '';
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    /* best-effort — a full or unavailable localStorage should never break the UI */
  }
}
