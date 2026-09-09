'use client';

/**
 * Heavy-op approval dialog (P2 cost model, 2026-09-06).
 *
 * Before any HEAVY AI operation runs (podcast, video, LIVE BOOKS refresh,
 * YouTube package, bulk research, batch generation), the app shows one
 * small professional confirm: what's about to run, whose key pays, and an
 * HONEST typical-cost frame — then Run / Cancel. Light and medium ops get
 * NO new friction (communicate, never badger).
 *
 * Suppression reuses the app's codified two-tier confirm opt-out
 * (mirroring src/hooks/use-confirm-dialog.tsx exactly):
 *
 *   1. Per-dialog "Don't ask again" — persisted under the SAME localStorage
 *      namespace the unified confirm uses (`confirm.<id>.suppressed`), so
 *      Settings → "Reset confirmation prompts" clears these too.
 *   2. Professional mode (useDiscovery().isProfessional) — the global
 *      Settings toggle that suppresses ALL confirmations — is honored:
 *      when ON, heavy ops run without the dialog.
 *
 * MONEY-HONESTY: every string shown here uses "typically…" framing from
 * the cost-model registry. Never an exact promise; never "free" for a
 * keyed run. "Free"/"no cost" wording appears only for paths where
 * literally nothing is billed (Mac voices, on-device AI, local render).
 *
 * Usage:
 *   const { approveHeavyOp, heavyOpDialog } = useHeavyOpApproval();
 *   const ok = await approveHeavyOp('podcastGeneration');
 *   if (!ok) return; // user cancelled — nothing ran, nothing billed
 *   ...run the op...
 *   // render {heavyOpDialog} near the call site's root
 */

import { useCallback, useMemo, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useDiscovery } from '@/hooks/use-discovery';
import {
  AI_COST_MODEL,
  describeCurrentPayer,
  type AICostOpId,
  type PayerDescription,
} from '@/lib/ai-cost-model';

// Same key shape as use-confirm-dialog.tsx (`confirm.<id>.suppressed`) so
// the existing Settings "Reset confirmation prompts" button — which clears
// every `confirm.*.suppressed` key — resets these approvals too.
function suppressKey(opId: string): string {
  return `confirm.heavyOp.${opId}.suppressed`;
}

function isSuppressed(opId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(suppressKey(opId)) === 'true';
  } catch {
    return false;
  }
}

function setSuppressed(opId: string, value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (value) window.localStorage.setItem(suppressKey(opId), 'true');
    else window.localStorage.removeItem(suppressKey(opId));
  } catch {
    /* private mode — ignore */
  }
}

interface PendingApproval {
  opId: AICostOpId;
  payer: PayerDescription;
  /** Optional per-run scope line (e.g. "Updating 2 of 5 sections…"). */
  scopeNote?: string;
  resolve: (approved: boolean) => void;
}

export interface HeavyOpApprovalOptions {
  /**
   * Honest per-run scope framing shown above the generic cost line — used by
   * selective regeneration to reflect a SMALLER-than-usual run (e.g.
   * "Updating 2 of 5 sections — unchanged sections are reused at no extra
   * cost."). Never replaces the payer/cost lines; only adds precision.
   */
  scopeNote?: string;
}

export function useHeavyOpApproval() {
  const { isProfessional } = useDiscovery();
  const [pending, setPending] = useState<PendingApproval | null>(null);
  const [dontAskAgain, setDontAskAgain] = useState(false);

  const approveHeavyOp = useCallback(
    (opId: AICostOpId, options?: HeavyOpApprovalOptions): Promise<boolean> => {
      const entry = AI_COST_MODEL[opId];
      // Only HEAVY ops ever show this dialog; anything else passes through
      // instantly (no new friction for everyday tools).
      if (!entry || entry.costClass !== 'heavy') return Promise.resolve(true);
      // Two-tier bypass, same as the unified confirm: Professional mode
      // (global) or this dialog's own "Don't ask again" (per-op).
      if (isProfessional || isSuppressed(opId)) return Promise.resolve(true);
      return new Promise<boolean>((resolve) => {
        setDontAskAgain(false);
        setPending({
          opId,
          payer: describeCurrentPayer(opId),
          scopeNote: options?.scopeNote,
          resolve,
        });
      });
    },
    [isProfessional],
  );

  const handleCancel = useCallback(() => {
    if (!pending) return;
    pending.resolve(false);
    setPending(null);
  }, [pending]);

  const handleRun = useCallback(() => {
    if (!pending) return;
    if (dontAskAgain) setSuppressed(pending.opId, true);
    pending.resolve(true);
    setPending(null);
  }, [pending, dontAskAgain]);

  const heavyOpDialog = useMemo(() => {
    if (!pending) return null;
    const entry = AI_COST_MODEL[pending.opId];
    return (
      <AlertDialog open={true} onOpenChange={(open) => !open && handleCancel()}>
        <AlertDialogContent data-testid="heavy-op-confirm" className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Run {entry.label}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {pending.scopeNote && (
                  <p data-testid="heavy-op-scope" className="font-medium text-foreground">
                    {pending.scopeNote}
                  </p>
                )}
                <p data-testid="heavy-op-payer">
                  <span className="font-medium text-foreground">Runs on:</span>{' '}
                  {pending.payer.payerLine}
                </p>
                <p data-testid="heavy-op-cost">{pending.payer.costLine}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 py-2">
            <Checkbox
              id={`heavy-op-dont-ask-${pending.opId}`}
              data-testid="heavy-op-dont-ask"
              checked={dontAskAgain}
              onCheckedChange={(v) => setDontAskAgain(v === true)}
            />
            <Label
              htmlFor={`heavy-op-dont-ask-${pending.opId}`}
              className="text-sm font-normal cursor-pointer select-none"
            >
              Don&apos;t ask again
            </Label>
          </div>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <AlertDialogCancel data-testid="heavy-op-cancel" onClick={handleCancel}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction data-testid="heavy-op-run" onClick={handleRun}>
              Run
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }, [pending, dontAskAgain, handleCancel, handleRun]);

  return { approveHeavyOp, heavyOpDialog };
}
