'use client';

/**
 * Data Protection Notice — a one-time, first-run liability disclaimer that
 * teaches brand-new users to keep their work safe with their own off-device
 * backup. IdeaM is local-first: outline files live on the user's own
 * device, so backing them up is ultimately the user's responsibility. This
 * notice makes that clear at setup — not only on the marketing site.
 *
 * Design contract:
 *   - Shows ONCE on first run. A dedicated localStorage flag
 *     (`onboarding:dataProtectionSeen`) records that the user has seen it;
 *     "Got it" marks it seen so it never auto-appears again.
 *   - Because it is a deliberate liability disclaimer, it appears at least
 *     this first time REGARDLESS of Professional-mode hint suppression — it
 *     is NOT part of the Discovery hints two-tier opt-out. It never nags
 *     after that first acknowledgement.
 *   - Platform-aware copy: the web build adds a distinct warning that work is
 *     stored inside the browser and can be lost by clearing browser data,
 *     private mode, or switching browsers.
 *   - Re-accessible any time: Settings → Backups has a "Data safety" button
 *     that dispatches the `data-protection:open` event, which re-opens this
 *     notice even after it has been dismissed.
 *   - Red warning styling, professional, no flashing.
 *
 * Sequencing: this notice takes precedence over the "What you can make here"
 * welcome showcase. The showcase waits for this notice's close event
 * (`DATA_PROTECTION_CLOSE_EVENT`) before opening so the two never stack.
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
import { Checkbox } from '@/components/ui/checkbox';
import { getPlatformContext } from '@/lib/platform';
import {
  AlertTriangle,
  Cloud,
  Copy,
  History,
  DownloadCloud,
  ShieldCheck,
  Lock,
  HelpCircle,
} from 'lucide-react';

const SEEN_KEY = 'onboarding:dataProtectionSeen';
const MUTED_KEY = 'onboarding:dataProtectionMuted';

/** Event a Settings/Help surface can dispatch to re-open this notice on demand. */
export const DATA_PROTECTION_OPEN_EVENT = 'data-protection:open';
/** Emitted when the notice closes, so the welcome showcase can open after it. */
export const DATA_PROTECTION_CLOSE_EVENT = 'data-protection:close';

/** Imperatively open the notice from anywhere (e.g. a Settings button). */
export function openDataProtectionNotice(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(DATA_PROTECTION_OPEN_EVENT));
}

export function hasSeenDataProtection(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(SEEN_KEY) === 'true';
  } catch {
    return true; // storage blocked → don't nag
  }
}

function markSeen(muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SEEN_KEY, 'true');
    if (muted) window.localStorage.setItem(MUTED_KEY, 'true');
  } catch {
    // private mode / disabled storage — ignore
  }
}

interface BestPractice {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}

const BEST_PRACTICES: BestPractice[] = [
  {
    icon: Copy,
    text: 'Keep more than one copy (the 3-2-1 rule: three copies, on two kinds of storage, one off-site).',
  },
  {
    icon: History,
    text: 'Use versioned backups so you can roll back to an earlier version, not just the latest.',
  },
  {
    icon: DownloadCloud,
    text: 'Export your outlines before any big change, and keep the copies somewhere backed up.',
  },
  {
    icon: ShieldCheck,
    text: 'Test that you can actually restore from a backup — an untested backup is only a hope.',
  },
  {
    icon: Lock,
    text: 'Turn on device encryption and two-factor sign-in on the account that holds your backups.',
  },
];

export function DataProtectionNotice() {
  const platform = React.useMemo(() => getPlatformContext(), []);
  const isWeb = platform.runtime === 'web';

  const [open, setOpen] = React.useState<boolean>(false);
  const [ready, setReady] = React.useState<boolean>(false);
  const [dontRemind, setDontRemind] = React.useState<boolean>(false);
  // True when opened on demand from Settings, so closing it doesn't re-fire
  // the first-run "seen" bookkeeping or the welcome-showcase handoff.
  const reopenedRef = React.useRef<boolean>(false);

  // First-run check + on-demand re-open listener.
  React.useEffect(() => {
    setReady(true);
    if (!hasSeenDataProtection()) {
      setOpen(true);
    }
    const onOpen = () => {
      reopenedRef.current = true;
      setDontRemind(false);
      setOpen(true);
    };
    window.addEventListener(DATA_PROTECTION_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(DATA_PROTECTION_OPEN_EVENT, onOpen);
  }, []);

  // While this notice is up, pause the sticky Discovery toast stack so a
  // "Did You Know?" card can't compete with the disclaimer. Reuses the same
  // signal the welcome panel uses (see discovery-toast.tsx's listener on
  // 'welcome-showcase:toggle'); the hints are sticky and simply resume after.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('welcome-showcase:toggle', { detail: { open } }),
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent('welcome-showcase:toggle', { detail: { open: false } }),
      );
    };
  }, [open]);

  const dismiss = React.useCallback(() => {
    const wasReopen = reopenedRef.current;
    // Only persist first-run bookkeeping when this was the first-run showing.
    if (!wasReopen) {
      markSeen(dontRemind);
    }
    setOpen(false);
    reopenedRef.current = false;
    // Let the welcome showcase open only after the first-run notice is gone.
    if (!wasReopen && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(DATA_PROTECTION_CLOSE_EVENT));
    }
  }, [dontRemind]);

  if (!ready) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) dismiss(); }}>
      <DialogContent
        className="sm:max-w-lg flex flex-col p-0 gap-0 border-2 border-red-500/70 dark:border-red-500/60"
        data-testid="data-protection-notice"
      >
        <DialogHeader className="shrink-0 space-y-2 p-6 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/15 text-red-600 dark:text-red-400 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <DialogTitle className="text-xl font-bold tracking-tight text-red-700 dark:text-red-400">
              Keep your work safe
            </DialogTitle>
          </div>
          <DialogDescription className="text-[15px] leading-relaxed text-foreground">
            Your work lives on your own device, and keeping it safe is
            ultimately your responsibility.
          </DialogDescription>
        </DialogHeader>

        <div
          className="min-h-0 flex-1 overflow-y-auto px-6 space-y-4"
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
        >
          <div className="flex gap-2.5 rounded-lg border border-red-500/40 bg-red-500/5 p-3.5">
            <Cloud className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
            <p className="text-sm leading-relaxed text-foreground">
              Store your IdeaM files in an automatically-backed-up
              location — <strong>iCloud Drive, Dropbox, Google Drive,
              OneDrive, a Time Machine disk</strong>, or any backup you trust.
              IdeaM keeps automatic local snapshots as a safety net, but
              they are <strong>not a substitute</strong> for your own
              off-device backup.
            </p>
          </div>

          {isWeb && (
            <div
              className="flex gap-2.5 rounded-lg border border-red-500/50 bg-red-500/10 p-3.5"
              data-testid="data-protection-web-warning"
            >
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
              <p className="text-sm leading-relaxed text-foreground">
                Because you&rsquo;re using the web version, your work is stored
                inside this browser on this device. It can be lost if you clear
                your browser data, use private/incognito mode, or switch
                browsers. <strong>Export your outlines regularly</strong> and
                keep the copies in a backed-up location.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Good backup habits
            </p>
            <ul className="space-y-2">
              {BEST_PRACTICES.map((p) => {
                const Icon = p.icon;
                return (
                  <li key={p.text} className="flex items-start gap-2.5">
                    <Icon className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                    <span className="text-sm leading-relaxed text-foreground">
                      {p.text}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
            <HelpCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Need help choosing? Ask IdeaM Help.
            </p>
          </div>
        </div>

        <DialogFooter className="shrink-0 flex-col-reverse gap-3 border-t border-border/40 p-6 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <Checkbox
              checked={dontRemind}
              onCheckedChange={(v) => setDontRemind(v === true)}
              data-testid="data-protection-dont-remind"
            />
            Don&rsquo;t remind me again
          </label>
          <Button
            type="button"
            variant="default"
            onClick={dismiss}
            data-testid="data-protection-got-it"
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
