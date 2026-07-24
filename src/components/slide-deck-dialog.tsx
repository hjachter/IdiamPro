'use client';

/**
 * Slide Deck dialog (2026-07-24) — "Turn Into a Slide Deck".
 *
 * Turns the selected BRANCH (a node + its sub-points — the same "chapter" scope
 * Generate Video / Export Email use) into a real PowerPoint (.pptx) file. One
 * export serves everyone: .pptx opens natively in Microsoft PowerPoint AND
 * imports cleanly into Apple Keynote (which can then Save As .key).
 *
 * Lives in the "Turn Into" output family alongside Generate Video / Export Email
 * / Share to Social. Unlike those, this is fully DETERMINISTIC — it builds the
 * deck straight from the outline text with pptxgenjs, so it never calls the AI
 * meter. Every slide is branded to match the app (dark on-brand background,
 * accent bar, native IdeaM logo mark), and numeric/percentage content is
 * auto-turned into a native, still-editable bar chart.
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
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Presentation, Loader2, AlertTriangle, Download, CheckCircle2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { NodeMap } from '@/types';
import { deriveDeck } from '@/lib/deck/derive-deck';
import { buildDeckPptx, deckFileName } from '@/lib/deck/build-pptx';
import { ACCENT_PRESETS, loadVideoStyle } from '@/lib/video/video-style';

interface SlideDeckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: NodeMap | null;
  /** Root of the branch to turn into a deck — the SELECTED node. */
  rootNodeId: string | null;
  scopeLabel?: string;
  outlineName?: string;
}

type Phase = 'configure' | 'running' | 'done' | 'error';

export default function SlideDeckDialog({
  open,
  onOpenChange,
  nodes,
  rootNodeId,
  scopeLabel,
  outlineName,
}: SlideDeckDialogProps) {
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>('configure');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Brand look — defaults to the user's saved Generate Video style so decks and
  // videos stay visually consistent. Theme + accent are the only picks; the logo
  // mark is drawn natively so nothing to upload.
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [accent, setAccent] = useState<string>('#3898ff');
  const [brandLabel, setBrandLabel] = useState<string>('IdeaM');
  const [includeArc, setIncludeArc] = useState<boolean>(true);

  useEffect(() => {
    if (!open) return;
    const s = loadVideoStyle();
    setTheme(s.theme);
    setAccent(s.accent);
    setBrandLabel(s.brandLabel || 'IdeaM');
    setIncludeArc(true);
    setPhase('configure');
    setErrorMsg(null);
  }, [open]);

  // Live deck model (for the slide-count preview and to detect charts).
  const deck = useMemo(() => {
    if (!nodes || !rootNodeId || !nodes[rootNodeId]) return null;
    return deriveDeck(nodes, rootNodeId, outlineName, { includeArc });
  }, [nodes, rootNodeId, outlineName, includeArc]);

  const slideCount = deck?.slides.length ?? 0;
  const chartCount = deck?.slides.filter((s) => s.kind === 'section' && !!s.chart).length ?? 0;

  const handleClose = () => onOpenChange(false);

  const handleGenerate = async () => {
    if (!deck || slideCount === 0) return;
    setPhase('running');
    setErrorMsg(null);
    try {
      const pptx = await buildDeckPptx(deck, { theme, accent, brandLabel: brandLabel.trim() || 'IdeaM' });
      await pptx.writeFile({ fileName: deckFileName(deck.name) });
      setPhase('done');
      toast({ title: 'Slide deck ready', description: 'Open it in PowerPoint or Keynote.' });
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setErrorMsg(`The slide deck couldn't be created. ${raw ? `Reason: ${raw}.` : ''}`);
      setPhase('error');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent className="w-[95vw] max-w-lg" data-testid="slide-deck-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Presentation className="h-5 w-5" />
            Slide Deck
          </DialogTitle>
          <DialogDescription>
            {scopeLabel
              ? `Turns "${scopeLabel}" into a branded PowerPoint deck — opens in PowerPoint or Keynote.`
              : 'Select a branch first — a section and its sub-points.'}
          </DialogDescription>
        </DialogHeader>

        {(phase === 'configure' || phase === 'error') && (
          <div className="space-y-4 py-2">
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              {slideCount > 0 ? (
                <>
                  <span className="font-medium">{slideCount} slides</span>
                  <span className="text-muted-foreground">
                    {' '}· one per section, with a title and closing slide
                    {chartCount > 0 ? ` · ${chartCount} auto-chart${chartCount > 1 ? 's' : ''} from your data` : ''}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">This branch has no content to turn into slides.</span>
              )}
            </div>

            <TooltipProvider delayDuration={300}>
              <div className="space-y-4">
                {/* Theme */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Theme</Label>
                  <div className="inline-flex rounded-md border p-0.5">
                    {(['dark', 'light'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTheme(t)}
                        className={`px-4 py-1.5 text-sm rounded-[5px] capitalize transition-colors ${
                          theme === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Accent */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Accent</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    {ACCENT_PRESETS.map((p) => {
                      const selected = accent.toLowerCase() === p.hex.toLowerCase();
                      return (
                        <Tooltip key={p.hex}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label={p.name}
                              onClick={() => setAccent(p.hex)}
                              className={`h-7 w-7 rounded-full transition-transform hover:scale-110 focus:outline-none ${
                                selected ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground' : ''
                              }`}
                              style={{ backgroundColor: p.hex }}
                            >
                              {selected && <Check className="h-4 w-4 mx-auto text-white drop-shadow" />}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{p.name}</TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>

                {/* Arc diagram */}
                <label htmlFor="deck-arc" className="flex items-start gap-2.5 rounded-md border p-2.5 cursor-pointer hover:bg-accent/50 transition-colors">
                  <Checkbox id="deck-arc" checked={includeArc} onCheckedChange={(c) => setIncludeArc(!!c)} className="mt-0.5" />
                  <span className="grid gap-0.5">
                    <span className="text-sm font-medium leading-none">Include the arc diagram</span>
                    <span className="text-xs text-muted-foreground">A clean thought → idea → produce → publish slide.</span>
                  </span>
                </label>
              </div>
            </TooltipProvider>

            {errorMsg && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="inline h-4 w-4 mr-1" />
                {errorMsg}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              The deck is built from your outline — no AI, no cost. Slides stay fully editable in PowerPoint or Keynote.
            </p>
          </div>
        )}

        {phase === 'running' && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Building your slide deck…</p>
          </div>
        )}

        {phase === 'done' && (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="text-sm font-medium">Your slide deck is ready</p>
            <p className="text-xs text-muted-foreground">
              Saved to your Downloads. Double-click to open in PowerPoint, or drag it into Keynote.
            </p>
          </div>
        )}

        <DialogFooter>
          {(phase === 'configure' || phase === 'error') && (
            <>
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleGenerate} disabled={slideCount === 0}>
                <Download className="h-4 w-4 mr-1" />
                {phase === 'error' ? 'Try again' : 'Create deck'}
              </Button>
            </>
          )}
          {phase === 'running' && (
            <Button disabled>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Building…
            </Button>
          )}
          {phase === 'done' && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
