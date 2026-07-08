/**
 * Admin dependency-health API.
 *
 * Runs the dependency-health sweep server-side (where the secret keys live)
 * and returns the normalized board as JSON. The /admin/health page fetches
 * this on load and whenever "Run check now" is pressed.
 *
 * The response contains ONLY status/latency/detail — never any secret. The
 * probes read the app's own keys server-side; nothing sensitive crosses the
 * wire.
 *
 * Auth: server-enforced admin gate (requireAdmin) — a signed-in Clerk user
 * on the ADMIN_EMAILS allowlist. Non-admins get a 401. Also marked no-store
 * / non-indexable so the board is never publicly scrapable.
 */

import { NextResponse } from 'next/server';
import { checkAllDependencies } from '@/lib/health/dependency-health';
import { requireAdmin } from '@/lib/access/admin-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const results = await checkAllDependencies();
    return NextResponse.json(
      { generatedAt: new Date().toISOString(), results },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
