#!/usr/bin/env node
/**
 * Financial-safety guardrails suite — MANDATORY, never skip. RELEASE BLOCKER.
 *
 * Proves that free / no-user-key usage can NEVER bill our company AI keys: the
 * company-key fallback for cloud TEXT AI stays FAIL-CLOSED by default. Combines:
 *   1. A behavioral probe (tests/cost-guardrails.probe.ts) that loads the REAL
 *      server modules and proves the resolver/failover never reach our key on
 *      the no-user-key path (even if a client lies about "BYOK").
 *   2. Static source scans that prove every server-side cloud-text entry point
 *      routes through the guard and no un-gated company-key read remains.
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
    record('behavioral_probe_ran', false, `probe did not finish. output:\n${out.slice(0, 500)}`);
    return;
  }
  record('behavioral_probe_ran', true);
  // Parse CHECK lines.
  const lines = out.split('\n').filter((l) => l.startsWith('CHECK '));
  const required = [
    'flag_default_off',
    'resolve_nokey_returns_null',
    'resolve_userkey_preserved',
    'requirekey_throws_friendly',
    'failover_cloud_never_called',
    'failover_local_or_friendly',
    'reenable_switch_works',
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
  // (a) actions.ts must not contain a raw `() => ai.generate(` — every genkit
  //     call must go through guardedGenkitGenerate.
  const actions = read('src/app/actions.ts');
  record('actions_no_raw_genkit',
    !/\(\)\s*=>\s*ai\.generate\(/.test(actions),
    'no raw "() => ai.generate(" in actions.ts');

  // (b) Every direct process.env.GEMINI_API_KEY read in actions.ts must be
  //     gated by isCompanyTextFallbackEnabled on the same line.
  let ungatedEnv = 0;
  for (const line of actions.split('\n')) {
    if (line.includes('process.env.GEMINI_API_KEY') && !line.includes('isCompanyTextFallbackEnabled')) {
      ungatedEnv++;
    }
  }
  record('actions_env_reads_gated', ungatedEnv === 0, `ungated env reads=${ungatedEnv}`);

  // (c) media-extractors.ts must route genkit calls through guardedGenerate.
  const media = read('src/lib/media-extractors.ts');
  record('media_no_raw_genkit',
    !/await ai\.generate\(/.test(media),
    'no raw "await ai.generate(" in media-extractors.ts');

  // (d) The resolver must gate its env fallback behind the flag.
  const byok = read('src/lib/byok-keys.ts');
  record('resolver_gates_env',
    /isCompanyTextFallbackEnabled\(\)/.test(byok),
    'byok-keys resolveApiKey references the fallback gate');

  // (e) The failover helper must gate the cloud attempt behind the flag.
  const failover = read('src/lib/ai-failover.ts');
  record('failover_gates_cloud',
    /isCompanyTextFallbackEnabled\(\)/.test(failover),
    'ai-failover references the fallback gate');

  // (f) knowledge-chat route must gate the Gemini stream.
  const kc = read('src/app/api/knowledge-chat/route.ts');
  record('knowledge_chat_gated',
    /isCompanyTextFallbackEnabled\(\)/.test(kc),
    'knowledge-chat references the fallback gate');

  // (g) The gate must DEFAULT to off (no accidental "|| true", etc.).
  const gate = read('src/lib/billing/company-text-fallback.ts');
  record('gate_default_off',
    /ALLOW_COMPANY_TEXT_FALLBACK\s*===\s*'true'/.test(gate),
    'gate is a strict === \'true\' opt-in');
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
  console.log('\nCOST GUARDRAILS: PASS — company AI keys are unreachable on the no-user-key path.');
  process.exit(0);
} else {
  console.log(`\nCOST GUARDRAILS: FAIL — ${failed} check(s) failed. RELEASE BLOCKER.`);
  process.exit(1);
}
