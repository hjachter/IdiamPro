'use client';

/**
 * /waiting — the friendly "your application is in the queue" page.
 *
 * Where signed-in users who haven't been approved yet land when they hit
 * /app. Explains where they are in the process, reminds them to check
 * email, and offers a sign-out link in case they signed in with the wrong
 * account.
 */

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Clock, Layers, Mail } from 'lucide-react';

const LazySignOutButton = dynamic(
  () =>
    import('@clerk/nextjs').then((mod) => ({
      default:
        mod.SignOutButton as unknown as React.ComponentType<{
          children?: React.ReactNode;
        }>,
    })),
  { ssr: false },
);

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';

export default function WaitingPage() {
  // Read the emails Clerk knew about for this user when the /app gate sent
  // them here. If any are present, the most likely scenario is "you applied
  // with one address but signed in with a different one" — surface them so
  // the user (and Howard reading over their shoulder) can spot the mismatch
  // immediately.
  const [signedInEmails, setSignedInEmails] = React.useState<string[]>([]);
  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem('idiampro-waiting-emails');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSignedInEmails(parsed.filter((e) => typeof e === 'string'));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="fixed inset-0 overflow-y-auto bg-gray-950 text-white">
      <div className="fixed inset-0 bg-gradient-to-br from-violet-950 via-gray-950 to-indigo-950" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-12">
        <a href="/" aria-label="IdiamPro home" className="mb-8 flex items-center gap-3 cursor-pointer transition-opacity hover:opacity-80">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/30">
            <Layers className="h-6 w-6 text-white" />
          </div>
          <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-2xl font-bold text-transparent">
            IdiamPro
          </span>
        </a>

        <div className="w-full rounded-2xl border border-amber-400/30 bg-amber-500/10 p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20">
            <Clock className="h-8 w-8 text-amber-300" />
          </div>
          <h1 className="mb-3 text-2xl font-semibold text-white">
            You&apos;re in the queue
          </h1>
          <p className="mb-4 text-sm text-white/80 leading-relaxed">
            Howard reviews every beta application personally — usually within
            a day or two. As soon as you&apos;re approved, you&apos;ll get an
            email with a sign-in link.
          </p>
          {signedInEmails.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-300/30 bg-amber-500/10 p-3 text-left text-xs text-amber-100">
              <p className="mb-1 font-semibold">
                Signed in as{' '}
                {signedInEmails.map((e, i) => (
                  <span key={e}>
                    {i > 0 ? ', ' : ''}
                    <strong>{e}</strong>
                  </span>
                ))}
              </p>
              <p className="text-amber-100/80">
                If you applied with a different email address, sign out below
                and sign back in using the email you applied with — or apply
                fresh using the address above.
              </p>
            </div>
          )}
          <div className="mb-4 flex items-center justify-center gap-2 text-sm text-white/70">
            <Mail className="h-4 w-4" />
            <span>Keep an eye on your inbox.</span>
          </div>
          <p className="text-xs text-white/50">
            Wrong account?{' '}
            {PUBLISHABLE_KEY ? (
              <LazySignOutButton>
                <button
                  type="button"
                  className="text-amber-300 underline-offset-4 hover:underline"
                >
                  Sign out
                </button>
              </LazySignOutButton>
            ) : (
              <a
                href="/signin"
                className="text-amber-300 underline-offset-4 hover:underline"
              >
                Sign in differently
              </a>
            )}
            {' '}and apply with the right email.
          </p>
        </div>

        <p className="mt-6 text-xs text-white/40 text-center">
          Questions?{' '}
          <a
            href="mailto:howard@2ndbrainware.com"
            className="text-white/70 hover:underline"
          >
            howard@2ndbrainware.com
          </a>
        </p>
      </div>
    </div>
  );
}
