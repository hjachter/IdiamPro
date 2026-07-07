/**
 * Dependency-health cron endpoint.
 *
 * Vercel Cron config: see vercel.json at the repo root. Default: hourly.
 *
 * Runs the full dependency-health sweep and, if any of the app's OWN
 * third-party dependencies come back 'down' or 'degraded', emails Howard a
 * PRIVATE alert naming each one, its state, and the detail. There is no
 * user-facing broadcast anywhere — this is back-office only.
 *
 * ANTI-SPAM. We remember the set of currently-unhealthy dependencies in the
 * storage adapter. Howard is only emailed when that set CHANGES — i.e. a new
 * dependency goes bad — so an ongoing outage doesn't page him every hour.
 * When everything recovers we clear the memory, so a fresh failure later
 * re-alerts.
 *
 * Security: same Bearer-secret pattern as the other crons — Vercel Cron sets
 * `Authorization: Bearer <CRON_SECRET>`. With CRON_SECRET unset the route logs
 * a warning and accepts the request (dev / stub mode).
 *
 * Stub-safe / no dev noise: probes for unconfigured dependencies return
 * 'not_configured' (skipped, never alerted). Only a genuinely bad probe pages
 * Howard, and the storage-backed de-dup means at most one email per new
 * outage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage/adapter';
import { sendDependencyHealthAlert } from '@/lib/email/send';
import {
  checkAllDependencies,
  isBadStatus,
  type DependencyHealth,
} from '@/lib/health/dependency-health';
import type { DependencyHealthAlertItem } from '@/emails/dependency-health-alert';

export const runtime = 'nodejs';

const LAST_BAD_KEY = 'dependency-health:last-bad';

function authorize(request: NextRequest): { ok: boolean; reason?: string } {
  const secret = (process.env.CRON_SECRET ?? '').trim();
  if (secret.length === 0) {
    console.warn(
      '[cron/dependency-health] CRON_SECRET is not configured — accepting request without auth (dev/stub mode).',
    );
    return { ok: true };
  }
  const got = request.headers.get('authorization') ?? '';
  if (got === `Bearer ${secret}`) return { ok: true };
  return { ok: false, reason: 'invalid cron secret' };
}

function adminHealthUrl(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim().replace(/\/$/, '');
  return base.length > 0 ? `${base}/admin/health` : '#';
}

async function handle(request: NextRequest) {
  const auth = authorize(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason ?? 'unauthorized' }, { status: 401 });
  }

  const results = await checkAllDependencies();
  const bad = results.filter((r) => isBadStatus(r.status));
  const currentBadNames = bad.map((r) => r.name).sort();

  // Load the set we last alerted on so we only page Howard on a CHANGE.
  const storage = getStorage();
  let previousBadNames: string[] = [];
  try {
    previousBadNames = (await storage.get<string[]>(LAST_BAD_KEY)) ?? [];
  } catch {
    previousBadNames = [];
  }

  const changed =
    currentBadNames.length !== previousBadNames.length ||
    currentBadNames.some((name, i) => name !== previousBadNames[i]);

  let alerted = false;
  if (bad.length > 0 && changed) {
    try {
      await sendDependencyHealthAlert({
        detectedAt: new Date().toISOString(),
        problems: bad.map(toAlertItem),
        adminUrl: adminHealthUrl(),
      });
      alerted = true;
    } catch {
      // Best-effort alert — nothing more we can do here.
    }
  }

  // Persist the new bad-set (or clear it when everything is healthy again).
  try {
    if (currentBadNames.length > 0) {
      await storage.set(LAST_BAD_KEY, currentBadNames);
    } else {
      await storage.delete(LAST_BAD_KEY);
    }
  } catch {
    // Non-fatal: if we can't persist, worst case is a duplicate alert later.
  }

  return NextResponse.json({
    ok: true,
    checked: results.length,
    bad: currentBadNames,
    alerted,
  });
}

function toAlertItem(r: DependencyHealth): DependencyHealthAlertItem {
  return {
    name: r.name,
    category: r.category,
    // isBadStatus guarantees this is 'down' or 'degraded'.
    status: r.status === 'down' ? 'down' : 'degraded',
    latencyMs: r.latencyMs,
    detail: r.detail,
  };
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
