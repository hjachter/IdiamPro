/**
 * POST /api/feedback/submit
 *
 * Persists a beta-feedback submission, issues the 1-year Pro grant, and
 * notifies Howard.
 *
 * Auth: in production the caller must be a signed-in & approved beta user
 * (the /feedback page itself enforces auth-gating at the UI layer via the
 * BetaApprovedGate; this endpoint also re-checks via Clerk's auth() helper
 * when auth is enabled). In stub mode (no Clerk keys) the userId comes
 * from the request body — same trust contract as the rest of the v1
 * surface, which is acceptable for the pre-launch invite-only beta.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createFeedback,
  type CreateFeedbackArgs,
  type FeedbackFeatureKey,
  type FeedbackFeatureRating,
  type TestimonialAttribution,
  FEEDBACK_FEATURE_KEYS,
} from '@/lib/access/feedback-store';
import { grantBetaProForFeedback } from '@/lib/access/beta-pro-grant';
import { sendFeedbackNotification } from '@/lib/email/send';
import { isAuthEnabled } from '@/lib/auth/auth-config';

export const runtime = 'nodejs';

interface SubmitBody {
  userId?: string;
  name?: string;
  email?: string;
  nps?: number;
  overallStars?: number;
  featureRatings?: Record<string, { stars: number | null; comment?: string }>;
  bestThing?: string;
  biggestWish?: string;
  toolsBeforeIdiampro?: string;
  workType?: string;
  usageFrequency?: string;
  testimonialConsent?: boolean;
  testimonialAttribution?: string;
  testimonialPhotoUploaded?: boolean;
  testimonialVideoUploaded?: boolean;
  frictionNotes?: string;
  followUpOk?: boolean;
}

const ATTRIBUTIONS: TestimonialAttribution[] = [
  'full_name_title',
  'first_name_role',
  'initials_only',
  'anonymous',
];

function getAdminUrl(request: NextRequest, id: string): string {
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const host = request.headers.get('host') ?? '2ndbrainware.com';
  return `${proto}://${host}/admin/feedback?focus=${encodeURIComponent(id)}`;
}

async function resolveAuthenticatedUserId(): Promise<string | null> {
  if (!isAuthEnabled()) return null;
  try {
    /* eslint-disable @typescript-eslint/no-var-requires */
    const clerk = require('@clerk/nextjs/server') as {
      auth?: () => Promise<{ userId?: string | null }> | { userId?: string | null };
    };
    /* eslint-enable @typescript-eslint/no-var-requires */
    if (!clerk.auth) return null;
    const session = await Promise.resolve(clerk.auth());
    return session.userId ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  let body: SubmitBody;
  try {
    body = (await request.json()) as SubmitBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid request body.' },
      { status: 400 },
    );
  }

  const authedId = await resolveAuthenticatedUserId();
  const userId = (authedId ?? body.userId ?? '').trim();
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: 'You need to be signed in to submit feedback.' },
      { status: 401 },
    );
  }

  const nps = Number(body.nps);
  const overallStars = Number(body.overallStars);
  if (!Number.isFinite(nps) || nps < 0 || nps > 10) {
    return NextResponse.json(
      { ok: false, error: 'How likely you are to recommend IDMPro is required (0-10).' },
      { status: 400 },
    );
  }
  if (!Number.isFinite(overallStars) || overallStars < 1 || overallStars > 5) {
    return NextResponse.json(
      { ok: false, error: 'Overall satisfaction (1-5 stars) is required.' },
      { status: 400 },
    );
  }

  const featureRatings: Partial<Record<FeedbackFeatureKey, FeedbackFeatureRating>> = {};
  const rawRatings = body.featureRatings ?? {};
  for (const key of FEEDBACK_FEATURE_KEYS) {
    const r = rawRatings[key];
    if (!r) continue;
    const stars = r.stars === null || r.stars === undefined ? null : Number(r.stars);
    const comment = typeof r.comment === 'string' ? r.comment.trim().slice(0, 240) : undefined;
    if (stars === null) {
      featureRatings[key] = { stars: null, comment };
    } else if (Number.isFinite(stars) && stars >= 1 && stars <= 5) {
      featureRatings[key] = { stars: Math.round(stars), comment };
    }
  }

  const testimonialAttribution =
    body.testimonialConsent === true && typeof body.testimonialAttribution === 'string'
      ? (ATTRIBUTIONS.includes(body.testimonialAttribution as TestimonialAttribution)
          ? (body.testimonialAttribution as TestimonialAttribution)
          : undefined)
      : undefined;

  const args: CreateFeedbackArgs = {
    userId,
    name: (body.name ?? '').trim(),
    email: (body.email ?? '').trim(),
    nps,
    overallStars,
    featureRatings,
    bestThing: body.bestThing,
    biggestWish: body.biggestWish,
    toolsBeforeIdiampro: body.toolsBeforeIdiampro,
    workType: body.workType,
    usageFrequency: body.usageFrequency,
    testimonialConsent: body.testimonialConsent === true,
    testimonialAttribution,
    testimonialPhotoUploaded: body.testimonialPhotoUploaded === true,
    testimonialVideoUploaded: body.testimonialVideoUploaded === true,
    frictionNotes: body.frictionNotes,
    followUpOk: body.followUpOk === true,
  };

  let record;
  try {
    record = await createFeedback(args);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not save feedback.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  // Issue the 1-year Pro reward. The grant helper writes a local mirror and
  // best-effort updates Clerk publicMetadata (skipped when CLERK_SECRET_KEY
  // isn't configured).
  const grant = await grantBetaProForFeedback({
    userId: record.userId,
    testimonialConsent: record.testimonialConsent,
    testimonialAttribution: record.testimonialAttribution,
    foundingUser: record.testimonialVideoUploaded,
  });

  // Notify Howard. Stub-safe — no-op when RESEND_API_KEY is unset.
  const emailOutcome = await sendFeedbackNotification({
    feedback: record,
    adminUrl: getAdminUrl(request, record.id),
  });

  return NextResponse.json({
    ok: true,
    feedback: record,
    grant,
    emailOutcome,
  });
}
