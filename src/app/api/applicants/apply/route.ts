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
import {
  createApplicant,
  getApplicantById,
  type ApplicantRecord,
} from '@/lib/access/applicant-store';
import { sendApplicantNotification, sendStorageAlert } from '@/lib/email/send';
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

  // LAYER 1 — attempt persistence, never throwing out of the handler. The
  // stub backend silently drops writes and a dead KV throws; a write+read
  // round-trip is the only trustworthy "did it land?" test.
  let createdRecord: ApplicantRecord | null = null;
  let persisted = false;
  try {
    createdRecord = await createApplicant({
      name,
      email,
      reason: reason.length > 0 ? reason : undefined,
      ip: getClientIp(request),
      referrer: request.headers.get('referer') ?? undefined,
    });
    try {
      persisted = (await getApplicantById(createdRecord.id)) !== null;
    } catch {
      persisted = false;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[applicants/apply] store save failed:', err);
    createdRecord = null;
    persisted = false;
  }

  // LAYER 2 — ALWAYS notify Howard with full detail, decoupled from the
  // store. Built from the REQUEST data so it works even when the record
  // never persisted. This redundant email IS the backup.
  const base = getAdminBaseUrl(request);
  const applicantId = createdRecord?.id ?? '';
  const signupDate = createdRecord?.signupDate ?? new Date().toISOString();
  const adminUrl = applicantId
    ? `${base}/admin/applicants?focus=${encodeURIComponent(applicantId)}`
    : `${base}/admin/applicants`;

  let notifyOk = false;
  try {
    const outcome = await sendApplicantNotification({
      applicantId,
      name,
      email,
      signupDate,
      reason: reason.length > 0 ? reason : undefined,
      ip: getClientIp(request),
      referrer: request.headers.get('referer') ?? undefined,
      adminUrl,
    });
    // 'skipped-no-smtp' is fine — in dev there's no SMTP but the file store
    // persists, so that branch never becomes a degraded case.
    notifyOk = outcome.status !== 'error';
  } catch {
    notifyOk = false;
  }

  // Normal success: the record landed in the store.
  if (persisted) {
    return NextResponse.json({ ok: true, applicantId });
  }

  // Not persisted — but the applicant is safely captured in Howard's inbox.
  if (notifyOk) {
    try {
      await sendStorageAlert({
        kind: 'apply-degraded',
        detectedAt: new Date().toISOString(),
        applicant: {
          name,
          email,
          reason: reason.length > 0 ? reason : undefined,
        },
        adminUrl,
      });
    } catch {
      // Best-effort — the notification email already holds the applicant.
    }
    return NextResponse.json({ ok: true, applicantId, degraded: true });
  }

  // Both store AND email failed = true total loss → fail loud.
  return NextResponse.json(
    {
      ok: false,
      error: 'Something went wrong on our end — please try again in a moment.',
    },
    { status: 500 },
  );
}
