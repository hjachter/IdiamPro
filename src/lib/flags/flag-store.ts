/**
 * Feature-flag override store (SERVER-ONLY).
 *
 * The registry of which flags EXIST and their safe defaults lives in code
 * (src/lib/flags/flags.ts, DEFAULT_FLAGS). This module persists the ADMIN
 * OVERRIDES (the enabled/audience an admin sets in the Switchboard) on top of
 * those defaults, routing through the same storage adapter every other server
 * store uses (src/lib/storage/adapter.ts):
 *
 *   • Production (Vercel): Vercel KV / Upstash Redis when KV env vars are set.
 *   • Electron / dev / test: atomic-write JSON files under `.idiampro/` — this
 *     is the "safe JSON fallback store" that makes the admin toggle fully
 *     functional end-to-end locally WITHOUT KV.
 *   • Degraded (no KV, read-only FS): a no-op stub.
 *
 * All overrides are stored under ONE key as a small map, so a read is a single
 * round-trip and the effective flag list is defaults ⊕ overrides.
 *
 *   feature-flags:overrides  →  Record<flagKey, { enabled, audience }>
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ FAIL-SAFE:                                                             │
 * │  • READS never throw — any storage error degrades to DEFAULT_FLAGS so  │
 * │    the app keeps working exactly as shipped.                          │
 * │  • WRITES surface a clear error to the admin caller when persistence   │
 * │    is genuinely unavailable (stub backend), but never crash the app.  │
 * └───────────────────────────────────────────────────────────────────────┘
 */

import 'server-only';
import { getStorage } from '@/lib/storage/adapter';
import {
  DEFAULT_FLAGS,
  FLAG_AUDIENCES,
  getDefaultFlag,
  mergeOverrides,
  type FeatureFlag,
  type FlagOverride,
} from '@/lib/flags/flags';

const OVERRIDES_KEY = 'feature-flags:overrides';

type OverrideMap = Record<string, Partial<FlagOverride>>;

/**
 * Read the current override map. Never throws — on any storage error we warn
 * once and return {} so callers degrade to pure DEFAULT_FLAGS.
 */
async function readOverrides(): Promise<OverrideMap> {
  try {
    const map = await getStorage().get<OverrideMap>(OVERRIDES_KEY);
    return map && typeof map === 'object' ? map : {};
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[flag-store] override read failed (flag store unavailable) — falling back to coded DEFAULT_FLAGS:',
      err,
    );
    return {};
  }
}

/**
 * The EFFECTIVE flag list: coded defaults with any admin overrides applied.
 * FAIL-SAFE: never throws; returns a fresh copy of DEFAULT_FLAGS if the store
 * is unreachable.
 */
export async function getEffectiveFlags(): Promise<FeatureFlag[]> {
  const overrides = await readOverrides();
  return mergeOverrides(overrides);
}

export interface WriteFlagResult {
  ok: boolean;
  /** Present when ok=false — an admin-facing message. */
  error?: string;
  /** The full effective flag list after the write (echoed for the UI). */
  flags: FeatureFlag[];
}

/**
 * Persist an override for one flag. Validates that the key is a registered
 * flag and the audience is legal. Surfaces (does not throw) a clear error when
 * the store is unavailable so the admin sees why nothing saved.
 */
export async function writeFlagOverride(
  key: string,
  patch: FlagOverride,
): Promise<WriteFlagResult> {
  // Validate against the coded registry — never let the API invent flags.
  if (!getDefaultFlag(key)) {
    const flags = await getEffectiveFlags();
    return { ok: false, error: `Unknown flag "${key}".`, flags };
  }
  if (typeof patch.enabled !== 'boolean' || !FLAG_AUDIENCES.includes(patch.audience)) {
    const flags = await getEffectiveFlags();
    return { ok: false, error: 'Invalid flag settings.', flags };
  }

  const storage = getStorage();

  // FAIL-SAFE for the WRITE path: the stub backend silently no-ops, which would
  // make a save look successful while persisting nothing. Detect that and tell
  // the admin plainly instead of lying.
  if (storage.backend === 'stub') {
    const flags = await getEffectiveFlags();
    return {
      ok: false,
      error:
        'Flag store is unavailable (no KV provisioned and filesystem not writable). ' +
        'Changes cannot be saved right now — the app is safely using coded defaults. ' +
        'Provision Vercel KV and redeploy to enable the Switchboard.',
      flags,
    };
  }

  try {
    const overrides = await readOverrides();
    overrides[key] = { enabled: patch.enabled, audience: patch.audience };
    await storage.set(OVERRIDES_KEY, overrides);
    const flags = mergeOverrides(overrides);
    return { ok: true, flags };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[flag-store] override write failed:', err);
    const flags = await getEffectiveFlags();
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to save flag.',
      flags,
    };
  }
}

/** Test-only: wipe all overrides so a suite starts from pure defaults. */
export async function _resetFlagOverridesForTest(): Promise<void> {
  try {
    await getStorage().delete(OVERRIDES_KEY);
  } catch {
    /* best-effort */
  }
}

export { DEFAULT_FLAGS };
