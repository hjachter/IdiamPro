/**
 * Entitlements — the single place that decides what the current tier may do.
 *
 * AUTH PHASE 3 (tier enforcement). Modeled on the env-gating philosophy used
 * everywhere in this codebase (Sentry, auth-config.ts, billing-gate.ts):
 * enforcement is fully inert unless auth + billing are actually configured.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ #1 SAFETY RULE — isEnforcementActive() is the master no-op switch.       │
 * │ It returns false whenever auth is disabled (no Clerk keys — the state    │
 * │ today). When false EVERY gate short-circuits and allows everything, so   │
 * │ the live app behaves 100% identically to before this module existed:    │
 * │ cloud AI, premium AI features, premium export templates, podcast/        │
 * │ universal output, and uncapped AI generation all stay available.        │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Light & targeted: this only gates *shipped paid surfaces*. It does NOT
 * gate core editing, outline creation/count, item types, local Ollama AI,
 * BYOK, basic import, or PDF export — those stay free for everyone.
 *
 * Deferred (intentionally NOT enforced here — future work when shipped):
 * audio-transcription hour caps, collaborator caps, and any "coming soon"
 * features (AI style learning, etc.).
 *
 * All tier touchpoints in the app must call THIS module — never scatter raw
 * tier checks. Server code can call isEnforcementActive/getCurrentEntitlements
 * directly; client code uses these plus the localStorage-backed quota helpers.
 */

import { isAuthEnabled, resolveCurrentTier } from '@/lib/auth/auth-config';
import { isBillingEnabled } from '@/lib/billing/billing-gate';
import {
import { safeJsonParse } from '@/lib/safe-json';
  type SubscriptionTierEntry,
  type SubscriptionTierId,
} from '@/config/subscription-tiers';

/**
 * THE MASTER NO-OP SWITCH.
 *
 * Enforcement is only active when BOTH auth and billing are enabled (real
 * Clerk + Stripe/RevenueCat keys present). With no keys — the current state
 * of the app — this returns false and every gate below allows everything.
 *
 * Auth alone is intentionally not enough: without billing there is no way
 * for a user to ever reach a paid tier, so enforcing would only ever punish
 * (lock free users out of things they have today). Requiring billing too
 * keeps the no-op guarantee airtight.
 */
export function isEnforcementActive(): boolean {
  return isAuthEnabled() && isBillingEnabled();
}

/**
 * The current user's full tier entry. When enforcement is inactive this is
 * always the default ('free') tier — but callers must still gate on
 * isEnforcementActive(), because 'free' here does NOT mean "restrict": with
 * enforcement off, the tier is irrelevant and everything is allowed.
 *
 * @param tierId Optional billed tier id (Phase: supplied by Clerk metadata /
 *   Stripe webhook once those exist). Ignored while billing is disabled.
 */
export function getCurrentEntitlements(
  tierId?: string | null,
): SubscriptionTierEntry {
  return resolveCurrentTier(tierId);
}

/* ───────────────────────── Feature capability gates ───────────────────── */

/**
 * Capability keys the app gates on. Kept small and shipped-only.
 *  - premiumAIFeatures: subtree summaries, teach mode, consistency checks
 *    (the AIFeatureFlags premium set) — Pro+.
 *  - premiumExportTemplates: premium website-export templates — Pro+.
 *  - universalOutput: premium export / "Universal Output Formats" — Power.
 *  - podcastGeneration: podcast / universal-output generation — Power.
 *  - cloudAI: hosted cloud AI provider access — Pro+ (Free = local-only
 *    hosted; BYOK is always allowed at every tier and is checked separately).
 */
export type FeatureKey =
  | 'premiumAIFeatures'
  | 'premiumExportTemplates'
  | 'universalOutput'
  | 'podcastGeneration'
  | 'cloudAI';

/**
 * True if the current tier may use `key`.
 *
 * SAFETY: when enforcement is inactive this ALWAYS returns true (no-op) —
 * the live app keeps every feature it has today.
 */
export function canUseFeature(
  key: FeatureKey,
  tierId?: string | null,
): boolean {
  if (!isEnforcementActive()) return true; // master no-op

  const ent = getCurrentEntitlements(tierId).entitlements;
  switch (key) {
    case 'premiumAIFeatures':
      return ent.premiumAIFeatures; // Pro+
    case 'premiumExportTemplates':
      return ent.premiumAIFeatures; // Pro+ (same Pro-gate as premium AI)
    case 'cloudAI':
      // Free tier is local-only hosted; Pro+ may use cloud. BYOK is handled
      // by the caller (isByokRequest) and bypasses this entirely.
      return ent.aiProvider === 'cloud';
    case 'universalOutput':
    case 'podcastGeneration':
      // Power/premium only. priorityAI is true only for 'premium'.
      return ent.priorityAI;
    default:
      return true;
  }
}

/* ─────────────────────────── AI usage quotas ──────────────────────────── */

/**
 * Monthly hosted cloud-AI quotas, per the advertised pricing page
 * (docs/outlines/IdiamPro-Marketing.idm). -1 = unlimited.
 *
 *  FREE  : 10 outline generations / mo,  25 content expansions / mo
 *  PRO   : 100 outline generations / mo, unlimited expansions
 *  POWER : unlimited both
 */
export type AIUsageKind = 'outlineGeneration' | 'contentExpansion';

const MONTHLY_QUOTAS: Record<
  SubscriptionTierId,
  Record<AIUsageKind, number>
> = {
  free: { outlineGeneration: 10, contentExpansion: 25 },
  pro: { outlineGeneration: 100, contentExpansion: -1 },
  premium: { outlineGeneration: -1, contentExpansion: -1 },
};

export interface AIQuotaStatus {
  /** Whether one more call of this kind is allowed right now. */
  allowed: boolean;
  /** Calls already used this calendar month. */
  used: number;
  /** Monthly limit for this tier (-1 = unlimited). */
  limit: number;
  /** Unix-ms when the month resets (start of next calendar month, UTC). */
  resetsAt: number;
  /** True when this call is exempt (local Ollama / BYOK / enforcement off). */
  exempt: boolean;
}

const USAGE_STORAGE_KEY = 'idiampro-ai-usage-v1';

interface UsageRecord {
  /** Calendar-month bucket, "YYYY-MM" (UTC). */
  period: string;
  counts: Partial<Record<AIUsageKind, number>>;
}

/** Current calendar-month bucket id, e.g. "2026-05" (UTC). */
function currentPeriod(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Unix-ms for the start of the next calendar month (UTC) — the reset point. */
function nextMonthResetMs(now = new Date()): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0);
}

/**
 * Read the usage record from localStorage, rolling it over to a fresh empty
 * record at the start of each calendar month. Backward compatible: missing /
 * malformed / old-shape data is treated as "no usage this month".
 */
function readUsage(): UsageRecord {
  const period = currentPeriod();
  const empty: UsageRecord = { period, counts: {} };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = window.localStorage.getItem(USAGE_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = safeJsonParse(raw) as Partial<UsageRecord>;
    if (!parsed || parsed.period !== period || typeof parsed.counts !== 'object') {
      return empty; // new month or unrecognized → reset
    }
    return { period, counts: { ...parsed.counts } };
  } catch {
    return empty; // never let a storage error block the user
  }
}

function writeUsage(rec: UsageRecord): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(rec));
  } catch {
    /* best-effort — a write failure must never break generation */
  }
}

/**
 * Is this AI request EXEMPT from quota counting?
 *
 * Exempt = never counts against the quota, always allowed, all tiers:
 *  - Local Ollama AI: user picked the local provider (aiProvider === 'local').
 *  - BYOK: the user supplied their own model API key in Settings
 *    (any apiKey_* present in localStorage).
 *
 * Mirrors the provider/key conventions used by settings-dialog.tsx.
 */
export function isExemptAIRequest(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.localStorage.getItem('aiProvider') === 'local') return true;
    for (const p of ['gemini', 'openai', 'anthropic', 'mistral', 'groq']) {
      const k = window.localStorage.getItem(`apiKey_${p}`);
      if (k && k.trim().length > 0) return true; // BYOK
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Check (without consuming) whether a hosted cloud-AI call of `kind` is
 * allowed this calendar month.
 *
 * SAFETY: returns allowed:true, exempt:true when enforcement is inactive
 * (no-op) OR when the request is local/BYOK exempt — so the live app is
 * never capped today and local/BYOK are never counted.
 */
export function checkAIQuota(
  kind: AIUsageKind,
  tierId?: string | null,
): AIQuotaStatus {
  const resetsAt = nextMonthResetMs();

  // Master no-op + exemptions: unlimited, nothing counted.
  if (!isEnforcementActive() || isExemptAIRequest()) {
    return { allowed: true, used: 0, limit: -1, resetsAt, exempt: true };
  }

  const tier = getCurrentEntitlements(tierId).id;
  const limit = MONTHLY_QUOTAS[tier][kind];
  const used = readUsage().counts[kind] ?? 0;

  if (limit < 0) {
    return { allowed: true, used, limit, resetsAt, exempt: false };
  }
  return { allowed: used < limit, used, limit, resetsAt, exempt: false };
}

/**
 * Record one successful hosted cloud-AI call of `kind`.
 *
 * SAFETY / EXEMPTIONS: a true no-op when enforcement is inactive, when the
 * request is local/BYOK exempt, or when the tier is unlimited for this kind.
 * Call this only AFTER a successful generation so failed calls aren't
 * charged. Returns the post-increment quota status.
 */
export function recordAIUsage(
  kind: AIUsageKind,
  tierId?: string | null,
): AIQuotaStatus {
  const resetsAt = nextMonthResetMs();

  if (!isEnforcementActive() || isExemptAIRequest()) {
    return { allowed: true, used: 0, limit: -1, resetsAt, exempt: true };
  }

  const tier = getCurrentEntitlements(tierId).id;
  const limit = MONTHLY_QUOTAS[tier][kind];
  if (limit < 0) {
    // Unlimited tier — nothing to track.
    return { allowed: true, used: 0, limit, resetsAt, exempt: false };
  }

  const rec = readUsage();
  const used = (rec.counts[kind] ?? 0) + 1;
  rec.counts[kind] = used;
  writeUsage(rec);

  return { allowed: used < limit, used, limit, resetsAt, exempt: false };
}

/* ───────────────────────────── UI helpers ─────────────────────────────── */

/**
 * User-facing tier label. Code ids stay 'free'/'pro'/'premium' but the
 * pricing page calls 'premium' the "Power" plan — so any label we SHOW the
 * user must say "Power". Use this everywhere a tier name is displayed.
 */
export function tierDisplayName(id: SubscriptionTierId): string {
  switch (id) {
    case 'free':
      return 'Free';
    case 'pro':
      return 'Pro';
    case 'premium':
      return 'Power';
    default:
      return 'Free';
  }
}

export type { SubscriptionTierEntry, SubscriptionTierId };
