'use server';

/**
 * @fileOverview Translate ONE node's content into a target language.
 *
 * Implements the same input/output shape pattern as refresh-node-content
 * so the transform engine can drive it without engine changes. Unlike refresh,
 * translation does NOT use web grounding and produces no citations — it is
 * a pure language-to-language transform of the existing content.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDefaultGeminiModel, getGeminiModelById, DEFAULT_GEMINI_MODEL_ID } from '@/config/gemini-models';
import { generateWithOllama, isOllamaAvailable, getBestAvailableModel } from '@/lib/ollama-service';
import { requireApiKey } from '@/lib/byok-keys';

export interface TranslateNodeInput {
  nodeName: string;
  ancestorPath: string[];
  currentContent: string;
  /** ISO/common name of target language, e.g. "Spanish", "ja", "Mandarin Chinese". */
  targetLanguage: string;
  /** Force local Ollama. */
  useLocal?: boolean;
  /** Optional BYOK key. */
  userApiKey?: string | null;
}

export interface TranslateNodeResult {
  content: string;
  citations: { url: string; title?: string }[];
  changed: boolean;
  model: string;
  modelProvider: 'cloud' | 'local';
  webGrounded: boolean;
  error?: string;
}

const NO_CHANGE_SENTINEL = '<<<NO_CHANGE>>>';

function buildPrompt(input: TranslateNodeInput): string {
  const where = input.ancestorPath.length > 0
    ? `This node sits at: ${input.ancestorPath.join(' > ')} > ${input.nodeName}`
    : `This is a top-level node named: ${input.nodeName}`;

  return `You are translating one section of a structured document into ${input.targetLanguage}.

${where}

EXISTING CONTENT (HTML/markdown as authored, currently in its source language):
"""
${input.currentContent || '(this section is currently empty)'}
"""

TASK: Produce a faithful, natural translation of the existing content into ${input.targetLanguage}.

RULES:
- Preserve the original formatting EXACTLY — keep all HTML tags, markdown headings, lists, bold/italic, code blocks, and link URLs intact. Only the human-readable text inside changes.
- Translate proper nouns conventionally (e.g. company names typically stay in their original form; place names use the standard ${input.targetLanguage} form if one is well established).
- Preserve numbers, dates, and units (you may localize date formats if the convention in ${input.targetLanguage} is clearly different — e.g. day/month/year vs month/day/year — but never invent new dates).
- If the content is already in ${input.targetLanguage} and needs NO change, reply with EXACTLY this token and nothing else: ${NO_CHANGE_SENTINEL}
- Otherwise reply with ONLY the translated body content for this section — no preamble, no explanation, no "Here is the translation".`;
}

async function translateWithGemini(input: TranslateNodeInput): Promise<TranslateNodeResult> {
  const apiKey = requireApiKey('gemini', input.userApiKey);

  const modelEntry = getGeminiModelById(DEFAULT_GEMINI_MODEL_ID);
  const modelName = modelEntry?.name || 'Gemini';

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: getDefaultGeminiModel('sdk'),
    generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
  });

  const result = await model.generateContent(buildPrompt(input));
  const text = (result.response.text() || '').trim();

  if (text === NO_CHANGE_SENTINEL || text === '') {
    return {
      content: input.currentContent,
      citations: [],
      changed: false,
      model: modelName,
      modelProvider: 'cloud',
      webGrounded: false,
    };
  }
  return {
    content: text,
    citations: [],
    changed: true,
    model: modelName,
    modelProvider: 'cloud',
    webGrounded: false,
  };
}

async function translateWithLocal(input: TranslateNodeInput): Promise<TranslateNodeResult> {
  const available = await isOllamaAvailable();
  if (!available) {
    return {
      content: input.currentContent,
      citations: [],
      changed: false,
      model: 'Local',
      modelProvider: 'local',
      webGrounded: false,
      error: 'Local AI (Ollama) is not running. Start Ollama or switch off local mode.',
    };
  }
  const modelId = (await getBestAvailableModel()) || 'local model';
  const text = (await generateWithOllama({ prompt: buildPrompt(input), maxTokens: 2048, temperature: 0.3 })).trim();

  if (text === NO_CHANGE_SENTINEL || text === '') {
    return {
      content: input.currentContent,
      citations: [],
      changed: false,
      model: modelId,
      modelProvider: 'local',
      webGrounded: false,
    };
  }
  return {
    content: text,
    citations: [],
    changed: true,
    model: modelId,
    modelProvider: 'local',
    webGrounded: false,
  };
}

export async function translateNodeContent(input: TranslateNodeInput): Promise<TranslateNodeResult> {
  if (input.useLocal) return translateWithLocal(input);
  try {
    return await translateWithGemini(input);
  } catch (err) {
    // Cloud failed → fall back to local automatically (mirrors refresh behavior).
    const message = err instanceof Error ? err.message : String(err);
    const local = await translateWithLocal({ ...input, useLocal: true });
    return {
      ...local,
      error: local.error ? `Cloud failed (${message}); local also unavailable: ${local.error}` : undefined,
    };
  }
}
