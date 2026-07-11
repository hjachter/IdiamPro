'use client';

/**
 * Welcome Showcase — a single, skippable "What you can make here" panel that
 * shows ONCE for brand-new users so they discover the app's marquee outputs
 * (video, podcast, website, export) and inputs (import, AI + Second Brain).
 *
 * Design contract:
 *   - Shows once, then never again. A dedicated localStorage flag
 *     (`onboarding:welcomeShowcaseSeen`) records that the user has seen it.
 *     Skipping, closing, or "Get started" all mark it seen.
 *   - Suppressed entirely in Professional mode (reuses the Discovery hook's
 *     `isProfessional`), matching the two-tier opt-out philosophy.
 *   - NOT a multi-step tour — one panel, one dismiss. Non-intrusive.
 *   - Only mounted inside the app shell (outline-pro), so it never appears on
 *     the marketing site.
 *
 * This is separate from the sticky Discovery toasts: it's a first-run
 * orientation, not a contextual tip.
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDiscovery } from '@/hooks/use-discovery';
import {
  Video,
  Mic,
  Globe,
  FileDown,
  BookDown,
  Brain,
} from 'lucide-react';

const SEEN_KEY = 'onboarding:welcomeShowcaseSeen';

/**
 * Cross-component signal so the Discovery toast stack can hold its sticky
 * "Did You Know?" cards while the first-run welcome is open — otherwise both
 * surface at once for brand-new users and the toasts overlap the panel.
 */
export const WELCOME_TOGGLE_EVENT = 'welcome-showcase:toggle';
function emitWelcomeOpen(open: boolean): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<{ open: boolean }>(WELCOME_TOGGLE_EVENT, { detail: { open } }),
  );
}

function hasSeenShowcase(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(SEEN_KEY) === 'true';
  } catch {
    return true; // storage blocked → don't nag
  }
}

function markShowcaseSeen(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SEEN_KEY, 'true');
  } catch {
    // private mode / disabled storage — ignore
  }
}

interface ShowcaseItem {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  blurb: string;
  /** Marks a Pro-gated output so the panel signals paid features honestly. */
  pro?: boolean;
}

const ITEMS: ShowcaseItem[] = [
  {
    icon: Video,
    title: 'Video',
    blurb: 'Turn an outline into a narrated slideshow video.',
    pro: true,
  },
  {
    icon: Mic,
    title: 'Podcast',
    blurb: 'Generate a natural two-voice podcast from any section.',
    pro: true,
  },
  {
    icon: Globe,
    title: 'Website',
    blurb: 'Publish an outline as a clean, shareable web page.',
    pro: true,
  },
  {
    icon: FileDown,
    title: 'Docs & Export',
    blurb: 'Send your work out to 20+ formats — docs, slides, and more.',
  },
  {
    icon: BookDown,
    title: 'Import',
    blurb: 'Pull in YouTube, PDFs, web pages, and notes — AI structures them.',
  },
  {
    icon: Brain,
    title: 'AI + Second Brain',
    blurb: 'Reformat, translate, and ask questions across all your outlines.',
  },
];

export function WelcomeShowcase() {
  const { isProfessional } = useDiscovery();
  // `null` until we've checked storage on the client, to avoid an SSR flash.
  const [open, setOpen] = React.useState<boolean>(false);
  const [ready, setReady] = React.useState<boolean>(false);

  React.useEffect(() => {
    setReady(true);
    if (!hasSeenShowcase()) {
      setOpen(true);
    }
  }, []);

  // Broadcast open/close so the Discovery toast stack can pause while we're up.
  React.useEffect(() => {
    emitWelcomeOpen(open);
    return () => emitWelcomeOpen(false);
  }, [open]);

  // Professional mode suppresses the showcase and marks it seen so it never
  // pops later if the user turns Pro mode back off.
  React.useEffect(() => {
    if (ready && isProfessional && open) {
      markShowcaseSeen();
      setOpen(false);
    }
  }, [ready, isProfessional, open]);

  const dismiss = React.useCallback(() => {
    markShowcaseSeen();
    setOpen(false);
  }, []);

  if (!ready || isProfessional) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) dismiss(); }}>
      <DialogContent
        className="sm:max-w-2xl"
        data-testid="welcome-showcase"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold tracking-tight">
            What you can make here
          </DialogTitle>
          <DialogDescription className="text-base leading-relaxed">
            Your outlines are the starting point. Here&rsquo;s what IdiamPro
            can turn them into — and where to bring content in.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 py-2">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/60 p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-semibold leading-tight">{item.title}</span>
                  {item.pro && (
                    <Badge
                      variant="secondary"
                      className="ml-auto shrink-0 px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide"
                    >
                      Pro
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.blurb}
                </p>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={dismiss}
            data-testid="welcome-showcase-skip"
          >
            Skip
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={dismiss}
            data-testid="welcome-showcase-start"
          >
            Get started
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
