/**
 * Runtime probe for the ALWAYS-ON HALLUCINATION VERIFIER core.
 *
 * Drives the REAL verifier logic (src/lib/ai/hallucination-verifier.ts) with a
 * FAKE on-device generate function, proving:
 *   - it FLAGS a claim the source does not support,
 *   - a CLEAN output passes (no flags),
 *   - it runs a SINGLE on-device pass (never loops),
 *   - it DEGRADES gracefully when on-device AI is absent (ran:false),
 *   - it never spends cloud AI (the generate fn is injected — no Gemini/meter).
 *
 * Prints `CHECK <name> PASS|FAIL` lines and `PROBE_DONE`, mirroring the
 * cost-guardrails probe contract so the JS runner can parse it.
 */
import {
  analyzeVerification,
  verifyAgainstSource,
  type VerifyDeps,
} from '../src/lib/ai/hallucination-verifier';

function check(name: string, pass: boolean, detail = ''): void {
  console.log(`CHECK ${name} ${pass ? 'PASS' : 'FAIL'} ${detail}`.trim());
}

async function main() {
  const source =
    '- Q3 Report\n  Revenue grew this quarter.\n  The team shipped the new editor.';
  // An output that INVENTS a specific figure not present in the source.
  const dirtyOutput =
    'We raised $5 million in Series A funding and grew revenue 300% this quarter.';
  const cleanOutput = 'Revenue grew this quarter and the team shipped the new editor.';

  // --- pure parser -----------------------------------------------------------
  const parsedFlag = analyzeVerification(
    JSON.stringify({
      suspectClaims: [
        { claim: '$5 million in Series A funding', reason: 'not in the source' },
      ],
      correctedText: 'Revenue grew this quarter.',
    }),
  );
  check(
    'analyze_flags_unsupported',
    parsedFlag.ok && parsedFlag.suspectClaims.length === 1 && !!parsedFlag.correctedText,
    `claims=${parsedFlag.suspectClaims.length}`,
  );

  const parsedClean = analyzeVerification(JSON.stringify({ suspectClaims: [] }));
  check(
    'analyze_clean_passes',
    parsedClean.ok && parsedClean.suspectClaims.length === 0,
    `claims=${parsedClean.suspectClaims.length}`,
  );

  // --- orchestration with a FAKE on-device model -----------------------------
  let flagCalls = 0;
  const flagDeps: VerifyDeps = {
    isAvailable: async () => true,
    generate: async () => {
      flagCalls++;
      return JSON.stringify({
        suspectClaims: [{ claim: '$5 million in Series A funding', reason: 'invented figure' }],
      });
    },
    modelName: async () => 'gemma4:e4b',
  };
  const flagged = await verifyAgainstSource(
    { source, output: dirtyOutput, kind: 'social post' },
    flagDeps,
  );
  check(
    'verify_flags_unsupported',
    flagged.ran === true && flagged.suspectClaims.length >= 1,
    `ran=${flagged.ran} claims=${flagged.suspectClaims.length}`,
  );
  check('verify_single_pass', flagCalls === 1, `generate_calls=${flagCalls}`);

  const cleanDeps: VerifyDeps = {
    isAvailable: async () => true,
    generate: async () => JSON.stringify({ suspectClaims: [] }),
    modelName: async () => 'gemma4:e4b',
  };
  const clean = await verifyAgainstSource({ source, output: cleanOutput }, cleanDeps);
  check(
    'verify_clean_passes',
    clean.ran === true && clean.suspectClaims.length === 0,
    `ran=${clean.ran} claims=${clean.suspectClaims.length}`,
  );

  // --- graceful degradation when on-device AI is absent ----------------------
  let degradeCalls = 0;
  const degradeDeps: VerifyDeps = {
    isAvailable: async () => false, // e.g. web / iOS with no Ollama
    generate: async () => {
      degradeCalls++;
      return '{}';
    },
  };
  const degraded = await verifyAgainstSource({ source, output: dirtyOutput }, degradeDeps);
  check(
    'verify_degrades_no_ondevice',
    degraded.ran === false &&
      degraded.skippedReason === 'no-on-device' &&
      degraded.suspectClaims.length === 0,
    `ran=${degraded.ran} reason=${degraded.skippedReason}`,
  );
  // Crucially, it must NOT have tried to generate anything when on-device is
  // absent — which also means it never reaches for any cloud fallback.
  check('verify_no_generate_when_absent', degradeCalls === 0, `generate_calls=${degradeCalls}`);

  // --- never throws even if the model errors ---------------------------------
  const throwDeps: VerifyDeps = {
    isAvailable: async () => true,
    generate: async () => {
      throw new Error('model exploded');
    },
  };
  const errored = await verifyAgainstSource({ source, output: dirtyOutput }, throwDeps);
  check(
    'verify_error_fails_safe',
    errored.ran === false && errored.suspectClaims.length === 0,
    `ran=${errored.ran} reason=${errored.skippedReason}`,
  );

  console.log('PROBE_DONE');
}

main().catch((e) => {
  console.log(`PROBE_ERROR ${e instanceof Error ? e.message : String(e)}`);
  console.log('PROBE_DONE');
});
