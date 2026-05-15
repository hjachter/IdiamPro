/**
 * Gemini Model Registry
 *
 * Single source of truth for which Gemini variants the app supports and
 * which one is the current default. Adding a new model (e.g. Gemini 4 on
 * 2026-05-19) is a one-line entry in this file — no call-site edits needed.
 *
 * Mirrors the OLLAMA_MODELS pattern in src/lib/ollama-service.ts.
 *
 * Model availability as of 2026-05-14 (queried from Google AI Studio):
 *   GA:      gemini-2.0-flash, gemini-2.0-flash-lite,
 *            gemini-2.5-flash, gemini-2.5-pro, gemini-2.5-flash-lite
 *   Preview: gemini-3-flash-preview, gemini-3-pro-preview,
 *            gemini-3.1-flash-lite, gemini-3.1-pro-preview
 *   Floating: gemini-flash-latest, gemini-pro-latest, gemini-flash-lite-latest
 */

export type GeminiTier = 'free' | 'pro' | 'premium' | 'legacy';

export interface GeminiModelEntry {
  /** Stable internal id used by Settings UI + localStorage */
  id: string;
  /** Human-readable label (Settings UI, marketing) */
  name: string;
  /** Genkit-namespaced id, used by `ai.generate()` and `genkit({ model })` */
  genkit: string;
  /** Bare SDK id, used by `GoogleGenerativeAI().getGenerativeModel({ model })` */
  sdk: string;
  /** Capability tier — controls which subscription level can pick it */
  tier: GeminiTier;
  /** Approximate input context window in tokens (informational) */
  contextTokens: number;
  /** True if this model is a preview release (may change/disappear) */
  preview?: boolean;
  /** Marketing one-liner */
  blurb: string;
}

export const GEMINI_MODELS: Record<string, GeminiModelEntry> = {
  // === Default for v1 launch — GA, stable, current generation ===
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    genkit: 'googleai/gemini-2.5-flash',
    sdk: 'gemini-2.5-flash',
    tier: 'free',
    contextTokens: 1_000_000,
    blurb: 'Fast, capable, and free. The default for most outline work.',
  },
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    genkit: 'googleai/gemini-2.5-pro',
    sdk: 'gemini-2.5-pro',
    tier: 'pro',
    contextTokens: 2_000_000,
    blurb: 'Higher reasoning quality for deep research and LIVE BOOKS.',
  },

  // === Preview tier (use at own risk, may change/disappear) ===
  'gemini-3.1-flash-lite': {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite (Preview)',
    genkit: 'googleai/gemini-3.1-flash-lite',
    sdk: 'gemini-3.1-flash-lite',
    tier: 'free',
    contextTokens: 1_000_000,
    preview: true,
    blurb: 'Next-gen Flash, preview build. Faster but less battle-tested.',
  },
  'gemini-3.1-pro-preview': {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro (Preview)',
    genkit: 'googleai/gemini-3.1-pro-preview',
    sdk: 'gemini-3.1-pro-preview',
    tier: 'pro',
    contextTokens: 2_000_000,
    preview: true,
    blurb: 'Next-gen Pro, preview build. Strongest reasoning available today.',
  },

  // === Auto-track-latest aliases (for users who always want the newest) ===
  'gemini-flash-latest': {
    id: 'gemini-flash-latest',
    name: 'Gemini Flash (Auto-Latest)',
    genkit: 'googleai/gemini-flash-latest',
    sdk: 'gemini-flash-latest',
    tier: 'free',
    contextTokens: 1_000_000,
    blurb: 'Always tracks Google\'s newest Flash. Unstable by design.',
  },
  'gemini-pro-latest': {
    id: 'gemini-pro-latest',
    name: 'Gemini Pro (Auto-Latest)',
    genkit: 'googleai/gemini-pro-latest',
    sdk: 'gemini-pro-latest',
    tier: 'pro',
    contextTokens: 2_000_000,
    blurb: 'Always tracks Google\'s newest Pro. Unstable by design.',
  },

  // === Legacy fallback ===
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash (Legacy)',
    genkit: 'googleai/gemini-2.0-flash',
    sdk: 'gemini-2.0-flash',
    tier: 'legacy',
    contextTokens: 1_000_000,
    blurb: 'Previous generation. Kept as a fallback while we soak the upgrade.',
  },

  // === Future entries (add on 2026-05-19 when Google I/O ships the next gen) ===
  // 'gemini-4-flash':   { ... tier: 'free' ... },
  // 'gemini-4-pro':     { ... tier: 'pro' ... },
  // 'gemini-4-ultra':   { ... tier: 'premium' ... },
};

/**
 * Default model id — change this single line to swap the app-wide default.
 *
 * Current: gemini-2.5-flash (bumped from 2.0-flash on 2026-05-14).
 * Override at runtime via env: `process.env.GEMINI_DEFAULT_MODEL_ID`.
 */
export const DEFAULT_GEMINI_MODEL_ID =
  (typeof process !== 'undefined' && process.env?.GEMINI_DEFAULT_MODEL_ID) ||
  'gemini-2.5-flash';

/**
 * Get the default model identifier in the requested format.
 *
 * @param format 'genkit' for Genkit/`ai.generate()` calls,
 *               'sdk' for raw `GoogleGenerativeAI` calls.
 */
export function getDefaultGeminiModel(format: 'genkit' | 'sdk' = 'genkit'): string {
  const entry = GEMINI_MODELS[DEFAULT_GEMINI_MODEL_ID];
  if (!entry) {
    // Defensive fallback — should never happen with the registry above.
    return format === 'genkit' ? 'googleai/gemini-2.5-flash' : 'gemini-2.5-flash';
  }
  return format === 'genkit' ? entry.genkit : entry.sdk;
}

/**
 * Look up a model entry by id (used by the Settings model picker).
 */
export function getGeminiModelById(id: string): GeminiModelEntry | undefined {
  return GEMINI_MODELS[id];
}

/**
 * List all registered models, optionally filtered by tier.
 */
export function listGeminiModels(tier?: GeminiTier): GeminiModelEntry[] {
  const all = Object.values(GEMINI_MODELS);
  return tier ? all.filter(m => m.tier === tier) : all;
}
