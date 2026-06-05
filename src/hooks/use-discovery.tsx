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
  useState,
  type ReactNode,
} from 'react';
import {
  DISCOVERY_HINTS,
  type DiscoveryHint,
  type DiscoveryTrigger,
  getHintsForTrigger,
} from '@/lib/discovery/hints';

// ── storage backend (localStorage today; swap to DB later) ──────────────

const DISMISSED_KEY = 'discovery:dismissedHints';
const PROFESSIONAL_KEY = 'discovery:professionalMode';

interface DiscoveryStorage {
  loadDismissed(): Set<string>;
  saveDismissed(ids: Set<string>): void;
  loadProfessional(): boolean;
  saveProfessional(value: boolean): void;
}

const localStorageBackend: DiscoveryStorage = {
  loadDismissed() {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = window.localStorage.getItem(DISMISSED_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed.filter((x) => typeof x === 'string'));
      return new Set();
    } catch {
      return new Set();
    }
  },
  saveDismissed(ids) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(ids)));
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

interface DiscoveryContextValue {
  /** Hints currently visible as toasts. */
  activeHints: DiscoveryHint[];
  /** True when Professional mode is on (all hints suppressed). */
  isProfessional: boolean;
  /** Toggle Professional mode. Turning ON also clears active hints. */
  setProfessional: (value: boolean) => void;
  /** Mark a hint as dismissed and remove it from the active queue. */
  dismissHint: (id: string) => void;
  /** Imperative trigger fire — same as the global `fireDiscovery`. */
  fireDiscovery: (trigger: DiscoveryTrigger) => void;
}

const DiscoveryContext = createContext<DiscoveryContextValue | null>(null);

// ── provider ────────────────────────────────────────────────────────────

export function DiscoveryProvider({ children }: { children: ReactNode }) {
  // Hydrate from storage after mount to avoid SSR mismatch.
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [isProfessional, setIsProfessional] = useState<boolean>(false);
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    setDismissed(storage.loadDismissed());
    setIsProfessional(storage.loadProfessional());
    setHydrated(true);
  }, []);

  const showHint = useCallback(
    (hint: DiscoveryHint) => {
      setActiveIds((prev) => {
        // dedupe — never show the same hint twice at once
        if (prev.includes(hint.id)) return prev;
        return [...prev, hint.id];
      });
    },
    [],
  );

  // Listen for fire events globally.
  useEffect(() => {
    if (!eventBus || !hydrated) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<FireDetail>).detail;
      if (!detail) return;
      if (isProfessional) return;
      const hints = getHintsForTrigger(detail.trigger);
      for (const hint of hints) {
        if (dismissed.has(hint.id)) continue;
        const delay = hint.minDelayMs ?? 0;
        if (delay > 0) {
          setTimeout(() => {
            // Re-check dismissed state at fire time (user may have toggled
            // Professional mode or dismissed similar hints in the gap).
            const latestDismissed = storage.loadDismissed();
            const latestProfessional = storage.loadProfessional();
            if (latestProfessional) return;
            if (latestDismissed.has(hint.id)) return;
            showHint(hint);
          }, delay);
        } else {
          showHint(hint);
        }
      }
    };
    eventBus.addEventListener(FIRE_EVENT, handler);
    return () => eventBus.removeEventListener(FIRE_EVENT, handler);
  }, [dismissed, isProfessional, hydrated, showHint]);

  // Expose a debug helper on window in dev builds.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV !== 'production') {
      (window as unknown as { __fireDiscovery?: typeof fireDiscovery }).__fireDiscovery = fireDiscovery;
    }
  }, []);

  const dismissHint = useCallback(
    (id: string) => {
      setActiveIds((prev) => prev.filter((x) => x !== id));
      setDismissed((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        storage.saveDismissed(next);
        return next;
      });
    },
    [],
  );

  const setProfessional = useCallback((value: boolean) => {
    setIsProfessional(value);
    storage.saveProfessional(value);
    if (value) {
      // Turning Professional mode ON clears everything currently visible.
      setActiveIds([]);
    }
  }, []);

  const activeHints = useMemo(
    () =>
      activeIds
        .map((id) => DISCOVERY_HINTS.find((h) => h.id === id))
        .filter((h): h is DiscoveryHint => Boolean(h)),
    [activeIds],
  );

  const value = useMemo<DiscoveryContextValue>(
    () => ({
      activeHints,
      isProfessional,
      setProfessional,
      dismissHint,
      fireDiscovery,
    }),
    [activeHints, isProfessional, setProfessional, dismissHint],
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
      fireDiscovery: () => undefined,
    };
  }
  return ctx;
}
