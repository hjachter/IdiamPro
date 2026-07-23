/**
 * SERVER-SIDE AI USAGE METER for CLOUD TEXT AI — the real, per-account,
 * atomic, monthly-resetting cap that supersedes the SAFETY STOPGAP flag.
 * SERVER-ONLY.
 *
 * ── The rule (owner policy, 2026-07-23) ────────────────────────────────────
 * A company-funded cloud TEXT-AI generation (the Genkit `ai.generate` singleton,
 * which always uses the app's OWN env Gemini key) is permitted ONLY IF:
 *
 *   (a) the request comes from an INTERNAL DEVELOPER on the allowlist — our own
 *       accounts, "only us as we develop" — allowed, unlimited, NOT counted; OR
 *   (b) the request comes from a VERIFIED PAID tier AND is within that tier's
 *       remaining monthly allowance — allowed, and the call is COUNTED against
 *       the allowance via an ATOMIC server-side counter in Upstash/KV.
 *
 * EVERYONE ELSE — free tier, signed-out, unverified subscription, or over the
 * allowance — NEVER reaches the company key. They fall through to on-device
 * (Ollama) AI or a friendly "add your own key / use on-device" message. The
 * meter DEFAULTS FAIL-CLOSED: any doubt, any error, any missing verification =
 * blocked.
 *
 * ── Why "subscriptions verified" is its own switch ─────────────────────────
 * Paid-tier entitlement is not yet reliably provable server-side (Stripe +
 * RevenueCat are scaffolding — resolveTierFromRevenueCat returns 'free' unless
 * a funded provider is wired). So until that is real, `areSubscriptionsVerified()`
 * defaults FALSE and the ONLY path to the company key is the internal developer
 * allowlist. The full metered-paid path below is built and tested, but it can
 * only actually grant access once SUBSCRIPTIONS_VERIFIED=true AND a billing
 * provider is configured. This is deliberate: no unverified user can ever reach
 * our key.
 *
 * ── Concurrency safety ─────────────────────────────────────────────────────
 * The metered path uses INCREMENT-THEN-COMPARE (never check-then-increment):
 * it atomically bumps the counter and only proceeds if the NEW value is within
 * the allowance. On production KV this is a real Redis INCR (atomic across all
 * serverless instances), so a burst of N parallel over-limit requests can only
 * ever let `allowance`-many through — the rest see a value over the cap and are
 * blocked. See tests/cost-guardrails-test.js for the proof.
 */

import type { SubscriptionTierId } from '@/config/subscription-tiers';
import { isBillingEnabled } from '@/config/billing-config';
import { isAuthEnabled } from '@/lib/auth/auth-config';
import { resolveTierFromRevenueCat } from '@/lib/billing/revenuecat-client';
import { getStorage } from '@/lib/storage/adapter';

/* ─────────────────────────── allowance config ─────────────────────────────
 * SINGLE, CLEARLY-LABELED KNOB for the per-tier monthly company-AI TEXT
 * allowance. Tune these numbers here and nowhere else. Values are CONSERVATIVE
 * PLACEHOLDERS until real vendor costs are trued-up against the 20%-margin
 * model (docs/pricing-cost-analysis.md).
 *
 *   free    = 0   → free users NEVER use our key (on-device / BYOK only).
 *   pro     = per the Professional allowance in the pricing model.
 *   premium = a higher allowance for the top tier.
 *
 * Use -1 to mean "unlimited" (no cap) — avoid for company-funded tiers unless
 * intended, since it removes the cost ceiling.
 *
 * NOTE on Student: the entitlement layer resolves subscriptions to
 * free/pro/premium ids (see resolveTierFromRevenueCat). A lighter Student
 * allowance is a future refinement once the Student entitlement is mapped to
 * its own tier id; today a Student subscription resolves through this same
 * table.
 */
export const AI_TEXT_ALLOWANCES: Record<SubscriptionTierId, number> = {
  free: 0, // Free — NEVER our key (on-device / BYOK only).
  pro: 1000, // Professional — approved starting monthly company-AI text generations (2026-07-23).
  premium: 3000, // Top tier — monthly company-AI text generations (placeholder).
};

/* ─── APPROVED STARTING ALLOWANCES (2026-07-23) — the tune-here knobs ────────
 * Owner-approved launch numbers for the per-tier MONTHLY company-cloud-AI text
 * generation allowance. Change ONLY these values to retune; the enforcement
 * logic reads AI_TEXT_ALLOWANCES above and never hard-codes a number.
 *
 *   Free         = 0     → free users never touch the company key.
 *   Professional = 1000  → the 'pro' tier row above.
 *   Student      = 500   → applied once the Student entitlement maps to its own
 *                          tier id (today a Student subscription resolves through
 *                          the same free/pro/premium table — see note above).
 *   Overage pack = +500  → placeholder / "coming soon"; not yet purchasable.
 */
export const AI_TEXT_ALLOWANCE_FREE = 0;
export const AI_TEXT_ALLOWANCE_PROFESSIONAL = 1000;
export const AI_TEXT_ALLOWANCE_STUDENT = 500;
/** Additional generations granted by one overage pack. Placeholder — "coming soon". */
export const AI_TEXT_OVERAGE_PACK = 500;

/* ───────────────────────── internal dev allowlist ─────────────────────────
 * "Only us as we develop." Reachable by email (any linked Clerk email) OR by
 * Clerk user id. Configure via env; defaults to the founder's account so we're
 * never locked out. Mirrors src/lib/access/admin.ts's allowlist posture.
 */
const DEFAULT_DEV_EMAIL = 'hjachter@gmail.com';

function normalizeEmail(email: string): string {
  return (email ?? '').trim().toLowerCase();
}

/** Parsed internal-developer email allowlist (from INTERNAL_AI_DEV_EMAILS). */
export function getInternalDevEmails(): string[] {
  const raw = (process.env.INTERNAL_AI_DEV_EMAILS ?? '').trim();
  const list = raw
    .split(',')
    .map((s) => normalizeEmail(s))
    .filter((s) => s.length > 0 && s.indexOf('@') !== -1);
  return list.length > 0 ? list : [normalizeEmail(DEFAULT_DEV_EMAIL)];
}

/** Parsed internal-developer Clerk user-id allowlist (INTERNAL_AI_DEV_USER_IDS). */
export function getInternalDevUserIds(): string[] {
  const raw = (process.env.INTERNAL_AI_DEV_USER_IDS ?? '').trim();
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Pure: is this identity on the internal developer allowlist? */
export function isInternalDevIdentity(
  userId: string | null,
  emails: string[],
): boolean {
  if (userId && getInternalDevUserIds().includes(userId)) return true;
  const allow = getInternalDevEmails();
  return emails.map(normalizeEmail).some((e) => e.length > 0 && allow.includes(e));
}

/**
 * LOCAL DEV ESCAPE HATCH — only in a non-production build WITHOUT auth wired
 * (i.e. the developer's own Electron/dev machine) AND only when the developer
 * explicitly opts in with ALLOW_COMPANY_TEXT_FALLBACK=true. In production (auth
 * enabled) this ALWAYS returns false, so it can never expose the company key to
 * real users. It exists so the owner can exercise the company Gemini path
 * locally without a signed-in Clerk session.
 */
export function isLocalDevOverride(): boolean {
  if (typeof process === 'undefined' || !process.env) return false;
  if (isAuthEnabled()) return false; // production / real auth → never.
  return process.env.ALLOW_COMPANY_TEXT_FALLBACK === 'true';
}

/**
 * Is paid-tier entitlement reliably provable server-side yet? Defaults FALSE.
 * True only when SUBSCRIPTIONS_VERIFIED=true AND a billing provider is wired.
 * Until true, the metered-paid path can never grant access — the internal dev
 * allowlist is the only door to the company key.
 */
export function areSubscriptionsVerified(): boolean {
  if (typeof process === 'undefined' || !process.env) return false;
  return process.env.SUBSCRIPTIONS_VERIFIED === 'true' && isBillingEnabled();
}

/* ─────────────────────────── billing period ───────────────────────────────
 * Monthly, UTC, auto-resetting: the key changes every calendar month, so a new
 * month starts a fresh counter with zero migration. Format: YYYY-MM.
 */
export function getBillingPeriod(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** KV key for a user's company-AI text usage in a billing period. */
export function usageKey(userId: string, period: string): string {
  return `ai-text-quota:${userId}:${period}`;
}

/* ───────────────────────────── the decision ───────────────────────────────*/

export type CompanyTextReason =
  | 'byok' // user's OWN key — never company key, never counted.
  | 'dev-allowlist' // internal developer — allowed, not counted.
  | 'metered' // verified paid, within allowance — counted.
  | 'over-allowance' // verified paid, allowance exhausted this month.
  | 'not-verified' // subscriptions not verifiable server-side yet.
  | 'free-tier' // verified but free / zero allowance.
  | 'signed-out' // no server identity.
  | 'error'; // fail-closed on any error.

export interface CompanyTextAccess {
  /** True ONLY when the company key may be used for this request. */
  allowed: boolean;
  /** How the call is funded when allowed. */
  fund: 'byok' | 'company' | null;
  reason: CompanyTextReason;
  tier?: SubscriptionTierId;
  /** New usage count after this call (metered path only). */
  used?: number;
  /** The tier's monthly allowance (metered path only). */
  limit?: number;
}

export interface MeterIdentity {
  userId: string | null;
  emails: string[];
  /** Pre-computed internal-dev flag (lets callers/tests inject identity). */
  isDev: boolean;
}

export interface MeterDeps {
  areSubscriptionsVerified: () => boolean;
  /** Resolve the account's tier (free/pro/premium). */
  resolvePlan: (userId: string) => Promise<SubscriptionTierId>;
  /** Atomic +1 → new value. MUST be atomic for the concurrency guarantee. */
  increment: (key: string) => Promise<number>;
  now?: () => Date;
}

/**
 * PURE-ISH core decision. No Clerk, no global storage — everything comes in via
 * `identity` and `deps`, so the guardrail test can drive it with synthetic
 * identities and an atomic in-memory counter. This is the single source of the
 * enforcement rule; resolveCompanyTextAccess() just feeds it real inputs.
 */
export async function evaluateCompanyTextAccess(
  identity: MeterIdentity,
  opts: { isByok?: boolean },
  deps: MeterDeps,
): Promise<CompanyTextAccess> {
  try {
    // A real BYOK call runs on the user's OWN key — never our key, never counted.
    if (opts.isByok) return { allowed: true, fund: 'byok', reason: 'byok' };

    // (a) Internal developer allowlist — "only us as we develop".
    if (identity.isDev) {
      return { allowed: true, fund: 'company', reason: 'dev-allowlist' };
    }

    // (b) Verified paid tier within allowance. If entitlement can't be verified
    //     server-side yet, NOBODY non-dev reaches the company key.
    if (!deps.areSubscriptionsVerified()) {
      return { allowed: false, fund: null, reason: 'not-verified' };
    }
    if (!identity.userId) {
      return { allowed: false, fund: null, reason: 'signed-out' };
    }

    const tier = await deps.resolvePlan(identity.userId);
    const limit = AI_TEXT_ALLOWANCES[tier] ?? 0;

    if (limit === 0) {
      return { allowed: false, fund: null, reason: 'free-tier', tier, limit };
    }
    if (limit < 0) {
      // Unlimited tier — allowed without a hard cap. (Best-effort count omitted.)
      return { allowed: true, fund: 'company', reason: 'metered', tier, limit };
    }

    // Metered: increment FIRST, then compare — concurrency-safe with an atomic
    // backend. If the store can't count durably (stub → MAX_SAFE_INTEGER) or a
    // burst pushed us past the cap, this comparison fails CLOSED.
    const period = getBillingPeriod(deps.now ? deps.now() : new Date());
    const used = await deps.increment(usageKey(identity.userId, period));
    if (used <= limit) {
      return { allowed: true, fund: 'company', reason: 'metered', tier, used, limit };
    }
    return { allowed: false, fund: null, reason: 'over-allowance', tier, used, limit };
  } catch {
    // Any failure anywhere in the decision → fail closed.
    return { allowed: false, fund: null, reason: 'error' };
  }
}

/* ─────────────────────── real identity resolution ─────────────────────────*/

/**
 * Resolve the signed-in Clerk user id + all linked emails on the server. Uses
 * the same lazy-require pattern as src/lib/access/admin.ts so the Clerk runtime
 * never loads in stub builds and never poisons a client bundle. Returns empty
 * identity (and never throws) when auth is off or anything goes wrong.
 */
export async function getServerUserIdentity(): Promise<{
  userId: string | null;
  emails: string[];
}> {
  if (!isAuthEnabled()) return { userId: null, emails: [] };
  try {
    /* eslint-disable @typescript-eslint/no-var-requires */
    const clerkServer = require('@clerk/nextjs/server') as {
      auth?: () =>
        | Promise<{ userId?: string | null }>
        | { userId?: string | null };
      clerkClient?: () => Promise<{
        users: {
          getUser: (id: string) => Promise<{
            emailAddresses?: Array<{ emailAddress?: string }>;
          }>;
        };
      }>;
    };
    /* eslint-enable @typescript-eslint/no-var-requires */
    if (!clerkServer.auth) return { userId: null, emails: [] };
    const session = await Promise.resolve(clerkServer.auth());
    const userId = session.userId ?? null;
    if (!userId || !clerkServer.clerkClient) return { userId, emails: [] };
    const client = await clerkServer.clerkClient();
    const user = await client.users.getUser(userId);
    const emails = (user.emailAddresses ?? [])
      .map((e) => normalizeEmail(e.emailAddress ?? ''))
      .filter((e) => e.length > 0);
    return { userId, emails };
  } catch {
    return { userId: null, emails: [] };
  }
}

async function resolveRealIdentity(): Promise<MeterIdentity> {
  try {
    if (isLocalDevOverride()) {
      return { userId: null, emails: [], isDev: true };
    }
    const { userId, emails } = await getServerUserIdentity();
    return { userId, emails, isDev: isInternalDevIdentity(userId, emails) };
  } catch {
    return { userId: null, emails: [], isDev: false };
  }
}

/**
 * THE server-side gate every company-funded cloud TEXT-AI entry point calls
 * BEFORE hitting the vendor. Wires the real Clerk identity, RevenueCat plan
 * lookup and atomic KV counter into evaluateCompanyTextAccess. Fail-closed.
 */
export async function resolveCompanyTextAccess(
  opts: { isByok?: boolean } = {},
): Promise<CompanyTextAccess> {
  const identity = await resolveRealIdentity();
  return evaluateCompanyTextAccess(identity, opts, {
    areSubscriptionsVerified,
    resolvePlan: (userId) => resolveTierFromRevenueCat(userId),
    increment: (key) => getStorage().increment(key),
  });
}
