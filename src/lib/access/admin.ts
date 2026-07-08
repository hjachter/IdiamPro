/**
 * Server-enforced admin authorization.
 *
 * This module is the single source of truth for "is the current request
 * made by an IdiamPro admin?" It replaces the old v1 stopgap that trusted
 * a client-set `localStorage.isAdmin` flag (which anyone could flip in
 * DevTools). Admin status is now decided ENTIRELY on the server from:
 *
 *   (a) a signed-in Clerk user, AND
 *   (b) that user's email being on the ADMIN allowlist.
 *
 * The allowlist comes from the ADMIN_EMAILS env var (comma-separated,
 * case-insensitive). IMPORTANT: so Howard can never lock himself out, when
 * ADMIN_EMAILS is unset/empty the allowlist DEFAULTS to hjachter@gmail.com.
 * Set ADMIN_EMAILS in Vercel to add/replace admins.
 *
 * We check ALL of a Clerk user's linked email addresses (primary + every
 * secondary), mirroring the invite-allowlist matching in allowlist.ts.
 *
 * SERVER-ONLY. Never import this from a client component — it reads the
 * Clerk server session. Consumers: src/app/admin/layout.tsx (page gate) and
 * src/lib/access/admin-guard.ts (API gate).
 *
 * Dev/stub behavior: when Clerk auth is not configured (no publishable +
 * secret key, i.e. local dev), there is no server session to check, so this
 * returns true — admin surfaces stay usable locally, exactly as the rest of
 * the app's env-gated layers (middleware auth-wall, invite allowlist) behave
 * in stub mode. Real enforcement switches on the moment Clerk keys exist in
 * production.
 */

import { isAuthEnabled } from '@/lib/auth/auth-config';

/** Fallback admin so Howard is never locked out if ADMIN_EMAILS is unset. */
const DEFAULT_ADMIN_EMAIL = 'hjachter@gmail.com';

/** Normalize an email for comparison: trim + lowercase. */
function normalize(email: string): string {
  return (email ?? '').trim().toLowerCase();
}

/**
 * The parsed admin allowlist (lowercased, trimmed, empties dropped).
 * Defaults to [hjachter@gmail.com] when ADMIN_EMAILS is unset/empty.
 */
export function getAdminEmails(): string[] {
  const raw = (process.env.ADMIN_EMAILS ?? '').trim();
  const list = raw
    .split(',')
    .map((s) => normalize(s))
    .filter((s) => s.length > 0 && s.indexOf('@') !== -1);
  return list.length > 0 ? list : [normalize(DEFAULT_ADMIN_EMAIL)];
}

/**
 * All email addresses (primary + secondary) linked to the currently
 * signed-in Clerk user. Empty array if not signed in or auth is off.
 *
 * Uses a lazy require of `@clerk/nextjs/server` (which is marked
 * `server-only`) so this module never poisons a client bundle if it's ever
 * imported by accident, and so the Clerk runtime never loads in stub builds.
 */
async function getSignedInUserEmails(): Promise<string[]> {
  if (!isAuthEnabled()) return [];
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
    if (!clerkServer.auth) return [];
    const session = await Promise.resolve(clerkServer.auth());
    const userId = session.userId ?? null;
    if (!userId || !clerkServer.clerkClient) return [];
    const client = await clerkServer.clerkClient();
    const user = await client.users.getUser(userId);
    return (user.emailAddresses ?? [])
      .map((e) => normalize(e.emailAddress ?? ''))
      .filter((e) => e.length > 0);
  } catch {
    return [];
  }
}

/**
 * True when the current request is made by an authorized admin.
 *
 * Dev/stub (auth disabled): true — see module docs.
 * Production (auth enabled): true only if a signed-in Clerk user has at
 * least one linked email on the admin allowlist.
 */
export async function isAdminUser(): Promise<boolean> {
  // Auth off (local dev / stub): keep admin surfaces usable, matching the
  // middleware auth-wall and invite-allowlist stub behavior.
  if (!isAuthEnabled()) return true;

  const emails = await getSignedInUserEmails();
  if (emails.length === 0) return false; // signed out
  const allow = getAdminEmails();
  return emails.some((e) => allow.includes(e));
}
