#!/usr/bin/env node
/**
 * ALWAYS-ON HALLUCINATION VERIFIER — test suite.
 *
 * Two layers:
 *   1. A runtime probe (tests/verifier.probe.ts) that drives the REAL verifier
 *      core with a fake on-device model and proves it flags source-unsupported
 *      claims, passes clean output, runs a single pass, and degrades gracefully.
 *   2. Static source scans proving the verify path is on-device / $0: the verify
 *      flow imports the Ollama service and NEVER references the cloud meter,
 *      the company key, or the Gemini SDK — so it structurally cannot consume
 *      the cloud allowance.
 *
 * Run: node tests/verifier-test.js   (exits non-zero on any failure)
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'test-screenshots', 'verifier');
fs.mkdirSync(OUT_DIR, { recursive: true });

const results = [];
function record(name, pass, detail = '') { results.push({ name, pass: !!pass, detail }); }
function read(rel) { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; } }

// ---------------------------------------------------------------------------
// 1. Runtime probe.
// ---------------------------------------------------------------------------
function runProbe() {
  const probe = path.join(ROOT, 'tests', 'verifier.probe.ts');
  const res = spawnSync('npx', ['tsx', '--tsconfig', 'tsconfig.json', probe], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env },
    timeout: 120000,
  });
  const out = `${res.stdout || ''}\n${res.stderr || ''}`;
  if (!out.includes('PROBE_DONE')) {
    record('probe_ran', false, `probe did not finish. output:\n${out.slice(0, 800)}`);
    return;
  }
  record('probe_ran', true);
  const required = [
    'analyze_flags_unsupported',
    'analyze_clean_passes',
    'verify_flags_unsupported',
    'verify_single_pass',
    'verify_clean_passes',
    'verify_degrades_no_ondevice',
    'verify_no_generate_when_absent',
    'verify_error_fails_safe',
  ];
  const seen = new Set();
  for (const line of out.split('\n')) {
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
// 2. Static scans — prove the verify path is on-device / $0.
// ---------------------------------------------------------------------------
function runStaticScans() {
  const flow = read('src/ai/flows/verify-against-source.ts');
  record('flow_uses_ollama',
    /ollama-service/.test(flow) && /isOllamaAvailable/.test(flow),
    'verify flow imports the Ollama service');

  // The verify path must never reach the company key / cloud meter / Gemini.
  const forbidden = [
    'resolveCompanyTextAccess',
    'GEMINI_API_KEY',
    'GoogleGenerativeAI',
    'company-text-fallback',
    'ai-usage-meter',
  ];
  const core = read('src/lib/ai/hallucination-verifier.ts');
  const both = `${flow}\n${core}`;
  const hits = forbidden.filter((f) => both.includes(f));
  record('verify_never_touches_cloud_meter', hits.length === 0,
    hits.length ? `forbidden refs: ${hits.join(', ')}` : 'no cloud/meter/Gemini refs in verify path');

  // The core stays provider-agnostic (deps-injected) — it must not import Ollama
  // directly, so it can never accidentally hard-wire a real generator.
  record('core_is_provider_agnostic',
    !/ollama-service/.test(core),
    'core takes an injected generate fn (no direct Ollama import)');
}

// ---------------------------------------------------------------------------
runProbe();
runStaticScans();

const passed = results.filter((r) => r.pass).length;
const failed = results.length - passed;

const md = [
  '# Hallucination Verifier Test',
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
  console.log('\nVERIFIER: PASS — flags source-unsupported claims, passes clean output, on-device/$0, degrades gracefully.');
  process.exit(0);
} else {
  console.log(`\nVERIFIER: FAIL — ${failed} check(s) failed.`);
  process.exit(1);
}
