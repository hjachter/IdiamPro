#!/usr/bin/env node
/**
 * Financial-safety guardrails suite — MANDATORY, never skip. RELEASE BLOCKER.
 *
 * Proves that our company AI keys can NEVER be billed by a user who isn't
 * entitled: the SERVER-SIDE, per-account, atomic, monthly AI usage meter
 * enforces every tier's allowance and stays FAIL-CLOSED. The company key is
 * reachable ONLY by the internal developer allowlist, or (once subscriptions
 * are verified server-side) a verified paid user within their allowance.
 *
 * Two layers:
 *   1. A behavioral probe (tests/cost-guardrails.probe.ts) that loads the REAL
 *      server modules and proves — against real code — the five guarantees:
 *      fail-closed for free/no-key/signed-out, over-allowance blocked,
 *      concurrency-safe, BYOK→user key, and the internal dev allowlist.
 *   2. Static source scans proving every server-side cloud-text entry point
 *      routes through the meter and that the production counter is atomic.
 *
 * Run: node tests/cost-guardrails-test.js   (exits non-zero on any failure)
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'test-screenshots', 'cost-guardrails');
fs.mkdirSync(OUT_DIR, { recursive: true });

const results = []; // { name, pass, detail }
function record(name, pass, detail = '') { results.push({ name, pass: !!pass, detail }); }

// ---------------------------------------------------------------------------
// 1. Behavioral probe (runtime proof against the real modules).
// ---------------------------------------------------------------------------
function runBehavioralProbe() {
  const probe = path.join(ROOT, 'tests', 'cost-guardrails.probe.ts');
  const res = spawnSync('npx', ['tsx', '--tsconfig', 'tsconfig.json', probe], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env },
    timeout: 120000,
  });
  const out = `${res.stdout || ''}\n${res.stderr || ''}`;
  if (!out.includes('PROBE_DONE')) {
    record('behavioral_probe_ran', false, `probe did not finish. output:\n${out.slice(0, 800)}`);
    return;
  }
  record('behavioral_probe_ran', true);
  const lines = out.split('\n').filter((l) => l.startsWith('CHECK '));
  const required = [
    'byok_routes_to_user_key',
    'nokey_returns_null_failclosed',
    'requirekey_throws_friendly',
    'dev_allowlist_allowed',
    'meter_byok_never_company',
    'nondev_unverified_blocked',
    'verified_free_blocked',
    'signedout_blocked',
    'over_allowance_blocked',
    'concurrency_safe',
    'uncountable_fails_closed',
  ];
  const seen = new Set();
  for (const line of lines) {
    const m = line.match(/^CHECK (\S+) (PASS|FAIL)(.*)$/);
    if (!m) continue;
    seen.add(m[1]);
    record(`probe:${m[1]}`, m[2] === 'PASS', m[3].trim());
  }
  for (const r of required) {
    if (!seen.has(r)) record(`probe:${r}`, false, 'check missing from probe output');
  }
}

// ---------------------------------------------------------------------------
// 2. Static source scans (prove no un-gated company-key path was reintroduced).
// ---------------------------------------------------------------------------
function read(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; }
}

function runStaticScans() {
  const actions = read('src/app/actions.ts');

  // (a) The genkit choke point must route through the server-side meter.
  record('actions_guard_uses_meter',
    /async function guardedGenkitGenerate[\s\S]{0,400}resolveCompanyTextAccess\(/.test(actions),
    'guardedGenkitGenerate calls resolveCompanyTextAccess');

  // (b) actions.ts must contain no raw `() => ai.generate(` — every genkit call
  //     must go through guardedGenkitGenerate.
  record('actions_no_raw_genkit',
    !/\(\)\s*=>\s*ai\.generate\(/.test(actions),
    'no raw "() => ai.generate(" in actions.ts');

  // (c) Every direct process.env.GEMINI_API_KEY read in actions.ts must be
  //     meter-gated on the same line (references the meter decision `access.`).
  let ungatedEnv = 0;
  for (const line of actions.split('\n')) {
    if (line.includes('process.env.GEMINI_API_KEY') && !/access\.(allowed|fund)/.test(line)) {
      ungatedEnv++;
    }
  }
  record('actions_env_reads_meter_gated', ungatedEnv === 0, `ungated env reads=${ungatedEnv}`);

  // (d) media-extractors.ts must route genkit calls through the meter guard.
  const media = read('src/lib/media-extractors.ts');
  record('media_no_raw_genkit',
    !/await ai\.generate\(/.test(media) && /resolveCompanyTextAccess\(/.test(media),
    'media-extractors guard routes through the meter');

  // (e) knowledge-chat route must gate the Gemini stream via the meter.
  const kc = read('src/app/api/knowledge-chat/route.ts');
  record('knowledge_chat_metered',
    /resolveCompanyTextAccess\(/.test(kc),
    'knowledge-chat references the meter');

  // (f) The failover helper must gate the cloud attempt via the meter.
  const failover = read('src/lib/ai-failover.ts');
  record('failover_metered',
    /resolveCompanyTextAccess\(/.test(failover),
    'ai-failover references the meter');

  // (g) The meter must increment BEFORE comparing (concurrency-safe), and the
  //     "subscriptions verified" switch must be a strict opt-in that defaults off.
  const meter = read('src/lib/billing/ai-usage-meter.ts');
  record('meter_increment_then_compare',
    /const used = await deps\.increment\([\s\S]{0,120}if \(used <= limit\)/.test(meter),
    'meter increments then compares');
  record('meter_verified_strict_optin',
    /SUBSCRIPTIONS_VERIFIED\s*===\s*'true'/.test(meter),
    'subscriptions-verified is a strict === \'true\' opt-in');
  record('meter_free_allowance_zero',
    /free:\s*0\b/.test(meter),
    'free-tier company-AI allowance is 0');

  // (h) Production KV counter must be a true atomic INCR.
  const storage = read('src/lib/storage/adapter.ts');
  record('kv_counter_atomic',
    /kv\.incr\(/.test(storage),
    'KV backend uses atomic kv.incr');

  // (i) Paid-vendor gate shares the internal dev allowlist (all-vendor coverage).
  const paidGate = read('src/lib/billing/paid-feature-gate.ts');
  record('paid_vendor_shares_allowlist',
    /isInternalDevIdentity\(/.test(paidGate),
    'paid-feature-gate honors the internal dev allowlist');
}

// ---------------------------------------------------------------------------
runBehavioralProbe();
runStaticScans();

const passed = results.filter((r) => r.pass).length;
const failed = results.length - passed;

const md = [
  '# Cost Guardrails Test',
  '',
  `Result: ${failed === 0 ? 'PASS' : 'FAIL'} (${passed}/${results.length})`,
  '',
  '| Check | Result | Detail |',
  '| --- | --- | --- |',
  ...results.map((r) => `| ${r.name} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.detail.replace(/\n/g, ' ')} |`),
  '',
].join('\n');
fs.writeFileSync(path.join(OUT_DIR, 'report.md'), md);
fs.writeFileSync(path.join(OUT_DIR, 'report.json'),
  JSON.stringify({ passed, failed, total: results.length, results }, null, 2));

console.log(md);
if (failed === 0) {
  console.log('\nCOST GUARDRAILS: PASS — the server-side per-account AI meter is fail-closed; company keys are unreachable by free/unverified/over-allowance users.');
  process.exit(0);
} else {
  console.log(`\nCOST GUARDRAILS: FAIL — ${failed} check(s) failed. RELEASE BLOCKER.`);
  process.exit(1);
}
