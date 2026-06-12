/**
 * Beta Pro grant — server-side helpers for the "1 year of Pro for submitting
 * feedback" reward.
 *
 * The grant is materialized two ways:
 *
 *  1. Clerk publicMetadata (when CLERK_SECRET_KEY is set in prod):
 *     - pro_until: ISO 8601 expiry, exactly 1 year from submission
 *     - pro_via:   'beta_feedback' — tags the source for analytics
 *     - testimonial_consent:    boolean — user opted into a public quote
 *     - testimonial_attribution: TestimonialAttribution string
 *     - founding_user:          boolean — true when a video testimonial was
 *                                uploaded (drives the in-app badge)
 *
 *  2. Local mirror via the storage adapter (KV in prod, JSON file in dev).
 *     The tier resolution layer (src/lib/entitlements) currently no-ops with
 *     enforcement off — so this mirror is forward-compatible scaffolding
 *     rather than a live restriction. One record per user id at
 *     `pro-grant:<userId>`.
 *
 * Stub-safe in every case. With CLERK_SECRET_KEY unset, the Clerk-update path
 * skips quietly (no error) and only the local mirror is written.
 */

import { getStorage } from '../storage/adapter';
import type { TestimonialAttribution } from './feedback-store';

/** One calendar year in ms. We use 365 days deliberately; the small leap-day
 * drift over a year doesn't matter for entitlement boundaries. */
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export interface BetaProGrant {
  /** Clerk user id (or applicant id in stub mode). */
  userId: string;
  /** ISO 8601 expiry — exactly 1 year from creation. */
  proUntil: string;
  /** Source label for analytics. */
  proVia: 'beta_feedback';
  /** Optional testimonial bookkeeping (only set when user opted in). */
  testimonialConsent?: boolean;
  testimonialAttribution?: TestimonialAttribution;
  /** True when the user uploaded a video testimonial — drives the
   * Founding User badge in the app. */
  foundingUser?: boolean;
  /** When the grant was issued, ISO. */
  grantedAt: string;
}

const KEY_GRANT = (userId: string) => `pro-grant:${userId}`;

export interface GrantBetaProArgs {
  userId: string;
  testimonialConsent?: boolean;
  testimonialAttribution?: TestimonialAttribution;
  foundingUser?: boolean;
}

/**
 * Issue the "1 year of Pro" reward for a beta-feedback submission.
 *
 * Always writes the local mirror via the storage adapter. Attempts the Clerk
 * publicMetadata update too — if Clerk isn't configured (no secret key),
 * that step quietly no-ops.
 */
export async function grantBetaProForFeedback(
  args: GrantBetaProArgs,
): Promise<BetaProGrant> {
  if (!args.userId) throw new Error('userId is required');

  const now = new Date();
  const grant: BetaProGrant = {
    userId: args.userId,
    proUntil: new Date(now.getTime() + ONE_YEAR_MS).toISOString(),
    proVia: 'beta_feedback',
    testimonialConsent: args.testimonialConsent === true,
    testimonialAttribution: args.testimonialConsent
      ? args.testimonialAttribution
      : undefined,
    foundingUser: args.foundingUser === true,
    grantedAt: now.toISOString(),
  };

  // Write local mirror (always safe, never blocks on external services).
  await getStorage().set(KEY_GRANT(args.userId), grant);

  // Best-effort Clerk publicMetadata update.
  await tryUpdateClerkMetadata(grant);

  return grant;
}

/** Read the grant for a user, or null. */
export async function getBetaProGrant(
  userId: string,
): Promise<BetaProGrant | null> {
  if (!userId) return null;
  return getStorage().get<BetaProGrant>(KEY_GRANT(userId));
}

/**
 * Best-effort Clerk publicMetadata write. Stub-safe: when CLERK_SECRET_KEY
 * is unset (dev / stub mode), logs and returns without touching network.
 *
 * We use `require` rather than a top-level import so the Clerk SDK is not
 * pulled into the bundle when auth is disabled — same lazy-import pattern as
 * src/lib/auth/use-current-user.tsx.
 */
async function tryUpdateClerkMetadata(grant: BetaProGrant): Promise<void> {
  const secret = (process.env.CLERK_SECRET_KEY ?? '').trim();
  if (secret.length === 0) {
    // eslint-disable-next-line no-console
    console.info(
      '[beta-pro-grant] CLERK_SECRET_KEY unset — local mirror written, Clerk skipped.',
    );
    return;
  }
  try {
    /* eslint-disable @typescript-eslint/no-var-requires */
    const clerkMod = require('@clerk/clerk-sdk-node') as {
      createClerkClient?: (opts: { secretKey: string }) => {
        users: {
          updateUserMetadata: (
            id: string,
            data: { publicMetadata: Record<string, unknown> },
          ) => Promise<unknown>;
        };
      };
    };
    /* eslint-enable @typescript-eslint/no-var-requires */
    if (!clerkMod.createClerkClient) {
      console.info(
        '[beta-pro-grant] @clerk/clerk-sdk-node not installed — Clerk metadata skipped.',
      );
      return;
    }
    const clerk = clerkMod.createClerkClient({ secretKey: secret });
    await clerk.users.updateUserMetadata(grant.userId, {
      publicMetadata: {
        pro_until: grant.proUntil,
        pro_via: grant.proVia,
        testimonial_consent: grant.testimonialConsent ?? false,
        testimonial_attribution: grant.testimonialAttribution ?? null,
        founding_user: grant.foundingUser ?? false,
      },
    });
  } catch (err) {
    // Never block submission on a Clerk failure — the local mirror still has
    // the grant and the next admin sync can reconcile.
    // eslint-disable-next-line no-console
    console.warn('[beta-pro-grant] Clerk metadata update failed:', err);
  }
}
