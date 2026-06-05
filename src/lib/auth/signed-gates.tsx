'use client';

/**
 * SignedIn / SignedOut gates - env-safe wrappers around Clerk's <Show>.
 *
 * Clerk v7 replaced the v6 <SignedIn>/<SignedOut> components with a single
 * <Show when="signed-in" /> / <Show when="signed-out" /> primitive. This
 * file wraps that so the rest of the app can keep using the friendlier
 * SignedIn / SignedOut names without depending directly on @clerk/nextjs.
 *
 * When Clerk is configured (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY present),
 * these defer to Clerk's <Show> so the gate is driven by real session
 * state. When Clerk is NOT configured (stub mode for local dev), every
 * visitor is treated as signed-out - <SignedOut> renders children,
 * <SignedIn> renders nothing.
 *
 * Dynamic import + an explicit cast mirrors the pattern in AuthProvider.tsx
 * so the Clerk module is only loaded when auth is enabled.
 */

import * as React from 'react';
import dynamic from 'next/dynamic';

const HAS_PUBLISHABLE_KEY = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

type ShowProps = {
  when: 'signed-in' | 'signed-out';
  fallback?: React.ReactNode;
  children?: React.ReactNode;
};

const LazyShow = dynamic(
  () =>
    import('@clerk/nextjs').then((mod) => ({
      // @clerk/nextjs re-exports Show from @clerk/react via the client
      // control-components boundary; type cast keeps this resilient if the
      // exact prop shape shifts across minor versions.
      default: (mod as unknown as { Show: React.ComponentType<ShowProps> })
        .Show,
    })),
  { ssr: false },
);

export function SignedIn({ children }: { children: React.ReactNode }) {
  if (!HAS_PUBLISHABLE_KEY) return null;
  return <LazyShow when="signed-in">{children}</LazyShow>;
}

export function SignedOut({ children }: { children: React.ReactNode }) {
  if (!HAS_PUBLISHABLE_KEY) return <>{children}</>;
  return <LazyShow when="signed-out">{children}</LazyShow>;
}
