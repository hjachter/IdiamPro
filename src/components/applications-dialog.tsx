'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ChevronLeft, Sparkles } from 'lucide-react';
import { APPLICATIONS, type ApplicationRecipe } from '@/lib/applications/registry';
import type { AIDepth, AITone, AILevel } from '@/types';

/** Answers the guided dialogue collects, mapped onto the real pipeline params. */
export interface WizardAnswers {
  topic: string;
  depth?: AIDepth;
  tone?: AITone;
  level?: AILevel;
  customize?: string;
}

interface ApplicationsDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onRun: (recipe: ApplicationRecipe, opts: WizardAnswers) => Promise<void>;
  runningId: string | null;
  /**
   * Opens an existing, fully-built engine dialog (website / podcast / video)
   * on the current outline. Called for engine-launcher wizard cards.
   */
  onLaunchEngine: (engine: 'website' | 'podcast' | 'video') => void;
}

// Friendly, audience-facing labels that map DIRECTLY onto the pipeline params.
const DEPTH_OPTIONS: { value: AIDepth; label: string }[] = [
  { value: 'quick', label: 'Quick overview' },
  { value: 'standard', label: 'Standard' },
  { value: 'deep', label: 'Deep dive' },
];
const TONE_OPTIONS: { value: AITone; label: string }[] = [
  { value: 'academic', label: 'Academic' },
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'storytelling', label: 'Storytelling' },
];
const AUDIENCE_OPTIONS: { value: AILevel; label: string }[] = [
  { value: 'elementary', label: 'Beginners' },
  { value: 'high-school', label: 'General readers' },
  { value: 'college', label: 'College' },
  { value: 'graduate', label: 'Advanced' },
  { value: 'expert', label: 'Experts' },
];

export default function ApplicationsDialog({
  open,
  onOpenChange,
  onRun,
  runningId,
  onLaunchEngine,
}: ApplicationsDialogProps) {
  const [selected, setSelected] = useState<ApplicationRecipe | null>(null);
  // Which coming-soon card the user just tapped — shows a small inline note.
  // Never opens a config flow and never triggers any AI or cost.
  const [notedId, setNotedId] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [depth, setDepth] = useState<AIDepth>('standard');
  const [tone, setTone] = useState<AITone>('professional');
  const [level, setLevel] = useState<AILevel>('college');
  const [customize, setCustomize] = useState('');

  // Reset the guided dialogue whenever the dialog is (re)opened or closed.
  useEffect(() => {
    if (!open) {
      setSelected(null);
      setNotedId(null);
      setTopic('');
      setDepth('standard');
      setTone('professional');
      setLevel('college');
      setCustomize('');
    }
  }, [open]);

  const isRunning = !!runningId;
  // The full guided form only applies to the live Automatic Book wizard; the
  // preview wizards get just the topic question so the structure feels
  // consistent.
  const isBook = selected?.id === 'automatic-book';

  const handleRun = async () => {
    if (!selected) return;
    if (selected.needsTopic && !topic.trim()) return;
    await onRun(selected, {
      topic,
      depth: isBook ? depth : undefined,
      tone: isBook ? tone : undefined,
      level: isBook ? level : undefined,
      customize: isBook ? customize : undefined,
    });
  };

  const goBack = () => {
    if (isRunning) return;
    setSelected(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        {selected === null ? (
          // ── GALLERY VIEW ─────────────────────────────────────────────
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Wizards
              </DialogTitle>
              <DialogDescription>
                One click runs the whole recipe — no buttons to babysit.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
              {APPLICATIONS.map((app) => {
                const isLive = app.status === 'live';
                return (
                  <button
                    key={app.id}
                    type="button"
                    // Three click behaviors:
                    //  • engine-launcher live card -> open the existing engine
                    //    dialog on the current outline (Website/Podcast/Video)
                    //  • generator live card -> open the guided config view
                    //  • coming-soon card -> inert; only shows a small note.
                    //    Never opens a flow, never calls AI, never costs.
                    onClick={() => {
                      if (app.launches) {
                        onLaunchEngine(app.launches);
                      } else if (isLive) {
                        setSelected(app);
                      } else {
                        setNotedId(app.id);
                      }
                    }}
                    aria-disabled={!isLive}
                    className={`relative min-h-[96px] rounded-xl p-4 text-left transition-all bg-gradient-to-br ${app.accent} border border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      isLive
                        ? 'bg-opacity-10 hover:border-primary/40 hover:shadow-md active:scale-[0.99] cursor-pointer'
                        : 'bg-opacity-5 opacity-70 hover:opacity-90 cursor-default'
                    }`}
                  >
                    <span className="absolute top-2 right-2">
                      {isLive ? (
                        <Badge>Live</Badge>
                      ) : (
                        <Badge variant="secondary">Coming Soon</Badge>
                      )}
                    </span>
                    <div className="text-2xl mb-1.5">{app.emoji}</div>
                    <div className="font-semibold leading-tight">{app.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {app.subtitle}
                    </div>
                    {!isLive && notedId === app.id && (
                      <div className="mt-2 text-[11px] font-medium text-primary">
                        Coming soon — we&apos;re building this. ✨
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          // ── GUIDED DIALOGUE / CONFIG VIEW ────────────────────────────
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-2xl">{selected.emoji}</span>
                {selected.title}
              </DialogTitle>
              <DialogDescription>
                {isBook
                  ? "Let's shape your book — answer a few quick questions, or just hit Run for smart defaults."
                  : selected.subtitle}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="grid gap-1.5">
                <label htmlFor="app-topic" className="text-sm font-medium">
                  {isBook ? "What's your book about?" : "What's it about?"}
                </label>
                <Input
                  id="app-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. The History of Ancient Rome"
                  disabled={isRunning}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && topic.trim() && !isRunning) {
                      void handleRun();
                    }
                  }}
                />
              </div>

              {isBook && (
                <>
                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">How deep should it go?</label>
                    <Select
                      value={depth}
                      onValueChange={(v) => setDepth(v as AIDepth)}
                      disabled={isRunning}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPTH_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">What tone?</label>
                    <Select
                      value={tone}
                      onValueChange={(v) => setTone(v as AITone)}
                      disabled={isRunning}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TONE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">Who&apos;s it for?</label>
                    <Select
                      value={level}
                      onValueChange={(v) => setLevel(v as AILevel)}
                      disabled={isRunning}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AUDIENCE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-1.5">
                    <label htmlFor="app-customize" className="text-sm font-medium">
                      Anything else you want? (optional)
                    </label>
                    <Textarea
                      id="app-customize"
                      value={customize}
                      onChange={(e) => setCustomize(e.target.value)}
                      placeholder={selected.configPlaceholder}
                      disabled={isRunning}
                      rows={2}
                    />
                  </div>
                </>
              )}

              <p className="text-xs text-muted-foreground border-t border-border pt-3">
                Runs on the app&apos;s built-in AI — free-tier friendly. Premium
                generation packages (narrated podcast, images) coming later.
              </p>
            </div>

            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                onClick={goBack}
                disabled={isRunning}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleRun}
                disabled={isRunning || (selected.needsTopic && !topic.trim())}
                className="min-w-[120px]"
              >
                {runningId === selected.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Working…
                  </>
                ) : (
                  'Run'
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
