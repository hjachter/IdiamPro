'use client';

/**
 * Transform outline with AI dialog.
 *
 * Whole-subtree counterpart to ReformatDialog. Where Reformat operates on
 * a SINGLE NODE's HTML content, this dialog asks the AI to transform the
 * SHAPE of a subtree (add / remove / rename / merge / move nodes) per a
 * plain-language instruction.
 *
 * Scope rule (set by the caller via rootNodeId):
 *   - Node selected → the selected node + everything beneath it
 *   - No node selected → the outline's root + everything beneath it
 *
 * UX phases:
 *   1. 'input'   — text field + example chips + (optional) large-scope warning.
 *   2. 'running' — spinner while the AI works.
 *   3. 'preview' — summary line + change counts + before/after structural
 *                  tree view. Apply / Modify / Cancel.
 *
 * Counts as 1 AI generation (one transform = one call regardless of subtree
 * size). NOT a Pro-only feature.
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
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Sparkles, Loader2, AlertTriangle, Cpu, ArrowLeft, Wand2 } from 'lucide-react';
import { transformOutlineAction } from '@/app/actions';
import {
  serializeSubtree,
  type SerializedNode,
  type TransformOutlineResult,
} from '@/ai/flows/transform-outline';
import { getUserApiKey } from '@/lib/byok-keys';
import { useAIUsageGate } from '@/lib/use-ai-usage-gate';
import type { NodeMap } from '@/types';

interface TransformOutlineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whole node map of the current outline. */
  nodes: NodeMap | null;
  /** Root of the subtree to transform — selected node, or the outline's root. */
  rootNodeId: string | null;
  /** Friendly label for the scope ("current outline" or the selected node's name). */
  scopeLabel: string;
  /** Display name of the current outline (for context in the prompt). */
  outlineName?: string;
  /** Called with a result the parent can merge back via mergeTransformedSubtreeIntoOutline. */
  onApply: (result: {
    transformedNodes: Record<string, SerializedNode>;
    rootNodeId: string;
  }) => void;
  /** Optional override threshold for the "large subtree" warning (default 2000). */
  largeScopeThreshold?: number;
}

type Phase = 'input' | 'running' | 'preview';

// Six diverse example chips — each demonstrates a different KIND of transform
// (reorganize, merge, promote, restructure, dedupe, extract) so the user
// understands the breadth of what's possible.
const EXAMPLE_CHIPS = [
  'Reorganize alphabetically by name',
  'Merge chapters with fewer than three children into a Misc chapter',
  'Promote leaf nodes about [topic] to top-level chapters',
  'Convert each paragraph node into a heading with its body as a child',
  'Deduplicate near-duplicate nodes',
  'Extract everything tagged [tag] into its own new chapter',
];

export default function TransformOutlineDialog({
  open,
  onOpenChange,
  nodes,
  rootNodeId,
  scopeLabel,
  outlineName,
  onApply,
  largeScopeThreshold = 2000,
}: TransformOutlineDialogProps) {
  const { gate } = useAIUsageGate();
  const [phase, setPhase] = useState<Phase>('input');
  const [instruction, setInstruction] = useState('');
  const [useLocal, setUseLocal] = useState(false);
  const [result, setResult] = useState<TransformOutlineResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Count the nodes in scope (root + descendants) so we can warn for very
  // large subtrees BEFORE the AI is called. Memoized — recomputed only when
  // the inputs change, not on every render.
  const subtreeCount = useMemo(() => {
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

  const isLargeScope = subtreeCount > largeScopeThreshold;

  // Reset every time the dialog opens fresh.
  useEffect(() => {
    if (open) {
      setPhase('input');
      setInstruction('');
      setResult(null);
      setErrorMsg(null);
    }
  }, [open]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleRun = async () => {
    if (!nodes || !rootNodeId) {
      setErrorMsg("I don't have an outline to transform. Open an outline first.");
      return;
    }
    const cleanInstruction = instruction.trim();
    if (!cleanInstruction) {
      setErrorMsg('Tell me what should change — for example, "reorganize alphabetically by name".');
      return;
    }

    // Tier-enforcement gate: one transform = 1 generation regardless of subtree size.
    if (!gate({ feature: 'transformOutline' })) return;

    setErrorMsg(null);
    setPhase('running');

    try {
      const { subtreeNodes } = serializeSubtree(nodes, rootNodeId);
      const userApiKey = getUserApiKey('gemini');
      const r = await transformOutlineAction({
        subtreeNodes,
        rootNodeId,
        instruction: cleanInstruction,
        currentOutlineName: outlineName,
        useLocal,
        userApiKey,
      });

      if (r.error) {
        // Conversational error tone (per project-natural-language-error-tone).
        setErrorMsg(
          `I couldn't transform the outline. ${r.error} You can try a different wording, switch to local AI, or check your API key in Settings.`,
        );
        setPhase('input');
        return;
      }

      if (!r.changed) {
        setErrorMsg(
          "The AI thought the structure already matched what you asked for and didn't change anything. Try a more specific instruction.",
        );
        setPhase('input');
        return;
      }

      setResult(r);
      setPhase('preview');
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setErrorMsg(
        `The transform didn't go through. ${raw ? `Reason: ${raw}. ` : ''}You can try again, switch to local AI, or check your API key in Settings.`,
      );
      setPhase('input');
    }
  };

  const handleApply = () => {
    if (!result || !rootNodeId) return;
    onApply({
      transformedNodes: result.transformedNodes,
      rootNodeId,
    });
    handleClose();
  };

  const handleModify = () => {
    setPhase('input');
    // Keep the instruction so the user can tweak it.
  };

  const statsLine = (r: TransformOutlineResult) => {
    const parts: string[] = [];
    if (r.stats.added) parts.push(`add ${r.stats.added}`);
    if (r.stats.removed) parts.push(`remove ${r.stats.removed}`);
    if (r.stats.renamed) parts.push(`rename ${r.stats.renamed}`);
    if (r.stats.moved) parts.push(`move ${r.stats.moved}`);
    if (parts.length === 0) return 'No structural changes.';
    return `I'll ${parts.join(', ')} ${parts.length === 1 ? 'node' : 'nodes'}.`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent className="w-[95vw] max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Transform outline
          </DialogTitle>
          <DialogDescription>
            Tell me how to transform {scopeLabel}. I&apos;ll show you the result before applying.
          </DialogDescription>
        </DialogHeader>

        {phase === 'input' && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="transform-instruction" className="text-sm font-medium">
                Describe how to transform it
              </Label>
              <Input
                id="transform-instruction"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="e.g. reorganize alphabetically by name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleRun();
                  }
                }}
                autoFocus
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {EXAMPLE_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setInstruction(chip)}
                    className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {isLargeScope && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <AlertTriangle className="inline h-4 w-4 mr-1 text-amber-600" />
                This is a big subtree — {subtreeCount.toLocaleString()} nodes. Transformations on
                very large subtrees can be unreliable. You can still proceed, but selecting a
                smaller scope first usually gives a better result.
              </div>
            )}

            <div className="flex items-start gap-2 pt-1">
              <Checkbox
                id="transform-local"
                checked={useLocal}
                onCheckedChange={(c) => setUseLocal(!!c)}
              />
              <div className="grid gap-1">
                <Label htmlFor="transform-local" className="text-sm font-medium cursor-pointer">
                  <Cpu className="inline h-3.5 w-3.5 mr-1" />
                  Use local AI (Ollama)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Slower but private — the transform runs entirely on your machine.
                </p>
              </div>
            </div>

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
        )}

        {phase === 'running' && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Transforming the outline…
            </p>
          </div>
        )}

        {phase === 'preview' && result && (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-3 py-2">
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="flex items-center gap-2 text-sm mb-1">
                  {result.model && <Badge variant="secondary">{result.model}</Badge>}
                  <span className="font-medium">{statsLine(result)}</span>
                </div>
                {result.summary && (
                  <p className="text-sm text-muted-foreground">{result.summary}</p>
                )}
              </div>

              <Separator />

              {nodes && rootNodeId && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border/60 p-3 bg-background/50">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Before</div>
                    <SubtreeView
                      nodes={asSerializedMap(nodes)}
                      rootNodeId={rootNodeId}
                      diffAgainst={result.transformedNodes}
                      perspective="before"
                    />
                  </div>
                  <div className="rounded-lg border border-primary/40 p-3 bg-primary/5">
                    <div className="text-[10px] uppercase tracking-wide text-primary mb-2">After</div>
                    <SubtreeView
                      nodes={result.transformedNodes}
                      rootNodeId={rootNodeId}
                      diffAgainst={asSerializedMap(nodes)}
                      perspective="after"
                    />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          {phase === 'input' && (
            <>
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleRun} disabled={!instruction.trim() || !rootNodeId}>
                <Sparkles className="h-4 w-4 mr-1" />
                Preview transform
              </Button>
            </>
          )}
          {phase === 'preview' && (
            <>
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button variant="outline" onClick={handleModify}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Modify instruction
              </Button>
              <Button onClick={handleApply}>
                Apply
              </Button>
            </>
          )}
          {phase === 'running' && (
            <Button disabled>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Transforming…
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Internal tree-view rendering ─────────────────────────────────────────

/** Map a NodeMap into the SerializedNode shape so the before/after views
 *  share one rendering code path. */
function asSerializedMap(nodes: NodeMap): Record<string, SerializedNode> {
  const out: Record<string, SerializedNode> = {};
  for (const [id, n] of Object.entries(nodes)) {
    out[id] = {
      id: n.id,
      name: n.name,
      content: n.content,
      type: n.type,
      parentId: n.parentId,
      childrenIds: n.childrenIds || [],
    };
  }
  return out;
}

interface SubtreeViewProps {
  nodes: Record<string, SerializedNode>;
  rootNodeId: string;
  diffAgainst: Record<string, SerializedNode>;
  perspective: 'before' | 'after';
}

/**
 * Recursive structural tree view. Color codes per perspective:
 *   - 'before': nodes that won't exist in 'after' are red (removed)
 *   - 'after':  nodes that didn't exist in 'before' are green (added),
 *               nodes whose name changed are amber (renamed),
 *               nodes whose parent changed are blue (moved)
 */
function SubtreeView({ nodes, rootNodeId, diffAgainst, perspective }: SubtreeViewProps) {
  const classify = (id: string): { label: string; cls: string } | null => {
    const here = nodes[id];
    const there = diffAgainst[id];
    if (perspective === 'before') {
      if (!there) return { label: 'removed', cls: 'text-red-600 dark:text-red-400 line-through' };
      return null;
    }
    // perspective === 'after'
    if (!there) return { label: 'new', cls: 'text-emerald-600 dark:text-emerald-400 font-medium' };
    if (here.name !== there.name) return { label: 'renamed', cls: 'text-amber-600 dark:text-amber-400' };
    if (here.parentId !== there.parentId) return { label: 'moved', cls: 'text-blue-600 dark:text-blue-400' };
    return null;
  };

  const renderNode = (id: string, depth: number): React.ReactElement | null => {
    const n = nodes[id];
    if (!n) return null;
    const tag = classify(id);
    return (
      <div key={id} className="text-xs">
        <div
          className={`flex items-baseline gap-1 py-0.5 ${tag?.cls || 'text-foreground'}`}
          style={{ paddingLeft: depth * 12 }}
        >
          <span className="text-muted-foreground">›</span>
          <span className="truncate">{n.name || '(untitled)'}</span>
          {tag && (
            <span className="ml-1 text-[10px] uppercase tracking-wide opacity-70">
              {tag.label}
            </span>
          )}
        </div>
        {(n.childrenIds || []).map(childId => renderNode(childId, depth + 1))}
      </div>
    );
  };

  return <div className="max-h-72 overflow-auto">{renderNode(rootNodeId, 0)}</div>;
}
