/**
 * Billing Product Registry
 *
 * Single source of truth mapping each subscription tier (free/pro/premium
 * from src/config/subscription-tiers.ts) to its billing identifiers:
 *   - Stripe price id (web payments)
 *   - RevenueCat entitlement id (iOS subscriptions)
 *
 * Mirrors the GEMINI_MODELS / SUBSCRIPTION_TIERS pattern in this codebase
 * (typed entries, a Record keyed by id, helper getters, env-driven config).
 *
 * Phase 2 scope: this file only *describes* the tier↔product mapping and
 * exposes the env-gating switch. No provider SDK is imported here, no
 * network, no enforcement. With NO billing env keys set, isBillingEnabled()
 * is false and every user resolves to the default ('free') tier exactly as
 * today — same gating philosophy as Phase 1 auth and Sentry (see CLAUDE.md).
 *
 * The real Stripe price ids and RevenueCat entitlement ids are supplied via
 * env vars (see .env.example). They are intentionally blank until the user
 * creates Stripe + RevenueCat accounts — see TODOs below.
 */

import {
  DEFAULT_TIER_ID,
  type SubscriptionTierId,
} from '@/config/subscription-tiers';

/**
 * Billing identifiers for one subscription tier. A tier with no Stripe
 * price / RevenueCat entitlement (e.g. 'free') simply has empty strings —
 * it is never sold, it is the fallback everyone gets.
 */
export interface BillingTierEntry {
  /** Subscription tier this maps to (matches subscription-tiers.ts ids). */
  tier: SubscriptionTierId;
  /**
   * Stripe Price id (price_...), used by the web checkout-session creator
   * and matched back from webhook events. Empty => tier not sold via Stripe.
   * TODO: fill the real price ids by setting STRIPE_PRICE_PRO /
   *       STRIPE_PRICE_PREMIUM once a Stripe account + products exist.
   */
  stripePriceId: string;
  /**
   * RevenueCat entitlement id, used to map an active iOS subscription back
   * to a tier. Empty => tier not sold via RevenueCat.
   * TODO: fill via REVENUECAT_ENTITLEMENT_PRO / _PREMIUM once a RevenueCat
   *       account + entitlements exist.
   */
  revenueCatEntitlementId: string;
}

/**
 * Tier → billing identifiers. Driven entirely by env vars so no secrets or
 * account-specific ids live in the repo. Unset env => empty string => that
 * tier is simply not purchasable yet (and billing stays disabled overall).
 */
export const BILLING_TIERS: Record<SubscriptionTierId, BillingTierEntry> = {
  free: {
    tier: 'free',
    // Free is never sold — no Stripe price, no RevenueCat entitlement.
    stripePriceId: '',
    revenueCatEntitlementId: '',
  },
  pro: {
    tier: 'pro',
    stripePriceId: process.env.STRIPE_PRICE_PRO || '',
    revenueCatEntitlementId: process.env.REVENUECAT_ENTITLEMENT_PRO || '',
  },
  premium: {
    tier: 'premium',
    stripePriceId: process.env.STRIPE_PRICE_PREMIUM || '',
    revenueCatEntitlementId: process.env.REVENUECAT_ENTITLEMENT_PREMIUM || '',
  },
};

/**
 * Stripe publishable key — exposed to the browser bundle (checkout redirect).
 * Informational here; the on/off switch for server-side Stripe is the secret
 * key, see src/lib/billing/billing-gate.ts isStripeEnabled().
 */
export const STRIPE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

/**
 * RevenueCat public SDK key — exposed to the browser/iOS bundle. Its
 * presence is the single switch that turns RevenueCat on (mirrors how the
 * Clerk publishable key gates auth).
 */
export const REVENUECAT_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_REVENUECAT_KEY || '';

/**
 * True when ANY billing provider is configured. When false the whole
 * billing layer is dormant and every user stays on the default tier —
 * identical to current behavior. This is the billing analogue of
 * isAuthEnabled() / the Sentry DSN check.
 */
export function isBillingEnabled(): boolean {
  const stripeServer =
    (typeof process !== 'undefined' && process.env?.STRIPE_SECRET_KEY) || '';
  return (
    stripeServer.trim().length > 0 ||
    REVENUECAT_PUBLIC_KEY.trim().length > 0
  );
}

/**
 * Get the Stripe price id for a tier, or '' if that tier is not sold via
 * Stripe (e.g. 'free') / not yet configured.
 */
export function getStripePriceForTier(tier: SubscriptionTierId): string {
  return BILLING_TIERS[tier]?.stripePriceId || '';
}

/**
 * Reverse lookup: given a Stripe price id (from a checkout/webhook event),
 * return the tier it grants. Falls back to the default tier for unknown /
 * empty ids so callers never have to null-check (mirrors getTierById).
 */
export function getTierForStripePrice(
  priceId: string | null | undefined,
): SubscriptionTierId {
  if (priceId && priceId.trim().length > 0) {
    for (const entry of Object.values(BILLING_TIERS)) {
      if (entry.stripePriceId && entry.stripePriceId === priceId) {
        return entry.tier;
      }
    }
  }
  return DEFAULT_TIER_ID;
}

/**
 * Get the RevenueCat entitlement id for a tier, or '' if not sold via
 * RevenueCat / not yet configured.
 */
export function getRevenueCatEntitlementForTier(
  tier: SubscriptionTierId,
): string {
  return BILLING_TIERS[tier]?.revenueCatEntitlementId || '';
}

/**
 * Reverse lookup: given a set of active RevenueCat entitlement ids, return
 * the highest tier they grant. Falls back to the default tier when none
 * match (mirrors getTierForStripePrice).
 */
export function getTierForRevenueCatEntitlements(
  activeEntitlementIds: readonly string[] | null | undefined,
): SubscriptionTierId {
  if (activeEntitlementIds && activeEntitlementIds.length > 0) {
    // Check premium before pro so the strongest active entitlement wins.
    const order: SubscriptionTierId[] = ['premium', 'pro'];
    for (const tier of order) {
      const entId = BILLING_TIERS[tier].revenueCatEntitlementId;
      if (entId && activeEntitlementIds.includes(entId)) {
        return tier;
      }
    }
  }
  return DEFAULT_TIER_ID;
}

export { DEFAULT_TIER_ID };
export type { SubscriptionTierId };
