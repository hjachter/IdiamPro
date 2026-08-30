/**
 * Multi-provider TEXT-generation routing — provider registry + pure resolver.
 *
 * This is the ONE clean abstraction seam over which text generation is routed
 * to the USER-SELECTED provider (BYOK), defaulting to Google Gemini (our
 * default) when the user has selected nothing. Scope is TEXT generation only
 * (generate / expand / reformat / translate / summarize / transform) — image
 * and voice generation are NOT routed here.
 *
 * Two adapters sit behind this seam and cover four premium providers:
 *   1. Anthropic Messages-API adapter  → Claude
 *   2. OpenAI-compatible chat adapter   → OpenAI, Groq, Mistral
 *      (identical chat-completions wire format; they differ only by base URL
 *       and key.)
 * Gemini (cloud) and Gemma-via-Ollama already work and route through the same
 * seam (see generate-text.ts / ai-failover.ts).
 *
 * ── MONEY-SAFETY INVARIANT (release-blocker) ───────────────────────────────
 * Every PREMIUM provider is BYOK-ONLY: it runs on the USER'S OWN key and is
 * UNMETERED (their cost, their provider). The COMPANY key is GEMINI-ONLY and
 * metered by the server-side fail-closed usage meter. A user who selects a
 * premium provider but has NO key of their own is NEVER routed to a premium
 * model on the company key — the resolver falls them back to Gemini (our
 * default), which then flows through the existing metered / on-device path.
 * The resolver here NEVER reads a company env key for any premium provider.
 */

export type TextProviderId = 'gemini' | 'anthropic' | 'openai' | 'groq' | 'mistral';

/** Every provider the text seam knows how to route. */
export const SUPPORTED_TEXT_PROVIDERS: TextProviderId[] = [
  'gemini',
  'anthropic',
  'openai',
  'groq',
  'mistral',
];

/** Providers that speak the OpenAI chat-completions format (one adapter). */
export const OPENAI_COMPATIBLE_PROVIDERS = ['openai', 'groq', 'mistral'] as const;
export type OpenAICompatibleProvider = (typeof OPENAI_COMPATIBLE_PROVIDERS)[number];

/** Base URLs for the OpenAI-compatible providers (differ only by host + key). */
export const OPENAI_COMPATIBLE_BASE_URLS: Record<OpenAICompatibleProvider, string> = {
  openai: 'https://api.openai.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  mistral: 'https://api.mistral.ai/v1',
};

/**
 * Default model per PREMIUM provider — single-line-tunable. The user's own
 * model selection always overrides this. (Gemini's default lives in the
 * dedicated gemini-models.ts registry, so its entry here is empty.)
 */
export const DEFAULT_TEXT_MODELS: Record<TextProviderId, string> = {
  gemini: '', // resolved via getDefaultGeminiModel() in gemini-models.ts
  anthropic: 'claude-opus-4-8',
  openai: 'gpt-4o',
  groq: 'llama-3.3-70b-versatile',
  mistral: 'mistral-large-latest',
};

/** Friendly, user-facing provider name (for notices / logs). */
export const TEXT_PROVIDER_NAMES: Record<TextProviderId, string> = {
  gemini: 'Google Gemini',
  anthropic: 'Anthropic Claude',
  openai: 'OpenAI',
  groq: 'Groq',
  mistral: 'Mistral',
};

/**
 * A user's text-provider selection, as gathered from the BYOK settings. Any
 * field may be absent — an absent/blank provider means "use our default".
 */
export interface TextProviderSelection {
  provider?: TextProviderId | null;
  /** The user's OWN key for the selected provider (BYOK). */
  apiKey?: string | null;
  /** The user's chosen model id for the selected provider (optional). */
  model?: string | null;
}

/** The fully-resolved routing decision the seam acts on. */
export interface ResolvedTextProvider {
  provider: TextProviderId;
  /**
   * The key to run on. For a premium provider this is ALWAYS the user's own
   * key (never null once provider is premium). For gemini it is the user's
   * gemini key or null (null → company-funded Gemini via the metered path).
   */
  apiKey: string | null;
  /** The model id to use (already defaulted for premium providers). */
  model: string | null;
  /** True when running on the user's OWN key (unmetered, their cost). */
  isByok: boolean;
  /** True when this resolves to the company-funded Gemini path (metered). */
  usesCompanyGeminiFallback: boolean;
}

export function isPremiumTextProvider(p: TextProviderId): boolean {
  return p !== 'gemini';
}

export function isOpenAICompatible(p: TextProviderId): p is OpenAICompatibleProvider {
  return (OPENAI_COMPATIBLE_PROVIDERS as readonly string[]).includes(p);
}

/**
 * PURE resolver — the single source of truth for "which provider governs this
 * text generation, and on whose key". No I/O, so it is directly unit-testable.
 *
 * Rules (money-safety):
 *   • provider defaults to 'gemini' when unset/unknown → our default.
 *   • gemini + user key  → BYOK Gemini (unmetered).
 *   • gemini + no key    → company Gemini via the metered path (fail-closed
 *                          meter enforces entitlement).
 *   • premium + user key → route to that provider's adapter, BYOK, unmetered.
 *   • premium + NO key   → FALL BACK to Gemini (our default). A keyless user
 *                          can NEVER reach a premium model, and a premium
 *                          provider NEVER runs on the company key.
 */
export function resolveTextProvider(
  selection?: TextProviderSelection | null,
): ResolvedTextProvider {
  const requested =
    selection?.provider && SUPPORTED_TEXT_PROVIDERS.includes(selection.provider)
      ? selection.provider
      : 'gemini';

  const apiKey =
    selection?.apiKey && selection.apiKey.trim().length > 0
      ? selection.apiKey.trim()
      : null;

  const model =
    selection?.model && selection.model.trim().length > 0
      ? selection.model.trim()
      : null;

  if (requested === 'gemini') {
    return {
      provider: 'gemini',
      apiKey,
      model,
      isByok: !!apiKey,
      usesCompanyGeminiFallback: !apiKey,
    };
  }

  // Premium provider requested.
  if (!apiKey) {
    // No user key → NEVER a premium model on the company key. Fall back to our
    // Gemini default (company-metered / on-device path handles it downstream).
    return {
      provider: 'gemini',
      apiKey: null,
      model: null,
      isByok: false,
      usesCompanyGeminiFallback: true,
    };
  }

  return {
    provider: requested,
    apiKey,
    model: model || DEFAULT_TEXT_MODELS[requested],
    isByok: true,
    usesCompanyGeminiFallback: false,
  };
}
