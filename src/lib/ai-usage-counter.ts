/**
 * AI Usage Counter — local-month bucket for the launch tier model.
 *
 * This file implements the launch-time generation counting introduced for
 * Auth Phase 3 (tier enforcement, GitHub issue #33). It is intentionally
 * SEPARATE from the older src/lib/entitlements (which uses an outline /
 * content-expansion bucket model gated behind isEnforcementActive()).
 *
 *  - 1 generation = 1 user-initiated AI action, regardless of internal
 *    fan-out. LIVE BOOKS refresh of 10 nodes = 1; Translate of 50 nodes = 1;
 *    Help / Knowledge chat round-trip = 1; "Create Content for Descendants" = 1.
 *  - Reset = calendar month, 1st at midnight in the user's LOCAL timezone
 *    (matches "Resets on …" copy the user reads in Settings).
 *  - Tier caps come from src/lib/tier-detection.ts.
 *  - BYOK + local Ollama users bypass counting entirely (handled by the
 *    higher-level gate in src/lib/ai-usage-gate.ts).
 *
 * Storage: localStorage key `idiampro-ai-usage-counter-v1`, shape
 *   { monthKey: 'YYYY-MM' (local TZ), count: number }
 * Backward compatible: any malformed/missing/old-shape data is treated as a
 * fresh empty record for the current month so a storage glitch never blocks
 * the user. The legacy outline/contentExpansion bucket in
 * idiampro-ai-usage-v1 is left untouched so the older entitlements path is
 * unaffected.
 */

const COUNTER_STORAGE_KEY = 'idiampro-ai-usage-counter-v1';

export interface UsageRecord {
  /** Current calendar-month bucket id in LOCAL timezone, "YYYY-MM". */
  monthKey: string;
  /** Generations consumed this bucket. */
  count: number;
}

/** Calendar-month bucket id for `now` in the user's LOCAL timezone. */
export function getCurrentMonthKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Unix-ms timestamp for the start of the next calendar month, LOCAL TZ. */
export function getNextResetMs(now: Date = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0).getTime();
}

/**
 * Human-readable date for "Resets on …". Uses the user's locale + LOCAL TZ.
 * Example: "Jul 1, 2026".
 */
export function getNextResetLabel(now: Date = new Date()): string {
  const dt = new Date(getNextResetMs(now));
  try {
    return dt.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dt.toDateString();
  }
}

/** Days remaining until the next reset, rounded up. */
export function getDaysUntilReset(now: Date = new Date()): number {
  const ms = getNextResetMs(now) - now.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Read the current usage record. If the stored monthKey doesn't match the
 * current month (rollover), returns a fresh zero record AND writes the
 * rollover so subsequent calls are consistent. Safe to call from SSR
 * (returns a zero record on the server).
 */
export function getUsage(): UsageRecord {
  const monthKey = getCurrentMonthKey();
  if (typeof window === 'undefined') return { monthKey, count: 0 };
  try {
    const raw = window.localStorage.getItem(COUNTER_STORAGE_KEY);
    if (!raw) return { monthKey, count: 0 };
    const parsed = JSON.parse(raw) as Partial<UsageRecord>;
    if (
      !parsed ||
      typeof parsed.monthKey !== 'string' ||
      typeof parsed.count !== 'number' ||
      parsed.count < 0
    ) {
      return { monthKey, count: 0 };
    }
    if (parsed.monthKey !== monthKey) {
      // Rollover — store a fresh zero record so next read is consistent.
      const fresh: UsageRecord = { monthKey, count: 0 };
      try {
        window.localStorage.setItem(COUNTER_STORAGE_KEY, JSON.stringify(fresh));
      } catch {
        /* best-effort */
      }
      return fresh;
    }
    return { monthKey, count: parsed.count };
  } catch {
    return { monthKey, count: 0 };
  }
}

/**
 * Increment the counter by one and return the new record. A no-op on the
 * server. Never throws — a write failure must not block the user's AI call.
 */
export function incrementUsage(): UsageRecord {
  const next = getUsage();
  next.count += 1;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(COUNTER_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* best-effort */
    }
  }
  return next;
}

/**
 * Reset the counter to zero for the current month. Intended for tests and
 * the Settings "Reset usage (debug)" action; not surfaced in normal UI.
 */
export function resetUsage(): void {
  if (typeof window === 'undefined') return;
  try {
    const fresh: UsageRecord = { monthKey: getCurrentMonthKey(), count: 0 };
    window.localStorage.setItem(COUNTER_STORAGE_KEY, JSON.stringify(fresh));
  } catch {
    /* best-effort */
  }
}

/**
 * TEST/DEBUG ONLY: directly seed the counter to a specific value for the
 * current month. Used by tests/tier-enforcement-test.js to simulate
 * various counter states without driving real AI calls.
 */
export function _seedUsageForTest(count: number): void {
  if (typeof window === 'undefined') return;
  try {
    const rec: UsageRecord = { monthKey: getCurrentMonthKey(), count };
    window.localStorage.setItem(COUNTER_STORAGE_KEY, JSON.stringify(rec));
  } catch {
    /* best-effort */
  }
}
