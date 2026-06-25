/**
 * POST /api/bugs/<id>/status — admin endpoint to update a bug's status.
 *
 * Body: { status: 'new' | 'acknowledged' | 'in_progress' | 'resolved' | 'wont_fix' }
 *
 * Same v1 admin gate as the other admin APIs.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  setBugStatus,
  BUG_STATUSES,
  type BugStatus,
} from '@/lib/access/bug-store';
import { requireAdmin } from '@/lib/access/admin-guard';

export const runtime = 'nodejs';

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

  let body: { status?: unknown };
  try {
    body = (await request.json()) as { status?: unknown };
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid request body.' },
      { status: 400 },
    );
  }

  const statusRaw = typeof body.status === 'string' ? body.status : '';
  if (!BUG_STATUSES.includes(statusRaw as BugStatus)) {
    return NextResponse.json(
      { ok: false, error: 'Unknown status value.' },
      { status: 400 },
    );
  }
  const status = statusRaw as BugStatus;

  const record = await setBugStatus(id, status);
  if (!record) {
    return NextResponse.json(
      { ok: false, error: 'Bug not found.' },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, bug: { ...record, screenshotBase64: undefined } });
}
