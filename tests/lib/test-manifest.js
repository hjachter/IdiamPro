// tests/lib/test-manifest.js
//
// TEST TIER MANIFEST — tags each suite so the top-level runner (tests/run-all.js)
// can apply the tiered strategy codified in CLAUDE.md (2026-07-24):
//
//   • 'deterministic'    — routing, rendering, pure logic, UI structure, and
//                          meter MATH driven by a FAKE model. Run ONCE (a second
//                          identical pass is pure duplication).
//   • 'nondeterministic' — output comes from a REAL LLM (local Ollama and/or the
//                          cloud model): generation, summarize, voice, social,
//                          inbound extraction, the live verifier. Run 5× and
//                          assert INVARIANTS, not exact text — ANY of the 5
//                          violating fails it. This is how drift/flake surfaces.
//   • 'guardrail'        — financial-safety / privacy / auth. Run ADVERSARIALLY
//                          (the suite itself carries the hostile cases). RELEASE
//                          BLOCKER; the runner calls out the financial result.
//
// Fields per entry:
//   file      — path relative to the repo root.
//   tier      — one of the three above.
//   repeats   — how many times the runner executes it (nondeterministic ⇒ 5).
//   fast      — included in the quick `--fast` verification subset.
//   blocker   — a failure here blocks release (guardrails).
//   selfRepeats — the suite already loops internally (don't multiply on top).
//   note      — human context.
//
// Suites NOT listed here still exist and can be run directly; the runner focuses
// on the tier-representative set. Add new AI suites under 'nondeterministic'.

const REPEATS_AI = 5;

const MANIFEST = [
  // ── GUARDRAILS — release blockers, adversarial, financial-safety ──────────
  {
    file: 'tests/cost-guardrails-test.js',
    tier: 'guardrail',
    repeats: 1,
    fast: true,
    blocker: true,
    financialSafety: true,
    note: 'Server-side AI meter is fail-closed; hostile bypass attempts (forged dev, second-wave, unknown tier, empty user, parallel burst) all blocked.',
  },

  // ── NONDETERMINISTIC — real LLM output, run 5× with invariants ────────────
  {
    file: 'tests/ai-invariants-test.js',
    tier: 'nondeterministic',
    repeats: 1, // self-repeats 5× internally via lib/ai-invariants.repeat
    selfRepeats: true,
    fast: true,
    note: 'Local model: generation stays non-empty/≤280/on-device; verifier catches a planted lie — asserted 5× internally.',
  },
  { file: 'tests/gemma4-smoke-test.js', tier: 'nondeterministic', repeats: REPEATS_AI, note: 'Local Gemma / on-device AI smoke.' },
  { file: 'tests/wizards-test.js', tier: 'nondeterministic', repeats: REPEATS_AI, note: 'AI outline wizards.' },
  { file: 'tests/summarize-outline-test.js', tier: 'nondeterministic', repeats: REPEATS_AI, note: 'AI summarize.' },
  { file: 'tests/digest-label-test.js', tier: 'nondeterministic', repeats: REPEATS_AI, note: 'AI digest.' },
  { file: 'tests/voice-test.js', tier: 'nondeterministic', repeats: REPEATS_AI, note: 'Your Voice generation.' },
  { file: 'tests/share-to-x-test.js', tier: 'nondeterministic', repeats: REPEATS_AI, note: 'X/Twitter post generation (≤280).' },
  { file: 'tests/email-import-test.js', tier: 'nondeterministic', repeats: REPEATS_AI, note: 'Inbound extraction / junk quarantined-not-deleted.' },
  { file: 'tests/reformat-with-ai-test.js', tier: 'nondeterministic', repeats: REPEATS_AI, note: 'AI reformat.' },

  // ── DETERMINISTIC — routing / rendering / structure, run ONCE ─────────────
  { file: 'tests/verifier-test.js', tier: 'deterministic', repeats: 1, fast: true, note: 'Verifier core driven by a FAKE model — deterministic contract.' },
  { file: 'tests/allowance-cap-prompt-test.js', tier: 'deterministic', repeats: 1, note: 'Three-door cap prompt renders + dismissible. (Full-run only — Electron; excluded from --fast.)' },
  { file: 'tests/electron-test.js', tier: 'deterministic', repeats: 1, note: 'Core feature / UI suite.' },
  { file: 'tests/outline-sort-test.js', tier: 'deterministic', repeats: 1, note: 'Sort ordering logic.' },
  { file: 'tests/theme-responsive-test.js', tier: 'deterministic', repeats: 1, note: 'Theme + responsive layout.' },
];

module.exports = {
  MANIFEST,
  REPEATS_AI,
  byTier: (tier) => MANIFEST.filter((m) => m.tier === tier),
  fastSet: () => MANIFEST.filter((m) => m.fast),
};
