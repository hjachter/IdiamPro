/**
 * POST /api/applicants/approve
 *
 * Admin endpoint. Flips an applicant to status 'approved', stamps the
 * approval date, and sends the "you're in" email from Howard's address.
 *
 * Body: { id: string }
 * Response: { ok: true, applicant: ApplicantRecord, emailOutcome: SendOutcome }
 *
 * Approving an applicant immediately adds their email to the dynamic
 * allowlist (allowlist.ts merges approved applicants with the env-var
 * list). Their next visit to /signin works because the Clerk-webhook
 * defense-in-depth check now sees the email.
 */

import { NextRequest, NextResponse } from 'next/server';
import { approveApplicant } from '@/lib/access/applicant-store';
import { sendApplicantApprovedEmail } from '@/lib/email/send';
import { requireAdmin } from '@/lib/access/admin-guard';

export const runtime = 'nodejs';

function getSignInUrl(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const host = request.headers.get('host') ?? '';
  if (!host) return 'https://2ndbrainware.com/signin';
  return `${proto}://${host}/signin`;
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: { id?: unknown };
  try {
    body = (await request.json()) as { id?: unknown };
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid request body.' },
      { status: 400 },
    );
  }
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) {
    return NextResponse.json(
      { ok: false, error: 'Applicant id is required.' },
      { status: 400 },
    );
  }

  const record = await approveApplicant(id);
  if (!record) {
    return NextResponse.json(
      { ok: false, error: "We couldn't find that applicant." },
      { status: 404 },
    );
  }

  // Send the welcome from Howard. We use the applicant's id as the
  // userId for unsubscribe-store bookkeeping — they have no Clerk id
  // yet (Clerk creates one when they hit /signin), and that's fine:
  // the unsubscribe link still works as a stable per-applicant token.
  const firstName = record.name.split(' ')[0] ?? null;
  const emailOutcome = await sendApplicantApprovedEmail({
    to: record.email,
    firstName,
    userId: record.id,
    signInUrl: getSignInUrl(request),
    reason: record.reason,
  });

  return NextResponse.json({ ok: true, applicant: record, emailOutcome });
}
