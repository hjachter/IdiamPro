'use client';

/**
 * Proposed-insertion review — the approve-before-apply gate for AI-generated
 * SUB-OUTLINES (P1 slice 2 of "Proposed Changes mode").
 *
 * When the user asks the AI to generate a sub-outline under a node, the
 * generated children are inserted PROVISIONALLY and marked pending-insertion in
 * the tree (a green tint + a "Pending" badge — see node-item.tsx) so the user
 * SEES exactly what will be added, in place, before anything becomes permanent.
 * Nothing is committed until the user clicks Add; Discard removes the generated
 * children entirely, leaving the outline exactly as it was.
 *
 * Deliberately the additive sibling of proposed-delete-review.tsx: deletions read
 * as struck-through amber "Will delete"; additions read as green "Pending / Add".
 * It renders as a floating card anchored to the bottom of the pane (not a
 * full-screen modal) so the marked tree stays visible behind it, matching the
 * approve/cancel interaction language of the delete review and the LIVE BOOKS
 * (Refresh from Web) review. Built to stay reusable for slice 3 (Expand).
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Plus, X } from 'lucide-react';

interface ProposedInsertReviewProps {
  open: boolean;
  /** Name of the node the generated items will be added under. */
  parentName: string;
  /** How many items were generated. */
  count: number;
  /** Titles of the generated items, for the in-card preview. */
  itemNames: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ProposedInsertReview({
  open,
  parentName,
  count,
  itemNames,
  onConfirm,
  onCancel,
}: ProposedInsertReviewProps) {
  if (!open) return null;

  const headline =
    count > 0
      ? `Add ${count} item${count === 1 ? '' : 's'} under "${parentName}"?`
      : `Add these items under "${parentName}"?`;

  // Show up to a handful of names so the card stays compact; the tree marks show
  // the rest in place.
  const preview = itemNames.slice(0, 6);
  const remaining = itemNames.length - preview.length;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-6"
      role="alertdialog"
      aria-modal="false"
      aria-label="Confirm added items"
    >
      <div className="pointer-events-auto w-full max-w-lg rounded-xl border border-emerald-300 dark:border-emerald-700/60 bg-card shadow-2xl ring-1 ring-black/5">
        <div className="flex items-start gap-3 p-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
            <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-headline text-base font-semibold text-foreground">
              {headline}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              The new items below are highlighted in green in your outline so you
              can see exactly what will be added. Nothing is saved until you choose
              Add — and Discard removes them and leaves your outline untouched.
            </p>
            {preview.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {preview.map((n, i) => (
                  <li
                    key={i}
                    className="max-w-[220px] truncate rounded-md border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-xs text-emerald-800 dark:text-emerald-300"
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
            Discard
          </Button>
          <Button
            onClick={onConfirm}
            className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
