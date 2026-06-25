/**
 * GET /api/bugs/list — admin endpoint for /admin/bugs.
 *
 * Returns every bug submission, newest-first. Strips the base64 screenshot
 * to keep the list payload small; the admin UI fetches the full record
 * (with screenshot) on demand via GET /api/bugs/<id>.
 *
 * Same v1 admin gate as the other admin APIs (`x-idiampro-admin` header).
 */
import { NextRequest, NextResponse } from 'next/server';
import { listBugs, stripScreenshot } from '@/lib/access/bug-store';
import { requireAdmin } from '@/lib/access/admin-guard';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const records = await listBugs();
  return NextResponse.json({
    ok: true,
    bugs: records.map(stripScreenshot),
  });
}
