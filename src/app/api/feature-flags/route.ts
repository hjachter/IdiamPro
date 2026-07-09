/**
 * Public "what's on" feature-flags read endpoint.
 *
 * The client provider (feature-flags-provider.tsx) fetches this once on
 * startup to learn the effective flag state. It is NOT admin-gated — it only
 * exposes which features are on (no secrets, no override internals beyond the
 * public flag shape), so any client may read it.
 *
 * FAIL-SAFE: getEffectiveFlags() never throws (it degrades to DEFAULT_FLAGS on
 * any store error), and the provider itself also falls back to DEFAULT_FLAGS if
 * this fetch fails — so the app is never blocked by the flag system.
 *
 * Cached briefly at the edge so a launch-time burst of clients doesn't hammer
 * the store; overrides propagate within the short TTL.
 */

import { NextResponse } from 'next/server';
import { getEffectiveFlags } from '@/lib/flags/flag-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const flags = await getEffectiveFlags();
  return NextResponse.json(
    { flags },
    {
      // Short TTL: fresh enough that a kill-switch takes effect quickly, cheap
      // enough to absorb a crowd. s-maxage applies at the CDN; the client
      // fetches once per session anyway.
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    },
  );
}
