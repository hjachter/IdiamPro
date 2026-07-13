/**
 * POST /api/share/unpublish  { shareId }
 *
 * Revokes a published link. The `/s/<id>` page stops resolving immediately.
 * Only the owner of the link may revoke it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthEnabled } from '@/lib/auth/auth-config';
import { getServerUserId } from '@/lib/billing/paid-feature-gate';
import { deleteShare } from '@/lib/sharing/share-store';

// Authenticated, storage-writing endpoint — always run on demand.
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const userId = await getServerUserId();
  if (isAuthEnabled() && !userId) {
    return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  }
  const ownerId = userId ?? 'local';

  let shareId = '';
  try {
    const body = (await request.json()) as { shareId?: string };
    shareId = typeof body.shareId === 'string' ? body.shareId : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!shareId) {
    return NextResponse.json({ error: 'Missing shareId.' }, { status: 400 });
  }

  const ok = await deleteShare(ownerId, shareId);
  if (!ok) {
    return NextResponse.json(
      { error: 'That shared link was not found or is not yours.' },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
