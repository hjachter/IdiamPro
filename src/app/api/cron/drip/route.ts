/**
 * Drip-email cron endpoint.
 *
 * Vercel Cron config (add to vercel.json post-launch):
 *
 *   {
 *     "crons": [
 *       { "path": "/api/cron/drip", "schedule": "0 14 * * *" }
 *     ]
 *   }
 *
 * Schedule: once daily at 14:00 UTC (a sensible "morning in the Americas
 * / late afternoon in Europe" window). Adjust if data later suggests a
 * better hour. Vercel Cron uses UTC.
 *
 * Security: Vercel Cron requests carry an `Authorization: Bearer <secret>`
 * header where `<secret>` is the value of the CRON_SECRET env var (set in
 * Vercel project settings). With CRON_SECRET unset (today) the route logs
 * a warning and accepts the request; once configured the header is
 * enforced. Same env-gating pattern as the Clerk webhook secret.
 *
 * Input: the route can be called in two modes:
 *
 *   1. PRODUCTION: no body; the route walks the user list, computes each
 *      user's age, and fires the matching drip if today is day 3, 7, or
 *      14 since signup. Today's user list is empty — Clerk integration
 *      hasn't lit up yet — so production mode is a documented stub that
 *      will start firing automatically when a Clerk-backed user iterator
 *      is wired up at `getActiveUsersForDripCron()`.
 *
 *   2. TEST: a POST body of shape
 *      { users: [{ id, email, firstName?, day: 3|7|14 }] }
 *      directly sends the requested drips. This is what the Playwright
 *      test uses to exercise the route without standing up a database.
 *
 * Why the test mode lives in production code: keeping a separate "test
 * endpoint" file would let real code drift away from what tests verify.
 * The test path is gated by the same secret as the production path and
 * costs nothing to leave in.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendDripEmail, type DripDay } from '@/lib/email/send';

export const runtime = 'nodejs';

interface TestUser {
  id: string;
  email: string;
  firstName?: string | null;
  day: DripDay;
}

interface RequestBody {
  users?: TestUser[];
}

interface ActiveUser {
  id: string;
  email: string;
  firstName?: string | null;
  createdAt: Date;
}

/**
 * Stub for the production user iterator. Wire this up to the Clerk Backend
 * SDK or whatever the launch user store is. Returns the users we should
 * consider for drip sends in a given run.
 */
async function getActiveUsersForDripCron(): Promise<ActiveUser[]> {
  // TODO(post-launch): page through Clerk's user list (or the database
  // mirror of it) and return everyone whose age in days is 3, 7, or 14.
  return [];
}

function ageInDays(createdAt: Date, now: Date): number {
  const ms = now.getTime() - createdAt.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function pickDripDay(ageDays: number): DripDay | null {
  if (ageDays === 3) return 3;
  if (ageDays === 7) return 7;
  if (ageDays === 14) return 14;
  return null;
}

function authorize(request: NextRequest): { ok: boolean; reason?: string } {
  const secret = (process.env.CRON_SECRET ?? '').trim();
  if (secret.length === 0) {
    console.warn(
      '[cron/drip] CRON_SECRET is not configured — accepting request without auth (dev/stub mode).',
    );
    return { ok: true };
  }
  const got = request.headers.get('authorization') ?? '';
  if (got === `Bearer ${secret}`) return { ok: true };
  return { ok: false, reason: 'invalid cron secret' };
}

async function runProduction() {
  const users = await getActiveUsersForDripCron();
  const now = new Date();
  const results: Array<{ userId: string; day: DripDay; outcome: unknown }> = [];
  for (const u of users) {
    const day = pickDripDay(ageInDays(u.createdAt, now));
    if (day === null) continue;
    const outcome = await sendDripEmail({ to: u.email, firstName: u.firstName, userId: u.id, day });
    results.push({ userId: u.id, day, outcome });
  }
  return { mode: 'production', considered: users.length, sent: results };
}

async function runTest(users: TestUser[]) {
  const results: Array<{ userId: string; day: DripDay; outcome: unknown }> = [];
  for (const u of users) {
    const outcome = await sendDripEmail({
      to: u.email,
      firstName: u.firstName,
      userId: u.id,
      day: u.day,
    });
    results.push({ userId: u.id, day: u.day, outcome });
  }
  return { mode: 'test', considered: users.length, sent: results };
}

async function handle(request: NextRequest) {
  const auth = authorize(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason ?? 'unauthorized' }, { status: 401 });
  }

  let body: RequestBody = {};
  if (request.method === 'POST') {
    try {
      body = (await request.json()) as RequestBody;
    } catch {
      body = {};
    }
  }

  const result = body.users && body.users.length > 0
    ? await runTest(body.users)
    : await runProduction();

  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
