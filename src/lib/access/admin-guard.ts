/**
 * Tiny admin gate for v1 admin API endpoints.
 *
 * The /admin/* pages check `localStorage.isAdmin === 'true'` before
 * rendering. To extend that same gate to server-side endpoints (so the
 * applicant approve / reject / notes mutations don't fall back to the
 * env-var allowlist alone), the admin page reads the flag and sends it
 * as a header on every fetch.
 *
 * This is intentionally weak — anyone who flips the localStorage flag in
 * DevTools can call the endpoints. Real admin auth (Clerk organizations
 * + role check) is the post-launch upgrade; the contract here doesn't
 * change when that lands.
 */

import { NextRequest, NextResponse } from 'next/server';

const ADMIN_HEADER = 'x-idiampro-admin';
const ADMIN_TOKEN = 'true';

/**
 * Returns a 403 NextResponse if the request lacks the admin header.
 * Returns null when the caller is authorized, letting the route handler
 * carry on.
 */
export function requireAdmin(request: NextRequest): NextResponse | null {
  const header = request.headers.get(ADMIN_HEADER) ?? '';
  if (header.trim().toLowerCase() !== ADMIN_TOKEN) {
    return NextResponse.json(
      { ok: false, error: 'Admin access required.' },
      { status: 403 },
    );
  }
  return null;
}

export { ADMIN_HEADER, ADMIN_TOKEN };
