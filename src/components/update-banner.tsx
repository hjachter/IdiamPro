'use client';

// UpdateBanner — non-intrusive banner that appears at the top of the app
// shell when the Electron auto-updater has downloaded a new version. Pairs
// with electron/main.js (which fires the update-downloaded IPC event) and
// electron/preload.js (which bridges it as electronAPI.onUpdateDownloaded).
//
// UX rules:
// - NEVER interrupts the user's work — it's a thin top banner, not a modal.
// - Two actions: Restart now (primary), Later (secondary).
// - "Later" snoozes for 24 hours in localStorage so the banner won't badger
//   the user on every paint; it will re-appear on next launch if the update
//   is still pending, or after 24h has elapsed.
// - Hidden completely outside Electron (web/iOS have their own update paths).
// - Test seam: window.__idiamProUpdateBannerTestSeed lets a Playwright probe
//   inject a synthetic update-downloaded payload without actually firing an
//   Electron event. Only active in NODE_ENV !== 'production'.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, X } from 'lucide-react';
import { isElectron } from '@/lib/electron-storage';
import { useToast } from '@/hooks/use-toast';

const SNOOZE_KEY = 'idiampro:update-banner-snoozed-until';
const SNOOZE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface DownloadedPayload {
  version: string | null;
  releaseNotes: unknown;
}

declare global {
  interface Window {
    __idiamProUpdateBannerTestSeed?: (payload: DownloadedPayload) => void;
  }
}

function readSnoozedUntil(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(SNOOZE_KEY);
    if (!raw) return 0;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeSnoozedUntil(timestamp: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SNOOZE_KEY, String(timestamp));
  } catch {
    // ignore quota / private-mode failures — worst case the banner re-fires
  }
}

export default function UpdateBanner() {
  const [downloaded, setDownloaded] = useState<DownloadedPayload | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { toast } = useToast();

  // Subscribe to the toast-style update events: when the user picks
  // "Check for Updates…" from the Help menu we surface a friendly toast
  // depending on the outcome (no update / check failed / checking…).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isElectron()) return;
    const api = window.electronAPI;
    const unsubs: Array<() => void> = [];
    if (api?.onUpdateCheckStarted) {
      const u = api.onUpdateCheckStarted(() => {
        toast({
          title: 'Checking for updates…',
          description: "We'll let you know if a new version is available.",
          duration: 4000,
        });
      });
      if (typeof u === 'function') unsubs.push(u);
    }
    if (api?.onUpdateNotAvailable) {
      const u = api.onUpdateNotAvailable((info) => {
        toast({
          title: "You're on the latest version.",
          description: info?.currentVersion ? `Running version ${info.currentVersion}.` : undefined,
          duration: 5000,
        });
      });
      if (typeof u === 'function') unsubs.push(u);
    }
    if (api?.onUpdateCheckFailed) {
      const u = api.onUpdateCheckFailed((info) => {
        toast({
          title: "Couldn't check for updates right now.",
          description: info?.message || 'Please try again in a moment.',
          variant: 'destructive',
          duration: 6000,
        });
      });
      if (typeof u === 'function') unsubs.push(u);
    }
    return () => {
      for (const fn of unsubs) {
        try { fn(); } catch { /* ignore */ }
      }
    };
  }, [toast]);

  // Subscribe to update-downloaded events from the Electron main process.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isElectron()) return;
    const api = window.electronAPI;
    if (!api?.onUpdateDownloaded) return;
    const unsubscribe = api.onUpdateDownloaded((info) => {
      // Respect a live snooze: don't flash the banner mid-session if the user
      // just clicked Later. We will, however, show it again after a snooze
      // window expires.
      const snoozedUntil = readSnoozedUntil();
      if (snoozedUntil > Date.now()) {
        return;
      }
      setDismissed(false);
      setDownloaded(info);
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Dev/test seam — lets a Playwright probe simulate an update-downloaded
  // event without needing to wire a real Electron flow.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV === 'production') return;
    window.__idiamProUpdateBannerTestSeed = (payload: DownloadedPayload) => {
      setDismissed(false);
      setDownloaded(payload);
    };
    return () => {
      try {
        delete window.__idiamProUpdateBannerTestSeed;
      } catch {
        // ignore
      }
    };
  }, []);

  const handleRestart = useCallback(async () => {
    setRestarting(true);
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.restartToUpdate) {
        await window.electronAPI.restartToUpdate();
      }
    } catch {
      // The main process logs; if quitAndInstall fails the app stays running.
      setRestarting(false);
    }
  }, []);

  const handleLater = useCallback(() => {
    writeSnoozedUntil(Date.now() + SNOOZE_MS);
    setDismissed(true);
  }, []);

  // Re-mount on next page load is a normal Electron lifecycle event — when the
  // user picks Later we just hide the banner for this session, and the next
  // update-downloaded fire (or next launch) brings it back if needed.

  const visible = useMemo(() => {
    if (!downloaded) return false;
    if (dismissed) return false;
    return true;
  }, [downloaded, dismissed]);

  if (!visible || !downloaded) return null;

  const versionLabel = downloaded.version ? `Version ${downloaded.version} is ready.` : 'A new version is ready.';

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="update-banner"
      className="w-full bg-primary/10 border-b border-primary/30 text-foreground"
    >
      <div className="flex flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm">
          <RefreshCw className="h-4 w-4 text-primary" aria-hidden="true" />
          <span>
            <strong className="font-semibold">Update ready.</strong> {versionLabel} Restart to apply.
          </span>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            size="sm"
            onClick={handleRestart}
            disabled={restarting}
            data-testid="update-banner-restart"
            className="h-8"
          >
            {restarting ? 'Restarting…' : 'Restart now'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleLater}
            data-testid="update-banner-later"
            className="h-8"
            aria-label="Snooze update for 24 hours"
          >
            Later
          </Button>
          <button
            type="button"
            onClick={handleLater}
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Dismiss update banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
