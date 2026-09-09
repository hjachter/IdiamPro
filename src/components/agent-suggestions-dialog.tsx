'use client';

/**
 * Agent Suggestions (P8 slice B) — the owner-facing surface for EXTERNAL
 * AGENT PROPOSALS written by the IdeaM MCP server (Claude Desktop, Claude
 * Code, any MCP client) as sidecar files next to the outlines.
 *
 * Three surfaces live here:
 *   - AgentSuggestionsDialog — the "Suggestions (N)" list (opened from the
 *     Import menu): agent label, when, and a plain-English description per
 *     proposal. Reviewing a proposal hands off to the app's UNIFIED Proposed
 *     Changes engine (green pending nodes for additions, amber struck-through
 *     marks for deletions, sky "Will move" marks for moves, before/after for
 *     rewrites). Stale proposals — the outline changed since they were made —
 *     show a plain notice and can only be dismissed.
 *   - AgentRewriteReviewDialog — the before/after comparison for a proposed
 *     rewrite (shares ProposedBeforeAfter, the engine's rewrite vocabulary).
 *   - AgentDraftPreviewDialog — preview of a proposed brand-new outline
 *     (name + top-level structure) with "Add to my outlines" / "Discard".
 *
 * Nothing in the outline ever changes from this dialog itself — approvals are
 * applied by outline-pro through the normal undo-backed state paths, and
 * every decision is written back to the sidecar so the MCP server's
 * list_proposals reflects reality.
 */

import React from 'react';
import type { Outline } from '@/types';
import {
  type AgentProposal,
  describeAgentProposal,
  agentProposalTimeAgo,
  type AgentProposalValidity,
} from '@/lib/agent-proposals';
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
import {
  Inbox,
  Plus,
  Trash2,
  MoveRight,
  Sparkles,
  FilePlus2,
  X,
  Check,
  Clock,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Suggestion list ──────────────────────────────────────────────────────────

export interface AgentSuggestionListItem {
  proposal: AgentProposal;
  validity: AgentProposalValidity;
}

const KIND_ICON: Record<string, LucideIcon> = {
  add_node: Plus,
  rewrite_node: Sparkles,
  move_node: MoveRight,
  delete_node: Trash2,
  new_outline: FilePlus2,
};

const KIND_ICON_CLASS: Record<string, string> = {
  add_node: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40',
  rewrite_node: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40',
  move_node: 'text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/40',
  delete_node: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40',
  new_outline: 'text-primary bg-primary/10',
};

interface AgentSuggestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: AgentSuggestionListItem[];
  currentOutline?: Outline;
  /** Start the standard review for a valid proposal. */
  onReview: (proposal: AgentProposal) => void;
  /** Dismiss a proposal (stale or simply unwanted) — applies nothing. */
  onDismiss: (proposal: AgentProposal) => void;
}

export function AgentSuggestionsDialog({
  open,
  onOpenChange,
  items,
  currentOutline,
  onReview,
  onDismiss,
}: AgentSuggestionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] flex flex-col" data-testid="agent-suggestions-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-primary" />
            Suggestions
          </DialogTitle>
          <DialogDescription>
            Suggestions from your AI assistants — nothing changes unless you approve it here.
            Review shows each change in place before you decide.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No suggestions waiting right now.
            </p>
          ) : (
            <ul className="space-y-2 py-2">
              {items.map(({ proposal, validity }) => {
                const Icon = KIND_ICON[proposal.kind] || Sparkles;
                const isNewOutline = proposal.kind === 'new_outline';
                return (
                  <li
                    key={proposal.id}
                    className="rounded-lg border border-border/60 p-3"
                    data-testid={`agent-suggestion-${proposal.kind}`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                          KIND_ICON_CLASS[proposal.kind] || 'bg-muted'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground">
                          {describeAgentProposal(proposal, currentOutline)}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 shrink-0" />
                          {agentProposalTimeAgo(proposal.createdAt)}
                          {proposal.targetNodePath && (
                            <span className="truncate" title={proposal.targetNodePath}>
                              · {proposal.targetNodePath}
                            </span>
                          )}
                        </p>
                        {!validity.ok && (
                          <p className="mt-1.5 flex items-center gap-1.5 rounded-md border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 text-xs text-amber-800 dark:text-amber-300">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            {validity.staleReason || 'The outline changed since this was suggested.'}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {validity.ok && (
                          <Button
                            size="sm"
                            onClick={() => onReview(proposal)}
                            className="gap-1"
                            data-testid={`agent-suggestion-review-${proposal.kind}`}
                          >
                            <Check className="h-3.5 w-3.5" />
                            {isNewOutline ? 'Preview' : 'Review'}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onDismiss(proposal)}
                          className="gap-1"
                          data-testid={`agent-suggestion-dismiss-${proposal.kind}`}
                        >
                          <X className="h-3.5 w-3.5" />
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Rewrite review (before/after — the engine's 'rewrite' vocabulary) ───────

interface AgentRewriteReviewDialogProps {
  open: boolean;
  nodeName: string;
  agent: string;
  beforeHtml: string;
  afterHtml: string;
  /** Present only when the proposal also renames the item. */
  newName?: string;
  onApprove: () => void;
  onReject: () => void;
}

export function AgentRewriteReviewDialog({
  open,
  nodeName,
  agent,
  beforeHtml,
  afterHtml,
  newName,
  onApprove,
  onReject,
}: AgentRewriteReviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onReject(); }}>
      <DialogContent className="w-[95vw] max-w-3xl max-h-[85vh] flex flex-col" data-testid="agent-rewrite-review">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Review suggested change
          </DialogTitle>
          <DialogDescription>
            {agent || 'An AI assistant'} suggests this change to &ldquo;{nodeName || 'this item'}&rdquo;.
            Nothing changes until you approve — Reject leaves your item exactly as it is.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-3 py-2">
            {newName !== undefined && newName !== nodeName && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary">Rename</Badge>
                <span className="text-muted-foreground line-through">{nodeName || 'Untitled'}</span>
                <MoveRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium text-foreground">{newName}</span>
              </div>
            )}
            <ProposedBeforeAfter beforeHtml={beforeHtml} afterHtml={afterHtml} />
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onReject} className="gap-1.5">
            <X className="h-4 w-4" />
            Reject
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

// ── New-outline draft preview ────────────────────────────────────────────────

interface AgentDraftPreviewDialogProps {
  open: boolean;
  agent: string;
  draft: Outline | null;
  onAdd: () => void;
  onDiscard: () => void;
}

export function AgentDraftPreviewDialog({
  open,
  agent,
  draft,
  onAdd,
  onDiscard,
}: AgentDraftPreviewDialogProps) {
  // Top-level structure: the root's direct children (names + child counts).
  const topLevel = React.useMemo(() => {
    if (!draft) return [] as { name: string; childCount: number }[];
    const root = draft.nodes[draft.rootNodeId];
    if (!root) return [];
    return (root.childrenIds || [])
      .map((id) => draft.nodes[id])
      .filter(Boolean)
      .map((n) => ({ name: n.name || 'Untitled', childCount: (n.childrenIds || []).length }));
  }, [draft]);

  const nodeCount = draft ? Object.keys(draft.nodes || {}).length : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDiscard(); }}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[85vh] flex flex-col" data-testid="agent-draft-preview">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FilePlus2 className="h-5 w-5 text-primary" />
            New outline suggested
          </DialogTitle>
          <DialogDescription>
            {agent || 'An AI assistant'} drafted a brand-new outline. It stays out of your
            outlines until you add it — Discard leaves everything untouched.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-3 py-2">
            <div className="rounded-lg border border-border/60 p-3">
              <p className="font-headline text-base font-semibold text-foreground">
                {draft?.name || 'Untitled outline'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {nodeCount} item{nodeCount === 1 ? '' : 's'} in total
              </p>
              {topLevel.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {topLevel.slice(0, 8).map((n, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-foreground">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                      <span className="truncate">{n.name}</span>
                      {n.childCount > 0 && (
                        <span className="text-xs text-muted-foreground">({n.childCount})</span>
                      )}
                    </li>
                  ))}
                  {topLevel.length > 8 && (
                    <li className="text-xs text-muted-foreground">+{topLevel.length - 8} more sections</li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onDiscard} className="gap-1.5">
            <X className="h-4 w-4" />
            Discard
          </Button>
          <Button onClick={onAdd} className="gap-1.5" data-testid="agent-draft-add">
            <Plus className="h-4 w-4" />
            Add to my outlines
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
