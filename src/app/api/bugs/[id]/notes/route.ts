/**
 * POST /api/bugs/<id>/notes — admin endpoint to update a bug's internal
 * progress notes.
 *
 * Body: { notes: string }
 *
 * These notes are admin-only. They are NEVER returned by any user-facing
 * API and are NEVER surfaced to the reporter. The bug detail GET (which
 * IS admin-gated) and this endpoint are the only places progressNotes
 * round-trips through the network.
 *
 * Same v1 admin gate as the other admin APIs.
 */
import { NextRequest, NextResponse } from 'next/server';
import { setBugProgressNotes } from '@/lib/access/bug-store';
import { requireAdmin } from '@/lib/access/admin-guard';

export const runtime = 'nodejs';

// Conservative ceiling — well above anything Howard will reasonably type
// per bug, well below "someone is trying to dump a file in here".
const MAX_NOTES_LENGTH = 20_000;

interface Ctx {
  params: { id: string } | Promise<{ id: string }>;
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const { id } = await Promise.resolve(ctx.params);
  if (!id) {
    return NextResponse.json(
      { ok: false, error: 'Missing bug id.' },
      { status: 400 },
    );
  }

  let body: { notes?: unknown };
  try {
    body = (await request.json()) as { notes?: unknown };
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid request body.' },
      { status: 400 },
    );
  }

  // Accept missing/null as "clear the notes". Reject any non-string.
  let notes: string;
  if (body.notes == null) {
    notes = '';
  } else if (typeof body.notes === 'string') {
    notes = body.notes;
  } else {
    return NextResponse.json(
      { ok: false, error: 'Notes must be text.' },
      { status: 400 },
    );
  }

  if (notes.length > MAX_NOTES_LENGTH) {
    return NextResponse.json(
      { ok: false, error: `Notes are too long (over ${MAX_NOTES_LENGTH} characters).` },
      { status: 400 },
    );
  }

  const record = await setBugProgressNotes(id, notes);
  if (!record) {
    return NextResponse.json(
      { ok: false, error: 'Bug not found.' },
      { status: 404 },
    );
  }

  // Strip screenshot from the response payload to keep it lean — the admin
  // UI already has the screenshot from the initial detail fetch.
  return NextResponse.json({
    ok: true,
    bug: { ...record, screenshotBase64: undefined },
  });
}
