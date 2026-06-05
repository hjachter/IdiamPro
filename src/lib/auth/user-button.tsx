'use client';

/**
 * Env-safe wrapper around Clerk's <UserButton>. Renders nothing when Clerk
 * is not configured (stub mode), so the app toolbar stays the same as today
 * for local dev. When Clerk is configured, shows the avatar / account menu
 * in the toolbar.
 *
 * Sign-out destination: Clerk v7 reads `afterSignOutUrl` from the surrounding
 * ClerkProvider (configured in src/lib/auth/AuthProvider.tsx) rather than as
 * a per-instance prop on UserButton. Without an explicit value Clerk falls
 * back to "/" (the homepage), which is exactly what we want.
 *
 * Dynamic import + an explicit cast mirrors the pattern in AuthProvider.tsx
 * so the Clerk module is only loaded when auth is enabled.
 */

import * as React from 'react';
import dynamic from 'next/dynamic';

const HAS_PUBLISHABLE_KEY = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

type UserButtonShape = React.ComponentType<Record<string, unknown>>;

const LazyUserButton = dynamic(
  () =>
    import('@clerk/nextjs').then((mod) => ({
      default: mod.UserButton as unknown as UserButtonShape,
    })),
  { ssr: false },
);

export function AppUserButton() {
  if (!HAS_PUBLISHABLE_KEY) return null;
  return <LazyUserButton />;
}
