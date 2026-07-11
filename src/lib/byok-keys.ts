/**
 * Bring-Your-Own-Key (BYOK) helpers.
 *
 * The Settings UI lets users enter their own API keys for cloud AI providers
 * (Gemini, OpenAI, Anthropic, Mistral, Groq). This module is the single place
 * that knows:
 *
 *   1. WHERE the user's key is stored on the client (localStorage today;
 *      Keychain via Electron safeStorage / Capacitor in a follow-up).
 *   2. HOW the server resolves which key to use for a given request
 *      (user-supplied key wins, falls back to the env-var key).
 *
 * The pattern: client reads the user's key via `getUserApiKey(provider)`,
 * passes it as `userApiKey` to a server action; the server action passes
 * it to the AI flow; the flow calls `resolveApiKey(provider, userApiKey)`
 * to get the final key to use.
 *
 * Note: localStorage is NOT secure storage. A follow-up task should migrate
 * Electron to `app.safeStorage.encryptString` (Keychain-backed) and Capacitor
 * iOS to the @capacitor-community/secure-storage plugin. The helper signatures
 * below are intentionally shaped so that swap is a one-file change.
 */

export type BYOKProvider = 'gemini' | 'openai' | 'anthropic' | 'mistral' | 'groq' | 'openrouter' | 'assemblyai';

export const BYOK_PROVIDERS: BYOKProvider[] = ['gemini', 'openai', 'anthropic', 'mistral', 'groq', 'openrouter', 'assemblyai'];

/**
 * Map a provider id to the env-var name the server falls back to when
 * the user has not supplied their own key.
 */
const ENV_VAR_NAME: Record<BYOKProvider, string> = {
  gemini: 'GEMINI_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  groq: 'GROQ_API_KEY',
  // OpenRouter is registered as a dormant secondary-cloud provider. Its
  // client localStorage key is apiKey_openrouter (derived from the id below).
  // Nothing uses it until a key/env var is present — see ai-failover.ts.
  openrouter: 'OPENROUTER_API_KEY',
  // AssemblyAI powers audio transcription (BYOK). NOTE: the paid-feature gate
  // resolves the AssemblyAI key WITHOUT env fallback (never the founder's
  // personal key); this mapping exists only for symmetry / display.
  assemblyai: 'ASSEMBLYAI_API_KEY',
};

/**
 * CLIENT-SIDE: read the user's stored BYOK key for `provider`, or null
 * if none is stored. Safe to call from anywhere; returns null on the server.
 */
export function getUserApiKey(provider: BYOKProvider): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(`apiKey_${provider}`);
    return v && v.trim().length > 0 ? v.trim() : null;
  } catch {
    return null;
  }
}

/**
 * CLIENT-SIDE: bundle the user's keys for all providers in one object,
 * suitable for passing to a server action that may need any of them.
 * Keys that aren't set are omitted (not present), so the resolver can
 * tell "not set" from "intentionally empty".
 */
export function getUserApiKeys(): Partial<Record<BYOKProvider, string>> {
  const out: Partial<Record<BYOKProvider, string>> = {};
  for (const p of BYOK_PROVIDERS) {
    const k = getUserApiKey(p);
    if (k) out[p] = k;
  }
  return out;
}

/**
 * SERVER-SIDE: resolve the final API key the server should use for `provider`.
 * Prefers the user-supplied `userApiKey` (BYOK); falls back to the env var.
 * Returns null if neither is set — callers must check and throw a clean
 * error message rather than crashing.
 */
export function resolveApiKey(
  provider: BYOKProvider,
  userApiKey?: string | null,
): string | null {
  if (userApiKey && userApiKey.trim().length > 0) {
    return userApiKey.trim();
  }
  const envName = ENV_VAR_NAME[provider];
  const v = process.env[envName];
  return v && v.trim().length > 0 ? v.trim() : null;
}

/**
 * SERVER-SIDE: convenience that throws a user-friendly error if neither
 * the user's key nor the env-var key is available. Use this at the top
 * of any AI flow/action that needs a key.
 */
export function requireApiKey(
  provider: BYOKProvider,
  userApiKey?: string | null,
): string {
  const key = resolveApiKey(provider, userApiKey);
  if (!key) {
    throw new Error(
      `No ${provider} API key available. ` +
      `Either add one in Settings → AI Service Keys, or configure ${ENV_VAR_NAME[provider]} on the server.`,
    );
  }
  return key;
}
