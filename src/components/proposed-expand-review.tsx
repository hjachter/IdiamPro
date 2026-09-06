'use client';

/**
 * Proposed-expand review — the approve-before-apply gate for AI-generated
 * NODE CONTENT (P1 slice 3 of "Proposed Changes mode").
 *
 * When the user runs "Generate content" / "Expand" on a node, the AI text is
 * NOT written into the editor immediately. Instead this review shows a
 * before/after side-by-side — the node's CURRENT content vs. the RESULTING
 * content once the generated text is applied with the user's chosen placement
 * (replace / add to top / add to end). Nothing changes until the user clicks
 * Approve; Discard leaves the node exactly as it was.
 *
 * Unlike the structural slice-1 (delete) and slice-2 (insert) reviews — which
 * mark nodes in the tree as floating cards — content is a text change inside a
 * single node, so this mirrors the app's gold-standard content preview,
 * reformat-dialog.tsx: a modal with a two-column Before/After comparison. The
 * generated + current HTML are pre-processed by the caller (content-pane) so
 * this component is presentational only.
 *
 * As of P1 slice 4 the Before/After grid itself is the SHARED 'rewrite'
 * vocabulary from the unified Proposed Changes engine
 * (proposed-changes-review.tsx → ProposedBeforeAfter).
 */

import React from 'react';
import { ProposedBeforeAfter } from '@/components/proposed-changes-review';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Check, X } from 'lucide-react';

export type ExpandPlacement = 'append' | 'prepend' | 'replace';

interface ProposedExpandReviewProps {
  open: boolean;
  /** Name of the node whose content is being expanded. */
  nodeName: string;
  /** The node's current content, as HTML (already processed). */
  currentHtml: string;
  /** The AI-generated content, as HTML (already processed by the caller). */
  proposedHtml: string;
  /** How the generated content will be combined with the current content. */
  placement: ExpandPlacement;
  onApprove: () => void;
  onDiscard: () => void;
}

const PLACEMENT_LABEL: Record<ExpandPlacement, string> = {
  replace: 'Replaces the current content',
  prepend: 'Added to the top',
  append: 'Added to the end',
};

export default function ProposedExpandReview({
  open,
  nodeName,
  currentHtml,
  proposedHtml,
  placement,
  onApprove,
  onDiscard,
}: ProposedExpandReviewProps) {
  // Build the RESULTING content the user will end up with, honoring placement,
  // so the "After" column shows the real outcome — not just the new fragment.
  const cur = currentHtml || '';
  let resultHtml: string;
  if (placement === 'replace' || !cur.trim()) {
    resultHtml = proposedHtml;
  } else if (placement === 'prepend') {
    resultHtml = `${proposedHtml}<p></p>${cur}`;
  } else {
    resultHtml = `${cur}<p></p>${proposedHtml}`;
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDiscard(); }}>
      <DialogContent className="w-[95vw] max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Review new content
          </DialogTitle>
          <DialogDescription>
            Here&apos;s what the AI wrote for &ldquo;{nodeName || 'this item'}&rdquo;. Nothing is
            added until you approve — Discard leaves your item exactly as it is.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">{PLACEMENT_LABEL[placement]}</Badge>
              <span>Approve to keep it, or Discard to leave things unchanged.</span>
            </div>

            <ProposedBeforeAfter beforeHtml={cur} afterHtml={resultHtml} />
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onDiscard} className="gap-1.5">
            <X className="h-4 w-4" />
            Discard
          </Button>
          <Button onClick={onApprove} className="gap-1.5">
            <Check className="h-4 w-4" />
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
