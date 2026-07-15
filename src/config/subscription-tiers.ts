/**
 * Subscription Tier Registry
 *
 * Single source of truth for the app's billing tiers and what each one
 * unlocks. Adding/retuning a tier is a one-place edit here — no call-site
 * changes needed.
 *
 * Mirrors the GEMINI_MODELS pattern in src/config/gemini-models.ts (typed
 * entries, a Record keyed by id, helper getters, a DEFAULT_*_ID constant).
 *
 * Phase 1 scope: this file only *describes* tiers and entitlements. No
 * billing, no enforcement, no provider calls. Stripe (web) + RevenueCat
 * (iOS) wiring lands in a later phase. With no auth keys set, every user
 * resolves to DEFAULT_TIER_ID ('free') — see src/lib/auth/auth-config.ts.
 *
 * Entitlement keys are derived from concepts that already exist in the
 * codebase (AIFeatureFlags in src/lib/ai-service.ts, the BYOK posture,
 * the MCP premium-tools plan). Numeric limits marked TODO are placeholders
 * until the real product limits are decided.
 */

export type SubscriptionTierId = 'free' | 'pro' | 'premium';

/**
 * What a tier unlocks. Booleans are capability gates; numbers are limits
 * (use -1 to mean "unlimited"). Keep these generic — real enforcement is a
 * later phase and will read these flags rather than redefining them.
 */
export interface TierEntitlements {
  /** Max number of saved outlines. -1 = unlimited. TODO: confirm real free-tier cap. */
  maxOutlines: number;
  /** Which AI backend the tier may use: 'local' (Ollama only), 'cloud' (hosted Gemini), 'byok' (bring-your-own-key cloud). */
  aiProvider: 'local' | 'cloud' | 'byok';
  /** Bring-your-own-key allowed (user supplies their own Gemini/OpenAI key). */
  byok: boolean;
  /** Access to premium MCP server tools (see IdiamPro-MCP-Plan.idm). */
  mcpPremiumTools: boolean;
  /** Premium AI features: subtree summaries, teach mode, consistency checks (AIFeatureFlags). */
  premiumAIFeatures: boolean;
  /** Max AI generations per day. -1 = unlimited. TODO: confirm real quotas. */
  maxAIGenerationsPerDay: number;
  /** Priority/queue-skip for hosted AI calls. */
  priorityAI: boolean;
}

export interface SubscriptionTierEntry {
  /** Stable internal id used by billing, auth metadata, and UI. */
  id: SubscriptionTierId;
  /** Human-readable label (pricing page, account UI). */
  name: string;
  /** Marketing one-liner. */
  blurb: string;
  /** What this tier unlocks. */
  entitlements: TierEntitlements;
}

export const SUBSCRIPTION_TIERS: Record<SubscriptionTierId, SubscriptionTierEntry> = {
  free: {
    id: 'free',
    name: 'Free',
    blurb: 'Local-first outlining with on-device AI. No account required.',
    entitlements: {
      maxOutlines: -1, // local files on disk — not server-capped. TODO: confirm if a soft cap applies to synced/cloud outlines.
      aiProvider: 'local',
      byok: true, // BYOK has always been part of the free posture (see CLAUDE.md).
      mcpPremiumTools: false,
      premiumAIFeatures: false,
      maxAIGenerationsPerDay: 50, // TODO: placeholder — align with rate-limit.ts when hosted AI quotas are finalized.
      priorityAI: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    blurb: 'Hosted AI, higher limits, and premium AI features for serious researchers.',
    entitlements: {
      maxOutlines: -1, // TODO: confirm.
      aiProvider: 'cloud',
      byok: true,
      mcpPremiumTools: false,
      premiumAIFeatures: true,
      maxAIGenerationsPerDay: 500, // TODO: placeholder.
      priorityAI: false,
    },
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    blurb: 'Everything in Pro plus premium MCP tools, priority AI, and unlimited generations.',
    entitlements: {
      maxOutlines: -1,
      aiProvider: 'cloud',
      byok: true,
      mcpPremiumTools: true,
      premiumAIFeatures: true,
      maxAIGenerationsPerDay: -1, // unlimited
      priorityAI: true,
    },
  },
};

/**
 * Default tier id. Every user with no active subscription — including
 * everyone when auth is disabled (no Clerk keys) — resolves to this.
 * Changing app-wide default behavior is a one-line edit here.
 */
export const DEFAULT_TIER_ID: SubscriptionTierId = 'free';

/**
 * Look up a tier by id. Falls back to the default tier for unknown ids so
 * callers never have to null-check (mirrors getGeminiModelById's defensive
 * intent, but returns the safe default rather than undefined).
 */
export function getTierById(id: string | null | undefined): SubscriptionTierEntry {
  if (id && id in SUBSCRIPTION_TIERS) {
    return SUBSCRIPTION_TIERS[id as SubscriptionTierId];
  }
  return SUBSCRIPTION_TIERS[DEFAULT_TIER_ID];
}

/**
 * List all tiers in display order (free → pro → premium).
 */
export function listTiers(): SubscriptionTierEntry[] {
  return [
    SUBSCRIPTION_TIERS.free,
    SUBSCRIPTION_TIERS.pro,
    SUBSCRIPTION_TIERS.premium,
  ];
}
