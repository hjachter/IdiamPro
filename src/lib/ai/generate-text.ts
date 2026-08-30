'use server';

/**
 * THE text-generation seam.
 *
 * A single entry point that all TEXT flows (generate / expand / reformat /
 * translate / summarize / transform) route through. It resolves the user's
 * selected provider (defaulting to Gemini, our default) and dispatches to the
 * matching engine:
 *
 *   • anthropic            → Anthropic Messages-API adapter (Claude), BYOK
 *   • openai/groq/mistral  → OpenAI-compatible chat adapter, BYOK
 *   • gemini + user key    → Google Gemini SDK on the user's own key (BYOK)
 *   • gemini + no key      → Google Gemini SDK on whatever requireApiKey()
 *                            yields (company env only if the fail-closed
 *                            company-text-fallback gate is on; otherwise it
 *                            throws NoCompanyKeyError and the caller routes to
 *                            on-device Ollama or the friendly "add your key"
 *                            message — identical to today's behavior).
 *
 * ── MONEY-SAFETY (release-blocker) ─────────────────────────────────────────
 * PREMIUM providers are BYOK-ONLY and UNMETERED (the user's own key/cost). The
 * COMPANY key stays GEMINI-ONLY and metered by the existing server-side meter.
 * A keyless/free/over-allowance user can NEVER reach a premium model (the pure
 * resolver falls them back to Gemini), and no company spend is ever routed to a
 * new provider — the adapters here NEVER read a company env key.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDefaultGeminiModel } from '@/config/gemini-models';
import { requireApiKey } from '@/lib/byok-keys';
import {
  resolveTextProvider,
  isOpenAICompatible,
  type TextProviderId,
  type TextProviderSelection,
} from '@/lib/ai/text-providers';
import { generateWithAnthropic } from '@/lib/ai/adapters/anthropic-adapter';
import { generateWithOpenAICompatible } from '@/lib/ai/adapters/openai-compatible-adapter';

export interface GenerateTextParams {
  /** The full prompt to send. */
  prompt: string;
  /** Optional system instruction (mapped to each provider's system channel). */
  system?: string;
  /** Sampling temperature. */
  temperature?: number;
  /** Max output tokens. */
  maxOutputTokens?: number;
  /**
   * The user's provider selection (provider + their key + their model). When
   * omitted, routing defaults to Gemini.
   */
  selection?: TextProviderSelection | null;
  /**
   * Back-compat: a plain Gemini BYOK key. Existing call sites pass just this;
   * it is treated as a Gemini selection when no richer `selection` is given.
   */
  geminiApiKey?: string | null;
  /**
   * Ask for a JSON response. On Gemini this sets responseMimeType (structured
   * JSON mode). Premium adapters ignore it and rely on the prompt's JSON
   * instruction — callers already parse tolerantly, so this is best-effort.
   */
  jsonMode?: boolean;
}

export interface GenerateTextResult {
  text: string;
  provider: TextProviderId;
  model: string;
}

/**
 * Generate text via the user-selected provider, defaulting to Gemini.
 */
export async function generateText(
  params: GenerateTextParams,
): Promise<GenerateTextResult> {
  const selection: TextProviderSelection | undefined =
    params.selection ??
    (params.geminiApiKey
      ? { provider: 'gemini', apiKey: params.geminiApiKey }
      : undefined);

  const resolved = resolveTextProvider(selection);

  // ── PREMIUM (BYOK-only) ──────────────────────────────────────────────────
  if (resolved.provider === 'anthropic') {
    const model = resolved.model as string;
    const text = await generateWithAnthropic({
      apiKey: resolved.apiKey as string,
      model,
      prompt: params.prompt,
      system: params.system,
      temperature: params.temperature,
      maxOutputTokens: params.maxOutputTokens,
    });
    return { text, provider: 'anthropic', model };
  }

  if (isOpenAICompatible(resolved.provider)) {
    const model = resolved.model as string;
    const text = await generateWithOpenAICompatible({
      provider: resolved.provider,
      apiKey: resolved.apiKey as string,
      model,
      prompt: params.prompt,
      system: params.system,
      temperature: params.temperature,
      maxOutputTokens: params.maxOutputTokens,
    });
    return { text, provider: resolved.provider, model };
  }

  // ── GEMINI (BYOK user key, or company env only via the fail-closed gate) ──
  // requireApiKey throws NoCompanyKeyError when there is no user key and the
  // company-text-fallback gate is off (production default) — preserving the
  // exact behavior the text flows have today.
  const apiKey = requireApiKey('gemini', resolved.apiKey);
  const modelId = resolved.model || getDefaultGeminiModel('sdk');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelId,
    generationConfig: {
      ...(typeof params.temperature === 'number'
        ? { temperature: params.temperature }
        : {}),
      ...(typeof params.maxOutputTokens === 'number'
        ? { maxOutputTokens: params.maxOutputTokens }
        : {}),
      ...(params.jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  });

  const combinedPrompt =
    params.system && params.system.trim().length > 0
      ? `${params.system}\n\n${params.prompt}`
      : params.prompt;

  const result = await model.generateContent(combinedPrompt);
  const text = (result.response.text() || '').trim();
  return { text, provider: 'gemini', model: modelId };
}
