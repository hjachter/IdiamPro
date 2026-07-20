/**
 * Sign-up page (catch-all so Clerk can drive multi-step flows like email
 * verification under /signup/*).
 *
 * Three-step flow:
 *
 *   1. Application form. Most new users are NOT yet on the invite
 *      allowlist. The form collects name, email, and an optional "What
 *      brings you to IdeaM?" textarea. Submitting POSTs to
 *      /api/applicants/apply, which persists the applicant record and
 *      emails Howard. The user lands on a "Thanks — Howard reviews every
 *      beta application personally" confirmation screen.
 *
 *   2. Email-check fast path. Before showing the application form we run
 *      /api/applicants/me?email=... When an email is already on the
 *      allowlist (the env-var INVITE_ALLOWLIST OR an applicant Howard has
 *      previously approved) we skip the application form and reveal
 *      Clerk's prebuilt SignUp component directly.
 *
 *   3. Clerk's prebuilt SignUp component. The post-signup Clerk webhook
 *      re-runs isEmailAllowedAsync() as defense in depth.
 *
 * Stub-safe: when Clerk's publishable key is not set the page shows a
 * "sign-up is being set up" message. When INVITE_ALLOWLIST is unset AND
 * the applicant store is empty, the allowlist check is bypassed (dev
 * mode), so the page falls straight through to Clerk's SignUp without
 * ever showing the application form.
 *
 * Post-sign-up destination is /app (the outliner).
 */

'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Layers, CheckCircle2, Clock } from 'lucide-react';

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
        In the meantime you can keep exploring IdeaM from the homepage.
      </p>
    </div>
  );
}

type ApplicationState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'submitted'; email: string }
  | { kind: 'checking-allowlist'; email: string }
  | { kind: 'pending-review'; email: string }
  | { kind: 'allowed'; email: string }
  | { kind: 'error'; message: string };

function ApplicationGate({
  children,
}: {
  children: (approvedEmail: string) => React.ReactNode;
}) {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [state, setState] = React.useState<ApplicationState>({ kind: 'idle' });

  const submit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedName = name.trim();
      const trimmedEmail = email.trim();
      if (!trimmedName) {
        setState({ kind: 'error', message: 'Add your name to continue.' });
        return;
      }
      if (!trimmedEmail || trimmedEmail.indexOf('@') === -1) {
        setState({
          kind: 'error',
          message: 'Enter a valid email address to continue.',
        });
        return;
      }

      // First: is this email already on the allowlist? If so, jump
      // straight to Clerk's SignUp.
      setState({ kind: 'checking-allowlist', email: trimmedEmail });
      try {
        const checkRes = await fetch(
          `/api/applicants/me?email=${encodeURIComponent(trimmedEmail)}`,
        );
        const checkData = (await checkRes.json()) as {
          approved?: boolean;
          status?: string;
        };
        if (checkData.approved) {
          setState({ kind: 'allowed', email: trimmedEmail });
          return;
        }
        if (checkData.status === 'pending') {
          // They already applied. Show the "we've got your application"
          // screen instead of creating a duplicate record.
          setState({ kind: 'pending-review', email: trimmedEmail });
          return;
        }
      } catch {
        // Allowlist check failed — fall through to creating the
        // application anyway. createApplicant is idempotent on email.
      }

      setState({ kind: 'submitting' });
      try {
        const res = await fetch('/api/applicants/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: trimmedName,
            email: trimmedEmail,
            reason: reason.trim(),
          }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (data.ok) {
          setState({ kind: 'submitted', email: trimmedEmail });
        } else {
          setState({
            kind: 'error',
            message:
              data.error ??
              "Something went sideways saving your application — please try again.",
          });
        }
      } catch {
        setState({
          kind: 'error',
          message:
            "We couldn't reach the sign-up service just now. Please try again in a moment.",
        });
      }
    },
    [name, email, reason],
  );

  if (state.kind === 'allowed') {
    return <>{children(state.email)}</>;
  }

  if (state.kind === 'submitted' || state.kind === 'pending-review') {
    const isResubmit = state.kind === 'pending-review';
    return (
      <div className="w-full rounded-2xl border border-blue-400/30 bg-blue-500/10 p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/20">
          {isResubmit ? (
            <Clock className="h-8 w-8 text-blue-300" />
          ) : (
            <CheckCircle2 className="h-8 w-8 text-blue-300" />
          )}
        </div>
        <h2 className="mb-3 text-xl font-semibold text-white">
          {isResubmit ? "We've got your application" : 'Thanks — application received'}
        </h2>
        <p className="mb-4 text-sm text-white/80 leading-relaxed">
          Howard reviews every beta application personally. You&apos;ll get an
          email at <strong className="text-white">{state.email}</strong> when
          you&apos;re approved — usually within a day or two.
        </p>
        <p className="text-xs text-white/50">
          Questions? Drop a note to{' '}
          <a
            href="mailto:support@2ndbrainware.com"
            className="text-blue-300 hover:underline"
          >
            support@2ndbrainware.com
          </a>
          .
        </p>
      </div>
    );
  }

  const submitting =
    state.kind === 'submitting' || state.kind === 'checking-allowlist';

  return (
    <div className="w-full">
      <form
        onSubmit={submit}
        className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4"
      >
        <label className="block">
          <span className="text-sm text-white/70">Full name</span>
          <input
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (state.kind === 'error') setState({ kind: 'idle' });
            }}
            placeholder="Jane Smith"
            className="mt-1 w-full rounded-lg border border-white/15 bg-gray-900/60 px-3 py-2 text-base text-white placeholder-white/30 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            aria-label="Full name"
          />
        </label>
        <label className="block">
          <span className="text-sm text-white/70">Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (state.kind === 'error') setState({ kind: 'idle' });
            }}
            placeholder="you@example.com"
            className="mt-1 w-full rounded-lg border border-white/15 bg-gray-900/60 px-3 py-2 text-base text-white placeholder-white/30 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            aria-label="Email address"
          />
        </label>
        <label className="block">
          <span className="text-sm text-white/70">
            What brings you to IdeaM?{' '}
            <span className="text-white/40">(optional)</span>
          </span>
          <textarea
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (state.kind === 'error') setState({ kind: 'idle' });
            }}
            rows={3}
            placeholder="A sentence or two about what you'd use it for — helps us prioritize."
            className="mt-1 w-full rounded-lg border border-white/15 bg-gray-900/60 px-3 py-2 text-base text-white placeholder-white/30 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40 resize-none"
            aria-label="What brings you to IdeaM"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2 text-base font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:from-violet-400 hover:to-indigo-500 disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Apply for beta access'}
        </button>
        {state.kind === 'error' && (
          <div
            role="alert"
            className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
          >
            {state.message}
          </div>
        )}
        <p className="text-xs text-white/50">
          IdeaM is in invite-only beta. Howard reviews every application
          personally — usually within a day or two.
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
            IdeaM
          </span>
        </div>
        <h1 className="mb-2 text-2xl font-semibold text-white">
          Apply for the IdeaM beta
        </h1>
        <p className="mb-8 text-sm text-white/60 text-center">
          No credit card. Howard reviews every application personally.
        </p>

        {/* The application form is always shown — it's independent of
            Clerk. Only the second step (Clerk's SignUp component for
            already-approved emails) requires the publishable key. */}
        <ApplicationGate>
          {(approvedEmail) =>
            PUBLISHABLE_KEY ? (
              <LazySignUp
                path="/signup"
                routing="path"
                signInUrl="/signin"
                afterSignUpUrl="/app"
                redirectUrl="/app"
                initialValues={{ emailAddress: approvedEmail }}
              />
            ) : (
              <StubNotice />
            )
          }
        </ApplicationGate>
      </div>
    </div>
  );
}
