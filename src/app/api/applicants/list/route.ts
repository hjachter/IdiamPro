/**
 * GET /api/applicants/list
 *
 * Admin endpoint. Returns every applicant record, newest-first, for the
 * /admin/applicants dashboard to render.
 *
 * V1 admin gate: the `x-idiampro-admin` header carrying the localStorage
 * isAdmin token, matching the pattern used by /admin/metrics and
 * /admin/invites. This is a v1 stopgap — real admin auth lands when Clerk
 * organizations / roles wire up post-launch. Until then the same caveat
 * applies as for the other admin pages: the API is technically reachable
 * by anyone who flips the flag in DevTools.
 */

import { NextRequest, NextResponse } from 'next/server';
import { listApplicants } from '@/lib/access/applicant-store';
import { requireAdmin } from '@/lib/access/admin-guard';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const records = await listApplicants();
  return NextResponse.json({ ok: true, applicants: records });
}
