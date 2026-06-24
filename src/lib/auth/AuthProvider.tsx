'use client';

/**
 * AuthProvider — env-gated auth boundary.
 *
 * DISABLED PATH (no NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY): renders {children}
 * untouched. No ClerkProvider, no Clerk import at module load, no network.
 * This is the exact current behavior of the app — same philosophy as the
 * Sentry integration (gated entirely on an env var, silent no-op when unset).
 *
 * ENABLED PATH (key present): lazily loads ./ClerkAuthShell — a single
 * client module that mounts <ClerkProvider> AND the user-context bridge
 * together. Loading both as one chunk guarantees the provider is in the
 * React tree before any `useUser`/`useAuth` consumer renders. Earlier
 * versions loaded the provider and bridge as two separate dynamic siblings,
 * which raced and produced
 *   "useUser can only be used within the <ClerkProvider /> component."
 *
 * Safe under Capacitor (iOS) and Electron — both load the same web bundle;
 * there are no SSR-only assumptions here, and the disabled path does no work.
 */

import * as React from 'react';
import dynamic from 'next/dynamic';
import { isAuthEnabled } from './auth-config';

/**
 * Single dynamic import for the entire Clerk-enabled subtree. Keeps Clerk
 * out of the bundle when disabled, and keeps provider+consumer atomic when
 * enabled.
 */
const LazyClerkAuthShell = dynamic(() => import('./ClerkAuthShell'), {
  ssr: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Disabled path: identical to having no provider at all.
  if (!isAuthEnabled()) {
    return <>{children}</>;
  }

  const publishableKey =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';

  return (
    <LazyClerkAuthShell publishableKey={publishableKey}>
      {children}
    </LazyClerkAuthShell>
  );
}

export default AuthProvider;
