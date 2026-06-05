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

// ---- Tier refresh (Stripe → RevenueCat → app) ---------------------------

const TIER_CACHE_KEY = 'idiampro-tier-cache';
const TIER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface TierCacheEntry {
  tier: 'student' | 'pro' | null;
  fetchedAt: number;
}

function readTierCache(): TierCacheEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(TIER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TierCacheEntry;
    if (typeof parsed?.fetchedAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeTierCache(tier: 'student' | 'pro' | null): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: TierCacheEntry = { tier, fetchedAt: Date.now() };
    window.localStorage.setItem(TIER_CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* best-effort */
  }
}

/**
 * Force a re-fetch of the user's paid tier. Call this after returning from
 * Stripe Checkout (the /upgrade/success page wires this up) so the new
 * entitlement shows up immediately rather than waiting for the next render.
 *
 * For v1 this is a localStorage-backed shim. Once Clerk + the RevenueCat
 * REST endpoint are wired client-side, replace the inner block with the
 * real fetch — call sites and the 5-minute cache window stay the same.
 */
export async function refreshTier(opts?: {
  appUserId?: string | null;
  force?: boolean;
}): Promise<LaunchTierId> {
  if (typeof window === 'undefined') return 'free-trial';
  const force = opts?.force === true;

  if (!force) {
    const cached = readTierCache();
    if (cached && Date.now() - cached.fetchedAt < TIER_CACHE_TTL_MS) {
      return getCurrentTier();
    }
  }

  // ---- v1 stub: read from localStorage (already done by readPaidTierId).
  // TODO: when REVENUECAT_API_KEY + Clerk are wired client-side, replace
  // this block with a fetch to /api/billing/entitlements?userId=... that
  // returns the active entitlement ids, then write 'student'/'pro' (or
  // clear) accordingly. The cache + call site stay unchanged.
  const paid = readPaidTierId();
  writeTierCache(paid);
  return getCurrentTier();
}

/** Clear the tier cache (e.g. after sign-out or manual reset). */
export function clearTierCache(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(TIER_CACHE_KEY);
  } catch {
    /* best-effort */
  }
}

// ---- Auth-aware helpers (Clerk integration) ----------------------------
//
// These helpers are SAFE to call without Clerk configured: when no
// publishable / secret key is set, `isAuthEnabled()` returns false and
// every helper falls back to the existing localStorage / anon behavior.
// That keeps local dev identical until real Clerk keys land.

const HAS_CLERK_SECRET_KEY =
  typeof process !== 'undefined' && Boolean(process.env?.CLERK_SECRET_KEY);
const HAS_CLERK_PUBLISHABLE_KEY = Boolean(
  process.env?.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

// NOTE: getServerUserId() was intentionally removed from this module after
// it broke the build — `@clerk/nextjs/server` is marked `server-only` and
// poisoned this file's client-side consumers (use-ai-usage-gate.tsx,
// outline-pro.tsx). Server-side user-id resolution should live in a
// dedicated server-only module (e.g. src/lib/tier-detection.server.ts) and
// be imported directly from server actions / route handlers, never from
// this client-safe file.

/**
 * CLIENT-SIDE: the existing `getCurrentTier()` already covers signed-in /
 * BYOK / paid-tier resolution from localStorage. When Clerk's `useUser()`
 * is wired into the AuthProvider bridge, the bridge writes the user id
 * into the existing tier resolution path — call sites stay unchanged.
 *
 * This helper exists so future code can ask "is this client even auth-
 * aware right now?" without importing Clerk directly. False in stub mode.
 */
export function isAuthAware(): boolean {
  return HAS_CLERK_PUBLISHABLE_KEY;
}
