'use client';

/**
 * Route-segment error boundary — catches errors thrown inside any page or
 * component below the root layout (which still renders normally). This is
 * the boundary that fires for typical render-time crashes.
 *
 * Sibling to global-error.tsx (which only fires when the root layout itself
 * crashes).
 */

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log so Sentry / console-watchers see it; don't show raw text to user.
    console.error('Page-level error caught by error.tsx:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background text-foreground">
      <div className="max-w-md text-center">
        <div className="flex justify-center mb-4">
          <AlertTriangle className="w-12 h-12 text-amber-500" />
        </div>
        <h1 className="text-2xl font-bold mb-3">Something went wrong on this page</h1>
        <p className="text-muted-foreground mb-6 leading-relaxed">
          IdeaM hit an unexpected error. Your outlines are saved locally and are not affected. You can try again, or go back home.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <button
            onClick={() => reset()}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Try again
          </button>
          <button
            onClick={() => { window.location.href = '/'; }}
            className="px-6 py-2.5 border border-border rounded-lg font-medium hover:bg-accent transition-colors"
          >
            Go home
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-8">
          If this keeps happening, please email{' '}
          <a href="mailto:support@2ndbrainware.com" className="text-primary hover:underline">
            support@2ndbrainware.com
          </a>
          {' '}and let us know what you were doing.
        </p>
        {error?.digest && (
          <p className="text-[10px] text-muted-foreground/60 mt-3 font-mono">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
