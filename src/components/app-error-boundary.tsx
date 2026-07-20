'use client';

/**
 * React class-based error boundary for the outline-editor shell. Catches
 * any render-time error from anywhere inside the wrapped subtree and shows
 * a friendly recovery screen instead of letting the white-screen-of-death
 * happen (or letting the error bubble all the way up to Next.js's
 * route-segment error.tsx).
 *
 * Used in the app/app/page.tsx route to wrap the OutlinePro tree.
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log so Sentry / console-watchers see it; never show raw text to user.
    console.error('AppErrorBoundary caught:', error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-background text-foreground">
          <div className="max-w-md text-center">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="w-12 h-12 text-amber-500" />
            </div>
            <h1 className="text-2xl font-bold mb-3">Something went wrong in the editor</h1>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              IdeaM hit an unexpected error while rendering. Your outlines are saved locally and are not affected. You can try to recover, or reload the app.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={this.reset}
                className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Try to recover
              </button>
              <button
                onClick={() => { window.location.reload(); }}
                className="px-6 py-2.5 border border-border rounded-lg font-medium hover:bg-accent transition-colors"
              >
                Reload app
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-8">
              If this keeps happening, please email{' '}
              <a href="mailto:support@2ndbrainware.com" className="text-primary hover:underline">
                support@2ndbrainware.com
              </a>
              {' '}with what you were doing right before this happened.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
