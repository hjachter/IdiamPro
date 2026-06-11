/**
 * POST /api/applicants/reject
 *
 * Admin endpoint. Flips an applicant to status 'rejected'. Does NOT
 * email the applicant — rejected entries move to a separate list in
 * the admin view, no further communication is sent.
 *
 * Body: { id: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { rejectApplicant } from '@/lib/access/applicant-store';
import { requireAdmin } from '@/lib/access/admin-guard';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
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

  const record = await rejectApplicant(id);
  if (!record) {
    return NextResponse.json(
      { ok: false, error: "We couldn't find that applicant." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, applicant: record });
}
