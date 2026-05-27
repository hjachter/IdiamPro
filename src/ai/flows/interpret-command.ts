'use server';

/**
 * @fileOverview Interpret a user's natural-language command into a structured
 * action the app can execute. Powers the Cmd+K natural-language bar.
 *
 * The AI maps free-form text like "create a new outline called Joe" into a
 * typed JSON action ({ kind: 'create_outline', name: 'Joe', ... }). The caller
 * (the dispatcher) translates that action into a real app operation.
 *
 * The AI is constrained to a known vocabulary. If the user asks for something
 * outside the vocabulary, the AI returns kind: 'unknown' with a reason —
 * the dispatcher then shows a polite "I can't do that yet" message instead of
 * silently guessing.
 *
 * Every returned action is annotated with whether it is destructive and a
 * confidence level — the dispatcher uses these to decide whether to show a
 * confirmation card before doing it.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDefaultGeminiModel } from '@/config/gemini-models';
import { requireApiKey } from '@/lib/byok-keys';

export type CommandAction =
  | { kind: 'create_outline'; name: string }
  | { kind: 'rename_outline'; current_name: string; new_name: string }
  | { kind: 'delete_outline'; name: string }
  | { kind: 'add_child_node'; parent_hint: string | null; node_name: string; content: string | null }
  | { kind: 'add_sibling_node'; sibling_hint: string | null; node_name: string }
  | { kind: 'delete_node'; node_hint: string }
  | { kind: 'rename_node'; node_hint: string; new_name: string }
  | { kind: 'expand_node_with_ai'; node_hint: string | null }
  | { kind: 'refresh_node_with_ai'; node_hint: string | null }
  | { kind: 'translate_outline'; target_language: string }
  | { kind: 'translate_node'; node_hint: string | null; target_language: string }
  | { kind: 'collapse_all' }
  | { kind: 'expand_all' }
  | { kind: 'search'; query: string }
  | { kind: 'open_outline'; name: string }
  | { kind: 'open_settings' }
  | { kind: 'unknown'; reason: string };

export interface InterpretedCommand {
  action: CommandAction;
  destructive: boolean;
  confidence: 'high' | 'medium' | 'low';
  human_description: string;
}

export interface InterpretCommandInput {
  /** The user's natural-language command text. */
  text: string;
  /** Optional context: which outline + node the user is currently looking at. */
  current_outline_name?: string;
  selected_node_name?: string;
  /** Optional BYOK Gemini key. */
  userApiKey?: string | null;
}

const SCHEMA_PROMPT = `You are a command interpreter for IdiamPro, an outliner app with built-in AI.

Map the user's natural-language request into ONE of these structured actions. Return ONLY a single JSON object, no preamble.

Vocabulary (use these "kind" values exactly):
  - "create_outline": { "name": <string> }                    — make a new outline
  - "rename_outline": { "current_name": <string>, "new_name": <string> }
  - "delete_outline": { "name": <string> }                    — DESTRUCTIVE
  - "add_child_node": { "parent_hint": <string|null>, "node_name": <string>, "content": <string|null> }
  - "add_sibling_node": { "sibling_hint": <string|null>, "node_name": <string> }
  - "delete_node": { "node_hint": <string> }                  — DESTRUCTIVE
  - "rename_node": { "node_hint": <string>, "new_name": <string> }
  - "expand_node_with_ai": { "node_hint": <string|null> }     — generates body content via AI
  - "refresh_node_with_ai": { "node_hint": <string|null> }    — DESTRUCTIVE in overwrite mode; we treat as confirm-worthy
  - "translate_outline": { "target_language": <string> }      — DESTRUCTIVE (replaces content); confirm-worthy
  - "translate_node": { "node_hint": <string|null>, "target_language": <string> }   — confirm-worthy
  - "collapse_all": {}
  - "expand_all": {}
  - "search": { "query": <string> }
  - "open_outline": { "name": <string> }
  - "open_settings": {}
  - "unknown": { "reason": <string> }                          — when the user's text doesn't map to any action above

The full response shape is:
{
  "action": { "kind": "...", ... },
  "destructive": true/false,            // true for delete/rename/overwrite/translate-replace
  "confidence": "high" | "medium" | "low",
  "human_description": "<plain-English summary of what will happen, e.g. \"Create a new outline named 'Joe'.\">"
}

Rules:
- For node references, set the *_hint field to whatever phrase the user used ("the climate change one", "the second item"). The caller will resolve hints to actual node IDs by searching.
- If the user doesn't specify which node and there is a selected node in context, set the hint to null (the caller will use the selected node).
- If the user references a language by code or alternate name, normalize to the common English name (e.g. "ja" → "Japanese", "Mandarin" → "Mandarin Chinese").
- Use confidence "high" when the action and its arguments are unambiguous, "medium" when an argument is inferred from context, "low" when you're guessing.
- Use kind "unknown" rather than guessing — it's much better to ask the user to rephrase than to do the wrong thing.`;

export async function interpretCommand(input: InterpretCommandInput): Promise<InterpretedCommand> {
  const apiKey = requireApiKey('gemini', input.userApiKey);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: getDefaultGeminiModel('sdk'),
    generationConfig: { temperature: 0.1, maxOutputTokens: 512, responseMimeType: 'application/json' },
  });

  const contextLines: string[] = [];
  if (input.current_outline_name) contextLines.push(`Current outline: ${input.current_outline_name}`);
  if (input.selected_node_name)   contextLines.push(`Currently selected node: ${input.selected_node_name}`);
  const context = contextLines.length ? `\n\nCONTEXT:\n${contextLines.join('\n')}` : '';

  const prompt = `${SCHEMA_PROMPT}${context}\n\nUser request: ${input.text}`;

  let parsed: InterpretedCommand;
  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    parsed = JSON.parse(text) as InterpretedCommand;
  } catch (err) {
    return {
      action: { kind: 'unknown', reason: 'I had trouble understanding that. Please try rephrasing.' },
      destructive: false,
      confidence: 'low',
      human_description: 'No action.',
    };
  }
  // Defensive defaults
  if (!parsed.action || !parsed.action.kind) {
    return {
      action: { kind: 'unknown', reason: 'No valid action returned.' },
      destructive: false,
      confidence: 'low',
      human_description: 'No action.',
    };
  }
  return parsed;
}
