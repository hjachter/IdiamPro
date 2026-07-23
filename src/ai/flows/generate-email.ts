'use server';

/**
 * @fileOverview Generate a ready-to-send EMAIL from an outline branch.
 *
 * The user selects a branch (a node + all its descendants — the same
 * "chapter" scope Generate Video uses) and this flow turns that branch into
 * a real, human-readable email: a SUBJECT line plus a BODY with a greeting,
 * connective prose and/or tidy bullets as appropriate, and a sign-off. The
 * result is NOT a raw bullet dump of the outline — it reads like something a
 * person would actually send.
 *
 * Sibling of transform-outline / reformat-content: same Gemini-with-Ollama
 * fallback provider handling, same BYOK key contract, same "counts as 1 AI
 * generation" model (gated on the client via useAIUsageGate 'exportEmail').
 *
 * The flow returns THREE renderings of the body so the client's three
 * hand-offs stay faithful:
 *   - bodyHtml  — formatted HTML (used by Copy's rich clipboard + the .eml
 *                 text/html MIME part)
 *   - bodyText  — plain-text rendering (used by the Gmail compose URL, the
 *                 Copy plain fallback, and the .eml text/plain MIME part)
 * Both carry the SAME content, just different formatting.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDefaultGeminiModel, getGeminiModelById, DEFAULT_GEMINI_MODEL_ID } from '@/config/gemini-models';
import { generateWithOllama, isOllamaAvailable, getBestAvailableModel } from '@/lib/ollama-service';
import { requireApiKey } from '@/lib/byok-keys';
import type { SerializedNode } from '@/ai/flows/transform-outline';

/** Friendly-professional is the default; the client may offer a couple more. */
export type EmailTone = 'friendly-professional' | 'formal' | 'casual';

export interface GenerateEmailInput {
  /** Serialized branch (selected node + descendants) handed to the AI. */
  subtreeNodes: Record<string, SerializedNode>;
  /** Root of the branch being turned into an email. */
  rootNodeId: string;
  /** Optional outline name for context. */
  currentOutlineName?: string;
  /** Tone of voice. Defaults to friendly-professional. */
  tone?: EmailTone;
  /** Optional extra instruction from the user ("keep it short", "to my team"). */
  guidance?: string;
  /** The sender's own email address — personalizes the sign-off if provided. */
  senderEmail?: string;
  /** "Your Voice" — the user's OWN distilled writing-style profile. When set,
   *  the email is drafted to match the sender's personal voice. Never a
   *  third-party impersonation; this is the user's own style, from their own
   *  samples (see distill-voice-profile). */
  voiceProfile?: string;
  /** Force local Ollama. */
  useLocal?: boolean;
  /** Optional BYOK Gemini key. */
  userApiKey?: string | null;
}

export interface GenerateEmailResult {
  subject: string;
  /** Formatted HTML rendering of the body (greeting → prose/bullets → sign-off). */
  bodyHtml: string;
  /** Plain-text rendering of the same body. */
  bodyText: string;
  model: string;
  modelProvider: 'cloud' | 'local';
  error?: string;
}

const TONE_GUIDANCE: Record<EmailTone, string> = {
  'friendly-professional':
    'Warm but professional — the tone of a thoughtful colleague. Approachable, clear, respectful.',
  formal: 'Formal and polished — appropriate for a client, an executive, or an official message.',
  casual: 'Relaxed and conversational — the tone of a friendly note to someone you know well.',
};

const SYSTEM_INSTRUCTIONS = `You are an expert writing assistant that turns a person's rough outline into a polished, ready-to-send EMAIL.

You will receive a JSON subtree of an outline (a node and all its descendants). Each node has a name and HTML content. Treat this as the raw material — the points the sender wants to communicate.

Your job: write a real email that a person would actually send, faithfully conveying the outline's content. This is NOT a bullet-point dump of the outline. Turn the material into natural connective prose, keeping bullet lists ONLY where a genuine list improves clarity (steps, options, items).

The email MUST include:
- A short, specific SUBJECT line (no "Re:" prefix, no quotes).
- A greeting (e.g. "Hi there," — do not invent a specific recipient name; use a neutral greeting).
- A body that reads naturally and covers the outline's key points, using paragraphs and tidy bullets as appropriate.
- A friendly sign-off (e.g. "Best regards," on its own line — do NOT invent a specific sender name; leave the name line out or use a neutral placeholder the user can replace).

OUTPUT FORMAT — REPLY WITH JSON ONLY. NO MARKDOWN. NO PROSE BEFORE OR AFTER. NO CODE FENCES.

The JSON must be exactly:
{
  "subject": "<the subject line, plain text>",
  "bodyHtml": "<the email body as clean, simple HTML: <p> paragraphs, <ul>/<li> for lists, <br> for the sign-off. No <html>/<head>/<body> wrapper, no inline styles, no classes.>",
  "bodyText": "<the SAME email body as plain text: real line breaks between paragraphs, '- ' for bullet items, blank lines where natural>"
}

RULES:
- bodyHtml and bodyText MUST contain the same content — only the formatting differs.
- Do NOT include the subject inside the body.
- Keep it concise and skimmable. Don't pad. Don't add information that isn't in the outline.
- Do NOT wrap the JSON in code fences. OUTPUT JSON ONLY.`;

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
function renderBranchForPrompt(input: GenerateEmailInput): string {
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

/** Derive a friendly display name from an email local-part (e.g.
 *  "jane.doe@x.com" → "Jane Doe"). Best-effort; used only for the sign-off. */
function nameFromEmail(email?: string): string | null {
  const addr = (email || '').trim();
  if (!addr || !addr.includes('@')) return null;
  const local = addr.split('@')[0];
  const words = local
    .split(/[._\-+]+/)
    .filter((w) => w && /[a-z]/i.test(w))
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return words.length ? words.join(' ') : null;
}

function buildPrompt(input: GenerateEmailInput): string {
  const tone = input.tone || 'friendly-professional';
  const guidance = input.guidance?.trim();
  const senderName = nameFromEmail(input.senderEmail);
  const voice = input.voiceProfile?.trim();
  // "In my voice" — the sender's own distilled style takes priority over the
  // generic tone preset. It describes THIS person's writing, from their own
  // samples; it is never an impersonation of anyone else.
  const voiceBlock = voice
    ? `\nWRITE IN THE SENDER'S OWN VOICE. Match this description of the sender's personal writing style as closely as you can — its tone, formality, sentence rhythm, vocabulary, punctuation, and any emoji/quirks — while still producing a coherent email. This is the sender's OWN voice, from their own writing; do not imitate anyone else:\n"""\n${voice}\n"""\n`
    : '';
  return `${SYSTEM_INSTRUCTIONS}

TONE: ${TONE_GUIDANCE[tone]}
${voiceBlock}${guidance ? `\nEXTRA INSTRUCTION FROM THE SENDER: "${guidance}"\n` : ''}${senderName ? `\nSENDER NAME (use it on the sign-off name line, e.g. "Best regards,\\n${senderName}"): ${senderName}\n` : ''}
OUTLINE NAME: ${input.currentOutlineName || '(untitled)'}

OUTLINE BRANCH TO TURN INTO AN EMAIL:
"""
${renderBranchForPrompt(input) || '(empty)'}
"""

Reply with ONLY the JSON object described above. No preamble, no code fences, no commentary.`;
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json|JSON)?\n?([\s\S]*?)\n?```$/);
  if (fenceMatch) return fenceMatch[1].trim();
  return trimmed;
}

function parseAIResponse(
  rawText: string,
): { subject: string; bodyHtml: string; bodyText: string } | { parseError: string } {
  const cleaned = stripCodeFences(rawText);
  if (!cleaned) return { parseError: 'The AI returned an empty reply.' };
  try {
    // Be forgiving: if there's stray text, grab the first {...} block.
    let jsonText = cleaned;
    if (!jsonText.startsWith('{')) {
      const m = jsonText.match(/\{[\s\S]*\}/);
      if (m) jsonText = m[0];
    }
    const data = JSON.parse(jsonText);
    if (!data || typeof data !== 'object') {
      return { parseError: 'The AI reply was not a JSON object.' };
    }
    const subject = typeof data.subject === 'string' ? data.subject.trim() : '';
    let bodyHtml = typeof data.bodyHtml === 'string' ? data.bodyHtml.trim() : '';
    let bodyText = typeof data.bodyText === 'string' ? data.bodyText.trim() : '';
    if (!subject && !bodyHtml && !bodyText) {
      return { parseError: 'The AI reply did not contain an email.' };
    }
    // Backfill either rendering if the model only produced one.
    if (!bodyText && bodyHtml) bodyText = stripHtmlToText(bodyHtml);
    if (!bodyHtml && bodyText) {
      bodyHtml = bodyText
        .split(/\n{2,}/)
        .map((p: string) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
        .join('\n');
    }
    return { subject: subject || '(no subject)', bodyHtml, bodyText };
  } catch {
    return {
      parseError:
        "I couldn't make sense of the AI's reply — it wasn't valid JSON. Try again.",
    };
  }
}

function emptyResult(
  modelName: string,
  provider: 'cloud' | 'local',
  error?: string,
): GenerateEmailResult {
  return { subject: '', bodyHtml: '', bodyText: '', model: modelName, modelProvider: provider, error };
}

function finalize(
  rawText: string,
  modelName: string,
  provider: 'cloud' | 'local',
): GenerateEmailResult {
  const parsed = parseAIResponse(rawText);
  if ('parseError' in parsed) return emptyResult(modelName, provider, parsed.parseError);
  return {
    subject: parsed.subject,
    bodyHtml: parsed.bodyHtml,
    bodyText: parsed.bodyText,
    model: modelName,
    modelProvider: provider,
  };
}

async function generateWithGemini(input: GenerateEmailInput): Promise<GenerateEmailResult> {
  const apiKey = requireApiKey('gemini', input.userApiKey);
  const modelEntry = getGeminiModelById(DEFAULT_GEMINI_MODEL_ID);
  const modelName = modelEntry?.name || 'Gemini';
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: getDefaultGeminiModel('sdk'),
    generationConfig: { temperature: 0.6, maxOutputTokens: 4096, responseMimeType: 'application/json' },
  });
  const result = await model.generateContent(buildPrompt(input));
  const text = (result.response.text() || '').trim();
  return finalize(text, modelName, 'cloud');
}

async function generateWithLocal(input: GenerateEmailInput): Promise<GenerateEmailResult> {
  const available = await isOllamaAvailable();
  if (!available) {
    return emptyResult('Local', 'local', 'Local AI (Ollama) is not running. Start Ollama or switch off local mode.');
  }
  const modelId = (await getBestAvailableModel()) || 'local model';
  const text = (await generateWithOllama({ prompt: buildPrompt(input), maxTokens: 4096, temperature: 0.6 })).trim();
  return finalize(text, modelId, 'local');
}

export async function generateEmail(input: GenerateEmailInput): Promise<GenerateEmailResult> {
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
