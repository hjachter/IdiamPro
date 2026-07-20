/**
 * AI Failover + Error Classification (server-side)
 * ------------------------------------------------
 *
 * A small, reusable helper that makes any cloud-AI call resilient to outages.
 * It attempts the chosen cloud provider (Gemini today), and — depending on the
 * user's AI Provider setting (Cloud / Local / Auto) — falls back to a local
 * Ollama Gemma model when the cloud call fails.
 *
 * It also CLASSIFIES the failure so the UI can tell the user something useful:
 *   - billing / auth / quota problems (e.g. Google's 403 "dunning decision:
 *     deny", PERMISSION_DENIED, quota exceeded, invalid/expired key) vs.
 *   - transient / other errors.
 *
 * And it knows whether the failing key was the user's OWN key (BYOK) or the
 * app's default env-var key — so we can decide whether to tell the user to
 * check THEIR provider billing, or just quietly fall back.
 *
 * The Help chat wires to this now. Other AI features can adopt it later by
 * passing their own `cloudAttempt` / `localAttempt` closures.
 */

import { getBestAvailableModel, hasGemma4, isOllamaAvailable } from '@/lib/ollama-service';

export type AIProviderChoice = 'cloud' | 'local' | 'auto';

/**
 * Which real backend produced the answer.
 * - 'cloud'           → the primary cloud provider (Gemini today)
 * - 'secondary-cloud' → the dormant OpenRouter tier (only when a key exists)
 * - 'local'           → local Ollama Gemma
 */
export type AnsweredBy = 'cloud' | 'secondary-cloud' | 'local';

/** Result of a failover-wrapped AI call. */
export interface AIFailoverResult {
  /** The generated answer text. */
  text: string;
  /** Which backend actually produced the answer. */
  answeredBy: AnsweredBy;
  /** True when the cloud provider failed and we fell back to local Gemma. */
  fellBackToLocal: boolean;
  /**
   * True when the primary cloud failed and we answered with the secondary-cloud
   * provider (OpenRouter). Dormant unless an OpenRouter key/env is present.
   */
  secondaryCloudUsed: boolean;
  /** True when the cloud failure looked like a billing / auth / quota problem. */
  billingIssue: boolean;
  /** True when the failing cloud key was the user's own (BYOK) key, not the app default. */
  failingKeyWasByok: boolean;
  /** Friendly name of the cloud provider that failed (for user messaging). */
  cloudProviderName: string;
  /** Friendly name of the secondary-cloud provider that answered, when applicable. */
  secondaryCloudProviderName?: string;
  /** The local model name that answered, when applicable (e.g. "gemma4:e4b"). */
  localModelName?: string;
}

/** Signature for a cloud generation attempt. Throws on failure. */
export type CloudAttempt = () => Promise<string>;

/** Signature for a local (Ollama) generation attempt. Throws on failure. */
export type LocalAttempt = (modelName: string) => Promise<string>;

export interface RunAIWithFailoverOptions {
  /** The user's AI Provider setting. */
  provider: AIProviderChoice;
  /** Runs the cloud model (e.g. Gemini via genkit). Throws on failure. */
  cloudAttempt: CloudAttempt;
  /** Runs the local Gemma model. Receives the selected model name. Throws on failure. */
  localAttempt: LocalAttempt;
  /** True when the cloud key in play is the user's own BYOK key (vs the app default). */
  cloudKeyIsByok: boolean;
  /** Friendly provider name for user messaging. Defaults to "Gemini". */
  cloudProviderName?: string;

  // ---- Optional secondary-cloud (OpenRouter) tier — fully dormant unless a key exists ----
  /**
   * OpenRouter API key to use for the secondary-cloud attempt. When omitted,
   * the OPENROUTER_API_KEY env var is used. When NEITHER is present, the
   * secondary tier never fires and behavior is identical to before.
   */
  openRouterApiKey?: string | null;
  /**
   * The prompt to send to OpenRouter if the primary cloud fails. The tier only
   * activates when both a key AND this prompt are present, so a caller that
   * doesn't opt in stays on the original cloud → local path.
   */
  openRouterPrompt?: string;
  /** Optional OpenRouter model id override (defaults to DEFAULT_OPENROUTER_MODEL). */
  openRouterModel?: string;
  /** Friendly name for the secondary provider in user messaging. Defaults to "OpenRouter". */
  secondaryCloudProviderName?: string;
}

/**
 * Default OpenRouter model for the secondary-cloud tier. A cheap, widely
 * available OpenAI-compatible model; callers can override via openRouterModel.
 */
export const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini';

/**
 * Call OpenRouter's OpenAI-compatible chat completions endpoint and return the
 * text. This is the secondary-cloud helper: given a key and a prompt, it does a
 * single non-streaming completion. Throws on any non-OK response, preserving the
 * HTTP status in the message so isBillingOrAuthError() can classify auth/billing
 * failures the same way it does for the primary provider.
 */
export async function callOpenRouter(
  apiKey: string,
  prompt: string,
  model?: string,
): Promise<string> {
  const chosenModel = model || DEFAULT_OPENROUTER_MODEL;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      // Optional attribution headers OpenRouter recommends; harmless if ignored.
      'HTTP-Referer': 'https://2ndbrainware.com',
      'X-Title': 'IdeaM',
    },
    body: JSON.stringify({
      model: chosenModel,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OpenRouter error (${response.status}): ${body}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('OpenRouter returned an empty response');
  }
  return text;
}

/**
 * Classify a cloud-AI error as a billing/auth/quota problem (vs transient).
 *
 * We match a broad set of signals so this holds up across genkit, the raw
 * Google SDK, and future providers: HTTP 401/402/403, PERMISSION_DENIED,
 * RESOURCE_EXHAUSTED / quota, "dunning" (Google's billing-suspension phrase),
 * "billing", "suspended", "invalid api key", "expired", "unauthorized".
 */
export function isBillingOrAuthError(err: unknown): boolean {
  const msg = errorText(err).toLowerCase();
  if (!msg) return false;

  // HTTP status codes commonly attached to the error object or message.
  const status = extractStatus(err);
  if (status === 401 || status === 402 || status === 403 || status === 429) {
    // 429 can be a plain rate-limit OR a quota-exhaustion; treat quota-flavored
    // 429s as billing, but leave a bare "rate limit" as transient.
    if (status === 429 && !/quota|resource_exhausted|exhausted|billing/i.test(msg)) {
      return false;
    }
    return true;
  }

  return /(\bdunning\b|permission_denied|billing|dunning decision|quota|resource_exhausted|suspended|invalid api key|invalid_api_key|api key not valid|expired|unauthorized|401|402|403)/i.test(
    msg,
  );
}

/** Best-effort HTTP status extraction from a variety of error shapes. */
function extractStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object') {
    const anyErr = err as Record<string, unknown>;
    const candidates = [anyErr.status, anyErr.statusCode, anyErr.code];
    for (const c of candidates) {
      if (typeof c === 'number') return c;
      if (typeof c === 'string' && /^\d{3}$/.test(c)) return parseInt(c, 10);
    }
  }
  const m = errorText(err).match(/\b(401|402|403|429)\b/);
  return m ? parseInt(m[1], 10) : undefined;
}

/** Normalize any thrown value to a string message. */
export function errorText(err: unknown): string {
  if (err instanceof Error) return err.message + (err.stack ? '' : '');
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/**
 * Is a local Gemma model reachable right now?
 * Returns the model name if yes, otherwise null.
 */
export async function reachableLocalGemma(): Promise<string | null> {
  try {
    if (!(await isOllamaAvailable())) return null;
    if (!(await hasGemma4())) {
      // No Gemma variant; fall back to whatever best model exists so we still
      // answer, but prefer Gemma per the product spec.
      return (await getBestAvailableModel()) || null;
    }
    return (await getBestAvailableModel()) || null;
  } catch {
    return null;
  }
}

/**
 * Run an AI request with provider honoring + automatic local fallback.
 *
 * - provider === 'local'  → run local Gemma directly.
 * - provider === 'cloud'  → run cloud; on failure, if local Gemma is reachable,
 *                           fall back to it (so a Cloud user isn't left stranded
 *                           when the cloud is down) and flag the fallback.
 * - provider === 'auto'   → try cloud first, fall back to local on any failure.
 *
 * Always returns flags describing what happened so the caller can craft the
 * right user-facing notice.
 */
export async function runAIWithFailover(
  opts: RunAIWithFailoverOptions,
): Promise<AIFailoverResult> {
  const cloudProviderName = opts.cloudProviderName || 'Gemini';

  // Local-only: no cloud attempt at all.
  if (opts.provider === 'local') {
    const model = (await reachableLocalGemma()) || 'gemma4:e4b';
    const text = await opts.localAttempt(model);
    return {
      text,
      answeredBy: 'local',
      fellBackToLocal: false,
      secondaryCloudUsed: false,
      billingIssue: false,
      failingKeyWasByok: false,
      cloudProviderName,
      localModelName: model,
    };
  }

  // Cloud or Auto: try the cloud first.
  try {
    const text = await opts.cloudAttempt();
    return {
      text,
      answeredBy: 'cloud',
      fellBackToLocal: false,
      secondaryCloudUsed: false,
      billingIssue: false,
      failingKeyWasByok: opts.cloudKeyIsByok,
      cloudProviderName,
    };
  } catch (cloudErr) {
    const billingIssue = isBillingOrAuthError(cloudErr);
    const secondaryCloudProviderName = opts.secondaryCloudProviderName || 'OpenRouter';

    // SECONDARY-CLOUD TIER (OpenRouter) — dormant unless a key AND prompt exist.
    // When the primary cloud fails, try OpenRouter BEFORE dropping to local
    // Gemma. If no key/env is configured this whole block is skipped and the
    // behavior is byte-for-byte the same as before.
    const openRouterKey = opts.openRouterApiKey || process.env.OPENROUTER_API_KEY || null;
    if (openRouterKey && opts.openRouterPrompt) {
      try {
        const text = await callOpenRouter(
          openRouterKey,
          opts.openRouterPrompt,
          opts.openRouterModel,
        );
        return {
          text,
          answeredBy: 'secondary-cloud',
          fellBackToLocal: false,
          secondaryCloudUsed: true,
          billingIssue,
          failingKeyWasByok: opts.cloudKeyIsByok,
          cloudProviderName,
          secondaryCloudProviderName,
        };
      } catch {
        // Secondary cloud also failed — fall through to local Gemma below.
      }
    }

    // Try to fall back to local Gemma for BOTH 'cloud' and 'auto' — a cloud
    // outage should not leave the user with no answer if a local model exists.
    const model = await reachableLocalGemma();
    if (model) {
      const text = await opts.localAttempt(model);
      return {
        text,
        answeredBy: 'local',
        fellBackToLocal: true,
        secondaryCloudUsed: false,
        billingIssue,
        failingKeyWasByok: opts.cloudKeyIsByok,
        cloudProviderName,
        localModelName: model,
      };
    }

    // No local fallback available — rethrow enriched so the route can craft a
    // billing-aware message.
    const enriched = new AIFailoverError(errorText(cloudErr), {
      billingIssue,
      failingKeyWasByok: opts.cloudKeyIsByok,
      cloudProviderName,
    });
    throw enriched;
  }
}

/** Thrown when cloud fails and there is no local fallback available. */
export class AIFailoverError extends Error {
  billingIssue: boolean;
  failingKeyWasByok: boolean;
  cloudProviderName: string;
  constructor(
    message: string,
    meta: { billingIssue: boolean; failingKeyWasByok: boolean; cloudProviderName: string },
  ) {
    super(message);
    this.name = 'AIFailoverError';
    this.billingIssue = meta.billingIssue;
    this.failingKeyWasByok = meta.failingKeyWasByok;
    this.cloudProviderName = meta.cloudProviderName;
  }
}

/**
 * Build the calm, user-facing notice string for a failover result, following
 * Howard's spec:
 *   - Gemma fallback → "Gemini is unavailable right now — answered with local
 *     Gemma instead. Quality may differ."
 *   - Billing + BYOK → name the provider and tell them to check billing.
 *   - Billing + app default key → do NOT blame the user.
 * Returns null when no notice is needed (clean cloud answer, or plain local run).
 */
export function buildFailoverNotice(r: AIFailoverResult): string | null {
  // Secondary-cloud (OpenRouter) answered because the primary cloud failed.
  if (r.secondaryCloudUsed) {
    const provider = r.cloudProviderName;
    const secondary = r.secondaryCloudProviderName || 'a backup cloud provider';
    if (r.billingIssue && r.failingKeyWasByok) {
      return `Your ${provider} API key was rejected for a billing/quota reason — please check your provider's billing settings. In the meantime I answered with ${secondary} instead.`;
    }
    return `⚠ ${provider} is unavailable right now — answered with ${secondary} instead. Quality may differ.`;
  }

  if (!r.fellBackToLocal) return null;

  const provider = r.cloudProviderName;

  if (r.billingIssue && r.failingKeyWasByok) {
    return `Your ${provider} API key was rejected for a billing/quota reason — please check your provider's billing settings. In the meantime I answered with local Gemma instead, so quality may differ.`;
  }

  // App-default key failing (or non-billing failure): don't blame the user.
  return `⚠ ${provider} is unavailable right now — answered with local Gemma instead. Quality may differ.`;
}

/**
 * Build the message shown when cloud failed AND there is no local fallback.
 */
export function buildNoFallbackMessage(err: AIFailoverError): string {
  if (err.billingIssue && err.failingKeyWasByok) {
    return `Your ${err.cloudProviderName} API key was rejected for a billing/quota reason — please check your provider's billing settings. Add local AI (Ollama) as a backup, or resolve the billing issue to continue.`;
  }
  return 'AI is temporarily unavailable — please try again shortly.';
}
