/**
 * Sign-up page (catch-all so Clerk can drive multi-step flows like email
 * verification under /signup/*).
 *
 * Two-step flow:
 *
 *   1. Email-check gate. The user types their email; we POST to
 *      /api/invite-check, which compares the address against the
 *      Howard-curated INVITE_ALLOWLIST. If the email isn't on the list
 *      we show a conversational gate message and never call Clerk. If
 *      it is on the list (or the allowlist is unset / stub mode), step 2
 *      reveals.
 *
 *   2. Clerk's prebuilt SignUp component renders for the approved email.
 *      We can't cleanly hook into Clerk's own email field validation
 *      from outside, so we run the gate as a separate first step rather
 *      than fighting Clerk's internals. The post-signup webhook re-runs
 *      isEmailAllowed() as defense in depth in case anyone navigates
 *      around this UI.
 *
 * Stub-safe: when Clerk's publishable key is not set the page shows a
 * "sign-up is being set up" message. When INVITE_ALLOWLIST is unset the
 * email check is always { allowed: true }, so the page behaves like a
 * normal Clerk sign-up — exactly the pre-invite behavior.
 *
 * Post-sign-up destination is /app (the outliner), so the new user lands
 * directly in their first outline.
 */

'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Layers } from 'lucide-react';

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';

type SignUpProps = {
  path?: string;
  routing?: string;
  signInUrl?: string;
  afterSignUpUrl?: string;
  redirectUrl?: string;
  initialValues?: { emailAddress?: string };
};

const LazySignUp = dynamic(
  () =>
    import('@clerk/nextjs').then((mod) => ({
      default: mod.SignUp as unknown as React.ComponentType<SignUpProps>,
    })),
  { ssr: false, loading: () => <ClerkLoading /> },
);

function ClerkLoading() {
  return (
    <div className="flex h-40 items-center justify-center text-sm text-white/50">
      Loading sign-up...
    </div>
  );
}

function StubNotice() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
      <p className="text-base text-white/80">
        Sign-up is being set up. Check back soon.
      </p>
      <p className="mt-3 text-sm text-white/50">
        In the meantime you can keep exploring IdiamPro from the homepage.
      </p>
    </div>
  );
}

type CheckState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'denied'; message: string }
  | { kind: 'allowed'; email: string };

function InviteGate({ children }: { children: (approvedEmail: string) => React.ReactNode }) {
  const [email, setEmail] = React.useState('');
  const [state, setState] = React.useState<CheckState>({ kind: 'idle' });

  const submit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = email.trim();
      if (!trimmed || trimmed.indexOf('@') === -1) {
        setState({ kind: 'denied', message: 'Enter a valid email address to continue.' });
        return;
      }
      setState({ kind: 'checking' });
      try {
        const res = await fetch('/api/invite-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmed }),
        });
        const data = (await res.json()) as { allowed?: boolean; message?: string };
        if (data.allowed) {
          setState({ kind: 'allowed', email: trimmed });
        } else {
          setState({
            kind: 'denied',
            message:
              data.message ??
              "IdiamPro is in invite-only beta right now. Your email isn't on the invite list yet.",
          });
        }
      } catch {
        // Network / server hiccup: don't lock the user out — let them try
        // again. The webhook will still enforce the allowlist after Clerk
        // creates the account, so even a buggy client can't slip past.
        setState({
          kind: 'denied',
          message:
            "We couldn't reach the invite check just now. Please try again in a moment.",
        });
      }
    },
    [email],
  );

  if (state.kind === 'allowed') {
    return <>{children(state.email)}</>;
  }

  return (
    <div className="w-full">
      <form
        onSubmit={submit}
        className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4"
      >
        <label className="block">
          <span className="text-sm text-white/70">Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (state.kind === 'denied') setState({ kind: 'idle' });
            }}
            placeholder="you@example.com"
            className="mt-1 w-full rounded-lg border border-white/15 bg-gray-900/60 px-3 py-2 text-base text-white placeholder-white/30 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            aria-label="Email address for invite check"
          />
        </label>
        <button
          type="submit"
          disabled={state.kind === 'checking'}
          className="w-full rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2 text-base font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:from-violet-400 hover:to-indigo-500 disabled:opacity-60"
        >
          {state.kind === 'checking' ? 'Checking…' : 'Continue'}
        </button>
        {state.kind === 'denied' && (
          <div
            role="alert"
            className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
          >
            {state.message}
          </div>
        )}
        <p className="text-xs text-white/50">
          IdiamPro is in invite-only beta. We check your email against the
          invite list before creating an account.
        </p>
      </form>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <div className="fixed inset-0 overflow-y-auto bg-gray-950 text-white">
      <div className="fixed inset-0 bg-gradient-to-br from-violet-950 via-gray-950 to-indigo-950" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-12">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/30">
            <Layers className="h-6 w-6 text-white" />
          </div>
          <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-2xl font-bold text-transparent">
            SecondBrainWare
          </span>
        </div>
        <h1 className="mb-2 text-2xl font-semibold text-white">
          Start with IdiamPro — free
        </h1>
        <p className="mb-8 text-sm text-white/60">
          No credit card required. Twenty-five generations on the house.
        </p>

        {PUBLISHABLE_KEY ? (
          <InviteGate>
            {(approvedEmail) => (
              <LazySignUp
                path="/signup"
                routing="path"
                signInUrl="/signin"
                afterSignUpUrl="/app"
                redirectUrl="/app"
                initialValues={{ emailAddress: approvedEmail }}
              />
            )}
          </InviteGate>
        ) : (
          <StubNotice />
        )}
      </div>
    </div>
  );
}
