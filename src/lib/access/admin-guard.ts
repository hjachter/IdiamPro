/**
 * Server-side admin gate for admin-only API endpoints.
 *
 * Every admin data route (applicant list/approve/reject/notes, feedback
 * list, bug list/detail/status/notes, dependency-health) calls
 * `requireAdmin()` before doing anything. Authorization is decided ENTIRELY
 * on the server via `isAdminUser()` — a signed-in Clerk user whose email is
 * on the ADMIN_EMAILS allowlist (see src/lib/access/admin.ts).
 *
 * This replaces the old v1 stopgap that trusted an `x-idiampro-admin`
 * request header derived from a client `localStorage.isAdmin` flag — which
 * anyone could set. The header is no longer read; the Clerk session cookie
 * (sent automatically on same-origin fetches) is the source of truth.
 *
 * Dev/stub: when Clerk auth is not configured, `isAdminUser()` returns true,
 * so local dev keeps working exactly as before.
 */

import { NextResponse } from 'next/server';
import { isAdminUser } from '@/lib/access/admin';

/**
 * Returns a 401 NextResponse when the caller is not an authorized admin.
 * Returns null when authorized, letting the route handler carry on.
 *
 * Takes no request argument — admin status is read from the server session.
 * (The optional arg is accepted and ignored for call-site compatibility.)
 */
export async function requireAdmin(
  _request?: unknown,
): Promise<NextResponse | null> {
  const ok = await isAdminUser();
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: 'Admin access required.' },
      { status: 401 },
    );
  }
  return null;
}
