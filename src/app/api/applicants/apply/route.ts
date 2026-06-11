/**
 * POST /api/applicants/apply
 *
 * Public endpoint. Accepts a beta application from the sign-up form,
 * persists it to the applicant store as { status: 'pending' }, and emails
 * Howard so he can review and approve in /admin/applicants.
 *
 * Body: { name: string, email: string, reason?: string }
 * Response: { ok: true, applicantId: string } on success.
 *           { ok: false, error: string } on validation failure (400).
 *
 * Rate-limited per IP to discourage scripted form spam. The applicant
 * store is idempotent on email — re-submitting the same address returns
 * the existing record rather than creating a duplicate pending row.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApplicant } from '@/lib/access/applicant-store';
import { sendApplicantNotification } from '@/lib/email/send';
import { enforceRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

function getClientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for') ?? '';
  const first = fwd.split(',')[0]?.trim();
  if (first) return first;
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  return '';
}

function getAdminBaseUrl(request: NextRequest): string {
  // Trust the request's own host for the deep link so the email goes to
  // the same environment the applicant signed up on (prod, preview, local).
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const host = request.headers.get('host') ?? '';
  if (!host) return 'https://2ndbrainware.com';
  return `${proto}://${host}`;
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, {
    limit: 5,
    namespace: 'applicant-apply',
  });
  if (limited) return limited;

  let body: { name?: unknown; email?: unknown; reason?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Could not read your application — please try again.' },
      { status: 400 },
    );
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

  if (!name) {
    return NextResponse.json(
      { ok: false, error: 'Add your name to continue.' },
      { status: 400 },
    );
  }
  if (!email || email.indexOf('@') === -1) {
    return NextResponse.json(
      { ok: false, error: 'Enter a valid email address.' },
      { status: 400 },
    );
  }

  let applicantId: string;
  let isNewApplication = false;
  let createdRecord: Awaited<ReturnType<typeof createApplicant>>;
  try {
    createdRecord = await createApplicant({
      name,
      email,
      reason: reason.length > 0 ? reason : undefined,
      ip: getClientIp(request),
      referrer: request.headers.get('referer') ?? undefined,
    });
    applicantId = createdRecord.id;
    // createApplicant returns the existing record on duplicate email; we
    // can tell whether this was new by comparing the signup date to "now".
    const ageMs = Date.now() - new Date(createdRecord.signupDate).getTime();
    isNewApplication = ageMs < 5_000; // freshly stamped
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : 'Something went sideways saving your application — please try again.',
      },
      { status: 400 },
    );
  }

  // Notify Howard — but only when this is a genuinely new application.
  // Resubmits from the same email shouldn't keep paging him.
  if (isNewApplication) {
    const adminUrl = `${getAdminBaseUrl(request)}/admin/applicants?focus=${encodeURIComponent(applicantId)}`;
    try {
      await sendApplicantNotification({
        applicantId,
        name: createdRecord.name,
        email: createdRecord.email,
        signupDate: createdRecord.signupDate,
        reason: createdRecord.reason,
        ip: createdRecord.ip,
        referrer: createdRecord.referrer,
        adminUrl,
      });
    } catch (err) {
      // Don't fail the applicant just because the notification didn't go
      // out. The record is saved; Howard will see it in /admin/applicants.
      // eslint-disable-next-line no-console
      console.warn('[applicants/apply] notification send failed:', err);
    }
  }

  return NextResponse.json({ ok: true, applicantId });
}
