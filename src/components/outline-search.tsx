'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, ChevronUp, ChevronDown, Globe, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Outline, OutlineNode, NodeMap } from '@/types';
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
  outlines: Outline[];
  currentOutline: Outline | undefined;
  onSearchResults: (matches: SearchMatch[], searchTerm: string) => void;
  onNavigateToMatch: (match: SearchMatch) => void;
  currentMatchIndex: number;
  totalMatches: number;
  onNextMatch: () => void;
  onPrevMatch: () => void;
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
function searchOutline(
  outline: Outline,
  searchTerm: string
): SearchMatch[] {
  const matches: SearchMatch[] = [];
  const lowerSearchTerm = searchTerm.toLowerCase();

  Object.values(outline.nodes).forEach((node) => {
    const nameMatch = node.name.toLowerCase().includes(lowerSearchTerm);
    const contentText = stripHtml(node.content || '');
    const contentMatch = contentText.toLowerCase().includes(lowerSearchTerm);

    if (nameMatch || contentMatch) {
      matches.push({
        outlineId: outline.id,
        outlineName: outline.name,
        nodeId: node.id,
        nodeName: node.name,
        matchType: nameMatch && contentMatch ? 'both' : nameMatch ? 'name' : 'content',
      });
    }
  });

  return matches;
}

export default function OutlineSearch({
  isOpen,
  onClose,
  outlines,
  currentOutline,
  onSearchResults,
  onNavigateToMatch,
  currentMatchIndex,
  totalMatches,
  onNextMatch,
  onPrevMatch,
}: OutlineSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchScope, setSearchScope] = useState<'current' | 'all'>('current');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Focus input when search opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  // Debounced search
  const performSearch = useCallback((term: string, scope: 'current' | 'all') => {
    if (term.length < 2) {
      onSearchResults([], term);
      return;
    }

    let matches: SearchMatch[] = [];

    if (scope === 'current' && currentOutline) {
      matches = searchOutline(currentOutline, term);
    } else if (scope === 'all') {
      outlines.forEach((outline) => {
        if (!outline.isGuide) {
          matches.push(...searchOutline(outline, term));
        }
      });
    }

    onSearchResults(matches, term);
  }, [currentOutline, outlines, onSearchResults]);

  // Handle search term change with debounce
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      performSearch(searchTerm, searchScope);
    }, 150); // 150ms debounce for real-time feel

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchTerm, searchScope, performSearch]);

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
      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search outline..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-8 pr-8 h-8"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={handleClear}
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
                className="h-8 w-8"
                onClick={toggleScope}
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

          {/* Navigation buttons */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={onPrevMatch}
                disabled={totalMatches === 0}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Previous match (Shift+Enter)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={onNextMatch}
                disabled={totalMatches === 0}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Next match (Enter)</TooltipContent>
          </Tooltip>

          {/* Close button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close search (Esc)</TooltipContent>
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
