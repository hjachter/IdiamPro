'use client';

/**
 * AI Activity — the user-facing viewer for the private, on-device AI usage
 * ledger (src/lib/ai-usage-ledger.ts).
 *
 * The ledger has recorded every AI operation since P2 cost instrumentation
 * (2026-09-06), but until now had no surface where the user could actually
 * SEE it — "for your own eyes" needs eyes-on. This dialog is that surface,
 * opened from the AI menu → "AI Activity".
 *
 * PRIVACY (mirrors the ledger's guarantees — do not weaken):
 *   - Read-only view of localStorage data. No server calls, no telemetry.
 *   - No prompt/content text exists in the ledger, so none is shown — only
 *     op metadata (what ran, when, which provider/path handled it).
 *
 * Value-based naming: operation names come from the AI cost-model registry's
 * plain-English labels (ai-cost-model.ts), never raw op ids, unless an id has
 * no registry entry (then the id is shown as a last resort).
 */

import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Receipt, ShieldCheck } from 'lucide-react';
import { getAiUsageLedger, summarizeAiUsage, type AiLedgerEntry } from '@/lib/ai-usage-ledger';
import { getCostModelEntry } from '@/lib/ai-cost-model';

/** Friendly names for the provider/path values the gate records. */
const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic Claude',
  groq: 'Groq',
  mistral: 'Mistral',
  local: 'On-device AI',
  'mac-voices': 'Mac built-in voices',
  'free-tier': 'Built-in free tier',
  unknown: 'Unknown',
};

function providerLabel(p?: string): string {
  if (!p) return 'Unknown';
  return PROVIDER_LABELS[p] ?? p;
}

function opLabel(op: string): string {
  return getCostModelEntry(op)?.label ?? op;
}

/** "Sep 12, 3:41 PM" — compact, unambiguous, locale-aware. */
function formatWhen(t: number): string {
  return new Date(t).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const CLASS_BADGE: Record<string, { label: string; className: string }> = {
  light: { label: 'Light', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
  medium: { label: 'Medium', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' },
  heavy: { label: 'Heavy', className: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30' },
  unknown: { label: '—', className: 'bg-muted text-muted-foreground border-transparent' },
};

interface AiActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AiActivityDialog({ open, onOpenChange }: AiActivityDialogProps) {
  // Read fresh on every open — the ledger may have grown since last time.
  const { entries, summary } = useMemo(() => {
    if (!open) return { entries: [] as AiLedgerEntry[], summary: null };
    const all = getAiUsageLedger();
    return {
      // Newest first, capped for a snappy list.
      entries: all.slice(-200).reverse(),
      summary: summarizeAiUsage(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="ai-activity-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            AI Activity
          </DialogTitle>
          <DialogDescription>
            Your private record of the AI you&rsquo;ve run — what, when, and which provider handled
            it. Stored only on this device; nothing here ever leaves your machine.
          </DialogDescription>
        </DialogHeader>

        {/* This-month summary */}
        {summary && (
          <div className="grid grid-cols-3 gap-2" data-testid="ai-activity-summary">
            <div className="rounded-lg border bg-muted/40 px-3 py-2 text-center">
              <div className="text-xl font-bold leading-tight">{summary.total}</div>
              <div className="text-[11px] text-muted-foreground">this month</div>
            </div>
            <div className="rounded-lg border bg-muted/40 px-3 py-2 text-center">
              <div className="text-xl font-bold leading-tight">
                {(summary.byClass['heavy'] ?? 0) + (summary.byClass['medium'] ?? 0)}
              </div>
              <div className="text-[11px] text-muted-foreground">medium + heavy</div>
            </div>
            <div className="rounded-lg border bg-muted/40 px-3 py-2 text-center">
              <div className="text-xl font-bold leading-tight">
                {Object.keys(summary.byProvider).length}
              </div>
              <div className="text-[11px] text-muted-foreground">providers used</div>
            </div>
          </div>
        )}

        {/* Recent activity list */}
        {entries.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            No AI activity recorded on this device yet. Run any AI feature and it will appear here.
          </div>
        ) : (
          <ScrollArea className="h-[300px] rounded-lg border">
            <ul className="divide-y">
              {entries.map((e, i) => {
                const badge = CLASS_BADGE[e.cls] ?? CLASS_BADGE.unknown;
                return (
                  <li key={`${e.t}-${i}`} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{opLabel(e.op)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatWhen(e.t)} · {providerLabel(e.provider)}
                      </div>
                    </div>
                    <Badge variant="outline" className={`shrink-0 text-[10px] ${badge.className}`}>
                      {badge.label}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}

        {/* Privacy footnote */}
        <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>
            Recorded privately in this device&rsquo;s local storage. No prompts or content are ever
            recorded — only the activity itself.
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
