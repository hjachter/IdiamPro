'use client';

/**
 * LIVE BOOKS dialog — manual AI refresh of a node + its descendants, with a
 * mandatory preview/approve gate.
 *
 * Phases:
 *  1. "configure" — user picks merge vs overwrite (Q7), can opt into
 *     auto-apply (Q2, off by default), and runs the refresh.
 *  2. "preview"   — per-node diff with accept/reject (Q2). User-edited nodes
 *     are shown as skipped with a per-node "include anyway" override (Q5).
 *     Citations (Q4) + model attribution (Q6) shown per node.
 *
 * Nothing touches the user's outline until they click Apply (unless they
 * deliberately enabled auto-apply before running).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  RefreshCw,
  Globe,
  Loader2,
  Check,
  X,
  Lock,
  AlertTriangle,
  ExternalLink,
  Cpu,
} from 'lucide-react';
import type {
  Outline,
  TransformPreview,
  TransformUpdateMode,
} from '@/types';
import {
  runTransformPreview,
  applyTransformPreview,
} from '@/lib/transforms/transform-engine';
import { createRefreshTransformer } from '@/lib/transforms/refresh-transform';
import { useToast } from '@/hooks/use-toast';
import { useAIUsageGate } from '@/lib/use-ai-usage-gate';

interface LiveBooksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outline: Outline | undefined;
  selectedNodeId: string | null;
  /** Persist the refreshed node map back to the outline. */
  onApply: (nextNodes: Outline['nodes']) => void;
  /** Force local Ollama (no web grounding / no citations). */
  useLocalAI?: boolean;
}

type Phase = 'configure' | 'running' | 'preview';

function plainText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>(\n)?/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export default function LiveBooksDialog({
  open,
  onOpenChange,
  outline,
  selectedNodeId,
  onApply,
  useLocalAI = false,
}: LiveBooksDialogProps) {
  const { toast } = useToast();
  const { gate } = useAIUsageGate();

  const [phase, setPhase] = useState<Phase>('configure');
  const [updateMode, setUpdateMode] = useState<TransformUpdateMode>('merge');
  const [autoApply, setAutoApply] = useState(false);
  const [preview, setPreview] = useState<TransformPreview | null>(null);
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [includeUserEdited, setIncludeUserEdited] = useState<Set<string>>(new Set());

  const targetNode = useMemo(() => {
    if (!outline || !selectedNodeId) return null;
    return outline.nodes[selectedNodeId] || null;
  }, [outline, selectedNodeId]);

  const isRootSelected = targetNode && outline && targetNode.id === outline.rootNodeId;

  // Reset everything when the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setPhase('configure');
      setUpdateMode('merge');
      setAutoApply(false);
      setPreview(null);
      setApproved(new Set());
      setIncludeUserEdited(new Set());
    }
  }, [open]);

  const runRefresh = async () => {
    if (!outline || !selectedNodeId) return;

    // Tier-enforcement gate (#33): a LIVE BOOKS refresh of any number of
    // descendants = ONE generation (1 user-initiated AI action).
    if (!gate({ feature: 'liveBooks' })) return;

    setPhase('running');

    const transformer = createRefreshTransformer({
      updateMode,
      useLocal: useLocalAI,
    });

    try {
      const result = await runTransformPreview(
        outline.nodes,
        selectedNodeId,
        transformer,
        {
          kind: 'refresh',
          updateMode,
          includeUserEdited,
          autoApply,
        },
        // Provenance is filled per-proposal by the transformer; these are the
        // run-level defaults (overwritten by the first real proposal below).
        {
          model: useLocalAI ? 'Local' : 'Gemini',
          modelProvider: useLocalAI ? 'local' : 'cloud',
          webGrounded: !useLocalAI,
        }
      );

      // result.webGrounded / result.model already reflect the model that
      // ACTUALLY ran (the engine adopts true attribution, covering a
      // cloud→local fallback). Build an honest grounding note from it.
      const enriched: TransformPreview = {
        ...result,
        webGroundingNote: result.webGrounded
          ? 'Refreshed using live Google Search grounding. The listed sources are the real pages the model retrieved.'
          : 'No live web grounding was used (local AI or grounding unavailable). This refresh relied on the model’s built-in knowledge and produced no web citations.',
      };

      setPreview(enriched);

      // Pre-approve every node that has a real, non-skipped change.
      const autoApprovedIds = new Set(
        enriched.proposals
          .filter(p => p.changed && !p.skipped && !p.error)
          .map(p => p.nodeId)
      );
      setApproved(autoApprovedIds);

      if (autoApply) {
        const { nodes, appliedCount } = applyTransformPreview(
          outline.nodes,
          enriched,
          autoApprovedIds
        );
        onApply(nodes);
        toast({
          title: 'Refresh from Web — auto-applied',
          description: `${appliedCount} node${appliedCount === 1 ? '' : 's'} refreshed and applied automatically.`,
        });
        onOpenChange(false);
        return;
      }

      setPhase('preview');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Refresh failed';
      toast({
        title: 'Refresh from Web failed',
        description: message,
        variant: 'destructive',
      });
      setPhase('configure');
    }
  };

  const toggleApproved = (nodeId: string) => {
    setApproved(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const includeSkipped = (nodeId: string) => {
    setIncludeUserEdited(prev => new Set(prev).add(nodeId));
    toast({
      title: 'Will include on next run',
      description: 'Re-run the refresh to update this user-edited node.',
    });
  };

  const applyApproved = () => {
    if (!outline || !preview) return;
    const { nodes, appliedCount } = applyTransformPreview(
      outline.nodes,
      preview,
      approved
    );
    if (appliedCount === 0) {
      toast({
        title: 'Nothing applied',
        description: 'No nodes were approved.',
      });
      return;
    }
    onApply(nodes);
    toast({
      title: 'Refresh from Web applied',
      description: `${appliedCount} node${appliedCount === 1 ? '' : 's'} refreshed.`,
    });
    onOpenChange(false);
  };

  const changedProposals = preview?.proposals.filter(p => p.changed && !p.skipped && !p.error) || [];
  const skippedProposals = preview?.proposals.filter(p => p.skipped) || [];
  const unchangedProposals = preview?.proposals.filter(p => !p.changed && !p.skipped && !p.error) || [];
  const erroredProposals = preview?.proposals.filter(p => p.error) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-emerald-500" />
            Refresh from Web
          </DialogTitle>
          <DialogDescription>
            {isRootSelected
              ? 'Refreshes the entire outline against the latest information.'
              : targetNode
                ? `Refreshes "${targetNode.name}" and all of its descendants.`
                : 'Select a node to refresh.'}
          </DialogDescription>
        </DialogHeader>

        {/* CONFIGURE PHASE */}
        {phase === 'configure' && (
          <div className="space-y-5 overflow-y-auto">
            <div className="space-y-2">
              <Label className="text-sm font-medium">How should content be updated?</Label>
              <RadioGroup
                value={updateMode}
                onValueChange={(v) => setUpdateMode(v as TransformUpdateMode)}
              >
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="merge" id="lb-merge" className="mt-1" />
                  <Label htmlFor="lb-merge" className="font-normal cursor-pointer">
                    <span className="font-medium">Merge &amp; augment</span> (recommended)
                    <p className="text-xs text-muted-foreground">
                      Keep still-accurate content, correct what&apos;s outdated, fold in new
                      developments. Preserves the original structure.
                    </p>
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="overwrite" id="lb-overwrite" className="mt-1" />
                  <Label htmlFor="lb-overwrite" className="font-normal cursor-pointer">
                    <span className="font-medium">Overwrite / regenerate from scratch</span>
                    <p className="text-xs text-muted-foreground">
                      Discard the old content and write each section fresh.
                    </p>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            <div className="flex items-start gap-2">
              <Checkbox
                id="lb-autoapply"
                checked={autoApply}
                onCheckedChange={(c) => setAutoApply(c === true)}
                className="mt-1"
              />
              <Label htmlFor="lb-autoapply" className="font-normal cursor-pointer">
                <span className="font-medium">Apply automatically without previewing</span>
                <p className="text-xs text-muted-foreground">
                  Off by default. When off, you&apos;ll review every change and approve
                  per node before anything is modified.
                </p>
              </Label>
            </div>

            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p className="flex items-center gap-1.5">
                {useLocalAI ? <Cpu className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
                {useLocalAI
                  ? 'Local AI: no live internet — refresh uses the model’s knowledge, no citations.'
                  : 'Cloud AI: real web grounding — refreshed nodes get real source citations.'}
              </p>
              <p className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                Nodes you edited by hand are skipped automatically (you can include them per node).
              </p>
            </div>
          </div>
        )}

        {/* RUNNING PHASE */}
        {phase === 'running' && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            <p className="text-sm text-muted-foreground">
              Refreshing content against the latest information…
            </p>
          </div>
        )}

        {/* PREVIEW PHASE */}
        {phase === 'preview' && preview && (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              <span>{changedProposals.length} proposed change(s)</span>
              <span>{unchangedProposals.length} already up to date</span>
              <span>{skippedProposals.length} skipped (you edited)</span>
              {erroredProposals.length > 0 && (
                <span className="text-destructive">{erroredProposals.length} failed</span>
              )}
            </div>
            {preview.webGroundingNote && (
              <p className="text-xs text-muted-foreground italic">
                {preview.webGroundingNote}
              </p>
            )}

            <ScrollArea className="flex-1 pr-3">
              <div className="space-y-3">
                {changedProposals.map(p => (
                  <div key={p.nodeId} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{p.nodeName}</p>
                        {p.ancestorPath.length > 0 && (
                          <p className="text-xs text-muted-foreground truncate">
                            {p.ancestorPath.join(' › ')}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={approved.has(p.nodeId) ? 'default' : 'outline'}
                        onClick={() => toggleApproved(p.nodeId)}
                        className="shrink-0"
                      >
                        {approved.has(p.nodeId) ? (
                          <><Check className="h-3.5 w-3.5 mr-1" /> Accepted</>
                        ) : (
                          <><X className="h-3.5 w-3.5 mr-1" /> Rejected</>
                        )}
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                          Before
                        </p>
                        <div className="text-xs whitespace-pre-wrap max-h-32 overflow-y-auto bg-muted/40 rounded p-2">
                          {plainText(p.beforeContent) || <em className="text-muted-foreground">(empty)</em>}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-emerald-600 mb-1">
                          After
                        </p>
                        <div className="text-xs whitespace-pre-wrap max-h-32 overflow-y-auto bg-emerald-500/5 rounded p-2">
                          {plainText(p.afterContent)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-[10px]">
                        Refreshed with {preview.model}
                      </Badge>
                      {p.citations.length > 0 ? (
                        <span className="text-[11px] text-muted-foreground">
                          {p.citations.length} source{p.citations.length === 1 ? '' : 's'}:
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">
                          No web sources
                        </span>
                      )}
                      {p.citations.slice(0, 4).map((c, i) => (
                        <a
                          key={i}
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-blue-600 hover:underline inline-flex items-center gap-0.5 max-w-[180px] truncate"
                          title={c.url}
                        >
                          {c.title || new URL(c.url).hostname.replace('www.', '')}
                          <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                ))}

                {skippedProposals.length > 0 && (
                  <>
                    <Separator />
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5" />
                      Skipped — you edited these by hand
                    </p>
                    {skippedProposals.map(p => (
                      <div key={p.nodeId} className="rounded-md border border-dashed p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{p.nodeName}</p>
                          <p className="text-xs text-muted-foreground">{p.skipReason}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={includeUserEdited.has(p.nodeId)}
                          onClick={() => includeSkipped(p.nodeId)}
                          className="shrink-0"
                        >
                          {includeUserEdited.has(p.nodeId) ? 'Will include' : 'Include anyway'}
                        </Button>
                      </div>
                    ))}
                  </>
                )}

                {erroredProposals.length > 0 && (
                  <>
                    <Separator />
                    <p className="text-xs font-medium text-destructive flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Could not refresh
                    </p>
                    {erroredProposals.map(p => (
                      <div key={p.nodeId} className="rounded-md border border-destructive/30 p-2">
                        <p className="text-sm font-medium truncate">{p.nodeName}</p>
                        <p className="text-xs text-destructive">{p.error}</p>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter className="gap-2">
          {phase === 'configure' && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={runRefresh}
                disabled={!targetNode}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <RefreshCw className="h-4 w-4 mr-1.5" />
                {autoApply ? 'Refresh & apply' : 'Refresh & preview'}
              </Button>
            </>
          )}
          {phase === 'preview' && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Discard
              </Button>
              <Button
                onClick={applyApproved}
                disabled={approved.size === 0}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Check className="h-4 w-4 mr-1.5" />
                Apply {approved.size} approved
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
