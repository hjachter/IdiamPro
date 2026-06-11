'use client';

/**
 * AppGate — runtime enforcement of the invite-only beta on every /app
 * subroute. Wraps every page under /app in three checks:
 *
 *   1. If Clerk auth is disabled (no NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
 *      render children unchanged. Same stub-safe behavior as the rest
 *      of IdiamPro: with no auth keys, every visitor is dev / local.
 *
 *   2. If the user is signed in, hit /api/applicants/me?email=... once
 *      to find out whether they're on the allowlist. If yes, render
 *      children. If no, redirect to /waiting (the friendly "your
 *      application is in the queue" page).
 *
 *   3. If the user is signed OUT (Clerk has resolved and there's no
 *      session), redirect to /signup so they can apply.
 *
 * Loading state: a quiet centered spinner while Clerk is resolving the
 * session and while the /api/applicants/me check is in flight.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { isAuthEnabled } from '@/lib/auth/auth-config';

type GateState =
  | { kind: 'resolving' }
  | { kind: 'redirecting'; target: '/signup' | '/waiting' }
  | { kind: 'allowed' };

function getEmailFromClerkSession(): string | null {
  // Read the email directly from the Clerk window globals — useCurrentUser
  // gives us displayName, which is the email when there's no name set, but
  // we want the canonical email for the allowlist check.
  if (typeof window === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  const candidate =
    w?.Clerk?.user?.primaryEmailAddress?.emailAddress ??
    w?.Clerk?.user?.emailAddresses?.[0]?.emailAddress ??
    null;
  return typeof candidate === 'string' ? candidate : null;
}

export default function AppGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useCurrentUser();
  const [state, setState] = React.useState<GateState>({ kind: 'resolving' });

  // Stub mode: auth disabled → render children, no gate.
  const authEnabled = isAuthEnabled();

  React.useEffect(() => {
    if (!authEnabled) {
      setState({ kind: 'allowed' });
      return;
    }
    if (user.isLoading) {
      setState({ kind: 'resolving' });
      return;
    }
    if (!user.isSignedIn) {
      setState({ kind: 'redirecting', target: '/signup' });
      router.replace('/signup');
      return;
    }
    // Signed in — check the allowlist.
    let cancelled = false;
    (async () => {
      // The Clerk hook gives us displayName, but we want the email
      // canonically. Read it from the Clerk session window global; if
      // unavailable, fall back to displayName (often the email anyway).
      const email = getEmailFromClerkSession() ?? user.displayName ?? '';
      if (!email || email.indexOf('@') === -1) {
        // Can't determine an email — be safe and send to waiting page.
        if (!cancelled) {
          setState({ kind: 'redirecting', target: '/waiting' });
          router.replace('/waiting');
        }
        return;
      }
      try {
        const res = await fetch(
          `/api/applicants/me?email=${encodeURIComponent(email)}`,
        );
        const data = (await res.json()) as { approved?: boolean };
        if (cancelled) return;
        if (data.approved) {
          setState({ kind: 'allowed' });
        } else {
          setState({ kind: 'redirecting', target: '/waiting' });
          router.replace('/waiting');
        }
      } catch {
        // On a network error, default to letting them through. The
        // post-signup Clerk webhook + /api/invite-check still gate
        // unauthorized accounts; this is a soft second-layer check.
        if (!cancelled) setState({ kind: 'allowed' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authEnabled, user.isLoading, user.isSignedIn, user.displayName, router]);

  if (state.kind === 'allowed') {
    return <>{children}</>;
  }
  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
      Loading…
    </div>
  );
}
