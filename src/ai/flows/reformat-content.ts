'use server';

/**
 * @fileOverview Reformat ONE piece of content (HTML) per the user's
 * plain-language instruction.
 *
 * Mirrors the translate-node-content flow shape (no web grounding, no
 * citations). Single-purpose: take an HTML fragment + an instruction
 * ("turn into a bulleted list", "convert to a markdown table",
 * "tighten spacing"), produce reformatted HTML the Tiptap editor can
 * load directly.
 *
 * Output is constrained to a Tiptap-safe HTML subset. The dialog further
 * sanitises before applying.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDefaultGeminiModel, getGeminiModelById, DEFAULT_GEMINI_MODEL_ID } from '@/config/gemini-models';
import { generateWithOllama, isOllamaAvailable, getBestAvailableModel } from '@/lib/ollama-service';
import { requireApiKey } from '@/lib/byok-keys';

export interface ReformatContentInput {
  /** HTML fragment to reformat (Tiptap content). */
  contentHtml: string;
  /** Plain-language description of the desired format. */
  instruction: string;
  /** Force local Ollama. */
  useLocal?: boolean;
  /** Optional BYOK Gemini key from the client. */
  userApiKey?: string | null;
}

export interface ReformatContentResult {
  /** Reformatted HTML (or original if model returned no change). */
  content: string;
  changed: boolean;
  model: string;
  modelProvider: 'cloud' | 'local';
  error?: string;
}

const NO_CHANGE_SENTINEL = '<<<NO_CHANGE>>>';

function buildPrompt(input: ReformatContentInput): string {
  return `You are reformatting one piece of content for an outlining app's rich-text editor.

USER INSTRUCTION:
"""
${input.instruction.trim() || '(no instruction provided)'}
"""

EXISTING CONTENT (HTML — what the user currently sees in this node):
"""
${input.contentHtml || '(this section is currently empty)'}
"""

TASK: Produce a reformatted version of the existing content that follows the user's instruction.

OUTPUT RULES:
- Reply with ONLY the reformatted HTML body. No preamble. No "Here is the result". No code fences. No backticks around the whole thing.
- The HTML must use ONLY these tags: p, h1, h2, h3, h4, h5, h6, ul, ol, li, strong, em, code, pre, a, br, blockquote, hr. No scripts, no inline styles, no external resources, no images, no iframes.
- Preserve the user's actual words and meaning. Reformatting changes structure and presentation, NOT the substance — do not invent new facts, do not delete factual content unless the instruction explicitly asks to summarise.
- If the user asks for a "markdown table", produce a real HTML table using <p> rows with " | " separators, OR a clean <pre> block — whichever fits the request. (Tiptap doesn't render <table> tags, so prefer <pre> for tabular layouts.)
- If the instruction is ambiguous, pick the simplest interpretation that improves readability.
- If the content is already in the requested format and needs NO change, reply with EXACTLY this token and nothing else: ${NO_CHANGE_SENTINEL}
- If the instruction asks for something destructive or impossible, do your best with the spirit of the request and still return valid HTML.`;
}

async function reformatWithGemini(input: ReformatContentInput): Promise<ReformatContentResult> {
  const apiKey = requireApiKey('gemini', input.userApiKey);

  const modelEntry = getGeminiModelById(DEFAULT_GEMINI_MODEL_ID);
  const modelName = modelEntry?.name || 'Gemini';

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: getDefaultGeminiModel('sdk'),
    generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
  });

  const result = await model.generateContent(buildPrompt(input));
  const text = (result.response.text() || '').trim();

  if (text === NO_CHANGE_SENTINEL || text === '') {
    return {
      content: input.contentHtml,
      changed: false,
      model: modelName,
      modelProvider: 'cloud',
    };
  }
  return {
    content: stripCodeFences(text),
    changed: true,
    model: modelName,
    modelProvider: 'cloud',
  };
}

async function reformatWithLocal(input: ReformatContentInput): Promise<ReformatContentResult> {
  const available = await isOllamaAvailable();
  if (!available) {
    return {
      content: input.contentHtml,
      changed: false,
      model: 'Local',
      modelProvider: 'local',
      error: 'Local AI (Ollama) is not running. Start Ollama or switch off local mode.',
    };
  }
  const modelId = (await getBestAvailableModel()) || 'local model';
  const text = (await generateWithOllama({ prompt: buildPrompt(input), maxTokens: 2048, temperature: 0.4 })).trim();

  if (text === NO_CHANGE_SENTINEL || text === '') {
    return {
      content: input.contentHtml,
      changed: false,
      model: modelId,
      modelProvider: 'local',
    };
  }
  return {
    content: stripCodeFences(text),
    changed: true,
    model: modelId,
    modelProvider: 'local',
  };
}

/**
 * Some models love wrapping their reply in ```html ... ``` even when told
 * not to. Strip a single outer code fence if present.
 */
function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:html|HTML)?\n?([\s\S]*?)\n?```$/);
  if (fenceMatch) return fenceMatch[1].trim();
  return trimmed;
}

export async function reformatContent(input: ReformatContentInput): Promise<ReformatContentResult> {
  if (input.useLocal) return reformatWithLocal(input);
  try {
    return await reformatWithGemini(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const local = await reformatWithLocal({ ...input, useLocal: true });
    return {
      ...local,
      error: local.error ? `Cloud failed (${message}); local also unavailable: ${local.error}` : undefined,
    };
  }
}
