/**
 * parse-platform — turn a raw user-agent string (and optional Capacitor
 * platform hint) into a clean, human-readable label like
 * `"Mac Desktop (Electron)"` or `"Web (Safari on iOS)"`.
 *
 * Used by the in-app Report Issue feature: the client passes whatever it
 * KNOWS about its environment (UA + Capacitor.getPlatform() if Capacitor
 * is loaded), the server backstops with a UA-only parse when the client
 * omits the field. Same parser either way.
 *
 * Pure function, no side effects. Easy to unit-test.
 *
 * Examples:
 *   parsePlatform('Mozilla/5.0 (Macintosh; ...) Electron/28.0.0 ...')
 *     -> "Mac Desktop (Electron)"
 *   parsePlatform('Mozilla/5.0 (Windows NT 10.0; ...) Electron/28.0.0 ...')
 *     -> "Windows Desktop (Electron)"
 *   parsePlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ...', 'ios')
 *     -> "iOS (Capacitor, iPhone)"
 *   parsePlatform('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) ...', 'ios')
 *     -> "iOS (Capacitor, iPad)"
 *   parsePlatform('Mozilla/5.0 (Linux; Android 13; ...) ...', 'android')
 *     -> "Android (Capacitor)"
 *   parsePlatform('Mozilla/5.0 (Macintosh; ...) AppleWebKit/... Chrome/120 Safari/...')
 *     -> "Web (Chrome on macOS)"
 *   parsePlatform('Mozilla/5.0 (Windows NT 10.0; ...) Edg/120 ...')
 *     -> "Web (Edge on Windows)"
 *   parsePlatform('') -> "Unknown"
 */

export type CapacitorPlatform = 'ios' | 'android' | 'web' | string | undefined;

function detectElectronOs(ua: string): string {
  if (/Mac OS X|Macintosh/i.test(ua)) return 'Mac Desktop (Electron)';
  if (/Windows/i.test(ua)) return 'Windows Desktop (Electron)';
  if (/Linux/i.test(ua)) return 'Linux Desktop (Electron)';
  return 'Desktop (Electron)';
}

function detectBrowserOs(ua: string): string {
  // Order matters: iOS/Android first so they don't get caught by the
  // generic "Mac OS X" / "Linux" matches their UA strings inherit.
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Unknown OS';
}

function detectBrowser(ua: string): string {
  // Edge ships its UA token as "Edg/" — must be checked BEFORE Chrome
  // because Edge also includes "Chrome/" in its UA for compat.
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/OPR\/|Opera/i.test(ua)) return 'Opera';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/Chrome\//i.test(ua)) return 'Chrome';
  // Safari ships "Safari/" but Chrome/Edge/Opera all do too — Safari is
  // the LAST resort after the others are ruled out.
  if (/Safari\//i.test(ua)) return 'Safari';
  return 'Unknown browser';
}

export function parsePlatform(
  userAgent: string,
  capacitorPlatform?: CapacitorPlatform,
): string {
  const ua = (userAgent ?? '').trim();
  const cap = (capacitorPlatform ?? '').toString().toLowerCase();

  // 1) Electron — Chromium-in-a-shell sets "Electron/X.Y.Z" in the UA.
  if (/Electron\//i.test(ua)) {
    return detectElectronOs(ua);
  }

  // 2) Capacitor native — the client passes 'ios' or 'android' when it
  //    detects Capacitor.isNativePlatform(). 'web' falls through to the
  //    browser branch (Capacitor on the web is just… the browser).
  if (cap === 'ios') {
    if (/iPad/i.test(ua)) return 'iOS (Capacitor, iPad)';
    if (/iPhone|iPod/i.test(ua)) return 'iOS (Capacitor, iPhone)';
    return 'iOS (Capacitor)';
  }
  if (cap === 'android') {
    return 'Android (Capacitor)';
  }

  // 3) Plain browser — parse OS + browser separately and combine.
  if (!ua) return 'Unknown';
  const os = detectBrowserOs(ua);
  const browser = detectBrowser(ua);
  if (os === 'Unknown OS' && browser === 'Unknown browser') return 'Unknown';
  return `Web (${browser} on ${os})`;
}

export default parsePlatform;
