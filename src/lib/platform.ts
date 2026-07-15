/**
 * Platform / runtime detection for IdiamPro.
 *
 * IdiamPro ships through three runtimes — Electron (macOS/Windows/Linux
 * desktop), a Capacitor native shell (iOS, eventually Android), and the
 * plain web build on Vercel. User-facing help text frequently needs to be
 * different for each one (e.g. "open System Settings" vs. "click the mic
 * icon in the address bar"), so this helper gives the rest of the app a
 * single place to ask "where am I running?" without sprinkling
 * window-shape checks everywhere.
 *
 * SSR-safe: returns `runtime: 'web'` and `os: 'unknown'` on the server.
 */

export type Runtime = 'electron' | 'web' | 'capacitor-ios' | 'capacitor-android';
export type Os = 'macos' | 'windows' | 'linux' | 'ios' | 'android' | 'unknown';

export interface PlatformContext {
  runtime: Runtime;
  os: Os;
}

function detectRuntime(): Runtime {
  if (typeof window === 'undefined') return 'web';

  // Electron preload exposes window.electronAPI (see electron/preload.js).
  // Fallback to process.versions.electron for sanity checks.
  const w = window as unknown as {
    electronAPI?: { isElectron?: boolean };
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
    };
    process?: { versions?: { electron?: string } };
  };
  if (w.electronAPI?.isElectron === true) return 'electron';
  if (w.process?.versions?.electron) return 'electron';

  // Capacitor native shell — getPlatform returns 'ios' | 'android' | 'web'.
  const cap = w.Capacitor;
  if (cap?.isNativePlatform?.()) {
    const p = cap.getPlatform?.();
    if (p === 'ios') return 'capacitor-ios';
    if (p === 'android') return 'capacitor-android';
  }

  return 'web';
}

function detectOs(runtime: Runtime): Os {
  if (runtime === 'capacitor-ios') return 'ios';
  if (runtime === 'capacitor-android') return 'android';
  if (typeof navigator === 'undefined') return 'unknown';

  const ua = (navigator.userAgent || '').toLowerCase();
  const plat = (navigator.platform || '').toLowerCase();

  // iPad on iPadOS 13+ reports as Macintosh in UA — disambiguate via touch.
  const isIpadOs =
    ua.includes('macintosh') &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1;
  if (isIpadOs) return 'ios';

  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  if (/mac/.test(plat) || /mac os x|macintosh/.test(ua)) return 'macos';
  if (/win/.test(plat) || /windows/.test(ua)) return 'windows';
  if (/linux/.test(plat) || /linux/.test(ua)) return 'linux';
  return 'unknown';
}

export function getPlatformContext(): PlatformContext {
  const runtime = detectRuntime();
  const os = detectOs(runtime);
  return { runtime, os };
}
