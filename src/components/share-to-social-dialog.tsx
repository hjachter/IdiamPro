'use client';

/**
 * Share to Social dialog (2026-07-22).
 *
 * The first social-media output wizard. Turns a selected BRANCH (a node + all
 * its descendants — the same "chapter" scope Generate Video / Export Email use)
 * into ready-to-post social content. The FIRST platform is X; the dialog is
 * driven by the social-format template registry (src/lib/social-templates.ts)
 * so more platforms slot in as data, not new plumbing.
 *
 * Flow:
 *   1. 'input'   — platform (X for now), post mode (Thread / Single post),
 *                  optional "In my voice", optional instruction, optional local AI.
 *   2. 'running' — the AI drafts real posts from the branch.
 *   3. 'preview' — an EDITABLE preview (one textarea per post, live char count,
 *                  per-post Copy) plus four no-login hand-offs:
 *                    a) Copy thread — all posts, numbered, ready to paste.
 *                    b) Copy (per post) — one post at a time.
 *                    c) Open in X — X web-compose intent, first post prefilled.
 *                    d) Download — the thread as a .txt file.
 *
 * Reuses the existing AI pipeline (generateSocialPostAction → generate-social-post
 * flow, Gemini with Ollama fallback, BYOK keys). Counts as 1 AI generation,
 * gated through useAIUsageGate('shareSocial'). NO direct posting (no X API /
 * OAuth) and NO paywall — copy / open-intent / download only, by design.
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Share2, Loader2, AlertTriangle, Cpu, ArrowLeft, Sparkles, Copy, Download, Check, ExternalLink } from 'lucide-react';
import { generateSocialPostAction } from '@/app/actions';
import { isLocalAIReachable, notifyLocalAIDown } from '@/lib/local-ai';
import { serializeSubtree } from '@/lib/transform-outline-helpers';
import { getUserApiKey } from '@/lib/byok-keys';
import { useAIUsageGate } from '@/lib/use-ai-usage-gate';
import { useVoiceProfile } from '@/lib/use-voice-profile';
import { openExternalUrl, isElectron } from '@/lib/electron-storage';
import { useToast } from '@/hooks/use-toast';
import { SOCIAL_TEMPLATES, getSocialTemplate, type SocialPostMode, type SocialTemplate } from '@/lib/social-templates';
import type { NodeMap } from '@/types';

interface ShareToSocialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whole node map of the current outline. */
  nodes: NodeMap | null;
  /** Root of the branch to turn into social content — the SELECTED node. */
  rootNodeId: string | null;
  /** Friendly label for the branch (the selected node's name). */
  scopeLabel?: string;
  /** Display name of the current outline (context for the prompt). */
  outlineName?: string;
}

type Phase = 'input' | 'running' | 'preview';

/** Number a set of posts into a copy-ready thread (e.g. "1/5\n<post>"). */
function buildThreadText(posts: string[], mode: SocialPostMode): string {
  if (mode === 'single' || posts.length <= 1) return posts.join('\n\n');
  return posts.map((p, i) => `${i + 1}/${posts.length}\n${p}`).join('\n\n');
}

/** Safe .txt filename from the branch label + platform. */
function threadFilename(scopeLabel: string | undefined, platform: SocialTemplate): string {
  const base = (scopeLabel || 'post')
    .replace(/[^a-z0-9\- ]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50);
  return `${base || 'post'}-${platform.id}.${platform.fileExtension}`;
}

/** Small brand-neutral X glyph so we don't depend on a lucide "X-logo" icon. */
function XGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817-5.966 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function PlatformIcon({ tpl, className }: { tpl: SocialTemplate; className?: string }) {
  if (tpl.iconKey === 'x') return <XGlyph className={className} />;
  return <Share2 className={className} />;
}

export default function ShareToSocialDialog({
  open,
  onOpenChange,
  nodes,
  rootNodeId,
  scopeLabel,
  outlineName,
}: ShareToSocialDialogProps) {
  const { gate } = useAIUsageGate();
  const { voiceAvailable, voiceProfile } = useVoiceProfile();
  const { toast } = useToast();

  const [phase, setPhase] = useState<Phase>('input');
  const [platformId, setPlatformId] = useState<string>(SOCIAL_TEMPLATES[0]?.id ?? 'x');
  const [mode, setMode] = useState<SocialPostMode>('thread');
  const [inMyVoice, setInMyVoice] = useState(false);
  const [guidance, setGuidance] = useState('');
  const [useLocal, setUseLocal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [modelLabel, setModelLabel] = useState<string | null>(null);

  // Editable posts (the preview).
  const [posts, setPosts] = useState<string[]>([]);
  const [copiedThread, setCopiedThread] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const template = useMemo(() => getSocialTemplate(platformId) ?? SOCIAL_TEMPLATES[0], [platformId]);

  useEffect(() => {
    if (open) {
      setPhase('input');
      setPlatformId(SOCIAL_TEMPLATES[0]?.id ?? 'x');
      setMode('thread');
      setInMyVoice(false);
      setGuidance('');
      setUseLocal(false);
      setErrorMsg(null);
      setModelLabel(null);
      setPosts([]);
      setCopiedThread(false);
      setCopiedIdx(null);
    }
  }, [open]);

  // If the selected mode isn't supported by the platform, fall back.
  useEffect(() => {
    if (mode === 'thread' && !template.supportsThread) setMode('single');
    if (mode === 'single' && !template.supportsSingle) setMode('thread');
  }, [template, mode]);

  const threadText = useMemo(() => buildThreadText(posts, mode), [posts, mode]);
  const intentUrl = useMemo(
    () => (template.buildIntentUrl && posts[0] ? template.buildIntentUrl(posts[0]) : ''),
    [template, posts],
  );

  const handleClose = () => onOpenChange(false);

  const handleRun = async () => {
    if (!nodes || !rootNodeId) {
      setErrorMsg('Select a branch first — a node and its sub-points.');
      return;
    }
    if (!gate({ feature: 'shareSocial' })) return;

    if (useLocal && !(await isLocalAIReachable())) {
      await notifyLocalAIDown({ onRetry: () => { void handleRun(); } });
      return;
    }

    setErrorMsg(null);
    setPhase('running');

    try {
      const { subtreeNodes } = serializeSubtree(nodes, rootNodeId);
      const userApiKey = getUserApiKey('gemini');
      const r = await generateSocialPostAction({
        subtreeNodes,
        rootNodeId,
        currentOutlineName: outlineName,
        platformId: template.id,
        platformLabel: template.label,
        mode,
        charLimit: template.charLimit,
        promptRules: template.promptRules,
        guidance: guidance.trim() || undefined,
        voiceProfile: inMyVoice && voiceAvailable ? voiceProfile.trim() : undefined,
        useLocal,
        userApiKey,
      });

      if (r.error || r.posts.length === 0) {
        setErrorMsg(
          `I couldn't draft the ${template.label} ${mode === 'thread' ? 'thread' : 'post'}. ${r.error || 'The AI returned nothing usable.'} You can try again, switch to local AI, or check your API key in Settings.`,
        );
        setPhase('input');
        return;
      }

      setPosts(r.posts);
      setModelLabel(r.model);
      setPhase('preview');
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setErrorMsg(
        `The draft didn't go through. ${raw ? `Reason: ${raw}. ` : ''}You can try again, switch to local AI, or check your API key in Settings.`,
      );
      setPhase('input');
    }
  };

  const handleEditPost = (idx: number, value: string) => {
    setPosts((prev) => prev.map((p, i) => (i === idx ? value : p)));
  };

  const copyText = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      /* fall through */
    }
    return false;
  };

  const handleCopyThread = async () => {
    const ok = await copyText(threadText);
    if (ok) {
      setCopiedThread(true);
      toast({
        title: mode === 'thread' && posts.length > 1 ? 'Thread copied' : 'Post copied',
        description:
          mode === 'thread' && posts.length > 1
            ? 'All posts copied, numbered and ready to paste one at a time.'
            : 'Paste it into X and post.',
      });
      window.setTimeout(() => setCopiedThread(false), 2000);
    } else {
      toast({ variant: 'destructive', title: 'Copy failed', description: 'Your browser blocked clipboard access.' });
    }
  };

  const handleCopyOne = async (idx: number) => {
    const ok = await copyText(posts[idx]);
    if (ok) {
      setCopiedIdx(idx);
      window.setTimeout(() => setCopiedIdx((c) => (c === idx ? null : c)), 1500);
    } else {
      toast({ variant: 'destructive', title: 'Copy failed', description: 'Your browser blocked clipboard access.' });
    }
  };

  const handleOpenIntent = () => {
    if (!intentUrl) return;
    if (isElectron()) {
      void openExternalUrl(intentUrl);
    } else {
      window.open(intentUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([threadText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = threadFilename(scopeLabel, template);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: 'Downloaded', description: 'Saved the posts as a text file.' });
    } catch {
      toast({ variant: 'destructive', title: 'Download failed', description: 'Could not create the file.' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] flex flex-col" data-testid="share-to-social-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share to Social
          </DialogTitle>
          <DialogDescription>
            {scopeLabel
              ? `Turns "${scopeLabel}" and its sub-points into ready-to-post social content. You review and post it yourself.`
              : 'Select a branch first — a node and its sub-points.'}
          </DialogDescription>
        </DialogHeader>

        {phase === 'input' && (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 py-2">
              {/* Platform picker — grouped so more platforms appear here later. */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Platform</Label>
                <div className="flex flex-wrap gap-2">
                  {SOCIAL_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      data-testid={`social-platform-${tpl.id}`}
                      onClick={() => setPlatformId(tpl.id)}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                        platformId === tpl.id
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-input text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      <PlatformIcon tpl={tpl} className="h-4 w-4" />
                      {tpl.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  More platforms are coming — for now, X.
                </p>
              </div>

              {/* Mode: Thread vs Single post. */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Format</Label>
                <RadioGroup value={mode} onValueChange={(v) => setMode(v as SocialPostMode)} className="gap-2">
                  {template.supportsThread && (
                    <div className="flex items-start gap-2">
                      <RadioGroupItem value="thread" id="social-mode-thread" className="mt-1" data-testid="social-mode-thread" />
                      <Label htmlFor="social-mode-thread" className="font-normal cursor-pointer flex-1">
                        <span className="font-medium">Thread</span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          A hook post plus follow-on posts, each within {template.charLimit} characters.
                        </p>
                      </Label>
                    </div>
                  )}
                  {template.supportsSingle && (
                    <div className="flex items-start gap-2">
                      <RadioGroupItem value="single" id="social-mode-single" className="mt-1" data-testid="social-mode-single" />
                      <Label htmlFor="social-mode-single" className="font-normal cursor-pointer flex-1">
                        <span className="font-medium">Single post</span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Condense the whole branch into one post within {template.charLimit} characters.
                        </p>
                      </Label>
                    </div>
                  )}
                </RadioGroup>
              </div>

              {voiceAvailable && (
                <div className="flex items-start gap-2 pt-1">
                  <Checkbox
                    id="social-in-my-voice"
                    data-testid="social-in-my-voice"
                    checked={inMyVoice}
                    onCheckedChange={(c) => setInMyVoice(!!c)}
                  />
                  <div className="grid gap-1">
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Label htmlFor="social-in-my-voice" className="text-sm font-medium cursor-pointer">
                            <Sparkles className="inline h-3.5 w-3.5 mr-1" />
                            In my voice
                          </Label>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          Write these posts in your own style, learned from your samples in Settings &rarr; Professional Customization &rarr; Your Voice.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <p className="text-xs text-muted-foreground">
                      Uses your saved voice profile so the posts sound like you.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="social-guidance" className="text-sm font-medium">
                  Anything to add? <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="social-guidance"
                  value={guidance}
                  onChange={(e) => setGuidance(e.target.value)}
                  placeholder="e.g. punchy and bold, add a call to action"
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRun(); } }}
                />
              </div>

              <div className="flex items-start gap-2 pt-1">
                <Checkbox id="social-local" checked={useLocal} onCheckedChange={(c) => setUseLocal(!!c)} />
                <div className="grid gap-1">
                  <Label htmlFor="social-local" className="text-sm font-medium cursor-pointer">
                    <Cpu className="inline h-3.5 w-3.5 mr-1" />
                    Use local AI (Ollama)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Slower but private — the draft runs entirely on your machine.
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
                Counts as 1 AI generation. IdeaM never posts anything — you always review and post yourself.
              </p>
            </div>
          </ScrollArea>
        )}

        {phase === 'running' && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Writing your {template.label} {mode === 'thread' ? 'thread' : 'post'}…</p>
          </div>
        )}

        {phase === 'preview' && (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2 text-sm flex-wrap">
                {modelLabel && <Badge variant="secondary">{modelLabel}</Badge>}
                <Badge variant="outline" data-testid="social-post-count">
                  {posts.length} {posts.length === 1 ? 'post' : 'posts'}
                </Badge>
                <span className="text-muted-foreground text-xs">Edit any post before you post it.</span>
              </div>

              {mode === 'thread' && posts.length > 1 && template.intentNote && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {template.intentNote}
                </p>
              )}

              {posts.map((post, idx) => {
                const over = post.length > template.charLimit;
                return (
                  <div key={idx} className="space-y-1" data-testid={`social-post-${idx}`}>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                        {mode === 'thread' && posts.length > 1 ? `Post ${idx + 1} of ${posts.length}` : 'Post'}
                      </Label>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs tabular-nums ${over ? 'text-destructive font-medium' : 'text-muted-foreground'}`}
                          data-testid={`social-post-count-${idx}`}
                        >
                          {post.length}/{template.charLimit}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => handleCopyOne(idx)}
                          data-testid={`social-copy-post-${idx}`}
                        >
                          {copiedIdx === idx ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                    <textarea
                      data-testid={`social-post-textarea-${idx}`}
                      value={post}
                      onChange={(e) => handleEditPost(idx, e.target.value)}
                      className="w-full min-h-[80px] rounded-md border border-input bg-background p-2.5 text-sm leading-relaxed resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      spellCheck
                    />
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          {phase === 'input' && (
            <>
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleRun} disabled={!rootNodeId} data-testid="social-generate">
                <Sparkles className="h-4 w-4 mr-1" />
                {mode === 'thread' ? 'Write thread' : 'Write post'}
              </Button>
            </>
          )}
          {phase === 'running' && (
            <Button disabled>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Writing…
            </Button>
          )}
          {phase === 'preview' && (
            <TooltipProvider delayDuration={300}>
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 w-full">
                <Button variant="ghost" size="sm" onClick={() => setPhase('input')} data-testid="social-redraft">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Redraft
                </Button>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        onClick={handleCopyThread}
                        data-testid="social-copy-thread"
                        data-thread-text={threadText}
                        disabled={posts.length === 0}
                      >
                        {copiedThread ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                        {copiedThread ? 'Copied' : mode === 'thread' && posts.length > 1 ? 'Copy thread' : 'Copy post'}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy all posts, numbered, ready to paste one at a time.</TooltipContent>
                  </Tooltip>
                  {template.buildIntentUrl && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          onClick={handleOpenIntent}
                          data-testid="social-open-intent"
                          data-intent-url={intentUrl}
                          disabled={posts.length === 0}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          {template.intentLabel || `Open in ${template.label}`}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">{template.intentNote}</TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleDownload}
                        data-testid="social-download"
                        disabled={posts.length === 0}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Save the posts as a .txt file.</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </TooltipProvider>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
