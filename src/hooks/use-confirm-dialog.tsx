'use client';

/**
 * useConfirmDialog — unified confirmation dialog with "Don't ask again"
 * (per-prompt) + Professional mode (global) suppression.
 *
 * Two-tier opt-out, mirroring the Discovery Hints pattern shipped 2026-06-05:
 *
 *   1. Per-dialog "Don't ask again" — checkbox at the bottom of the dialog
 *      body. When checked + the user confirms, that specific prompt
 *      (identified by `id`) is added to a persisted suppression set in
 *      localStorage. Future calls with the same id resolve immediately to
 *      "confirmed" without showing the modal.
 *
 *   2. Professional mode — single Settings toggle (existing
 *      `useDiscovery().isProfessional`). When ON, ALL confirmation prompts
 *      are bypassed globally. Turning Professional mode OFF restores any
 *      prompts that weren't permanently dismissed via the per-prompt
 *      checkbox.
 *
 *   3. "Reset confirmation prompts" — clears every per-prompt suppression
 *      so the user can roll back their opt-outs without touching
 *      Professional mode.
 *
 * Usage (typical destructive-op call site):
 *
 *   const { confirm, dialog } = useConfirmDialog();
 *
 *   const handleDelete = async () => {
 *     const ok = await confirm({
 *       id: 'confirm.deleteOutline',
 *       title: 'Delete Outline?',
 *       description: `This will permanently delete "${name}".`,
 *       confirmLabel: 'Delete',
 *       destructive: true,
 *     });
 *     if (ok) doDelete();
 *   };
 *
 *   return <>... {dialog}</>;
 *
 * `confirm()` returns a Promise<boolean>. The dialog element must be
 * rendered somewhere in the tree (typically near the call site's root).
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
import { cn } from '@/lib/utils';
import { useDiscovery } from '@/hooks/use-discovery';

const CONFIRM_SUPPRESSED_PREFIX = 'confirm.';
const CONFIRM_SUPPRESSED_SUFFIX = '.suppressed';

function suppressKey(id: string): string {
  // Stable key for localStorage. Caller-provided ids are namespaced under
  // `confirm.` so we can find and clear them all via the Reset button.
  return `${CONFIRM_SUPPRESSED_PREFIX}${id}${CONFIRM_SUPPRESSED_SUFFIX}`;
}

function isSuppressed(id: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(suppressKey(id)) === 'true';
  } catch {
    return false;
  }
}

function setSuppressed(id: string, value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (value) window.localStorage.setItem(suppressKey(id), 'true');
    else window.localStorage.removeItem(suppressKey(id));
  } catch {
    // private mode / disabled storage — ignore silently
  }
}

/** Clear every per-prompt suppression. Triggered by the Settings button. */
export function resetAllConfirmSuppressions(): number {
  if (typeof window === 'undefined') return 0;
  let cleared = 0;
  try {
    const toClear: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (k.startsWith(CONFIRM_SUPPRESSED_PREFIX) && k.endsWith(CONFIRM_SUPPRESSED_SUFFIX)) {
        toClear.push(k);
      }
    }
    for (const k of toClear) {
      window.localStorage.removeItem(k);
      cleared++;
    }
  } catch {
    // ignore
  }
  return cleared;
}

interface ConfirmOptions {
  /** Stable id used for the per-prompt suppression key. */
  id: string;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When true, the confirm button uses the destructive style. */
  destructive?: boolean;
}

interface PendingConfirm {
  opts: ConfirmOptions;
  resolve: (value: boolean) => void;
}

export function useConfirmDialog() {
  const { isProfessional } = useDiscovery();
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [dontAskAgain, setDontAskAgain] = useState(false);

  const confirm = useCallback(
    (opts: ConfirmOptions): Promise<boolean> => {
      // Two-tier bypass: per-prompt suppression OR Professional mode → resolve
      // immediately as confirmed without showing the modal.
      if (isProfessional || isSuppressed(opts.id)) {
        return Promise.resolve(true);
      }
      return new Promise<boolean>((resolve) => {
        setDontAskAgain(false);
        setPending({ opts, resolve });
      });
    },
    [isProfessional],
  );

  const handleCancel = useCallback(() => {
    if (!pending) return;
    pending.resolve(false);
    setPending(null);
  }, [pending]);

  const handleConfirm = useCallback(() => {
    if (!pending) return;
    if (dontAskAgain) setSuppressed(pending.opts.id, true);
    pending.resolve(true);
    setPending(null);
  }, [pending, dontAskAgain]);

  const dialog = useMemo(() => {
    if (!pending) return null;
    const { opts } = pending;
    return (
      <AlertDialog open={true} onOpenChange={(open) => !open && handleCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{opts.title}</AlertDialogTitle>
            {opts.description && (
              <AlertDialogDescription>{opts.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <div className="flex items-center gap-2 py-2">
            <Checkbox
              id={`confirm-dont-ask-${opts.id}`}
              checked={dontAskAgain}
              onCheckedChange={(v) => setDontAskAgain(v === true)}
            />
            <Label
              htmlFor={`confirm-dont-ask-${opts.id}`}
              className="text-sm font-normal cursor-pointer select-none"
            >
              Don&apos;t ask again
            </Label>
          </div>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <AlertDialogCancel onClick={handleCancel}>
              {opts.cancelLabel || 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={cn(
                opts.destructive && 'bg-destructive hover:bg-destructive/90',
              )}
            >
              {opts.confirmLabel || 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }, [pending, dontAskAgain, handleCancel, handleConfirm]);

  return { confirm, dialog };
}
