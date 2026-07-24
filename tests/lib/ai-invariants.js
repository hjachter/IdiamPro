// tests/lib/ai-invariants.js
//
// Shared helpers for testing NONDETERMINISTIC / AI-driven output.
//
// An LLM gives different text every run, so a single sample proves nothing and
// exact-match assertions are brittle. Instead we run each AI test N times and
// assert INVARIANTS — properties that must hold for EVERY run, no matter what
// the model wrote:
//
//   • nonEmpty / well-formed   — the model actually produced usable output
//   • withinLimit(text, max)   — it respects hard limits (e.g. a tweet ≤ 280)
//   • forbidden-thing guards   — it NEVER does the dangerous thing:
//       - never billed our company AI key on a no-user-key path
//       - never auto-sent / auto-posted anything
//       - the verifier catches a planted unsupported claim
//
// repeat(n, fn) runs fn N times (default 5) and FAILS if ANY iteration throws
// or violates an invariant — that is how flaky / drift bugs surface.
//
// Every assertion throws an InvariantError on violation; the caller (a suite or
// the top-level runner) catches it and records a FAIL.

class InvariantError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvariantError';
  }
}

function fail(msg) {
  throw new InvariantError(msg);
}

// ---------------------------------------------------------------------------
// repeat — the N-times runner for nondeterministic tests.
// ---------------------------------------------------------------------------
// Runs `fn(iterationIndex)` `n` times. Collects a per-iteration result. If ANY
// iteration throws (including an InvariantError), the whole thing is a FAIL and
// the first failing iteration's error is surfaced. Returns a summary object.
async function repeat(n, fn) {
  const count = Number.isFinite(n) && n > 0 ? Math.floor(n) : 5;
  const iterations = [];
  let firstError = null;
  for (let i = 0; i < count; i++) {
    try {
      const value = await fn(i);
      iterations.push({ i, ok: true, value });
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      iterations.push({ i, ok: false, error: detail });
      if (!firstError) firstError = { i, detail };
    }
  }
  const passed = iterations.filter((r) => r.ok).length;
  const ok = passed === count;
  return {
    ok,
    total: count,
    passed,
    failed: count - passed,
    iterations,
    firstError,
    // Convenience message for a scorecard row.
    summary: ok
      ? `${passed}/${count} runs held all invariants`
      : `${passed}/${count} runs held invariants — run #${firstError.i} violated: ${firstError.detail}`,
  };
}

// ---------------------------------------------------------------------------
// INVARIANT assertions.
// ---------------------------------------------------------------------------

// The output must be a non-empty, well-formed string with real content.
function assertNonEmpty(text, label = 'output') {
  if (typeof text !== 'string') fail(`${label} is not a string (got ${typeof text})`);
  if (text.trim().length === 0) fail(`${label} is empty / whitespace only`);
  // Guard against the model returning a bare error / refusal sentinel.
  if (/^\s*(undefined|null|\[object Object\])\s*$/i.test(text)) {
    fail(`${label} is a non-answer sentinel: ${JSON.stringify(text.slice(0, 40))}`);
  }
  return true;
}

// The output must fit a hard character budget (e.g. an X/Twitter post ≤ 280).
function assertWithinLimit(text, max, label = 'output') {
  assertNonEmpty(text, label);
  const len = [...text.trim()].length; // count code points, not UTF-16 units
  if (len > max) fail(`${label} is ${len} chars, over the ${max} limit`);
  return len;
}

// Well-formed JSON (many AI flows must return parseable JSON). Returns parsed.
function assertParsesJson(text, label = 'output') {
  assertNonEmpty(text, label);
  const cleaned = String(text).replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    fail(`${label} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ---- Forbidden-thing guards ------------------------------------------------

// A no-user-key / on-device path must NEVER have touched our company AI key.
// Pass whatever the code path reports it used (a key string, provider name, or
// a boolean flag). This asserts the company key value was not the one used.
function assertCompanyKeyNotUsed(usedKeyOrProvider, companyKey, label = 'path') {
  if (companyKey && usedKeyOrProvider === companyKey) {
    fail(`${label} billed the COMPANY AI key on a path that must not — financial-safety breach`);
  }
  // Also reject any obvious cloud-provider marker on an on-device path.
  if (/gemini|googleai|google-generative|company/i.test(String(usedKeyOrProvider || ''))) {
    fail(`${label} reached a cloud/company provider (${usedKeyOrProvider}) — must stay on-device`);
  }
  return true;
}

// Nothing may have been auto-sent / auto-posted. Pass the side-effect log the
// flow exposes (e.g. an array of network posts, or booleans). Must be empty.
function assertNothingAutoSent(sideEffects, label = 'flow') {
  const list = Array.isArray(sideEffects) ? sideEffects : sideEffects ? [sideEffects] : [];
  if (list.length > 0) {
    fail(`${label} performed ${list.length} auto-send/post side effect(s) — must require explicit user action`);
  }
  return true;
}

// The verifier must have flagged a PLANTED unsupported claim. Pass the verifier
// result ({ ran, suspectClaims }). If it ran, it must have caught ≥1 claim.
function assertVerifierCaught(result, label = 'verifier') {
  if (!result || typeof result !== 'object') fail(`${label} returned no result`);
  if (result.ran === false) {
    // On-device model absent: verifier legitimately degrades. Not a violation,
    // but the caller should know it did not actually run.
    return { ran: false };
  }
  const claims = Array.isArray(result.suspectClaims) ? result.suspectClaims : [];
  if (claims.length < 1) fail(`${label} ran but did NOT flag the planted unsupported claim`);
  return { ran: true, claims: claims.length };
}

// Junk / low-value input must be QUARANTINED, not deleted. Pass what the flow
// did with the item ('quarantined' | 'deleted' | ...). Deleting is a violation.
function assertQuarantinedNotDeleted(disposition, label = 'junk item') {
  if (String(disposition).toLowerCase() === 'deleted') {
    fail(`${label} was DELETED — junk must be quarantined/set-aside, never destroyed`);
  }
  return true;
}

module.exports = {
  InvariantError,
  repeat,
  assertNonEmpty,
  assertWithinLimit,
  assertParsesJson,
  assertCompanyKeyNotUsed,
  assertNothingAutoSent,
  assertVerifierCaught,
  assertQuarantinedNotDeleted,
};
