'use server';

/**
 * @fileOverview Generate ready-to-post INSTAGRAM content from an outline branch.
 *
 * Instagram is the second social format template (after X). It has two output
 * modes, both driven from the same selected branch (a node + all its
 * descendants — the "chapter" scope Generate Video / Export Email use):
 *
 *   - CAPTION  → one engaging Instagram caption plus a set of natural hashtags.
 *   - CAROUSEL → a sequence of short, punchy carousel-slide lines (slide 1 is a
 *                hook cover), PLUS the accompanying caption + hashtags. The slide
 *                LINES come from here; the branded square IMAGES are rendered on
 *                the client (src/lib/instagram/render-carousel.ts).
 *
 * Sibling of generate-social-post: same Gemini-with-Ollama fallback, same BYOK
 * key contract, same "counts as 1 AI generation" model. Optional "In my voice"
 * uses the author's OWN distilled Your Voice profile for the caption text.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDefaultGeminiModel, getGeminiModelById, DEFAULT_GEMINI_MODEL_ID } from '@/config/gemini-models';
import { generateWithOllama, isOllamaAvailable, getBestAvailableModel } from '@/lib/ollama-service';
import { requireApiKey } from '@/lib/byok-keys';
import type { SerializedNode } from '@/ai/flows/transform-outline';

export type InstagramMode = 'caption' | 'carousel';

/** A single carousel slide's text (the branded image is rendered client-side). */
export interface InstagramSlideSpec {
  title: string;
  subtitle?: string;
  kind?: 'cover' | 'content';
}

export interface GenerateInstagramInput {
  subtreeNodes: Record<string, SerializedNode>;
  rootNodeId: string;
  currentOutlineName?: string;
  mode: InstagramMode;
  /** Optional extra instruction from the user. */
  guidance?: string;
  /** The author's OWN Your Voice profile — never third-party impersonation. */
  voiceProfile?: string;
  useLocal?: boolean;
  userApiKey?: string | null;
}

export interface GenerateInstagramResult {
  /** The post caption (all modes). */
  caption: string;
  /** Natural, relevant hashtags (without forcing them into the caption body). */
  hashtags: string[];
  /** Carousel slide lines in order (empty for caption mode). Slide 1 is the hook. */
  slides: InstagramSlideSpec[];
  model: string;
  modelProvider: 'cloud' | 'local';
  error?: string;
}

// Instagram's caption hard cap. We keep a little headroom for the hashtag block.
const CAPTION_LIMIT = 2200;
const MIN_SLIDES = 4;
const MAX_SLIDES = 10;

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

function renderBranchForPrompt(input: GenerateInstagramInput): string {
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

function buildPrompt(input: GenerateInstagramInput): string {
  const voice = input.voiceProfile?.trim();
  const voiceBlock = voice
    ? `\nWRITE THE CAPTION IN THE AUTHOR'S OWN VOICE. Match this description of the author's personal writing style — its tone, formality, sentence rhythm, vocabulary, punctuation, and any emoji quirks — while still producing an effective Instagram caption. This is the author's OWN voice, from their own writing; do not imitate anyone else:\n"""\n${voice}\n"""\n`
    : '';

  const carouselBlock =
    input.mode === 'carousel'
      ? `MODE: CAROUSEL. Produce a sequence of ${MIN_SLIDES}-${MAX_SLIDES} carousel slides that teach or tell one clear idea across the cards.
- The FIRST slide is the COVER / HOOK: a short, scroll-stopping headline (a few words) that makes people swipe. Give it kind "cover".
- Each following slide is ONE key point: a short punchy "title" (a headline, not a paragraph — aim under ~8 words) and, only if it helps, a single short "subtitle" line. Give these kind "content".
- Keep every line SHORT and human — carousel cards are big type, not walls of text. No slide numbering (the app adds it).
- ALSO write the post "caption" (engaging, a few short lines, may use tasteful line breaks and a light emoji or two) and a set of "hashtags".`
      : `MODE: CAPTION. Produce ONE engaging Instagram "caption" for this branch — a strong first line that hooks, then a few short lines of value, an optional light call-to-action. Tasteful line breaks are good; a light emoji or two is fine. Keep it under ${CAPTION_LIMIT} characters. Also produce a set of "hashtags". Leave "slides" as an empty array.`;

  const shape =
    input.mode === 'carousel'
      ? `{
  "slides": [ { "title": "<hook headline>", "subtitle": "", "kind": "cover" }, { "title": "<point>", "subtitle": "<optional short line>", "kind": "content" } ],
  "caption": "<the post caption>",
  "hashtags": ["#example", "#another"]
}`
      : `{
  "slides": [],
  "caption": "<the post caption>",
  "hashtags": ["#example", "#another"]
}`;

  return `You are an expert Instagram content creator. Turn a person's outline branch into ready-to-post Instagram content.

You will receive a readable outline (a node and all its descendants). Treat it as the raw material — the points the author wants to share.

INSTAGRAM RULES:
- Write in a warm, natural, human voice — never a dry summary.
- Hashtags: 8-15 genuinely relevant tags, each starting with "#", lowercase, no spaces inside a tag. Do NOT stuff the caption body with them — return them separately in "hashtags".
- No markdown, no bullet characters, no code fences.

${carouselBlock}
${voiceBlock}${input.guidance ? `\nEXTRA INSTRUCTION FROM THE AUTHOR: "${input.guidance.trim()}"\n` : ''}
OUTPUT FORMAT — REPLY WITH JSON ONLY. NO MARKDOWN. NO PROSE BEFORE OR AFTER. NO CODE FENCES.

The JSON must be exactly this shape:
${shape}

OUTLINE NAME: ${input.currentOutlineName || '(untitled)'}

OUTLINE BRANCH TO TURN INTO INSTAGRAM CONTENT:
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

function normalizeHashtags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    let tag = item.trim().replace(/\s+/g, '');
    if (!tag) continue;
    if (!tag.startsWith('#')) tag = `#${tag}`;
    // Strip anything that isn't a hashtag-safe character.
    tag = '#' + tag.slice(1).replace(/[^0-9a-zA-Z_]/g, '');
    if (tag.length <= 1) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= 30) break;
  }
  return out;
}

function normalizeSlides(raw: unknown): InstagramSlideSpec[] {
  if (!Array.isArray(raw)) return [];
  const out: InstagramSlideSpec[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const title = typeof obj.title === 'string' ? obj.title.trim() : '';
    if (!title) continue;
    const subtitle = typeof obj.subtitle === 'string' ? obj.subtitle.trim() : '';
    const kind = obj.kind === 'cover' ? 'cover' : 'content';
    out.push({ title, subtitle: subtitle || undefined, kind });
    if (out.length >= MAX_SLIDES) break;
  }
  // Guarantee the first slide reads as the cover/hook.
  if (out.length > 0) out[0].kind = 'cover';
  return out;
}

function parseAIResponse(
  rawText: string,
  mode: InstagramMode,
): { caption: string; hashtags: string[]; slides: InstagramSlideSpec[] } | { parseError: string } {
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
      return { parseError: 'The AI reply was not in the expected format.' };
    }
    let caption = typeof data.caption === 'string' ? data.caption.trim() : '';
    if (caption.length > CAPTION_LIMIT) caption = caption.slice(0, CAPTION_LIMIT - 1).trimEnd() + '…';
    const hashtags = normalizeHashtags(data.hashtags);
    const slides = mode === 'carousel' ? normalizeSlides(data.slides) : [];
    if (mode === 'carousel' && slides.length < 2) {
      return { parseError: 'The AI did not return enough carousel slides.' };
    }
    if (mode === 'caption' && !caption) {
      return { parseError: 'The AI did not return a caption.' };
    }
    return { caption, hashtags, slides };
  } catch {
    return { parseError: "I couldn't make sense of the AI's reply — it wasn't valid JSON. Try again." };
  }
}

function emptyResult(modelName: string, provider: 'cloud' | 'local', error?: string): GenerateInstagramResult {
  return { caption: '', hashtags: [], slides: [], model: modelName, modelProvider: provider, error };
}

function finalize(
  rawText: string,
  input: GenerateInstagramInput,
  modelName: string,
  provider: 'cloud' | 'local',
): GenerateInstagramResult {
  const parsed = parseAIResponse(rawText, input.mode);
  if ('parseError' in parsed) return emptyResult(modelName, provider, parsed.parseError);
  return {
    caption: parsed.caption,
    hashtags: parsed.hashtags,
    slides: parsed.slides,
    model: modelName,
    modelProvider: provider,
  };
}

async function generateWithGemini(input: GenerateInstagramInput): Promise<GenerateInstagramResult> {
  const apiKey = requireApiKey('gemini', input.userApiKey);
  const modelEntry = getGeminiModelById(DEFAULT_GEMINI_MODEL_ID);
  const modelName = modelEntry?.name || 'Gemini';
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: getDefaultGeminiModel('sdk'),
    generationConfig: { temperature: 0.75, maxOutputTokens: 4096, responseMimeType: 'application/json' },
  });
  const result = await model.generateContent(buildPrompt(input));
  const text = (result.response.text() || '').trim();
  return finalize(text, input, modelName, 'cloud');
}

async function generateWithLocal(input: GenerateInstagramInput): Promise<GenerateInstagramResult> {
  const available = await isOllamaAvailable();
  if (!available) {
    return emptyResult('Local', 'local', 'Local AI (Ollama) is not running. Start Ollama or switch off local mode.');
  }
  const modelId = (await getBestAvailableModel()) || 'local model';
  const text = (await generateWithOllama({ prompt: buildPrompt(input), maxTokens: 4096, temperature: 0.75 })).trim();
  return finalize(text, input, modelId, 'local');
}

export async function generateInstagramPost(input: GenerateInstagramInput): Promise<GenerateInstagramResult> {
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
