/**
 * Free-tier "taste" quota for Generate Video.
 *
 * Non-Pro users get a LIFETIME allowance of FREE_VIDEO_LIMIT video renders.
 * During those renders the video carries a subtle "Made with IDMPro"
 * watermark. After the allowance is spent, the render is blocked and the
 * shared upgrade prompt is shown. Pro users are unlimited and unmarked and
 * never touch this counter.
 *
 * This is intentionally a SEPARATE, LIFETIME counter — not the monthly
 * ai-usage-counter bucket. Video is a one-off "try it" taste, so the count
 * must persist forever (never reset on month rollover). Stored as a single
 * integer in localStorage. Every read/write is wrapped in try/catch so a
 * storage glitch never blocks or crashes the feature (fail-safe: a read
 * error reports 0 used, which is the least-punishing default).
 */

export const FREE_VIDEO_LIMIT = 10;

const STORAGE_KEY = 'idiampro:video-free-used';

/** Lifetime count of free (non-Pro) video renders already used. */
export function getFreeVideosUsed(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** How many free renders remain (never negative). */
export function getFreeVideosRemaining(): number {
  return Math.max(0, FREE_VIDEO_LIMIT - getFreeVideosUsed());
}

/** True once the free allowance is fully spent. */
export function isFreeVideoQuotaExhausted(): boolean {
  return getFreeVideosUsed() >= FREE_VIDEO_LIMIT;
}

/**
 * Record one successful free render. Call this ONLY after a render succeeds
 * (never on failure/cancel). Returns the new used-count. Never throws.
 */
export function incrementFreeVideosUsed(): number {
  const next = getFreeVideosUsed() + 1;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* best-effort — a write failure must not break the feature */
    }
  }
  return next;
}

/** TEST/DEBUG ONLY: seed the counter directly. */
export function _seedFreeVideosForTest(count: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Math.max(0, count)));
  } catch {
    /* best-effort */
  }
}
