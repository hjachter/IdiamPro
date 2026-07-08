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
 * Slide design stays rough (Phase 3), no Pro-gating yet (Phase 5), voice/theme
 * controls stay minimal (Phase 4). We DO include a simple voice pick since it's
 * free, and a large-chapter guard so a huge outline can't silently kick off a
 * 40-minute render.
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
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Video, Loader2, AlertTriangle, Play, Monitor, CheckCircle2 } from 'lucide-react';
import type { Outline } from '@/types';
import { isElectron } from '@/lib/electron-storage';
import { getUserApiKey } from '@/lib/byok-keys';
import { deriveSlidesFromChapter, type VideoSlide } from '@/lib/video/derive-slides';

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

const VOICE_OPTIONS: { value: string; label: string }[] = [
  { value: 'nova', label: 'Nova (warm)' },
  { value: 'alloy', label: 'Alloy (neutral)' },
  { value: 'echo', label: 'Echo (deep)' },
  { value: 'shimmer', label: 'Shimmer (bright)' },
];

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
  const [voice, setVoice] = useState<string>('nova');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progressLabel, setProgressLabel] = useState<string>('');
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [resultInfo, setResultInfo] = useState<{ durationSeconds?: number; usedTts?: boolean } | null>(null);
  const [acknowledgedLarge, setAcknowledgedLarge] = useState(false);

  const desktop = isElectron();
  const chapterNode = outline && selectedNodeId ? outline.nodes[selectedNodeId] : null;

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
        voice,
        openaiApiKey: getUserApiKey('openai') || undefined,
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

            <div className="space-y-2">
              <Label className="text-sm font-medium">Narrator voice</Label>
              <RadioGroup value={voice} onValueChange={setVoice}>
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
