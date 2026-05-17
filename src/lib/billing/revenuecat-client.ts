/**
 * RevenueCat entitlement-sync helper — thin, env-gated, no native SDK.
 *
 * Scaffolding only. When isRevenueCatEnabled() is false (no
 * NEXT_PUBLIC_REVENUECAT_KEY) every function here is a no-op that resolves
 * to the default ('free') tier — identical to current behavior.
 *
 * Why no heavy SDK: this phase is dormant scaffolding. We deliberately do
 * NOT pull @revenuecat/purchases-capacitor (a native iOS SDK) yet. The
 * abstraction below is a light REST/stub surface so the wiring exists.
 *
 * iOS-NATIVE INTEGRATION (later phase): on iOS the real entitlement state
 * comes from the RevenueCat Capacitor plugin
 * (@revenuecat/purchases-capacitor) running in the native layer. The plugin
 * is configured with NEXT_PUBLIC_REVENUECAT_KEY, presents the App Store
 * paywall, and exposes `getCustomerInfo()`. At that point, replace
 * `fetchActiveEntitlementIds` below to call the plugin on Capacitor and
 * fall back to the RevenueCat REST API on web. The tier-mapping logic
 * (getTierForRevenueCatEntitlements) stays unchanged.
 */

import {
  DEFAULT_TIER_ID,
  REVENUECAT_PUBLIC_KEY,
  getTierForRevenueCatEntitlements,
  type SubscriptionTierId,
} from '@/config/billing-config';
import { isRevenueCatEnabled } from '@/lib/billing/billing-gate';

/** RevenueCat REST base — only used when enabled. */
const REVENUECAT_REST_BASE = 'https://api.revenuecat.com/v1';

/**
 * Fetch the active entitlement ids for an app user. No-op when RevenueCat
 * is disabled: returns [] without any network call.
 *
 * @param appUserId RevenueCat app user id (the signed-in user's stable id).
 *                   Ignored when disabled.
 */
export async function fetchActiveEntitlementIds(
  appUserId: string | null | undefined,
): Promise<string[]> {
  if (!isRevenueCatEnabled() || !appUserId) {
    return [];
  }
  // TODO (later phase): on Capacitor/iOS call the native RevenueCat plugin's
  // getCustomerInfo() instead of REST. This REST path covers web.
  try {
    const res = await fetch(
      `${REVENUECAT_REST_BASE}/subscribers/${encodeURIComponent(appUserId)}`,
      {
        headers: {
          Authorization: `Bearer ${REVENUECAT_PUBLIC_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    );
    if (!res.ok) {
      return [];
    }
    const data = (await res.json()) as {
      subscriber?: { entitlements?: Record<string, unknown> };
    };
    const entitlements = data?.subscriber?.entitlements;
    return entitlements ? Object.keys(entitlements) : [];
  } catch {
    // Never throw from the billing layer — degrade to "no entitlements".
    return [];
  }
}

/**
 * Resolve the current user's tier from RevenueCat. Always returns the
 * default ('free') tier when RevenueCat is disabled — so this composes
 * with resolveTierFromBilling and Phase 1's tier resolution.
 */
export async function resolveTierFromRevenueCat(
  appUserId: string | null | undefined,
): Promise<SubscriptionTierId> {
  if (!isRevenueCatEnabled()) {
    return DEFAULT_TIER_ID;
  }
  const active = await fetchActiveEntitlementIds(appUserId);
  return getTierForRevenueCatEntitlements(active);
}
