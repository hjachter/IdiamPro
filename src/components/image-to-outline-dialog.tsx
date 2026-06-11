'use client';

/**
 * Image-to-Outline dialog (2026-06-11) — capture or pick an image and let
 * the AI extract a hierarchical sub-outline from it. Use cases: whiteboard
 * photos, mind maps, diagrams, sticky-note brainstorms, slide screenshots.
 *
 * UX flow:
 *   1. "pick" phase — file input + iOS camera (capture="environment")
 *   2. "running" — Gemini is parsing the image
 *   3. "preview" — three-panel layout: source thumbnail, proposed outline
 *      (editable node names), where it will land. User can:
 *        • Edit names inline before applying
 *        • Apply as children of selected node (default)
 *        • Save as new outline (via the derivative flow)
 *        • Cancel
 *
 * Apply auto-snapshots the current outline first (data-protection rule 2).
 */

import React, { useMemo, useRef, useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Image as ImageIcon, Loader2, AlertTriangle, Camera, Upload, ChevronRight } from 'lucide-react';
import type { Outline } from '@/types';
import { imageToOutlineAction, type ImageToOutlineProposedNode } from '@/app/actions';
import { useAIUsageGate } from '@/lib/use-ai-usage-gate';
import { getUserApiKey } from '@/lib/byok-keys';
import DerivationChoice, { type DerivationMode } from './derivation-choice';
import { getPlatformContext } from '@/lib/platform';

export interface ImageToOutlineApplyPayload {
  proposedNodes: ImageToOutlineProposedNode[];
  rootLabel: string;
  derivation: { mode: DerivationMode; label: string };
  /** PNG/JPEG bytes as base64 — caller may persist alongside the outline. */
  imageBase64: string;
  imageMimeType: string;
}

interface ImageToOutlineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outline: Outline | null;
  selectedNodeId: string | null;
  onApply: (payload: ImageToOutlineApplyPayload) => void;
  /** When the dialog is opened directly with an image already selected
   *  (e.g. via drag-and-drop onto a node), pass it here. */
  initialImage?: { base64: string; mimeType: string } | null;
}

type Phase = 'pick' | 'running' | 'preview';

function flattenProposedCount(list: ImageToOutlineProposedNode[]): number {
  let n = 0;
  const walk = (items: ImageToOutlineProposedNode[]) => {
    for (const item of items) {
      n += 1;
      if (item.children && item.children.length) walk(item.children);
    }
  };
  walk(list);
  return n;
}

function renameAt(
  list: ImageToOutlineProposedNode[],
  path: number[],
  newName: string,
): ImageToOutlineProposedNode[] {
  if (path.length === 0) return list;
  const [head, ...rest] = path;
  return list.map((item, idx) => {
    if (idx !== head) return item;
    if (rest.length === 0) return { ...item, name: newName };
    return { ...item, children: renameAt(item.children || [], rest, newName) };
  });
}

function deleteAt(
  list: ImageToOutlineProposedNode[],
  path: number[],
): ImageToOutlineProposedNode[] {
  if (path.length === 0) return list;
  const [head, ...rest] = path;
  if (rest.length === 0) {
    return list.filter((_, idx) => idx !== head);
  }
  return list.map((item, idx) => {
    if (idx !== head) return item;
    return { ...item, children: deleteAt(item.children || [], rest) };
  });
}

function NodeTreeEditor({
  items,
  path,
  onRename,
  onDelete,
}: {
  items: ImageToOutlineProposedNode[];
  path: number[];
  onRename: (path: number[], newName: string) => void;
  onDelete: (path: number[]) => void;
}) {
  return (
    <ul className="space-y-1">
      {items.map((item, idx) => {
        const childPath = [...path, idx];
        return (
          <li key={childPath.join('.')}>
            <div className="flex items-center gap-1 group">
              <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
              <Input
                value={item.name}
                onChange={(e) => onRename(childPath, e.target.value)}
                className="h-7 text-sm flex-1 px-2"
                aria-label="Proposed node name"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100"
                onClick={() => onDelete(childPath)}
                title="Remove this branch"
              >
                Remove
              </Button>
            </div>
            {item.content && (
              <div className="ml-5 text-xs text-muted-foreground line-clamp-2 mt-0.5">
                {item.content}
              </div>
            )}
            {item.children && item.children.length > 0 && (
              <div className="ml-5 mt-1">
                <NodeTreeEditor
                  items={item.children}
                  path={childPath}
                  onRename={onRename}
                  onDelete={onDelete}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function ImageToOutlineDialog({
  open,
  onOpenChange,
  outline,
  selectedNodeId,
  onApply,
  initialImage,
}: ImageToOutlineDialogProps) {
  const { gate } = useAIUsageGate();
  const [phase, setPhase] = useState<Phase>('pick');
  const [imageBase64, setImageBase64] = useState<string | null>(initialImage?.base64 || null);
  const [imageMimeType, setImageMimeType] = useState<string>(initialImage?.mimeType || 'image/png');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(
    initialImage ? `data:${initialImage.mimeType};base64,${initialImage.base64}` : null,
  );
  const [context, setContext] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [proposedNodes, setProposedNodes] = useState<ImageToOutlineProposedNode[] | null>(null);
  const [rootLabel, setRootLabel] = useState<string>('');
  const [provider, setProvider] = useState<string>('');
  const [derivationMode, setDerivationMode] = useState<DerivationMode>('inplace');
  const [derivationLabel, setDerivationLabel] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const platform = useMemo(() => getPlatformContext(), []);
  const showCameraButton = platform.os === 'ios' || platform.os === 'android';

  const targetNode = outline && selectedNodeId ? outline.nodes[selectedNodeId] : null;

  const handleClose = () => {
    setPhase('pick');
    setImageBase64(null);
    setImageMimeType('image/png');
    setImageDataUrl(null);
    setContext('');
    setErrorMsg(null);
    setProposedNodes(null);
    setRootLabel('');
    setProvider('');
    setDerivationMode('inplace');
    setDerivationLabel('');
    onOpenChange(false);
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('That file does not look like an image. Try a PNG or JPEG.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const commaIdx = dataUrl.indexOf(',');
      const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
      setImageBase64(base64);
      setImageMimeType(file.type || 'image/png');
      setImageDataUrl(dataUrl);
      setErrorMsg(null);
    };
    reader.onerror = () => {
      setErrorMsg('Could not read that file. Try a different one.');
    };
    reader.readAsDataURL(file);
  };

  const handleRun = async () => {
    if (!imageBase64) return;
    if (!gate({ feature: 'imageToOutline' })) return;

    setPhase('running');
    setErrorMsg(null);
    try {
      const result = await imageToOutlineAction(
        imageBase64,
        context.trim(),
        'gemini',
        getUserApiKey('gemini'),
      );
      if (!result.success || !result.proposedNodes) {
        setErrorMsg(result.error || 'Could not extract an outline from that image.');
        setPhase('pick');
        return;
      }
      setProposedNodes(result.proposedNodes);
      setRootLabel(result.rootLabel || 'Captured from image');
      setProvider(result.provider || '');
      setDerivationLabel(result.rootLabel || 'From image');
      setPhase('preview');
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setErrorMsg(
        `The image capture did not go through. ${raw ? `Reason: ${raw}. ` : ''}You can try again or pick a different image.`,
      );
      setPhase('pick');
    }
  };

  const handleApply = () => {
    if (!proposedNodes || !imageBase64) return;
    onApply({
      proposedNodes,
      rootLabel,
      derivation: { mode: derivationMode, label: (derivationLabel.trim() || 'From image') },
      imageBase64,
      imageMimeType,
    });
    handleClose();
  };

  const totalProposed = proposedNodes ? flattenProposedCount(proposedNodes) : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Capture from image
          </DialogTitle>
          <DialogDescription>
            {targetNode
              ? `New nodes will be added as children of "${targetNode.name}" — or saved as a new outline.`
              : 'Pick a node first so we know where to add the captured structure.'}
          </DialogDescription>
        </DialogHeader>

        {phase === 'pick' && (
          <div className="space-y-4 py-2">
            {imageDataUrl ? (
              <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageDataUrl} alt="Selected" className="h-32 w-32 object-cover rounded" />
                <div className="flex-1 space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    Ready to extract. Add a quick context hint to help the AI (optional).
                  </p>
                  <Input
                    placeholder="e.g. brainstorming whiteboard, marketing strategy diagram"
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                  />
                  <Button variant="ghost" size="sm" onClick={() => { setImageBase64(null); setImageDataUrl(null); }}>
                    Choose a different image
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-border bg-muted/20 p-8 text-center space-y-3">
                <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Pick a whiteboard photo, mind-map sketch, sticky-note board, or slide screenshot.
                </p>
                <div className="flex justify-center gap-2 flex-wrap">
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Pick image
                  </Button>
                  {showCameraButton && (
                    <Button variant="outline" onClick={() => cameraInputRef.current?.click()}>
                      <Camera className="h-4 w-4 mr-2" />
                      Take photo
                    </Button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                  data-testid="image-picker"
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                  data-testid="image-camera"
                />
              </div>
            )}

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
              Reading the image and building the outline…
            </p>
          </div>
        )}

        {phase === 'preview' && proposedNodes && (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_180px] gap-4 py-2">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Source</Label>
                {imageDataUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={imageDataUrl} alt="Source" className="w-full rounded border border-border" />
                )}
                {provider && (
                  <Badge variant="secondary" className="text-[10px]">{provider}</Badge>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Proposed outline ({totalProposed} {totalProposed === 1 ? 'node' : 'nodes'})
                  </Label>
                </div>
                <div className="rounded-md border border-border p-2 bg-background">
                  <Input
                    value={rootLabel}
                    onChange={(e) => setRootLabel(e.target.value)}
                    className="h-7 text-sm font-medium mb-2"
                    aria-label="Root label"
                  />
                  <NodeTreeEditor
                    items={proposedNodes}
                    path={[]}
                    onRename={(path, newName) =>
                      setProposedNodes(prev => prev ? renameAt(prev, path, newName) : prev)
                    }
                    onDelete={(path) =>
                      setProposedNodes(prev => prev ? deleteAt(prev, path) : prev)
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Lands here</Label>
                <div className="rounded-md border border-border p-2 bg-muted/20 text-xs space-y-1">
                  {targetNode ? (
                    <>
                      <div className="font-medium">{targetNode.name}</div>
                      <div className="text-muted-foreground">
                        New nodes will append as children.
                      </div>
                    </>
                  ) : (
                    <div className="text-muted-foreground">No target node selected.</div>
                  )}
                </div>
                <DerivationChoice
                  mode={derivationMode}
                  onModeChange={setDerivationMode}
                  label={derivationLabel}
                  onLabelChange={setDerivationLabel}
                  idPrefix="image-to-outline"
                  transformName="Capture from image"
                  currentOutlineName={outline?.name}
                />
              </div>
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          {phase === 'pick' && (
            <>
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleRun} disabled={!imageBase64 || !targetNode}>
                <ImageIcon className="h-4 w-4 mr-1" />
                Extract outline
              </Button>
            </>
          )}
          {phase === 'preview' && (
            <>
              <Button variant="ghost" onClick={handleClose}>Discard</Button>
              <Button onClick={handleApply} disabled={!proposedNodes || proposedNodes.length === 0}>
                Add {totalProposed} {totalProposed === 1 ? 'node' : 'nodes'}
              </Button>
            </>
          )}
          {phase === 'running' && (
            <Button disabled>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Extracting…
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
