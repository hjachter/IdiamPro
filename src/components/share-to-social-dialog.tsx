'use client';

/**
 * Share to Social dialog (2026-07-22).
 *
 * The social-media output wizard. Turns a selected BRANCH (a node + all its
 * descendants — the same "chapter" scope Generate Video / Export Email use) into
 * ready-to-post social content. Driven by the social-format template registry
 * (src/lib/social-templates.ts) so platforms slot in as data, not new plumbing.
 *
 * Two output families, chosen by the selected template's `outputKind`:
 *
 *   TEXT (X) — a thread or single post. Phases: input → running → preview, with
 *   an editable per-post preview and Copy / Open-in-X-intent / Download .txt.
 *
 *   INSTAGRAM — two modes:
 *     • Caption  — an AI caption + natural hashtags. Copy / Download .txt.
 *     • Carousel — short punchy slide lines rendered into REAL branded square
 *       1080×1080 PNG images (reusing the Generate Video branding: theme /
 *       accent / brand / logo), plus the caption + hashtags. Hand-off is
 *       Download the images (a .zip) + Copy the caption, with an HONEST note
 *       that Instagram posts from the phone — we never fake an "Open in
 *       Instagram" compose intent (Instagram has no usable web one).
 *
 * Reuses the existing AI pipeline (Gemini with Ollama fallback, BYOK keys). Each
 * draft counts as 1 AI generation, gated through useAIUsageGate('shareSocial').
 * NO direct posting and NO paywall — copy / download only, by design.
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
import { Share2, Loader2, AlertTriangle, Cpu, ArrowLeft, Sparkles, Copy, Download, Check, ExternalLink, Instagram, Images, Smartphone, Linkedin, Facebook, ClipboardPaste, Youtube, Video, Film } from 'lucide-react';
import { generateSocialPostAction, generateInstagramPostAction, generateYoutubeShareAction } from '@/app/actions';
import type { YoutubeVariant, YoutubeSharePackage } from '@/ai/flows/generate-youtube-package';
import { isLocalAIReachable, notifyLocalAIDown } from '@/lib/local-ai';
import { serializeSubtree } from '@/lib/transform-outline-helpers';
import { getUserApiKey } from '@/lib/byok-keys';
import { useAIUsageGate } from '@/lib/use-ai-usage-gate';
import { useVoiceProfile } from '@/lib/use-voice-profile';
import { openExternalUrl, isElectron } from '@/lib/electron-storage';
import { useToast } from '@/hooks/use-toast';
import { SOCIAL_TEMPLATES, getSocialTemplate, type SocialPostMode, type SocialTemplate } from '@/lib/social-templates';
import { useSocialExportSettings } from '@/lib/use-social-export-settings';
import { loadVideoStyle, saveVideoStyle, ACCENT_PRESETS, type VideoStyle } from '@/lib/video/video-style';
import {
  renderCarousel,
  downloadCarouselZip,
  triggerDownload,
  type CarouselSlideInput,
  type RenderedCarouselSlide,
} from '@/lib/instagram/render-carousel';
import type { InstagramMode, InstagramSlideSpec } from '@/ai/flows/generate-instagram-post';
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
  /** Jump to the existing Generate Video flow (the actual MP4). Used by the
   *  YouTube template to connect the publish package to the real video. When
   *  omitted (feature flag off), the dialog just points the user to it in words. */
  onOpenGenerateVideo?: () => void;
}

type Phase = 'input' | 'running' | 'preview';

/** Number a set of posts into a copy-ready thread (e.g. "1/5\n<post>"). */
function buildThreadText(posts: string[], mode: SocialPostMode): string {
  if (mode === 'single' || posts.length <= 1) return posts.join('\n\n');
  return posts.map((p, i) => `${i + 1}/${posts.length}\n${p}`).join('\n\n');
}

/** Safe filename from the branch label + platform. */
function makeFilename(scopeLabel: string | undefined, platform: SocialTemplate, ext: string): string {
  const base = (scopeLabel || 'post')
    .replace(/[^a-z0-9\- ]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50);
  return `${base || 'post'}-${platform.id}.${ext}`;
}

/** Caption + a blank line + the hashtags on one line — the copy/download payload. */
function captionWithTags(caption: string, hashtags: string[]): string {
  const tags = hashtags.join(' ').trim();
  return tags ? `${caption.trim()}\n\n${tags}` : caption.trim();
}

/** Small brand-neutral X glyph so we don't depend on a lucide "X-logo" icon. */
function XGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817-5.966 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/** Threads glyph — lucide has no Threads icon, so render the brand mark. */
function ThreadsGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.781 3.63 2.695 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.324.145 1.52.715 2.631 1.796 3.213 3.13.809 1.857.884 4.883-1.586 7.294-1.888 1.844-4.181 2.667-7.31 2.69Z" />
    </svg>
  );
}

/** Bluesky glyph — lucide has no Bluesky icon, so render the butterfly mark. */
function BlueskyGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M5.06 3.68c2.09 1.57 4.34 4.75 5.16 6.46.31.65.42.98.42 1.36 0-.38.11-.71.42-1.36.83-1.71 3.07-4.89 5.16-6.46 1.51-1.13 3.96-2.01 3.96.79 0 .56-.32 4.7-.51 5.37-.66 2.34-3.04 2.93-5.16 2.57 3.7.63 4.65 2.72 2.61 4.81-3.86 3.98-5.55-1-5.99-2.28-.08-.23-.12-.34-.12-.25 0-.09-.04.02-.12.25-.44 1.28-2.13 6.26-5.99 2.28-2.03-2.09-1.09-4.18 2.62-4.81-2.13.36-4.5-.23-5.16-2.57-.19-.67-.51-4.81-.51-5.37 0-2.8 2.45-1.92 3.96-.79Z" />
    </svg>
  );
}

function PlatformIcon({ tpl, className }: { tpl: SocialTemplate; className?: string }) {
  if (tpl.iconKey === 'x') return <XGlyph className={className} />;
  if (tpl.iconKey === 'instagram') return <Instagram className={className} />;
  if (tpl.iconKey === 'linkedin') return <Linkedin className={className} />;
  if (tpl.iconKey === 'facebook') return <Facebook className={className} />;
  if (tpl.iconKey === 'threads') return <ThreadsGlyph className={className} />;
  if (tpl.iconKey === 'bluesky') return <BlueskyGlyph className={className} />;
  if (tpl.iconKey === 'youtube') return <Youtube className={className} />;
  return <Share2 className={className} />;
}

/** Assemble the full YouTube package into one copy/download-ready text block. */
function youtubePackageToText(pkg: YoutubeSharePackage, variant: YoutubeVariant): string {
  const lines: string[] = [];
  const scriptLabel = variant === 'shorts' ? 'SCRIPT' : 'DESCRIPTION';
  lines.push('TITLE OPTIONS');
  pkg.titleOptions.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
  lines.push('');
  lines.push(scriptLabel);
  lines.push(pkg.description);
  lines.push('');
  lines.push('TAGS');
  lines.push(pkg.tags.join(', '));
  if (pkg.thumbnailIdea) {
    lines.push('');
    lines.push('THUMBNAIL IDEA');
    lines.push(pkg.thumbnailIdea);
  }
  return lines.join('\n').trim();
}

/** YouTube's public upload page. It can't be pre-filled (that needs OAuth), so
 *  the honest hand-off just opens it for the user to fill in by pasting. */
const YOUTUBE_UPLOAD_URL = 'https://youtube.com/upload';

export default function ShareToSocialDialog({
  open,
  onOpenChange,
  nodes,
  rootNodeId,
  scopeLabel,
  outlineName,
  onOpenGenerateVideo,
}: ShareToSocialDialogProps) {
  const { gate } = useAIUsageGate();
  const { voiceAvailable, voiceProfile } = useVoiceProfile();
  const {
    shareToXAvailable,
    shareToInstagramAvailable,
    shareToLinkedInAvailable,
    shareToFacebookAvailable,
    shareToThreadsAvailable,
    shareToBlueskyAvailable,
    shareToYouTubeAvailable,
  } = useSocialExportSettings();
  const { toast } = useToast();

  // Only show platforms whose sub-toggle is on right now.
  const availableTemplates = useMemo(
    () =>
      SOCIAL_TEMPLATES.filter((t) => {
        if (t.id === 'x') return shareToXAvailable;
        if (t.id === 'instagram') return shareToInstagramAvailable;
        if (t.id === 'linkedin') return shareToLinkedInAvailable;
        if (t.id === 'facebook') return shareToFacebookAvailable;
        if (t.id === 'threads') return shareToThreadsAvailable;
        if (t.id === 'bluesky') return shareToBlueskyAvailable;
        if (t.id === 'youtube') return shareToYouTubeAvailable;
        return true;
      }),
    [
      shareToXAvailable,
      shareToInstagramAvailable,
      shareToLinkedInAvailable,
      shareToFacebookAvailable,
      shareToThreadsAvailable,
      shareToBlueskyAvailable,
      shareToYouTubeAvailable,
    ],
  );

  const [phase, setPhase] = useState<Phase>('input');
  const [platformId, setPlatformId] = useState<string>(SOCIAL_TEMPLATES[0]?.id ?? 'x');
  const [mode, setMode] = useState<SocialPostMode>('thread');
  const [inMyVoice, setInMyVoice] = useState(false);
  const [guidance, setGuidance] = useState('');
  const [useLocal, setUseLocal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [modelLabel, setModelLabel] = useState<string | null>(null);

  // TEXT (X) preview state.
  const [posts, setPosts] = useState<string[]>([]);
  const [copiedThread, setCopiedThread] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // INSTAGRAM state.
  const [igMode, setIgMode] = useState<InstagramMode>('carousel');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [rendered, setRendered] = useState<RenderedCarouselSlide[]>([]);
  const [brand, setBrand] = useState<VideoStyle | null>(null);
  const [copiedCaption, setCopiedCaption] = useState(false);

  // YOUTUBE state.
  const [ytVariant, setYtVariant] = useState<YoutubeVariant>('standard');
  const [ytPkg, setYtPkg] = useState<YoutubeSharePackage | null>(null);
  const [ytCopied, setYtCopied] = useState<'title' | 'description' | 'tags' | 'all' | null>(null);

  const template = useMemo(() => getSocialTemplate(platformId) ?? SOCIAL_TEMPLATES[0], [platformId]);
  const isInstagram = template.outputKind === 'instagram';
  const isYoutube = template.outputKind === 'youtube';

  useEffect(() => {
    if (open) {
      // Default to the first AVAILABLE platform so the picker never lands on a
      // hidden one.
      const first = availableTemplates[0]?.id ?? SOCIAL_TEMPLATES[0]?.id ?? 'x';
      setPhase('input');
      setPlatformId(first);
      setMode('thread');
      setIgMode('carousel');
      setInMyVoice(false);
      setGuidance('');
      setUseLocal(false);
      setErrorMsg(null);
      setModelLabel(null);
      setPosts([]);
      setCopiedThread(false);
      setCopiedIdx(null);
      setCaption('');
      setHashtags([]);
      setRendered([]);
      setCopiedCaption(false);
      setBrand(loadVideoStyle());
      setYtVariant('standard');
      setYtPkg(null);
      setYtCopied(null);
    }
  }, [open, availableTemplates]);

  // If the selected TEXT mode isn't supported by the platform, fall back. Only
  // meaningful for text platforms — Instagram and YouTube have their own format
  // controls and support NEITHER thread nor single, so guarding them here also
  // prevents an infinite thread↔single flip loop.
  useEffect(() => {
    if (isInstagram || isYoutube) return;
    if (mode === 'thread' && !template.supportsThread) setMode('single');
    if (mode === 'single' && !template.supportsSingle) setMode('thread');
  }, [template, mode, isInstagram, isYoutube]);

  const threadText = useMemo(() => buildThreadText(posts, mode), [posts, mode]);
  const intentUrl = useMemo(
    () => (template.buildIntentUrl && posts[0] ? template.buildIntentUrl(posts[0]) : ''),
    [template, posts],
  );

  const handleClose = () => onOpenChange(false);

  const updateBrand = (patch: Partial<VideoStyle>) => {
    setBrand((prev) => {
      const next = { ...(prev ?? loadVideoStyle()), ...patch };
      saveVideoStyle(next);
      return next;
    });
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

  // --- TEXT (X) generation --------------------------------------------------
  const runText = async () => {
    setErrorMsg(null);
    setPhase('running');
    try {
      const { subtreeNodes } = serializeSubtree(nodes!, rootNodeId!);
      const userApiKey = getUserApiKey('gemini');
      const r = await generateSocialPostAction({
        subtreeNodes,
        rootNodeId: rootNodeId!,
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
      setErrorMsg(`The draft didn't go through. ${raw ? `Reason: ${raw}. ` : ''}You can try again, switch to local AI, or check your API key in Settings.`);
      setPhase('input');
    }
  };

  // --- INSTAGRAM generation -------------------------------------------------
  const runInstagram = async () => {
    setErrorMsg(null);
    setPhase('running');
    try {
      const { subtreeNodes } = serializeSubtree(nodes!, rootNodeId!);
      const userApiKey = getUserApiKey('gemini');
      const r = await generateInstagramPostAction({
        subtreeNodes,
        rootNodeId: rootNodeId!,
        currentOutlineName: outlineName,
        mode: igMode,
        guidance: guidance.trim() || undefined,
        voiceProfile: inMyVoice && voiceAvailable ? voiceProfile.trim() : undefined,
        useLocal,
        userApiKey,
      });
      if (r.error || (igMode === 'caption' ? !r.caption : r.slides.length < 2)) {
        setErrorMsg(
          `I couldn't create your Instagram ${igMode}. ${r.error || 'The AI returned nothing usable.'} You can try again, switch to local AI, or check your API key in Settings.`,
        );
        setPhase('input');
        return;
      }
      setCaption(r.caption);
      setHashtags(r.hashtags);
      setModelLabel(r.model);

      if (igMode === 'carousel') {
        const b = brand ?? loadVideoStyle();
        const specs: CarouselSlideInput[] = (r.slides as InstagramSlideSpec[]).map((s) => ({
          title: s.title,
          subtitle: s.subtitle,
          kind: s.kind,
        }));
        const imgs = await renderCarousel(specs, {
          theme: b.theme,
          accent: b.accent,
          brandLabel: b.brandLabel,
          logoDataUrl: b.logoDataUrl,
        });
        if (imgs.length === 0) {
          setErrorMsg('I drafted your slides but could not render the images in this environment. Try again, or use the Caption mode.');
          setPhase('input');
          return;
        }
        setRendered(imgs);
      } else {
        setRendered([]);
      }
      setPhase('preview');
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setErrorMsg(`The draft didn't go through. ${raw ? `Reason: ${raw}. ` : ''}You can try again, switch to local AI, or check your API key in Settings.`);
      setPhase('input');
    }
  };

  // --- YOUTUBE generation ---------------------------------------------------
  const runYoutube = async () => {
    setErrorMsg(null);
    setPhase('running');
    try {
      const { subtreeNodes } = serializeSubtree(nodes!, rootNodeId!);
      const userApiKey = getUserApiKey('gemini');
      const r = await generateYoutubeShareAction({
        subtreeNodes,
        rootNodeId: rootNodeId!,
        currentOutlineName: outlineName,
        variant: ytVariant,
        guidance: guidance.trim() || undefined,
        voiceProfile: inMyVoice && voiceAvailable ? voiceProfile.trim() : undefined,
        useLocal,
        userApiKey,
      });
      if (r.error || !r.package) {
        setErrorMsg(
          `I couldn't build your YouTube ${ytVariant === 'shorts' ? 'Shorts idea' : 'publish package'}. ${r.error || 'The AI returned nothing usable.'} You can try again, switch to local AI, or check your API key in Settings.`,
        );
        setPhase('input');
        return;
      }
      setYtPkg(r.package);
      setModelLabel(r.model);
      setPhase('preview');
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setErrorMsg(`The draft didn't go through. ${raw ? `Reason: ${raw}. ` : ''}You can try again, switch to local AI, or check your API key in Settings.`);
      setPhase('input');
    }
  };

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
    if (isYoutube) await runYoutube();
    else if (isInstagram) await runInstagram();
    else await runText();
  };

  // --- TEXT hand-offs -------------------------------------------------------
  const handleEditPost = (idx: number, value: string) => {
    setPosts((prev) => prev.map((p, i) => (i === idx ? value : p)));
  };

  const handleCopyThread = async () => {
    const ok = await copyText(threadText);
    if (ok) {
      setCopiedThread(true);
      toast({
        title: mode === 'thread' && posts.length > 1 ? 'Thread copied' : 'Post copied',
        description: mode === 'thread' && posts.length > 1
          ? 'All posts copied, numbered and ready to paste one at a time.'
          : `Paste it into ${template.label} and post.`,
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
    if (isElectron()) void openExternalUrl(intentUrl);
    else window.open(intentUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadText = () => {
    try {
      const blob = new Blob([threadText], { type: 'text/plain;charset=utf-8' });
      triggerDownload(blob, makeFilename(scopeLabel, template, template.fileExtension));
      toast({ title: 'Downloaded', description: 'Saved the posts as a text file.' });
    } catch {
      toast({ variant: 'destructive', title: 'Download failed', description: 'Could not create the file.' });
    }
  };

  // --- INSTAGRAM hand-offs --------------------------------------------------
  const handleCopyCaption = async () => {
    const ok = await copyText(captionWithTags(caption, hashtags));
    if (ok) {
      setCopiedCaption(true);
      toast({ title: 'Caption copied', description: 'Caption and hashtags copied — paste them into Instagram.' });
      window.setTimeout(() => setCopiedCaption(false), 2000);
    } else {
      toast({ variant: 'destructive', title: 'Copy failed', description: 'Your browser blocked clipboard access.' });
    }
  };

  const handleDownloadCaption = () => {
    try {
      const blob = new Blob([captionWithTags(caption, hashtags)], { type: 'text/plain;charset=utf-8' });
      triggerDownload(blob, makeFilename(scopeLabel, template, 'txt'));
      toast({ title: 'Downloaded', description: 'Saved the caption and hashtags as a text file.' });
    } catch {
      toast({ variant: 'destructive', title: 'Download failed', description: 'Could not create the file.' });
    }
  };

  const handleDownloadCarousel = async () => {
    if (rendered.length === 0) return;
    try {
      await downloadCarouselZip(rendered, scopeLabel || 'instagram');
      toast({ title: 'Carousel downloaded', description: `${rendered.length} branded slides saved in a zip — post them from the Instagram app.` });
    } catch {
      toast({ variant: 'destructive', title: 'Download failed', description: 'Could not create the image file.' });
    }
  };

  // --- YOUTUBE hand-offs ----------------------------------------------------
  const updateYtPkg = <K extends keyof YoutubeSharePackage>(key: K, value: YoutubeSharePackage[K]) => {
    setYtPkg((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const flashYtCopied = (which: 'title' | 'description' | 'tags' | 'all') => {
    setYtCopied(which);
    window.setTimeout(() => setYtCopied((c) => (c === which ? null : c)), 1800);
  };

  const handleYtCopyTitle = async () => {
    if (!ytPkg || ytPkg.titleOptions.length === 0) return;
    const ok = await copyText(ytPkg.titleOptions[0]);
    if (ok) {
      flashYtCopied('title');
      toast({ title: 'Title copied', description: 'Paste it into the YouTube title field.' });
    } else {
      toast({ variant: 'destructive', title: 'Copy failed', description: 'Your browser blocked clipboard access.' });
    }
  };

  const handleYtCopyDescription = async () => {
    if (!ytPkg) return;
    const ok = await copyText(ytPkg.description);
    if (ok) {
      flashYtCopied('description');
      toast({ title: ytVariant === 'shorts' ? 'Script copied' : 'Description copied', description: 'Paste it into YouTube.' });
    } else {
      toast({ variant: 'destructive', title: 'Copy failed', description: 'Your browser blocked clipboard access.' });
    }
  };

  const handleYtCopyTags = async () => {
    if (!ytPkg) return;
    const ok = await copyText(ytPkg.tags.join(', '));
    if (ok) {
      flashYtCopied('tags');
      toast({ title: 'Tags copied', description: 'Paste them into the YouTube tags field.' });
    } else {
      toast({ variant: 'destructive', title: 'Copy failed', description: 'Your browser blocked clipboard access.' });
    }
  };

  const handleYtCopyAll = async () => {
    if (!ytPkg) return;
    const ok = await copyText(youtubePackageToText(ytPkg, ytVariant));
    if (ok) {
      flashYtCopied('all');
      toast({ title: 'Package copied', description: 'The whole package is on your clipboard.' });
    } else {
      toast({ variant: 'destructive', title: 'Copy failed', description: 'Your browser blocked clipboard access.' });
    }
  };

  const handleYtDownload = () => {
    if (!ytPkg) return;
    try {
      const blob = new Blob([youtubePackageToText(ytPkg, ytVariant)], { type: 'text/plain;charset=utf-8' });
      triggerDownload(blob, makeFilename(scopeLabel, template, 'txt'));
      toast({ title: 'Downloaded', description: 'Saved the YouTube package as a text file.' });
    } catch {
      toast({ variant: 'destructive', title: 'Download failed', description: 'Could not create the file.' });
    }
  };

  const handleYtOpenUpload = () => {
    if (isElectron()) void openExternalUrl(YOUTUBE_UPLOAD_URL);
    else window.open(YOUTUBE_UPLOAD_URL, '_blank', 'noopener,noreferrer');
  };

  const handleYtGenerateVideo = () => {
    // Reuse the existing Generate Video flow for the actual MP4 — never
    // reimplement video here. Close this dialog, then open Generate Video.
    onOpenChange(false);
    onOpenGenerateVideo?.();
  };

  const igGenerateLabel = igMode === 'carousel' ? 'Design carousel' : 'Write caption';
  const ytGenerateLabel = ytVariant === 'shorts' ? 'Write Shorts idea' : 'Write package';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] flex flex-col" data-testid="share-to-social-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isYoutube ? <Youtube className="h-5 w-5" /> : isInstagram ? <Instagram className="h-5 w-5" /> : <Share2 className="h-5 w-5" />}
            {isYoutube ? 'Share to YouTube' : isInstagram ? 'Share to Instagram' : 'Share to Social'}
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
              {/* Platform picker — only shows platforms whose switch is on. */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Platform</Label>
                <div className="flex flex-wrap gap-2">
                  {availableTemplates.map((tpl) => (
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
              </div>

              {/* ── TEXT (X): Thread vs Single post ── */}
              {!isInstagram && !isYoutube && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Format</Label>
                  <RadioGroup value={mode} onValueChange={(v) => setMode(v as SocialPostMode)} className="gap-2">
                    {template.supportsThread && (
                      <div className="flex items-start gap-2">
                        <RadioGroupItem value="thread" id="social-mode-thread" className="mt-1" data-testid="social-mode-thread" />
                        <Label htmlFor="social-mode-thread" className="font-normal cursor-pointer flex-1">
                          <span className="font-medium">Thread</span>
                          <p className="text-xs text-muted-foreground mt-0.5">A hook post plus follow-on posts, each within {template.charLimit} characters.</p>
                        </Label>
                      </div>
                    )}
                    {template.supportsSingle && (
                      <div className="flex items-start gap-2">
                        <RadioGroupItem value="single" id="social-mode-single" className="mt-1" data-testid="social-mode-single" />
                        <Label htmlFor="social-mode-single" className="font-normal cursor-pointer flex-1">
                          <span className="font-medium">Single post</span>
                          <p className="text-xs text-muted-foreground mt-0.5">Condense the whole branch into one post within {template.charLimit} characters.</p>
                        </Label>
                      </div>
                    )}
                  </RadioGroup>
                </div>
              )}

              {/* ── INSTAGRAM: Caption vs Carousel ── */}
              {isInstagram && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Format</Label>
                    <RadioGroup value={igMode} onValueChange={(v) => setIgMode(v as InstagramMode)} className="gap-2">
                      <div className="flex items-start gap-2">
                        <RadioGroupItem value="carousel" id="ig-mode-carousel" className="mt-1" data-testid="ig-mode-carousel" />
                        <Label htmlFor="ig-mode-carousel" className="font-normal cursor-pointer flex-1">
                          <span className="font-medium flex items-center gap-1.5"><Images className="h-3.5 w-3.5" /> Carousel</span>
                          <p className="text-xs text-muted-foreground mt-0.5">A set of branded square slides (a hook cover plus one point per card), ready to download and post — plus a caption.</p>
                        </Label>
                      </div>
                      <div className="flex items-start gap-2">
                        <RadioGroupItem value="caption" id="ig-mode-caption" className="mt-1" data-testid="ig-mode-caption" />
                        <Label htmlFor="ig-mode-caption" className="font-normal cursor-pointer flex-1">
                          <span className="font-medium">Caption</span>
                          <p className="text-xs text-muted-foreground mt-0.5">A ready-to-paste Instagram caption with natural hashtags.</p>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Carousel branding — reuses the Generate Video look. */}
                  {igMode === 'carousel' && brand && (
                    <TooltipProvider delayDuration={300}>
                      <div className="space-y-3 rounded-md border border-border/60 p-3">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Slide branding</Label>
                        <div className="flex flex-wrap items-center gap-4">
                          {/* Theme */}
                          <div className="inline-flex rounded-md border p-0.5">
                            {(['dark', 'light'] as const).map((t) => (
                              <button
                                key={t}
                                type="button"
                                data-testid={`ig-theme-${t}`}
                                onClick={() => updateBrand({ theme: t })}
                                className={`px-3 py-1 text-xs rounded-[5px] capitalize transition-colors ${brand.theme === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                          {/* Accent */}
                          <div className="flex items-center gap-1.5">
                            {ACCENT_PRESETS.map((p) => {
                              const selected = brand.accent.toLowerCase() === p.hex.toLowerCase();
                              return (
                                <Tooltip key={p.hex}>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      aria-label={p.name}
                                      onClick={() => updateBrand({ accent: p.hex })}
                                      className={`h-6 w-6 rounded-full transition-transform hover:scale-110 ${selected ? 'ring-2 ring-offset-1 ring-offset-background ring-foreground' : ''}`}
                                      style={{ backgroundColor: p.hex }}
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent>{p.name}</TooltipContent>
                                </Tooltip>
                              );
                            })}
                          </div>
                        </div>
                        <Input
                          value={brand.brandLabel}
                          onChange={(e) => updateBrand({ brandLabel: e.target.value })}
                          placeholder="Your name or brand (shown on each slide)"
                          className="text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                          Uses the same branding as Generate Video{brand.logoDataUrl ? ' — including your uploaded logo' : ' — add a logo in Generate Video to show it here'}.
                        </p>
                      </div>
                    </TooltipProvider>
                  )}
                </>
              )}

              {/* ── YOUTUBE: Standard package vs Shorts idea ── */}
              {isYoutube && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Format</Label>
                    <RadioGroup value={ytVariant} onValueChange={(v) => setYtVariant(v as YoutubeVariant)} className="gap-2">
                      <div className="flex items-start gap-2">
                        <RadioGroupItem value="standard" id="yt-variant-standard" className="mt-1" data-testid="yt-variant-standard" />
                        <Label htmlFor="yt-variant-standard" className="font-normal cursor-pointer flex-1">
                          <span className="font-medium flex items-center gap-1.5"><Youtube className="h-3.5 w-3.5" /> Publish package</span>
                          <p className="text-xs text-muted-foreground mt-0.5">Title options, a description with chapter timestamps, tags, and a thumbnail idea — everything you paste in when you upload the video.</p>
                        </Label>
                      </div>
                      <div className="flex items-start gap-2">
                        <RadioGroupItem value="shorts" id="yt-variant-shorts" className="mt-1" data-testid="yt-variant-shorts" />
                        <Label htmlFor="yt-variant-shorts" className="font-normal cursor-pointer flex-1">
                          <span className="font-medium flex items-center gap-1.5"><Film className="h-3.5 w-3.5" /> Shorts</span>
                          <p className="text-xs text-muted-foreground mt-0.5">A punchy vertical idea: a short hook title plus a tight script for a clip under 60 seconds. (Ties to future short-form video.)</p>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Connect to the actual MP4 — reuse Generate Video, never rebuild it. */}
                  <div className="flex items-start gap-2 rounded-md border border-border/60 p-3" data-testid="yt-generate-video-note">
                    <Video className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="grid gap-1.5">
                      <p className="text-xs text-muted-foreground">
                        This writes the words that go with your video. The video itself comes from <span className="font-medium text-foreground">Generate Video</span>, which turns this branch into a narrated slideshow MP4.
                      </p>
                      {onOpenGenerateVideo && (
                        <Button variant="outline" size="sm" className="h-7 w-fit text-xs" onClick={handleYtGenerateVideo} data-testid="yt-open-generate-video">
                          <Video className="h-3.5 w-3.5 mr-1" />
                          Generate the video
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              )}

              {voiceAvailable && (
                <div className="flex items-start gap-2 pt-1">
                  <Checkbox id="social-in-my-voice" data-testid="social-in-my-voice" checked={inMyVoice} onCheckedChange={(c) => setInMyVoice(!!c)} />
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
                          Write the {isYoutube ? 'title and description' : isInstagram ? 'caption' : 'posts'} in your own style, learned from your samples in Settings &rarr; Professional Customization &rarr; Your Voice.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <p className="text-xs text-muted-foreground">Uses your saved voice profile so the {isYoutube ? 'title and description sound' : isInstagram ? 'caption sounds' : 'posts sound'} like you.</p>
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
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleRun(); } }}
                />
              </div>

              <div className="flex items-start gap-2 pt-1">
                <Checkbox id="social-local" checked={useLocal} onCheckedChange={(c) => setUseLocal(!!c)} />
                <div className="grid gap-1">
                  <Label htmlFor="social-local" className="text-sm font-medium cursor-pointer">
                    <Cpu className="inline h-3.5 w-3.5 mr-1" />
                    Use local AI (Ollama)
                  </Label>
                  <p className="text-xs text-muted-foreground">Slower but private — the draft runs entirely on your machine.</p>
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
            <p className="text-sm text-muted-foreground">
              {isYoutube
                ? ytVariant === 'shorts' ? 'Writing your YouTube Shorts idea…' : 'Building your YouTube publish package…'
                : isInstagram
                ? igMode === 'carousel' ? 'Writing and designing your carousel slides…' : 'Writing your Instagram caption…'
                : `Writing your ${template.label} ${mode === 'thread' ? 'thread' : 'post'}…`}
            </p>
          </div>
        )}

        {/* ── TEXT (X) preview ── */}
        {phase === 'preview' && !isInstagram && !isYoutube && (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2 text-sm flex-wrap">
                {modelLabel && <Badge variant="secondary">{modelLabel}</Badge>}
                <Badge variant="outline" data-testid="social-post-count">{posts.length} {posts.length === 1 ? 'post' : 'posts'}</Badge>
                <span className="text-muted-foreground text-xs">Edit any post before you post it.</span>
              </div>
              {/* Honest per-platform note. Platforms WITH a compose intent (X,
                  Threads) only need the "first post prefilled" note when there's
                  a multi-post thread. Platforms WITHOUT one (LinkedIn, Facebook)
                  always show the copy-and-paste-yourself note. */}
              {template.intentNote &&
                (template.buildIntentUrl ? mode === 'thread' && posts.length > 1 : true) && (
                  <p
                    className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400"
                    data-testid="social-honest-note"
                  >
                    {!template.buildIntentUrl && <ClipboardPaste className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
                    <span>{template.intentNote}</span>
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
                        <span className={`text-xs tabular-nums ${over ? 'text-destructive font-medium' : 'text-muted-foreground'}`} data-testid={`social-post-count-${idx}`}>
                          {post.length}/{template.charLimit}
                        </span>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => handleCopyOne(idx)} data-testid={`social-copy-post-${idx}`}>
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

        {/* ── INSTAGRAM preview ── */}
        {phase === 'preview' && isInstagram && (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 text-sm flex-wrap">
                {modelLabel && <Badge variant="secondary">{modelLabel}</Badge>}
                {igMode === 'carousel' && (
                  <Badge variant="outline" data-testid="ig-slide-count">{rendered.length} slides</Badge>
                )}
              </div>

              {igMode === 'carousel' && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Carousel slides</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" data-testid="ig-carousel-images">
                    {rendered.map((s, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={s.name}
                        src={s.dataUrl}
                        alt={`Carousel slide ${i + 1}`}
                        data-testid={`ig-slide-img-${i}`}
                        className="w-full aspect-square rounded-md border object-cover"
                      />
                    ))}
                  </div>
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs" data-testid="ig-honest-note">
                    <Smartphone className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                    <span>Instagram posts from your phone — download these images and post them from the Instagram app. IdeaM never posts for you.</span>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Caption</Label>
                <textarea
                  data-testid="ig-caption-textarea"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full min-h-[120px] rounded-md border border-input bg-background p-2.5 text-sm leading-relaxed resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  spellCheck
                />
              </div>

              {hashtags.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Hashtags</Label>
                  <p className="text-sm text-primary break-words" data-testid="ig-hashtags">{hashtags.join(' ')}</p>
                </div>
              )}

              {igMode === 'caption' && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs" data-testid="ig-honest-note">
                  <Smartphone className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                  <span>Instagram posts from your phone — copy this caption and post from the Instagram app. IdeaM never posts for you.</span>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* ── YOUTUBE preview ── */}
        {phase === 'preview' && isYoutube && ytPkg && (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 py-2" data-testid="yt-preview">
              <div className="flex items-center gap-2 text-sm flex-wrap">
                {modelLabel && <Badge variant="secondary">{modelLabel}</Badge>}
                <Badge variant="outline">{ytVariant === 'shorts' ? 'Shorts idea' : 'Publish package'}</Badge>
                <span className="text-muted-foreground text-xs">Edit anything before you use it.</span>
              </div>

              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  {ytVariant === 'shorts' ? 'Shorts title options' : 'Title options'}
                </Label>
                <textarea
                  data-testid="yt-title-textarea"
                  value={ytPkg.titleOptions.join('\n')}
                  onChange={(e) => updateYtPkg('titleOptions', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
                  className="w-full min-h-[70px] rounded-md border border-input bg-background p-2.5 text-sm leading-relaxed resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  spellCheck
                />
                <p className="text-xs text-muted-foreground">One title per line. Copy uses the first one.</p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  {ytVariant === 'shorts' ? 'Script (under 60s)' : 'Description with chapters'}
                </Label>
                <textarea
                  data-testid="yt-description-textarea"
                  value={ytPkg.description}
                  onChange={(e) => updateYtPkg('description', e.target.value)}
                  className="w-full min-h-[160px] rounded-md border border-input bg-background p-2.5 text-sm leading-relaxed resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  spellCheck
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Tags</Label>
                <textarea
                  data-testid="yt-tags-textarea"
                  value={ytPkg.tags.join(', ')}
                  onChange={(e) => updateYtPkg('tags', e.target.value.split(',').map((s) => s.trim().replace(/^#+/, '')).filter(Boolean))}
                  className="w-full min-h-[60px] rounded-md border border-input bg-background p-2.5 text-sm leading-relaxed resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  spellCheck={false}
                />
                <p className="text-xs text-muted-foreground">Comma-separated.</p>
              </div>

              {ytPkg.thumbnailIdea && (
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Thumbnail idea</Label>
                  <textarea
                    data-testid="yt-thumbnail-textarea"
                    value={ytPkg.thumbnailIdea}
                    onChange={(e) => updateYtPkg('thumbnailIdea', e.target.value)}
                    className="w-full min-h-[60px] rounded-md border border-input bg-background p-2.5 text-sm leading-relaxed resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    spellCheck
                  />
                </div>
              )}

              {/* Connect to the actual MP4 + honest upload note. */}
              <div className="flex items-start gap-2 rounded-md border border-border/60 p-2.5 text-xs" data-testid="yt-video-link">
                <Video className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="grid gap-1.5">
                  <span className="text-muted-foreground">Need the video? <span className="font-medium text-foreground">Generate Video</span> turns this branch into a narrated MP4.</span>
                  {onOpenGenerateVideo && (
                    <Button variant="outline" size="sm" className="h-7 w-fit text-xs" onClick={handleYtGenerateVideo} data-testid="yt-open-generate-video-preview">
                      <Video className="h-3.5 w-3.5 mr-1" />
                      Generate the video
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs" data-testid="yt-honest-note">
                <ClipboardPaste className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                <span>Generate your video, then upload it to YouTube and paste this title, description, and tags. YouTube uploads need you to be signed in and can’t be pre-filled — IdeaM never posts for you.</span>
              </div>
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          {phase === 'input' && (
            <>
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleRun} disabled={!rootNodeId} data-testid="social-generate">
                <Sparkles className="h-4 w-4 mr-1" />
                {isYoutube ? ytGenerateLabel : isInstagram ? igGenerateLabel : mode === 'thread' ? 'Write thread' : 'Write post'}
              </Button>
            </>
          )}
          {phase === 'running' && (
            <Button disabled>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              {isInstagram && igMode === 'carousel' ? 'Designing…' : 'Writing…'}
            </Button>
          )}
          {phase === 'preview' && (
            <TooltipProvider delayDuration={300}>
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 w-full">
                <Button variant="ghost" size="sm" onClick={() => setPhase('input')} data-testid="social-redraft">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Redraft
                </Button>

                {/* ── TEXT (X) hand-offs ── */}
                {!isInstagram && !isYoutube && (
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" onClick={handleCopyThread} data-testid="social-copy-thread" data-thread-text={threadText} disabled={posts.length === 0}>
                          {copiedThread ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                          {copiedThread ? 'Copied' : mode === 'thread' && posts.length > 1 ? 'Copy thread' : 'Copy post'}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy all posts, numbered, ready to paste one at a time.</TooltipContent>
                    </Tooltip>
                    {template.buildIntentUrl && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" onClick={handleOpenIntent} data-testid="social-open-intent" data-intent-url={intentUrl} disabled={posts.length === 0}>
                            <ExternalLink className="h-4 w-4 mr-1" />
                            {template.intentLabel || `Open in ${template.label}`}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">{template.intentNote}</TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button onClick={handleDownloadText} data-testid="social-download" disabled={posts.length === 0}>
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Save the posts as a .txt file.</TooltipContent>
                    </Tooltip>
                  </div>
                )}

                {/* ── INSTAGRAM hand-offs ── */}
                {isInstagram && (
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" onClick={handleCopyCaption} data-testid="ig-copy-caption" disabled={!caption}>
                          {copiedCaption ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                          {copiedCaption ? 'Copied' : 'Copy caption'}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy the caption and hashtags to paste into Instagram.</TooltipContent>
                    </Tooltip>
                    {igMode === 'caption' ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button onClick={handleDownloadCaption} data-testid="ig-download-caption" disabled={!caption}>
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Save the caption and hashtags as a .txt file.</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button onClick={handleDownloadCarousel} data-testid="ig-download-carousel" disabled={rendered.length === 0}>
                            <Images className="h-4 w-4 mr-1" />
                            Download carousel
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Save all slides as square images in a .zip — post them from the Instagram app.</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )}

                {/* ── YOUTUBE hand-offs — copy title / description / tags / all,
                     download the package, open the real upload page. No fake
                     auto-upload (that needs OAuth, out of scope). ── */}
                {isYoutube && (
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={handleYtCopyTitle} data-testid="yt-copy-title" disabled={!ytPkg || ytPkg.titleOptions.length === 0}>
                          {ytCopied === 'title' ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                          Title
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy the first title to paste into YouTube.</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={handleYtCopyDescription} data-testid="yt-copy-description" disabled={!ytPkg?.description}>
                          {ytCopied === 'description' ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                          {ytVariant === 'shorts' ? 'Script' : 'Description'}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy the {ytVariant === 'shorts' ? 'script' : 'description with chapters'} to paste into YouTube.</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={handleYtCopyTags} data-testid="yt-copy-tags" disabled={!ytPkg || ytPkg.tags.length === 0}>
                          {ytCopied === 'tags' ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                          Tags
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy the tags to paste into YouTube.</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={handleYtCopyAll} data-testid="yt-copy-all" disabled={!ytPkg}>
                          {ytCopied === 'all' ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                          Copy all
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy the whole package at once.</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={handleYtOpenUpload} data-testid="yt-open-upload">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Upload page
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">Opens youtube.com/upload. It can’t be pre-filled — paste the copied fields there yourself.</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" onClick={handleYtDownload} data-testid="yt-download" disabled={!ytPkg}>
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Save the whole package as a .txt file.</TooltipContent>
                    </Tooltip>
                  </div>
                )}
              </div>
            </TooltipProvider>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
