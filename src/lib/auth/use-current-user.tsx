'use client';

/**
 * useCurrentUser / useCurrentTier — env-gated auth hooks.
 *
 * DISABLED (no Clerk key): returns a stable signed-out / free-tier result
 * with zero work and no Clerk import. This is the current app behavior.
 *
 * ENABLED (key present): backed by Clerk via a context provider that is
 * only mounted on the enabled path (so Clerk hooks are never called without
 * a ClerkProvider above them).
 *
 * Phase 1: tier is always the default ('free') even when signed in —
 * subscription resolution from Stripe/RevenueCat lands in a later phase.
 */

import * as React from 'react';
import {
  resolveCurrentTier,
  isAuthEnabled,
} from './auth-config';
import type { SubscriptionTierEntry } from '@/config/subscription-tiers';

export interface CurrentUser {
  /** True while Clerk is still resolving the session (always false when disabled). */
  isLoading: boolean;
  /** True when a user is signed in (always false when auth is disabled). */
  isSignedIn: boolean;
  /** Stable user id, or null when signed out / disabled. */
  userId: string | null;
  /** Best-effort display name / email, or null. */
  displayName: string | null;
}

const SIGNED_OUT_USER: CurrentUser = {
  isLoading: false,
  isSignedIn: false,
  userId: null,
  displayName: null,
};

/**
 * Context holding the Clerk-derived user. Default is the signed-out value,
 * so consumers on the disabled path (no provider) still get a valid result.
 */
const CurrentUserContext = React.createContext<CurrentUser>(SIGNED_OUT_USER);

/**
 * Provider for the *enabled* path only. It is lazily imported by
 * AuthProvider-adjacent code; importing this module does not pull Clerk
 * until this component actually renders.
 */
export function ClerkUserBridge({ children }: { children: React.ReactNode }) {
  // Imported lazily at call sites; only reached when auth is enabled and a
  // ClerkProvider is mounted above this component.
  const { useUser } = require('@clerk/nextjs') as typeof import('@clerk/nextjs');
  const { isLoaded, isSignedIn, user } = useUser();

  const value = React.useMemo<CurrentUser>(
    () => ({
      isLoading: !isLoaded,
      isSignedIn: Boolean(isSignedIn),
      userId: user?.id ?? null,
      displayName:
        user?.fullName ||
        user?.primaryEmailAddress?.emailAddress ||
        null,
    }),
    [isLoaded, isSignedIn, user],
  );

  return (
    <CurrentUserContext.Provider value={value}>
      {children}
    </CurrentUserContext.Provider>
  );
}

/**
 * Current user. Stable signed-out result when auth is disabled.
 */
export function useCurrentUser(): CurrentUser {
  const ctx = React.useContext(CurrentUserContext);
  if (!isAuthEnabled()) {
    return SIGNED_OUT_USER;
  }
  return ctx;
}

/**
 * Current subscription tier. Always the default ('free') in Phase 1 — and
 * always 'free' when auth is disabled. Returns a full tier entry so callers
 * can read entitlements without a null check.
 */
export function useCurrentTier(): SubscriptionTierEntry {
  const user = useCurrentUser();
  return React.useMemo(
    // TODO (later phase): derive tier id from Clerk publicMetadata once the
    // Stripe/RevenueCat webhook keeps it in sync. Until then -> default.
    () => resolveCurrentTier(user.isSignedIn ? null : null),
    [user.isSignedIn],
  );
}
