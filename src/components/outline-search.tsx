'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, ChevronUp, ChevronDown, Globe, FileText, Type, AlignLeft, Eraser, Filter } from 'lucide-react';
import type { Outline, NodeMap } from '@/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface SearchMatch {
  outlineId: string;
  outlineName: string;
  nodeId: string;
  nodeName: string;
  matchType: 'name' | 'content' | 'both';
}

interface OutlineSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onClear: () => void;
  outlines: Outline[];
  currentOutline: Outline | undefined;
  onSearchResults: (matches: SearchMatch[], searchTerm: string) => void;
  currentMatchIndex: number;
  totalMatches: number;
  onNextMatch: () => void;
  onPrevMatch: () => void;
  // Optional - if provided, the search will reshape the outline tree so that
  // matches and their ancestors stay expanded; every other branch is collapsed
  // (every node remains a row so the user can chevron-open any branch).
  onApplySearchView?: (matchedNodeIds: string[]) => void;
  onNavigateToMatch?: (match: SearchMatch) => void;
}

// Check if a node is currently visible: every ancestor (excluding itself)
// must NOT be collapsed.
function isNodeVisible(nodes: NodeMap, nodeId: string): boolean {
  let current = nodes[nodeId];
  while (current && current.parentId) {
    const parent = nodes[current.parentId];
    if (!parent) return false;
    if (parent.isCollapsed) return false;
    current = parent;
  }
  return true;
}

// Strip HTML tags for content search
function stripHtml(html: string): string {
  if (typeof document !== 'undefined') {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }
  // Fallback for SSR
  return html.replace(/<[^>]*>/g, '');
}

// Search a single outline for matches
// For large outlines (>5000 nodes), only search leaf nodes for performance
function searchOutline(
  outline: Outline,
  searchTerm: string,
  searchNames: boolean = true,
  searchContent: boolean = true,
  restrictToOpen: boolean = false
): SearchMatch[] {
  if (!searchNames && !searchContent) return [];

  const matches: SearchMatch[] = [];
  const lowerSearchTerm = searchTerm.toLowerCase();
  const nodes = Object.values(outline.nodes);
  const nodeCount = nodes.length;
  const LARGE_OUTLINE_THRESHOLD = 5000;
  const isLargeOutline = nodeCount > LARGE_OUTLINE_THRESHOLD;

  // Base candidate set
  let nodesToSearch = isLargeOutline
    ? nodes.filter(node => !node.childrenIds || node.childrenIds.length === 0)
    : nodes;

  // Restrict-to-open: only consider nodes whose ancestor chain is fully expanded.
  // This enables AND-chaining successive searches.
  if (restrictToOpen) {
    nodesToSearch = nodesToSearch.filter(node => isNodeVisible(outline.nodes, node.id));
  }

  if (isLargeOutline) {
    console.log(`[Search] Large outline: searching ${nodesToSearch.length} leaf nodes (of ${nodeCount} total)`);
  }

  for (const node of nodesToSearch) {
    const nameMatch = searchNames && node.name.toLowerCase().includes(lowerSearchTerm);
    const contentText = searchContent && (!isLargeOutline || !node.childrenIds?.length)
      ? stripHtml(node.content || '')
      : '';
    const contentMatch = searchContent && contentText.toLowerCase().includes(lowerSearchTerm);

    if (nameMatch || contentMatch) {
      matches.push({
        outlineId: outline.id,
        outlineName: outline.name,
        nodeId: node.id,
        nodeName: node.name,
        matchType: nameMatch && contentMatch ? 'both' : nameMatch ? 'name' : 'content',
      });
    }
  }

  return matches;
}

export default function OutlineSearch({
  isOpen,
  onClose,
  onClear,
  outlines,
  currentOutline,
  onSearchResults,
  currentMatchIndex,
  totalMatches,
  onNextMatch,
  onPrevMatch,
  onApplySearchView,
}: OutlineSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchScope, setSearchScope] = useState<'current' | 'all'>('current');
  const [searchNames, setSearchNames] = useState(true);
  const [searchContent, setSearchContent] = useState(true);
  // When true, the search walks only nodes whose ancestor chain is fully
  // expanded. This is what enables AND-chaining: search "alpha", then enable
  // "Only open" and search "beta" — only nodes containing both survive.
  const [restrictToOpen, setRestrictToOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  // Latest-value refs so the debounce effect's dependency list can stay
  // narrow — driven purely by the user's typed/toggled search inputs, NOT by
  // outline mutations. This is the 1988 spec: search applies a shape ONCE per
  // explicit user input change, then the user is free to chevron-explore
  // without the search re-firing as a side effect. Howard 2026-06-08.
  const currentOutlineRef = useRef(currentOutline);
  const outlinesRef = useRef(outlines);
  const onSearchResultsRef = useRef(onSearchResults);
  const onApplySearchViewRef = useRef(onApplySearchView);
  useEffect(() => { currentOutlineRef.current = currentOutline; }, [currentOutline]);
  useEffect(() => { outlinesRef.current = outlines; }, [outlines]);
  useEffect(() => { onSearchResultsRef.current = onSearchResults; }, [onSearchResults]);
  useEffect(() => { onApplySearchViewRef.current = onApplySearchView; }, [onApplySearchView]);

  // Focus input when search opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  // Stable performSearch: reads everything from refs, so its identity never
  // changes. Outline mutations no longer trigger a re-shape.
  const performSearch = useCallback((
    term: string,
    scope: 'current' | 'all',
    names: boolean,
    content: boolean,
    onlyOpen: boolean
  ) => {
    const currentOutlineNow = currentOutlineRef.current;
    const outlinesNow = outlinesRef.current;
    const onSearchResultsNow = onSearchResultsRef.current;
    const onApplySearchViewNow = onApplySearchViewRef.current;

    if (term.length < 2) {
      onSearchResultsNow([], term);
      return;
    }

    let matches: SearchMatch[] = [];

    if (scope === 'current' && currentOutlineNow) {
      matches = searchOutline(currentOutlineNow, term, names, content, onlyOpen);
    } else if (scope === 'all') {
      outlinesNow.forEach((outline) => {
        if (!outline.isGuide) {
          // Restrict-to-open only applies meaningfully to the currently visible
          // outline; for cross-outline search we walk every outline fully.
          const restrict = outline.id === currentOutlineNow?.id ? onlyOpen : false;
          matches.push(...searchOutline(outline, term, names, content, restrict));
        }
      });
    }

    onSearchResultsNow(matches, term);

    // Reshape the outline tree so matches + ancestors stay expanded; every
    // other branch is collapsed (but every node still renders as a row).
    if (onApplySearchViewNow && currentOutlineNow) {
      const matchedIdsInCurrent = matches
        .filter(m => m.outlineId === currentOutlineNow.id)
        .map(m => m.nodeId);
      onApplySearchViewNow(matchedIdsInCurrent);
    }
  }, []);

  // Handle search term/toggle change with debounce. Deps are ONLY the user
  // inputs — outline state changes do NOT re-fire the search. This preserves
  // the 1988 spec: search shapes the tree once per explicit user input; after
  // that the user can chevron-explore freely without snap-back.
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      performSearch(searchTerm, searchScope, searchNames, searchContent, restrictToOpen);
    }, 150); // 150ms debounce for real-time feel

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchTerm, searchScope, searchNames, searchContent, restrictToOpen, performSearch]);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        onPrevMatch();
      } else {
        onNextMatch();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onNextMatch();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onPrevMatch();
    }
  };

  // Toggle scope
  const toggleScope = () => {
    setSearchScope(prev => prev === 'current' ? 'all' : 'current');
  };

  // Clear search
  const handleClear = () => {
    setSearchTerm('');
    onSearchResults([], '');
    inputRef.current?.focus();
  };

  if (!isOpen) return null;

  return (
    <div className="flex-shrink-0 px-2 py-2 bg-background border-b">
      <div className="flex flex-wrap items-center gap-1">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search outline..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-8 pr-8 h-8"
            data-testid="search-input"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={handleClear}
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        <TooltipProvider delayDuration={300}>
          {/* Scope toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={searchScope === 'all' ? 'default' : 'outline'}
                size="icon"
                className={`h-8 w-8 ${searchScope !== 'all' ? 'hover:bg-background opacity-50 hover:opacity-70' : ''}`}
                onClick={toggleScope}
                aria-label={searchScope === 'all' ? 'Searching all outlines' : 'Searching current outline'}
                aria-pressed={searchScope === 'all'}
              >
                {searchScope === 'all' ? (
                  <Globe className="h-4 w-4" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {searchScope === 'all' ? 'Searching all outlines' : 'Searching current outline'}
            </TooltipContent>
          </Tooltip>

          {/* Search names toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={searchNames ? 'default' : 'outline'}
                size="icon"
                className={`h-8 w-8 ${!searchNames ? 'hover:bg-background opacity-50 hover:opacity-70' : ''}`}
                onClick={() => {
                  // Don't allow both to be off
                  if (searchNames && !searchContent) return;
                  setSearchNames(prev => !prev);
                }}
                aria-label="Search node names"
                aria-pressed={searchNames}
              >
                <AlignLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{searchNames ? 'Searching node names' : 'Not searching node names'}</TooltipContent>
          </Tooltip>

          {/* Search content toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={searchContent ? 'default' : 'outline'}
                size="icon"
                className={`h-8 w-8 ${!searchContent ? 'hover:bg-background opacity-50 hover:opacity-70' : ''}`}
                onClick={() => {
                  // Don't allow both to be off
                  if (searchContent && !searchNames) return;
                  setSearchContent(prev => !prev);
                }}
                aria-label="Search node content"
                aria-pressed={searchContent}
              >
                <Type className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{searchContent ? 'Searching content' : 'Not searching content'}</TooltipContent>
          </Tooltip>

          {/* Restrict-to-open toggle - enables AND-chaining successive searches */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={restrictToOpen ? 'default' : 'outline'}
                size="icon"
                className={`h-8 w-8 ${!restrictToOpen ? 'hover:bg-background opacity-50 hover:opacity-70' : ''}`}
                onClick={() => setRestrictToOpen(prev => !prev)}
                aria-label="Search only open nodes"
                aria-pressed={restrictToOpen}
                data-testid="search-restrict-to-open"
              >
                <Filter className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {restrictToOpen
                ? 'Searching only currently open nodes — chain searches to narrow results'
                : 'Search all nodes (toggle on to chain searches)'}
            </TooltipContent>
          </Tooltip>

          {/* Navigation buttons.
              NOTE: disabled native buttons swallow pointer events, which
              prevents Radix Tooltip from ever showing. We wrap each disabled-
              capable trigger in a focusable span so hover/focus is captured
              by the span and the tooltip renders even when the button itself
              is disabled (i.e. no matches yet). */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="inline-flex">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onPrevMatch}
                  disabled={totalMatches === 0}
                  aria-label="Previous match"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Previous match (Shift+Enter)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="inline-flex">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onNextMatch}
                  disabled={totalMatches === 0}
                  aria-label="Next match"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Next match (Enter)</TooltipContent>
          </Tooltip>

          {/* Clear highlights button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="inline-flex">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    onClear();
                    onClose();
                  }}
                  disabled={totalMatches === 0}
                  aria-label="Clear highlights and close search"
                >
                  <Eraser className="h-4 w-4" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Clear highlights and close search</TooltipContent>
          </Tooltip>

          {/* Close button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onClose}
                aria-label="Close search"
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close search, keep highlights</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Match count */}
      {searchTerm.length >= 2 && (
        <div className="mt-1 text-xs text-muted-foreground px-1">
          {totalMatches === 0 ? (
            <span>No matches found</span>
          ) : (
            <span>
              {currentMatchIndex + 1} of {totalMatches} match{totalMatches !== 1 ? 'es' : ''}
              {searchScope === 'all' && ' (all outlines)'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
