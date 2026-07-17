/**
 * Server-enforced BETA-APPROVAL gate.
 *
 * The invite-only beta was, until now, enforced in two places that a
 * determined signed-in-but-unapproved account could slip past:
 *
 *   - The /app subtree was gated CLIENT-SIDE only (AppGate in the browser).
 *     A competitor who simply signed up (Clerk lets anyone create an account)
 *     satisfied the middleware sign-in wall and could reach /app by disabling
 *     the client gate.
 *   - The paid/sensitive API routes (help-chat, podcast generation, PDF
 *     extraction, share publishing…) were SIGN-IN-gated only, so any signed-in
 *     account could call them directly and spend the owner's AI money.
 *
 * This module closes both gaps by moving the approval decision to the SERVER,
 * reusing the EXISTING approval source of truth — `isEmailAllowedAsync()` in
 * allowlist.ts (INVITE_ALLOWLIST env var + Howard-approved applicants). No new
 * approval source is invented.
 *
 * Consumers:
 *   - src/app/app/layout.tsx  → server page gate (redirect unapproved to /waiting)
 *   - the paid/sensitive API routes → `guardSensitiveRoute()` (403 + rate limit)
 *
 * STUB-SAFE (critical): when Clerk auth is not configured (local dev / stub —
 * no NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY), `isAuthEnabled()` is false and this
 * returns state `'stub'` → everything passes through, exactly like the
 * middleware auth-wall, the invite allowlist, and the admin gate. Local dev is
 * never broken. Real enforcement switches on the moment Clerk keys exist in
 * production.
 *
 * FAIL-SAFE for the founder: the approval check flows through
 * `isEmailAllowedAsync()`, which already degrades a dead/stale beta database
 * down to the INVITE_ALLOWLIST env var rather than locking everyone out. So a
 * broken beta DB can never lock out an env-var-allowlisted user (e.g. Howard).
 *
 * SERVER-ONLY. Never import from a client component — it reads the Clerk
 * server session.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { isAuthEnabled } from '@/lib/auth/auth-config';
import { isEmailAllowedAsync } from '@/lib/access/allowlist';
import { getAdminEmails } from '@/lib/access/admin';
import { enforceRateLimit } from '@/lib/rate-limit';

export type ApprovalState =
  | 'stub' // auth disabled (dev/stub) — allow everything
  | 'signed-out' // auth on, no session
  | 'approved' // auth on, signed in, on the allowlist
  | 'unapproved'; // auth on, signed in, NOT on the allowlist

export interface ApprovalResult {
  state: ApprovalState;
  /** Clerk user id when signed in, else null. Used for per-user rate limits. */
  userId: string | null;
  /** All lower-cased email addresses linked to the signed-in user. */
  emails: string[];
}

/** Normalize an email for comparison: trim + lowercase. */
function normalize(email: string): string {
  return (email ?? '').trim().toLowerCase();
}

/**
 * Resolve the signed-in Clerk user's id + every linked email address.
 *
 * Uses the same lazy-require pattern as admin.ts / paid-feature-gate.ts so the
 * Clerk server runtime is never pulled into stub builds, and mirrors the
 * "check ALL linked emails, not just the primary" rule used everywhere else —
 * a user who applied with foo@aol.com but signed in via Google (bar@gmail.com)
 * must still be recognized on either address.
 */
async function getSignedInUser(): Promise<{
  userId: string | null;
  emails: string[];
}> {
  if (!isAuthEnabled()) return { userId: null, emails: [] };
  try {
    /* eslint-disable @typescript-eslint/no-var-requires */
    const clerkServer = require('@clerk/nextjs/server') as {
      auth?: () =>
        | Promise<{ userId?: string | null }>
        | { userId?: string | null };
      clerkClient?: () => Promise<{
        users: {
          getUser: (id: string) => Promise<{
            emailAddresses?: Array<{ emailAddress?: string }>;
          }>;
        };
      }>;
    };
    /* eslint-enable @typescript-eslint/no-var-requires */
    if (!clerkServer.auth) return { userId: null, emails: [] };
    const session = await Promise.resolve(clerkServer.auth());
    const userId = session.userId ?? null;
    if (!userId || !clerkServer.clerkClient) return { userId, emails: [] };
    const client = await clerkServer.clerkClient();
    const user = await client.users.getUser(userId);
    const emails = (user.emailAddresses ?? [])
      .map((e) => normalize(e.emailAddress ?? ''))
      .filter((e) => e.length > 0);
    return { userId, emails };
  } catch {
    return { userId: null, emails: [] };
  }
}

/**
 * The authoritative server-side answer to "may the current session use the
 * beta?" Consults the SAME allowlist the client gate uses.
 */
export async function resolveApproval(): Promise<ApprovalResult> {
  if (!isAuthEnabled()) return { state: 'stub', userId: null, emails: [] };

  const { userId, emails } = await getSignedInUser();
  if (!userId) return { state: 'signed-out', userId: null, emails: [] };

  // ADMIN FAIL-SAFE: an admin is inherently trusted and must never be blocked
  // from the app or the sensitive APIs, even if their email was never added to
  // the INVITE_ALLOWLIST. The admin allowlist defaults to the founder's email
  // (see admin.ts), so this guarantees Howard can always get in regardless of
  // how the invite list is configured.
  const adminEmails = getAdminEmails();
  if (emails.some((e) => adminEmails.includes(e))) {
    return { state: 'approved', userId, emails };
  }

  // Signed in — approved if ANY linked email is on the allowlist. isEmailAllowedAsync
  // fails safe internally (dead beta DB → env-var allowlist only), so this never
  // throws its way into a lockout.
  let approved = false;
  for (const email of emails) {
    try {
      if (await isEmailAllowedAsync(email)) {
        approved = true;
        break;
      }
    } catch {
      // Defensive: isEmailAllowedAsync already swallows store errors, but never
      // let one email's failure abort the loop for the others.
    }
  }
  return { state: approved ? 'approved' : 'unapproved', userId, emails };
}

/**
 * Single guard for the paid / sensitive API routes. Enforces BOTH:
 *
 *   1. APPROVAL — signed-out → 401, signed-in-but-unapproved → 403. Only an
 *      approved (or dev/stub) caller proceeds. This is what stops an
 *      unapproved competitor account from spending the owner's AI money.
 *   2. RATE LIMIT — a per-IP AND a per-user sliding-window limit (best-effort,
 *      in-memory; see the Upstash TODO in rate-limit.ts for production).
 *
 * Returns a ready-to-return NextResponse when the request must be blocked, or
 * null when the caller should proceed.
 *
 * Usage inside a route handler:
 *   const blocked = await guardSensitiveRoute(request, { routeId: 'help-chat', perMinute: 30 });
 *   if (blocked) return blocked;
 */
export async function guardSensitiveRoute(
  request: NextRequest,
  opts: { routeId: string; perMinute?: number },
): Promise<NextResponse | null> {
  const { state, userId } = await resolveApproval();

  if (state === 'signed-out') {
    return NextResponse.json(
      { error: 'Please sign in to use this feature.' },
      { status: 401 },
    );
  }
  if (state === 'unapproved') {
    return NextResponse.json(
      {
        error:
          "Your account is still awaiting beta approval. We'll email you the moment you're in.",
      },
      { status: 403 },
    );
  }

  // state is 'approved' or 'stub' → allowed. Apply rate limits.
  const perMinute = opts.perMinute ?? 20;

  // Per-IP limit (catches un-authenticated dev/stub traffic and shared-account
  // abuse from one machine).
  const ipLimited = enforceRateLimit(request, {
    limit: perMinute,
    namespace: opts.routeId,
  });
  if (ipLimited) return ipLimited;

  // Per-user limit (survives IP changes; can't be diluted across many IPs).
  if (userId) {
    const userLimited = enforceRateLimit(request, {
      limit: perMinute,
      namespace: `${opts.routeId}:user`,
      subjectKey: userId,
    });
    if (userLimited) return userLimited;
  }

  return null;
}
