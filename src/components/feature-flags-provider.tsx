'use client';

/**
 * Feature Switchboard — client provider + hooks.
 *
 * Fetches the effective flags ONCE on startup from /api/feature-flags, caches
 * them in context, and exposes:
 *   • useFeatureFlags()        → the raw effective flag list + loaded state
 *   • useFeatureFlag(key)      → boolean, resolved against the CURRENT user's
 *                                tier (Pro vs. free) + the dev "simulate free"
 *                                override, using the shared isFeatureEnabled().
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ HARD FAIL-SAFE — the flag system must NEVER blank/break/block the app. │
 * │  • State is SEEDED with DEFAULT_FLAGS, so before the fetch resolves     │
 * │    (and if it never does) every flag resolves to its safe default.     │
 * │  • A failed/aborted fetch keeps the seeded defaults — we never clear    │
 * │    the list on error.                                                   │
 * │  • useFeatureFlag falls back to DEFAULT_FLAGS for any key and returns   │
 * │    ENABLED for an unregistered key (isFeatureEnabled contract).         │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * Tier reactivity: Pro-ness comes from getCurrentTier() (tier-detection.ts),
 * which already honors the dev "simulate free" toggle. We re-render on that
 * toggle's event + on cross-tab storage changes so audience:'pro' / 'free'
 * targeting updates live without a reload.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { DEFAULT_FLAGS, isFeatureEnabled, type FeatureFlag } from '@/lib/flags/flags';
import { getCurrentTier } from '@/lib/tier-detection';
import { DEV_SIMULATE_FREE_EVENT } from '@/lib/dev/dev-simulate-free';

interface FeatureFlagsContextValue {
  /** Effective flags (defaults ⊕ server overrides). Seeded with defaults. */
  flags: FeatureFlag[];
  /** True once the server fetch has resolved (success OR failure). */
  loaded: boolean;
  /** Bumps whenever the current tier/simulate-free changes, to force re-eval. */
  tierTick: number;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue>({
  flags: [...DEFAULT_FLAGS],
  loaded: false,
  tierTick: 0,
});

/** True when the current session resolves to the Pro tier. */
function isProNow(): boolean {
  return getCurrentTier() === 'pro';
}

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  // SEED with defaults so the app is fully functional before/without the fetch.
  const [flags, setFlags] = useState<FeatureFlag[]>(() => [...DEFAULT_FLAGS]);
  const [loaded, setLoaded] = useState(false);
  const [tierTick, setTierTick] = useState(0);

  // Fetch effective flags once on startup. Any failure keeps the seeded
  // defaults — never clear the list on error.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      try {
        const resp = await fetch('/api/feature-flags', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!resp.ok) throw new Error(`flags fetch HTTP ${resp.status}`);
        const json = (await resp.json()) as { flags?: FeatureFlag[] };
        if (!cancelled && Array.isArray(json.flags) && json.flags.length > 0) {
          setFlags(json.flags);
        }
      } catch (err) {
        // FAIL-SAFE: keep seeded DEFAULT_FLAGS; the app must not break.
        // eslint-disable-next-line no-console
        console.warn(
          '[feature-flags] could not load remote flags — using safe defaults:',
          err,
        );
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  // Re-evaluate audience targeting when the dev simulate-free toggle flips or
  // the paid tier changes in another tab.
  useEffect(() => {
    const bump = () => setTierTick((t) => t + 1);
    window.addEventListener(DEV_SIMULATE_FREE_EVENT, bump);
    window.addEventListener('storage', bump);
    return () => {
      window.removeEventListener(DEV_SIMULATE_FREE_EVENT, bump);
      window.removeEventListener('storage', bump);
    };
  }, []);

  const value = useMemo<FeatureFlagsContextValue>(
    () => ({ flags, loaded, tierTick }),
    [flags, loaded, tierTick],
  );

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

/** The effective flag list + whether the remote fetch has resolved. */
export function useFeatureFlags(): { flags: FeatureFlag[]; loaded: boolean } {
  const { flags, loaded } = useContext(FeatureFlagsContext);
  return { flags, loaded };
}

/**
 * Resolve whether feature `key` is ON for the CURRENT user (tier-aware).
 *
 * Fail-safe: outside the provider, or before flags load, this still resolves
 * against DEFAULT_FLAGS via isFeatureEnabled(); an unregistered key returns
 * true. It can therefore be called anywhere without gating the app.
 */
export function useFeatureFlag(key: string): boolean {
  const { flags, tierTick } = useContext(FeatureFlagsContext);
  return useMemo(
    () => isFeatureEnabled(key, flags, isProNow()),
    // tierTick is intentionally a dependency: re-evaluate on tier changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, flags, tierTick],
  );
}
