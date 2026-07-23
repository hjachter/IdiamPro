'use server';

/**
 * @fileOverview Generate a YouTube PUBLISH PACKAGE from an outline branch — the
 * final member of the Share to Social lineup.
 *
 * YouTube is the natural fit because the app already GENERATES video (Generate
 * Video turns a branch into a narrated slideshow MP4) and already IMPORTS from
 * YouTube. This flow writes the words that make an outline video ready to post:
 *
 *   STANDARD variant → an SEO-friendly set of TITLE options, a DESCRIPTION with
 *   chapter timestamps derived from the branch's structure, a TAGS list, and a
 *   THUMBNAIL text/idea suggestion.
 *
 *   SHORTS variant → a punchy Shorts TITLE (options) plus a tighter vertical
 *   SCRIPT (kept in the same `description` field) suited to a <60s vertical clip,
 *   with a small tags set and a bold thumbnail idea. (Metadata/script only — the
 *   app does not render vertical video yet; this ties to future short-form work.)
 *
 * Sibling of generate-social-post / generate-instagram-post: same
 * Gemini-with-Ollama fallback, same BYOK key contract, same "counts as 1 AI
 * generation" model, optional "In my voice" for the title/description tone.
 *
 * NO posting and NO OAuth: YouTube upload needs a signed-in account and can't be
 * pre-filled from outside, so the UI hand-off is copy / download / open the real
 * upload page — never a fake auto-upload.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDefaultGeminiModel, getGeminiModelById, DEFAULT_GEMINI_MODEL_ID } from '@/config/gemini-models';
import { generateWithOllama, isOllamaAvailable, getBestAvailableModel } from '@/lib/ollama-service';
import { requireApiKey } from '@/lib/byok-keys';
import type { SerializedNode } from '@/ai/flows/transform-outline';

/** Which package to write. */
export type YoutubeVariant = 'standard' | 'shorts';

export interface GenerateYoutubePackageInput {
  /** Serialized branch (selected node + descendants) handed to the AI. */
  subtreeNodes: Record<string, SerializedNode>;
  /** Root of the branch being turned into a YouTube package. */
  rootNodeId: string;
  /** Optional outline name for context. */
  currentOutlineName?: string;
  /** 'standard' (long-form publish package) or 'shorts' (vertical <60s idea). */
  variant: YoutubeVariant;
  /** Optional extra instruction from the user. */
  guidance?: string;
  /** "Your Voice" — the user's OWN distilled writing-style profile. When set,
   *  the title + description tone match the author's personal voice. Never a
   *  third-party impersonation; this is the user's own style, from their samples. */
  voiceProfile?: string;
  /** Force local Ollama. */
  useLocal?: boolean;
  /** Optional BYOK Gemini key. */
  userApiKey?: string | null;
}

export interface YoutubeSharePackage {
  /** 2-3 title options. SEO-friendly (standard) or punchy hooks (shorts). */
  titleOptions: string[];
  /** STANDARD: the full description with a "Chapters" timestamp section woven in.
   *  SHORTS: a tight vertical script (hook + a few punchy lines + CTA). */
  description: string;
  /** Tag list (no leading #). */
  tags: string[];
  /** Thumbnail text/idea suggestion (composition + overlay text). */
  thumbnailIdea: string;
}

export interface GenerateYoutubePackageResult {
  package: YoutubeSharePackage | null;
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
function renderBranchForPrompt(input: GenerateYoutubePackageInput): string {
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

/** The top-level sub-point titles of the branch — the natural chapter markers. */
function topLevelSectionTitles(input: GenerateYoutubePackageInput): string[] {
  const root = input.subtreeNodes[input.rootNodeId];
  if (!root) return [];
  return (root.childrenIds || [])
    .map((id) => input.subtreeNodes[id]?.name?.trim())
    .filter((s): s is string => !!s);
}

function buildPrompt(input: GenerateYoutubePackageInput): string {
  const voice = input.voiceProfile?.trim();
  const voiceBlock = voice
    ? `\nWRITE THE TITLE AND DESCRIPTION IN THE AUTHOR'S OWN VOICE. Match this description of the author's personal writing style — tone, formality, sentence rhythm, vocabulary, punctuation — while still being effective on YouTube. This is the author's OWN voice, from their own writing; do not imitate anyone else:\n"""\n${voice}\n"""\n`
    : '';

  const sections = topLevelSectionTitles(input);
  const sectionsHint = sections.length
    ? `The branch's top-level sub-points, in order, are the natural chapters:\n${sections.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n`
    : '';

  const shortsBlock = `MODE: YOUTUBE SHORTS (vertical, under 60 seconds).
- "titleOptions": 2-3 SHORT, punchy, curiosity-driven titles (aim under 60 characters each) that would stop a scroll on a vertical feed.
- "description": a TIGHT vertical SCRIPT for a clip under 60 seconds — an instant hook in the first line, then 3-5 short punchy spoken lines that deliver ONE clear idea fast, and a quick call to action at the end. Plain spoken lines, one per line. This is a script, not a paragraph.
- "tags": 8-12 relevant tags, lowercase, no leading #, include a couple like "shorts" where natural.
- "thumbnailIdea": a bold, high-contrast vertical cover idea — big overlay text (a few words) plus the composition.`;

  const standardBlock = `MODE: STANDARD YOUTUBE PUBLISH PACKAGE.
- "titleOptions": 2-3 SEO-friendly, click-worthy but honest title options (roughly under 70 characters each).
- "description": a complete YouTube description of about 150-250 words: a strong hook opening, a short value summary, then a "Chapters:" section with timestamp markers (one per line, format "M:SS Title" starting at "0:00"). ${sections.length ? 'Derive the chapters from the branch sub-points listed below, spacing the timestamps evenly and plausibly across a typical few-minute video.' : 'Derive a handful of sensible chapters from the material, spacing timestamps evenly starting at 0:00.'} Weave relevant keywords in naturally. End with a friendly line inviting likes/subscribes.
- "tags": 12-18 relevant YouTube tags, lowercase, no leading #.
- "thumbnailIdea": a thumbnail concept in a sentence or two — the subject/composition plus the big overlay text (a few punchy words).`;

  return `You are an expert YouTube strategist and copywriter. Turn a person's outline branch into a ready-to-publish YouTube package. The person will generate the actual video separately (the app has a Generate Video feature); your job is the WORDS that make it ready to post.

You will receive a readable outline (a node and all its descendants). Treat it as the raw material — the content the video will cover.

${input.variant === 'shorts' ? shortsBlock : standardBlock}
${sectionsHint}${voiceBlock}${input.guidance ? `\nEXTRA INSTRUCTION FROM THE AUTHOR: "${input.guidance.trim()}"\n` : ''}
OUTPUT FORMAT — REPLY WITH JSON ONLY. NO MARKDOWN. NO PROSE BEFORE OR AFTER. NO CODE FENCES.

The JSON must be exactly:
{
  "titleOptions": ["<title 1>", "<title 2>"],
  "description": "<the description or script, with real newlines>",
  "tags": ["tag1", "tag2", "..."],
  "thumbnailIdea": "<thumbnail text/idea>"
}

RULES:
- Do NOT wrap the JSON in code fences. OUTPUT JSON ONLY.
- Tags are plain words/phrases with NO leading "#".
- Use real newline characters inside "description".

OUTLINE NAME: ${input.currentOutlineName || '(untitled)'}

OUTLINE BRANCH TO TURN INTO A YOUTUBE ${input.variant === 'shorts' ? 'SHORTS' : 'PUBLISH'} PACKAGE:
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

function parseAIResponse(rawText: string): YoutubeSharePackage | { parseError: string } {
  const cleaned = stripCodeFences(rawText);
  if (!cleaned) return { parseError: 'The AI returned an empty reply.' };
  try {
    let jsonText = cleaned;
    if (!jsonText.startsWith('{')) {
      const m = jsonText.match(/\{[\s\S]*\}/);
      if (m) jsonText = m[0];
    }
    const data = JSON.parse(jsonText);
    if (!data || typeof data !== 'object') {
      return { parseError: 'The AI reply was not a JSON object.' };
    }
    const titleOptions = Array.isArray(data.titleOptions)
      ? data.titleOptions.map((t: unknown) => (typeof t === 'string' ? t.trim() : '')).filter((t: string) => t.length > 0)
      : [];
    const description = typeof data.description === 'string' ? data.description.trim() : '';
    const tags = Array.isArray(data.tags)
      ? data.tags
          .map((t: unknown) => (typeof t === 'string' ? t.trim().replace(/^#+/, '') : ''))
          .filter((t: string) => t.length > 0)
      : [];
    const thumbnailIdea = typeof data.thumbnailIdea === 'string' ? data.thumbnailIdea.trim() : '';
    if (titleOptions.length === 0 && !description) {
      return { parseError: 'The AI reply did not contain a usable title or description.' };
    }
    return { titleOptions, description, tags, thumbnailIdea };
  } catch {
    return { parseError: "I couldn't make sense of the AI's reply — it wasn't valid JSON. Try again." };
  }
}

function emptyResult(modelName: string, provider: 'cloud' | 'local', error?: string): GenerateYoutubePackageResult {
  return { package: null, model: modelName, modelProvider: provider, error };
}

function finalize(
  rawText: string,
  modelName: string,
  provider: 'cloud' | 'local',
): GenerateYoutubePackageResult {
  const parsed = parseAIResponse(rawText);
  if ('parseError' in parsed) return emptyResult(modelName, provider, parsed.parseError);
  return { package: parsed, model: modelName, modelProvider: provider };
}

async function generateWithGemini(input: GenerateYoutubePackageInput): Promise<GenerateYoutubePackageResult> {
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
  return finalize(text, modelName, 'cloud');
}

async function generateWithLocal(input: GenerateYoutubePackageInput): Promise<GenerateYoutubePackageResult> {
  const available = await isOllamaAvailable();
  if (!available) {
    return emptyResult('Local', 'local', 'Local AI (Ollama) is not running. Start Ollama or switch off local mode.');
  }
  const modelId = (await getBestAvailableModel()) || 'local model';
  const text = (await generateWithOllama({ prompt: buildPrompt(input), maxTokens: 4096, temperature: 0.7 })).trim();
  return finalize(text, modelId, 'local');
}

export async function generateYoutubePackage(input: GenerateYoutubePackageInput): Promise<GenerateYoutubePackageResult> {
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
