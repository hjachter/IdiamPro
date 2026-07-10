/**
 * BACKUP HEALTH — a user-facing watchdog for the outline snapshot / backup
 * engine (src/lib/snapshot-storage.ts).
 *
 * WHY THIS EXISTS: the manual backup path silently died on desktop for weeks
 * with ZERO symptoms — the code ran, but nothing ever wrote to disk, and the
 * user had no way to know their safety net was gone. This module makes a dead
 * backup impossible to hide: every snapshot attempt reports its REAL outcome
 * here (verified, not just "the function was called"), and a UI watcher
 * (backup-health-watcher.tsx) raises a loud, persistent warning the moment a
 * backup genuinely fails — and clears it the moment backups recover.
 *
 * DESIGN RULES (do not violate):
 *   - QUIET WHEN HEALTHY: only a REAL, verified failure flips the state to
 *     unhealthy. A healthy environment — or one where snapshots are
 *     intentionally off (e.g. the web build) — never raises anything. No nag.
 *   - NEVER THROWS: this is outline-data-safety plumbing. Every function is
 *     wrapped so the health tracker itself can never crash a save, throw, or
 *     put data at risk. A broken listener can't break a backup.
 *   - CHEAP: pure in-memory state + a small listener set. No timers, no IO,
 *     no perf drag on the save path.
 */

export interface BackupHealth {
  /** False only after a real, verified backup failure (until it recovers). */
  healthy: boolean;
  /** Epoch ms of the last verified-good snapshot, or null. */
  lastSuccessAt: number | null;
  /** Epoch ms of the last failure, or null. */
  lastFailureAt: number | null;
  /** Short plain-language reason for the last failure, or null when healthy. */
  lastFailureReason: string | null;
}

let state: BackupHealth = {
  healthy: true,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastFailureReason: null,
};

type Listener = (health: BackupHealth) => void;
const listeners = new Set<Listener>();

function emit(): void {
  const snapshot: BackupHealth = { ...state };
  listeners.forEach((listener) => {
    // A single misbehaving listener must never break a save or the sweep.
    try {
      listener(snapshot);
    } catch {
      /* swallow — data safety comes first */
    }
  });
}

/** Current health snapshot (a copy — callers can't mutate internal state). */
export function getBackupHealth(): BackupHealth {
  return { ...state };
}

/**
 * Subscribe to health changes. The listener is called immediately with the
 * current state, then on every change. Returns an unsubscribe function.
 */
export function subscribeBackupHealth(listener: Listener): () => void {
  listeners.add(listener);
  try {
    listener({ ...state });
  } catch {
    /* ignore */
  }
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Record that a snapshot wrote AND verified successfully. Clears any standing
 * warning and marks the safety net healthy again.
 */
export function reportBackupSuccess(): void {
  try {
    state = {
      healthy: true,
      lastSuccessAt: Date.now(),
      lastFailureAt: state.lastFailureAt,
      lastFailureReason: null,
    };
    emit();
  } catch {
    /* never throw */
  }
}

/**
 * Record that a snapshot attempt failed or could not be verified. Flips the
 * state to unhealthy so the UI watcher raises a loud, persistent warning.
 */
export function reportBackupFailure(reason: string): void {
  try {
    state = {
      healthy: false,
      lastSuccessAt: state.lastSuccessAt,
      lastFailureAt: Date.now(),
      lastFailureReason: (reason && reason.trim()) || 'Unknown backup error.',
    };
    emit();
  } catch {
    /* never throw */
  }
}
