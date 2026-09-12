/**
 * Lyria (AI music bed) — client-side constants + the honest money wording
 * (content-compiler Phase 3C).
 *
 * MONEY-HONESTY (non-negotiable, see CLAUDE.md + ai-cost-model.ts):
 *   - The music bed bills REAL MONEY per generated clip, by Google, directly
 *     to the USER'S OWN Gemini key. Never our key, never a dev/env key.
 *   - Every string here uses "typically…" ranges and says WHO bills WHOM.
 *     Never an exact promise, never "free", always "estimates only".
 *
 * PRICING BASIS (researched 2026-09, ai.google.dev/gemini-api/docs/pricing):
 *   Lyria 3 Clip (lyria-3-clip-preview) ≈ $0.04 per generated 30-second clip
 *   (the full-song lyria-3.5 is ≈ $0.08 — we use the clip tier and loop it).
 *   One video needs ONE clip, so music typically costs about a nickel —
 *   surfaced to users as "typically about 5 to 10 cents per video" so the
 *   estimate stays honest through modest price drift. If Google's pricing
 *   moves materially, update the range here (single source of truth).
 *
 * The model id must stay in sync with LYRIA_DEFAULT_MODEL in
 * electron/lyria-renderer.js (asserted by tests/lyria-renderer-test.js).
 */

/** The Lyria model the app requests (30-second clip tier — cheapest). */
export const LYRIA_MODEL_ID = 'lyria-3-clip-preview';

/** Seconds of music per generated clip (fixed by the clip model; loops). */
export const LYRIA_BED_SECONDS = 30;

/** Honest per-video estimate bounds, in whole US cents (range, never exact). */
export const LYRIA_EST_LOW_CENTS = 5;
export const LYRIA_EST_HIGH_CENTS = 10;

/** "typically about 5 to 10 cents per video" — the shared music phrase. */
export function lyriaPerVideoPhrase(): string {
  return `typically about ${LYRIA_EST_LOW_CENTS} to ${LYRIA_EST_HIGH_CENTS} cents per video`;
}

/**
 * P2 confirm line for a run WITH the music bed on — appended to the video
 * confirm's scope note. Fresh runs generate (and price) the bed; update
 * re-stitches reuse an already-generated bed at no new charge, and the
 * wording says which is which.
 */
export function lyriaMusicScopeNote(mode: 'fresh' | 'update'): string {
  if (mode === 'update') {
    return 'Plus a soft AI music bed under the narration — a bed you’ve already ' +
      'generated is reused, not billed again; otherwise one short generated track, ' +
      `${lyriaPerVideoPhrase()}, billed by Google to your key. Estimates only.`;
  }
  return 'Plus a soft AI music bed under the narration — one short generated track, ' +
    `${lyriaPerVideoPhrase()}, billed by Google to your key. Estimates only.`;
}
