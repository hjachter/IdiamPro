'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { X, Eraser, Tag } from 'lucide-react';
import { TagBadge } from './tag-badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface OutlineTagFilterProps {
  isOpen: boolean;
  onClose: () => void;
  /** Every tag that actually appears somewhere in the current outline. */
  availableTags: string[];
  /** Tags currently selected as the active filter. */
  activeTags: string[];
  onToggleTag: (tag: string) => void;
  onClear: () => void;
  /** How many nodes match the active filter (for the count line). */
  matchCount: number;
}

export default function OutlineTagFilter({
  isOpen,
  onClose,
  availableTags,
  activeTags,
  onToggleTag,
  onClear,
  matchCount,
}: OutlineTagFilterProps) {
  if (!isOpen) return null;

  const hasFilter = activeTags.length > 0;

  return (
    <div className="flex-shrink-0 px-2 py-2 bg-background border-b" data-testid="tag-filter-panel">
      <div className="flex flex-wrap items-center gap-1">
        <Tag className="h-4 w-4 text-muted-foreground shrink-0 ml-1 mr-1" />

        {availableTags.length === 0 ? (
          <span className="text-xs text-muted-foreground flex-1">
            No tags in this outline yet — add a tag to an item to filter by it.
          </span>
        ) : (
          <div className="flex flex-wrap items-center gap-1 flex-1 min-w-[120px]">
            {availableTags.map((tag) => {
              const isActive = activeTags.includes(tag);
              return (
                <TagBadge
                  key={tag}
                  tag={tag}
                  size="sm"
                  onClick={() => onToggleTag(tag)}
                  className={cn(
                    'min-h-[28px] touch-manipulation',
                    isActive
                      ? 'ring-2 ring-offset-1 ring-primary ring-offset-background'
                      : 'opacity-60 hover:opacity-100'
                  )}
                />
              );
            })}
          </div>
        )}

        <TooltipProvider delayDuration={300}>
          {/* Clear filter */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="inline-flex">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onClear}
                  disabled={!hasFilter}
                  aria-label="Clear tag filter"
                  data-testid="tag-filter-clear"
                >
                  <Eraser className="h-4 w-4" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Clear tag filter — show the full outline</TooltipContent>
          </Tooltip>

          {/* Close panel */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onClose}
                aria-label="Close tag filter"
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close tag filter, keep it applied</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {hasFilter && (
        <div className="mt-1 text-xs text-muted-foreground px-1">
          {matchCount === 0 ? (
            <span>No items match the selected tag{activeTags.length !== 1 ? 's' : ''}</span>
          ) : (
            <span>
              Showing {matchCount} item{matchCount !== 1 ? 's' : ''} with{' '}
              {activeTags.length === 1 ? 'tag' : 'any of the tags'}{' '}
              {activeTags.join(', ')} (plus context)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
