'use client';

/**
 * Discovery Toast renderer — surfaces the "Did You Know?" hints registered
 * in `src/lib/discovery/hints.ts`.
 *
 * Distinct from the existing transient toast system:
 *   - These toasts are STICKY (no auto-dismiss). Only the "Got it" button
 *     removes them.
 *   - They use a fixed lower-right position (lower-center on mobile) so
 *     they never overlap the standard Toaster.
 *
 * Mounted once at app shell level — see `src/app/layout.tsx`.
 */

import React from 'react';
import { Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDiscovery } from '@/hooks/use-discovery';

export function DiscoveryToastStack() {
  const { activeHints, dismissHint } = useDiscovery();

  if (activeHints.length === 0) return null;

  return (
    <div
      // Fixed bottom-right on desktop; centered & narrower on mobile.
      // High z-index so the discovery cards layer above modal backdrops
      // are intentionally avoided — these only show on the main canvas.
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex max-w-sm flex-col-reverse gap-3 sm:max-w-md"
      aria-label="Discovery tips"
      data-testid="discovery-toast-stack"
    >
      {activeHints.map((hint) => (
        <div
          key={hint.id}
          className="pointer-events-auto group relative w-[calc(100vw-2rem)] sm:w-96 rounded-lg border border-violet-500/30 bg-popover shadow-lg ring-1 ring-violet-500/10 p-4 animate-in slide-in-from-bottom-2 fade-in duration-300"
          data-testid={`discovery-toast-${hint.id}`}
          role="status"
        >
          <button
            type="button"
            aria-label="Dismiss tip"
            onClick={() => dismissHint(hint.id)}
            className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-violet-400"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <div className="flex items-start gap-2.5">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-500 dark:text-violet-400" />
            <div className="flex-1 space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-500 dark:text-violet-400">
                Did You Know?
              </p>
              <p className="text-sm font-semibold leading-snug pr-4">
                {hint.title}
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {hint.body}
              </p>
              <div className="flex items-center justify-end pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  onClick={() => dismissHint(hint.id)}
                  data-testid={`discovery-toast-dismiss-${hint.id}`}
                >
                  Got it
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
