/**
 * Auth-wall middleware.
 *
 * Gates the actual outliner (`/app/*`) and admin tools (`/admin/*`) behind
 * Clerk sign-in while keeping the marketing / pricing / privacy pages public
 * for SEO + lead capture.
 *
 * Stub-safe: with no NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY or CLERK_SECRET_KEY
 * set, this middleware logs a single dev warning and lets every request
 * through unchanged. The moment those env vars exist in Vercel, the wall
 * goes live in production. Mirrors the env-gated philosophy used by the
 * Sentry integration and the existing AuthProvider.
 *
 * Public routes (no auth required):
 *   /                 — homepage
 *   /marketing/*      — marketing pages
 *   /privacy          — privacy policy
 *   /upgrade*         — pricing / checkout success / cancel
 *   /stress-test      — public stress test demo
 *   /unsubscribe      — email unsubscribe landing
 *   /splash, /beta    — auxiliary public surfaces
 *   /signin*, /signup*— auth flows themselves
 *   /api/webhooks/*   — machine-to-machine (Clerk, Stripe) — signature-verified
 *   /api/billing/webhook — Stripe webhook (sibling of the above pattern)
 *   /api/health       — health probe (if it exists)
 *
 * Protected routes:
 *   /app/*            — the outliner
 *   /admin/*          — admin tools (metrics, etc.)
 *   Selected /api/*   — routes that operate on user content (help-chat,
 *                       knowledge-chat, synthesize-podcast, etc.)
 */

import { NextResponse, type NextRequest } from 'next/server';

const HAS_CLERK_KEYS =
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
  Boolean(process.env.CLERK_SECRET_KEY);

let warnedAboutStub = false;
function warnStubOnce() {
  if (!warnedAboutStub) {
    warnedAboutStub = true;
    // eslint-disable-next-line no-console
    console.warn(
      '[auth-wall] Clerk not configured — auth wall disabled for dev. ' +
        'Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to enable.',
    );
  }
}

/** Protected route patterns. Hit any of these and you must be signed in. */
const PROTECTED_PATTERNS: RegExp[] = [
  /^\/app(\/|$)/,
  /^\/admin(\/|$)/,
  /^\/api\/help-chat(\/|$)/,
  /^\/api\/knowledge-chat(\/|$)/,
  /^\/api\/synthesize-podcast(\/|$)/,
  /^\/api\/generate-podcast(\/|$)/,
  /^\/api\/generate-podcast-script(\/|$)/,
  /^\/api\/extract-pdf(\/|$)/,
  // Billing endpoints that need user identity (checkout, portal). The
  // webhook is excluded below since it is machine-to-machine.
  /^\/api\/billing\/checkout(\/|$)/,
  /^\/api\/billing\/portal(\/|$)/,
];

/** Routes that look like protected /api/* but are actually public. */
const PUBLIC_API_OVERRIDES: RegExp[] = [
  /^\/api\/webhooks(\/|$)/,
  /^\/api\/billing\/webhook(\/|$)/,
  /^\/api\/health(\/|$)/,
  /^\/api\/emails\/unsubscribe(\/|$)/,
];

function isProtectedPath(pathname: string): boolean {
  if (PUBLIC_API_OVERRIDES.some((r) => r.test(pathname))) return false;
  return PROTECTED_PATTERNS.some((r) => r.test(pathname));
}

/**
 * Stub-mode middleware: log once, allow everyone through. Identical to the
 * pre-auth-wall behavior, so local dev keeps working until real keys arrive.
 */
function stubMiddleware(_req: NextRequest) {
  warnStubOnce();
  return NextResponse.next();
}

/**
 * Live-mode middleware: lazy-import Clerk so the @clerk/nextjs runtime is
 * never loaded in stub builds. Redirect unauthenticated users to /signin
 * with the original URL preserved so they land back where they started.
 */
async function liveMiddleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  // Dynamic import keeps Clerk out of the bundle when keys aren't set.
  const { auth } = await import('@clerk/nextjs/server');
  const { userId } = await auth();

  if (userId) {
    return NextResponse.next();
  }

  // API routes return 401 JSON instead of an HTML redirect.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 },
    );
  }

  const signInUrl = req.nextUrl.clone();
  signInUrl.pathname = '/signin';
  signInUrl.search = '';
  signInUrl.searchParams.set('redirect_url', pathname + search);
  return NextResponse.redirect(signInUrl);
}

export async function middleware(req: NextRequest) {
  if (!HAS_CLERK_KEYS) return stubMiddleware(req);
  return liveMiddleware(req);
}

/**
 * Match everything except Next.js internals and static assets. We do the
 * fine-grained public-vs-protected decision inside the middleware itself.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|fonts/|.*\\..*).*)',
  ],
};
