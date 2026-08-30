'use server';

/**
 * OpenAI-compatible chat-completions adapter — BYOK ONLY.
 *
 * OpenAI, Groq, and Mistral all speak the same OpenAI `/chat/completions` wire
 * format; they differ ONLY by base URL and key. One adapter therefore covers
 * all three. Reached only through the text-generation seam (generate-text.ts)
 * and only when the user selected one of these providers AND supplied their own
 * key — it NEVER reads a company env key. The user's key, model, and cost.
 */

import {
  OPENAI_COMPATIBLE_BASE_URLS,
  type OpenAICompatibleProvider,
} from '@/lib/ai/text-providers';

export interface OpenAICompatibleGenerateParams {
  /** Which OpenAI-format provider to call. */
  provider: OpenAICompatibleProvider;
  /** The user's OWN key for that provider (BYOK). Required. */
  apiKey: string;
  /** The model id the user selected. */
  model: string;
  /** The full user prompt. */
  prompt: string;
  /** Optional system instruction. */
  system?: string;
  /** Sampling temperature. */
  temperature?: number;
  /** Max output tokens. */
  maxOutputTokens?: number;
}

/**
 * Generate text via an OpenAI-compatible chat-completions endpoint on the
 * user's own key. Throws on any non-OK response, embedding the HTTP status in
 * the message so the shared isBillingOrAuthError() classifier can flag
 * auth/billing/quota failures the same way it does for other providers.
 */
export async function generateWithOpenAICompatible(
  params: OpenAICompatibleGenerateParams,
): Promise<string> {
  const key = (params.apiKey || '').trim();
  if (!key) {
    throw new Error(`${params.provider} adapter called without a user API key (401).`);
  }

  const baseUrl = OPENAI_COMPATIBLE_BASE_URLS[params.provider];
  const messages: Array<{ role: string; content: string }> = [];
  if (params.system && params.system.trim().length > 0) {
    messages.push({ role: 'system', content: params.system });
  }
  messages.push({ role: 'user', content: params.prompt });

  const body: Record<string, unknown> = {
    model: params.model,
    messages,
  };
  if (typeof params.temperature === 'number') {
    body.temperature = params.temperature;
  }
  if (typeof params.maxOutputTokens === 'number') {
    body.max_tokens = params.maxOutputTokens;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`${params.provider} error (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error(`${params.provider} returned an empty response.`);
  }
  return text.trim();
}
