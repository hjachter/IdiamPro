/**
 * GET /api/feedback/list — admin endpoint for /admin/feedback. Returns every
 * feedback submission, newest first. Same v1 admin gate as
 * /api/applicants/list.
 */

import { NextRequest, NextResponse } from 'next/server';
import { listFeedback } from '@/lib/access/feedback-store';
import { requireAdmin } from '@/lib/access/admin-guard';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const records = await listFeedback();
  return NextResponse.json({ ok: true, feedback: records });
}
