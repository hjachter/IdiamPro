"use client";

import { useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { subscribeBackupHealth } from '@/lib/health/backup-health';

/**
 * BACKUP HEALTH WATCHER — the user-facing half of the backup watchdog
 * (src/lib/health/backup-health.ts).
 *
 * When the backup engine reports a REAL, verified failure, this raises ONE
 * loud, persistent (never auto-fading) warning toast so a dead safety net can
 * never hide silently again. When backups recover, the warning clears itself.
 * It stays completely silent while backups are healthy — no nagging.
 *
 * Mounted ONCE in the root layout so it's always present regardless of which
 * screen the user is on. "How to fix" dispatches a window event that the app
 * (outline-pro) listens for to open the Backup & Restore dialog. An explicit
 * onFix prop can override that when a host wants direct wiring.
 *
 * Every user gets this (not just admin) because it's about THEIR data.
 */
export default function BackupHealthWatcher({ onFix }: { onFix?: () => void }) {
  const { toast } = useToast();
  // Track the standing warning so we never stack duplicates and can clear it
  // the instant backups recover.
  const activeToast = useRef<{ dismiss: () => void } | null>(null);

  useEffect(() => {
    const handleFix = () => {
      if (onFix) {
        onFix();
        return;
      }
      try {
        window.dispatchEvent(new CustomEvent('idm:open-backup-restore'));
      } catch {
        /* ignore */
      }
    };

    const unsubscribe = subscribeBackupHealth((health) => {
      if (health.healthy) {
        // Recovered (or never broke) — clear any standing warning.
        if (activeToast.current) {
          activeToast.current.dismiss();
          activeToast.current = null;
        }
        return;
      }
      // Unhealthy — raise a single sticky warning (don't pile them up).
      if (activeToast.current) return;
      const reason = health.lastFailureReason ? ' ' + health.lastFailureReason : '';
      activeToast.current = toast({
        variant: 'destructive',
        duration: Infinity, // persists until the user dismisses it
        title: "Heads up — automatic backups aren't saving",
        description:
          'Your recent changes may not be protected.' +
          reason +
          ' Open Backup & Restore to save a copy of this outline now.',
        action: (
          <ToastAction altText="Open Backup & Restore" onClick={handleFix}>
            How to fix
          </ToastAction>
        ),
      });
    });
    return () => unsubscribe();
  }, [toast, onFix]);

  return null;
}
