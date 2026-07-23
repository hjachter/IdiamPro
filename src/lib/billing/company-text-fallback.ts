/**
 * Company-key fallback gate for CLOUD TEXT AI — SERVER-ONLY. SAFETY STOPGAP.
 *
 * WHY THIS EXISTS (2026-07-23):
 *   Every cloud text-AI feature (the email / social / Your Voice wizards, the
 *   AI command bar, summarize / transform / reformat / translate, research &
 *   email import, title & summary generation, Help chat, Ask-your-outlines
 *   knowledge chat, podcast script) ultimately resolves an API key. Historically
 *   the resolver SILENTLY fell back to the app's OWN env key (GEMINI_API_KEY /
 *   GOOGLE_API_KEY, i.e. the founder's personal/company key) whenever the user
 *   had not supplied their own (BYOK) key. The only cap was a bypassable
 *   client-side counter. That means free / unauthenticated users could run
 *   generations billed to us, uncapped.
 *
 *   Until the real SERVER-SIDE per-account meter is built, this gate keeps the
 *   company-key fallback FAIL-CLOSED. A cloud text call may use ONLY the user's
 *   OWN key. When the user has no key, the request must NOT hit our company key —
 *   instead it uses the on-device path (Ollama/Gemma) if available, or returns a
 *   clear, friendly, non-crashing "add your key / switch to on-device" message.
 *
 *   This is a SINGLE GUARDED SWITCH. To re-enable the company-funded fallback
 *   later (behind the real meter), set env ALLOW_COMPANY_TEXT_FALLBACK=true.
 *   The DEFAULT / effective behavior today is: OFF (no company-key fallback).
 *
 *   NOTE: this gate is deliberately independent of any client-supplied
 *   "is BYOK" flag — those flags are client-controlled and not trustworthy for
 *   a cost guarantee. The gate is a pure server-side environment switch.
 */

/**
 * Is the company-funded fallback for CLOUD TEXT AI enabled? True ONLY when the
 * server explicitly opts in via ALLOW_COMPANY_TEXT_FALLBACK=true. Defaults to
 * FALSE everywhere else (including when process.env is unavailable), so the
 * safe/closed behavior is the default.
 */
export function isCompanyTextFallbackEnabled(): boolean {
  if (typeof process === 'undefined' || !process.env) return false;
  return process.env.ALLOW_COMPANY_TEXT_FALLBACK === 'true';
}

/** Friendly, non-technical message shown when no usable key is available. */
export const NO_USER_KEY_MESSAGE =
  'To use cloud AI, add your own API key in Settings → AI Service Keys, or switch to on-device AI (Ollama) in Settings. Cloud AI without your own key is turned off right now.';

/**
 * Thrown when a cloud text call has no user key and the company-key fallback is
 * disabled. Carries a stable `code` so callers can recognize it across module
 * boundaries (instanceof is not always reliable through bundlers).
 */
export class NoCompanyKeyError extends Error {
  readonly code = 'NO_COMPANY_KEY';
  constructor(message: string = NO_USER_KEY_MESSAGE) {
    super(message);
    this.name = 'NoCompanyKeyError';
  }
}

/** Recognize a NoCompanyKeyError regardless of how it crossed a boundary. */
export function isNoCompanyKeyError(e: unknown): boolean {
  if (e instanceof NoCompanyKeyError) return true;
  return (
    typeof e === 'object' &&
    e !== null &&
    (e as { code?: unknown }).code === 'NO_COMPANY_KEY'
  );
}
