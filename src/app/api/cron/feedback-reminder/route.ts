/**
 * Feedback-reminder cron endpoint.
 *
 * Vercel Cron config: see vercel.json at the repo root.
 *
 * Default schedule: once daily at 20:00 UTC (noon Pacific). Adjust later if
 * data suggests a better hour.
 *
 * Behavior: walk every approved applicant. For each one where:
 *   - approved_at was 14 days ago (>= 14 days, < 90 days — we don't keep
 *     chasing forever), AND
 *   - they have not submitted feedback yet, AND
 *   - feedbackReminderSentAt is unset
 * send the "mind sharing five minutes?" email from Howard and stamp
 * feedbackReminderSentAt so we never double-send.
 *
 * Security: same Bearer-secret pattern as /api/cron/drip — Vercel Cron sets
 * `Authorization: Bearer <CRON_SECRET>`. When CRON_SECRET is unset the
 * route logs a warning and accepts the request (dev / stub mode).
 *
 * Stub-safe end-to-end:
 *   - When RESEND_API_KEY is unset, sendFeedbackReminderEmail returns
 *     'skipped-no-key' for every recipient and the cron logs the same
 *     result it would have logged with real keys in place.
 *   - When the applicant store is empty, the cron processes zero records
 *     and returns ok:true with sent: [].
 *
 * Test mode: posting a JSON body of shape
 *   { users: [{ id, email, firstName?, applicantId }] }
 * directly sends the reminder to the listed users. The Playwright probe
 * uses this to verify wiring without seeding 14-day-old applicants.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  listApplicants,
  markFeedbackReminderSent,
} from '@/lib/access/applicant-store';
import { getFeedbackUserIds } from '@/lib/access/feedback-store';
import { sendFeedbackReminderEmail } from '@/lib/email/send';

export const runtime = 'nodejs';

const REMINDER_AGE_DAYS_MIN = 14;
const REMINDER_AGE_DAYS_MAX = 90;

interface TestUser {
  id: string;
  email: string;
  firstName?: string | null;
  applicantId?: string;
}
interface RequestBody {
  users?: TestUser[];
}

function authorize(request: NextRequest): { ok: boolean; reason?: string } {
  const secret = (process.env.CRON_SECRET ?? '').trim();
  if (secret.length === 0) {
    console.warn(
      '[cron/feedback-reminder] CRON_SECRET is not configured — accepting request without auth (dev/stub mode).',
    );
    return { ok: true };
  }
  const got = request.headers.get('authorization') ?? '';
  if (got === `Bearer ${secret}`) return { ok: true };
  return { ok: false, reason: 'invalid cron secret' };
}

function ageInDays(iso: string, now: Date): number {
  const ms = now.getTime() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function getFeedbackUrl(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const host = request.headers.get('host') ?? '2ndbrainware.com';
  return `${proto}://${host}/feedback`;
}

async function runProduction(request: NextRequest) {
  const applicants = await listApplicants();
  const submitted = await getFeedbackUserIds();
  const now = new Date();
  const sent: Array<{ applicantId: string; outcome: unknown }> = [];
  const feedbackUrl = getFeedbackUrl(request);

  for (const a of applicants) {
    if (a.status !== 'approved') continue;
    if (!a.approvedDate) continue;
    if (a.feedbackReminderSentAt) continue;
    // The applicant's stable id doubles as their unsubscribe userId until
    // they hit /signin and get a real Clerk id — so submitted-by-id check
    // here uses applicant.id. (Once Clerk is fully wired, this becomes the
    // Clerk userId and the matching is direct.)
    if (submitted.has(a.id)) continue;

    const age = ageInDays(a.approvedDate, now);
    if (age < REMINDER_AGE_DAYS_MIN || age > REMINDER_AGE_DAYS_MAX) continue;

    const firstName = a.name.split(' ')[0] ?? null;
    const outcome = await sendFeedbackReminderEmail({
      to: a.email,
      firstName,
      userId: a.id,
      feedbackUrl,
    });
    await markFeedbackReminderSent(a.id);
    sent.push({ applicantId: a.id, outcome });
  }

  return { mode: 'production', considered: applicants.length, sent };
}

async function runTest(users: TestUser[], request: NextRequest) {
  const feedbackUrl = getFeedbackUrl(request);
  const sent: Array<{ userId: string; outcome: unknown }> = [];
  for (const u of users) {
    const outcome = await sendFeedbackReminderEmail({
      to: u.email,
      firstName: u.firstName,
      userId: u.id,
      feedbackUrl,
    });
    if (u.applicantId) await markFeedbackReminderSent(u.applicantId);
    sent.push({ userId: u.id, outcome });
  }
  return { mode: 'test', considered: users.length, sent };
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
    ? await runTest(body.users, request)
    : await runProduction(request);

  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
