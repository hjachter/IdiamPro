'use client';

/**
 * AppGate — runtime enforcement of the invite-only beta on every /app
 * subroute. Wraps every page under /app in three checks:
 *
 *   1. If Clerk auth is disabled (no NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
 *      render children unchanged. Same stub-safe behavior as the rest
 *      of IDMPro: with no auth keys, every visitor is dev / local.
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

function getEmailsFromClerkSession(): string[] {
  // Read every email Clerk knows about for this user, not just the primary.
  // A user who applied with foo@aol.com but signed in via Google (which gives
  // them bar@gmail.com) will have only the Google email as primary. We check
  // ALL their known addresses against the allowlist so they're not falsely
  // routed to /waiting just because their OAuth identity address differs
  // from the address they applied with.
  if (typeof window === 'undefined') return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  const out: string[] = [];
  const primary = w?.Clerk?.user?.primaryEmailAddress?.emailAddress;
  if (typeof primary === 'string' && primary.indexOf('@') !== -1) {
    out.push(primary);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list: any[] = w?.Clerk?.user?.emailAddresses ?? [];
  for (const e of list) {
    const addr = e?.emailAddress;
    if (typeof addr === 'string' && addr.indexOf('@') !== -1 && !out.includes(addr)) {
      out.push(addr);
    }
  }
  return out;
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
    // Signed in — check the allowlist against ALL of the user's Clerk
    // email addresses (not just the primary). A Google OAuth user might
    // have a Gmail primary even though they applied with an AOL address;
    // we want to recognize both.
    let cancelled = false;
    (async () => {
      const emails = getEmailsFromClerkSession();
      if (emails.length === 0 && user.displayName && user.displayName.indexOf('@') !== -1) {
        emails.push(user.displayName);
      }
      if (emails.length === 0) {
        // Can't determine any email — be safe and send to waiting page.
        if (!cancelled) {
          // Surface a hint so the /waiting page can explain what happened.
          try {
            sessionStorage.setItem('idiampro-waiting-emails', JSON.stringify([]));
          } catch {}
          setState({ kind: 'redirecting', target: '/waiting' });
          router.replace('/waiting');
        }
        return;
      }
      try {
        // Check each email in turn — first approval wins.
        let approved = false;
        for (const email of emails) {
          const res = await fetch(
            `/api/applicants/me?email=${encodeURIComponent(email)}`,
          );
          const data = (await res.json()) as { approved?: boolean };
          if (data.approved) {
            approved = true;
            break;
          }
        }
        if (cancelled) return;
        if (approved) {
          setState({ kind: 'allowed' });
        } else {
          // Stash the emails we checked so /waiting can show them to the
          // user — makes "applied with one address, signed in with another"
          // mismatches diagnosable at a glance.
          try {
            sessionStorage.setItem(
              'idiampro-waiting-emails',
              JSON.stringify(emails),
            );
          } catch {}
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
