'use client';

/**
 * Summarize Outline dialog (2026-07-22).
 *
 * A one-click "give me the GIST" wizard action. Detailed captures — an
 * imported video transcript, a comprehensive book outline — end up with so
 * many bullets that the point gets buried. Summarize distills the CURRENT
 * outline down to its key points as a short, well-organized nested outline
 * (short node names as tree labels, the essential detail in each node's
 * content).
 *
 * Reuses the existing Transform Outline AI pipeline rather than a new one:
 * we serialize the outline's whole subtree, hand the AI a fixed
 * "condense into a gist" instruction (tuned by a Brief / Standard depth
 * toggle), and merge the result back exactly like Transform does. That
 * means it inherits the same node-ID contract, the same Gemini/Ollama
 * provider handling with automatic fallback, and the same
 * derivative-vs-in-place apply path.
 *
 * Output choice (via the shared DerivationChoice block):
 *   - DEFAULT "Save as new outline" — writes the gist into a brand-new
 *     outline named "<Original> — Summary", leaving the original untouched.
 *   - "Replace this outline" — overwrites the current outline in place.
 *     Because that is destructive, we require a brief confirmation
 *     (AlertDialog) before applying, matching the app's confirm pattern.
 *
 * Counts as 1 AI generation (gated through useAIUsageGate with feature key
 * 'summarizeOutline'). NOT a Pro-only feature. Respects the AI Provider
 * setting, the consent flow, and tier/generation limits exactly like the
 * sibling AI wizard actions.
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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sparkles, Loader2, AlertTriangle, Cpu, ArrowLeft, ListTree } from 'lucide-react';
import { transformOutlineAction } from '@/app/actions';
import { isLocalAIReachable, notifyLocalAIDown } from '@/lib/local-ai';
import { serializeSubtree } from '@/lib/transform-outline-helpers';
import type { SerializedNode, TransformOutlineResult } from '@/ai/flows/transform-outline';
import { getUserApiKey } from '@/lib/byok-keys';
import { useAIUsageGate } from '@/lib/use-ai-usage-gate';
import { useVoiceProfile } from '@/lib/use-voice-profile';
import { useSourceVerifier } from '@/lib/ai/use-source-verifier';
import { nodesToPlainText } from '@/lib/ai/hallucination-verifier';
import AiQualityCheckNote from '@/components/ai-quality-check-note';
import type { NodeMap } from '@/types';
import DerivationChoice, { type DerivationMode } from './derivation-choice';

interface SummarizeOutlineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whole node map of the current outline. */
  nodes: NodeMap | null;
  /** Root of the outline to summarize (always the outline's root). */
  rootNodeId: string | null;
  /** Display name of the current outline (for the prompt + derivative name). */
  outlineName?: string;
  /** Called with a result the parent merges via mergeTransformedSubtreeIntoOutline.
   *  Same shape Transform Outline uses, so the parent reuses one handler. */
  onApply: (result: {
    transformedNodes: Record<string, SerializedNode>;
    rootNodeId: string;
    derivation: { mode: DerivationMode; label: string };
  }) => void;
}

type Phase = 'input' | 'running' | 'preview';
type Depth = 'brief' | 'standard';

/** Fixed instruction handed to the Transform pipeline, tuned by depth. */
function buildSummarizeInstruction(depth: Depth): string {
  if (depth === 'brief') {
    return [
      'Condense this entire outline into a VERY BRIEF gist — only the handful',
      'of most important points. Aggressively remove supporting detail,',
      'examples, repetition, and filler. Produce a SHALLOW outline (one or two',
      'levels deep) whose node names are short 2-5 word tree labels, with a',
      'single concise sentence of the essential point in each node\'s content.',
      'Merge or delete redundant nodes. The result MUST be dramatically shorter',
      'than the original so the reader instantly sees the point.',
    ].join(' ');
  }
  return [
    'Summarize this entire outline into a concise gist that captures the key',
    'points and main structure while dropping supporting detail, examples, and',
    'repetition. Produce a shallow, well-organized outline whose node names are',
    'short 2-5 word tree labels, with the essential detail as one or two',
    'sentences in each node\'s content. Merge or delete redundant nodes. The',
    'result should be clearly shorter than the original — the reader should',
    'quickly grasp the point without wading through every bullet.',
  ].join(' ');
}

export default function SummarizeOutlineDialog({
  open,
  onOpenChange,
  nodes,
  rootNodeId,
  outlineName,
  onApply,
}: SummarizeOutlineDialogProps) {
  const { gate } = useAIUsageGate();
  // "Your Voice" — offer to write the summary's content in the user's own style.
  const { voiceAvailable, voiceProfile } = useVoiceProfile();
  // Always-on hallucination verifier — checks the gist against the original
  // outline on-device ($0, off the cloud meter).
  const verifier = useSourceVerifier();
  const [phase, setPhase] = useState<Phase>('input');
  const [depth, setDepth] = useState<Depth>('standard');
  const [inMyVoice, setInMyVoice] = useState(false);
  const [useLocal, setUseLocal] = useState(false);
  const [result, setResult] = useState<TransformOutlineResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Non-destructive by default: a summary is best kept as a new outline so the
  // detailed original survives. In-place is opt-in and confirmed.
  const [derivationMode, setDerivationMode] = useState<DerivationMode>('derivative');
  const [derivationLabel, setDerivationLabel] = useState<string>('Summary');
  // Confirmation gate for the destructive in-place replace.
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);

  // Count of nodes in the current outline, for the "shrunk from X to Y" line.
  const originalCount = useMemo(() => {
    if (!nodes || !rootNodeId) return 0;
    let n = 0;
    const walk = (id: string) => {
      const node = nodes[id];
      if (!node) return;
      n++;
      for (const childId of node.childrenIds || []) walk(childId);
    };
    walk(rootNodeId);
    return n;
  }, [nodes, rootNodeId]);

  const summaryCount = result ? Object.keys(result.transformedNodes).length : 0;

  useEffect(() => {
    if (open) {
      setPhase('input');
      setDepth('standard');
      setInMyVoice(false);
      setResult(null);
      setErrorMsg(null);
      setDerivationMode('derivative');
      setDerivationLabel('Summary');
      setConfirmReplaceOpen(false);
      verifier.reset();
    }
  }, [open]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleRun = async () => {
    if (!nodes || !rootNodeId) {
      setErrorMsg("I don't have an outline to summarize. Open an outline first.");
      return;
    }

    // Tier-enforcement gate: one summarize = 1 generation.
    if (!gate({ feature: 'summarizeOutline' })) return;

    // On-device AI selected but the engine is down → calm one-click notice.
    if (useLocal && !(await isLocalAIReachable())) {
      await notifyLocalAIDown({ onRetry: () => { void handleRun(); } });
      return;
    }

    setErrorMsg(null);
    setPhase('running');

    try {
      const { subtreeNodes } = serializeSubtree(nodes, rootNodeId);
      const userApiKey = getUserApiKey('gemini');
      const useVoice = inMyVoice && voiceAvailable;
      const instruction = useVoice
        ? `${buildSummarizeInstruction(depth)} Write the content of each node in the user's own writing voice as described in the voice profile.`
        : buildSummarizeInstruction(depth);
      const r = await transformOutlineAction({
        subtreeNodes,
        rootNodeId,
        instruction,
        currentOutlineName: outlineName,
        voiceProfile: useVoice ? voiceProfile.trim() : undefined,
        useLocal,
        userApiKey,
      });

      if (r.error) {
        setErrorMsg(
          `I couldn't summarize the outline. ${r.error} You can try again, switch to local AI, or check your API key in Settings.`,
        );
        setPhase('input');
        return;
      }

      if (!r.changed || Object.keys(r.transformedNodes).length === 0) {
        setErrorMsg(
          "The AI didn't manage to condense the outline this time. Try again, or switch the depth to Brief for a tighter gist.",
        );
        setPhase('input');
        return;
      }

      setResult(r);
      setPhase('preview');
      // Always-on verification: check the produced gist against the original.
      if (nodes && rootNodeId) {
        void verifier.run(
          nodesToPlainText(nodes, rootNodeId),
          nodesToPlainText(r.transformedNodes, r.transformedRootId),
          'outline summary',
        );
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setErrorMsg(
        `The summary didn't go through. ${raw ? `Reason: ${raw}. ` : ''}You can try again, switch to local AI, or check your API key in Settings.`,
      );
      setPhase('input');
    }
  };

  const commitApply = (mode: DerivationMode) => {
    if (!result || !rootNodeId) return;
    onApply({
      transformedNodes: result.transformedNodes,
      rootNodeId,
      derivation: {
        mode,
        label: derivationLabel.trim() || 'Summary',
      },
    });
    handleClose();
  };

  const handleApply = () => {
    if (!result || !rootNodeId) return;
    if (derivationMode === 'inplace') {
      // Destructive — confirm first (matches the app's confirm pattern).
      setConfirmReplaceOpen(true);
      return;
    }
    commitApply('derivative');
  };

  const handleModify = () => {
    setPhase('input');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListTree className="h-5 w-5" />
              Summarize outline
            </DialogTitle>
            <DialogDescription>
              Distill {outlineName ? `"${outlineName}"` : 'the current outline'} down to its key
              points — a short, well-organized gist instead of every bullet.
            </DialogDescription>
          </DialogHeader>

          {phase === 'input' && (
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">How short?</Label>
                  <RadioGroup
                    value={depth}
                    onValueChange={(v) => setDepth(v as Depth)}
                    className="gap-2"
                  >
                    <div className="flex items-start gap-2">
                      <RadioGroupItem value="standard" id="summarize-standard" className="mt-1" />
                      <Label htmlFor="summarize-standard" className="font-normal cursor-pointer flex-1">
                        <span className="font-medium">Standard gist</span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Key points with a little structure. A solid at-a-glance overview.
                        </p>
                      </Label>
                    </div>
                    <div className="flex items-start gap-2">
                      <RadioGroupItem value="brief" id="summarize-brief" className="mt-1" />
                      <Label htmlFor="summarize-brief" className="font-normal cursor-pointer flex-1">
                        <span className="font-medium">Brief</span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Just the handful of most important points. Maximum compression.
                        </p>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {voiceAvailable && (
                  <div className="flex items-start gap-2 pt-1">
                    <Checkbox
                      id="summarize-in-my-voice"
                      data-testid="summarize-in-my-voice"
                      checked={inMyVoice}
                      onCheckedChange={(c) => setInMyVoice(!!c)}
                    />
                    <div className="grid gap-1">
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Label htmlFor="summarize-in-my-voice" className="text-sm font-medium cursor-pointer">
                              <Sparkles className="inline h-3.5 w-3.5 mr-1" />
                              In my voice
                            </Label>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            Write the summary in your own writing style, learned from your samples in Settings &rarr; Professional Customization &rarr; Your Voice.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <p className="text-xs text-muted-foreground">
                        Uses your saved voice profile so the summary sounds like you.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2 pt-1">
                  <Checkbox
                    id="summarize-local"
                    checked={useLocal}
                    onCheckedChange={(c) => setUseLocal(!!c)}
                  />
                  <div className="grid gap-1">
                    <Label htmlFor="summarize-local" className="text-sm font-medium cursor-pointer">
                      <Cpu className="inline h-3.5 w-3.5 mr-1" />
                      Use local AI (Ollama)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Slower but private — the summary runs entirely on your machine.
                    </p>
                  </div>
                </div>

                <DerivationChoice
                  mode={derivationMode}
                  onModeChange={setDerivationMode}
                  label={derivationLabel}
                  onLabelChange={setDerivationLabel}
                  idPrefix="summarize"
                  transformName="Summarize"
                  currentOutlineName={outlineName}
                />

                {errorMsg && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertTriangle className="inline h-4 w-4 mr-1" />
                    {errorMsg}
                  </div>
                )}

                <p className="text-xs text-muted-foreground pt-1">
                  Counts as 1 AI generation. Cancel or close to skip.
                </p>
              </div>
            </ScrollArea>
          )}

          {phase === 'running' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Distilling the key points…
              </p>
            </div>
          )}

          {phase === 'preview' && result && (
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-3 py-2">
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-center gap-2 text-sm mb-1 flex-wrap">
                    {result.model && <Badge variant="secondary">{result.model}</Badge>}
                    <span className="font-medium">
                      Gist ready — {originalCount} nodes → {summaryCount}.
                    </span>
                  </div>
                  {result.summary && (
                    <p className="text-sm text-muted-foreground">{result.summary}</p>
                  )}
                </div>

                <AiQualityCheckNote verifying={verifier.verifying} result={verifier.result} />

                <Separator />

                <div className="rounded-lg border border-primary/40 p-3 bg-primary/5">
                  <div className="text-[10px] uppercase tracking-wide text-primary mb-2">
                    Summary preview
                  </div>
                  <SummaryTree nodes={result.transformedNodes} rootNodeId={result.transformedRootId} />
                </div>
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            {phase === 'input' && (
              <>
                <Button variant="ghost" onClick={handleClose}>Cancel</Button>
                <Button onClick={handleRun} disabled={!rootNodeId}>
                  <Sparkles className="h-4 w-4 mr-1" />
                  Summarize
                </Button>
              </>
            )}
            {phase === 'preview' && (
              <>
                <Button variant="ghost" onClick={handleClose}>Cancel</Button>
                <Button variant="outline" onClick={handleModify}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Adjust
                </Button>
                <Button onClick={handleApply}>
                  {derivationMode === 'inplace' ? 'Replace outline' : 'Create summary'}
                </Button>
              </>
            )}
            {phase === 'running' && (
              <Button disabled>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Summarizing…
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Destructive in-place confirmation. */}
      <AlertDialog open={confirmReplaceOpen} onOpenChange={setConfirmReplaceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Replace this outline with the summary?
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-2">
              This overwrites {outlineName ? `"${outlineName}"` : 'the current outline'} in place with
              the shorter summary — the original detail will be gone. Your outline auto-snapshots
              first and Cmd+Z still undoes it, but if you want to keep the detail, choose
              &quot;Save as new outline&quot; instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmReplaceOpen(false); commitApply('inplace'); }}>
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Compact read-only tree view of the produced summary ────────────────────

interface SummaryTreeProps {
  nodes: Record<string, SerializedNode>;
  rootNodeId: string;
}

function SummaryTree({ nodes, rootNodeId }: SummaryTreeProps) {
  const renderNode = (id: string, depth: number): React.ReactElement | null => {
    const n = nodes[id];
    if (!n) return null;
    return (
      <div key={id} className="text-xs">
        <div
          className="flex items-baseline gap-1 py-0.5 text-foreground"
          style={{ paddingLeft: depth * 12 }}
        >
          <span className="text-muted-foreground">›</span>
          <span className="truncate font-medium">{n.name || '(untitled)'}</span>
        </div>
        {(n.childrenIds || []).map((childId) => renderNode(childId, depth + 1))}
      </div>
    );
  };

  return <div className="max-h-72 overflow-auto">{renderNode(rootNodeId, 0)}</div>;
}
