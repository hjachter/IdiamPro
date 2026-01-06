'use client';

import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { Button } from './ui/button';

interface BreadcrumbsProps {
  ancestorPath: string[]; // Array of node names from root to parent
  onNavigate?: (index: number) => void; // Callback when breadcrumb is clicked (optional for now)
}

export function Breadcrumbs({ ancestorPath }: BreadcrumbsProps) {
  if (!ancestorPath || ancestorPath.length === 0) {
    return null;
  }

  // Limit breadcrumbs - show first, last, and "..." if too many
  const maxBreadcrumbs = 4;
  let displayPath = ancestorPath;
  let hasEllipsis = false;

  if (ancestorPath.length > maxBreadcrumbs) {
    hasEllipsis = true;
    displayPath = [
      ancestorPath[0], // Root
      ...ancestorPath.slice(-2) // Last 2 items
    ];
  }

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground px-4 py-2 border-b bg-muted/30">
      <Home className="h-3.5 w-3.5" />

      {displayPath.map((name, index) => (
        <React.Fragment key={index}>
          <ChevronRight className="h-3.5 w-3.5" />

          {/* Show ellipsis after root if path is collapsed */}
          {hasEllipsis && index === 0 && ancestorPath.length > maxBreadcrumbs && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto py-0.5 px-2 text-xs hover:text-foreground"
              >
                {name}
              </Button>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="px-1 text-muted-foreground/60">...</span>
            </>
          )}

          {/* Show breadcrumb button */}
          {(index > 0 || !hasEllipsis) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-0.5 px-2 text-xs hover:text-foreground max-w-[200px] truncate"
              title={name}
            >
              {name}
            </Button>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
