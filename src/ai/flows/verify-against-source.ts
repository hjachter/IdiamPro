'use server';

/**
 * @fileOverview Server action for the ALWAYS-ON HALLUCINATION VERIFIER.
 *
 * Runs the second, source-grounded verification pass on the ON-DEVICE model
 * (Ollama/Gemma) so it costs $0 and NEVER touches the company key or the
 * server-side usage meter. If Ollama isn't reachable (web / iOS), the core
 * verifier degrades gracefully (ran:false) and the UI just shows the review
 * reminder — we never fall back to cloud AI for the verify.
 *
 * Deliberately imports ONLY the Ollama service + the pure verifier core: no
 * Gemini, no genkit, no meter. That structural fact is what guarantees the
 * verify can never consume the cloud allowance.
 */

import {
  generateWithOllama,
  isOllamaAvailable,
  getBestAvailableModel,
} from '@/lib/ollama-service';
import {
  verifyAgainstSource,
  type VerifyInput,
  type VerifyResult,
} from '@/lib/ai/hallucination-verifier';

export async function verifyGenerationAction(
  input: VerifyInput,
): Promise<VerifyResult> {
  return verifyAgainstSource(input, {
    isAvailable: () => isOllamaAvailable(),
    // temperature 0 → deterministic, careful checking; small token budget keeps
    // the single pass fast.
    generate: (prompt) =>
      generateWithOllama({ prompt, maxTokens: 1200, temperature: 0 }),
    modelName: () => getBestAvailableModel(),
  });
}
