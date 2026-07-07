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
 * Auth note: this mirrors the other v1 admin surfaces — the page itself is
 * gated by the client `isAdmin` localStorage flag (real Clerk admin roles are
 * planned post-launch). To keep the board from being publicly scrapable it is
 * also marked no-store / non-indexable. It exposes no user data and spends no
 * money, so this is an acceptable v1 posture.
 */

import { NextResponse } from 'next/server';
import { checkAllDependencies } from '@/lib/health/dependency-health';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
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
