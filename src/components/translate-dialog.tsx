'use client';

/**
 * Translate dialog (#52 language translation) — plugs into the same
 * transform engine + preview/approve UX as LIVE BOOKS, but for language
 * translation instead of web refresh. No web grounding, no citations.
 *
 * UX:
 *   1. "configure" phase — user picks target language, optionally toggles
 *      local AI, and runs the translation.
 *   2. "preview" phase  — per-node side-by-side diff with accept/reject
 *      and a single Apply button. User-edited nodes are shown skipped
 *      with a per-node "include anyway" override.
 *
 * Nothing touches the outline until Apply is clicked.
 */

import React, { useMemo, useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Languages, Loader2, Check, X, Lock, AlertTriangle, Cpu } from 'lucide-react';
import type {
  Outline,
  TransformPreview,
  NodeTransformProposal,
} from '@/types';
import {
  runTransformPreview,
  applyTransformPreview,
  collectSubtree,
} from '@/lib/transforms/transform-engine';
import { createTranslateTransformer } from '@/lib/transforms/translate-transform';
import { useAIUsageGate } from '@/lib/use-ai-usage-gate';
import DerivationChoice, { type DerivationMode } from './derivation-choice';
import { suggestTranslateLabel } from '@/lib/derivation/label-from-prompt';

interface TranslateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outline: Outline | null;
  selectedNodeId: string | null;
  /** Called with the new node map after the user approves + applies.
   *  The derivation field (2026-06-10) tells the parent whether to apply
   *  in-place (Translate's default) or create a new derivative outline. */
  onApply: (nextNodes: Outline['nodes'], derivation?: { mode: DerivationMode; label: string }) => void;
}

// Language list ordering — promotes the languages of globally-distributed
// teams IdeaM is positioned for (Howard's marketing line: "Built for
// teams from Boston to Shanghai to São Paulo"). The top group covers the
// largest cross-border collaboration languages; the rest follows in a
// roughly population-weighted order. English is included for back-translation.
const LANGUAGES = [
  // Top group — global-team priorities
  'Chinese (Simplified)', 'Portuguese (Brazilian)', 'Spanish', 'French',
  'Japanese', 'Korean', 'German', 'Italian', 'Hindi',
  // Wider catalog
  'Chinese (Traditional)', 'Portuguese (European)', 'Dutch', 'Russian',
  'Polish', 'Arabic', 'Hebrew', 'Turkish', 'Indonesian', 'Vietnamese',
  'Thai', 'English',
];

type Phase = 'configure' | 'running' | 'preview' | 'applying';

export default function TranslateDialog({
  open,
  onOpenChange,
  outline,
  selectedNodeId,
  onApply,
}: TranslateDialogProps) {
  const { gate } = useAIUsageGate();
  const [phase, setPhase] = useState<Phase>('configure');
  // Empty string = "no language picked yet" — forces the user to choose
  // rather than accidentally accepting a silent default.
  const [targetLanguage, setTargetLanguage] = useState<string>('');
  const [useLocal, setUseLocal] = useState<boolean>(false);
  const [preview, setPreview] = useState<TransformPreview | null>(null);
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const [includeUserEdited, setIncludeUserEdited] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Translate is the ONE transform whose default is in-place — translating
  // is content-preserving per language; the user already chose the target
  // language and expects replacement. Derivative is still offered as opt-in.
  const [derivationMode, setDerivationMode] = useState<DerivationMode>('inplace');
  const [derivationLabel, setDerivationLabel] = useState<string>('');

  const scopeNode = outline && selectedNodeId ? outline.nodes[selectedNodeId] : null;
  const scopeSize = useMemo(() => {
    if (!outline || !selectedNodeId) return 0;
    return collectSubtree(outline.nodes, selectedNodeId).length;
  }, [outline, selectedNodeId]);

  const handleClose = () => {
    setPhase('configure');
    setPreview(null);
    setRejected(new Set());
    setIncludeUserEdited(new Set());
    setErrorMsg(null);
    setTargetLanguage('');
    setDerivationMode('inplace');
    setDerivationLabel('');
    onOpenChange(false);
  };

  const handleRun = async () => {
    if (!outline || !selectedNodeId) return;

    // Tier-enforcement gate (#33): translating any number of nodes = ONE
    // generation (1 user-initiated AI action).
    if (!gate({ feature: 'translate' })) return;

    setPhase('running');
    setErrorMsg(null);
    try {
      const transformer = createTranslateTransformer({
        targetLanguage,
        useLocal,
      });
      const result = await runTransformPreview(
        outline.nodes,
        selectedNodeId,
        transformer,
        { kind: 'translate', updateMode: 'overwrite', includeUserEdited, autoApply: false },
        {
          model: useLocal ? 'Local' : 'Gemini',
          modelProvider: useLocal ? 'local' : 'cloud',
          webGrounded: false,
        },
      );
      setPreview(result);
      setPhase('preview');
    } catch (e) {
      // Conversational error tone (per project-natural-language-error-tone):
      // wrap raw errors in plain language so the user sees an explanation,
      // not a stack trace or CLI-style message.
      const raw = e instanceof Error ? e.message : String(e);
      setErrorMsg(
        `The translation didn't go through. ${raw ? `Reason: ${raw}. ` : ''}You can try again, switch to local AI, or check your API key in Settings.`
      );
      setPhase('configure');
    }
  };

  const handleApply = () => {
    if (!preview || !outline) return;
    setPhase('applying');
    const approved = new Set<string>();
    for (const proposal of preview.proposals) {
      if (rejected.has(proposal.nodeId)) continue;
      if (proposal.skipped || proposal.error || !proposal.changed) continue;
      approved.add(proposal.nodeId);
    }
    const { nodes: nextNodes } = applyTransformPreview(outline.nodes, preview, approved);
    onApply(nextNodes, {
      mode: derivationMode,
      label: (derivationLabel.trim() || suggestTranslateLabel(targetLanguage)) || 'Translated',
    });
    handleClose();
  };

  const toggleReject = (nodeId: string) => {
    setRejected(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const toggleIncludeUserEdited = (nodeId: string) => {
    setIncludeUserEdited(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const proposalsChanged = preview?.proposals.filter(p => p.changed && !p.skipped && !p.error) || [];
  const proposalsSkipped = preview?.proposals.filter(p => p.skipped) || [];
  const proposalsErrored = preview?.proposals.filter(p => p.error) || [];
  const acceptCount = proposalsChanged.filter(p => !rejected.has(p.nodeId)).length;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent className="w-[95vw] max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            Translate this section
          </DialogTitle>
          <DialogDescription>
            {scopeNode ? (
              scopeSize > 1
                ? `Translates "${scopeNode.name}" and its ${scopeSize - 1} descendant${scopeSize - 1 === 1 ? '' : 's'}${targetLanguage ? ` into ${targetLanguage}` : ''}. You'll review each translated node before anything changes.`
                : `Translates "${scopeNode.name}"${targetLanguage ? ` into ${targetLanguage}` : ''}. You'll review the result before anything changes.`
            ) : 'No node selected.'}
          </DialogDescription>
        </DialogHeader>

        {phase === 'configure' && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Translate into</Label>
              <select
                value={targetLanguage}
                onChange={(e) => {
                  const lang = e.target.value;
                  setTargetLanguage(lang);
                  // Auto-suggest a label only if user hasn't typed one of their own.
                  if (!derivationLabel.trim()) {
                    setDerivationLabel(suggestTranslateLabel(lang));
                  }
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                aria-label="Target language"
              >
                <option value="" disabled>Pick a language…</option>
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">
                Formatting is preserved (headings, lists, bold, links). Proper nouns and code stay as-is.
              </p>
            </div>

            <DerivationChoice
              mode={derivationMode}
              onModeChange={setDerivationMode}
              label={derivationLabel}
              onLabelChange={setDerivationLabel}
              idPrefix="translate"
              transformName="Translate"
              currentOutlineName={outline?.name}
            />

            <div className="flex items-start gap-2 pt-2">
              <Checkbox
                id="translate-local"
                checked={useLocal}
                onCheckedChange={(c) => setUseLocal(!!c)}
              />
              <div className="grid gap-1">
                <Label htmlFor="translate-local" className="text-sm font-medium cursor-pointer">
                  <Cpu className="inline h-3.5 w-3.5 mr-1" />
                  Use local AI (Ollama)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Slower but private — translation runs entirely on your machine.
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="inline h-4 w-4 mr-1" />
                {errorMsg}
              </div>
            )}
          </div>
        )}

        {phase === 'running' && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Translating into {targetLanguage}…
            </p>
          </div>
        )}

        {phase === 'preview' && preview && (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">{preview.model}</Badge>
                <span>
                  {proposalsChanged.length} translated · {proposalsSkipped.length} skipped · {proposalsErrored.length} errored
                </span>
              </div>

              {proposalsChanged.map(p => {
                const isRejected = rejected.has(p.nodeId);
                return (
                  <div
                    key={p.nodeId}
                    className={`rounded-lg border p-3 ${isRejected ? 'border-muted bg-muted/30 opacity-60' : 'border-border'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">
                        {p.ancestorPath.length > 0 && (
                          <span className="text-muted-foreground">
                            {p.ancestorPath.join(' › ')} ›{' '}
                          </span>
                        )}
                        {p.nodeName}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleReject(p.nodeId)}
                      >
                        {isRejected ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                        <span className="ml-1 text-xs">{isRejected ? 'Restore' : 'Reject'}</span>
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="rounded border border-border/50 p-2 bg-background/50">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Before</div>
                        <div
                          className="prose prose-xs dark:prose-invert max-w-none line-clamp-6"
                          dangerouslySetInnerHTML={{ __html: p.beforeContent || '<em>(empty)</em>' }}
                        />
                      </div>
                      <div className="rounded border border-primary/30 p-2 bg-primary/5">
                        <div className="text-xs uppercase tracking-wide text-primary mb-1">After ({targetLanguage})</div>
                        <div
                          className="prose prose-xs dark:prose-invert max-w-none line-clamp-6"
                          dangerouslySetInnerHTML={{ __html: p.afterContent || '<em>(empty)</em>' }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {proposalsSkipped.length > 0 && (
                <>
                  <Separator />
                  <div className="text-xs font-medium text-muted-foreground">
                    Skipped (you manually edited these — translate anyway?)
                  </div>
                  {proposalsSkipped.map(p => (
                    <div key={p.nodeId} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Lock className="h-3 w-3 text-amber-600" />
                          <span>{p.nodeName}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => toggleIncludeUserEdited(p.nodeId)}
                        >
                          Include anyway
                        </Button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {proposalsErrored.length > 0 && (
                <>
                  <Separator />
                  <div className="text-xs font-medium text-destructive">
                    Errored
                  </div>
                  {proposalsErrored.map(p => (
                    <div key={p.nodeId} className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs">
                      <div className="font-medium">{p.nodeName}</div>
                      <div className="text-muted-foreground">{p.error}</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          {phase === 'configure' && (
            <>
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleRun} disabled={!scopeNode || !targetLanguage}>
                <Languages className="h-4 w-4 mr-1" />
                Translate & preview
              </Button>
            </>
          )}
          {phase === 'preview' && (
            <>
              <Button variant="ghost" onClick={handleClose}>Discard</Button>
              <Button onClick={handleApply} disabled={acceptCount === 0}>
                Apply {acceptCount} {acceptCount === 1 ? 'translation' : 'translations'}
              </Button>
            </>
          )}
          {phase === 'applying' && (
            <Button disabled>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Applying…
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
