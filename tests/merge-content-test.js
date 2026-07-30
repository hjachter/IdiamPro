#!/usr/bin/env node
/**
 * merge-content-test.js — NONDETERMINISTIC / AI tier: the MERGE synthesis invariants.
 *
 * IdeaM's "Research & Import" MERGE feature (bulkResearchIngestAction in
 * src/app/actions.ts, the "SYNTHESIZE: Deep merge into unified outline" path)
 * weaves TWO outlines about the same topic into ONE unified outline. Its whole
 * value is a CONCEPTUAL SYNTHESIS — the way a good researcher weaves several
 * references into a single coherent paper — NOT a concatenation that keeps the
 * two sources in separate piles. So the merged result must:
 *   • carry the COLLECTIVE KNOWLEDGE of BOTH sources (nothing important dropped),
 *   • UNIFY overlapping ideas into one woven statement (no duplicate entries),
 *   • NOT be organized/labelled by which source each idea came from.
 *
 * This suite drives the REAL on-device model (Ollama gemma4:e4b — the $0,
 * no-cloud-key engine the app uses) and runs the merge 5× (via
 * tests/lib/ai-invariants.repeat), asserting INVARIANTS, not exact text:
 *
 *   1. LOST-KNOWLEDGE GUARD — the merged outline contains BOTH sources' unique
 *      marker facts (A's "Reykjavik offsite" AND B's "BrightSmile dental plan").
 *      If EITHER is missing, knowledge was lost in the merge — FAIL.
 *   2. OVERLAP IS UNIFIED — a fact present VERBATIM in BOTH sources (the
 *      "SEC-2031 safety certification") appears in the merge but is woven into a
 *      SINGLE node, not duplicated as two near-identical sibling entries. A
 *      concatenation would reproduce it twice; a synthesis states it once.
 *   3. NO SOURCE SEPARATION — the merge is not split into source-labelled
 *      sections ("Source A" / "Document 2" / "From the first outline" …). A
 *      researcher's paper integrates references; it is not organized by which
 *      source each idea came from.
 *   4. non-empty / well-formed  (assertNonEmpty)
 *   5. ON-DEVICE only — the company AI key is never surfaced
 *      (assertCompanyKeyNotUsed): an on-device merge must cost $0.
 *
 * The merge prompt below mirrors the app's shipping SYNTHESIZE intent (merge
 * overlapping facts into ONE coherent outline, no per-source sections, no source
 * attribution) so this exercises the REAL merge behaviour.
 *
 * If Ollama/gemma4 is unavailable this SKIPS (exit 0) with a clear note —
 * on-device AI is an environmental dependency, not a code failure. When it runs,
 * ANY invariant violation across the 5 iterations fails the suite (exit != 0).
 *
 * Run: node tests/merge-content-test.js
 */
const fs = require('fs');
const path = require('path');
const {
  repeat,
  assertNonEmpty,
  assertCompanyKeyNotUsed,
} = require('./lib/ai-invariants');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'test-screenshots', 'merge-content');
fs.mkdirSync(OUT_DIR, { recursive: true });

const OLLAMA = 'http://localhost:11434';
const MODEL = 'gemma4:e4b';
const REPEATS = 5;
// The app gives this deep-merge path a generous output budget (ollamaMaxTokens
// 8000-12000 in actions.ts) precisely so long merges never stop early and drop
// later facts. We match its floor so token truncation — a test artifact, not a
// merge bug — never confounds the knowledge-preservation assertions.
const NUM_PREDICT = 8000;
// Stand-in for the company key so the forbidden-key guard has something real to
// compare against. The on-device merge path must never surface this.
const COMPANY_KEY = 'COMPANY_SECRET_KEY_SHOULD_NEVER_BE_USED';

const results = [];
const record = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail });

function fail(msg) {
  const e = new Error(msg);
  e.name = 'InvariantError';
  throw e;
}

async function ollamaUp() {
  try {
    const r = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return false;
    const j = await r.json();
    return Array.isArray(j.models) && j.models.some((m) => (m.name || '').startsWith('gemma4'));
  } catch {
    return false;
  }
}

// Transport-level resilience ONLY: a transient socket blip is a NETWORK event,
// not an AI-output invariant violation, so we retry the request. The invariant
// ASSERTIONS on the returned text stay strict — we never retry a bad answer.
// An EMPTY completion is a failed generation (a merged outline must have
// content), so we retry that too — mirroring the app's generate flows.
async function generate(prompt, { num_predict = NUM_PREDICT, temperature = 0.7 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`${OLLAMA}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          prompt,
          stream: false,
          options: { temperature, num_predict },
        }),
        signal: AbortSignal.timeout(120000),
      });
      if (!r.ok) throw new Error(`ollama HTTP ${r.status}`);
      const j = await r.json();
      const text = (j.response || '').trim();
      if (text.length === 0) throw new Error('empty generation (model produced nothing)');
      return text;
    } catch (e) {
      lastErr = e;
      await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
    }
  }
  throw new Error(`ollama transport failed after retries: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
}

// ── The two source outlines — same topic (a fictional company's employee
// handbook), on the SAME theme set so they OVERLAP heavily, plus three planted
// markers that make the synthesis invariants checkable:
//   • MARKER_A ("Reykjavik") lives ONLY in A  — must survive.
//   • MARKER_B ("BrightSmile") lives ONLY in B — must survive.
//   • SHARED_MARKER ("SEC-2031") appears VERBATIM in BOTH — must be UNIFIED into
//     one node, not duplicated as two near-identical siblings.
// The two files carry the SAME title (no "Draft A/B" labels) so a source-labelled
// separation heading can only come from the model wrongly splitting by source. ──
const MARKER_A = 'Reykjavik';
const MARKER_B = 'BrightSmile';
const SHARED_MARKER = 'SEC-2031';

const OUTLINE_A = `Northwind Robotics Employee Handbook
- Working Hours: Core hours are 10am to 4pm with flexible edges.
- Remote Work: Staff may work remotely up to three days a week.
- Time Off: Twenty paid vacation days per year plus public holidays.
- Safety: All staff complete the SEC-2031 safety certification each January.
- Team Events: The Q3 company offsite is held in Reykjavik, Iceland.
- Expenses: Reimbursed within 30 days of a submitted receipt.`;

const OUTLINE_B = `Northwind Robotics Employee Handbook
- Working Hours: Core collaboration hours run 10am to 4pm.
- Remote Work: Up to three remote days weekly are permitted.
- Time Off: Employees accrue twenty days of paid leave annually.
- Safety: All staff complete the SEC-2031 safety certification each January.
- Health Benefits: The company dental plan is provided by BrightSmile Corp.
- Expenses: Submit receipts for reimbursement within one month.`;

// Mirrors the app's shipping MERGE prompt — the "SYNTHESIZE: Deep merge into
// unified outline" path in organizeBulletsIntoOutline (src/app/actions.ts, the
// deep-merge branch of the Research & Import flow). The four directives below are
// the SAME four the app now sends: synthesize ALL sources into ONE integrated
// outline, integrate overlapping ideas into a single entry (never duplicate),
// never organize/label by source, and preserve EVERY fact (drop nothing). Keeping
// this in lockstep with actions.ts is what makes the test guard live behavior; if
// the app's prompt changes, update this to match.
function mergePrompt(a, b) {
  return `You are a researcher weaving facts from MULTIPLE SOURCES into ONE unified, coherent outline — the way a good researcher integrates several references into a single paper.

SOURCE 1:
"""
${a}
"""

SOURCE 2:
"""
${b}
"""

DO THIS:
- Synthesize ALL of these facts into ONE integrated outline about the topic — not a collection of per-source summaries.
- INTEGRATE overlapping ideas into a single entry. If two facts say the same thing, state it ONCE — never duplicate it as two entries.
- Do NOT organize the outline by source. Never label any section by which document it came from ("Source A", "Document 2", "From the first source"). A reader must not be able to tell how many sources were used.
- PRESERVE EVERY FACT from every source. Merging removes duplication, never information — if only one source states something, KEEP it. Drop nothing.

Write the single unified outline now:`;
}

// ── Invariant 1: both unique facts survived the merge (no lost knowledge). ──
function assertBothMarkersPresent(merged, markerA, markerB, label = 'merged outline') {
  assertNonEmpty(merged, label);
  const hay = merged.toLowerCase();
  const hasA = hay.includes(markerA.toLowerCase());
  const hasB = hay.includes(markerB.toLowerCase());
  if (!hasA && !hasB) {
    fail(`${label} LOST BOTH unique facts ("${markerA}" and "${markerB}") — collective knowledge not preserved`);
  }
  if (!hasA) fail(`${label} LOST source A's unique fact ("${markerA}") — knowledge dropped in merge`);
  if (!hasB) fail(`${label} LOST source B's unique fact ("${markerB}") — knowledge dropped in merge`);
  return true;
}

// ── Invariant 2: the overlapping fact is UNIFIED, not duplicated. The shared
// marker appears VERBATIM in both sources; a concatenation reproduces it in two
// near-identical sibling nodes, a true synthesis weaves it into ONE. So it must
// appear (topic preserved) but on no more than a single line/node. ──────────
function assertOverlapUnified(merged, shared, label = 'merged outline') {
  const lines = merged.split(/\r?\n/).filter((l) => l.toLowerCase().includes(shared.toLowerCase()));
  if (lines.length === 0) {
    fail(`${label} dropped the shared fact ("${shared}") that BOTH sources stated — knowledge lost`);
  }
  if (lines.length > 1) {
    fail(`${label} DUPLICATED the shared fact ("${shared}") across ${lines.length} sibling nodes — the overlap was concatenated, not unified into one woven statement`);
  }
  return true;
}

// ── Invariant 3: no source-labelled separation structure. The merge must not be
// organized by which source an idea came from. ──────────────────────────────
const SEPARATION_RE =
  /\bsource\s*[ab12]\b|\bdocument\s*[12]\b|from the (first|second)\s+(outline|source|document|handbook|draft)|\boutline\s*[ab12]\b|\bdraft\s*[ab]\b|\bhandbook\s*[ab12]\b/i;
function assertNoSourceSeparation(merged, label = 'merged outline') {
  const m = merged.match(SEPARATION_RE);
  if (m) {
    fail(`${label} split into a SOURCE-LABELLED section ("${m[0]}") — a synthesis integrates references, it is not organized by which source each idea came from`);
  }
  return true;
}

async function main() {
  if (!(await ollamaUp())) {
    record('ollama_available', false, 'Ollama/gemma4 not reachable on :11434 — SKIPPED (environmental)');
    finish(true, 'SKIPPED — local AI not available');
    return;
  }
  record('ollama_available', true, MODEL);

  // MERGE is a conceptual synthesis preserving collective knowledge, 5×.
  const merge = await repeat(REPEATS, async () => {
    const merged = await generate(mergePrompt(OUTLINE_A, OUTLINE_B));
    // INVARIANTS (must hold for EVERY run):
    assertNonEmpty(merged, 'merged outline');                                  // well-formed
    assertBothMarkersPresent(merged, MARKER_A, MARKER_B, 'merged outline');    // no lost knowledge
    assertOverlapUnified(merged, SHARED_MARKER, 'merged outline');             // overlap woven into one
    assertNoSourceSeparation(merged, 'merged outline');                        // not organized by source
    // On-device only — the merge ran on the local model; the company key was
    // never surfaced (financial-safety: an on-device merge must cost $0).
    assertCompanyKeyNotUsed('ollama', COMPANY_KEY, 'on-device merge');
    return merged.length;
  });
  record('merge_synthesizes_both_sources_5x', merge.ok, merge.summary);

  const anyFail = results.some((r) => !r.pass);
  finish(!anyFail);
}

function finish(pass, note = '') {
  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  const md = [
    '# Merge Content Test (nondeterministic tier)',
    '',
    `Result: ${pass ? 'PASS' : 'FAIL'} (${passed}/${results.length}) ${note}`,
    '',
    'Guards that the Research & Import MERGE is a CONCEPTUAL SYNTHESIS: it preserves',
    "both sources' unique facts, unifies overlapping ideas into one woven node, and",
    'is not organized by which source each idea came from.',
    '',
    '| Check | Result | Detail |',
    '| --- | --- | --- |',
    ...results.map((r) => `| ${r.name} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.detail.replace(/\n/g, ' ')} |`),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), md);
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'),
    JSON.stringify({ passed, failed, total: results.length, results, note }, null, 2));
  console.log(md);
  if (pass) {
    console.log(`\nMERGE CONTENT: PASS — ${REPEATS}× merges synthesized both sources without loss or duplication (or skipped: ${note}).`);
    process.exit(0);
  } else {
    console.log(`\nMERGE CONTENT: FAIL — a merge lost, duplicated, or source-split content across ${REPEATS} runs.`);
    process.exit(1);
  }
}

main().catch((e) => {
  record('suite_crashed', false, e instanceof Error ? e.message : String(e));
  finish(false);
});
