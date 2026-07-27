'use client';

/**
 * Prerequisite picker — choose the task(s) the current node depends on.
 *
 * This is the node-level companion to the outline-link picker: same Dialog /
 * search-as-you-type / ScrollArea shell, but it lists the OTHER nodes in the
 * CURRENT outline instead of other outlines. Picking nodes adds them to the
 * current node's `metadata.prerequisites`.
 *
 * Guards baked in: the node itself and its whole subtree are excluded (you
 * can't depend on yourself or your own descendants — that's a trivial cycle),
 * and the root node is excluded. Already-chosen prerequisites are shown with a
 * check and toggle off when clicked, so this same dialog both adds and removes.
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
import { Check, Link2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NodeMap } from '@/types';
import { getSelfAndDescendantIds } from '@/lib/prerequisites';
import { STATUS_TAGS } from '@/lib/status-tags';

interface PrerequisitePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: NodeMap;
  /** The node whose prerequisites are being edited. */
  nodeId: string | null;
  /** Toggle a prerequisite on/off for `nodeId`. */
  onToggle: (nodeId: string, prerequisiteId: string) => void;
}

// The status badge (if any) for a candidate row, so the user can see at a
// glance which tasks are already Done vs. still open.
function statusOf(tags: string[] | undefined) {
  if (!tags) return null;
  return STATUS_TAGS.find((s) => tags.includes(s.label)) ?? null;
}

export default function PrerequisitePickerDialog({
  open,
  onOpenChange,
  nodes,
  nodeId,
  onToggle,
}: PrerequisitePickerDialogProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const node = nodeId ? nodes[nodeId] : null;
  const currentPrereqs = node?.metadata?.prerequisites ?? [];

  // Candidates: every node EXCEPT the root, this node, and this node's own
  // descendants (would be a trivial cycle). Filtered live by the search box.
  const candidates = useMemo(() => {
    if (!nodeId) return [];
    const excluded = getSelfAndDescendantIds(nodes, nodeId);
    const q = query.trim().toLowerCase();
    return Object.values(nodes)
      .filter((n) => n.parentId !== null)           // skip the root
      .filter((n) => !excluded.has(n.id))
      .filter((n) => (q ? n.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [nodes, nodeId, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Set Prerequisite
          </DialogTitle>
          <DialogDescription>
            Choose the task(s) this item depends on. Until every prerequisite is
            marked Done, this item shows as blocked.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search this outline..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>

          <ScrollArea className="h-72 rounded-md border">
            {candidates.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                No other items to depend on yet.
              </div>
            ) : (
              <ul className="p-1">
                {candidates.map((n) => {
                  const selected = currentPrereqs.includes(n.id);
                  const status = statusOf(n.metadata?.tags);
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => nodeId && onToggle(nodeId, n.id)}
                        className={cn(
                          'w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2',
                          'hover:bg-accent/30 active:bg-accent/50 transition-colors',
                          selected && 'bg-primary/15 ring-1 ring-primary/30'
                        )}
                      >
                        <span
                          className={cn(
                            'h-2.5 w-2.5 rounded-full shrink-0',
                            status ? status.dotClass : 'bg-muted-foreground/30'
                          )}
                        />
                        <span className="truncate font-medium">{n.name || 'Untitled'}</span>
                        {selected && (
                          <Check className="ml-auto h-4 w-4 text-primary shrink-0" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
