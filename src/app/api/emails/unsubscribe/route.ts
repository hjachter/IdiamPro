/**
 * Unsubscribe endpoint.
 *
 * Called by the unsubscribe page once the user confirms (or, for the GET
 * variant, by single-click unsubscribe links / one-click email-client UI
 * if we choose to add `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
 * later). Both verbs accept the same `u` (userId) + `t` (token) query
 * params and short-circuit to the same store call.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token';
import { markUnsubscribed } from '@/lib/email/unsubscribe-store';

export const runtime = 'nodejs';

async function handle(userId: string, token: string) {
  if (!userId || !token) {
    return NextResponse.json({ error: 'missing parameters' }, { status: 400 });
  }
  if (!verifyUnsubscribeToken(userId, token)) {
    return NextResponse.json({ error: 'invalid token' }, { status: 401 });
  }
  await markUnsubscribed(userId);
  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  const u = request.nextUrl.searchParams.get('u') ?? '';
  const t = request.nextUrl.searchParams.get('t') ?? '';
  return handle(u, t);
}

export async function POST(request: NextRequest) {
  // Accept either query params or a JSON body { u, t }.
  let u = request.nextUrl.searchParams.get('u') ?? '';
  let t = request.nextUrl.searchParams.get('t') ?? '';
  if (!u || !t) {
    try {
      const body = (await request.json()) as { u?: string; t?: string };
      u = u || (body.u ?? '');
      t = t || (body.t ?? '');
    } catch {
      // body wasn't JSON; leave params as-is
    }
  }
  return handle(u, t);
}
