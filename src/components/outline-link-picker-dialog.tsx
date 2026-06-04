'use client';

/**
 * Outline-link picker (Phase 1 of the cross-outline link feature).
 *
 * Lets the user pick a target outline from their library. The dialog excludes
 * the currently-open outline (a self-link would just be a no-op navigation).
 * Confirming the pick calls `onPick(targetOutlineId)`, which the parent uses
 * to insert a new `outline-link` node into the current outline.
 *
 * Search-as-you-type is included because users may have dozens of outlines
 * once the app is in active use; a flat list gets unmanageable fast.
 *
 * Phase 2 (deferred) will extend this picker to also let the user choose a
 * specific node within the target outline. For now it links to the target
 * outline's root, which is what the click-to-navigate handler assumes.
 */

import React, { useEffect, useMemo, useState } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExternalLink, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Outline } from '@/types';

interface OutlineLinkPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outlines: Outline[];
  currentOutlineId: string | undefined;
  onPick: (targetOutlineId: string, targetOutlineName: string) => void;
}

export default function OutlineLinkPickerDialog({
  open,
  onOpenChange,
  outlines,
  currentOutlineId,
  onPick,
}: OutlineLinkPickerDialogProps) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Reset state on every open so a fresh picker doesn't surface stale selection.
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedId(null);
    }
  }, [open]);

  // Candidates: every outline EXCEPT the currently-open one. We keep the
  // User Guide and the Second Brain in the list — linking to them is a
  // legitimate workflow ("this client outline references our standard playbook").
  const candidates = useMemo(() => {
    const list = outlines.filter(o => o.id !== currentOutlineId);
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(o => o.name.toLowerCase().includes(q));
  }, [outlines, currentOutlineId, query]);

  const handleConfirm = () => {
    if (!selectedId) return;
    const target = outlines.find(o => o.id === selectedId);
    if (!target) return;
    onPick(target.id, target.name);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Link to Outline
          </DialogTitle>
          <DialogDescription>
            Pick an outline to link to. A new link node will be inserted into
            this outline; clicking it will jump to the chosen outline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search your outlines..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && selectedId) {
                  e.preventDefault();
                  handleConfirm();
                }
              }}
            />
          </div>

          <ScrollArea className="h-72 rounded-md border">
            {candidates.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                {outlines.length <= 1
                  ? 'You need at least one other outline to create a link.'
                  : 'No outlines match your search.'}
              </div>
            ) : (
              <ul className="p-1">
                {candidates.map(o => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(o.id)}
                      onDoubleClick={() => {
                        setSelectedId(o.id);
                        // Defer to next tick so state lands before confirm reads it.
                        setTimeout(() => {
                          onPick(o.id, o.name);
                          onOpenChange(false);
                        }, 0);
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2',
                        'hover:bg-accent/30 active:bg-accent/50 transition-colors',
                        selectedId === o.id && 'bg-primary/15 ring-1 ring-primary/30',
                      )}
                    >
                      <ExternalLink className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="truncate font-medium">{o.name}</span>
                      {o.isGuide && (
                        <span className="ml-auto text-xs text-muted-foreground">Guide</span>
                      )}
                      {o.isSecondBrain && (
                        <span className="ml-auto text-xs text-muted-foreground">Second Brain</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedId}>
            Insert Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
