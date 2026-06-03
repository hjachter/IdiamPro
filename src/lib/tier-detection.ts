/**
 * Tier Detection — launch tier model for Auth Phase 3 (#33 / #34).
 *
 * The launch product surfaces FOUR user-visible tiers, which are layered
 * on top of the older entitlements model (src/lib/entitlements):
 *
 *   free-trial : new user, no BYOK key — 25 trial generations TOTAL (one-time,
 *                NOT monthly). After 25, must add a BYOK key or upgrade.
 *   free-byok  : free tier user who supplied their own model API key —
 *                unlimited (their key, their bill); counter is bypassed.
 *   student    : $4.99/mo, 200 generations / month. Requires .edu email +
 *                honor-system checkbox at signup (real verification post-launch).
 *   pro        : $9.99/mo (or $89/yr), 1,000 generations / month + Pro-only
 *                features (podcast / image generation) + priority support.
 *                BYOK on Pro bypasses the counter entirely.
 *
 * The tier is computed CLIENT-SIDE for now: until Clerk + RevenueCat keys
 * are wired we have no reliable subscription source-of-truth, so we treat
 * every user as 'free-trial' (or 'free-byok' if a BYOK key is present) by
 * default. A future Clerk webhook → localStorage shim will supply the paid
 * tier id; that shim only needs to write the `idiampro-tier-id` localStorage
 * key — no call-site changes will be needed.
 *
 * Important: this module is independent of the older
 * isEnforcementActive() switch, because the launch counter is purposely
 * shown to ALL users (so they can see "X of 25 trial generations" before
 * they pay anything). It only enforces the cap; UI display is unconditional.
 */

import { BYOK_PROVIDERS, getUserApiKey } from '@/lib/byok-keys';

export type LaunchTierId = 'free-trial' | 'free-byok' | 'student' | 'pro';

/** Marker for "no cap" — used by getTierCap. */
export const UNLIMITED = Number.POSITIVE_INFINITY;

/**
 * Pro-only feature keys. Lower tiers see these in the UI with a "Pro" badge;
 * clicking them opens an upgrade dialog instead of hiding the feature
 * (per the locked product decision — better for discovery / upsell).
 */
export type ProOnlyFeature = 'podcastGeneration' | 'imageGeneration';

const PRO_ONLY_FEATURES: ReadonlySet<ProOnlyFeature> = new Set<ProOnlyFeature>([
  'podcastGeneration',
  'imageGeneration',
]);

export function isProOnlyFeature(featureKey: string): featureKey is ProOnlyFeature {
  return PRO_ONLY_FEATURES.has(featureKey as ProOnlyFeature);
}

/** True if ANY BYOK key (any supported provider) is configured. */
export function hasAnyByokKey(): boolean {
  if (typeof window === 'undefined') return false;
  for (const p of BYOK_PROVIDERS) {
    if (getUserApiKey(p)) return true;
  }
  return false;
}

const TIER_STORAGE_KEY = 'idiampro-tier-id';

/**
 * Read the user's paid tier id if one was set by an upstream sync (Clerk
 * publicMetadata, a RevenueCat webhook, or a test seed). Returns null if
 * not set. A simple localStorage shim today; the future Clerk integration
 * will write this value and the rest of the app will not need to change.
 */
function readPaidTierId(): 'student' | 'pro' | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(TIER_STORAGE_KEY);
    if (v === 'student' || v === 'pro') return v;
  } catch {
    /* fall through */
  }
  return null;
}

/**
 * Resolve the current launch tier id, client-side.
 *
 *  paid tier present? → 'student' | 'pro'
 *  else BYOK key present? → 'free-byok'
 *  else → 'free-trial'
 *
 * On the server (no window) returns 'free-trial' as a conservative default.
 */
export function getCurrentTier(): LaunchTierId {
  const paid = readPaidTierId();
  if (paid) return paid;
  if (hasAnyByokKey()) return 'free-byok';
  return 'free-trial';
}

/**
 * Monthly generation cap for the tier. -1 (Infinity) = unlimited.
 *
 * NOTE on free-trial: 25 is a ONE-TIME trial total — NOT a monthly cap.
 * The counter does not auto-reset for free-trial users on month rollover;
 * the gate enforces this by checking the cap once the user has run out
 * regardless of month. (Counter month-key rolls over normally, so the
 * counter UI shows "X of 25" until they pay or add a BYOK key — we don't
 * reset their consumed quota.)
 *
 * Practical implementation: getCumulativeUsage() (in ai-usage-gate.ts)
 * stores a separate "trial used total" key that the gate consults for
 * free-trial users. The monthly-bucket counter is still useful for paid
 * tiers (200 student, 1000 pro), so we keep both.
 */
export function getTierCap(tier: LaunchTierId): number {
  switch (tier) {
    case 'free-trial':
      return 25;
    case 'free-byok':
      return UNLIMITED;
    case 'student':
      return 200;
    case 'pro':
      return 1000;
  }
}

/** Human-readable name for UI. */
export function getTierDisplayName(tier: LaunchTierId): string {
  switch (tier) {
    case 'free-trial':
      return 'Free trial';
    case 'free-byok':
      return 'Free (BYOK)';
    case 'student':
      return 'Student';
    case 'pro':
      return 'Pro';
  }
}

/**
 * TEST/DEBUG ONLY: seed the paid tier id directly. Used by
 * tests/tier-enforcement-test.js. Pass null to clear.
 */
export function _seedPaidTierForTest(tier: 'student' | 'pro' | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (tier === null) window.localStorage.removeItem(TIER_STORAGE_KEY);
    else window.localStorage.setItem(TIER_STORAGE_KEY, tier);
  } catch {
    /* best-effort */
  }
}
