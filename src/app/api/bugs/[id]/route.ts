/**
 * GET /api/bugs/<id> — admin endpoint that returns a single bug record
 * INCLUDING the base64 screenshot. Used by the /admin/bugs detail panel
 * when the admin clicks "View details".
 *
 * Same v1 admin gate as the other admin APIs.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getBugById } from '@/lib/access/bug-store';
import { requireAdmin } from '@/lib/access/admin-guard';

export const runtime = 'nodejs';

interface Ctx {
  params: { id: string } | Promise<{ id: string }>;
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const { id } = await Promise.resolve(ctx.params);
  if (!id) {
    return NextResponse.json(
      { ok: false, error: 'Missing bug id.' },
      { status: 400 },
    );
  }
  const bug = await getBugById(id);
  if (!bug) {
    return NextResponse.json(
      { ok: false, error: 'Bug not found.' },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, bug });
}
