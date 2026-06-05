/**
 * Pre-signup invite check.
 *
 * The signup page POSTs an email to this endpoint BEFORE handing the
 * user off to Clerk. We answer { allowed, message } so the page can
 * either show the gating message (stay put) or reveal Clerk's SignUp
 * component (proceed). This is the UX layer of the invite-only gate.
 *
 * The webhook handler at /api/webhooks/clerk re-runs the same check as
 * defense in depth: if someone bypasses the page (e.g. by hitting Clerk
 * directly from a saved URL), the webhook deletes their account before
 * they can do anything.
 *
 * Stub-safe: with INVITE_ALLOWLIST unset, isEmailAllowed() returns true
 * and the response is always { allowed: true }, which is exactly the
 * pre-allowlist behavior.
 */

import { NextRequest, NextResponse } from 'next/server';
import { GATE_MESSAGE, isEmailAllowed } from '@/lib/access/allowlist';
import { enforceRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // Per-IP rate limit: cheap to call, but we don't want it abused as an
  // email-enumeration oracle if Howard later flips the gating copy to a
  // vaguer message.
  const limited = enforceRateLimit(request, { limit: 20, namespace: 'invite-check' });
  if (limited) return limited;

  let body: { email?: unknown };
  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    return NextResponse.json({ allowed: false, message: 'Invalid request.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email : '';
  if (!email || email.indexOf('@') === -1) {
    return NextResponse.json({
      allowed: false,
      message: 'Enter a valid email address to continue.',
    });
  }

  const allowed = isEmailAllowed(email);
  if (allowed) {
    return NextResponse.json({ allowed: true });
  }
  return NextResponse.json({ allowed: false, message: GATE_MESSAGE });
}
