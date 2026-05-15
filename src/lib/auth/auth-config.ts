/**
 * Auth configuration — provider-agnostic, env-gated.
 *
 * Modeled on the Sentry integration philosophy in this codebase
 * (sentry.client.config.ts + the Sentry section of CLAUDE.md): the entire
 * auth layer is gated on env vars. With NO Clerk keys set, auth is fully
 * disabled — every user is treated as signed-out / free tier, there is no
 * ClerkProvider, no network, and zero runtime change vs. today.
 *
 * Env vars (see .env.example):
 *   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY — browser/renderer (gates auth on/off)
 *   CLERK_SECRET_KEY                  — server-side (Clerk SDK, later phases)
 *
 * Phase 1: no billing, no enforcement. This only resolves "is auth on?"
 * and "what tier is the current user?" (always 'free' while disabled).
 */

import {
  DEFAULT_TIER_ID,
  getTierById,
  type SubscriptionTierEntry,
  type SubscriptionTierId,
} from '@/config/subscription-tiers';

/**
 * Clerk publishable key — exposed to the browser bundle. Its presence is
 * the single switch that turns auth on. Mirrors how SENTRY_DSN gates Sentry.
 */
export const CLERK_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';

/**
 * Clerk secret key — server-side only. Never exposed to the client.
 * Unused in Phase 1; reserved for server auth/billing wiring later.
 */
export const CLERK_SECRET_KEY =
  (typeof process !== 'undefined' && process.env?.CLERK_SECRET_KEY) || '';

/**
 * True only when a Clerk publishable key is configured. When false the app
 * must behave exactly as it does today (anon / free tier, no Clerk loaded).
 */
export function isAuthEnabled(): boolean {
  return CLERK_PUBLISHABLE_KEY.trim().length > 0;
}

/**
 * Resolve a tier id (e.g. from Clerk user metadata in a later phase) to a
 * full tier entry. When auth is disabled, callers should pass null/undefined
 * and will get the default 'free' tier.
 */
export function resolveCurrentTier(
  tierId?: string | null,
): SubscriptionTierEntry {
  if (!isAuthEnabled()) {
    return getTierById(DEFAULT_TIER_ID);
  }
  // TODO (later phase): tierId will come from Clerk publicMetadata, kept in
  // sync by the Stripe/RevenueCat webhook. Until then everyone is default.
  return getTierById(tierId ?? DEFAULT_TIER_ID);
}

export { DEFAULT_TIER_ID };
export type { SubscriptionTierEntry, SubscriptionTierId };
