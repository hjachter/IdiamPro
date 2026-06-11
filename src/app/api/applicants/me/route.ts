/**
 * GET /api/applicants/me?email=...
 *
 * Public endpoint used by the /app gate. Given an email (typically the
 * Clerk-signed-in user's primary email), returns whether they're on the
 * allowlist — either statically via INVITE_ALLOWLIST or because Howard
 * has clicked Approve on their applicant record.
 *
 * Response: { approved: boolean, status: 'pending' | 'approved' | 'rejected' | 'unknown' }
 *
 * Stub-safe: when the entire allowlist is empty (no env var, no approved
 * applicants), this returns { approved: true } so dev / local instances
 * keep working without any setup.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isEmailAllowedAsync } from '@/lib/access/allowlist';
import { getApplicantByEmail } from '@/lib/access/applicant-store';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const email = (url.searchParams.get('email') ?? '').trim();
  if (!email || email.indexOf('@') === -1) {
    return NextResponse.json({ approved: false, status: 'unknown' });
  }

  const approved = await isEmailAllowedAsync(email);
  const record = await getApplicantByEmail(email);
  const status = record?.status ?? (approved ? 'approved' : 'unknown');
  return NextResponse.json({ approved, status });
}
