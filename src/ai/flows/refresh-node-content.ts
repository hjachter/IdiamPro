'use server';

/**
 * @fileOverview LIVE BOOKS — the "refresh" transform.
 *
 * Takes a single node's current content + outline context and asks the model
 * to produce an UPDATED version reflecting the latest information, returning
 * real web citations.
 *
 * Web grounding is REAL when cloud Gemini is used: we pass the
 * `googleSearchRetrieval` tool and read `groundingMetadata.groundingChunks`
 * for genuine source URLs. When the local model (Ollama) is used there is no
 * web access — the refresh runs on the model's own knowledge and returns NO
 * citations, and the caller surfaces this honestly (it never fabricates
 * sources).
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDefaultGeminiModel, getGeminiModelById, DEFAULT_GEMINI_MODEL_ID } from '@/config/gemini-models';
import { generateWithOllama, isOllamaAvailable, getBestAvailableModel } from '@/lib/ollama-service';
import { requireApiKey } from '@/lib/byok-keys';

export interface RefreshNodeInput {
  nodeName: string;
  ancestorPath: string[];
  currentContent: string;
  updateMode: 'merge' | 'overwrite';
  /** Force local Ollama (no web grounding, no citations). */
  useLocal?: boolean;
  /** Optional user-supplied Gemini key (BYOK). Falls back to GEMINI_API_KEY env var. */
  userApiKey?: string | null;
}

export interface RefreshNodeResult {
  content: string;
  citations: { url: string; title?: string }[];
  changed: boolean;
  model: string;
  modelProvider: 'cloud' | 'local';
  webGrounded: boolean;
  error?: string;
}

const NO_CHANGE_SENTINEL = '<<<NO_CHANGE>>>';

function buildPrompt(input: RefreshNodeInput): string {
  const where = input.ancestorPath.length > 0
    ? `This node sits at: ${input.ancestorPath.join(' > ')} > ${input.nodeName}`
    : `This is a top-level node named: ${input.nodeName}`;

  const modeInstruction = input.updateMode === 'overwrite'
    ? `REWRITE this section from scratch with the most current, accurate information. You may discard the old content entirely.`
    : `MERGE/AUGMENT: keep everything in the existing content that is still accurate, correct anything that is now outdated, and fold in genuinely new developments. Do NOT discard and regenerate wholesale — preserve the author's structure and still-valid prose.`;

  return `You are refreshing one section of a living document so it reflects the latest information available.

${where}

EXISTING CONTENT (HTML/markdown as authored):
"""
${input.currentContent || '(this section is currently empty)'}
"""

TASK: ${modeInstruction}

RULES:
- Stay strictly on the topic of this section. Do not add unrelated material.
- Preserve the original formatting style (headings, bold, lists) where present.
- Be specific: prefer concrete, current facts, dates, names, and figures over vague statements.
- If, after checking, the existing content is already accurate and up to date and needs NO change, reply with EXACTLY this token and nothing else: ${NO_CHANGE_SENTINEL}
- Otherwise reply with ONLY the new body content for this section — no preamble, no explanation, no "Here is".`;
}

/**
 * Cloud path — Gemini with Google Search grounding for real citations.
 */
async function refreshWithGemini(input: RefreshNodeInput): Promise<RefreshNodeResult> {
  const apiKey = requireApiKey('gemini', input.userApiKey);

  const modelEntry = getGeminiModelById(DEFAULT_GEMINI_MODEL_ID);
  const modelName = modelEntry?.name || 'Gemini';

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: getDefaultGeminiModel('sdk'),
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2048,
    },
    // Real live-web retrieval — this is what produces genuine citations.
    tools: [{ googleSearchRetrieval: {} }] as any,
  });

  const result = await model.generateContent(buildPrompt(input));
  const response = result.response;
  const text = (response.text() || '').trim();

  // Pull real source URLs from Gemini's grounding metadata.
  const citations: { url: string; title?: string }[] = [];
  const candidates: any[] = (response as any).candidates || [];
  for (const cand of candidates) {
    const chunks: any[] = cand?.groundingMetadata?.groundingChunks || [];
    for (const chunk of chunks) {
      const web = chunk?.web;
      if (web?.uri) {
        if (!citations.some(c => c.url === web.uri)) {
          citations.push({ url: web.uri, title: web.title });
        }
      }
    }
  }

  const noChange = text === NO_CHANGE_SENTINEL || text.includes(NO_CHANGE_SENTINEL);

  return {
    content: noChange ? input.currentContent : text,
    citations,
    changed: !noChange && text.length > 0,
    model: modelName,
    modelProvider: 'cloud',
    webGrounded: true,
  };
}

/**
 * Local path — Ollama. No web access, so NO citations are produced (we never
 * fabricate sources). webGrounded is false; the caller reports this honestly.
 */
async function refreshWithOllama(input: RefreshNodeInput): Promise<RefreshNodeResult> {
  const modelId = (await getBestAvailableModel()) || 'local model';
  const text = (await generateWithOllama({
    prompt: buildPrompt(input),
    system: 'You are a careful editor updating a living document to reflect current information. You have no live internet access — rely only on your training knowledge and never invent citations or fake URLs.',
    temperature: 0.4,
    maxTokens: 2000,
  })).trim();

  const noChange = text === NO_CHANGE_SENTINEL || text.includes(NO_CHANGE_SENTINEL);

  return {
    content: noChange ? input.currentContent : text,
    citations: [],
    changed: !noChange && text.length > 0,
    model: `Local (${modelId})`,
    modelProvider: 'local',
    webGrounded: false,
  };
}

export async function refreshNodeContent(input: RefreshNodeInput): Promise<RefreshNodeResult> {
  try {
    if (input.useLocal) {
      if (!(await isOllamaAvailable())) {
        return {
          content: input.currentContent,
          citations: [],
          changed: false,
          model: 'Local (unavailable)',
          modelProvider: 'local',
          webGrounded: false,
          error: 'Local AI (Ollama) is not running.',
        };
      }
      return await refreshWithOllama(input);
    }
    return await refreshWithGemini(input);
  } catch (err: any) {
    const message = err?.message || 'Refresh failed';
    // Cloud rate-limited / unavailable → fall back to local if possible
    // (mirrors the app-wide cloud→local fallback behavior).
    const isRateOrAuth = /429|quota|rate|api key|unavailable|fetch failed/i.test(message);
    if (!input.useLocal && isRateOrAuth && (await isOllamaAvailable())) {
      try {
        return await refreshWithOllama(input);
      } catch {
        /* fall through to error result */
      }
    }
    return {
      content: input.currentContent,
      citations: [],
      changed: false,
      model: input.useLocal ? 'Local' : 'Gemini',
      modelProvider: input.useLocal ? 'local' : 'cloud',
      webGrounded: false,
      error: message,
    };
  }
}
