'use client';

/**
 * Discovery Hints — React provider + hook.
 *
 * See `src/lib/discovery/hints.ts` for the registry contract.
 *
 * State lives in localStorage today; the persistence functions at the top
 * of this file are the single extension point for moving it to a DB row
 * keyed by Clerk userId later. The hook's call sites never change.
 *
 * Global event surface:
 *   `fireDiscovery(trigger)` — call from anywhere. The hook listens on a
 *   tiny EventTarget so call sites don't have to thread the provider down.
 *   For debugging, the same function is exposed on `window.__fireDiscovery`
 *   in development builds.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  DISCOVERY_HINTS,
  type DiscoveryHint,
  type DiscoveryTrigger,
  getHintsForTrigger,
} from '@/lib/discovery/hints';
import { toast } from '@/hooks/use-toast';

// ── storage backend (localStorage today; swap to DB later) ──────────────

/**
 * Storage keys.
 *
 * Two-tier dismissal model (2026-06-05):
 *   - `discovery:hardDismissedHints` — hints the user explicitly chose to
 *     never see again ("Don't show me this again" checkbox + Got it).
 *     These persist across sessions AND survive Pro-mode toggle off.
 *   - There is intentionally no "soft-dismissed" persisted set. Soft
 *     dismissal just means "currently not in the active queue" — the next
 *     time the trigger fires, the hint is eligible again.
 *
 * Legacy migration: the old `discovery:dismissedHints` single bucket gets
 * promoted to hard-dismissed on first load, then deleted. Safest
 * interpretation — the user had dismissed those hints, so honor it.
 */
const LEGACY_DISMISSED_KEY = 'discovery:dismissedHints';
const HARD_DISMISSED_KEY = 'discovery:hardDismissedHints';
const PROFESSIONAL_KEY = 'discovery:professionalMode';

interface DiscoveryStorage {
  loadHardDismissed(): Set<string>;
  saveHardDismissed(ids: Set<string>): void;
  loadProfessional(): boolean;
  saveProfessional(value: boolean): void;
}

const localStorageBackend: DiscoveryStorage = {
  loadHardDismissed() {
    if (typeof window === 'undefined') return new Set();
    try {
      // Migration: if the legacy single-bucket key exists, promote its
      // contents to hardDismissed and delete the old key.
      const legacy = window.localStorage.getItem(LEGACY_DISMISSED_KEY);
      const current = window.localStorage.getItem(HARD_DISMISSED_KEY);
      let merged: Set<string> = new Set();
      if (current) {
        try {
          const parsed = JSON.parse(current);
          if (Array.isArray(parsed)) {
            merged = new Set(parsed.filter((x) => typeof x === 'string'));
          }
        } catch {
          // ignore malformed
        }
      }
      if (legacy) {
        try {
          const parsedLegacy = JSON.parse(legacy);
          if (Array.isArray(parsedLegacy)) {
            for (const v of parsedLegacy) {
              if (typeof v === 'string') merged.add(v);
            }
          }
        } catch {
          // ignore
        }
        // Persist the merged set and drop the legacy key so we only migrate once.
        try {
          window.localStorage.setItem(
            HARD_DISMISSED_KEY,
            JSON.stringify(Array.from(merged)),
          );
          window.localStorage.removeItem(LEGACY_DISMISSED_KEY);
        } catch {
          // ignore
        }
      }
      return merged;
    } catch {
      return new Set();
    }
  },
  saveHardDismissed(ids) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        HARD_DISMISSED_KEY,
        JSON.stringify(Array.from(ids)),
      );
    } catch {
      // private mode / disabled storage — ignore silently
    }
  },
  loadProfessional() {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(PROFESSIONAL_KEY) === 'true';
    } catch {
      return false;
    }
  },
  saveProfessional(value) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(PROFESSIONAL_KEY, String(value));
    } catch {
      // ignore
    }
  },
};

// Extension point: when Clerk userId is wired in, swap this constant for a
// DB-backed storage object. Call sites stay identical.
const storage: DiscoveryStorage = localStorageBackend;

// ── cross-component event bus (so any call site can fire) ───────────────

const FIRE_EVENT = 'discovery:fire';

interface FireDetail {
  trigger: DiscoveryTrigger;
}

const eventBus =
  typeof window !== 'undefined' ? new EventTarget() : null;

export function fireDiscovery(trigger: DiscoveryTrigger): void {
  if (!eventBus) return;
  eventBus.dispatchEvent(
    new CustomEvent<FireDetail>(FIRE_EVENT, { detail: { trigger } }),
  );
}

// ── context shape ───────────────────────────────────────────────────────

interface DismissOptions {
  /**
   * When true, add the hint to the persistent "hard-dismissed" list so it
   * never fires again for this user. When false/undefined, only the current
   * toast goes away — the hint is eligible to re-fire next time the trigger
   * matches.
   */
  permanent?: boolean;
}

interface DiscoveryContextValue {
  /** Hints currently visible as toasts. */
  activeHints: DiscoveryHint[];
  /** True when Professional mode is on (all hints suppressed). */
  isProfessional: boolean;
  /** Toggle Professional mode. Turning ON also clears active hints. */
  setProfessional: (value: boolean) => void;
  /**
   * Remove a hint from the active queue.
   *   - permanent=false (default): soft dismiss — the hint is eligible to
   *     fire again the next time its trigger occurs.
   *   - permanent=true: hard dismiss — the hint is added to the
   *     hard-dismissed list and never fires again, regardless of Pro mode.
   */
  dismissHint: (id: string, options?: DismissOptions) => void;
  /**
   * Clear the persistent "hard-dismissed" set so every "Did You Know?" tip
   * becomes eligible to fire again on its next trigger. Used by the Settings
   * "bring back tips" control so a permanent opt-out is always reversible.
   * Returns the number of tips that were re-enabled.
   */
  resetHardDismissed: () => number;
  /** Imperative trigger fire — same as the global `fireDiscovery`. */
  fireDiscovery: (trigger: DiscoveryTrigger) => void;
}

const DiscoveryContext = createContext<DiscoveryContextValue | null>(null);

// ── provider ────────────────────────────────────────────────────────────

export function DiscoveryProvider({ children }: { children: ReactNode }) {
  // Hydrate from storage after mount to avoid SSR mismatch.
  const [hardDismissed, setHardDismissed] = useState<Set<string>>(
    () => new Set(),
  );
  const [isProfessional, setIsProfessional] = useState<boolean>(false);
  // Single-at-a-time surfacing (2026-07-10): only ONE hint is visible at any
  // moment (`activeId`). Additional eligible hints wait in `queue` and are
  // promoted one at a time — the next only appears after the current one is
  // dismissed, plus a short breather. This stops the "three toasts at once"
  // pile-up a brand-new user hit when creating their first outline. No hint is
  // ever lost — everything that would have fired is queued instead.
  const [activeId, setActiveId] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState<boolean>(false);

  // Mirror of activeId for read-during-enqueue without a dependency cycle.
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    setHardDismissed(storage.loadHardDismissed());
    setIsProfessional(storage.loadProfessional());
    setHydrated(true);
  }, []);

  // Add a hint to the waiting line. Deduped against the currently-visible hint
  // and anything already queued so a re-fired trigger can't stack duplicates.
  const enqueueHint = useCallback((hint: DiscoveryHint) => {
    setQueue((prev) => {
      if (hint.id === activeIdRef.current) return prev;
      if (prev.includes(hint.id)) return prev;
      return [...prev, hint.id];
    });
  }, []);

  // Promotion loop: whenever nothing is showing and the queue is non-empty,
  // surface the next hint after a short, humane gap.
  useEffect(() => {
    if (activeId !== null || queue.length === 0) return;
    const timer = setTimeout(() => {
      setActiveId(queue[0]);
      setQueue((prev) => prev.slice(1));
    }, 600);
    return () => clearTimeout(timer);
  }, [activeId, queue]);

  // Listen for fire events globally.
  useEffect(() => {
    if (!eventBus || !hydrated) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<FireDetail>).detail;
      if (!detail) return;
      if (isProfessional) return;
      const hints = getHintsForTrigger(detail.trigger);
      for (const hint of hints) {
        // Hard-dismissed hints never fire again.
        if (hardDismissed.has(hint.id)) continue;
        const delay = hint.minDelayMs ?? 0;
        if (delay > 0) {
          setTimeout(() => {
            // Re-check state at fire time (user may have toggled Pro mode
            // or hard-dismissed a similar hint during the delay).
            const latestHard = storage.loadHardDismissed();
            const latestProfessional = storage.loadProfessional();
            if (latestProfessional) return;
            if (latestHard.has(hint.id)) return;
            enqueueHint(hint);
          }, delay);
        } else {
          enqueueHint(hint);
        }
      }
    };
    eventBus.addEventListener(FIRE_EVENT, handler);
    return () => eventBus.removeEventListener(FIRE_EVENT, handler);
  }, [hardDismissed, isProfessional, hydrated, enqueueHint]);

  // Expose a debug helper on window in dev builds.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV !== 'production') {
      (window as unknown as { __fireDiscovery?: typeof fireDiscovery }).__fireDiscovery = fireDiscovery;
    }
  }, []);

  const dismissHint = useCallback(
    (id: string, options?: DismissOptions) => {
      // Clear the currently-visible hint (if it's this one) so the promotion
      // loop can surface the next queued hint. Also drop it from the queue in
      // case it was waiting rather than showing.
      setActiveId((prev) => (prev === id ? null : prev));
      setQueue((prev) => prev.filter((x) => x !== id));
      // Permanent? Add to the hard-dismissed set and persist.
      if (options?.permanent) {
        setHardDismissed((prev) => {
          if (prev.has(id)) return prev;
          const next = new Set(prev);
          next.add(id);
          storage.saveHardDismissed(next);
          return next;
        });
      }
      // Otherwise it's a soft dismiss — nothing else to do. The hint stays
      // eligible to fire again next time its trigger occurs.
    },
    [],
  );

  const resetHardDismissed = useCallback((): number => {
    let count = 0;
    setHardDismissed((prev) => {
      count = prev.size;
      if (count === 0) return prev;
      const empty = new Set<string>();
      storage.saveHardDismissed(empty);
      return empty;
    });
    return count;
  }, []);

  const setProfessional = useCallback((value: boolean) => {
    setIsProfessional(value);
    storage.saveProfessional(value);
    if (value) {
      // Turning Professional mode ON clears everything currently visible
      // and the waiting line, and suppresses future fires (the listener above
      // bails on `isProfessional`).
      setActiveId(null);
      setQueue([]);
    } else {
      // Turning Professional mode OFF restores normal behavior: hints can
      // fire again on their triggers. We DO NOT clear the hard-dismissed
      // list — anything the user explicitly told us "don't show again"
      // stays hidden forever. A transient toast confirms the change.
      toast({
        title: 'Welcome tips re-enabled',
        description:
          "You'll see them on next-trigger — except the ones you marked “Don't show again.”",
      });
    }
  }, []);

  const activeHints = useMemo(() => {
    if (!activeId) return [];
    const hint = DISCOVERY_HINTS.find((h) => h.id === activeId);
    return hint ? [hint] : [];
  }, [activeId]);

  const value = useMemo<DiscoveryContextValue>(
    () => ({
      activeHints,
      isProfessional,
      setProfessional,
      dismissHint,
      resetHardDismissed,
      fireDiscovery,
    }),
    [activeHints, isProfessional, setProfessional, dismissHint, resetHardDismissed],
  );

  return (
    <DiscoveryContext.Provider value={value}>
      {children}
    </DiscoveryContext.Provider>
  );
}

export function useDiscovery(): DiscoveryContextValue {
  const ctx = useContext(DiscoveryContext);
  if (!ctx) {
    // Defensive no-op: outside the provider, never crash — the discovery
    // system is a UX nicety, not a correctness requirement.
    return {
      activeHints: [],
      isProfessional: false,
      setProfessional: () => undefined,
      dismissHint: () => undefined,
      resetHardDismissed: () => 0,
      fireDiscovery: () => undefined,
    };
  }
  return ctx;
}
