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
 * Pro-gating (Phase 5, 2026-07): video generation is a Pro-only feature,
 * gated exactly like the Podcast feature — the same useAIUsageGate hook (which
 * shows the shared upgrade prompt for non-Pro users) plus the canUseFeature
 * fallback. When auth/billing aren't configured (today) enforcement is a
 * no-op and everyone can render, so free users lose nothing else.
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Video, Loader2, AlertTriangle, Play, Monitor, CheckCircle2, Upload, X, Check, Sparkles } from 'lucide-react';
import type { Outline } from '@/types';
import { isElectron } from '@/lib/electron-storage';
import { getUserApiKey } from '@/lib/byok-keys';
import { canUseFeature } from '@/lib/entitlements';
import { useAIUsageGate } from '@/lib/use-ai-usage-gate';
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
  const [progressLabel, setProgressLabel] = useState<string>('');
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [resultInfo, setResultInfo] = useState<{ durationSeconds?: number; usedTts?: boolean } | null>(null);
  const [acknowledgedLarge, setAcknowledgedLarge] = useState(false);

  const desktop = isElectron();
  const chapterNode = outline && selectedNodeId ? outline.nodes[selectedNodeId] : null;

  const { promptUpgrade } = useUpgradePrompt();
  const { gate: aiUsageGate } = useAIUsageGate();

  /**
   * Pro gate: video generation is a Pro-only feature. Returns true if the
   * user may proceed. Mirrors the Podcast dialog's ensurePodcastAllowed.
   *
   * NO-OP SAFETY: for non-Pro users aiUsageGate shows the shared upgrade
   * prompt and returns false; when auth/billing enforcement is inactive
   * (no keys — the state today) both checks allow and video generation
   * works exactly as before, so free users lose nothing.
   */
  const ensureVideoAllowed = useCallback((): boolean => {
    if (!aiUsageGate({ feature: 'videoGeneration' })) return false;
    if (canUseFeature('podcastGeneration')) return true;
    promptUpgrade({
      reason: 'Video generation is a Pro feature.',
      requiredTier: 'pro',
    });
    return false;
  }, [promptUpgrade, aiUsageGate]);

  // Load the saved look on mount so the dialog defaults to the user's last
  // customization. Persist on every change so it sticks for next time.
  useEffect(() => {
    setStyle(loadVideoStyle());
  }, []);

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
    return deriveSlidesFromChapter(outline.nodes, selectedNodeId);
  }, [outline, selectedNodeId]);

  const slideCount = slides.length;
  const isLarge = slideCount > MANY_SLIDES;

  const reset = () => {
    setPhase('configure');
    setErrorMsg(null);
    setProgressLabel('');
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
    // Pro gate — non-Pro users get the upgrade prompt instead of a render.
    if (!ensureVideoAllowed()) return;
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

    // The IPC call is a single long-running promise (no streaming events yet),
    // so we simulate staged progress copy on a timer to reassure the user the
    // render is alive. The stages mirror the pipeline's real internal steps.
    const stages = ['Writing slides…', 'Generating voiceover…', 'Stitching video…'];
    let stageIdx = 0;
    setProgressLabel(stages[0]);
    const timer = setInterval(() => {
      stageIdx = Math.min(stageIdx + 1, stages.length - 1);
      setProgressLabel(stages[stageIdx]);
    }, Math.max(3000, estimateSeconds(slideCount) * 1000 / 3));

    try {
      const result = await api.generateSlideshowVideo({
        slides,
        voice: style.voice,
        openaiApiKey: getUserApiKey('openai') || undefined,
        style: {
          theme: style.theme,
          accent: style.accent,
          brandLabel: style.brandLabel,
          logoDataUrl: style.logoDataUrl,
        },
      });
      clearInterval(timer);
      if (!result?.success || !result.outputPath) {
        setErrorMsg(result?.error || 'The video could not be generated. Please try again.');
        setPhase('error');
        return;
      }
      setOutputPath(result.outputPath);
      setResultInfo({ durationSeconds: result.durationSeconds, usedTts: result.usedTts });
      setPhase('done');
    } catch (e) {
      clearInterval(timer);
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
                  Video rendering runs on your Mac using the IdiamPro desktop app. Open this
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
            </div>

            {/* --- Style / branding --- */}
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
                      No OpenAI key found — the video will render with silent slides. Add a key in Settings for AI voiceover.
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

        {desktop && phase === 'running' && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm font-medium">{progressLabel || 'Rendering…'}</p>
            <p className="text-xs text-muted-foreground">
              This can take a few minutes. Keep the app open.
            </p>
          </div>
        )}

        {desktop && phase === 'done' && (
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="text-sm font-medium">Your video is ready</p>
            <p className="text-xs text-muted-foreground">
              Saved to your Documents · IdiamPro Videos folder
              {resultInfo?.durationSeconds ? ` · ${formatDuration(resultInfo.durationSeconds)} long` : ''}
              {resultInfo && resultInfo.usedTts === false ? ' · silent (no voiceover key)' : ''}
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
            <Button onClick={handleGenerate} disabled={!canGenerate}>
              <Video className="h-4 w-4 mr-1" />
              {phase === 'error' ? 'Try again' : 'Generate'}
            </Button>
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
