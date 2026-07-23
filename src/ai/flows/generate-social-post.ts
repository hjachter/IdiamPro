'use server';

/**
 * @fileOverview Generate ready-to-post SOCIAL MEDIA content from an outline
 * branch. The first social output format is X (a thread or a single post); the
 * flow is platform-agnostic, driven by a "social format template" (see
 * src/lib/social-templates.ts) so more platforms are added as data, not code.
 *
 * The user selects a branch (a node + all its descendants — the same "chapter"
 * scope Generate Video / Export Email use) and this flow turns that branch into
 * a set of posts:
 *   - thread mode  → a hook post first, then follow-on posts, each within the
 *                    platform char limit, with natural hashtags.
 *   - single mode  → one condensed post within the char limit.
 *
 * Sibling of generate-email: same Gemini-with-Ollama fallback, same BYOK key
 * contract, same "counts as 1 AI generation" model. A safety splitter
 * (enforceCharLimit) guarantees every returned post is within the limit no
 * matter what the model produces.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDefaultGeminiModel, getGeminiModelById, DEFAULT_GEMINI_MODEL_ID } from '@/config/gemini-models';
import { generateWithOllama, isOllamaAvailable, getBestAvailableModel } from '@/lib/ollama-service';
import { requireApiKey } from '@/lib/byok-keys';
import type { SerializedNode } from '@/ai/flows/transform-outline';
import { enforceCharLimit, type SocialPostMode } from '@/lib/social-templates';

export interface GenerateSocialPostInput {
  /** Serialized branch (selected node + descendants) handed to the AI. */
  subtreeNodes: Record<string, SerializedNode>;
  /** Root of the branch being turned into social content. */
  rootNodeId: string;
  /** Optional outline name for context. */
  currentOutlineName?: string;
  /** Platform id (e.g. 'x'). For prompt framing + result labeling. */
  platformId: string;
  /** Human platform label (e.g. 'X'). */
  platformLabel: string;
  /** 'thread' (multi-post) or 'single' (one condensed post). */
  mode: SocialPostMode;
  /** Per-post character limit for this platform. */
  charLimit: number;
  /** Platform-specific formatting rules (from the template). */
  promptRules: string;
  /** Optional extra instruction from the user. */
  guidance?: string;
  /** "Your Voice" — the user's OWN distilled writing-style profile. When set,
   *  posts are drafted to match the author's personal voice. Never a third-party
   *  impersonation; this is the user's own style, from their own samples. */
  voiceProfile?: string;
  /** Force local Ollama. */
  useLocal?: boolean;
  /** Optional BYOK Gemini key. */
  userApiKey?: string | null;
}

export interface GenerateSocialPostResult {
  /** The posts, in order. In thread mode the first is the hook. Each is within
   *  the platform char limit (guaranteed by the safety splitter). */
  posts: string[];
  model: string;
  modelProvider: 'cloud' | 'local';
  error?: string;
}

function stripHtmlToText(html: string): string {
  return (html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Compact readable outline text for the prompt (name + stripped content, indented). */
function renderBranchForPrompt(input: GenerateSocialPostInput): string {
  const { subtreeNodes, rootNodeId } = input;
  const lines: string[] = [];
  const walk = (id: string, depth: number) => {
    const n = subtreeNodes[id];
    if (!n) return;
    const indent = '  '.repeat(depth);
    if (n.name) lines.push(`${indent}- ${n.name}`);
    const body = stripHtmlToText(n.content);
    if (body) {
      for (const ln of body.split('\n')) {
        if (ln.trim()) lines.push(`${indent}  ${ln.trim()}`);
      }
    }
    for (const childId of n.childrenIds || []) walk(childId, depth + 1);
  };
  walk(rootNodeId, 0);
  return lines.join('\n');
}

function buildPrompt(input: GenerateSocialPostInput): string {
  const voice = input.voiceProfile?.trim();
  const voiceBlock = voice
    ? `\nWRITE IN THE AUTHOR'S OWN VOICE. Match this description of the author's personal writing style as closely as you can — its tone, formality, sentence rhythm, vocabulary, punctuation, and any emoji/hashtag quirks — while still producing effective ${input.platformLabel} posts. This is the author's OWN voice, from their own writing; do not imitate anyone else:\n"""\n${voice}\n"""\n`
    : '';

  const modeBlock =
    input.mode === 'single'
      ? `MODE: SINGLE POST. Produce exactly ONE post that condenses the whole branch into a single, compelling ${input.platformLabel} post within the character limit. Return it as a one-element array.`
      : `MODE: THREAD. Produce a THREAD of multiple posts. The first post is the HOOK. Following posts develop the branch's points in order, one idea per post. Aim for as many posts as the material needs (typically 3-8), each a self-contained thought.`;

  return `You are an expert social-media writer. Turn a person's outline branch into ready-to-post content for ${input.platformLabel}.

You will receive a JSON-free readable outline (a node and all its descendants). Treat it as the raw material — the points the author wants to share.

PLATFORM RULES:
${input.promptRules}

${modeBlock}
${voiceBlock}${input.guidance ? `\nEXTRA INSTRUCTION FROM THE AUTHOR: "${input.guidance.trim()}"\n` : ''}
OUTPUT FORMAT — REPLY WITH JSON ONLY. NO MARKDOWN. NO PROSE BEFORE OR AFTER. NO CODE FENCES.

The JSON must be exactly:
{
  "posts": ["<post 1 text>", "<post 2 text>", ...]
}

RULES:
- Each string in "posts" is ONE post, plain text, within the character limit.
- Do NOT number the posts yourself (no "1/", no "(2)").
- Do NOT wrap the JSON in code fences. OUTPUT JSON ONLY.

OUTLINE NAME: ${input.currentOutlineName || '(untitled)'}

OUTLINE BRANCH TO TURN INTO ${input.platformLabel.toUpperCase()} CONTENT:
"""
${renderBranchForPrompt(input) || '(empty)'}
"""

Reply with ONLY the JSON object described above.`;
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json|JSON)?\n?([\s\S]*?)\n?```$/);
  if (fenceMatch) return fenceMatch[1].trim();
  return trimmed;
}

function parseAIResponse(rawText: string): { posts: string[] } | { parseError: string } {
  const cleaned = stripCodeFences(rawText);
  if (!cleaned) return { parseError: 'The AI returned an empty reply.' };
  try {
    let jsonText = cleaned;
    if (!jsonText.startsWith('{')) {
      const m = jsonText.match(/\{[\s\S]*\}/);
      if (m) jsonText = m[0];
    }
    const data = JSON.parse(jsonText);
    if (!data || typeof data !== 'object' || !Array.isArray(data.posts)) {
      return { parseError: 'The AI reply did not contain a list of posts.' };
    }
    const posts = data.posts
      .map((p: unknown) => (typeof p === 'string' ? p.trim() : ''))
      .filter((p: string) => p.length > 0);
    if (posts.length === 0) return { parseError: 'The AI reply contained no usable posts.' };
    return { posts };
  } catch {
    return { parseError: "I couldn't make sense of the AI's reply — it wasn't valid JSON. Try again." };
  }
}

function emptyResult(modelName: string, provider: 'cloud' | 'local', error?: string): GenerateSocialPostResult {
  return { posts: [], model: modelName, modelProvider: provider, error };
}

function finalize(
  rawText: string,
  input: GenerateSocialPostInput,
  modelName: string,
  provider: 'cloud' | 'local',
): GenerateSocialPostResult {
  const parsed = parseAIResponse(rawText);
  if ('parseError' in parsed) return emptyResult(modelName, provider, parsed.parseError);
  // Safety net: guarantee every post respects the platform char limit.
  const posts = enforceCharLimit(parsed.posts, input.charLimit, input.mode);
  if (posts.length === 0) return emptyResult(modelName, provider, 'The AI reply contained no usable posts.');
  return { posts, model: modelName, modelProvider: provider };
}

async function generateWithGemini(input: GenerateSocialPostInput): Promise<GenerateSocialPostResult> {
  const apiKey = requireApiKey('gemini', input.userApiKey);
  const modelEntry = getGeminiModelById(DEFAULT_GEMINI_MODEL_ID);
  const modelName = modelEntry?.name || 'Gemini';
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: getDefaultGeminiModel('sdk'),
    generationConfig: { temperature: 0.7, maxOutputTokens: 4096, responseMimeType: 'application/json' },
  });
  const result = await model.generateContent(buildPrompt(input));
  const text = (result.response.text() || '').trim();
  return finalize(text, input, modelName, 'cloud');
}

async function generateWithLocal(input: GenerateSocialPostInput): Promise<GenerateSocialPostResult> {
  const available = await isOllamaAvailable();
  if (!available) {
    return emptyResult('Local', 'local', 'Local AI (Ollama) is not running. Start Ollama or switch off local mode.');
  }
  const modelId = (await getBestAvailableModel()) || 'local model';
  const text = (await generateWithOllama({ prompt: buildPrompt(input), maxTokens: 4096, temperature: 0.7 })).trim();
  return finalize(text, input, modelId, 'local');
}

export async function generateSocialPost(input: GenerateSocialPostInput): Promise<GenerateSocialPostResult> {
  if (input.useLocal) return generateWithLocal(input);
  try {
    return await generateWithGemini(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const local = await generateWithLocal({ ...input, useLocal: true });
    if (local.error) {
      return {
        ...local,
        error: `Cloud draft didn't work (${message}); local AI is also unavailable: ${local.error}`,
      };
    }
    return local;
  }
}
