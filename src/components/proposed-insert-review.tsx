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
 * As of P1 slice 4 this is a thin config over the unified Proposed Changes
 * engine (proposed-changes-review.tsx, kind 'insertion') — the shared floating
 * card + shared green "Pending" vocabulary.
 */

import React from 'react';
import ProposedChangesReview from '@/components/proposed-changes-review';

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
  const headline =
    count > 0
      ? `Add ${count} item${count === 1 ? '' : 's'} under "${parentName}"?`
      : `Add these items under "${parentName}"?`;

  return (
    <ProposedChangesReview
      open={open}
      kind="insertion"
      ariaLabel="Confirm added items"
      headline={headline}
      body="The new items below are highlighted in green in your outline so you can see exactly what will be added. Nothing is saved until you choose Add — and Discard removes them and leaves your outline untouched."
      chipNames={itemNames}
      confirmLabel="Add"
      cancelLabel="Discard"
      onConfirm={() => onConfirm()}
      onCancel={onCancel}
    />
  );
}
