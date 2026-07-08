/**
 * POST /api/applicants/notes
 *
 * Admin endpoint. Persists Howard's private notes on an applicant.
 *
 * Body: { id: string, notes: string }
 *
 * Notes are personal — never surfaced to the applicant, never included
 * in emails. They show up only in /admin/applicants for Howard to
 * remember who's who. Empty string clears the note.
 */

import { NextRequest, NextResponse } from 'next/server';
import { setApplicantNotes } from '@/lib/access/applicant-store';
import { requireAdmin } from '@/lib/access/admin-guard';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: { id?: unknown; notes?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid request body.' },
      { status: 400 },
    );
  }
  const id = typeof body.id === 'string' ? body.id : '';
  const notes = typeof body.notes === 'string' ? body.notes : '';
  if (!id) {
    return NextResponse.json(
      { ok: false, error: 'Applicant id is required.' },
      { status: 400 },
    );
  }

  const record = await setApplicantNotes(id, notes);
  if (!record) {
    return NextResponse.json(
      { ok: false, error: "We couldn't find that applicant." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, applicant: record });
}
