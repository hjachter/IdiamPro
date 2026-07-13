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
  // Publishing/managing shareable links needs user identity. The public
  // read-only view route (/s/<id>) is intentionally NOT protected.
  /^\/api\/share\/publish(\/|$)/,
  /^\/api\/share\/unpublish(\/|$)/,
  /^\/api\/share\/list(\/|$)/,
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
 * Live-mode middleware: built via Clerk's clerkMiddleware() wrapper, which
 * is required for the `auth()` callback to work inside Next.js middleware.
 * Calling `auth()` from `@clerk/nextjs/server` outside the wrapper throws
 * with "Clerk: auth() was called but Clerk can't detect usage of
 * clerkMiddleware()", which surfaces in Vercel as a MIDDLEWARE_INVOCATION_FAILED
 * 500 on every request. We lazy-import the module so the Clerk runtime never
 * loads in stub builds.
 *
 * Redirects unauthenticated users to /signin with the original URL
 * preserved so they land back where they started. API routes return a
 * 401 JSON body instead of an HTML redirect.
 */
let cachedLiveMiddleware:
  | ((req: NextRequest, evt: unknown) => Promise<Response> | Response | void)
  | null = null;

async function getLiveMiddleware() {
  if (cachedLiveMiddleware) return cachedLiveMiddleware;
  const { clerkMiddleware } = await import('@clerk/nextjs/server');
  cachedLiveMiddleware = clerkMiddleware(async (auth, req) => {
    const { pathname, search } = req.nextUrl;
    if (!isProtectedPath(pathname)) {
      return NextResponse.next();
    }

    const { userId } = await auth();
    if (userId) {
      return NextResponse.next();
    }

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
  }) as unknown as typeof cachedLiveMiddleware;
  return cachedLiveMiddleware;
}

export async function middleware(req: NextRequest, evt: unknown) {
  if (!HAS_CLERK_KEYS) return stubMiddleware(req);
  const handler = await getLiveMiddleware();
  return handler!(req, evt);
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
