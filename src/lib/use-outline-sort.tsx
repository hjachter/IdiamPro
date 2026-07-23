'use client';

// Outline-list sort preference (2026-07-23).
//
// Lets the user order the outline library by "Recent" (most-recently-modified
// first — the default, so you land back on what you were just working on) or
// "Name" (A–Z, the historical behaviour). The choice is persisted to
// localStorage so it sticks across sessions, and is shared by BOTH the desktop
// sidebar and the mobile sidebar sheet via the same storage key so the two
// always agree.

import { useCallback, useEffect, useState } from 'react';
import { ArrowDownUp } from 'lucide-react';
import type { Outline } from '@/types';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type OutlineSortMode = 'recent' | 'name';

const SORT_MODE_KEY = 'outlineListSortMode';
const DEFAULT_SORT_MODE: OutlineSortMode = 'recent';

function readStoredSortMode(): OutlineSortMode {
  try {
    const raw = window.localStorage.getItem(SORT_MODE_KEY);
    if (raw === 'recent' || raw === 'name') return raw;
  } catch {
    /* ignore — private mode / disabled storage */
  }
  return DEFAULT_SORT_MODE;
}

/**
 * Persisted outline-list sort mode. Defaults to "recent". Hydrates from
 * localStorage after mount (avoids any SSR/first-render mismatch) and mirrors
 * changes made in another mounted instance via the `storage` event.
 */
export function useOutlineSort(): {
  sortMode: OutlineSortMode;
  setSortMode: (mode: OutlineSortMode) => void;
} {
  const [sortMode, setSortModeState] = useState<OutlineSortMode>(DEFAULT_SORT_MODE);

  useEffect(() => {
    setSortModeState(readStoredSortMode());
    const onStorage = (e: StorageEvent) => {
      if (e.key === SORT_MODE_KEY) setSortModeState(readStoredSortMode());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setSortMode = useCallback((mode: OutlineSortMode) => {
    setSortModeState(mode);
    try {
      window.localStorage.setItem(SORT_MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  return { sortMode, setSortMode };
}

/**
 * Return a new array of outlines ordered per the chosen sort mode.
 * - "recent": newest last-modified first. Outlines missing a timestamp are
 *   treated as oldest (0) so they sink to the bottom rather than jumping around.
 * - "name": case-insensitive A–Z (the historical default).
 */
export function sortOutlines<T extends Pick<Outline, 'name' | 'lastModified'>>(
  outlines: T[],
  mode: OutlineSortMode,
): T[] {
  const copy = [...outlines];
  if (mode === 'recent') {
    copy.sort((a, b) => {
      const at = a.lastModified ?? 0;
      const bt = b.lastModified ?? 0;
      if (bt !== at) return bt - at;
      // Stable tiebreak so equal/absent timestamps stay predictable.
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  } else {
    copy.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }
  return copy;
}

/**
 * Compact two-option segmented control for the outline-list sort mode.
 * Short labels ("Recent" / "Name") with an explanatory tooltip, styled to sit
 * inline in a sidebar header row.
 */
export function OutlineSortControl({
  sortMode,
  setSortMode,
  className,
}: {
  sortMode: OutlineSortMode;
  setSortMode: (mode: OutlineSortMode) => void;
  className?: string;
}) {
  const options: { value: OutlineSortMode; label: string }[] = [
    { value: 'recent', label: 'Recent' },
    { value: 'name', label: 'Name' },
  ];
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center rounded-md border border-border/50 bg-background/60 p-0.5',
              className,
            )}
            role="group"
            aria-label="Sort outlines"
            data-testid="outline-sort-control"
            data-sort-mode={sortMode}
          >
            <ArrowDownUp className="ml-1 mr-0.5 h-3 w-3 text-muted-foreground/70" />
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSortMode(opt.value)}
                aria-pressed={sortMode === opt.value}
                data-testid={`outline-sort-${opt.value}`}
                data-active={sortMode === opt.value ? 'true' : 'false'}
                className={cn(
                  'rounded-[5px] px-1.5 py-0.5 text-[11px] font-medium transition-colors',
                  sortMode === opt.value
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Sort the list by most recently edited (Recent) or alphabetically (Name).
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
