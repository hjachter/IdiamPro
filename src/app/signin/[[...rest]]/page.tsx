/**
 * Sign-in page (catch-all so Clerk can drive multi-step flows like
 * SSO callbacks / factor verification under /signin/*).
 *
 * Renders Clerk's prebuilt SignIn component inside an IdiamPro-branded
 * wrapper. When Clerk's publishable key is not set the wrapper instead
 * shows a "sign-in is being set up" message — local dev keeps working
 * because the middleware also lets everyone through in stub mode.
 *
 * Post-sign-in destination is /app (the outliner).
 */

'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Layers } from 'lucide-react';

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';

type SignInProps = {
  path?: string;
  routing?: string;
  signUpUrl?: string;
  afterSignInUrl?: string;
  redirectUrl?: string;
};

// Lazy-load Clerk only when configured. Avoids pulling the SDK in stub mode.
const LazySignIn = dynamic(
  () =>
    import('@clerk/nextjs').then((mod) => ({
      default: mod.SignIn as unknown as React.ComponentType<SignInProps>,
    })),
  { ssr: false, loading: () => <ClerkLoading /> },
);

function ClerkLoading() {
  return (
    <div className="flex h-40 items-center justify-center text-sm text-white/50">
      Loading sign-in...
    </div>
  );
}

function StubNotice() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
      <p className="text-base text-white/80">
        Sign-in is being set up. Check back soon.
      </p>
      <p className="mt-3 text-sm text-white/50">
        In the meantime you can keep using IdiamPro from the homepage.
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="fixed inset-0 overflow-y-auto bg-gray-950 text-white">
      <div className="fixed inset-0 bg-gradient-to-br from-violet-950 via-gray-950 to-indigo-950" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-12">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/30">
            <Layers className="h-6 w-6 text-white" />
          </div>
          <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-2xl font-bold text-transparent">
            IdiamPro
          </span>
        </div>
        <h1 className="mb-2 text-2xl font-semibold text-white">Welcome back</h1>
        <p className="mb-8 text-sm text-white/60">
          Sign in to open your outlines.
        </p>

        {PUBLISHABLE_KEY ? (
          <LazySignIn
            path="/signin"
            routing="path"
            signUpUrl="/signup"
            afterSignInUrl="/app"
            redirectUrl="/app"
          />
        ) : (
          <StubNotice />
        )}
      </div>
    </div>
  );
}
