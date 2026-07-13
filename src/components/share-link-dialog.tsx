'use client';

/**
 * Share Link dialog — "Publish to a shareable link".
 *
 * Publishes the current outline (or branch) as a VIEW-ONLY web page hosted on
 * our own infrastructure and hands the user a copyable URL on our domain. It
 * reuses the existing Website generator to render the page, sanitizes the
 * outline content first (XSS defense), then POSTs the rendered HTML to the
 * plan-gated publish API. Snapshot model: re-publish ("Update") to refresh the
 * page; "Unpublish" revokes the link immediately.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Copy, Check, Loader2, Link2, RefreshCw, Trash2, ExternalLink, Globe } from 'lucide-react';
import type { Outline } from '@/types';
import { convertOutline } from '@/lib/export/index';
import { sanitizeOutlineForShare } from '@/lib/sharing/sanitize-outline';
import { useToast } from '@/hooks/use-toast';
import { useUpgradePrompt } from '@/components/upgrade-prompt';

interface ShareLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outline: Outline;
  rootNodeId?: string;
  nodeName?: string;
}

// Templates a share may use (must match the server allow-list).
const SHARE_TEMPLATES = [
  { id: 'marketing', name: 'Showcase' },
  { id: 'informational', name: 'Overview' },
  { id: 'documentation', name: 'Guide' },
];

const MAP_KEY = 'idiampro:shared-links';

interface ShareRecord {
  shareId: string;
  url: string;
}

function readMap(): Record<string, ShareRecord> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(MAP_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, ShareRecord>): void {
  try {
    window.localStorage.setItem(MAP_KEY, JSON.stringify(map));
  } catch {
    /* best-effort */
  }
}

interface ManageItem {
  shareId: string;
  title: string;
  template: string;
  url: string;
  updatedAt: number;
}

export default function ShareLinkDialog({
  open,
  onOpenChange,
  outline,
  rootNodeId,
  nodeName,
}: ShareLinkDialogProps) {
  const { toast } = useToast();
  const { promptUpgrade } = useUpgradePrompt();

  const displayName =
    nodeName || (rootNodeId ? outline.nodes[rootNodeId]?.name : null) || outline.name;
  const localKey = `${outline.id}:${rootNodeId ?? 'root'}`;

  const [template, setTemplate] = useState('marketing');
  const [isPublishing, setIsPublishing] = useState(false);
  const [record, setRecord] = useState<ShareRecord | null>(null);
  const [copied, setCopied] = useState(false);
  const [manage, setManage] = useState<ManageItem[]>([]);
  const [showManage, setShowManage] = useState(false);

  const loadManage = useCallback(async () => {
    try {
      const res = await fetch('/api/share/list');
      if (!res.ok) return;
      const data = await res.json();
      setManage(Array.isArray(data.shares) ? data.shares : []);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setTemplate('marketing');
    setCopied(false);
    setShowManage(false);
    const existing = readMap()[localKey] || null;
    setRecord(existing);
    loadManage();
  }, [open, localKey, loadManage]);

  const publish = async (isUpdate: boolean) => {
    setIsPublishing(true);
    try {
      // 1) Sanitize user content, then render via the Website generator.
      const safe = sanitizeOutlineForShare(outline);
      const result = await convertOutline('website', safe, rootNodeId, {
        includeContent: true,
        title: displayName,
        websiteType: template,
        colorScheme: 'auto',
        contentDepth: 'standard',
        toneStyle: 'professional',
        ctaText: 'Learn More',
      } as any);
      const html = typeof result.data === 'string' ? result.data : String(result.data);

      // 2) Publish to our own infrastructure.
      const res = await fetch('/api/share/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html,
          title: displayName,
          template,
          shareId: isUpdate ? record?.shareId : undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 402 && data.upgradeRequired) {
          promptUpgrade({
            reason: data.error || 'You have reached your free shared-link limit.',
            requiredTier: 'pro',
          });
          return;
        }
        throw new Error(data.error || 'Could not publish the link.');
      }

      const next: ShareRecord = { shareId: data.shareId, url: data.url };
      setRecord(next);
      const map = readMap();
      map[localKey] = next;
      writeMap(map);
      await loadManage();

      toast({
        title: isUpdate ? 'Link Updated' : 'Link Published',
        description: isUpdate
          ? 'Your shared page now shows the latest version.'
          : 'Your shareable link is ready to copy and send.',
      });
    } catch (error: any) {
      toast({
        title: 'Publish Failed',
        description: error?.message || 'Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const unpublish = async (shareId: string, fromManage = false) => {
    try {
      const res = await fetch('/api/share/unpublish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not unpublish.');

      // Clear any local mapping that points at this id.
      const map = readMap();
      for (const k of Object.keys(map)) {
        if (map[k].shareId === shareId) delete map[k];
      }
      writeMap(map);
      if (record?.shareId === shareId) setRecord(null);
      await loadManage();
      if (!fromManage) {
        toast({ title: 'Link Revoked', description: 'The shared page no longer works.' });
      }
    } catch (error: any) {
      toast({
        title: 'Unpublish Failed',
        description: error?.message || 'Something went wrong.',
        variant: 'destructive',
      });
    }
  };

  const copyLink = async () => {
    if (!record) return;
    try {
      await navigator.clipboard.writeText(record.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Copied', description: 'Link copied to your clipboard.' });
    } catch {
      toast({ title: 'Copy Failed', description: 'Select the link and copy it manually.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
      <TooltipProvider>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Share Link
          </DialogTitle>
          <DialogDescription>
            Publish &ldquo;{displayName}&rdquo; as a view-only web page on our own
            site and get a link anyone can open — no login required to view.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template picker */}
          <div className="grid gap-2">
            <Label htmlFor="share-template">Page style</Label>
            <Select value={template} onValueChange={setTemplate} disabled={isPublishing}>
              <SelectTrigger id="share-template">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHARE_TEMPLATES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Published state */}
          {record ? (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary shrink-0" />
                <Input readOnly value={record.url} className="text-sm" onFocus={(e) => e.currentTarget.select()} />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="outline" onClick={copyLink}>
                      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy link</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="outline" asChild>
                      <a href={record.url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open page</TooltipContent>
                </Tooltip>
              </div>
              <div className="flex gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="secondary" className="flex-1" onClick={() => publish(true)} disabled={isPublishing}>
                      {isPublishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                      Update
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Re-publish the current version to this same link</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" className="flex-1" onClick={() => unpublish(record.shareId)} disabled={isPublishing}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Unpublish
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Revoke this link — the page stops working</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ) : (
            <Button className="w-full" onClick={() => publish(false)} disabled={isPublishing}>
              {isPublishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
              {isPublishing ? 'Publishing…' : 'Publish'}
            </Button>
          )}

          {/* Manage list */}
          {manage.length > 0 && (
            <>
              <Separator />
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowManage((v) => !v)}
              >
                {showManage ? 'Hide' : 'Manage'} shared links ({manage.length})
              </button>
              {showManage && (
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {manage.map((item) => (
                    <div key={item.shareId} className="flex items-center gap-2 rounded-md border px-3 py-2">
                      <span className="flex-1 truncate text-sm" title={item.title}>{item.title}</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" asChild>
                            <a href={item.url} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Open</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" onClick={() => unpublish(item.shareId, true)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Revoke</TooltipContent>
                      </Tooltip>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}
