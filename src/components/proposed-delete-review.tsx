'use client';

/**
 * Proposed-deletion review — the approve-before-apply gate for AI ("Tell AI")
 * deletes (P1 slice 1 of "Proposed Changes mode").
 *
 * Unlike a plain worded "shall I delete X?" confirmation, this review MARKS the
 * target node and all its descendants in the outline tree (struck-through, amber
 * "Will delete" badge — see node-item.tsx) so the user SEES exactly what will
 * vanish, in place, before anything happens. Nothing is deleted until the user
 * clicks Delete.
 *
 * As of P1 slice 4 this is a thin config over the unified Proposed Changes
 * engine (proposed-changes-review.tsx, kind 'deletion') — the shared floating
 * card + shared amber/struck-through vocabulary.
 */

import React from 'react';
import ProposedChangesReview from '@/components/proposed-changes-review';

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
  const descendants = Math.max(0, count - 1);
  const headline =
    descendants > 0
      ? `Delete "${nodeName}" and ${descendants} item${descendants === 1 ? '' : 's'} inside it?`
      : `Delete "${nodeName}"?`;

  return (
    <ProposedChangesReview
      open={open}
      kind="deletion"
      ariaLabel="Confirm deletion"
      headline={headline}
      body="The marked items below are struck through in your outline so you can see exactly what will be removed. Nothing is deleted until you choose Delete — and you can always undo afterward."
      chipNames={affectedNames}
      confirmLabel="Delete"
      cancelLabel="Keep"
      onConfirm={() => onConfirm()}
      onCancel={onCancel}
    />
  );
}
