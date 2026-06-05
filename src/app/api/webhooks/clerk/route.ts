/**
 * Clerk webhook handler.
 *
 * Clerk fires this endpoint with a Svix-signed payload whenever a user
 * lifecycle event occurs. We listen for `user.created` and:
 *
 *   1. Run the invite-allowlist check (defense in depth — the signup
 *      page already gates by email, but anyone who navigates around the
 *      UI must still be blocked here). If the user's email isn't on the
 *      allowlist, we call Clerk's REST API to delete the account and
 *      stop before sending any welcome email.
 *   2. Fire the welcome email (only for approved users).
 *
 * Configuration (post-launch):
 *
 *   1. In the Clerk dashboard, add a webhook endpoint pointing at
 *      https://[host]/api/webhooks/clerk and subscribe to `user.created`
 *      (also `user.deleted` if you want us to mark the user as
 *      unsubscribed on deletion — wire that up later).
 *
 *   2. Copy the "Signing Secret" Clerk shows you and set
 *      CLERK_WEBHOOK_SECRET in the environment (Vercel project settings,
 *      and your local .env.local).
 *
 *   3. With CLERK_WEBHOOK_SECRET unset (today), this route still accepts
 *      POSTs and logs a clear "secret not configured" warning. This lets
 *      us run integration tests without a real Svix signature and ship
 *      the route now; the day the secret lands, signature verification
 *      starts being enforced automatically.
 *
 *   4. Email actually leaves the building only once RESEND_API_KEY is
 *      also set. With Clerk wired but Resend not, the webhook still
 *      records the event without sending mail.
 *
 *   5. INVITE_ALLOWLIST gates which emails are allowed. Empty / unset =
 *      everyone allowed (stub mode). See src/lib/access/allowlist.ts.
 *
 * Why no SDK: Svix's signature scheme is a single HMAC over a single
 * canonical string. We verify it directly with Node's crypto so this
 * route adds zero new dependencies. Same story for the Clerk REST delete
 * call — a single fetch with a Bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { sendWelcomeEmail } from '@/lib/email/send';
import { isEmailAllowed } from '@/lib/access/allowlist';

// Run on the Node runtime; the email modules use fs.
export const runtime = 'nodejs';

interface ClerkEmailAddress {
  id?: string;
  email_address?: string;
}

interface ClerkUserCreatedData {
  id?: string;
  first_name?: string | null;
  primary_email_address_id?: string | null;
  email_addresses?: ClerkEmailAddress[];
}

interface ClerkEvent {
  type?: string;
  data?: ClerkUserCreatedData;
}

/**
 * Verify a Svix-signed payload. Svix signs each event with a header
 * `svix-signature` formed as "v1,[base64-signature] v1,[another]" plus a
 * `svix-id` and `svix-timestamp` pair. The signed string is
 * `[svixId].[svixTimestamp].[rawBody]`. We accept any one of the v1
 * signatures matching our HMAC.
 *
 * The Clerk dashboard shows the signing secret prefixed with `whsec_`.
 * The actual key for the HMAC is the base64-decoded portion after that
 * prefix.
 */
function verifySvixSignature(args: {
  secret: string;
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
  rawBody: string;
}): boolean {
  const { secret, svixId, svixTimestamp, svixSignature, rawBody } = args;
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const keyMaterial = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  let keyBuf: Buffer;
  try {
    keyBuf = Buffer.from(keyMaterial, 'base64');
  } catch {
    return false;
  }

  const signedString = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = createHmac('sha256', keyBuf).update(signedString).digest();

  // svix-signature is space-separated list of "v1,[base64-sig]" items
  const candidates = svixSignature.split(' ').map((s) => s.trim()).filter(Boolean);
  for (const c of candidates) {
    const [version, sig] = c.split(',');
    if (version !== 'v1' || !sig) continue;
    let sigBuf: Buffer;
    try {
      sigBuf = Buffer.from(sig, 'base64');
    } catch {
      continue;
    }
    if (sigBuf.length === expected.length && timingSafeEqual(sigBuf, expected)) {
      return true;
    }
  }
  return false;
}

function resolveEmail(data: ClerkUserCreatedData): string | null {
  const list = data.email_addresses ?? [];
  if (data.primary_email_address_id) {
    const match = list.find((e) => e.id === data.primary_email_address_id);
    if (match?.email_address) return match.email_address;
  }
  return list[0]?.email_address ?? null;
}

/**
 * Test hook: lets the test transport intercept the Clerk REST delete-user
 * call without standing up a real Clerk instance. The real implementation
 * uses fetch().
 */
type ClerkDeleter = (userId: string) => Promise<{ ok: boolean; status: number; body?: string }>;
let activeDeleter: ClerkDeleter = realClerkDeleter;

async function realClerkDeleter(userId: string) {
  const apiKey = (process.env.CLERK_SECRET_KEY ?? '').trim();
  if (apiKey.length === 0) {
    // Stub mode: log loudly so the unauthorized signup is visible in
    // Howard's Clerk dashboard, but don't pretend we deleted.
    // eslint-disable-next-line no-console
    console.warn(
      '[clerk-webhook] CLERK_SECRET_KEY not set — cannot delete unauthorized user. The account will remain in Clerk until manually removed.',
    );
    return { ok: false, status: 0, body: 'no-clerk-secret' };
  }
  try {
    const res = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) return { ok: true, status: res.status };
    const body = await res.text().catch(() => '');
    return { ok: false, status: res.status, body: body.slice(0, 200) };
  } catch (err) {
    return { ok: false, status: 0, body: String((err as Error)?.message ?? err) };
  }
}

/** Test-only: swap the Clerk REST deleter. */
export function _setClerkDeleterForTest(fn: ClerkDeleter | null): void {
  activeDeleter = fn ?? realClerkDeleter;
}

export async function POST(request: NextRequest) {
  const secret = (process.env.CLERK_WEBHOOK_SECRET ?? '').trim();
  const rawBody = await request.text();

  if (secret.length === 0) {
    // Stub mode: secret not configured. We still parse + react so the
    // route is testable end-to-end against the Clerk test-event format,
    // but we log a clear warning that signature verification is bypassed.
    console.warn(
      '[clerk-webhook] Clerk webhook called but CLERK_WEBHOOK_SECRET is not configured — skipping signature verification (dev/stub mode).',
    );
  } else {
    const ok = verifySvixSignature({
      secret,
      svixId: request.headers.get('svix-id'),
      svixTimestamp: request.headers.get('svix-timestamp'),
      svixSignature: request.headers.get('svix-signature'),
      rawBody,
    });
    if (!ok) {
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
    }
  }

  let event: ClerkEvent;
  try {
    event = JSON.parse(rawBody) as ClerkEvent;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (event.type !== 'user.created') {
    // Quietly acknowledge other event types; Clerk will keep delivering
    // until it sees a 2xx and we don't want retry storms for events we
    // didn't ask for.
    return NextResponse.json({ ok: true, ignored: event.type ?? 'unknown' });
  }

  const data = event.data ?? {};
  const userId = data.id ?? '';
  const email = resolveEmail(data);
  const firstName = (data.first_name ?? '') || null;

  if (!userId || !email) {
    // Can't enforce allowlist if we can't see the email; can't send a
    // welcome either. Log loudly and acknowledge so Clerk doesn't retry.
    // eslint-disable-next-line no-console
    console.warn(
      '[clerk-webhook] user.created received with missing user id or email — skipping (no allowlist enforcement possible). Inspect the Clerk dashboard manually.',
    );
    return NextResponse.json({ ok: true, skipped: 'missing user id or email' });
  }

  // Defense in depth: even if the signup page somehow let this email
  // through, we re-check the allowlist here and delete the account on
  // mismatch BEFORE sending any welcome email.
  if (!isEmailAllowed(email)) {
    // eslint-disable-next-line no-console
    console.warn(
      `[clerk-webhook] Blocked unauthorized signup: ${email} (userId=${userId}) — account deletion requested.`,
    );
    const result = await activeDeleter(userId);
    if (!result.ok) {
      // eslint-disable-next-line no-console
      console.error(
        `[clerk-webhook] Failed to delete unauthorized user ${userId} (${email}): status=${result.status} body=${result.body ?? ''}. Manual cleanup required in the Clerk dashboard.`,
      );
    }
    // Always return 200 — we've handled the event one way or another and
    // don't want Clerk to retry storm us.
    return NextResponse.json({
      ok: true,
      blocked: true,
      deleted: result.ok,
      reason: 'not-on-invite-allowlist',
    });
  }

  // Allowed — proceed with the welcome email.
  const outcome = await sendWelcomeEmail({ to: email, firstName, userId });
  return NextResponse.json({ ok: true, send: outcome });
}
