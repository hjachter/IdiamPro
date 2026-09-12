/**
 * Veo (real AI video) — client-side constants + the honest money wording
 * (content-compiler Phase 3B).
 *
 * MONEY-HONESTY (non-negotiable, see CLAUDE.md + ai-cost-model.ts):
 *   - Veo bills REAL DOLLARS per generated scene, by Google, directly to the
 *     USER'S OWN Gemini key. Never our key, never a dev/env key.
 *   - Every string here uses "typically…" ranges and says WHO bills WHOM.
 *     Never an exact promise, never "free", always "estimates only".
 *
 * PRICING BASIS (researched 2026-09, ai.google.dev/gemini-api/docs/pricing):
 *   Veo 3.1 Fast ≈ $0.15 per second of generated video; Standard ≈ $0.40/s.
 *   We request 8-second clips on the FAST model ⇒ ≈ $1.20/scene at today's
 *   price — surfaced to users as "typically about $1 to $2 per scene" so the
 *   estimate stays honest through modest price drift. If Google's pricing
 *   moves materially, update the range here (single source of truth).
 *
 * The model id must stay in sync with VEO_DEFAULT_MODEL in
 * electron/veo-renderer.js (asserted by tests/veo-renderer-test.js).
 */

/** The Veo model the app requests (Fast tier — cheapest cinematic option). */
export const VEO_MODEL_ID = 'veo-3.1-fast-generate-preview';

/** Seconds of video requested per scene (Veo max; loops under narration). */
export const VEO_SCENE_SECONDS = 8;

/** Honest per-scene estimate bounds, in whole USD (range, never exact). */
export const VEO_EST_LOW_PER_SCENE = 1;
export const VEO_EST_HIGH_PER_SCENE = 2;

function dollars(n: number): string {
  return `$${Math.max(1, Math.round(n))}`;
}

/** "typically about $1 to $2 per scene" — the shared per-scene phrase. */
export function veoPerScenePhrase(): string {
  return `typically about ${dollars(VEO_EST_LOW_PER_SCENE)} to ${dollars(VEO_EST_HIGH_PER_SCENE)} per scene`;
}

/**
 * P2 confirm scope wording for a FULL Veo run (first generation / Start
 * Fresh): scene count + per-scene range + rough total + who bills whom +
 * "estimates only".
 */
export function veoFreshScopeNote(sceneCount: number): string {
  const n = Math.max(1, sceneCount);
  const lo = dollars(n * VEO_EST_LOW_PER_SCENE);
  const hi = dollars(n * VEO_EST_HIGH_PER_SCENE);
  return `${n} scene${n === 1 ? '' : 's'} of AI-generated video — ${veoPerScenePhrase()} ` +
    `(roughly ${lo}–${hi} total), billed by Google to your key. Estimates only.`;
}

/**
 * P2 confirm scope wording for an UPDATE-CHANGED Veo run: the scoped changed
 * count is what gets billed; unchanged scenes are called out as already
 * generated and NOT billed again (the whole point of the scene cache).
 */
export function veoUpdateScopeNote(changed: number, total: number): string {
  const unchanged = Math.max(0, total - changed);
  if (changed <= 0) {
    return `Nothing has changed since your last video — all ${total} scenes are already ` +
      `generated and reused, so Google bills nothing new. The video is quickly reassembled.`;
  }
  const lo = dollars(changed * VEO_EST_LOW_PER_SCENE);
  const hi = dollars(changed * VEO_EST_HIGH_PER_SCENE);
  return `Updating ${changed} of ${total} scene${total === 1 ? '' : 's'} with AI-generated video — ` +
    `${veoPerScenePhrase()} (roughly ${lo}–${hi} for this update), billed by Google to your key. ` +
    `Estimates only. ${unchanged} scene${unchanged === 1 ? '' : 's'} unchanged — already generated, not billed again.`;
}
