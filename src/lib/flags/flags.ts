/**
 * Feature Switchboard — the shared flag model (CLIENT-SAFE, no server imports).
 *
 * This is the single source of truth for WHICH feature flags exist and their
 * SAFE default state. It is imported by BOTH the server (flag-store.ts, the
 * admin + public API routes) and the client (feature-flags-provider.tsx), so
 * it must never import anything server-only (no @vercel/kv, no Clerk, no fs).
 *
 * A "flag" is a server-driven remote switch that turns a shipped feature on or
 * off for a targeted audience, WITHOUT a code deploy. v1 supports a simple
 * three-way audience (everyone / free-only / pro-only). Percentage rollout and
 * per-user targeting are explicitly deferred to v1.1 — see the EXTENSION POINT
 * note on FeatureFlag below; do not add them here without updating the store,
 * the APIs, the provider, and the admin UI together.
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ FAIL-SAFE CONTRACT — the app must NEVER be blocked by the flag system. │
 * │  • If flags can't be fetched, resolution falls back to DEFAULT_FLAGS.  │
 * │  • A flag key missing from DEFAULT_FLAGS resolves to ENABLED (we do    │
 * │    not hide a feature just because someone forgot to register it) — a  │
 * │    warning is logged so the omission is visible.                       │
 * │  • Defaults are chosen so "flags unreachable" === "today's behavior".  │
 * └───────────────────────────────────────────────────────────────────────┘
 */

/** Who a flag applies to. 'all' = everyone; 'free' = only non-Pro users;
 *  'pro' = only Pro users. (v1.1 extension point: add 'percentage' / per-user
 *  targeting as additional, optional fields — never by overloading this enum.) */
export type FlagAudience = 'all' | 'free' | 'pro';

/** One remote-controlled feature switch. */
export interface FeatureFlag {
  /** Stable identifier used in code (useFeatureFlag('generate-video')). */
  key: string;
  /** Short human label shown in the admin Switchboard. */
  label: string;
  /** One-line plain-language description of what the flag gates. */
  description: string;
  /** Master on/off. false = killed for everyone regardless of audience. */
  enabled: boolean;
  /** Which audience the (enabled) flag applies to. */
  audience: FlagAudience;
  // v1.1 EXTENSION POINT: add optional `rolloutPercent?: number` and/or
  // `allowUserIds?: string[]` here, and teach isFeatureEnabled() + the admin
  // UI about them. Keep them optional so existing overrides stay valid.
}

/** The subset of a flag an admin may override at runtime. key/label/description
 *  are fixed in code; only enabled + audience are remotely tunable in v1. */
export interface FlagOverride {
  enabled: boolean;
  audience: FlagAudience;
}

/**
 * DEFAULT_FLAGS — the registry of every flag that exists, with its SAFE
 * default state. "Safe" means: if the override store is unreachable, these
 * values reproduce the app's current shipped behavior exactly.
 */
export const DEFAULT_FLAGS: readonly FeatureFlag[] = [
  {
    key: 'generate-video',
    label: 'Generate Video',
    description:
      'The "Generate Video" entry point that turns a chapter into a narrated slideshow video. Default on for everyone; the desktop-only and Pro/free-taste rules still apply underneath.',
    enabled: true,
    audience: 'all',
  },
];

/** Look up a flag's coded default by key, or undefined if unregistered. */
export function getDefaultFlag(key: string): FeatureFlag | undefined {
  return DEFAULT_FLAGS.find((f) => f.key === key);
}

/** Valid audience values, for validating admin writes. */
export const FLAG_AUDIENCES: readonly FlagAudience[] = ['all', 'free', 'pro'];

/** Human label for an audience, for the admin UI + tooltips. */
export function audienceLabel(audience: FlagAudience): string {
  switch (audience) {
    case 'all':
      return 'Everyone';
    case 'free':
      return 'Free only';
    case 'pro':
      return 'Pro only';
    default:
      return 'Everyone';
  }
}

/**
 * Does `audience` include a user whose Pro-ness is `isPro`?
 *  all  → everyone
 *  free → only non-Pro
 *  pro  → only Pro
 */
export function audienceMatches(audience: FlagAudience, isPro: boolean): boolean {
  switch (audience) {
    case 'all':
      return true;
    case 'free':
      return !isPro;
    case 'pro':
      return isPro;
    default:
      return true;
  }
}

/**
 * Resolve whether feature `key` is ON for a user, given the effective flag
 * list and whether that user is Pro.
 *
 * FAIL-SAFE: if `key` is absent from BOTH the provided list AND DEFAULT_FLAGS,
 * we return true (never hide an unregistered feature) and log a warning.
 * A present-but-disabled flag returns false. Audience is only consulted when
 * the flag is enabled.
 */
export function isFeatureEnabled(
  key: string,
  flags: readonly FeatureFlag[] | null | undefined,
  isPro: boolean,
): boolean {
  const list = flags && flags.length > 0 ? flags : DEFAULT_FLAGS;
  const flag = list.find((f) => f.key === key) ?? getDefaultFlag(key);
  if (!flag) {
    // Unregistered key — fail OPEN (show the feature) but make it visible.
    // eslint-disable-next-line no-console
    console.warn(
      `[feature-flags] unknown flag "${key}" — resolving to ENABLED (add it to DEFAULT_FLAGS to control it).`,
    );
    return true;
  }
  if (!flag.enabled) return false;
  return audienceMatches(flag.audience, isPro);
}

/**
 * Merge a map of admin overrides onto DEFAULT_FLAGS, producing the effective
 * flag list. Only `enabled` + `audience` are overridable; label/description/
 * key always come from code. Unknown override keys (a flag removed from code)
 * are ignored. Never throws.
 */
export function mergeOverrides(
  overrides: Record<string, Partial<FlagOverride>> | null | undefined,
): FeatureFlag[] {
  return DEFAULT_FLAGS.map((def) => {
    const o = overrides?.[def.key];
    if (!o) return { ...def };
    const enabled = typeof o.enabled === 'boolean' ? o.enabled : def.enabled;
    const audience =
      o.audience && FLAG_AUDIENCES.includes(o.audience)
        ? o.audience
        : def.audience;
    return { ...def, enabled, audience };
  });
}
