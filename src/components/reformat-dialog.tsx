'use client';

/**
 * Reformat dialog (Reformat with AI… feature).
 *
 * Pattern: single-shot transform of one HTML fragment per a plain-language
 * instruction. Unlike LIVE BOOKS / Translate, this does NOT touch the
 * transform engine — it operates on exactly one piece of content the
 * caller hands in, returns one reformatted piece of content via onApply.
 *
 * Scope is decided by the caller:
 *   - Whole-node:  pass the node's full content HTML, replace the whole
 *                  node on Apply.
 *   - Selection:   pass the selected HTML, replace just the selection on
 *                  Apply.
 *
 * UX phases:
 *   1. "input"   — text field + example chips. User describes the format.
 *   2. "running" — spinner while the AI works.
 *   3. "preview" — side-by-side before/after; Apply or Modify or Cancel.
 *
 * Counts as 1 AI generation (gated through useAIUsageGate with feature
 * key 'reformat'). NOT a Pro-only feature.
 */

import React, { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
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
import { WandSparkles, Loader2, AlertTriangle, Cpu, ArrowLeft } from 'lucide-react';
import { reformatContentAction } from '@/app/actions';
import { getUserApiKey } from '@/lib/byok-keys';
import { useAIUsageGate } from '@/lib/use-ai-usage-gate';

interface ReformatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** HTML the user wants reformatted (whole node OR a selection). */
  contentHtml: string;
  /** Label shown in the header — "this node" or "your selection". */
  scopeLabel?: string;
  /** Called when the user clicks Apply with the new HTML. */
  onApply: (newHtml: string) => void;
}

type Phase = 'input' | 'running' | 'preview';

const EXAMPLE_CHIPS = [
  'Turn into a bulleted list',
  'Make each line a heading',
  'Convert to a markdown table',
  'Tighten spacing and remove empty lines',
  'Add headings where it makes sense',
  'Convert to clean prose',
];

// Same Tiptap-safe subset the AI flow constrains to.
const SANITIZE_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'strong', 'em', 'code', 'pre', 'br', 'blockquote', 'hr', 'a'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
};

function sanitize(html: string): string {
  if (typeof window === 'undefined') return html;
  // Cast through `unknown` because @types/dompurify drifts between minor
  // versions — the runtime accepts our config shape; the type does not.
  return DOMPurify.sanitize(html, SANITIZE_CONFIG as unknown as Parameters<typeof DOMPurify.sanitize>[1]);
}

export default function ReformatDialog({
  open,
  onOpenChange,
  contentHtml,
  scopeLabel,
  onApply,
}: ReformatDialogProps) {
  const { gate } = useAIUsageGate();
  const [phase, setPhase] = useState<Phase>('input');
  const [instruction, setInstruction] = useState('');
  const [useLocal, setUseLocal] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [modelLabel, setModelLabel] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset state every time the dialog opens fresh.
  useEffect(() => {
    if (open) {
      setPhase('input');
      setInstruction('');
      setPreviewHtml('');
      setModelLabel('');
      setErrorMsg(null);
    }
  }, [open]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleRun = async () => {
    const cleanInstruction = instruction.trim();
    if (!cleanInstruction) {
      setErrorMsg('Tell me what kind of format you want — e.g. "turn into a bulleted list".');
      return;
    }

    // Tier-enforcement gate (#33): one reformat call = 1 generation.
    if (!gate({ feature: 'reformat' })) return;

    setErrorMsg(null);
    setPhase('running');

    try {
      const userApiKey = getUserApiKey('gemini');
      const result = await reformatContentAction({
        contentHtml,
        instruction: cleanInstruction,
        useLocal,
        userApiKey,
      });

      if (result.error) {
        // Conversational error tone (per project-natural-language-error-tone).
        setErrorMsg(
          `I couldn't reformat that. ${result.error}. You can try a different wording, switch to local AI, or check your API key in Settings.`
        );
        setPhase('input');
        return;
      }

      if (!result.changed) {
        setErrorMsg(
          'The model thought the content was already in that format and didn\'t change anything. Try a more specific instruction.'
        );
        setPhase('input');
        return;
      }

      setPreviewHtml(sanitize(result.content));
      setModelLabel(result.model);
      setPhase('preview');
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setErrorMsg(
        `The reformat didn't go through. ${raw ? `Reason: ${raw}. ` : ''}You can try again, switch to local AI, or check your API key in Settings.`
      );
      setPhase('input');
    }
  };

  const handleApply = () => {
    if (!previewHtml) return;
    onApply(previewHtml);
    handleClose();
  };

  const handleModify = () => {
    setPhase('input');
    // Keep the instruction so the user can tweak it.
  };

  const scopeText = scopeLabel ? ` in ${scopeLabel}` : '';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent className="w-[95vw] max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WandSparkles className="h-5 w-5" />
            Reformat content
          </DialogTitle>
          <DialogDescription>
            Tell me how to reformat what&apos;s{scopeText} (or the selected text). I&apos;ll show you the result before applying.
          </DialogDescription>
        </DialogHeader>

        {phase === 'input' && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="reformat-instruction" className="text-sm font-medium">
                Describe the format you want
              </Label>
              <Input
                id="reformat-instruction"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="e.g. turn into a bulleted list"
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

            <div className="flex items-start gap-2 pt-1">
              <Checkbox
                id="reformat-local"
                checked={useLocal}
                onCheckedChange={(c) => setUseLocal(!!c)}
              />
              <div className="grid gap-1">
                <Label htmlFor="reformat-local" className="text-sm font-medium cursor-pointer">
                  <Cpu className="inline h-3.5 w-3.5 mr-1" />
                  Use local AI (Ollama)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Slower but private — the reformat runs entirely on your machine.
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
              Reformatting…
            </p>
          </div>
        )}

        {phase === 'preview' && (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {modelLabel && <Badge variant="secondary">{modelLabel}</Badge>}
                <span>Here&apos;s how it&apos;ll look. Apply to keep it, or modify the instruction to try again.</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-border/60 p-3 bg-background/50">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Before</div>
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitize(contentHtml) || '<em>(empty)</em>' }}
                  />
                </div>
                <div className="rounded-lg border border-primary/40 p-3 bg-primary/5">
                  <div className="text-[10px] uppercase tracking-wide text-primary mb-2">After</div>
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: previewHtml || '<em>(empty)</em>' }}
                  />
                </div>
              </div>
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          {phase === 'input' && (
            <>
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleRun} disabled={!instruction.trim()}>
                <WandSparkles className="h-4 w-4 mr-1" />
                Preview reformat
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
              Reformatting…
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
