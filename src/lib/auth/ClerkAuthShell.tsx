'use client';

/**
 * ClerkAuthShell — the ENABLED-path inner shell, loaded as a single unit.
 *
 * This file exists to be loaded by a single `dynamic(..., { ssr: false })`
 * call from AuthProvider so that when the chunk arrives, ClerkProvider AND
 * its consumer (ClerkUserBridge) mount as one synchronous render. Earlier
 * versions loaded them as two separate `dynamic` siblings, which raced —
 * the bridge could mount and call `useUser()` before the ClerkProvider
 * context was actually established in the React tree, throwing:
 *   "useUser can only be used within the <ClerkProvider /> component."
 *
 * By colocating the provider + bridge inside one client module, the
 * ancestor relationship is guaranteed and the context is always present
 * for any `useUser`/`useAuth` call inside `children`.
 */

import * as React from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import { ClerkUserBridge } from './use-current-user';

export default function ClerkAuthShell({
  publishableKey,
  children,
}: {
  publishableKey: string;
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/">
      <ClerkUserBridge>{children}</ClerkUserBridge>
    </ClerkProvider>
  );
}
