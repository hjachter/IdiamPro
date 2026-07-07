/**
 * Storage-health cron endpoint.
 *
 * Vercel Cron config: see vercel.json at the repo root.
 *
 * Default schedule: every 6 hours. Does a real write+read+delete round-trip
 * against the storage adapter. If the round-trip fails — or the backend is
 * the no-op 'stub' (KV not provisioned, filesystem not writable) — it emails
 * Howard a "storage unreachable" alert so a silent outage can't sit for days.
 *
 * Security: same Bearer-secret pattern as the other crons — Vercel Cron sets
 * `Authorization: Bearer <CRON_SECRET>`. When CRON_SECRET is unset the route
 * logs a warning and accepts the request (dev / stub mode).
 *
 * Stub-safe / no dev noise: in dev the backend is 'file', the round-trip
 * succeeds → healthy → NO alert. Only a genuinely broken store pages Howard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage/adapter';
import { sendStorageAlert } from '@/lib/email/send';

export const runtime = 'nodejs';

function authorize(request: NextRequest): { ok: boolean; reason?: string } {
  const secret = (process.env.CRON_SECRET ?? '').trim();
  if (secret.length === 0) {
    console.warn(
      '[cron/storage-health] CRON_SECRET is not configured — accepting request without auth (dev/stub mode).',
    );
    return { ok: true };
  }
  const got = request.headers.get('authorization') ?? '';
  if (got === `Bearer ${secret}`) return { ok: true };
  return { ok: false, reason: 'invalid cron secret' };
}

async function handle(request: NextRequest) {
  const auth = authorize(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason ?? 'unauthorized' }, { status: 401 });
  }

  const storage = getStorage();
  const backend = storage.backend;
  const probeKey = 'storage-health:probe';
  const token = `ping-${Date.now()}`;
  let healthy = false;

  try {
    await storage.set(probeKey, token);
    const got = await storage.get<string>(probeKey);
    await storage.delete(probeKey);
    healthy = got === token;
  } catch {
    healthy = false;
  }

  // The stub backend round-trips as null anyway, but be explicit: a no-op
  // store is never healthy.
  if (backend === 'stub') healthy = false;

  if (!healthy) {
    try {
      await sendStorageAlert({
        kind: 'health-check',
        detectedAt: new Date().toISOString(),
        backend,
      });
    } catch {
      // Best-effort alert — nothing more we can do here.
    }
  }

  return NextResponse.json({ ok: true, healthy, backend });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
