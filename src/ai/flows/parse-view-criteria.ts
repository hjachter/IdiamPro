'use server';

// "Show Me" natural-language front-end — ONE light AI call that translates a
// plain-English request ("unresolved tasks from August under Marketing") into
// STRUCTURED, VISIBLE criterion rows the user can inspect and edit.
//
// The AI only TRANSLATES; it never filters. All filtering is pure local logic
// in src/lib/view-criteria.ts, so the feature works fully without AI too
// (manual rows). Every AI-produced row is passed through sanitizeCriterion so
// a malformed response can never inject an illegal field/operator.

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDefaultGeminiModel } from '@/config/gemini-models';
import { requireApiKey } from '@/lib/byok-keys';
import {
  sanitizeCriterion,
  type ViewCriterion,
  type ViewMatchMode,
} from '@/lib/view-criteria';

export interface ParseViewCriteriaInput {
  request: string;            // the user's natural-language description
  availableTags: string[];    // tags that actually exist in the outline
  /** Optional user-supplied Gemini key (BYOK). Falls back to GEMINI_API_KEY env var. */
  userApiKey?: string | null;
}

export interface ParseViewCriteriaOutput {
  matchMode: ViewMatchMode;
  criteria: ViewCriterion[];
}

export async function parseViewCriteria(
  input: ParseViewCriteriaInput,
): Promise<ParseViewCriteriaOutput> {
  const apiKey = requireApiKey('gemini', input.userApiKey);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: getDefaultGeminiModel('sdk'),
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 512,
      responseMimeType: 'application/json',
    },
  });

  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const prompt = `You translate a user's plain-English request into structured filter criteria for an outlining app. Users filter the items (nodes) of an outline.

Each criterion is {"field": ..., "operator": ..., "value": ...}. Legal combinations:
- field "name" | "content" | "anyText" — operator "contains" | "not-contains"; value = text. ("anyText" = name or content.)
- field "tag" — operator "is" | "is-not"; value = one tag name. Existing tags in this outline: ${input.availableTags.length ? input.availableTags.join(', ') : '(none)'}. Prefer an existing tag when the request clearly refers to one.
- field "type" — operator "is" | "is-not"; value = one of: task, note, chapter, document, link, code, quote, date, image.
- field "completed" — operator "is"; value "yes" or "no". Use for done/finished vs open/unresolved/pending tasks.
- field "priority" — operator "is" | "is-not"; value Low | Medium | High.
- field "color" — operator "is" | "is-not"; value red|orange|yellow|green|blue|purple|pink.
- field "created" | "updated" | "due" — operator "on-or-after" | "on-or-before"; value YYYY-MM-DD. For a month/range emit TWO rows (on-or-after start, on-or-before end).
- field "branch" — operator "contains"; value = branch name text. Use when the request scopes to items UNDER a named section/branch.

Today's date: ${todayIso}. Resolve relative dates ("last week", "August") to real dates; a bare month means that month in the current year unless it is in the future, then use last year.

Also pick "matchMode": "all" (every criterion must hold — the default) or "any" (at least one holds; only when the user says "or"/"either").

Words like "unresolved", "open", "not done", "pending" on tasks mean {"field":"completed","operator":"is","value":"no"}. "Decisions", "questions" etc. are usually text: {"field":"anyText","operator":"contains","value":"decision"}.

Return JSON ONLY in this exact shape:
{"matchMode":"all","criteria":[{"field":"...","operator":"...","value":"..."}]}

User request: "${input.request.replace(/"/g, '\\"').slice(0, 500)}"`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Could not interpret that request.');
  }

  const obj = (parsed && typeof parsed === 'object') ? parsed as Record<string, unknown> : {};
  const matchMode: ViewMatchMode = obj.matchMode === 'any' ? 'any' : 'all';
  const rawList = Array.isArray(obj.criteria) ? obj.criteria : [];
  const criteria = rawList
    .map(sanitizeCriterion)
    .filter((c): c is ViewCriterion => c !== null)
    .slice(0, 8);

  if (criteria.length === 0) {
    throw new Error('Could not interpret that request.');
  }

  return { matchMode, criteria };
}
