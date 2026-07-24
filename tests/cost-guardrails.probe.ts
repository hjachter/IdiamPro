/**
 * Behavioral probe for the SERVER-SIDE AI USAGE METER cost guardrails.
 *
 * Loads the REAL server modules and proves, at runtime, the financial-safety
 * guarantees of the per-account, atomic, monthly company-AI text meter:
 *
 *   (i)   a free / no-key / signed-out user CANNOT reach the company key
 *         (fail-closed);
 *   (ii)  a user OVER their allowance is blocked server-side and a direct call
 *         cannot bypass it;
 *   (iii) the meter is CONCURRENCY-SAFE — many parallel over-limit requests let
 *         only `allowance`-many through;
 *   (iv)  BYOK routes to the USER's key, never ours;
 *   (v)   the internal developer allowlist works.
 *
 * Run via: npx tsx tests/cost-guardrails.probe.ts
 * Prints one `CHECK <name> PASS|FAIL <detail>` line per assertion, then
 * PROBE_DONE. The JS harness (cost-guardrails-test.js) parses these lines.
 */

import type { SubscriptionTierId } from '@/config/subscription-tiers';
import { resolveApiKey, requireApiKey } from '@/lib/byok-keys';
import { isNoCompanyKeyError } from '@/lib/billing/company-text-fallback';
import {
  evaluateCompanyTextAccess,
  isInternalDevIdentity,
  getInternalDevEmails,
  AI_TEXT_ALLOWANCES,
  type MeterIdentity,
  type MeterDeps,
} from '@/lib/billing/ai-usage-meter';

const COMPANY_KEY = 'COMPANY_SECRET_KEY_SHOULD_NEVER_BE_USED';

function check(name: string, pass: boolean, detail: string = '') {
  console.log(`CHECK ${name} ${pass ? 'PASS' : 'FAIL'} ${detail}`);
}

/**
 * Atomic in-memory counter. The read+write happen synchronously with NO await
 * in between, so in single-threaded JS this is genuinely atomic — it models the
 * production Redis INCR (see storage adapter kv.incr) that the real meter uses.
 */
function makeAtomicStore() {
  const m = new Map<string, number>();
  return {
    increment: async (key: string): Promise<number> => {
      const n = (m.get(key) ?? 0) + 1;
      m.set(key, n);
      return n;
    },
  };
}

async function main() {
  // Production reality: our company key IS present in the environment. The whole
  // point is that it must NOT be reachable except through the allowed paths.
  process.env.GEMINI_API_KEY = COMPANY_KEY;
  process.env.GOOGLE_API_KEY = COMPANY_KEY;
  delete process.env.ALLOW_COMPANY_TEXT_FALLBACK;

  // Use a small, tunable allowance for the over-cap / concurrency proofs so we
  // don't have to fire thousands of requests. (Mutating a property of the
  // exported config object; the real launch numbers live in the module.)
  const ALLOWANCE = 5;
  AI_TEXT_ALLOWANCES.pro = ALLOWANCE;

  // ---- (iv) BYOK routes to the USER's key, never ours --------------------
  const userKey = resolveApiKey('gemini', 'user-byok-xyz');
  const notCompanyKey = String(userKey) !== COMPANY_KEY;
  check(
    'byok_routes_to_user_key',
    userKey === 'user-byok-xyz' && notCompanyKey,
    `got=${JSON.stringify(userKey)}`,
  );

  // ---- (i) no user key + fallback off → company key UNREACHABLE ------------
  const noKey = resolveApiKey('gemini', null);
  check('nokey_returns_null_failclosed', noKey === null, `got=${JSON.stringify(noKey)}`);

  let threw = false;
  let friendly = false;
  try {
    requireApiKey('gemini', null);
  } catch (e) {
    threw = true;
    friendly = isNoCompanyKeyError(e);
  }
  check('requirekey_throws_friendly', threw && friendly, `threw=${threw} friendly=${friendly}`);

  // ---- Identities ---------------------------------------------------------
  const devEmail = getInternalDevEmails()[0];
  const dev: MeterIdentity = {
    userId: 'user_dev',
    emails: [devEmail],
    isDev: isInternalDevIdentity('user_dev', [devEmail]),
  };
  const nonDev: MeterIdentity = {
    userId: 'user_free',
    emails: ['nobody@example.com'],
    isDev: false,
  };
  const signedOut: MeterIdentity = { userId: null, emails: [], isDev: false };

  const depsUnverified: MeterDeps = {
    areSubscriptionsVerified: () => false,
    resolvePlan: async () => 'pro',
    increment: makeAtomicStore().increment,
  };
  const depsVerifiedFree: MeterDeps = {
    areSubscriptionsVerified: () => true,
    resolvePlan: async () => 'free',
    increment: makeAtomicStore().increment,
  };

  // ---- (v) internal dev allowlist works -----------------------------------
  const devDecision = await evaluateCompanyTextAccess(dev, {}, depsUnverified);
  check(
    'dev_allowlist_allowed',
    devDecision.allowed && devDecision.fund === 'company' && devDecision.reason === 'dev-allowlist',
    JSON.stringify(devDecision),
  );

  // ---- (iv-b) BYOK at the meter never uses the company key ----------------
  const byokDecision = await evaluateCompanyTextAccess(nonDev, { isByok: true }, depsUnverified);
  check(
    'meter_byok_never_company',
    byokDecision.allowed && byokDecision.fund === 'byok',
    JSON.stringify(byokDecision),
  );

  // ---- (i) free / signed-out / unverified are all BLOCKED (fail-closed) ---
  const unverified = await evaluateCompanyTextAccess(nonDev, {}, depsUnverified);
  check(
    'nondev_unverified_blocked',
    !unverified.allowed && unverified.fund === null,
    JSON.stringify(unverified),
  );

  const freeVerified = await evaluateCompanyTextAccess(nonDev, {}, depsVerifiedFree);
  check(
    'verified_free_blocked',
    !freeVerified.allowed && freeVerified.reason === 'free-tier',
    JSON.stringify(freeVerified),
  );

  const signedOutDecision = await evaluateCompanyTextAccess(signedOut, {}, {
    areSubscriptionsVerified: () => true,
    resolvePlan: async () => 'pro',
    increment: makeAtomicStore().increment,
  });
  check(
    'signedout_blocked',
    !signedOutDecision.allowed && signedOutDecision.reason === 'signed-out',
    JSON.stringify(signedOutDecision),
  );

  // ---- (ii) OVER allowance is blocked; direct call cannot bypass ----------
  {
    const store = makeAtomicStore();
    const paid: MeterIdentity = { userId: 'user_paidA', emails: ['a@x.com'], isDev: false };
    const deps: MeterDeps = {
      areSubscriptionsVerified: () => true,
      resolvePlan: async () => 'pro',
      increment: store.increment,
    };
    let allowedCount = 0;
    let lastBlockedReason = '';
    // Fire ALLOWANCE + 3 sequential requests. Only ALLOWANCE may pass.
    for (let i = 0; i < ALLOWANCE + 3; i++) {
      const d = await evaluateCompanyTextAccess(paid, {}, deps);
      if (d.allowed) allowedCount++;
      else lastBlockedReason = d.reason;
    }
    check(
      'over_allowance_blocked',
      allowedCount === ALLOWANCE && lastBlockedReason === 'over-allowance',
      `allowed=${allowedCount} expected=${ALLOWANCE} lastReason=${lastBlockedReason}`,
    );
  }

  // ---- (iii) CONCURRENCY-SAFE — only allowance-many parallel wins ---------
  {
    const store = makeAtomicStore();
    const paid: MeterIdentity = { userId: 'user_paidB', emails: ['b@x.com'], isDev: false };
    const deps: MeterDeps = {
      areSubscriptionsVerified: () => true,
      resolvePlan: async () => 'pro',
      increment: store.increment,
    };
    const BURST = ALLOWANCE + 25;
    const results = await Promise.all(
      Array.from({ length: BURST }, () => evaluateCompanyTextAccess(paid, {}, deps)),
    );
    const allowed = results.filter((r) => r.allowed).length;
    check(
      'concurrency_safe',
      allowed === ALLOWANCE,
      `parallel=${BURST} allowed=${allowed} expected=${ALLOWANCE}`,
    );
  }

  // ---- fail-closed on a broken counter (stub-style "cannot count") --------
  {
    const paid: MeterIdentity = { userId: 'user_paidC', emails: ['c@x.com'], isDev: false };
    const deps: MeterDeps = {
      areSubscriptionsVerified: () => true,
      resolvePlan: async () => 'pro',
      // Simulate the stub backend which returns MAX_SAFE_INTEGER (cannot count).
      increment: async () => Number.MAX_SAFE_INTEGER,
    };
    const d = await evaluateCompanyTextAccess(paid, {}, deps);
    check('uncountable_fails_closed', !d.allowed, JSON.stringify(d));
  }

  // ========================================================================
  // ADVERSARIAL / HOSTILE cases — bypass attempts, not happy paths.
  // ========================================================================

  // ---- (A) FORGED dev claim: an attacker who is NOT on the allowlist -------
  // isDev is NOT a client-trusted boolean — it is computed server-side by
  // isInternalDevIdentity from the account's real Clerk emails. An attacker who
  // supplies a random email must resolve isDev=false and be BLOCKED, even if
  // they *try* to look like an internal dev.
  {
    const attackerEmails = ['attacker@evil.example', 'devs@not-us.example'];
    const forgedIsDev = isInternalDevIdentity('user_attacker', attackerEmails);
    const attacker: MeterIdentity = {
      userId: 'user_attacker',
      emails: attackerEmails,
      isDev: forgedIsDev, // computed by the real allowlist, not asserted by them
    };
    const d = await evaluateCompanyTextAccess(attacker, {}, depsUnverified);
    check(
      'forged_dev_email_rejected',
      forgedIsDev === false && !d.allowed,
      `forgedIsDev=${forgedIsDev} decision=${JSON.stringify(d)}`,
    );
  }

  // ---- (B) SECOND-WAVE bypass: exhaust the cap, then attack again ----------
  // A user who burned their whole monthly allowance cannot reset it by simply
  // trying again in the same period — the atomic counter persists, so wave 2
  // lets ZERO extra calls through.
  {
    const store = makeAtomicStore();
    const paid: MeterIdentity = { userId: 'user_secondwave', emails: ['sw@x.com'], isDev: false };
    const deps: MeterDeps = {
      areSubscriptionsVerified: () => true,
      resolvePlan: async () => 'pro',
      increment: store.increment,
    };
    let wave1 = 0;
    for (let i = 0; i < ALLOWANCE; i++) {
      if ((await evaluateCompanyTextAccess(paid, {}, deps)).allowed) wave1++;
    }
    // Wave 2: hammer it again — must all be blocked (same period, same counter).
    let wave2Allowed = 0;
    for (let i = 0; i < ALLOWANCE + 5; i++) {
      if ((await evaluateCompanyTextAccess(paid, {}, deps)).allowed) wave2Allowed++;
    }
    check(
      'cap_persists_second_wave',
      wave1 === ALLOWANCE && wave2Allowed === 0,
      `wave1=${wave1} wave2Allowed=${wave2Allowed}`,
    );
  }

  // ---- (C) FORGED / UNKNOWN tier id can't unlock the company key -----------
  // If a bogus tier that isn't in AI_TEXT_ALLOWANCES is somehow resolved, the
  // limit defaults to 0 and the request is BLOCKED (fail-closed), never granted.
  {
    const paid: MeterIdentity = { userId: 'user_bogustier', emails: ['bt@x.com'], isDev: false };
    const deps = {
      areSubscriptionsVerified: () => true,
      // Cast a nonsense tier through — models an attacker-forged/unknown plan.
      resolvePlan: async () => 'ENTERPRISE_HACK' as unknown as SubscriptionTierId,
      increment: makeAtomicStore().increment,
    } as unknown as MeterDeps;
    const d = await evaluateCompanyTextAccess(paid, {}, deps);
    check('unknown_tier_fails_closed', !d.allowed, JSON.stringify(d));
  }

  // ---- (D) EMPTY userId can't share one global counter bucket --------------
  // A blank/missing user id must be treated as signed-out (blocked), not as a
  // shared anonymous account that pools everyone's usage into one bucket.
  {
    const blank: MeterIdentity = { userId: '', emails: [], isDev: false };
    const d = await evaluateCompanyTextAccess(blank, {}, {
      areSubscriptionsVerified: () => true,
      resolvePlan: async () => 'pro',
      increment: makeAtomicStore().increment,
    });
    check('empty_userid_signed_out', !d.allowed && d.reason === 'signed-out', JSON.stringify(d));
  }

  console.log('PROBE_DONE');
}

main().catch((e) => {
  console.log(`CHECK probe_crashed FAIL ${e instanceof Error ? e.message : String(e)}`);
  console.log('PROBE_DONE');
  process.exit(1);
});
