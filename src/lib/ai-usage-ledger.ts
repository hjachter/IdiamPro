/**
 * AI Usage Ledger — a local, privacy-respecting record of the user's own
 * AI activity (P2 cost instrumentation, 2026-09-06).
 *
 * PURPOSE: transparency FOR THE USER. Every AI operation (all cost
 * classes — light, medium, heavy) appends one entry: when it ran, which
 * op, its cost class, and which provider/path handled it, plus token
 * counts when a call site has them from the API response.
 *
 * PRIVACY GUARANTEES (do not weaken):
 *   - Stored ONLY in this device's localStorage. No server calls, no
 *     telemetry, nothing leaves the machine. This is the user's data.
 *   - No prompt or content text is ever recorded — only op metadata.
 *
 * The read API (summarizeAiUsage) exists so a future Settings panel can
 * show "your AI usage this month" by class / provider / period.
 *
 * Central choke point: use-ai-usage-gate.tsx records an entry on every
 * successful gate() pass, so all gated call sites are instrumented with
 * zero per-site changes. Call sites that later learn token counts can
 * attach them via attachTokensToLastEntry().
 */

import { getCostModelEntry, type CostClass } from '@/lib/ai-cost-model';

const LEDGER_KEY = 'aiUsageLedger.v1';
/** Hard cap on stored entries — oldest are dropped first. */
const MAX_ENTRIES = 1000;

export interface AiLedgerEntry {
  /** Epoch ms when the op was initiated. */
  t: number;
  /** Op id (matches the AI cost-model registry / gate feature keys). */
  op: string;
  cls: CostClass | 'unknown';
  /** Provider or path that handled it: 'gemini', 'openai', 'local', 'mac-voices', 'free-tier', … */
  provider?: string;
  /** Token counts, when the API response provided them. */
  tokensIn?: number;
  tokensOut?: number;
}

function readLedger(): AiLedgerEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LEDGER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AiLedgerEntry[]) : [];
  } catch {
    return [];
  }
}

function writeLedger(entries: AiLedgerEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = entries.length > MAX_ENTRIES ? entries.slice(entries.length - MAX_ENTRIES) : entries;
    window.localStorage.setItem(LEDGER_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage full / private mode — the ledger is best-effort, never fatal.
  }
}

export interface RecordAiUsageOptions {
  opId: string;
  /** Override the provider/path; when absent the caller should pass what it knows. */
  provider?: string;
  tokensIn?: number;
  tokensOut?: number;
}

/**
 * Append one entry. Never throws; never blocks the AI call.
 * Class is looked up from the cost-model registry by op id.
 */
export function recordAiUsage(opts: RecordAiUsageOptions): void {
  try {
    const entry: AiLedgerEntry = {
      t: Date.now(),
      op: opts.opId,
      cls: getCostModelEntry(opts.opId)?.costClass ?? 'unknown',
    };
    if (opts.provider) entry.provider = opts.provider;
    if (typeof opts.tokensIn === 'number') entry.tokensIn = opts.tokensIn;
    if (typeof opts.tokensOut === 'number') entry.tokensOut = opts.tokensOut;
    const entries = readLedger();
    entries.push(entry);
    writeLedger(entries);
  } catch {
    /* best-effort */
  }
}

/**
 * Attach token counts (from an API response's usage block) to the most
 * recent entry for `opId` — call sites that stream a response learn the
 * counts only after the gate already recorded the entry.
 */
export function attachTokensToLastEntry(opId: string, tokens: { tokensIn?: number; tokensOut?: number; provider?: string }): void {
  try {
    const entries = readLedger();
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].op === opId) {
        if (typeof tokens.tokensIn === 'number') entries[i].tokensIn = tokens.tokensIn;
        if (typeof tokens.tokensOut === 'number') entries[i].tokensOut = tokens.tokensOut;
        if (tokens.provider) entries[i].provider = tokens.provider;
        writeLedger(entries);
        return;
      }
    }
  } catch {
    /* best-effort */
  }
}

/** All stored entries, oldest first. */
export function getAiUsageLedger(): AiLedgerEntry[] {
  return readLedger();
}

export interface AiUsageSummary {
  /** Entries considered (within the period). */
  total: number;
  byClass: Record<string, number>;
  byProvider: Record<string, number>;
  byOp: Record<string, number>;
  tokensIn: number;
  tokensOut: number;
  /** Period start (epoch ms) actually applied. */
  sinceMs: number;
}

/**
 * Summarize usage since `sinceMs` (default: start of the current calendar
 * month — matching how the app talks about "this month" elsewhere).
 */
export function summarizeAiUsage(opts?: { sinceMs?: number }): AiUsageSummary {
  const now = new Date();
  const defaultSince = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const sinceMs = opts?.sinceMs ?? defaultSince;
  const summary: AiUsageSummary = {
    total: 0,
    byClass: {},
    byProvider: {},
    byOp: {},
    tokensIn: 0,
    tokensOut: 0,
    sinceMs,
  };
  for (const e of readLedger()) {
    if (e.t < sinceMs) continue;
    summary.total++;
    summary.byClass[e.cls] = (summary.byClass[e.cls] ?? 0) + 1;
    const p = e.provider ?? 'unknown';
    summary.byProvider[p] = (summary.byProvider[p] ?? 0) + 1;
    summary.byOp[e.op] = (summary.byOp[e.op] ?? 0) + 1;
    if (typeof e.tokensIn === 'number') summary.tokensIn += e.tokensIn;
    if (typeof e.tokensOut === 'number') summary.tokensOut += e.tokensOut;
  }
  return summary;
}

/** Wipe the ledger (user-initiated privacy action, or tests). */
export function clearAiUsageLedger(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LEDGER_KEY);
  } catch {
    /* best-effort */
  }
}
