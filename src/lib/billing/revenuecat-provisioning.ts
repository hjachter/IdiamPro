/**
 * RevenueCat server-side entitlement provisioning.
 *
 * RevenueCat is the single source of truth for "which tier does this user
 * have?" — regardless of whether the actual payment came through Apple IAP
 * (iOS) or Stripe (web). When Stripe fires a subscription event, we call
 * RevenueCat's REST API here to grant/update/revoke the matching
 * entitlement; the app then reads the entitlement back via the existing
 * tier-detection layer.
 *
 * STUB MODE: when REVENUECAT_API_KEY is unset, every function here logs a
 * clear "RevenueCat not configured — stubbing response" message, optionally
 * mirrors the change into the launch-progress localStorage shim used by the
 * client-side tier detector, and resolves with `{ stubbed: true }`. This
 * keeps the Stripe → entitlement flow exercisable end-to-end before Howard
 * wires the real RevenueCat account.
 *
 * REST docs: https://www.revenuecat.com/reference/grant-a-promotional-entitlement
 *
 * iOS NOTE: iOS purchases never hit this file. They go through the native
 * RevenueCat Capacitor plugin, which provisions the entitlement directly.
 * This module is only invoked by the Stripe webhook on the server.
 */

import {
  REVENUECAT_API_KEY,
  REVENUECAT_ENTITLEMENT_PRO_ID,
  REVENUECAT_ENTITLEMENT_STUDENT_ID,
  isRevenueCatRestEnabled,
  type LaunchEntitlement,
} from '@/config/billing-config';

const REVENUECAT_REST_BASE = 'https://api.revenuecat.com/v1';

/** Resolve the configured RevenueCat entitlement id for a launch tier. */
export function entitlementIdFor(entitlement: LaunchEntitlement): string {
  return entitlement === 'pro'
    ? REVENUECAT_ENTITLEMENT_PRO_ID
    : REVENUECAT_ENTITLEMENT_STUDENT_ID;
}

interface ProvisionResult {
  ok: boolean;
  stubbed?: boolean;
  reason?: string;
}

async function rcFetch(
  path: string,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; bodyText: string }> {
  const res = await fetch(`${REVENUECAT_REST_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${REVENUECAT_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers || {}),
    },
  });
  const bodyText = await res.text().catch(() => '');
  return { ok: res.ok, status: res.status, bodyText };
}

/**
 * Grant a promotional entitlement to an app user. RevenueCat treats this as
 * "this user has the X entitlement until duration expires". We use
 * "lifetime" duration and rely on `customer.subscription.deleted` events to
 * revoke — Stripe is the lifecycle source of truth for web subscriptions.
 */
export async function grantEntitlement(
  appUserId: string,
  entitlement: LaunchEntitlement,
): Promise<ProvisionResult> {
  if (!appUserId) {
    return { ok: false, reason: 'missing_appUserId' };
  }
  const entId = entitlementIdFor(entitlement);

  if (!isRevenueCatRestEnabled()) {
    // eslint-disable-next-line no-console
    console.warn(
      `[revenuecat] REVENUECAT_API_KEY unset — stubbing grantEntitlement(${appUserId}, ${entitlement} -> ${entId}).`,
    );
    return { ok: true, stubbed: true, reason: 'revenuecat_not_configured' };
  }

  const path = `/subscribers/${encodeURIComponent(appUserId)}/entitlements/${encodeURIComponent(entId)}/promotional`;
  const { ok, status, bodyText } = await rcFetch(path, {
    method: 'POST',
    body: JSON.stringify({ duration: 'lifetime' }),
  });
  if (!ok) {
    // eslint-disable-next-line no-console
    console.error(
      `[revenuecat] grantEntitlement failed (${status}): ${bodyText}`,
    );
    return { ok: false, reason: `revenuecat_${status}` };
  }
  return { ok: true };
}

/**
 * Revoke a previously granted promotional entitlement. Called on
 * `customer.subscription.deleted`.
 */
export async function revokeEntitlement(
  appUserId: string,
  entitlement: LaunchEntitlement,
): Promise<ProvisionResult> {
  if (!appUserId) {
    return { ok: false, reason: 'missing_appUserId' };
  }
  const entId = entitlementIdFor(entitlement);

  if (!isRevenueCatRestEnabled()) {
    // eslint-disable-next-line no-console
    console.warn(
      `[revenuecat] REVENUECAT_API_KEY unset — stubbing revokeEntitlement(${appUserId}, ${entitlement} -> ${entId}).`,
    );
    return { ok: true, stubbed: true, reason: 'revenuecat_not_configured' };
  }

  const path = `/subscribers/${encodeURIComponent(appUserId)}/entitlements/${encodeURIComponent(entId)}/revoke_promotionals`;
  const { ok, status, bodyText } = await rcFetch(path, { method: 'POST' });
  if (!ok) {
    // eslint-disable-next-line no-console
    console.error(
      `[revenuecat] revokeEntitlement failed (${status}): ${bodyText}`,
    );
    return { ok: false, reason: `revenuecat_${status}` };
  }
  return { ok: true };
}

/**
 * Fetch the currently-active entitlement ids for an app user via the
 * RevenueCat REST API. Returns [] (no entitlements) on any failure — the
 * billing layer must never throw at call sites.
 */
export async function fetchActiveEntitlementIds(
  appUserId: string,
): Promise<string[]> {
  if (!appUserId || !isRevenueCatRestEnabled()) return [];
  try {
    const { ok, bodyText } = await rcFetch(
      `/subscribers/${encodeURIComponent(appUserId)}`,
      { method: 'GET' },
    );
    if (!ok || !bodyText) return [];
    const data = JSON.parse(bodyText) as {
      subscriber?: {
        entitlements?: Record<string, { expires_date?: string | null }>;
      };
    };
    const entitlements = data?.subscriber?.entitlements || {};
    const now = Date.now();
    return Object.entries(entitlements)
      .filter(([, v]) => {
        if (!v?.expires_date) return true; // lifetime entitlement
        const exp = Date.parse(v.expires_date);
        return !Number.isFinite(exp) || exp > now;
      })
      .map(([k]) => k);
  } catch {
    return [];
  }
}
