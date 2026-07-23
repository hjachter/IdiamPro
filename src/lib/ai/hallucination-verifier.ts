/**
 * ALWAYS-ON HALLUCINATION VERIFIER — core logic (2026-07-23).
 *
 * After a primary AI generation of a FACTUAL / claim-bearing output (an Export
 * Email draft, a social post, a Summarize result, or the Import-Email → outline
 * extraction), we run a SECOND verification pass that checks the DRAFT against
 * ITS SOURCE (the outline branch / email content it was generated from) and
 * flags claims the source does NOT support (hallucinations / fabrications).
 *
 * Design rules (owner-decided, always-on — no toggle):
 *   - Runs on the ON-DEVICE model (Ollama/Gemma) so it costs $0 and NEVER
 *     consumes the cloud allowance/meter. This module deliberately imports NO
 *     Gemini / company-key / meter code — the on-device generate function is
 *     injected via `deps`, and the only real wiring lives in the
 *     src/ai/flows/verify-against-source.ts server action.
 *   - DEGRADES GRACEFULLY: if on-device AI is unavailable (web / iOS with no
 *     Ollama), the automated check is skipped (ran:false) and the caller still
 *     shows the review reminder. We never silently spend uncapped cloud AI on
 *     the verify.
 *   - FLAG-AND-SUGGEST, never silent-rewrite: returns the suspect claims/spans
 *     plus an OPTIONAL corrected version. The UI flags them; the human accepts
 *     or edits. The human stays in control.
 *   - Bounded to a SINGLE pass (no loops) and never throws — any error just
 *     yields ran:false so the flow keeps working and the review reminder shows.
 *
 * This file is pure + provider-agnostic so tests can drive it with a fake
 * `generate` and no Ollama.
 */

/** Minimal node shape shared by SerializedNode and OutlineNode. */
interface VerifyNode {
  name?: string;
  content?: string;
  childrenIds?: string[];
}

/** One possibly-unsupported claim the verifier surfaced. */
export interface VerifyClaim {
  /** The suspect span / claim text from the draft. */
  claim: string;
  /** Optional short reason it looks unsupported. */
  reason?: string;
}

export interface VerifyResult {
  /** Did the automated on-device check actually run? False = skipped/degraded. */
  ran: boolean;
  /** Why the check didn't run (only set when ran === false). */
  skippedReason?: 'no-on-device' | 'error' | 'empty-input';
  /** Possibly-unsupported claims. Empty array = nothing flagged (clean). */
  suspectClaims: VerifyClaim[];
  /** OPTIONAL corrected version of the draft (flag-and-suggest; user opts in). */
  correctedText?: string;
  /** On-device model that ran the check, for display. */
  model?: string;
}

export interface VerifyInput {
  /** The SOURCE material the draft was generated from (outline branch / email). */
  source: string;
  /** The generated DRAFT to check against the source. */
  output: string;
  /** Free-form label of what was generated (email / social post / summary / …). */
  kind?: string;
}

/** Injected dependencies so the check can run on-device (or be faked in tests). */
export interface VerifyDeps {
  /** True when the on-device engine is reachable. */
  isAvailable: () => Promise<boolean>;
  /** Run one on-device generation. */
  generate: (prompt: string) => Promise<string>;
  /** Optional: name of the on-device model, for display. */
  modelName?: () => Promise<string | null>;
}

/** Strip HTML to readable plain text (best-effort). */
export function stripHtmlToText(html: string): string {
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

/**
 * Flatten a node map (SerializedNode or OutlineNode) into indented plain text —
 * the source rendering the verifier compares the draft against.
 */
export function nodesToPlainText(
  nodes: Record<string, VerifyNode>,
  rootId: string,
): string {
  const lines: string[] = [];
  const seen = new Set<string>();
  const walk = (id: string, depth: number) => {
    if (seen.has(id)) return; // guard against cycles
    seen.add(id);
    const n = nodes[id];
    if (!n) return;
    const indent = '  '.repeat(depth);
    if (n.name) lines.push(`${indent}- ${n.name}`);
    const body = stripHtmlToText(n.content || '');
    if (body) {
      for (const ln of body.split('\n')) {
        if (ln.trim()) lines.push(`${indent}  ${ln.trim()}`);
      }
    }
    for (const childId of n.childrenIds || []) walk(childId, depth + 1);
  };
  walk(rootId, 0);
  return lines.join('\n');
}

/** Cap on how much text we feed the on-device model, to keep the pass fast. */
const MAX_CHARS = 8000;

function clamp(text: string): string {
  const t = (text || '').trim();
  return t.length > MAX_CHARS ? `${t.slice(0, MAX_CHARS)}\n…(truncated)` : t;
}

/** Build the single verification prompt. */
export function buildVerifyPrompt(input: VerifyInput): string {
  const kind = input.kind?.trim() || 'text';
  return `You are a careful fact-checker. You are given a SOURCE and a DRAFT (${kind}) that was written FROM that source.

Your ONLY job: find factual claims in the DRAFT that are NOT supported by the SOURCE — invented names, numbers, dates, statistics, quotes, commitments, features, or facts that do not appear in (and cannot be reasonably inferred from) the SOURCE. These are the risky "hallucinations".

Rules:
- Judge ONLY against the SOURCE. Do not use outside knowledge.
- Ignore pure style, wording, tone, formatting, greetings, and sign-offs.
- Reasonable paraphrase or summary of the source is SUPPORTED — do not flag it.
- Flag at most the 5 most important unsupported claims. If everything is supported, return an empty list.

OUTPUT FORMAT — REPLY WITH JSON ONLY. NO MARKDOWN, NO PROSE, NO CODE FENCES:
{
  "suspectClaims": [ { "claim": "<the exact unsupported span from the draft>", "reason": "<short why it is unsupported>" } ],
  "correctedText": "<OPTIONAL: the draft rewritten to remove or soften the unsupported claims, keeping everything supported. Omit or leave empty if nothing needs changing.>"
}

SOURCE:
"""
${clamp(input.source)}
"""

DRAFT TO CHECK:
"""
${clamp(input.output)}
"""

Reply with ONLY the JSON object.`;
}

function stripCodeFences(text: string): string {
  const trimmed = (text || '').trim();
  const fenceMatch = trimmed.match(/^```(?:json|JSON)?\n?([\s\S]*?)\n?```$/);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

/**
 * Parse the model's raw reply. `ok` is false when the reply couldn't be
 * understood — the caller then treats the pass as "didn't run" rather than
 * fabricating flags or falsely reporting "clean".
 */
export function analyzeVerification(rawText: string): {
  ok: boolean;
  suspectClaims: VerifyClaim[];
  correctedText?: string;
} {
  const cleaned = stripCodeFences(rawText);
  if (!cleaned) return { ok: false, suspectClaims: [] };
  try {
    let jsonText = cleaned;
    if (!jsonText.startsWith('{')) {
      const m = jsonText.match(/\{[\s\S]*\}/);
      if (m) jsonText = m[0];
    }
    const data = JSON.parse(jsonText);
    if (!data || typeof data !== 'object') return { ok: false, suspectClaims: [] };

    const rawClaims = Array.isArray(data.suspectClaims) ? data.suspectClaims : [];
    const suspectClaims: VerifyClaim[] = rawClaims
      .map((c: unknown): VerifyClaim | null => {
        if (typeof c === 'string') {
          const s = c.trim();
          return s ? { claim: s } : null;
        }
        if (c && typeof c === 'object') {
          const obj = c as { claim?: unknown; reason?: unknown };
          const claim = typeof obj.claim === 'string' ? obj.claim.trim() : '';
          const reason = typeof obj.reason === 'string' ? obj.reason.trim() : '';
          return claim ? { claim, reason: reason || undefined } : null;
        }
        return null;
      })
      .filter((c: VerifyClaim | null): c is VerifyClaim => c !== null)
      .slice(0, 5);

    const correctedText =
      typeof data.correctedText === 'string' && data.correctedText.trim()
        ? data.correctedText.trim()
        : undefined;

    return { ok: true, suspectClaims, correctedText };
  } catch {
    return { ok: false, suspectClaims: [] };
  }
}

/**
 * THE verifier. One on-device pass, never throws, degrades gracefully.
 * Provider-agnostic: `deps` supplies the on-device generate function so this
 * can NEVER reach the cloud meter, and tests can drive it without Ollama.
 */
export async function verifyAgainstSource(
  input: VerifyInput,
  deps: VerifyDeps,
): Promise<VerifyResult> {
  try {
    if (!input.source?.trim() || !input.output?.trim()) {
      return { ran: false, skippedReason: 'empty-input', suspectClaims: [] };
    }
    const available = await deps.isAvailable();
    if (!available) {
      return { ran: false, skippedReason: 'no-on-device', suspectClaims: [] };
    }
    const raw = await deps.generate(buildVerifyPrompt(input));
    const parsed = analyzeVerification(raw);
    if (!parsed.ok) {
      // Couldn't understand the reply — treat as "didn't run" so the caller
      // shows only the review reminder rather than a false all-clear.
      return { ran: false, skippedReason: 'error', suspectClaims: [] };
    }
    let model: string | undefined;
    if (deps.modelName) {
      try {
        model = (await deps.modelName()) || undefined;
      } catch {
        model = undefined;
      }
    }
    return {
      ran: true,
      suspectClaims: parsed.suspectClaims,
      correctedText: parsed.correctedText,
      model,
    };
  } catch {
    return { ran: false, skippedReason: 'error', suspectClaims: [] };
  }
}
