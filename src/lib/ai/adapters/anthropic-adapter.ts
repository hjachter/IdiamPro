'use server';

/**
 * Anthropic Messages-API adapter (Claude) — BYOK ONLY.
 *
 * A single, non-streaming text generation against the Anthropic Messages API
 * (`POST /v1/messages`) using the USER'S OWN key. This adapter is reached only
 * through the text-generation seam (generate-text.ts) and only when the user
 * has selected Anthropic AND supplied their own key — it NEVER reads a company
 * env key. The user's key, the user's model, the user's cost.
 *
 * Raw HTTPS is used deliberately (rather than the Anthropic SDK): the adapter
 * sits alongside the OpenAI-compatible adapter as one of several BYOK providers
 * reached by a plain authenticated request, keeps the app dependency-free, and
 * only ever forwards a user-supplied key. The wire shape follows the current
 * Messages API (anthropic-version 2023-06-01).
 */

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export interface AnthropicGenerateParams {
  /** The user's OWN Anthropic API key (BYOK). Required. */
  apiKey: string;
  /** The Claude model id the user selected (e.g. claude-opus-4-8). */
  model: string;
  /** The full user prompt. */
  prompt: string;
  /** Optional system instruction. */
  system?: string;
  /** Sampling temperature (0..1). */
  temperature?: number;
  /** Max output tokens for the response. */
  maxOutputTokens?: number;
}

/**
 * Generate text with Claude on the user's own key. Throws on any non-OK
 * response, embedding the HTTP status in the message so the shared
 * isBillingOrAuthError() classifier can flag auth/billing/quota failures the
 * same way it does for other providers.
 */
export async function generateWithAnthropic(
  params: AnthropicGenerateParams,
): Promise<string> {
  const key = (params.apiKey || '').trim();
  if (!key) {
    // Defensive: the seam only calls this with a user key present.
    throw new Error('Anthropic adapter called without a user API key (401).');
  }

  const body: Record<string, unknown> = {
    model: params.model,
    max_tokens: Math.max(1, Math.min(params.maxOutputTokens ?? 4096, 8192)),
    messages: [{ role: 'user', content: params.prompt }],
  };
  if (params.system && params.system.trim().length > 0) {
    body.system = params.system;
  }
  if (typeof params.temperature === 'number') {
    body.temperature = params.temperature;
  }

  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Anthropic error (${response.status}): ${errBody}`);
  }

  const data = await response.json();

  // A safety classifier can decline a request with HTTP 200 + stop_reason
  // "refusal" — surface it as a clear error rather than returning empty text.
  if (data?.stop_reason === 'refusal') {
    throw new Error('Anthropic declined this request (refusal).');
  }

  // content is an array of blocks; concatenate the text blocks.
  const blocks: Array<{ type?: string; text?: string }> = Array.isArray(data?.content)
    ? data.content
    : [];
  const text = blocks
    .filter((b) => b?.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('')
    .trim();

  if (!text) {
    throw new Error('Anthropic returned an empty response.');
  }
  return text;
}
