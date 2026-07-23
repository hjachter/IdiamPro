/**
 * Behavioral probe for the company-key COST guardrails (SAFETY STOPGAP).
 *
 * Loads the REAL server modules and proves, at runtime, that with NO user
 * (BYOK) key and the company-text fallback OFF (the default), a cloud text call
 * can NEVER reach the app's own (company/founder) API key.
 *
 * Run via: npx tsx tests/cost-guardrails.probe.ts
 * Prints one `CHECK <name> PASS|FAIL <detail>` line per assertion. The JS
 * harness (cost-guardrails-test.js) parses these lines.
 */

import { isCompanyTextFallbackEnabled, isNoCompanyKeyError } from '@/lib/billing/company-text-fallback';
import { resolveApiKey, requireApiKey } from '@/lib/byok-keys';
import { runAIWithFailover, AIFailoverError } from '@/lib/ai-failover';

function check(name: string, pass: boolean, detail: string = '') {
  console.log(`CHECK ${name} ${pass ? 'PASS' : 'FAIL'} ${detail}`);
}

async function main() {
  // Simulate production reality: our company key IS present in the environment.
  // The whole point is that it must NOT be used on the no-user-key path.
  process.env.GEMINI_API_KEY = 'COMPANY_SECRET_KEY_SHOULD_NEVER_BE_USED';
  process.env.GOOGLE_API_KEY = 'COMPANY_SECRET_KEY_SHOULD_NEVER_BE_USED';
  // Ensure the fallback flag is OFF (default).
  delete process.env.ALLOW_COMPANY_TEXT_FALLBACK;

  // 1. Flag defaults to OFF.
  check('flag_default_off', isCompanyTextFallbackEnabled() === false,
    `enabled=${isCompanyTextFallbackEnabled()}`);

  // 2. No user key + company key present in env → resolver returns null
  //    (the company key is UNREACHABLE on the no-key path).
  const r1 = resolveApiKey('gemini', null);
  check('resolve_nokey_returns_null', r1 === null, `got=${JSON.stringify(r1)}`);

  // 3. The user's OWN key is still honored (BYOK preserved).
  const r2 = resolveApiKey('gemini', 'user-byok-123');
  check('resolve_userkey_preserved', r2 === 'user-byok-123', `got=${JSON.stringify(r2)}`);

  // 4. requireApiKey throws a friendly NoCompanyKeyError on the no-key path.
  let threw = false, friendly = false;
  try { requireApiKey('gemini', null); }
  catch (e) { threw = true; friendly = isNoCompanyKeyError(e); }
  check('requirekey_throws_friendly', threw && friendly, `threw=${threw} friendly=${friendly}`);

  // 5. STRONGEST PROOF: runAIWithFailover must NEVER invoke the cloud attempt
  //    when the fallback is off — even if the (untrusted) client claims BYOK.
  let cloudCalled = false;
  let localCalled = false;
  let failoverErr: unknown = null;
  let result: any = null;
  try {
    result = await runAIWithFailover({
      provider: 'cloud',
      cloudKeyIsByok: true, // deliberately claim BYOK — must be ignored by the gate
      cloudProviderName: 'Gemini',
      cloudAttempt: async () => { cloudCalled = true; return 'COMPANY_KEY_ANSWER'; },
      localAttempt: async () => { localCalled = true; return 'LOCAL_ANSWER'; },
    });
  } catch (e) {
    failoverErr = e;
  }
  // The hard guarantee: the company-key cloud attempt was never run.
  check('failover_cloud_never_called', cloudCalled === false, `cloudCalled=${cloudCalled}`);
  // And we either answered on-device or returned the friendly disabled error.
  const wentLocal = localCalled && result && result.answeredBy === 'local';
  const friendlyFail = failoverErr instanceof AIFailoverError && (failoverErr as AIFailoverError).companyKeyDisabled === true;
  check('failover_local_or_friendly', Boolean(wentLocal || friendlyFail),
    `wentLocal=${wentLocal} friendlyFail=${friendlyFail}`);

  // 6. Re-enable switch works: with the flag ON, the company env key becomes
  //    reachable again (this is what the future server-side meter will gate).
  process.env.ALLOW_COMPANY_TEXT_FALLBACK = 'true';
  const r3 = resolveApiKey('gemini', null);
  check('reenable_switch_works', r3 === 'COMPANY_SECRET_KEY_SHOULD_NEVER_BE_USED',
    `got=${JSON.stringify(r3)}`);
  delete process.env.ALLOW_COMPANY_TEXT_FALLBACK;

  console.log('PROBE_DONE');
}

main().catch((e) => {
  console.log(`CHECK probe_crashed FAIL ${e instanceof Error ? e.message : String(e)}`);
  console.log('PROBE_DONE');
  process.exit(1);
});
