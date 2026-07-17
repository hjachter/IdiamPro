/**
 * POST /api/share/publish
 *
 * Publishes (or re-publishes) an outline snapshot as a view-only page hosted
 * on OUR OWN infrastructure and returns a shareable URL on our domain. No
 * third party is ever involved.
 *
 * Auth: required in production (Clerk). In Electron/dev with auth disabled the
 * owner falls back to a stable local id so the desktop app works offline.
 *
 * Cost safety: NEW links are gated SERVER-SIDE by FREE_SHARE_LINK_LIMIT for
 * free accounts (premium = unlimited). Updating an existing owned link never
 * consumes allowance. A per-page size cap bounds hosting cost.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthEnabled } from '@/lib/auth/auth-config';
import { getServerUserId, resolveServerPlan } from '@/lib/billing/paid-feature-gate';
import { guardSensitiveRoute } from '@/lib/access/approval-guard';
import {
  ALLOWED_SHARE_TEMPLATES,
  FREE_SHARE_LINK_LIMIT,
  MAX_SHARE_HTML_BYTES,
  createShare,
  getShare,
  listOwnerShareIds,
  updateShare,
} from '@/lib/sharing/share-store';

// Authenticated, storage-writing endpoint — always run on demand.
export const dynamic = 'force-dynamic';

interface PublishBody {
  html?: string;
  title?: string;
  template?: string;
  /** When present, re-publish (overwrite) this existing owned link. */
  shareId?: string;
}

function buildShareUrl(request: NextRequest, shareId: string): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim().replace(/\/$/, '');
  const origin = configured || new URL(request.url).origin;
  return `${origin}/s/${shareId}`;
}

export async function POST(request: NextRequest) {
  // Approval + rate limit. Publishing a public page must be an approved
  // account (or dev/stub); unapproved → 403.
  const blocked = await guardSensitiveRoute(request, {
    routeId: 'share-publish',
    perMinute: 20,
  });
  if (blocked) return blocked;

  // Resolve the owner. Signed-in Clerk id in production; a stable local id in
  // the auth-disabled desktop/dev build so publishing still works there.
  const userId = await getServerUserId();
  if (isAuthEnabled() && !userId) {
    return NextResponse.json(
      { error: 'Please sign in to publish a shareable link.' },
      { status: 401 },
    );
  }
  const ownerId = userId ?? 'local';

  let body: PublishBody;
  try {
    body = (await request.json()) as PublishBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const html = typeof body.html === 'string' ? body.html : '';
  const title = (typeof body.title === 'string' ? body.title : '').trim() || 'Shared Outline';
  const template = ALLOWED_SHARE_TEMPLATES.includes((body.template ?? '') as never)
    ? (body.template as string)
    : 'marketing';

  if (!html.trim()) {
    return NextResponse.json({ error: 'Nothing to publish.' }, { status: 400 });
  }
  if (Buffer.byteLength(html, 'utf8') > MAX_SHARE_HTML_BYTES) {
    return NextResponse.json(
      {
        error:
          'This outline is too large to publish as a single page. Try publishing a smaller branch.',
      },
      { status: 413 },
    );
  }

  const plan = userId ? await resolveServerPlan(userId) : 'free';

  // ── Update path: re-publish an existing link the caller owns. ────────────
  if (body.shareId) {
    const existing = await getShare(body.shareId);
    if (!existing || existing.ownerId !== ownerId) {
      return NextResponse.json(
        { error: 'That shared link was not found or is not yours.' },
        { status: 404 },
      );
    }
    const doc = await updateShare({
      ownerId,
      shareId: body.shareId,
      title,
      template,
      html,
    });
    if (!doc) {
      return NextResponse.json({ error: 'Could not update the link.' }, { status: 500 });
    }
    return NextResponse.json({
      shareId: doc.shareId,
      url: buildShareUrl(request, doc.shareId),
      updated: true,
    });
  }

  // ── New link path: enforce the free-tier allowance server-side. ──────────
  if (plan !== 'premium') {
    const activeIds = await listOwnerShareIds(ownerId);
    if (activeIds.length >= FREE_SHARE_LINK_LIMIT) {
      return NextResponse.json(
        {
          error:
            `Free accounts can keep ${FREE_SHARE_LINK_LIMIT} shared links at a time. ` +
            `Unpublish one, or upgrade to Pro for unlimited shared links.`,
          upgradeRequired: true,
          limit: FREE_SHARE_LINK_LIMIT,
        },
        { status: 402 },
      );
    }
  }

  const doc = await createShare({ ownerId, title, template, html });
  return NextResponse.json({
    shareId: doc.shareId,
    url: buildShareUrl(request, doc.shareId),
    created: true,
  });
}
