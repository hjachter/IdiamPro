/**
 * Developer-only "simulate a free (non-Pro) user" override.
 *
 * PURPOSE: today the launch tier model treats the dev/desktop build very
 * permissively, so the owner can't easily preview what a real FREE user sees
 * (the Generate Video "X of 10 free" counter, the "Made with IdiamPro"
 * watermark path, and the Pro upgrade prompts). This flag forces the app to
 * treat the current session as a free / non-Pro user.
 *
 * SAFETY — this is a CLIENT-SIDE VIEW-ONLY override:
 *   - It changes only what the local UI shows/gates. It writes NO real tier
 *     change and grants NO server-side access.
 *   - It can only make gating STRICTER (force "free"), never looser, so it can
 *     never be abused to unlock a paid feature.
 *   - The single enforcement point is getCurrentTier() in tier-detection.ts,
 *     which short-circuits to the strictest free tier when this flag is on.
 *     Every Pro-gated surface reads that resolver, so one switch covers them
 *     all — no per-feature hacks.
 *
 * Persisted in localStorage so it survives reloads. Default OFF.
 */

/** localStorage key holding the simulate-free flag ('1' = on). */
export const DEV_SIMULATE_FREE_KEY = 'idiampro:dev-simulate-free';

/** Window event fired when the flag changes, so live indicators can update. */
export const DEV_SIMULATE_FREE_EVENT = 'idiampro:dev-simulate-free-changed';

/**
 * Fallback admin email — mirrors DEFAULT_ADMIN_EMAIL in
 * src/lib/access/admin.ts. The real allowlist (ADMIN_EMAILS) is server-only
 * and not readable in the client bundle, so in a PRODUCTION build the
 * Developer surface only reveals itself to this known owner email. (The
 * control is stricter-only, so even an over-permissive reveal could never
 * unlock anything.)
 */
const OWNER_ADMIN_EMAIL = 'hjachter@gmail.com';

/**
 * Should the developer-only Settings surface render at all?
 *
 *   (a) DEVELOPMENT build (NODE_ENV !== 'production') → always, so the owner
 *       sees it right now on the desktop dev build; OR
 *   (b) a signed-in admin (email matches the owner allowlist) in production.
 *
 * Returns false for a normal user in a production build → the section renders
 * nothing at all.
 */
export function isDeveloperSurfaceVisible(email?: string | null): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  const e = (email ?? '').trim().toLowerCase();
  return e.length > 0 && e === OWNER_ADMIN_EMAIL;
}

/** True when the current session is being forced to the free experience. */
export function isSimulatingFreeUser(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DEV_SIMULATE_FREE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Turn the simulate-free override on or off (persisted + broadcasts an event). */
export function setSimulateFreeUser(on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (on) window.localStorage.setItem(DEV_SIMULATE_FREE_KEY, '1');
    else window.localStorage.removeItem(DEV_SIMULATE_FREE_KEY);
    window.dispatchEvent(
      new CustomEvent(DEV_SIMULATE_FREE_EVENT, { detail: on }),
    );
  } catch {
    /* best-effort — a storage error must never break the app */
  }
}
