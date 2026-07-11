'use client';

import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Brain, Inbox, Clock, RefreshCw, Tag, FileText, Search } from 'lucide-react';
import type { Outline, OutlineNode } from '@/types';

interface SecondBrainDashboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  secondBrain: Outline | null;
  onOpenSecondBrain: () => void;
  onJumpToNode: (nodeId: string) => void;
  /** When true, focus the search box as soon as the dialog opens. */
  autoFocusSearch?: boolean;
}

interface EntryStat {
  id: string;
  name: string;
  snippet: string;
  /** Full, whitespace-collapsed, lowercased title + content for substring matching. */
  searchText: string;
  createdAt: number;
  tags: string[];
}

/** Collapse whitespace + trim + lowercase for case-insensitive substring matching. */
function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

const ONE_DAY = 24 * 60 * 60 * 1000;

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function getEntries(sb: Outline | null): EntryStat[] {
  if (!sb) return [];
  const root = sb.nodes[sb.rootNodeId];
  if (!root) return [];
  // Top-level entries (direct children of root) are the "saved items"
  const entries: EntryStat[] = [];
  for (const childId of root.childrenIds || []) {
    const node = sb.nodes[childId];
    if (!node) continue;
    const createdAt = node.metadata?.createdAt || node.metadata?.updatedAt || 0;
    const name = node.name || '(untitled)';
    const fullContent = stripHtml(node.content || '');
    entries.push({
      id: node.id,
      name,
      snippet: fullContent.slice(0, 120),
      searchText: normalize(`${name} ${fullContent}`),
      createdAt,
      tags: node.metadata?.tags || [],
    });
  }
  return entries;
}

// Every node in the Second Brain (except the root) as a searchable entry.
// Unlike getEntries (which only lists top-level saves for the dashboard
// sections), this walks the whole tree so keyword search also finds
// quick-captured Inbox items and content nested inside saved branches.
function getSearchableEntries(sb: Outline | null): EntryStat[] {
  if (!sb) return [];
  const out: EntryStat[] = [];
  for (const id of Object.keys(sb.nodes)) {
    if (id === sb.rootNodeId) continue;
    const node = sb.nodes[id];
    if (!node) continue;
    const name = node.name || '(untitled)';
    const fullContent = stripHtml(node.content || '');
    out.push({
      id: node.id,
      name,
      snippet: fullContent.slice(0, 120),
      searchText: normalize(`${name} ${fullContent}`),
      createdAt: node.metadata?.createdAt || node.metadata?.updatedAt || 0,
      tags: node.metadata?.tags || [],
    });
  }
  return out;
}

function countAllNodes(sb: Outline | null): number {
  if (!sb) return 0;
  // Subtract the root node itself from the total count
  return Math.max(0, Object.keys(sb.nodes).length - 1);
}

function tagCounts(entries: EntryStat[]): Array<{ tag: string; count: number }> {
  const counts: Record<string, number> = {};
  for (const e of entries) {
    for (const t of e.tags) {
      counts[t] = (counts[t] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
}

function formatRelative(ts: number): string {
  if (!ts) return 'unknown date';
  const diff = Date.now() - ts;
  const days = Math.floor(diff / ONE_DAY);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** Highlight every case-insensitive occurrence of `query` inside `text`. */
function highlightMatch(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return text;
  const lowerText = text.toLowerCase();
  const lowerQ = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const idx = lowerText.indexOf(lowerQ, i);
    if (idx === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark key={key++} className="rounded bg-emerald-200 dark:bg-emerald-700/60 px-0.5 text-inherit">
        {text.slice(idx, idx + q.length)}
      </mark>
    );
    i = idx + q.length;
  }
  return parts;
}

export function SecondBrainDashboardDialog({
  open,
  onOpenChange,
  secondBrain,
  onOpenSecondBrain,
  onJumpToNode,
  autoFocusSearch,
}: SecondBrainDashboardDialogProps) {
  const allEntries = useMemo(() => getEntries(secondBrain), [secondBrain]);
  // Full node set for keyword search (includes Inbox items + nested content).
  const searchableEntries = useMemo(() => getSearchableEntries(secondBrain), [secondBrain]);
  const total = useMemo(() => countAllNodes(secondBrain), [secondBrain]);

  const [query, setQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus the search box when the dialog opens with autoFocusSearch, and always
  // clear any previous query when the dialog closes so it opens fresh next time.
  useEffect(() => {
    if (open) {
      if (autoFocusSearch) {
        // Delay a tick so the dialog's own open-focus doesn't steal it back.
        const t = setTimeout(() => searchInputRef.current?.focus(), 60);
        return () => clearTimeout(t);
      }
    } else {
      setQuery('');
    }
  }, [open, autoFocusSearch]);

  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length > 0;
  const results = useMemo(() => {
    if (!isSearching) return [];
    const nq = normalize(trimmedQuery);
    return searchableEntries
      .filter(e => e.searchText.includes(nq))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [searchableEntries, isSearching, trimmedQuery]);

  const recent = useMemo(() => {
    const cutoff = Date.now() - 7 * ONE_DAY;
    return allEntries
      .filter(e => e.createdAt >= cutoff)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 10);
  }, [allEntries]);

  const reviewPile = useMemo(() => {
    const cutoff = Date.now() - 7 * ONE_DAY;
    return allEntries
      .filter(e => e.createdAt > 0 && e.createdAt < cutoff)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, 8);
  }, [allEntries]);

  const tags = useMemo(() => tagCounts(allEntries), [allEntries]);

  const handleJump = (nodeId: string) => {
    onOpenChange(false);
    onJumpToNode(nodeId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <Brain className="h-5 w-5" />
            Second Brain Dashboard
          </DialogTitle>
          <DialogDescription>
            A snapshot of what you've captured. Click any entry to jump to it.
          </DialogDescription>
        </DialogHeader>

        {/* Free, instant, local keyword search — filters saved entries by title +
            full content. No AI, no network, no cost (distinct from "Ask Second Brain"). */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search your saved entries…"
            aria-label="Search your saved entries (free, instant, local)"
            className="pl-9"
          />
        </div>
        <p className="-mt-1 px-1 text-xs text-muted-foreground">
          Free instant keyword search — no AI, no cost.
        </p>

        <ScrollArea className="flex-1 pr-4">
          {isSearching ? (
            <div className="space-y-3 pb-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Search className="h-4 w-4 text-emerald-500" />
                Results ({results.length})
              </h3>
              {results.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No entries match that — try another word.</p>
              ) : (
                <ul className="space-y-1.5">
                  {results.map(e => (
                    <li key={e.id}>
                      <button
                        onClick={() => handleJump(e.id)}
                        className="w-full text-left rounded-md border bg-card px-3 py-2 hover:bg-accent active:bg-accent/80 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-sm truncate">{highlightMatch(e.name, trimmedQuery)}</div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap">{formatRelative(e.createdAt)}</div>
                        </div>
                        {e.snippet && (
                          <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{e.snippet}</div>
                        )}
                        {e.tags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {e.tags.map(t => (
                              <Badge key={t} variant="secondary" className="text-xs px-1.5 py-0">#{t}</Badge>
                            ))}
                          </div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
          <div className="space-y-6 pb-2">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  Total items
                </div>
                <div className="mt-1 text-2xl font-semibold">{total}</div>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Inbox className="h-3.5 w-3.5" />
                  Top-level entries
                </div>
                <div className="mt-1 text-2xl font-semibold">{allEntries.length}</div>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  This week
                </div>
                <div className="mt-1 text-2xl font-semibold">{recent.length}</div>
              </div>
            </div>

            {/* Recent saves */}
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4 text-emerald-500" />
                Recent saves (last 7 days)
              </h3>
              {recent.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Nothing captured this week yet. Press Cmd+Shift+I to capture something quickly.</p>
              ) : (
                <ul className="space-y-1.5">
                  {recent.map(e => (
                    <li key={e.id}>
                      <button
                        onClick={() => handleJump(e.id)}
                        className="w-full text-left rounded-md border bg-card px-3 py-2 hover:bg-accent active:bg-accent/80 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-sm truncate">{e.name}</div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap">{formatRelative(e.createdAt)}</div>
                        </div>
                        {e.snippet && (
                          <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{e.snippet}</div>
                        )}
                        {e.tags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {e.tags.map(t => (
                              <Badge key={t} variant="secondary" className="text-xs px-1.5 py-0">#{t}</Badge>
                            ))}
                          </div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Review pile */}
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <RefreshCw className="h-4 w-4 text-amber-500" />
                Revisit pile (older saves)
              </h3>
              {reviewPile.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No older entries to revisit yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {reviewPile.map(e => (
                    <li key={e.id}>
                      <button
                        onClick={() => handleJump(e.id)}
                        className="w-full text-left rounded-md border bg-card px-3 py-2 hover:bg-accent active:bg-accent/80 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-sm truncate">{e.name}</div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap">{formatRelative(e.createdAt)}</div>
                        </div>
                        {e.snippet && (
                          <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{e.snippet}</div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Tags */}
            {tags.length > 0 && (
              <section>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Tag className="h-4 w-4 text-blue-500" />
                  Top tags
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(({ tag, count }) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      #{tag} <span className="ml-1 opacity-60">{count}</span>
                    </Badge>
                  ))}
                </div>
              </section>
            )}
          </div>
          )}
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          <Button
            onClick={() => { onOpenChange(false); onOpenSecondBrain(); }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Brain className="mr-2 h-4 w-4" />
            Open Second Brain
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
