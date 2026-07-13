/**
 * GET /api/share/list
 *
 * Returns metadata (no HTML) for the caller's active published links, so the
 * in-app "Manage shared links" list can show + revoke them.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthEnabled } from '@/lib/auth/auth-config';
import { getServerUserId, resolveServerPlan } from '@/lib/billing/paid-feature-gate';
import {
  FREE_SHARE_LINK_LIMIT,
  listOwnerShares,
} from '@/lib/sharing/share-store';

// Reads per-user storage at request time — never pre-render/cache at build.
export const dynamic = 'force-dynamic';

function buildBase(request: NextRequest): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim().replace(/\/$/, '');
  return configured || new URL(request.url).origin;
}

export async function GET(request: NextRequest) {
  const userId = await getServerUserId();
  if (isAuthEnabled() && !userId) {
    return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  }
  const ownerId = userId ?? 'local';
  const plan = userId ? await resolveServerPlan(userId) : 'free';

  const shares = await listOwnerShares(ownerId);
  const base = buildBase(request);
  return NextResponse.json({
    shares: shares.map((s) => ({ ...s, url: `${base}/s/${s.shareId}` })),
    plan,
    limit: FREE_SHARE_LINK_LIMIT,
    unlimited: plan === 'premium',
  });
}
