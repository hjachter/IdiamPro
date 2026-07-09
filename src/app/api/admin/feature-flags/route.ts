/**
 * Admin Feature Switchboard API.
 *
 * GET  → the current effective flags (coded defaults ⊕ admin overrides).
 * POST → persist an override for one flag ({ key, enabled, audience }).
 *
 * Auth: server-enforced admin gate (requireAdmin) — a signed-in Clerk user on
 * the ADMIN_EMAILS allowlist. Non-admins get 401. Mirrors every other admin
 * route (dependency-health, applicants, bugs). In local dev (Clerk not
 * configured) the gate passes so the Switchboard is usable, matching the rest
 * of the app's env-gated stub behavior.
 *
 * FAIL-SAFE: GET never errors the app (getEffectiveFlags degrades to defaults).
 * POST surfaces a clear admin-facing message when the store is unavailable
 * rather than pretending the save worked.
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/access/admin-guard';
import { getEffectiveFlags, writeFlagOverride } from '@/lib/flags/flag-store';
import { FLAG_AUDIENCES, type FlagAudience } from '@/lib/flags/flags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const flags = await getEffectiveFlags();
  return NextResponse.json(
    { flags },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid request body.' },
      { status: 400 },
    );
  }

  const { key, enabled, audience } = (body ?? {}) as {
    key?: string;
    enabled?: boolean;
    audience?: string;
  };

  if (
    typeof key !== 'string' ||
    typeof enabled !== 'boolean' ||
    typeof audience !== 'string' ||
    !FLAG_AUDIENCES.includes(audience as FlagAudience)
  ) {
    return NextResponse.json(
      { ok: false, error: 'key, enabled, and a valid audience are required.' },
      { status: 400 },
    );
  }

  const result = await writeFlagOverride(key, {
    enabled,
    audience: audience as FlagAudience,
  });

  // ok=false here is a persistence problem (e.g. store unavailable), not an
  // auth/validation one — 503 so the client can show the returned message.
  return NextResponse.json(result, {
    status: result.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
