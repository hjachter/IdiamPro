'use client';

/**
 * Generate Video dialog (Phase 2, 2026-07) — turn a chapter (selected node +
 * its descendants) into a faceless slideshow MP4 with an AI voiceover.
 *
 * Lives alongside the "Share as YouTube package" flow and operates on the same
 * "chapter" concept. Unlike the YouTube package (which produces text assets),
 * this actually RENDERS a video via the Electron main-process ffmpeg pipeline
 * (electron/video-generator.js). That native pipeline only exists in the
 * desktop app, so on web/iOS this dialog is honest about being desktop-only.
 *
 * Phase 2 scope: real outline content → slides → render → open the file.
 * Slide design stays rough (Phase 3), voice/theme controls stay minimal
 * (Phase 4). We DO include a simple voice pick since it's free, and a
 * large-chapter guard so a huge outline can't silently kick off a
 * 40-minute render.
 *
 * Free "taste" tier (2026-07): non-Pro users get FREE_VIDEO_LIMIT (10)
 * LIFETIME free renders. Those free videos render normally but carry a
 * subtle "Made with IdeaM" watermark. After the allowance is spent, the
 * render is blocked and the shared upgrade prompt is shown. Pro users are
 * unlimited AND unmarked (their videos stay fully white-labeled). The
 * lifetime counter lives in src/lib/video/video-free-quota.ts.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Video, Loader2, AlertTriangle, Play, Monitor, CheckCircle2, Upload, X, Check, Sparkles } from 'lucide-react';
import type { Outline } from '@/types';
import { isElectron } from '@/lib/electron-storage';
import { getUserApiKey } from '@/lib/byok-keys';
import { getCurrentTier } from '@/lib/tier-detection';
import {
  FREE_VIDEO_LIMIT,
  getFreeVideosUsed,
  incrementFreeVideosUsed,
} from '@/lib/video/video-free-quota';
import { useUpgradePrompt } from '@/components/upgrade-prompt';
import { deriveSlidesFromChapter, type VideoSlide } from '@/lib/video/derive-slides';
import { OPENAI_VOICE_OPTIONS } from '@/lib/podcast-generator';
import type { OpenAIVoice } from '@/types';
import {
  ACCENT_PRESETS,
  DEFAULT_VIDEO_STYLE,
  loadVideoStyle,
  saveVideoStyle,
  type VideoStyle,
} from '@/lib/video/video-style';

// Detail (depth) control — how many levels of the outline become their own
// slides. Value-based labels; the number is the maxDepth passed to the slide
// deriver. "Full outline" uses a large depth that effectively means "all levels."
const DEPTH_OPTIONS = [
  { value: 'overview', label: 'Overview', depth: 1, hint: 'Top sections only' },
  { value: 'standard', label: 'Standard', depth: 2, hint: 'Sections and subsections' },
  { value: 'deep', label: 'Deep', depth: 3, hint: 'Three levels deep' },
  { value: 'full', label: 'Full outline', depth: 99, hint: 'Every level of the outline' },
] as const;

type DepthKey = (typeof DEPTH_OPTIONS)[number]['value'];
const DEFAULT_DEPTH_KEY: DepthKey = 'standard';
const DEPTH_STORAGE_KEY = 'idiampro:video-depth';

// The safety cap that derive-slides.ts enforces. If the derived slide count
// equals this, the outline was truncated and we surface a gentle note.
const SLIDE_CAP = 400;

function loadDepthKey(): DepthKey {
  if (typeof window === 'undefined') return DEFAULT_DEPTH_KEY;
  try {
    const saved = window.localStorage.getItem(DEPTH_STORAGE_KEY);
    if (saved && DEPTH_OPTIONS.some((o) => o.value === saved)) return saved as DepthKey;
  } catch { /* localStorage unavailable — fall back to default */ }
  return DEFAULT_DEPTH_KEY;
}

function saveDepthKey(key: DepthKey): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(DEPTH_STORAGE_KEY, key); } catch { /* ignore */ }
}

// Slide visuals — INDEPENDENT, combinable options (not mutually exclusive). Each
// can be toggled on its own; mixing is resolved per-slide by the render pipeline:
//   • Mind maps  — a mind map of each section, drawn from your outline
//   • Photos     — a free public-domain photo matched to a slide
//   • Video clips— a moving free public-domain clip behind detail slides
// Per-slide logic: sections prefer a mind map (if on); detail slides prefer a
// video clip (if on) else a photo (if on); the cover gets a photo/clip if on.
// Nothing checked → text-only slides. Default: Mind maps + Photos ON, Video
// clips OFF (the reliable, free, no-garbage combo).
type VisualsSel = { mindmap: boolean; photo: boolean; videoclip: boolean };
const DEFAULT_VISUALS_SEL: VisualsSel = { mindmap: true, photo: true, videoclip: false };
const VISUALS_STORAGE_KEY = 'idiampro:video-visuals-set';

const VISUALS_ITEMS = [
  { key: 'mindmap', label: 'Mind maps', hint: 'Draw a mind map of each section from your outline' },
  { key: 'photo', label: 'Photos', hint: 'Add a free public-domain photo matched to your slides' },
  { key: 'videoclip', label: 'Video clips', hint: 'Moving public-domain clip behind detail slides (free); falls back to a photo when no strong match is found' },
] as const;

function loadVisualsSel(): VisualsSel {
  if (typeof window === 'undefined') return { ...DEFAULT_VISUALS_SEL };
  try {
    const saved = window.localStorage.getItem(VISUALS_STORAGE_KEY);
    if (saved) {
      const p = JSON.parse(saved) as Partial<VisualsSel>;
      if (p && typeof p === 'object') {
        return { mindmap: !!p.mindmap, photo: !!p.photo, videoclip: !!p.videoclip };
      }
    }
  } catch { /* localStorage unavailable / bad JSON — fall back to default */ }
  return { ...DEFAULT_VISUALS_SEL };
}

function saveVisualsSel(sel: VisualsSel): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(VISUALS_STORAGE_KEY, JSON.stringify(sel)); } catch { /* ignore */ }
}

// Reject logo uploads bigger than this — keeps localStorage small and renders fast.
const MAX_LOGO_BYTES = 1_500_000;
const ACCEPTED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];

interface GenerateVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outline: Outline | null;
  selectedNodeId: string | null;
}

type Phase = 'configure' | 'running' | 'done' | 'error';

// Above this many slides we warn about render time / voiceover cost before
// letting the user proceed. Feeding large outlines is expected — we don't cap
// silently, we surface the trade-off and let them decide.
const MANY_SLIDES = 18;

// Reuse the podcast feature's canonical voice list so both features offer the
// exact same narrator voices (single source of truth in podcast-generator).
const VOICE_OPTIONS = OPENAI_VOICE_OPTIONS;

// Rough render-time estimate for the progress copy: ~6s of work per slide
// (image render + TTS round-trip + encode) plus a final stitch pass.
function estimateSeconds(slideCount: number): number {
  return Math.round(slideCount * 6 + 8);
}

function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '—';
  const m = Math.floor(totalSeconds / 60);
  const s = Math.round(totalSeconds % 60);
  return m > 0 ? `${m} min ${s}s` : `${s}s`;
}

// Honest, calm phrasing for the live time-remaining line while a video renders.
// Under a minute reads "less than a minute left"; otherwise "about M min Ss left".
function formatRemaining(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'almost done';
  if (seconds < 60) return 'less than a minute left';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `about ${m} min ${s}s left` : `about ${m} min left`;
}

// The shape of a live progress update emitted by the Electron render pipeline.
type VideoProgress = {
  phase: string;
  current: number;
  total: number;
  completed: number;
  totalSteps: number;
  label: string;
};

export default function GenerateVideoDialog({
  open,
  onOpenChange,
  outline,
  selectedNodeId,
}: GenerateVideoDialogProps) {
  const [phase, setPhase] = useState<Phase>('configure');
  const [style, setStyle] = useState<VideoStyle>(DEFAULT_VIDEO_STYLE);
  const [logoNote, setLogoNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Live render progress (real, driven by the Electron pipeline over IPC).
  const [progress, setProgress] = useState<VideoProgress | null>(null);
  const renderStartRef = useRef<number>(0);
  const progressUnsubRef = useRef<null | (() => void)>(null);
  // Bumped once a second while rendering so the time-remaining line recomputes.
  const [, setNowTick] = useState(0);
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [resultInfo, setResultInfo] = useState<{ durationSeconds?: number; usedTts?: boolean } | null>(null);
  const [acknowledgedLarge, setAcknowledgedLarge] = useState(false);
  const [depthKey, setDepthKey] = useState<DepthKey>(DEFAULT_DEPTH_KEY);
  const [visualsSel, setVisualsSel] = useState<VisualsSel>(DEFAULT_VISUALS_SEL);

  const desktop = isElectron();
  const chapterNode = outline && selectedNodeId ? outline.nodes[selectedNodeId] : null;

  const { promptUpgrade } = useUpgradePrompt();

  // Pro vs. free "taste" state. Pro = unlimited + no watermark. Non-Pro =
  // FREE_VIDEO_LIMIT lifetime watermarked renders, then the upgrade prompt.
  // Read fresh whenever the dialog opens so the counter is always current.
  const [isPro, setIsPro] = useState(false);
  const [freeUsed, setFreeUsed] = useState(0);

  useEffect(() => {
    if (!open) return;
    setIsPro(getCurrentTier() === 'pro');
    setFreeUsed(getFreeVideosUsed());
  }, [open]);

  const freeRemaining = Math.max(0, FREE_VIDEO_LIMIT - freeUsed);
  const freeExhausted = !isPro && freeRemaining <= 0;

  // Copy for the "you've used them all" upsell — reused by the gate and the
  // primary button so the message is identical wherever the user hits it.
  const showAllUsedUpgrade = useCallback(() => {
    promptUpgrade({
      requiredTier: 'pro',
      title: `You've used all ${FREE_VIDEO_LIMIT} free videos`,
      reason: `You've used all ${FREE_VIDEO_LIMIT} free videos — upgrade to Pro for unlimited videos with no watermark.`,
    });
  }, [promptUpgrade]);

  /**
   * Free-taste gate. Returns whether the render may proceed and whether it
   * should carry the watermark:
   *   Pro           → proceed, no watermark
   *   free & <limit → proceed WITH watermark
   *   free & spent  → show upgrade prompt, do NOT render
   */
  const evaluateGate = useCallback((): { allowed: boolean; watermark: boolean } => {
    if (isPro) return { allowed: true, watermark: false };
    if (getFreeVideosUsed() < FREE_VIDEO_LIMIT) return { allowed: true, watermark: true };
    showAllUsedUpgrade();
    return { allowed: false, watermark: false };
  }, [isPro, showAllUsedUpgrade]);

  // Load the saved look on mount so the dialog defaults to the user's last
  // customization. Persist on every change so it sticks for next time.
  useEffect(() => {
    setStyle(loadVideoStyle());
    setDepthKey(loadDepthKey());
    setVisualsSel(loadVisualsSel());
  }, []);

  // While a render is running, tick once a second so the time-remaining line
  // stays live even between the pipeline's per-slide progress events.
  useEffect(() => {
    if (phase !== 'running') return;
    const id = window.setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  // Always drop the progress subscription when the dialog unmounts (leak guard).
  useEffect(() => () => { progressUnsubRef.current?.(); progressUnsubRef.current = null; }, []);

  const toggleVisual = (key: keyof VisualsSel) => {
    setVisualsSel((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveVisualsSel(next);
      return next;
    });
  };

  const maxDepth = useMemo(
    () => DEPTH_OPTIONS.find((o) => o.value === depthKey)?.depth ?? 2,
    [depthKey],
  );

  const handleDepthChange = (key: DepthKey) => {
    setDepthKey(key);
    saveDepthKey(key);
    setAcknowledgedLarge(false); // new depth ⇒ re-confirm the large-chapter guard
  };

  const updateStyle = (patch: Partial<VideoStyle>) => {
    setStyle((prev) => {
      const next = { ...prev, ...patch };
      saveVideoStyle(next);
      return next;
    });
  };

  const handleLogoFile = (file: File | null) => {
    setLogoNote(null);
    if (!file) return;
    if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
      setLogoNote('Please choose a PNG, JPEG, SVG, or WebP image.');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoNote('That image is a bit large. Please pick one under about 1.5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') updateStyle({ logoDataUrl: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const slides = useMemo<VideoSlide[]>(() => {
    if (!outline || !selectedNodeId) return [];
    return deriveSlidesFromChapter(outline.nodes, selectedNodeId, { maxDepth });
  }, [outline, selectedNodeId, maxDepth]);

  const slideCount = slides.length;
  const isLarge = slideCount > MANY_SLIDES;
  const hitCap = slideCount >= SLIDE_CAP;

  const reset = () => {
    setPhase('configure');
    setErrorMsg(null);
    progressUnsubRef.current?.();
    progressUnsubRef.current = null;
    setProgress(null);
    setOutputPath(null);
    setResultInfo(null);
    setAcknowledgedLarge(false);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleGenerate = async () => {
    if (!desktop || !chapterNode || slideCount === 0) return;
    // Free-taste gate — Pro renders clean; free renders carry a watermark
    // until the 10-video lifetime allowance is spent, then the upgrade prompt.
    const decision = evaluateGate();
    if (!decision.allowed) return;
    const watermark = decision.watermark;
    const api = (window as unknown as { electronAPI?: { generateSlideshowVideo?: (a: unknown) => Promise<{
      success: boolean; outputPath?: string; durationSeconds?: number; usedTts?: boolean; error?: string;
    }> } }).electronAPI;
    if (!api?.generateSlideshowVideo) {
      setErrorMsg('The video generator is not available in this build.');
      setPhase('error');
      return;
    }

    setPhase('running');
    setErrorMsg(null);

    // Real progress: subscribe to the pipeline's live per-slide events (plus a
    // final stitch step) so the bar and the time-remaining line reflect the
    // ACTUAL render, not a timer. Seed a 0% "Preparing…" state so the UI shows a
    // bar immediately, before the first event lands.
    renderStartRef.current = Date.now();
    setProgress({ phase: 'preparing', current: 0, total: slideCount, completed: 0, totalSteps: slideCount + 1, label: 'Preparing…' });
    progressUnsubRef.current?.();
    const progressApi = (window as unknown as {
      electronAPI?: { onGenerateVideoProgress?: (cb: (p: VideoProgress) => void) => () => void };
    }).electronAPI;
    progressUnsubRef.current = progressApi?.onGenerateVideoProgress?.((p) => setProgress(p)) ?? null;
    const stopProgress = () => { progressUnsubRef.current?.(); progressUnsubRef.current = null; };

    try {
      const result = await api.generateSlideshowVideo({
        slides,
        voice: style.voice,
        openaiApiKey: getUserApiKey('openai') || undefined,
        visuals: visualsSel,
        style: {
          theme: style.theme,
          accent: style.accent,
          brandLabel: style.brandLabel,
          logoDataUrl: style.logoDataUrl,
          watermark,
        },
      });
      stopProgress();
      if (!result?.success || !result.outputPath) {
        setErrorMsg(result?.error || 'The video could not be generated. Please try again.');
        setPhase('error');
        return;
      }
      // Charge one free-video credit ONLY on a successful render (never on
      // failure/cancel). Pro renders are unlimited and don't touch the counter.
      if (watermark) {
        setFreeUsed(incrementFreeVideosUsed());
      }
      setOutputPath(result.outputPath);
      setResultInfo({ durationSeconds: result.durationSeconds, usedTts: result.usedTts });
      setPhase('done');
    } catch (e) {
      stopProgress();
      const raw = e instanceof Error ? e.message : String(e);
      setErrorMsg(`The video did not generate. ${raw ? `Reason: ${raw}.` : ''}`);
      setPhase('error');
    }
  };

  const handleOpenVideo = async () => {
    if (!outputPath) return;
    const api = (window as unknown as { electronAPI?: { openFile?: (p: string) => Promise<unknown> } }).electronAPI;
    try {
      await api?.openFile?.(outputPath);
    } catch {
      /* best-effort — the file is still saved on disk */
    }
  };

  const canGenerate = desktop && !!chapterNode && slideCount > 0 && (!isLarge || acknowledgedLarge);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent className="w-[95vw] max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Generate Video
            <span className="ml-1 inline-flex items-center gap-1 text-xs font-normal bg-gradient-to-r from-emerald-500/20 to-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-300/30">
              <Sparkles className="h-3 w-3" />
              Pro
            </span>
          </DialogTitle>
          <DialogDescription>
            {chapterNode
              ? `Turns "${chapterNode.name}" and its sub-points into a narrated slideshow video.`
              : 'Select a chapter first.'}
          </DialogDescription>
        </DialogHeader>

        {/* Desktop-only notice. Honest — we don't fake a render on web/iOS. */}
        {!desktop && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            <div className="flex items-start gap-2">
              <Monitor className="h-5 w-5 mt-0.5 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium">Available in the desktop app</p>
                <p className="text-muted-foreground mt-1">
                  Video rendering runs on your Mac using the IdeaM desktop app. Open this
                  outline there to generate the video.
                </p>
              </div>
            </div>
          </div>
        )}

        {desktop && phase === 'configure' && (
          <div className="space-y-4 py-2">
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              {slideCount > 0 ? (
                <>
                  <span className="font-medium">{slideCount} slides</span>
                  <span className="text-muted-foreground"> · about {formatDuration(estimateSeconds(slideCount))} to render</span>
                </>
              ) : (
                <span className="text-muted-foreground">This chapter has no content to turn into slides.</span>
              )}
              {hitCap && (
                <p className="text-muted-foreground mt-1 text-xs">
                  Showing the first {SLIDE_CAP} slides — pick a shallower Detail for a shorter video.
                </p>
              )}
            </div>

            {/* Free "taste" allowance — shown only to non-Pro users. Pro users
                are unlimited and unmarked, so they see no counter. */}
            {!isPro && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                {freeRemaining > 0 ? (
                  <p>
                    <span className="font-medium">Free preview — {freeUsed} of {FREE_VIDEO_LIMIT} videos used.</span>{' '}
                    <span className="text-muted-foreground">
                      Free videos carry a small &ldquo;Made with IdeaM&rdquo; mark. Upgrade to Pro for unlimited, unmarked videos.
                    </span>
                  </p>
                ) : (
                  <p>
                    <span className="font-medium">You&rsquo;ve used all {FREE_VIDEO_LIMIT} free videos.</span>{' '}
                    <span className="text-muted-foreground">
                      Upgrade to Pro for unlimited videos with no watermark.
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* --- Style / branding --- */}
            <TooltipProvider delayDuration={300}>
              <div className="space-y-4">
                {/* Detail (depth) — how much of the outline becomes slides. */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Detail</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {DEPTH_OPTIONS.map((opt) => {
                      const selected = depthKey === opt.value;
                      return (
                        <Tooltip key={opt.value}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => handleDepthChange(opt.value)}
                              aria-label={`${opt.label} — ${opt.hint}`}
                              aria-pressed={selected}
                              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                                selected
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'text-muted-foreground border-border hover:bg-accent'
                              }`}
                            >
                              {opt.label}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{opt.hint}</TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>

                {/* Slide visuals — combinable, independent options (mind maps,
                    photos, video clips). Multi-select, not mutually exclusive. */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Slide visuals</Label>
                  <p className="text-xs text-muted-foreground">
                    Combine any of these. Mind maps and photos are on by default; leave all unchecked for text-only slides.
                  </p>
                  <div className="space-y-1.5">
                    {VISUALS_ITEMS.map((opt) => (
                      <label
                        key={opt.key}
                        htmlFor={`vis-${opt.key}`}
                        className="flex items-start gap-2.5 rounded-md border p-2.5 cursor-pointer hover:bg-accent/50 transition-colors"
                      >
                        <Checkbox
                          id={`vis-${opt.key}`}
                          checked={visualsSel[opt.key]}
                          onCheckedChange={() => toggleVisual(opt.key)}
                          aria-label={opt.label}
                          className="mt-0.5"
                        />
                        <span className="grid gap-0.5">
                          <span className="text-sm font-medium leading-none">{opt.label}</span>
                          <span className="text-xs text-muted-foreground">{opt.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Theme */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Theme</Label>
                  <div className="inline-flex rounded-md border p-0.5">
                    {(['dark', 'light'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => updateStyle({ theme: t })}
                        className={`px-4 py-1.5 text-sm rounded-[5px] capitalize transition-colors ${
                          style.theme === t
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent'
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
                      const selected = style.accent.toLowerCase() === p.hex.toLowerCase();
                      return (
                        <Tooltip key={p.hex}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label={p.name}
                              onClick={() => updateStyle({ accent: p.hex })}
                              className={`h-7 w-7 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background ${
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <label className="relative h-7 w-7 rounded-full border border-border overflow-hidden cursor-pointer" aria-label="Custom color">
                          <input
                            type="color"
                            value={style.accent}
                            onChange={(e) => updateStyle({ accent: e.target.value })}
                            className="absolute inset-0 h-[200%] w-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer border-0 p-0"
                          />
                        </label>
                      </TooltipTrigger>
                      <TooltipContent>Custom color</TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {/* Brand */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Brand</Label>
                  <Input
                    value={style.brandLabel}
                    onChange={(e) => updateStyle({ brandLabel: e.target.value })}
                    placeholder="Your name or brand"
                    className="text-sm"
                  />
                  <div className="flex items-center gap-3">
                    {style.logoDataUrl ? (
                      <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-1.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={style.logoDataUrl} alt="Logo preview" className="h-8 w-auto max-w-[120px] object-contain" />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              aria-label="Remove logo"
                              onClick={() => { updateStyle({ logoDataUrl: '' }); setLogoNote(null); }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remove logo</TooltipContent>
                        </Tooltip>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        Upload logo
                      </Button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={(e) => { handleLogoFile(e.target.files?.[0] ?? null); e.target.value = ''; }}
                    />
                  </div>
                  {logoNote && <p className="text-xs text-amber-600">{logoNote}</p>}
                </div>

                {/* Voice */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Narrator voice</Label>
                  <RadioGroup value={style.voice} onValueChange={(v) => updateStyle({ voice: v as OpenAIVoice })}>
                    <div className="flex flex-wrap gap-3">
                      {VOICE_OPTIONS.map(opt => (
                        <div key={opt.value} className="flex items-center gap-2">
                          <RadioGroupItem value={opt.value} id={`vid-voice-${opt.value}`} />
                          <Label htmlFor={`vid-voice-${opt.value}`} className="text-sm cursor-pointer">{opt.label}</Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                  {!getUserApiKey('openai') && (
                    <p className="text-xs text-muted-foreground">
                      No AI voice key found — your video still narrates, using your Mac&rsquo;s built-in voice (free). Add an OpenAI key in Settings for a more natural AI voiceover.
                    </p>
                  )}
                </div>

                {/* Live preview — an approximation of the slide look, not a real render. */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Preview</Label>
                  <StylePreview style={style} />
                </div>
              </div>
            </TooltipProvider>

            {isLarge && (
              <label className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={acknowledgedLarge}
                  onChange={(e) => setAcknowledgedLarge(e.target.checked)}
                />
                <span>
                  <span className="font-medium">This is a large chapter ({slideCount} slides).</span>{' '}
                  <span className="text-muted-foreground">
                    Rendering will take several minutes and, with AI voiceover, uses paid text-to-speech.
                    Check to proceed anyway.
                  </span>
                </span>
              </label>
            )}
          </div>
        )}

        {desktop && phase === 'running' && (() => {
          const totalStepsNow = progress?.totalSteps ?? (slideCount + 1);
          const completedNow = progress?.completed ?? 0;
          const rawFraction = totalStepsNow > 0 ? completedNow / totalStepsNow : 0;
          // Hold the bar just under 100% until the file is truly finished.
          const fraction = completedNow >= totalStepsNow ? 1 : Math.min(0.99, rawFraction);
          const percent = Math.round(fraction * 100);
          const elapsedSec = renderStartRef.current ? (Date.now() - renderStartRef.current) / 1000 : 0;
          // Once we have real progress, project remaining from elapsed vs. fraction
          // done; before that, fall back to the slide-count estimate.
          const remainingSec = fraction > 0.02
            ? elapsedSec * (1 - fraction) / fraction
            : Math.max(0, estimateSeconds(slideCount) - elapsedSec);
          return (
            <div className="py-8 px-1 space-y-4">
              <div className="flex items-center gap-2.5 text-sm font-medium">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                <span className="truncate">{progress?.label || 'Preparing…'}</span>
              </div>
              <Progress value={percent} aria-label="Video render progress" />
              <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                <span>{percent}%</span>
                <span>{formatRemaining(remainingSec)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Keep the app open while your video renders.
              </p>
            </div>
          );
        })()}

        {desktop && phase === 'done' && (
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="text-sm font-medium">Your video is ready</p>
            <p className="text-xs text-muted-foreground">
              Saved to your Documents · IdeaM Videos folder
              {resultInfo?.durationSeconds ? ` · ${formatDuration(resultInfo.durationSeconds)} long` : ''}
              {resultInfo && resultInfo.usedTts === false ? ' · silent (no voiceover available)' : ''}
            </p>
          </div>
        )}

        {desktop && phase === 'error' && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive my-2">
            <AlertTriangle className="inline h-4 w-4 mr-1" />
            {errorMsg}
          </div>
        )}

        <DialogFooter>
          {(!desktop || phase === 'configure' || phase === 'error') && (
            <Button variant="ghost" onClick={handleClose}>Close</Button>
          )}
          {desktop && (phase === 'configure' || phase === 'error') && (
            freeExhausted ? (
              <Button onClick={showAllUsedUpgrade}>
                <Sparkles className="h-4 w-4 mr-1" />
                Upgrade to Pro
              </Button>
            ) : (
              <Button onClick={handleGenerate} disabled={!canGenerate}>
                <Video className="h-4 w-4 mr-1" />
                {phase === 'error' ? 'Try again' : 'Generate'}
              </Button>
            )
          )}
          {desktop && phase === 'running' && (
            <Button disabled>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Rendering…
            </Button>
          )}
          {desktop && phase === 'done' && (
            <>
              <Button variant="ghost" onClick={handleClose}>Close</Button>
              <Button onClick={handleOpenVideo}>
                <Play className="h-4 w-4 mr-1" />
                Open video
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A small 16:9 approximation of a slide so the user can see their theme, accent,
 * and brand before rendering. This is NOT a real render — it's plain divs styled
 * inline to build confidence in the chosen look.
 */
function StylePreview({ style }: { style: VideoStyle }) {
  const isLight = style.theme === 'light';
  const bg = isLight
    ? 'linear-gradient(135deg,#ffffff 0%,#f3f6fb 55%,#e9eff7 100%)'
    : 'linear-gradient(135deg,#0a1120 0%,#0f1a30 55%,#0b1424 100%)';
  const titleColor = isLight ? '#0b1220' : '#f5f8ff';
  const mutedColor = isLight ? '#7d8ea3' : '#5f7286';
  const nameColor = isLight ? '#4a5c74' : '#93a4b8';
  const hasBrand = !!style.logoDataUrl || !!style.brandLabel.trim();

  return (
    <div
      className="relative w-[320px] max-w-full aspect-video rounded-md border overflow-hidden"
      style={{ background: bg }}
    >
      {/* faint accent glow */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 82% 16%, ${style.accent}${isLight ? '22' : '38'}, transparent 48%)`,
        }}
      />
      <div className="absolute left-4 right-4 top-4 bottom-8 flex flex-col justify-center">
        <div className="h-1.5 w-10 rounded-full mb-2" style={{ backgroundColor: style.accent }} />
        <div className="text-sm font-bold leading-tight" style={{ color: titleColor }}>
          Your title here
        </div>
      </div>
      <div className="absolute left-4 right-4 bottom-2.5 flex items-center justify-between text-[10px]">
        {style.logoDataUrl ? (
          <span className="flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={style.logoDataUrl} alt="" className="h-3.5 w-auto max-w-[70px] object-contain" />
            {style.brandLabel.trim() && (
              <span style={{ color: nameColor }} className="tracking-wide">{style.brandLabel}</span>
            )}
          </span>
        ) : style.brandLabel.trim() ? (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: style.accent }} />
            <span style={{ color: nameColor }} className="tracking-wide">{style.brandLabel}</span>
          </span>
        ) : (
          <span />
        )}
        <span style={{ color: mutedColor }}>1 / 5</span>
      </div>
      {!hasBrand && <span className="sr-only">No brand shown</span>}
    </div>
  );
}
