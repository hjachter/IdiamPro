/**
 * Billing gate — provider-agnostic, env-gated.
 *
 * Modeled exactly on src/lib/auth/auth-config.ts and the Sentry gating
 * philosophy (see CLAUDE.md): the entire billing layer is gated on env
 * vars. With NO Stripe/RevenueCat keys set, billing is fully disabled —
 * every user resolves to the default ('free') tier, no provider SDK is
 * loaded, no billing network calls, zero runtime change vs. today.
 *
 * Env vars (see .env.example):
 *   STRIPE_SECRET_KEY            — server-side; gates Stripe web payments on
 *   STRIPE_WEBHOOK_SECRET        — server-side; verifies Stripe webhooks
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — browser; Stripe.js redirect
 *   NEXT_PUBLIC_REVENUECAT_KEY   — browser/iOS; gates RevenueCat on
 *
 * Phase 2: scaffolding only. This resolves "is billing on?" and maps a
 * provider-supplied tier id back to a tier (always 'free' while disabled).
 * It composes with Phase 1's resolveCurrentTier — no keys => everyone free.
 */

import {
  DEFAULT_TIER_ID,
  REVENUECAT_PUBLIC_KEY,
  isBillingEnabled,
  type SubscriptionTierId,
} from '@/config/billing-config';
import {
  getTierById,
  type SubscriptionTierEntry,
} from '@/config/subscription-tiers';

/**
 * Stripe secret key — server-side only, never exposed to the client. Its
 * presence is the single switch that turns Stripe web payments on (mirrors
 * how SENTRY_DSN gates Sentry, CLERK_PUBLISHABLE_KEY gates auth).
 */
export const STRIPE_SECRET_KEY =
  (typeof process !== 'undefined' && process.env?.STRIPE_SECRET_KEY) || '';

/**
 * Stripe webhook signing secret — server-side only. Required to verify
 * inbound webhook signatures when Stripe is enabled.
 */
export const STRIPE_WEBHOOK_SECRET =
  (typeof process !== 'undefined' && process.env?.STRIPE_WEBHOOK_SECRET) || '';

/**
 * True only when a Stripe secret key is configured. When false the checkout
 * + webhook routes early-return a clean "billing not configured" response
 * and the Stripe SDK is never imported.
 */
export function isStripeEnabled(): boolean {
  return STRIPE_SECRET_KEY.trim().length > 0;
}

/**
 * True only when a RevenueCat public key is configured. When false the
 * RevenueCat client helpers no-op.
 */
export function isRevenueCatEnabled(): boolean {
  return REVENUECAT_PUBLIC_KEY.trim().length > 0;
}

/**
 * Provider-agnostic tier resolution. Given a tier id that a billing
 * provider (Stripe webhook → user metadata, or RevenueCat entitlement
 * sync) has determined for the current user, return the full tier entry.
 *
 * When billing is disabled (no keys), this ALWAYS returns the default
 * ('free') tier regardless of input — so it composes safely with Phase 1's
 * resolveCurrentTier and the app behaves exactly as it does today.
 */
export function resolveTierFromBilling(
  billedTierId?: SubscriptionTierId | string | null,
): SubscriptionTierEntry {
  if (!isBillingEnabled()) {
    return getTierById(DEFAULT_TIER_ID);
  }
  // TODO (later phase): billedTierId is supplied by the Stripe webhook
  // (kept in Clerk publicMetadata) or the RevenueCat entitlement sync.
  // Until real keys + accounts exist this path is never reached.
  return getTierById(billedTierId ?? DEFAULT_TIER_ID);
}

export { DEFAULT_TIER_ID, isBillingEnabled };
export type { SubscriptionTierEntry, SubscriptionTierId };
