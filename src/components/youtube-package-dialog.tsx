'use client';

/**
 * YouTube package dialog (2026-06-11) — turn a chapter (selected node +
 * its descendants) into a full YouTube content package.
 *
 * Generated outputs (8):
 *   1. Voiceover script (with [shot N] markers + timing cues)
 *   2. Chapter list (YouTube description chapter markers)
 *   3. Description (200-300 words)
 *   4. Title variants (5)
 *   5. SEO tags (15-20)
 *   6. Thumbnail concept (text composition)
 *   7. B-roll prompts (paste-ready for Runway/MagicLight/Sora)
 *   8. Screen-recording shot list (in-app demo steps)
 *
 * The user configures duration/style/audience, runs the generator, then
 * reviews each output in its own tab. Tabs are editable inline. Export to
 * a single markdown file or insert as a new derivative outline.
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Youtube, Loader2, AlertTriangle, Download, FileText } from 'lucide-react';
import type { Outline } from '@/types';
import {
  generateYoutubePackageAction,
  type YoutubePackage,
  type YoutubePackageInput,
} from '@/app/actions';
import { useAIUsageGate } from '@/lib/use-ai-usage-gate';
import { getUserApiKey } from '@/lib/byok-keys';
import { nodeSubtreeToText } from '@/lib/multimedia/insert-proposed-nodes';

interface YoutubePackageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outline: Outline | null;
  selectedNodeId: string | null;
  /** Called with a markdown export string when the user picks the markdown
   *  download option. The parent typically triggers a browser download. */
  onExportMarkdown?: (markdown: string, fileName: string) => void;
  /** Called when the user picks "Save as new outline" — packaged as a
   *  small sub-outline (one node per output) for easy editing/sharing. */
  onSaveAsOutline?: (chapterName: string, pkg: YoutubePackage) => void;
}

type Phase = 'configure' | 'running' | 'preview';

const DURATION_OPTIONS: { value: 60 | 90 | 120 | 300; label: string }[] = [
  { value: 60, label: '60 sec' },
  { value: 90, label: '90 sec' },
  { value: 120, label: '2 min' },
  { value: 300, label: '5 min' },
];

const STYLE_OPTIONS: { value: YoutubePackageInput['style']; label: string }[] = [
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'explainer', label: 'Explainer' },
  { value: 'promo', label: 'Promo' },
  { value: 'story', label: 'Story' },
];

function packageToMarkdown(chapterName: string, pkg: YoutubePackage): string {
  const lines: string[] = [];
  lines.push(`# YouTube package — ${chapterName}`);
  lines.push('');
  lines.push('## Title variants');
  for (const t of pkg.titleVariants) lines.push(`- ${t}`);
  lines.push('');
  lines.push('## Description');
  lines.push(pkg.description);
  lines.push('');
  lines.push('## Chapters');
  lines.push(pkg.chapters);
  lines.push('');
  lines.push('## Voiceover script');
  lines.push(pkg.voiceoverScript);
  lines.push('');
  lines.push('## Thumbnail concept');
  lines.push(pkg.thumbnailConcept);
  lines.push('');
  lines.push('## SEO tags');
  lines.push(pkg.seoTags.join(', '));
  lines.push('');
  lines.push('## B-roll prompts');
  for (const p of pkg.brollPrompts) lines.push(`- ${p}`);
  lines.push('');
  lines.push('## Screen recording shot list');
  for (const s of pkg.screenRecordingShotList) lines.push(`- ${s}`);
  lines.push('');
  return lines.join('\n');
}

export default function YoutubePackageDialog({
  open,
  onOpenChange,
  outline,
  selectedNodeId,
  onExportMarkdown,
  onSaveAsOutline,
}: YoutubePackageDialogProps) {
  const { gate } = useAIUsageGate();
  const [phase, setPhase] = useState<Phase>('configure');
  const [duration, setDuration] = useState<60 | 90 | 120 | 300>(90);
  const [style, setStyle] = useState<YoutubePackageInput['style']>('explainer');
  const [audience, setAudience] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pkg, setPkg] = useState<YoutubePackage | null>(null);
  const [provider, setProvider] = useState<string>('');

  const chapterNode = outline && selectedNodeId ? outline.nodes[selectedNodeId] : null;
  const chapterContext = useMemo(() => {
    if (!outline || !selectedNodeId) return '';
    return nodeSubtreeToText(outline.nodes, selectedNodeId);
  }, [outline, selectedNodeId]);

  const handleClose = () => {
    setPhase('configure');
    setErrorMsg(null);
    setPkg(null);
    setProvider('');
    onOpenChange(false);
  };

  const handleRun = async () => {
    if (!chapterNode) return;
    if (!gate({ feature: 'youtubePackage' })) return;
    setPhase('running');
    setErrorMsg(null);
    try {
      const result = await generateYoutubePackageAction({
        chapterName: chapterNode.name,
        chapterContext,
        durationSeconds: duration,
        style,
        audience,
        userApiKey: getUserApiKey('gemini'),
      });
      if (!result.success || !result.package) {
        setErrorMsg(result.error || 'Could not generate the YouTube package.');
        setPhase('configure');
        return;
      }
      setPkg(result.package);
      setProvider(result.provider || '');
      setPhase('preview');
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setErrorMsg(
        `The YouTube package did not generate. ${raw ? `Reason: ${raw}. ` : ''}You can try again or pick a different chapter.`,
      );
      setPhase('configure');
    }
  };

  const updatePackage = <K extends keyof YoutubePackage>(key: K, value: YoutubePackage[K]) => {
    setPkg(prev => prev ? { ...prev, [key]: value } : prev);
  };

  const handleExportMarkdown = () => {
    if (!pkg || !chapterNode) return;
    const md = packageToMarkdown(chapterNode.name, pkg);
    const fileName = `${chapterNode.name.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}-youtube-package.md`;
    onExportMarkdown?.(md, fileName);
  };

  const handleSaveAsOutline = () => {
    if (!pkg || !chapterNode) return;
    onSaveAsOutline?.(chapterNode.name, pkg);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Youtube className="h-5 w-5" />
            Share as YouTube package
          </DialogTitle>
          <DialogDescription>
            {chapterNode
              ? `Generates a complete YouTube content package from "${chapterNode.name}" and its descendants.`
              : 'No chapter selected.'}
          </DialogDescription>
        </DialogHeader>

        {phase === 'configure' && (
          <div className="space-y-4 py-2 overflow-y-auto">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Target duration</Label>
              <RadioGroup value={String(duration)} onValueChange={(v) => setDuration(Number(v) as 60 | 90 | 120 | 300)}>
                <div className="flex flex-wrap gap-3">
                  {DURATION_OPTIONS.map(opt => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <RadioGroupItem value={String(opt.value)} id={`yt-dur-${opt.value}`} />
                      <Label htmlFor={`yt-dur-${opt.value}`} className="text-sm cursor-pointer">{opt.label}</Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Style</Label>
              <RadioGroup value={style} onValueChange={(v) => setStyle(v as YoutubePackageInput['style'])}>
                <div className="flex flex-wrap gap-3">
                  {STYLE_OPTIONS.map(opt => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <RadioGroupItem value={opt.value} id={`yt-style-${opt.value}`} />
                      <Label htmlFor={`yt-style-${opt.value}`} className="text-sm cursor-pointer">{opt.label}</Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="yt-audience" className="text-sm font-medium">Audience hint (optional)</Label>
              <Input
                id="yt-audience"
                placeholder="e.g. developers, researchers, general"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              />
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
              Building your YouTube package…
            </p>
          </div>
        )}

        {phase === 'preview' && pkg && (
          <div className="flex-1 overflow-hidden flex flex-col">
            {provider && (
              <Badge variant="secondary" className="self-start text-xs mb-2">{provider}</Badge>
            )}
            <Tabs defaultValue="titles" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="flex flex-wrap h-auto">
                <TabsTrigger value="titles">Titles</TabsTrigger>
                <TabsTrigger value="description">Description</TabsTrigger>
                <TabsTrigger value="chapters">Chapters</TabsTrigger>
                <TabsTrigger value="script">Script</TabsTrigger>
                <TabsTrigger value="thumb">Thumbnail</TabsTrigger>
                <TabsTrigger value="tags">SEO tags</TabsTrigger>
                <TabsTrigger value="broll">B-roll</TabsTrigger>
                <TabsTrigger value="shots">Shot list</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto pt-3">
                <TabsContent value="titles">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">5 title variants</Label>
                  <Textarea
                    value={pkg.titleVariants.join('\n')}
                    onChange={(e) => updatePackage('titleVariants', e.target.value.split('\n').filter(s => s.trim()))}
                    rows={6}
                    className="text-sm"
                  />
                </TabsContent>

                <TabsContent value="description">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">YouTube description</Label>
                  <Textarea
                    value={pkg.description}
                    onChange={(e) => updatePackage('description', e.target.value)}
                    rows={12}
                    className="text-sm"
                  />
                </TabsContent>

                <TabsContent value="chapters">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">Chapter markers</Label>
                  <Textarea
                    value={pkg.chapters}
                    onChange={(e) => updatePackage('chapters', e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                  />
                </TabsContent>

                <TabsContent value="script">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">Voiceover script</Label>
                  <Textarea
                    value={pkg.voiceoverScript}
                    onChange={(e) => updatePackage('voiceoverScript', e.target.value)}
                    rows={18}
                    className="text-sm"
                  />
                </TabsContent>

                <TabsContent value="thumb">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">Thumbnail concept</Label>
                  <Textarea
                    value={pkg.thumbnailConcept}
                    onChange={(e) => updatePackage('thumbnailConcept', e.target.value)}
                    rows={8}
                    className="text-sm"
                  />
                </TabsContent>

                <TabsContent value="tags">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">SEO tags (one per line)</Label>
                  <Textarea
                    value={pkg.seoTags.join('\n')}
                    onChange={(e) => updatePackage('seoTags', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
                    rows={10}
                    className="text-sm"
                  />
                </TabsContent>

                <TabsContent value="broll">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">B-roll prompts (one per line)</Label>
                  <Textarea
                    value={pkg.brollPrompts.join('\n')}
                    onChange={(e) => updatePackage('brollPrompts', e.target.value.split('\n').filter(s => s.trim()))}
                    rows={10}
                    className="text-sm"
                  />
                </TabsContent>

                <TabsContent value="shots">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">Screen-recording shot list</Label>
                  <Textarea
                    value={pkg.screenRecordingShotList.join('\n')}
                    onChange={(e) => updatePackage('screenRecordingShotList', e.target.value.split('\n').filter(s => s.trim()))}
                    rows={10}
                    className="text-sm"
                  />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        )}

        <DialogFooter>
          {phase === 'configure' && (
            <>
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleRun} disabled={!chapterNode}>
                <Youtube className="h-4 w-4 mr-1" />
                Generate
              </Button>
            </>
          )}
          {phase === 'preview' && (
            <>
              <Button variant="ghost" onClick={handleClose}>Close</Button>
              {onExportMarkdown && (
                <Button variant="outline" onClick={handleExportMarkdown}>
                  <Download className="h-4 w-4 mr-1" />
                  Export as markdown
                </Button>
              )}
              {onSaveAsOutline && (
                <Button onClick={handleSaveAsOutline}>
                  <FileText className="h-4 w-4 mr-1" />
                  Save as new outline
                </Button>
              )}
            </>
          )}
          {phase === 'running' && (
            <Button disabled>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Generating…
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
