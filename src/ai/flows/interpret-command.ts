'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDefaultGeminiModel } from '@/config/gemini-models';
import { requireApiKey } from '@/lib/byok-keys';

export type CommandAction =
  | { kind: 'create_outline'; name: string }
  | { kind: 'collapse_all' }
  | { kind: 'expand_all' }
  | { kind: 'open_live_books' }
  | { kind: 'open_templates' }
  | { kind: 'open_search' }
  | { kind: 'open_help_chat' }
  | { kind: 'open_knowledge_chat' }
  | { kind: 'delete_node'; node_hint: string }
  | { kind: 'unknown'; reason: string };

export interface InterpretedCommand {
  action: CommandAction;
  destructive: boolean;
  confidence: 'high' | 'medium' | 'low';
  human_description: string;
}

export interface InterpretCommandInput {
  text: string;
  current_outline_name?: string;
  selected_node_name?: string;
  userApiKey?: string | null;
}

const SCHEMA = `You are a command interpreter for IdiamPro, an outliner app. Map the user request to ONE structured action. Return ONLY a JSON object.

Actions (use these exact "kind" values):
  "create_outline": { "name": <string> }   — make a new outline with this name
  "collapse_all": {}                        — collapse the whole tree
  "expand_all": {}                          — expand the whole tree
  "open_live_books": {}                     — open LIVE BOOKS (refresh from web)
  "open_templates": {}                      — open the template picker
  "open_search": {}                         — open search
  "open_help_chat": {}                      — open the help chat
  "open_knowledge_chat": {}                 — open the knowledge chat
  "delete_node": { "node_hint": <string> }  — DESTRUCTIVE; delete a node the user names
  "unknown": { "reason": <string> }         — when nothing above fits

Response shape:
{ "action": { "kind": "...", ... }, "destructive": true|false, "confidence": "high"|"medium"|"low", "human_description": "<plain English of what will happen>" }

Rules:
- destructive=true ONLY for delete_node.
- Prefer "unknown" over guessing; a clear "I can't do that yet" beats a wrong action.
- For create_outline, extract the intended name (e.g. "make an outline called Joe" -> name "Joe"). If no name given, use "Untitled Outline".`;

export async function interpretCommand(input: InterpretCommandInput): Promise<InterpretedCommand> {
  const apiKey = requireApiKey('gemini', input.userApiKey);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: getDefaultGeminiModel('sdk'),
    generationConfig: { temperature: 0.1, maxOutputTokens: 400, responseMimeType: 'application/json' },
  });
  const ctx: string[] = [];
  if (input.current_outline_name) ctx.push(`Current outline: ${input.current_outline_name}`);
  if (input.selected_node_name) ctx.push(`Selected node: ${input.selected_node_name}`);
  const prompt = `${SCHEMA}${ctx.length ? '\n\nCONTEXT:\n' + ctx.join('\n') : ''}\n\nUser request: ${input.text}`;
  try {
    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text()) as InterpretedCommand;
    if (!parsed || !parsed.action || !parsed.action.kind) {
      return { action: { kind: 'unknown', reason: 'No valid action.' }, destructive: false, confidence: 'low', human_description: 'No action.' };
    }
    return parsed;
  } catch {
    return { action: { kind: 'unknown', reason: 'I had trouble understanding that. Try rephrasing.' }, destructive: false, confidence: 'low', human_description: 'No action.' };
  }
}
