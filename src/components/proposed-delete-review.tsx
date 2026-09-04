'use client';

/**
 * Proposed-deletion review — the approve-before-apply gate for AI ("Tell AI")
 * deletes.
 *
 * Unlike a plain worded "shall I delete X?" confirmation, this review MARKS the
 * target node and all its descendants in the outline tree (struck-through, amber
 * "Will delete" badge — see node-item.tsx) so the user SEES exactly what will
 * vanish, in place, before anything happens. Nothing is deleted until the user
 * clicks Delete.
 *
 * It renders as a floating card anchored to the bottom of the pane rather than a
 * full-screen modal so the marked tree stays visible behind it. Matches the
 * approve/cancel interaction of the LIVE BOOKS (Refresh from Web) review.
 *
 * Built to be reusable: future "proposed change" slices (sub-outline insert,
 * Expand, etc.) can reuse this same card by passing their own title/body/labels.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ProposedDeleteReviewProps {
  open: boolean;
  /** Name of the node the user asked to delete. */
  nodeName: string;
  /** Total nodes that will be removed (the target + all descendants). */
  count: number;
  /** Names of the affected nodes (target first), for the in-card preview. */
  affectedNames: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ProposedDeleteReview({
  open,
  nodeName,
  count,
  affectedNames,
  onConfirm,
  onCancel,
}: ProposedDeleteReviewProps) {
  if (!open) return null;

  const descendants = Math.max(0, count - 1);
  const headline =
    descendants > 0
      ? `Delete "${nodeName}" and ${descendants} item${descendants === 1 ? '' : 's'} inside it?`
      : `Delete "${nodeName}"?`;

  // Show up to a handful of names so the card stays compact; the tree marks show
  // the rest in place.
  const preview = affectedNames.slice(0, 6);
  const remaining = affectedNames.length - preview.length;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-6"
      role="alertdialog"
      aria-modal="false"
      aria-label="Confirm deletion"
    >
      <div className="pointer-events-auto w-full max-w-lg rounded-xl border border-amber-300 dark:border-amber-700/60 bg-card shadow-2xl ring-1 ring-black/5">
        <div className="flex items-start gap-3 p-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-headline text-base font-semibold text-foreground">
              {headline}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              The marked items below are struck through in your outline so you can
              see exactly what will be removed. Nothing is deleted until you
              choose Delete — and you can always undo afterward.
            </p>
            {preview.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {preview.map((n, i) => (
                  <li
                    key={i}
                    className="max-w-[220px] truncate rounded-md border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-300 line-through decoration-amber-500/70"
                    title={n}
                  >
                    {n || 'Untitled'}
                  </li>
                ))}
                {remaining > 0 && (
                  <li className="px-2 py-0.5 text-xs text-muted-foreground">
                    +{remaining} more
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/30 px-4 py-3">
          <Button variant="outline" onClick={onCancel} className="gap-1.5">
            <X className="h-4 w-4" />
            Keep
          </Button>
          <Button variant="destructive" onClick={onConfirm} className="gap-1.5">
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
