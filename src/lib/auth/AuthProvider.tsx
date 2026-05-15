'use client';

/**
 * AuthProvider — env-gated auth boundary.
 *
 * DISABLED PATH (no NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY): renders {children}
 * untouched. No ClerkProvider, no Clerk import at module load, no network.
 * This is the exact current behavior of the app — same philosophy as the
 * Sentry integration (gated entirely on an env var, silent no-op when unset).
 *
 * ENABLED PATH (key present): lazily loads @clerk/nextjs (so the module is
 * never even resolved when disabled) and wraps children in <ClerkProvider>.
 *
 * Safe under Capacitor (iOS) and Electron — both load the same web bundle;
 * there are no SSR-only assumptions here, and the disabled path does no work.
 */

import * as React from 'react';
import dynamic from 'next/dynamic';
import { isAuthEnabled } from './auth-config';

/**
 * Clerk provider, loaded only when auth is enabled. `dynamic(..., { ssr:
 * false })` keeps the Clerk module out of the bundle's critical path and
 * out of SSR; the import callback is never invoked while auth is disabled.
 */
const LazyClerkProvider = dynamic(
  () =>
    import('@clerk/nextjs').then((mod) => ({
      default: mod.ClerkProvider as unknown as React.ComponentType<{
        publishableKey: string;
        children: React.ReactNode;
      }>,
    })),
  { ssr: false },
);

/**
 * Bridges Clerk's session into the app's CurrentUser context. Loaded only
 * on the enabled path so Clerk hooks are never called without a provider.
 */
const LazyClerkUserBridge = dynamic(
  () =>
    import('./use-current-user').then((mod) => ({
      default: mod.ClerkUserBridge,
    })),
  { ssr: false },
);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Disabled path: identical to having no provider at all.
  if (!isAuthEnabled()) {
    return <>{children}</>;
  }

  const publishableKey =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';

  return (
    <LazyClerkProvider publishableKey={publishableKey}>
      <LazyClerkUserBridge>{children}</LazyClerkUserBridge>
    </LazyClerkProvider>
  );
}

export default AuthProvider;
