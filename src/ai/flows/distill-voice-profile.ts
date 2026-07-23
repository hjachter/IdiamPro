'use server';

/**
 * @fileOverview Distill a reusable VOICE PROFILE from the user's OWN writing.
 *
 * "Your Voice" (2026-07-22): the user provides SAMPLES of their own writing
 * (pasted posts/emails/notes and/or a sample pulled from their own Second
 * Brain). This flow reads those samples and produces a concise, reusable
 * description of the user's PERSONAL writing style — tone, formality, sentence
 * length/rhythm, vocabulary, emoji/hashtag habits, and quirks. That profile is
 * later injected into the AI output wizards so generated text sounds like the
 * user rather than like generic AI.
 *
 * ETHICS: this describes the USER'S OWN voice from the USER'S OWN samples. It is
 * NOT an impersonation tool — there is no path here to mimic a third party. The
 * profile is a neutral style description the user reviews and edits.
 *
 * Sibling of generate-email / transform-outline: same Gemini-with-Ollama
 * fallback, same BYOK key contract, same "counts as 1 AI generation" model
 * (gated on the client via useAIUsageGate).
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDefaultGeminiModel, getGeminiModelById, DEFAULT_GEMINI_MODEL_ID } from '@/config/gemini-models';
import { generateWithOllama, isOllamaAvailable, getBestAvailableModel } from '@/lib/ollama-service';
import { requireApiKey } from '@/lib/byok-keys';

export interface DistillVoiceProfileInput {
  /** The raw writing samples the user supplied (pasted text and/or Second
   *  Brain excerpts, already concatenated by the client). */
  samples: string;
  /** An existing profile to REFINE rather than replace, when the user is
   *  updating their profile after adding more samples. Optional. */
  existingProfile?: string;
  /** Force local Ollama. */
  useLocal?: boolean;
  /** Optional BYOK Gemini key. */
  userApiKey?: string | null;
}

export interface DistillVoiceProfileResult {
  /** The distilled, editable voice-profile description (plain text). */
  profile: string;
  model: string;
  modelProvider: 'cloud' | 'local';
  error?: string;
}

/** Upper bound on how much sample text we send — keeps cost/latency sane while
 *  still capturing a representative slice of the user's style. */
const MAX_SAMPLE_CHARS = 12000;

const SYSTEM_INSTRUCTIONS = `You are a writing-style analyst. You will be given SAMPLES of ONE person's own writing. Your job is to distill a concise, reusable description of THAT person's personal writing voice, so an assistant can later write new text that sounds like them.

Describe only the STYLE, never the topics. Cover, in a few short labelled lines:
- Tone & attitude (e.g. warm, wry, blunt, upbeat, understated).
- Formality (casual / conversational / professional / formal) and how it shifts.
- Sentence rhythm (short & punchy vs. long & flowing; fragments; parentheticals).
- Vocabulary & diction (plain vs. fancy; slang; jargon; favourite words or phrases).
- Punctuation & formatting habits (dashes, ellipses, ALL CAPS for emphasis, lists).
- Emoji & hashtag habits (none / sparing / frequent; which kinds).
- Any distinctive quirks or signature moves.

RULES:
- This is the person's OWN voice from their OWN samples. Do NOT name or reference any other person or public figure. Do NOT impersonate anyone else.
- Be specific and observational, grounded in the samples — not generic filler.
- Keep it tight: a compact profile of roughly 120-250 words, usable as a style guide.
- Output PLAIN TEXT only. No markdown headers, no preamble, no code fences. Just the profile.`;

function buildPrompt(input: DistillVoiceProfileInput): string {
  const samples = (input.samples || '').slice(0, MAX_SAMPLE_CHARS);
  const refine = input.existingProfile?.trim()
    ? `\nThe person already has this voice profile. REFINE and improve it using the new samples below, keeping what still fits and updating what the new samples reveal:\n"""\n${input.existingProfile.trim()}\n"""\n`
    : '';
  return `${SYSTEM_INSTRUCTIONS}
${refine}
WRITING SAMPLES (the person's OWN writing):
"""
${samples || '(no samples provided)'}
"""

Reply with ONLY the plain-text voice profile described above. No preamble, no headers beyond the short line labels, no code fences.`;
}

/** Strip any accidental code fences / markdown the model may add. */
function cleanProfile(text: string): string {
  let t = (text || '').trim();
  const fence = t.match(/^```(?:\w+)?\n?([\s\S]*?)\n?```$/);
  if (fence) t = fence[1].trim();
  return t;
}

function emptyResult(
  modelName: string,
  provider: 'cloud' | 'local',
  error?: string,
): DistillVoiceProfileResult {
  return { profile: '', model: modelName, modelProvider: provider, error };
}

async function distillWithGemini(input: DistillVoiceProfileInput): Promise<DistillVoiceProfileResult> {
  const apiKey = requireApiKey('gemini', input.userApiKey);
  const modelEntry = getGeminiModelById(DEFAULT_GEMINI_MODEL_ID);
  const modelName = modelEntry?.name || 'Gemini';
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: getDefaultGeminiModel('sdk'),
    generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
  });
  const result = await model.generateContent(buildPrompt(input));
  const profile = cleanProfile(result.response.text() || '');
  if (!profile) return emptyResult(modelName, 'cloud', 'The AI returned an empty profile.');
  return { profile, model: modelName, modelProvider: 'cloud' };
}

async function distillWithLocal(input: DistillVoiceProfileInput): Promise<DistillVoiceProfileResult> {
  const available = await isOllamaAvailable();
  if (!available) {
    return emptyResult('Local', 'local', 'Local AI (Ollama) is not running. Start Ollama or switch off local mode.');
  }
  const modelId = (await getBestAvailableModel()) || 'local model';
  const profile = cleanProfile(await generateWithOllama({ prompt: buildPrompt(input), maxTokens: 1024, temperature: 0.4 }));
  if (!profile) return emptyResult(modelId, 'local', 'The local AI returned an empty profile.');
  return { profile, model: modelId, modelProvider: 'local' };
}

export async function distillVoiceProfile(input: DistillVoiceProfileInput): Promise<DistillVoiceProfileResult> {
  if (input.useLocal) return distillWithLocal(input);
  try {
    return await distillWithGemini(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const local = await distillWithLocal({ ...input, useLocal: true });
    if (local.error) {
      return {
        ...local,
        error: `Cloud profile didn't work (${message}); local AI is also unavailable: ${local.error}`,
      };
    }
    return local;
  }
}
