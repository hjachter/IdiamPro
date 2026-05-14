/**
 * Lightweight per-IP rate limiter for Next.js API routes.
 *
 * Strategy: in-memory sliding window with a small Map<key, timestamps[]>.
 * - Pros: zero external dependencies, works on first deploy, no setup cost.
 * - Cons: state is per-process. On serverless (Vercel), each lambda instance
 *   has its own counter, so the effective limit can be N x configured.
 *   This is "best-effort" — fine for launch, since subscription billing
 *   isn't built yet and we just want abuse mitigation.
 *
 * TODO (post-launch): swap the backing store for @upstash/ratelimit +
 * @upstash/redis for accurate global counts across serverless instances.
 * Provision an Upstash Redis DB, set UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN in Vercel env, and replace the implementation
 * below. The `rateLimit()` signature can stay the same.
 */
import { NextRequest, NextResponse } from 'next/server';

interface Bucket {
  hits: number[]; // unix-ms timestamps within the current window
}

const buckets = new Map<string, Bucket>();

// Periodic cleanup so the map can't grow unbounded under abuse.
// Runs once per minute, removes any IPs with no hits in the last 5 minutes.
const CLEANUP_INTERVAL_MS = 60_000;
const STALE_AFTER_MS = 5 * 60_000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanupRunning() {
  if (cleanupTimer) return;
  // Avoid keeping the event loop alive in serverless cold starts.
  cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - STALE_AFTER_MS;
    for (const [key, bucket] of buckets) {
      const last = bucket.hits[bucket.hits.length - 1] ?? 0;
      if (last < cutoff) buckets.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);
  // unref() so the timer doesn't prevent process exit in tests/CLI usage.
  if (typeof (cleanupTimer as { unref?: () => void }).unref === 'function') {
    (cleanupTimer as { unref: () => void }).unref();
  }
}

export interface RateLimitOptions {
  /** Window length in milliseconds. Default 60_000 (1 minute). */
  windowMs?: number;
  /** Max requests allowed per IP per window. */
  limit: number;
  /** Optional namespace to keep counters separate per route group. */
  namespace?: string;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number; // unix-ms when the oldest hit ages out
  limit: number;
}

/**
 * Best-effort client IP extraction.
 * Falls back to a fixed key so unauthenticated localhost still gets rate-limited
 * (otherwise everyone behind a missing header would share infinite budget).
 */
export function getClientIp(request: NextRequest): string {
  // Standard proxy headers. Take the first IP in x-forwarded-for.
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  // NextRequest no longer exposes `ip` in all runtimes; fall back to a marker.
  return 'unknown';
}

export function rateLimit(
  request: NextRequest,
  opts: RateLimitOptions,
): RateLimitResult {
  ensureCleanupRunning();

  const windowMs = opts.windowMs ?? 60_000;
  const now = Date.now();
  const cutoff = now - windowMs;
  const ip = getClientIp(request);
  const key = opts.namespace ? `${opts.namespace}:${ip}` : ip;

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }

  // Drop hits outside the current window.
  // Hits are appended in order so we can slice from the first in-window index.
  let firstInWindow = 0;
  while (firstInWindow < bucket.hits.length && bucket.hits[firstInWindow] < cutoff) {
    firstInWindow++;
  }
  if (firstInWindow > 0) {
    bucket.hits = bucket.hits.slice(firstInWindow);
  }

  if (bucket.hits.length >= opts.limit) {
    const oldest = bucket.hits[0] ?? now;
    return {
      ok: false,
      remaining: 0,
      resetAt: oldest + windowMs,
      limit: opts.limit,
    };
  }

  bucket.hits.push(now);
  return {
    ok: true,
    remaining: opts.limit - bucket.hits.length,
    resetAt: (bucket.hits[0] ?? now) + windowMs,
    limit: opts.limit,
  };
}

/**
 * Convenience wrapper: returns a 429 NextResponse if the request is over the
 * limit, otherwise returns null so the caller can proceed.
 *
 * Usage:
 *   const limited = enforceRateLimit(request, { limit: 30 });
 *   if (limited) return limited;
 */
export function enforceRateLimit(
  request: NextRequest,
  opts: RateLimitOptions,
): NextResponse | null {
  const result = rateLimit(request, opts);
  if (result.ok) return null;

  const retryAfterSec = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  return NextResponse.json(
    {
      error: 'Too many requests. Please slow down and try again shortly.',
      retryAfterSeconds: retryAfterSec,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSec),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000)),
      },
    },
  );
}
