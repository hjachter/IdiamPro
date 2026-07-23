/**
 * Shared SERVER-SIDE gate for the paid-per-use premium features — the single
 * source of truth for "may this end-user make this paid call, and on whose
 * key?" Called by BOTH named API routes (podcast TTS) AND server actions
 * (transcription, image generation).
 *
 * ── The model (owner-approved 2026-07-11) ──────────────────────────────────
 *  • BYOK request (user supplied their own key) → ALWAYS allowed, counter is
 *    bypassed entirely. The call runs on the user's own key & bill.
 *  • Otherwise the call would need COMPANY funding. There is NO company
 *    billing account today, so:
 *      – company key absent  → BLOCK (tell them to add their own key / upgrade).
 *                              Guarantees no personal/founder key is ever hit.
 *      – company key present → a per-account LIFETIME free "taste":
 *          · premium (paid) account → unlimited.
 *          · free account → first FREE_LIFETIME_LIMIT calls of THIS feature,
 *            counted SERVER-SIDE (Upstash/KV), un-resettable from the client.
 *            After the cap → BLOCK with an upgrade response.
 *
 * The founder's PERSONAL env keys (OPENAI_API_KEY etc.) are never referenced
 * by any paid-feature path — see company-keys.ts. Dev/testing can point a
 * COMPANY_* var at a personal key locally, but end-user code never does.
 *
 * Plan lookup is wired to the EXISTING RevenueCat entitlement resolver, keyed
 * by the authenticated Clerk sign-in id, with a short in-memory cache.
 */

import type { PaidFeature } from '@/lib/billing/company-keys';
import { isCompanyFundedTasteEnabled } from '@/lib/billing/company-keys';
import { isAuthEnabled } from '@/lib/auth/auth-config';
import { resolveTierFromRevenueCat } from '@/lib/billing/revenuecat-client';
import { getStorage } from '@/lib/storage/adapter';
import {
  getServerUserIdentity,
  isInternalDevIdentity,
} from '@/lib/billing/ai-usage-meter';

export type { PaidFeature };

/** Lifetime free-sample cap per (account, feature). Only ever consumed when a
 *  COMPANY key funds the sample; never on the founder's personal key. */
export const FREE_LIFETIME_LIMIT = 10;

export type ServerPlan = 'free' | 'premium';

/** A friendly, action-oriented reason shown to the user when blocked. */
export interface GateBlocked {
  ok: false;
  /** HTTP-ish status hint for routes (402 = payment/upgrade, 401 = sign-in). */
  status: 401 | 402;
  /** Plain-English, non-CLI message. */
  error: string;
  /** True when adding a key or upgrading unblocks the feature. */
  upgradeRequired: boolean;
}

export interface GateAllowed {
  ok: true;
  /** How the paid call should be funded. */
  fund: 'byok' | 'company';
  plan: ServerPlan | 'unknown';
  /** Lifetime uses consumed after this call (company free-taste only). */
  used?: number;
  limit?: number;
}

export type GateDecision = GateAllowed | GateBlocked;

/* ───────────────────────────── plan lookup ────────────────────────────── */

interface PlanCacheEntry {
  plan: ServerPlan;
  at: number;
}
const PLAN_CACHE_TTL_MS = 60_000; // 1 minute — cheap, bounds RevenueCat calls
const planCache = new Map<string, PlanCacheEntry>();

/**
 * Resolve the authenticated Clerk user id on the server, or null. Uses the
 * same lazy-require pattern as the account-deletion route so the Clerk
 * runtime is never pulled into stub builds.
 */
export async function getServerUserId(): Promise<string | null> {
  if (!isAuthEnabled()) return null;
  try {
    /* eslint-disable @typescript-eslint/no-var-requires */
    const clerkServer = require('@clerk/nextjs/server') as {
      auth?: () =>
        | Promise<{ userId?: string | null }>
        | { userId?: string | null };
    };
    /* eslint-enable @typescript-eslint/no-var-requires */
    if (!clerkServer.auth) return null;
    const session = await Promise.resolve(clerkServer.auth());
    return session.userId ?? null;
  } catch {
    return null;
  }
}

/**
 * Look up a user's plan (free/premium) by their sign-in id via the existing
 * RevenueCat resolver. Any paid tier (pro/premium) maps to 'premium'; a short
 * cache bounds the number of provider calls. Degrades to 'free' on any error.
 */
export async function resolveServerPlan(userId: string): Promise<ServerPlan> {
  const cached = planCache.get(userId);
  if (cached && Date.now() - cached.at < PLAN_CACHE_TTL_MS) {
    return cached.plan;
  }
  let plan: ServerPlan = 'free';
  try {
    const tier = await resolveTierFromRevenueCat(userId);
    plan = tier === 'free' ? 'free' : 'premium';
  } catch {
    plan = 'free';
  }
  planCache.set(userId, { plan, at: Date.now() });
  return plan;
}

/* ─────────────────────── lifetime usage counter ───────────────────────── */

function usageKey(userId: string, feature: PaidFeature): string {
  return `paid-quota:${userId}:${feature}`;
}

/** Current lifetime uses of `feature` for this account. */
export async function getLifetimeUsage(
  userId: string,
  feature: PaidFeature,
): Promise<number> {
  try {
    const v = await getStorage().get<number>(usageKey(userId, feature));
    return typeof v === 'number' && v >= 0 ? v : 0;
  } catch {
    return 0;
  }
}

/** Atomically add one use and return the new lifetime total. */
async function bumpLifetimeUsage(
  userId: string,
  feature: PaidFeature,
): Promise<number> {
  return getStorage().increment(usageKey(userId, feature));
}

/* ────────────────────────────── the gate ──────────────────────────────── */

function upgradeBlock(feature: PaidFeature): GateBlocked {
  const label =
    feature === 'premiumVoice'
      ? 'the premium AI voice'
      : feature === 'transcription'
        ? 'audio transcription'
        : 'AI image generation';
  return {
    ok: false,
    status: 402,
    upgradeRequired: true,
    error:
      `You've used your free samples of ${label}. To keep using it, add your ` +
      `own API key in Settings → AI Service Keys, or upgrade your plan.`,
  };
}

function needsKeyBlock(feature: PaidFeature): GateBlocked {
  const label =
    feature === 'premiumVoice'
      ? 'The premium AI voice'
      : feature === 'transcription'
        ? 'Audio transcription'
        : 'AI image generation';
  return {
    ok: false,
    status: 402,
    upgradeRequired: true,
    error:
      `${label} runs on your own API key for now. Add one in ` +
      `Settings → AI Service Keys to use this feature.`,
  };
}

/**
 * PURE branching logic for the gate — no I/O, fully unit-testable. Given the
 * already-resolved facts about a request, decide the outcome. The caller
 * performs the actual counter increment when the result is 'allow-count'.
 *
 * This is the single source of the enforcement rules; enforcePaidFeature just
 * feeds it real (Clerk/RevenueCat/storage) inputs.
 */
export type PaidAccessOutcome =
  | { kind: 'allow-byok' }
  | { kind: 'allow-unlimited' } // premium account on company key
  | { kind: 'allow-count' } // free account, under cap → caller increments
  | { kind: 'need-key' } // no company funding → user must BYOK / upgrade
  | { kind: 'need-signin' } // company funding on, but no identity to count
  | { kind: 'over-cap' }; // free lifetime taste exhausted

export function decidePaidAccess(inputs: {
  isByok: boolean;
  companyEnabled: boolean;
  userId: string | null;
  plan: ServerPlan | null;
  usedBefore: number;
}): PaidAccessOutcome {
  if (inputs.isByok) return { kind: 'allow-byok' };
  if (!inputs.companyEnabled) return { kind: 'need-key' };
  if (!inputs.userId) return { kind: 'need-signin' };
  if (inputs.plan === 'premium') return { kind: 'allow-unlimited' };
  if (inputs.usedBefore >= FREE_LIFETIME_LIMIT) return { kind: 'over-cap' };
  return { kind: 'allow-count' };
}

/**
 * Decide whether a paid-per-use call may proceed and on whose key.
 *
 * @param feature which paid feature is being invoked.
 * @param opts.isByok true when the caller supplied the user's OWN key. A BYOK
 *   call always proceeds on the user's key and is never counted.
 */
export async function enforcePaidFeature(
  feature: PaidFeature,
  opts: { isByok: boolean },
): Promise<GateDecision> {
  const companyEnabled = isCompanyFundedTasteEnabled(feature);

  // Only resolve identity/plan/usage when they can actually matter (company
  // funding on and not a BYOK call) — avoids needless Clerk/RevenueCat calls.
  let userId: string | null = null;
  let plan: ServerPlan | null = null;
  let usedBefore = 0;
  if (!opts.isByok && companyEnabled) {
    const identity = await getServerUserIdentity();
    userId = identity.userId;
    // Internal developer allowlist — "only us as we develop": unlimited,
    // uncounted. Same allowlist that guards the cloud-text meter, so all
    // company-funded vendor paths share one gate. Only reachable when a
    // company key is actually configured (companyEnabled), so this can never
    // loosen anything while the company keys are absent (today's state).
    if (isInternalDevIdentity(userId, identity.emails)) {
      return { ok: true, fund: 'company', plan: 'premium' };
    }
    if (userId) {
      plan = await resolveServerPlan(userId);
      if (plan !== 'premium') {
        usedBefore = await getLifetimeUsage(userId, feature);
      }
    }
  }

  const outcome = decidePaidAccess({
    isByok: opts.isByok,
    companyEnabled,
    userId,
    plan,
    usedBefore,
  });

  switch (outcome.kind) {
    case 'allow-byok':
      return { ok: true, fund: 'byok', plan: 'unknown' };
    case 'allow-unlimited':
      return { ok: true, fund: 'company', plan: 'premium' };
    case 'need-key':
      return needsKeyBlock(feature);
    case 'need-signin':
      return {
        ok: false,
        status: 401,
        upgradeRequired: false,
        error: 'Please sign in to use this feature.',
      };
    case 'over-cap':
      return upgradeBlock(feature);
    case 'allow-count': {
      // Consume one lifetime use. If the store can't count durably (stub
      // backend → MAX_SAFE_INTEGER) or a race pushed us over, fail CLOSED.
      const newUsed = await bumpLifetimeUsage(userId as string, feature);
      if (newUsed > FREE_LIFETIME_LIMIT) return upgradeBlock(feature);
      return {
        ok: true,
        fund: 'company',
        plan: 'free',
        used: newUsed,
        limit: FREE_LIFETIME_LIMIT,
      };
    }
  }
}
