/**
 * AuthProvider — env-gated auth boundary (SERVER COMPONENT).
 *
 * DISABLED PATH (no NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY): renders {children}
 * untouched. No ClerkProvider, no Clerk import at module load, no network.
 * This is the exact current behavior of the app — same philosophy as the
 * Sentry integration (gated entirely on an env var, silent no-op when unset).
 *
 * ENABLED PATH (key present): renders <ClerkProvider> directly. Because
 * `@clerk/nextjs`'s ClerkProvider is itself an async server component that
 * reads cookies/headers via React's request context, it MUST be rendered
 * on the server, not lazily mounted on the client.
 *
 * Earlier versions wrapped ClerkProvider inside a `dynamic(..., { ssr: false })`
 * client component, which silently stripped ClerkProvider of its server
 * bootstrap (the part that injects initial session state and the Clerk
 * scripts into the document). The result: Clerk's UI components (SignUp,
 * SignIn, Show, UserButton, etc.) mounted on the client without a working
 * Clerk context and threw:
 *   "useUser can only be used within the <ClerkProvider /> component."
 *
 * By placing ClerkProvider in this server component, the server renders
 * the provider into the initial HTML, the Clerk script loads, and every
 * downstream client component finds a real provider in the React tree.
 *
 * Safe under Capacitor (iOS) and Electron — both load the same web bundle;
 * the disabled path does no work, and the enabled path renders identical
 * output to a normal Next.js SSR Clerk setup.
 */

import * as React from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import { ClerkUserBridge } from './use-current-user';

const HAS_PUBLISHABLE_KEY = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Disabled path: identical to having no provider at all.
  if (!HAS_PUBLISHABLE_KEY) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      afterSignOutUrl="/"
    >
      <ClerkUserBridge>{children}</ClerkUserBridge>
    </ClerkProvider>
  );
}

export default AuthProvider;
